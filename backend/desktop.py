"""Bridge between the UI and the native window, exposed to JavaScript as ``pywebview.api``."""

from __future__ import annotations

import os
import sys
from typing import Any

FRAMELESS_ENV = "IPOD_PIPELINE_FRAMELESS"


def want_frameless(cli_choice: bool | None = None) -> bool:
    """Frameless window (DESIGN.md §4), except on Linux where it is untested.

    Order of precedence: command-line flag, then the IPOD_PIPELINE_FRAMELESS
    environment variable (1/0), then the per-OS default.
    """
    if cli_choice is not None:
        return cli_choice
    env = os.environ.get(FRAMELESS_ENV)
    if env in ("0", "1"):
        return env == "1"
    return not sys.platform.startswith("linux")


class DesktopApi:
    """Methods the UI can call. pywebview runs each call on its own thread."""

    def __init__(self, frameless: bool) -> None:
        self._frameless = frameless
        self._window: Any = None

    # Underscore: pywebview does not expose it to JavaScript.
    def _attach(self, window: Any) -> None:
        self._window = window

    def window_info(self) -> dict[str, Any]:
        return {"frameless": self._frameless, "platform": sys.platform}

    def minimize(self) -> None:
        if self._window is not None:
            self._window.minimize()

    def close(self) -> None:
        if self._window is not None:
            self._window.destroy()

    def pick_folder(self) -> str | None:
        """Show the native folder picker and return the chosen path, or None."""
        if self._window is None:
            return None
        import webview

        result = self._window.create_file_dialog(webview.FileDialog.FOLDER)
        if not result:
            return None
        return str(result[0] if isinstance(result, list | tuple) else result)
