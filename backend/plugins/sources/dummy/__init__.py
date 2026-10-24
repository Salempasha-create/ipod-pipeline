"""Dummy source: a fake download that shows the job interface working."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from pathlib import Path
from typing import Any, ClassVar

from backend.jobs import JobContext
from backend.plugins.base import FieldType, SettingField, Source

STEPS = 50


class DummySource(Source):
    id = "dummy"
    name = "Dummy source"
    description = "Pretends to download a few files so you can see job progress. For development."
    settings_schema = (
        SettingField(
            "duration",
            FieldType.NUMBER,
            "Job duration (seconds)",
            default=5.0,
            min=0.0,
            max=60.0,
        ),
        SettingField("file_count", FieldType.INTEGER, "Files to produce", default=3, min=1, max=20),
        SettingField(
            "quality",
            FieldType.CHOICE,
            "Pretend quality",
            default="FLAC 16/44",
            choices=("FLAC 16/44", "FLAC 24/96", "MP3 320"),
        ),
        SettingField(
            "fail_halfway",
            FieldType.BOOLEAN,
            "Fail halfway through",
            default=False,
            help="Simulates a failed download.",
        ),
        SettingField(
            "api_key",
            FieldType.STRING,
            "Fake API key",
            secret=True,
            help="Not used. Shows how secret fields are stored in the OS credential store.",
        ),
    )
    test_request: ClassVar[dict[str, Any] | None] = {"query": "Test Artist - Test Song"}

    async def run_job(self, request: Mapping[str, Any], ctx: JobContext) -> list[Path]:
        duration = float(self.settings.get("duration", 5.0))
        count = int(self.settings.get("file_count", 3))
        quality = self.settings.get("quality", "FLAC 16/44")
        query = str(request.get("query", "Unknown"))

        for step in range(1, STEPS + 1):
            await asyncio.sleep(duration / STEPS)
            if self.settings.get("fail_halfway") and step == STEPS // 2:
                raise RuntimeError("Simulated failure halfway through")
            current = min(count, step * count // STEPS + 1)
            ctx.report(step * 100 / STEPS, f"Downloading file {current} of {count}")

        files = []
        for i in range(1, count + 1):
            path = ctx.work_dir / f"{i:02d} - dummy track.txt"
            path.write_text(f"Fake {quality} file for {query!r}\n", encoding="utf-8")
            files.append(path)
        ctx.report(100, f"Downloaded {count} file{'s' if count != 1 else ''}")
        return files
