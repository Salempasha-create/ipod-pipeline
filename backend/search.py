"""Search all enabled sources at once and merge the results into one ranked list (SPEC §3)."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from backend.plugins.base import SearchResult, Source

log = logging.getLogger(__name__)

SEARCH_TIMEOUT = 30.0
LOSSLESS = {"FLAC", "ALAC", "WAV", "AIFF"}
IPOD_LOSSY = {"MP3", "AAC"}


def score(result: SearchResult) -> float:
    """Higher is better for an iPod Classic library (ALAC 16/44.1 target, §6.3)."""
    fmt = result.format.upper()
    if fmt in LOSSLESS:
        hires = (result.bit_depth or 16) > 16 or (result.sample_rate or 44100) > 48000
        # Hi-res gets converted down anyway, so it is slightly behind CD quality.
        base = 95.0 if hires else 100.0
    elif fmt in IPOD_LOSSY:
        base = 70.0 if (result.bitrate or 0) >= 256 else 50.0
    else:
        base = 40.0  # needs a lossy-to-lossy conversion
    if result.tracks_expected and result.track_count < result.tracks_expected:
        base -= 30.0
    return base + result.speed * 4 + (5 if result.free_slot else 0)


async def search_sources(sources: list[tuple[str, str, Source]], query: str) -> dict[str, Any]:
    """Run ``search`` on every (id, name, instance) concurrently and merge the results."""

    async def one(source_id: str, source: Source) -> list[SearchResult]:
        return await asyncio.wait_for(source.search(query), SEARCH_TIMEOUT)

    started = time.perf_counter()
    outcomes = await asyncio.gather(
        *(one(sid, src) for sid, _, src in sources), return_exceptions=True
    )
    merged: list[tuple[float, dict[str, Any]]] = []
    errors = []
    for (source_id, source_name, _), outcome in zip(sources, outcomes, strict=True):
        if isinstance(outcome, BaseException):
            log.warning("Search failed for %s: %r", source_id, outcome)
            message = "timed out" if isinstance(outcome, TimeoutError) else str(outcome)
            errors.append({"source_id": source_id, "message": message or type(outcome).__name__})
            continue
        for result in outcome:
            item = result.to_dict()
            item.update(id=f"{source_id}:{result.id}", source_id=source_id, source_name=source_name)
            merged.append((score(result), item))

    merged.sort(key=lambda pair: pair[0], reverse=True)
    results = [item for _, item in merged]
    for i, item in enumerate(results):
        item["best_match"] = i == 0
    return {
        "query": query,
        "results": results,
        "sources_searched": [sid for sid, _, _ in sources],
        "errors": errors,
        "seconds": round(time.perf_counter() - started, 2),
    }
