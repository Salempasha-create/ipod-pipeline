from __future__ import annotations

import asyncio
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.jobs import JobManager, JobStatus
from backend.plugins.base import SearchResult, Source
from backend.search import score, search_sources
from backend.settings import SettingsStore


def result(**overrides) -> SearchResult:
    base = dict(
        id="1",
        kind="album",
        title="T",
        artist="A",
        format="FLAC",
        size_bytes=1,
        track_count=10,
        bit_depth=16,
        sample_rate=44100,
        speed=3,
        free_slot=True,
    )
    base.update(overrides)
    return SearchResult(**base)


def test_score_prefers_cd_quality_then_hires_then_lossy():
    cd = score(result())
    hires = score(result(bit_depth=24, sample_rate=96000))
    mp3 = score(result(format="MP3", bit_depth=None, bitrate=320))
    ogg = score(result(format="OGG", bit_depth=None, bitrate=320))
    assert cd > hires > mp3 > ogg


def test_score_penalises_incomplete_albums():
    complete = score(result(track_count=12, tracks_expected=12))
    incomplete = score(result(track_count=8, tracks_expected=12))
    assert complete - incomplete == 30


class Fixed(Source):
    id = "fixed"
    name = "Fixed"

    def __init__(self, results=None, error=None):
        super().__init__()
        self.results, self.error = results or [], error

    async def search(self, query):
        if self.error:
            raise self.error
        return self.results

    async def run_job(self, request, ctx):
        return []


@pytest.mark.anyio
async def test_merges_sources_marks_one_best_match_and_reports_errors():
    a = Fixed([result(id="x", format="MP3", bitrate=320, bit_depth=None)])
    b = Fixed([result(id="x")])
    broken = Fixed(error=RuntimeError("offline"))

    out = await search_sources([("a", "A", a), ("b", "B", b), ("c", "C", broken)], "q")

    assert [r["id"] for r in out["results"]] == ["b:x", "a:x"]
    assert [r["best_match"] for r in out["results"]] == [True, False]
    assert out["results"][0]["source_name"] == "B"
    assert out["errors"] == [{"source_id": "c", "message": "offline"}]


def test_source_can_search_only_when_overridden():
    class NoSearch(Source):
        id = "nosearch"
        name = "No search"

        async def run_job(self, request, ctx):
            return []

    assert Fixed.can_search() is True
    assert NoSearch.can_search() is False


@pytest.fixture
def client(tmp_path: Path, fake_keyring):
    store = SettingsStore(tmp_path / "settings.json")
    app = create_app(
        store=store,
        jobs=JobManager(work_root=tmp_path / "jobs"),
        ui_dir=tmp_path / "no-ui",
        allowed_hosts=["testserver"],
    )
    with TestClient(app) as test_client:
        yield test_client


def enable_dummy(client: TestClient, duration: float = 0.05) -> None:
    client.put("/api/plugins/source/dummy/enabled", json={"enabled": True})
    client.put("/api/plugins/source/dummy/settings", json={"values": {"duration": duration}})


def wait_done(client: TestClient, job_id: str) -> dict:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "failed", "cancelled"):
            return job
        time.sleep(0.02)
    raise AssertionError("job did not finish")


def test_search_needs_an_enabled_source(client: TestClient):
    assert client.get("/api/search?q=anything").status_code == 409
    enable_dummy(client)
    assert client.get("/api/search?q=%20").status_code == 422


def test_search_returns_ranked_dummy_results(client: TestClient):
    enable_dummy(client)
    body = client.get("/api/search?q=daft punk - discovery").json()

    assert body["sources_searched"] == ["dummy"]
    first = body["results"][0]
    assert first["best_match"] is True
    assert (first["artist"], first["title"], first["format"]) == ("Daft Punk", "Discovery", "FLAC")
    assert all(r["id"].startswith("dummy:") for r in body["results"])
    assert client.get("/api/plugins").json()["plugins"][0]["can_search"] is True


def test_downloaded_result_appears_in_library(client: TestClient):
    enable_dummy(client)
    first = client.get("/api/search?q=artist - album").json()["results"][0]
    job = client.post("/api/sources/dummy/jobs", json={"request": {"result": first}}).json()
    done = wait_done(client, job["id"])

    assert done["status"] == "done"
    assert len(done["files"]) == first["track_count"]
    albums = client.get("/api/library").json()["albums"]
    assert [(a["id"], a["title"], a["track_count"]) for a in albums] == [
        (job["id"], "Album", first["track_count"])
    ]
    assert client.post("/api/library/unknown/open").status_code == 404


def test_test_jobs_do_not_appear_in_library(client: TestClient):
    enable_dummy(client)
    job = client.post("/api/sources/dummy/jobs", json={}).json()
    wait_done(client, job["id"])

    assert client.get("/api/library").json()["albums"] == []


def test_pause_holds_queued_jobs(client: TestClient):
    enable_dummy(client)
    assert client.put("/api/jobs/paused", json={"paused": True}).json() == {"paused": True}
    job = client.post("/api/sources/dummy/jobs", json={}).json()
    time.sleep(0.2)

    assert client.get(f"/api/jobs/{job['id']}").json()["status"] == "queued"
    assert client.get("/api/jobs").json()["paused"] is True

    client.put("/api/jobs/paused", json={"paused": False})
    assert wait_done(client, job["id"])["status"] == "done"


@pytest.mark.anyio
async def test_manager_pause_and_resume(tmp_path: Path):
    manager = JobManager(work_root=tmp_path)
    manager.set_paused(True)
    job = manager.start(Fixed())
    await asyncio.sleep(0.05)
    assert job.status is JobStatus.QUEUED
    manager.set_paused(False)
    await manager.wait(job.id)
    assert job.status is JobStatus.DONE
