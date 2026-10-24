"""Plugin settings storage (SPEC §8, §10).

Non-secret values and the enabled flag live in a JSON file in the OS config
folder (via platformdirs). Fields marked ``secret`` go to the OS credential
store via keyring and are never written to the settings file.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

import keyring
import keyring.errors
from platformdirs import user_config_path

from backend import APP_NAME
from backend.plugins.base import Plugin

log = logging.getLogger(__name__)

SETTINGS_VERSION = 1
KEYRING_SERVICE = APP_NAME


class SettingsError(ValueError):
    """Invalid settings submitted for a plugin."""


def default_settings_path() -> Path:
    return user_config_path(APP_NAME, appauthor=False) / "settings.json"


def _plugin_key(plugin: type[Plugin]) -> str:
    return f"{plugin.kind.value}.{plugin.id}"


class SettingsStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or default_settings_path()
        self._lock = threading.Lock()
        self._data = self._load()

    # --- file handling -------------------------------------------------

    def _load(self) -> dict[str, Any]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {"version": SETTINGS_VERSION, "plugins": {}}
        except (OSError, json.JSONDecodeError):
            log.exception("Could not read %s; starting with empty settings", self.path)
            return {"version": SETTINGS_VERSION, "plugins": {}}
        if not isinstance(data, dict) or not isinstance(data.get("plugins"), dict):
            return {"version": SETTINGS_VERSION, "plugins": {}}
        return data

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".settings-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(self._data, fh, indent=2, sort_keys=True)
            os.replace(tmp, self.path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise

    def _entry(self, plugin: type[Plugin]) -> dict[str, Any]:
        return self._data["plugins"].setdefault(
            _plugin_key(plugin), {"enabled": False, "settings": {}}
        )

    # --- enabled flag --------------------------------------------------

    def is_enabled(self, plugin: type[Plugin]) -> bool:
        entry = self._data["plugins"].get(_plugin_key(plugin), {})
        return entry.get("enabled", False) is True

    def set_enabled(self, plugin: type[Plugin], enabled: bool) -> None:
        with self._lock:
            self._entry(plugin)["enabled"] = bool(enabled)
            self._save()

    # --- values --------------------------------------------------------

    def values(self, plugin: type[Plugin]) -> dict[str, Any]:
        """Non-secret values with defaults filled in. Safe to send to the UI."""
        saved = self._data["plugins"].get(_plugin_key(plugin), {}).get("settings", {})
        result: dict[str, Any] = {}
        for field in plugin.settings_schema:
            if field.secret:
                continue
            value = saved.get(field.key, field.default)
            try:
                result[field.key] = field.coerce(value) if value is not None else None
            except ValueError:
                result[field.key] = field.default
        return result

    def secrets_set(self, plugin: type[Plugin]) -> dict[str, bool]:
        """Which secret fields have a stored value (the values themselves stay hidden)."""
        return {
            field.key: self._get_secret(plugin, field.key) is not None
            for field in plugin.settings_schema
            if field.secret
        }

    def resolved(self, plugin: type[Plugin]) -> dict[str, Any]:
        """All values including secrets, for handing to a plugin instance."""
        result = self.values(plugin)
        for field in plugin.settings_schema:
            if field.secret:
                result[field.key] = self._get_secret(plugin, field.key)
        return result

    def update(self, plugin: type[Plugin], changes: dict[str, Any]) -> None:
        """Apply ``changes`` atomically: everything is validated before anything is stored.

        For secret fields, a string stores the secret and ``None`` deletes it.
        For other fields, ``None`` resets the value to its default.
        """
        fields = {f.key: f for f in plugin.settings_schema}
        unknown = sorted(set(changes) - set(fields))
        if unknown:
            raise SettingsError(f"unknown setting(s): {', '.join(unknown)}")

        plain: dict[str, Any] = {}
        secrets: dict[str, str | None] = {}
        for key, value in changes.items():
            field = fields[key]
            if field.secret and value == "":
                value = None
            if value is not None:
                try:
                    value = field.coerce(value)
                except ValueError as exc:
                    raise SettingsError(str(exc)) from exc
            (secrets if field.secret else plain)[key] = value

        for key, secret in secrets.items():
            self._set_secret(plugin, key, secret)

        with self._lock:
            saved = self._entry(plugin)["settings"]
            for key, value in plain.items():
                if value is None:
                    saved.pop(key, None)
                else:
                    saved[key] = value
            self._save()

    # --- keyring -------------------------------------------------------

    @staticmethod
    def _secret_name(plugin: type[Plugin], key: str) -> str:
        return f"{_plugin_key(plugin)}.{key}"

    def _get_secret(self, plugin: type[Plugin], key: str) -> str | None:
        try:
            return keyring.get_password(KEYRING_SERVICE, self._secret_name(plugin, key))
        except keyring.errors.KeyringError:
            log.exception("Could not read secret from the OS credential store")
            return None

    def _set_secret(self, plugin: type[Plugin], key: str, value: str | None) -> None:
        name = self._secret_name(plugin, key)
        try:
            if value is None:
                with contextlib.suppress(keyring.errors.PasswordDeleteError):
                    keyring.delete_password(KEYRING_SERVICE, name)
            else:
                keyring.set_password(KEYRING_SERVICE, name, value)
        except keyring.errors.KeyringError as exc:
            raise SettingsError(f"could not access the OS credential store: {exc}") from exc
