"""Dummy target: copies files into a folder. For development."""

from __future__ import annotations

import shutil
from pathlib import Path

from backend.plugins.base import FieldType, SettingField, Target


class DummyTarget(Target):
    id = "dummy"
    name = "Dummy target"
    description = "Copies finished files into a folder. Placeholder until the library target lands."
    settings_schema = (
        SettingField(
            "folder",
            FieldType.PATH,
            "Output folder",
            default="",
            help="Leave empty to keep files where they are.",
        ),
    )

    async def deliver(self, path: Path) -> Path:
        folder = self.settings.get("folder") or ""
        if not folder:
            return path
        dest = Path(folder).expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        return Path(shutil.copy2(path, dest / path.name))
