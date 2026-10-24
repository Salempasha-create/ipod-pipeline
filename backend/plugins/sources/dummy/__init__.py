"""Dummy source: fake search results and downloads, to try the app before real sources exist."""

from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Mapping
from pathlib import Path
from typing import Any, ClassVar

from backend.jobs import JobContext
from backend.plugins.base import FieldType, SearchResult, SettingField, Source

STEPS = 50

# Fake releases for any query, in the spirit of the PL-1 reference mockup.
FAKE_RELEASES: list[dict[str, Any]] = [
    dict(suffix="", fmt="FLAC", depth=16, rate=44100, tracks=10, mb=241, speed=4,
         uploader="vinylcrate_88 · free slot"),
    dict(suffix=" (Remaster)", fmt="FLAC", depth=24, rate=96000, tracks=10, mb=902, speed=5,
         uploader="posted 3 days ago"),
    dict(suffix="", fmt="MP3", bitrate=320, tracks=10, mb=98, speed=2, uploader="12 seeders"),
    dict(suffix=" (partial)", fmt="FLAC", depth=16, rate=44100, tracks=7, mb=160, speed=3,
         free=False, uploader="jazzfreak · 6 in queue"),
    dict(suffix=" — Single", kind="track", fmt="OGG", bitrate=192, tracks=1, expected=1, mb=7,
         speed=1, uploader="radio_rips"),
]  # fmt: skip


class DummySource(Source):
    id = "dummy"
    name = "Dummy source"
    description = "Pretend search results and downloads, for trying the app. For development."
    icon = "music"
    code = "DEMO"
    # Development-only color, distinct from the four real source colors (DESIGN.md §4).
    color = "#B58CFF"
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

    async def search(self, query: str) -> list[SearchResult]:
        await asyncio.sleep(0.3)  # pretend to wait for the network
        query = " ".join(query.split()) or "Unknown Artist"
        artist, _, album = query.partition(" - ")
        artist, album = artist.title(), (album or "Greatest Hits").title()
        seed = int(hashlib.sha1(query.lower().encode()).hexdigest()[:6], 16)
        full = max(r["tracks"] for r in FAKE_RELEASES)
        return [
            SearchResult(
                id=f"{seed:x}-{i}",
                kind=r.get("kind", "album"),
                title=album + r["suffix"],
                artist=artist,
                year=1970 + (seed + i * 7) % 54,
                format=r["fmt"],
                bit_depth=r.get("depth"),
                sample_rate=r.get("rate", 44100),
                bitrate=r.get("bitrate"),
                size_bytes=r["mb"] * 1_000_000,
                track_count=r["tracks"],
                tracks_expected=r.get("expected", full),
                speed=r["speed"],
                free_slot=r.get("free", True),
                uploader=r["uploader"],
            )
            for i, r in enumerate(FAKE_RELEASES)
        ]

    async def run_job(self, request: Mapping[str, Any], ctx: JobContext) -> list[Path]:
        duration = float(self.settings.get("duration", 5.0))
        result = request.get("result") or {}
        count = min(20, int(result.get("track_count") or self.settings.get("file_count", 3)))
        quality = result.get("format") or self.settings.get("quality", "FLAC 16/44")
        query = str(result.get("title") or request.get("query", "Unknown"))

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
