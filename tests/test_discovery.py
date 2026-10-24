from __future__ import annotations

import sys
import textwrap
from pathlib import Path

import pytest

from backend.plugins.base import PluginKind, Processor, Source, Target
from backend.plugins.discovery import discover


def test_discovers_bundled_dummy_plugins():
    registry = discover()

    assert registry.errors == []
    assert issubclass(registry.get(PluginKind.SOURCE, "dummy"), Source)
    assert issubclass(registry.get(PluginKind.PROCESSOR, "dummy"), Processor)
    assert issubclass(registry.get(PluginKind.TARGET, "dummy"), Target)


def write_plugin(root: Path, folder: str, name: str, body: str) -> None:
    plugin_dir = root / folder / name
    plugin_dir.mkdir(parents=True)
    (plugin_dir / "__init__.py").write_text(textwrap.dedent(body), encoding="utf-8")


@pytest.fixture
def plugin_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A throwaway ``fakeplugins`` package with sources/, processors/ and targets/."""
    root = tmp_path / "fakeplugins"
    for folder in ("", "sources", "processors", "targets"):
        (root / folder).mkdir(exist_ok=True)
        (root / folder / "__init__.py").write_text("", encoding="utf-8")
    monkeypatch.syspath_prepend(str(tmp_path))
    yield root
    for name in [m for m in sys.modules if m == "fakeplugins" or m.startswith("fakeplugins.")]:
        del sys.modules[name]


SOURCE_TEMPLATE = """
from backend.plugins.base import Source

class {cls}(Source):
    id = "{id}"
    name = "{cls}"

    async def run_job(self, request, ctx):
        return []
"""


def test_each_plugin_folder_is_discovered(plugin_root: Path):
    write_plugin(plugin_root, "sources", "alpha", SOURCE_TEMPLATE.format(cls="Alpha", id="alpha"))
    write_plugin(plugin_root, "sources", "beta", SOURCE_TEMPLATE.format(cls="Beta", id="beta"))
    write_plugin(
        plugin_root,
        "targets",
        "folder",
        """
        from backend.plugins.base import Target

        class Folder(Target):
            id = "folder"
            name = "Folder"

            async def deliver(self, path):
                return path
        """,
    )

    registry = discover("fakeplugins")

    assert registry.errors == []
    assert sorted(registry.plugins[PluginKind.SOURCE]) == ["alpha", "beta"]
    assert list(registry.plugins[PluginKind.TARGET]) == ["folder"]
    assert registry.plugins[PluginKind.PROCESSOR] == {}


def test_plugin_class_can_live_in_a_submodule(plugin_root: Path):
    plugin_dir = plugin_root / "sources" / "split"
    plugin_dir.mkdir()
    (plugin_dir / "plugin.py").write_text(
        SOURCE_TEMPLATE.format(cls="Split", id="split"), encoding="utf-8"
    )
    (plugin_dir / "__init__.py").write_text("from .plugin import Split\n", encoding="utf-8")

    registry = discover("fakeplugins")

    assert list(registry.plugins[PluginKind.SOURCE]) == ["split"]


def test_imported_base_classes_and_wrong_kinds_are_ignored(plugin_root: Path):
    # A source placed in processors/ is not a Processor, so nothing registers there.
    write_plugin(plugin_root, "processors", "misplaced", SOURCE_TEMPLATE.format(cls="M", id="m"))

    registry = discover("fakeplugins")

    assert registry.plugins[PluginKind.PROCESSOR] == {}
    assert registry.plugins[PluginKind.SOURCE] == {}
    assert [e.message for e in registry.errors] == ["no Processor subclass found"]


def test_broken_plugins_are_reported_not_fatal(plugin_root: Path):
    write_plugin(plugin_root, "sources", "good", SOURCE_TEMPLATE.format(cls="Good", id="good"))
    write_plugin(plugin_root, "sources", "crash", "raise RuntimeError('boom')\n")
    write_plugin(plugin_root, "sources", "badid", SOURCE_TEMPLATE.format(cls="Bad", id="Bad ID"))
    write_plugin(plugin_root, "sources", "zdupe", SOURCE_TEMPLATE.format(cls="Dupe", id="good"))

    registry = discover("fakeplugins")

    assert list(registry.plugins[PluginKind.SOURCE]) == ["good"]
    messages = {e.module.rsplit(".", 1)[-1]: e.message for e in registry.errors}
    assert messages["crash"] == "import failed: boom"
    assert "invalid or missing id" in messages["badid"]
    assert "duplicate id 'good'" in messages["zdupe"]


def test_private_folders_and_plain_modules_are_skipped(plugin_root: Path):
    write_plugin(plugin_root, "sources", "_template", "raise RuntimeError('do not import')\n")
    (plugin_root / "sources" / "helpers.py").write_text("raise RuntimeError('no')\n")

    registry = discover("fakeplugins")

    assert registry.errors == []
    assert registry.plugins[PluginKind.SOURCE] == {}


def test_invalid_settings_schema_is_reported(plugin_root: Path):
    write_plugin(
        plugin_root,
        "sources",
        "badschema",
        """
        from backend.plugins.base import FieldType, SettingField, Source

        class BadSchema(Source):
            id = "badschema"
            name = "Bad schema"
            settings_schema = (SettingField("token", FieldType.BOOLEAN, "Token", secret=True),)

            async def run_job(self, request, ctx):
                return []
        """,
    )

    registry = discover("fakeplugins")

    assert registry.plugins[PluginKind.SOURCE] == {}
    assert "must be of type string" in registry.errors[0].message
