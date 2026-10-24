"""Dummy processor: passes files through unchanged. For development."""

from __future__ import annotations

from pathlib import Path

from backend.plugins.base import FieldType, Processor, SettingField


class DummyProcessor(Processor):
    id = "dummy"
    name = "Dummy processor"
    description = "Passes files through unchanged. Placeholder until tagging and conversion land."
    settings_schema = (
        SettingField("suffix", FieldType.STRING, "Note to add to the file", default="processed"),
    )

    async def process(self, path: Path) -> Path:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(f"{self.settings.get('suffix', 'processed')}\n")
        return path
