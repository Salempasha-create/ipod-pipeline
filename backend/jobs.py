"""Background jobs run by source plugins (SPEC §3.3, §4 Rules).

A job moves through ``queued -> running -> done | failed | cancelled``. The
source reports progress through its :class:`JobContext` and returns the
finished file paths.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any

from platformdirs import user_cache_path

from backend import APP_NAME
from backend.plugins.base import Source

log = logging.getLogger(__name__)


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def finished(self) -> bool:
        return self in (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED)


@dataclass
class Job:
    id: str
    source_id: str
    request: dict[str, Any]
    status: JobStatus = JobStatus.QUEUED
    percent: float = 0.0
    message: str = ""
    files: list[Path] = field(default_factory=list)
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_id": self.source_id,
            "request": self.request,
            "status": self.status.value,
            "percent": round(self.percent, 1),
            "message": self.message,
            "files": [str(p) for p in self.files],
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class JobContext:
    """Handed to ``Source.run_job`` so the plugin can report progress."""

    def __init__(self, job: Job, work_dir: Path) -> None:
        self._job = job
        self.work_dir = work_dir

    @property
    def job_id(self) -> str:
        return self._job.id

    def report(self, percent: float, message: str | None = None) -> None:
        self._job.percent = max(0.0, min(100.0, float(percent)))
        if message is not None:
            self._job.message = message
        self._job.updated_at = time.time()


def default_work_root() -> Path:
    return user_cache_path(APP_NAME, appauthor=False) / "jobs"


class JobManager:
    """Starts, tracks and cancels jobs. Must be used from inside a running event loop."""

    def __init__(self, work_root: Path | None = None, max_concurrent: int = 2) -> None:
        self.work_root = work_root or default_work_root()
        self._jobs: dict[str, Job] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._slots = asyncio.Semaphore(max_concurrent)

    def start(self, source: Source, request: Mapping[str, Any] | None = None) -> Job:
        job = Job(id=uuid.uuid4().hex, source_id=source.id, request=dict(request or {}))
        self._jobs[job.id] = job
        task = asyncio.create_task(self._run(job, source), name=f"job-{job.id}")
        self._tasks[job.id] = task
        task.add_done_callback(lambda t: self._finished(job, t))
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def all(self) -> list[Job]:
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    def cancel(self, job_id: str) -> bool:
        """Request cancellation. Returns False if the job is unknown or already finished."""
        job = self._jobs.get(job_id)
        task = self._tasks.get(job_id)
        if job is None or task is None or job.status.finished:
            return False
        task.cancel()
        return True

    async def wait(self, job_id: str) -> Job:
        task = self._tasks.get(job_id)
        if task is not None:
            await asyncio.gather(task, return_exceptions=True)
        return self._jobs[job_id]

    async def shutdown(self) -> None:
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _run(self, job: Job, source: Source) -> None:
        try:
            async with self._slots:
                self._set(job, JobStatus.RUNNING)
                work_dir = self.work_root / job.id
                work_dir.mkdir(parents=True, exist_ok=True)
                files = await source.run_job(job.request, JobContext(job, work_dir))
            job.files = [Path(p) for p in files]
            job.percent = 100.0
            self._set(job, JobStatus.DONE)
        except asyncio.CancelledError:
            self._set(job, JobStatus.CANCELLED)
        except Exception as exc:
            log.exception("Job %s (%s) failed", job.id, job.source_id)
            job.error = str(exc) or type(exc).__name__
            self._set(job, JobStatus.FAILED)

    def _finished(self, job: Job, task: asyncio.Task[None]) -> None:
        self._tasks.pop(job.id, None)
        # A task cancelled before it first ran never enters _run's try block.
        if task.cancelled() and not job.status.finished:
            self._set(job, JobStatus.CANCELLED)

    @staticmethod
    def _set(job: Job, status: JobStatus) -> None:
        job.status = status
        job.updated_at = time.time()
