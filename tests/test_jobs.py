from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from backend.jobs import JobManager, JobStatus
from backend.plugins.base import Source
from backend.plugins.sources.dummy import DummySource

pytestmark = pytest.mark.anyio


class Controlled(Source):
    """A source whose job advances only when the test says so."""

    id = "controlled"
    name = "Controlled"

    def __init__(self, settings=None) -> None:
        super().__init__(settings)
        self.started = asyncio.Event()
        self.proceed = asyncio.Event()
        self.cleaned_up = False

    async def run_job(self, request, ctx):
        ctx.report(10, "started")
        self.started.set()
        try:
            await self.proceed.wait()
        except asyncio.CancelledError:
            self.cleaned_up = True
            raise
        if request.get("fail"):
            raise ValueError("source exploded")
        ctx.report(90, "finishing")
        out = ctx.work_dir / "song.flac"
        out.write_bytes(b"fake")
        return [out]


@pytest.fixture
def manager(tmp_path: Path) -> JobManager:
    return JobManager(work_root=tmp_path / "jobs", max_concurrent=1)


async def test_job_lifecycle_to_done(manager: JobManager, tmp_path: Path):
    source = Controlled()
    job = manager.start(source, {"query": "x"})
    assert job.status is JobStatus.QUEUED

    await source.started.wait()
    assert job.status is JobStatus.RUNNING
    assert (job.percent, job.message) == (10, "started")

    source.proceed.set()
    await manager.wait(job.id)

    assert job.status is JobStatus.DONE
    assert job.percent == 100
    assert job.files == [tmp_path / "jobs" / job.id / "song.flac"]
    assert job.files[0].read_bytes() == b"fake"
    assert job.error is None


async def test_failed_job_records_the_error(manager: JobManager):
    source = Controlled()
    job = manager.start(source, {"fail": True})
    source.proceed.set()
    await manager.wait(job.id)

    assert job.status is JobStatus.FAILED
    assert job.error == "source exploded"
    assert job.files == []


async def test_cancel_running_job(manager: JobManager):
    source = Controlled()
    job = manager.start(source)
    await source.started.wait()

    assert manager.cancel(job.id) is True
    await manager.wait(job.id)

    assert job.status is JobStatus.CANCELLED
    assert source.cleaned_up is True


async def test_jobs_wait_for_a_free_slot_and_can_be_cancelled_while_queued(manager):
    first, second = Controlled(), Controlled()
    job1 = manager.start(first)
    job2 = manager.start(second)
    await first.started.wait()
    await asyncio.sleep(0)

    assert job1.status is JobStatus.RUNNING
    assert job2.status is JobStatus.QUEUED

    assert manager.cancel(job2.id) is True
    await manager.wait(job2.id)
    assert job2.status is JobStatus.CANCELLED
    assert not second.started.is_set()

    first.proceed.set()
    await manager.wait(job1.id)
    assert job1.status is JobStatus.DONE


async def test_cancel_immediately_after_start(manager: JobManager):
    job = manager.start(Controlled())
    assert manager.cancel(job.id) is True
    await manager.wait(job.id)

    assert job.status is JobStatus.CANCELLED


async def test_cancel_finished_or_unknown_job_returns_false(manager: JobManager):
    source = Controlled()
    job = manager.start(source)
    source.proceed.set()
    await manager.wait(job.id)

    assert manager.cancel(job.id) is False
    assert manager.cancel("does-not-exist") is False


async def test_shutdown_cancels_everything(manager: JobManager):
    source = Controlled()
    job = manager.start(source)
    await source.started.wait()

    await manager.shutdown()

    assert job.status is JobStatus.CANCELLED


async def test_dummy_source_reports_progress_and_returns_files(manager: JobManager):
    source = DummySource({"duration": 0.2, "file_count": 2, "quality": "MP3 320"})
    job = manager.start(source, {"query": "Artist - Song"})
    seen: list[float] = []
    while not job.status.finished:
        seen.append(job.percent)
        await asyncio.sleep(0.01)

    assert job.status is JobStatus.DONE
    assert len(job.files) == 2
    assert all(p.is_file() for p in job.files)
    assert "MP3 320" in job.files[0].read_text(encoding="utf-8")
    assert any(0 < p < 100 for p in seen)
    assert seen == sorted(seen)


async def test_dummy_source_can_fail(manager: JobManager):
    job = manager.start(DummySource({"duration": 0.05, "fail_halfway": True}))
    await manager.wait(job.id)

    assert job.status is JobStatus.FAILED
    assert 0 < job.percent < 100
    assert "halfway" in job.error
