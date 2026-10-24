from __future__ import annotations

import json
from pathlib import Path

import keyring.errors
import pytest

from backend.plugins.base import FieldType, SettingField, Source
from backend.settings import KEYRING_SERVICE, SettingsError, SettingsStore


class Example(Source):
    id = "example"
    name = "Example"
    settings_schema = (
        SettingField("username", FieldType.STRING, "Username", default=""),
        SettingField("password", FieldType.STRING, "Password", secret=True),
        SettingField("slots", FieldType.INTEGER, "Slots", default=2, min=1, max=10),
        SettingField("ratio", FieldType.NUMBER, "Ratio", default=1.5),
        SettingField("share", FieldType.BOOLEAN, "Share", default=False),
        SettingField("mode", FieldType.CHOICE, "Mode", default="a", choices=("a", "b")),
    )

    async def run_job(self, request, ctx):
        return []


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "config" / "settings.json"


@pytest.fixture
def store(path: Path, fake_keyring) -> SettingsStore:
    return SettingsStore(path)


def test_defaults_without_a_settings_file(store: SettingsStore):
    assert store.values(Example) == {
        "username": "",
        "slots": 2,
        "ratio": 1.5,
        "share": False,
        "mode": "a",
    }
    assert store.secrets_set(Example) == {"password": False}


def test_plugins_are_disabled_by_default(store: SettingsStore):
    assert store.is_enabled(Example) is False


def test_settings_and_enabled_survive_reload(store: SettingsStore, path: Path, fake_keyring):
    store.set_enabled(Example, True)
    store.update(Example, {"username": "selim", "slots": 5, "share": True, "mode": "b"})

    reloaded = SettingsStore(path)

    assert reloaded.is_enabled(Example) is True
    assert reloaded.values(Example) == {
        "username": "selim",
        "slots": 5,
        "ratio": 1.5,
        "share": True,
        "mode": "b",
    }


def test_none_resets_to_default(store: SettingsStore):
    store.update(Example, {"slots": 7})
    store.update(Example, {"slots": None})

    assert store.values(Example)["slots"] == 2


def test_secrets_go_to_keyring_never_the_file(store: SettingsStore, path: Path, fake_keyring):
    store.update(Example, {"username": "selim", "password": "hunter2"})

    assert fake_keyring.passwords == {(KEYRING_SERVICE, "source.example.password"): "hunter2"}
    assert "hunter2" not in path.read_text(encoding="utf-8")
    assert "password" not in json.loads(path.read_text())["plugins"]["source.example"]["settings"]
    assert "password" not in store.values(Example)
    assert store.secrets_set(Example) == {"password": True}
    assert store.resolved(Example)["password"] == "hunter2"


def test_secret_can_be_cleared(store: SettingsStore, fake_keyring):
    store.update(Example, {"password": "hunter2"})
    store.update(Example, {"password": None})

    assert fake_keyring.passwords == {}
    assert store.secrets_set(Example) == {"password": False}
    assert store.resolved(Example)["password"] is None


def test_empty_secret_is_treated_as_clear(store: SettingsStore, fake_keyring):
    store.update(Example, {"password": "hunter2"})
    store.update(Example, {"password": ""})

    assert fake_keyring.passwords == {}


@pytest.mark.parametrize(
    "changes",
    [
        {"slots": "five"},
        {"slots": 2.5},
        {"slots": True},
        {"slots": 11},
        {"share": "yes"},
        {"mode": "c"},
        {"username": 3},
        {"nope": 1},
    ],
)
def test_invalid_values_are_rejected(store: SettingsStore, changes):
    with pytest.raises(SettingsError):
        store.update(Example, changes)


def test_invalid_update_changes_nothing(store: SettingsStore, path: Path, fake_keyring):
    store.update(Example, {"username": "before"})

    with pytest.raises(SettingsError):
        store.update(Example, {"username": "after", "password": "secret", "slots": 99})

    assert SettingsStore(path).values(Example)["username"] == "before"
    assert fake_keyring.passwords == {}


def test_corrupt_settings_file_falls_back_to_defaults(path: Path, fake_keyring):
    path.parent.mkdir(parents=True)
    path.write_text("{not json", encoding="utf-8")

    store = SettingsStore(path)

    assert store.values(Example)["slots"] == 2
    assert store.is_enabled(Example) is False


def test_keyring_failure_is_reported(store: SettingsStore, fake_keyring, monkeypatch):
    def broken(*args):
        raise keyring.errors.KeyringError("no backend")

    monkeypatch.setattr(fake_keyring, "set_password", broken)

    with pytest.raises(SettingsError, match="credential store"):
        store.update(Example, {"password": "hunter2"})
