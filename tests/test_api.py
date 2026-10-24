from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.jobs import JobManager
from backend.settings import SettingsStore

DUMMY = "/api/plugins/source/dummy"


@pytest.fixture
def client(tmp_path: Path, fake_keyring):
    store = SettingsStore(tmp_path / "settings.json")
    app = create_app(
        store=store,
        jobs=JobManager(work_root=tmp_path / "jobs"),
        ui_dir=tmp_path / "no-ui",
        allowed_hosts=["testserver", "127.0.0.1", "localhost"],
    )
    with TestClient(app) as test_client:
        yield test_client


def plugin(client: TestClient, kind: str, plugin_id: str) -> dict:
    plugins = client.get("/api/plugins").json()["plugins"]
    return next(p for p in plugins if p["kind"] == kind and p["id"] == plugin_id)


def wait_for_job(client: TestClient, job_id: str, timeout: float = 5) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "failed", "cancelled"):
            return job
        time.sleep(0.02)
    raise AssertionError("job did not finish")


def test_lists_all_plugin_kinds_disabled(client: TestClient):
    body = client.get("/api/plugins").json()

    assert body["errors"] == []
    assert {(p["kind"], p["id"]) for p in body["plugins"]} == {
        ("source", "dummy"),
        ("processor", "dummy"),
        ("target", "dummy"),
    }
    assert all(p["enabled"] is False for p in body["plugins"])
    source = plugin(client, "source", "dummy")
    assert source["can_test"] is True
    fields = {f["key"]: f for f in source["settings_schema"]}
    assert fields["api_key"]["secret"] is True
    assert fields["duration"] == {
        "key": "duration",
        "type": "number",
        "label": "Job duration (seconds)",
        "default": 5.0,
        "secret": False,
        "help": "",
        "choices": [],
        "min": 0.0,
        "max": 60.0,
    }


def test_enable_and_disable(client: TestClient):
    assert client.put(f"{DUMMY}/enabled", json={"enabled": True}).json()["enabled"] is True
    assert plugin(client, "source", "dummy")["enabled"] is True
    assert client.put(f"{DUMMY}/enabled", json={"enabled": False}).json()["enabled"] is False


def test_update_settings_never_returns_secrets(client: TestClient, fake_keyring):
    res = client.put(f"{DUMMY}/settings", json={"values": {"file_count": 4, "api_key": "s3cret"}})

    assert res.status_code == 200
    body = res.json()
    assert body["values"]["file_count"] == 4
    assert body["secrets_set"] == {"api_key": True}
    assert "s3cret" not in res.text
    assert "s3cret" not in client.get("/api/plugins").text
    assert list(fake_keyring.passwords.values()) == ["s3cret"]


def test_invalid_settings_return_422(client: TestClient):
    res = client.put(f"{DUMMY}/settings", json={"values": {"file_count": 0}})

    assert res.status_code == 422
    assert "at least" in res.json()["detail"]


def test_unknown_plugin_returns_404(client: TestClient):
    assert client.put("/api/plugins/source/nope/enabled", json={"enabled": True}).status_code == 404
    assert (
        client.put("/api/plugins/widget/dummy/enabled", json={"enabled": True}).status_code == 404
    )


def test_disabled_source_cannot_start_jobs(client: TestClient):
    res = client.post("/api/sources/dummy/jobs", json={})

    assert res.status_code == 409


def test_run_test_job_to_completion(client: TestClient):
    client.put(f"{DUMMY}/enabled", json={"enabled": True})
    client.put(f"{DUMMY}/settings", json={"values": {"duration": 0.1, "file_count": 2}})

    res = client.post("/api/sources/dummy/jobs", json={})
    assert res.status_code == 201
    job = wait_for_job(client, res.json()["id"])

    assert job["status"] == "done"
    assert job["percent"] == 100
    assert job["request"] == {"query": "Test Artist - Test Song"}
    assert len(job["files"]) == 2
    assert [j["id"] for j in client.get("/api/jobs").json()["jobs"]] == [job["id"]]


def test_cancel_job(client: TestClient):
    client.put(f"{DUMMY}/enabled", json={"enabled": True})
    client.put(f"{DUMMY}/settings", json={"values": {"duration": 30}})
    job_id = client.post("/api/sources/dummy/jobs", json={}).json()["id"]

    assert client.post(f"/api/jobs/{job_id}/cancel").status_code == 200
    assert wait_for_job(client, job_id)["status"] == "cancelled"
    assert client.post(f"/api/jobs/{job_id}/cancel").status_code == 409
    assert client.post("/api/jobs/unknown/cancel").status_code == 404


def test_cross_origin_writes_are_refused(client: TestClient):
    res = client.put(
        f"{DUMMY}/enabled", json={"enabled": True}, headers={"Origin": "https://evil.example"}
    )

    assert res.status_code == 403
    assert plugin(client, "source", "dummy")["enabled"] is False
    ok = client.put(
        f"{DUMMY}/enabled", json={"enabled": True}, headers={"Origin": "http://127.0.0.1:5173"}
    )
    assert ok.status_code == 200


def test_unknown_host_header_is_refused(client: TestClient):
    assert client.get("/api/plugins", headers={"Host": "evil.example"}).status_code == 400


def test_root_explains_missing_ui_build(client: TestClient):
    res = client.get("/")

    assert res.status_code == 200
    assert "UI not built" in res.text
