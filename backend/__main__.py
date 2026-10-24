"""Desktop entry point: start the backend and open the UI in a native window (pywebview)."""

from __future__ import annotations

import argparse
import logging
import socket
import threading
import time

import uvicorn

from backend import APP_NAME
from backend.app import create_app
from backend.desktop import DesktopApi, want_frameless

log = logging.getLogger(APP_NAME)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main() -> None:
    parser = argparse.ArgumentParser(prog=APP_NAME)
    parser.add_argument("--port", type=int, default=0, help="backend port (default: any free)")
    parser.add_argument(
        "--no-window", action="store_true", help="run the backend only; open it in a browser"
    )
    parser.add_argument(
        "--ui-url", help="load the UI from this URL instead, e.g. the Vite dev server"
    )
    frame = parser.add_mutually_exclusive_group()
    frame.add_argument(
        "--frameless", dest="frameless", action="store_true", default=None, help="custom title bar"
    )
    frame.add_argument(
        "--native-frame", dest="frameless", action="store_false", help="use the OS window frame"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    port = args.port or free_port()
    server = uvicorn.Server(
        uvicorn.Config(create_app(), host="127.0.0.1", port=port, log_level="info")
    )

    if args.no_window:
        print(f"Backend running at http://127.0.0.1:{port}/ (Ctrl+C to stop)", flush=True)
        server.run()
        return

    thread = threading.Thread(target=server.run, name="backend", daemon=True)
    thread.start()
    deadline = time.monotonic() + 15
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise SystemExit("Backend failed to start")
        time.sleep(0.05)

    import webview  # imported late: only the desktop window needs it

    frameless = want_frameless(args.frameless)
    api = DesktopApi(frameless)
    # Only the bare title-bar surface drags the window, so its buttons stay clickable.
    webview.settings["DRAG_REGION_DIRECT_TARGET_ONLY"] = True
    url = args.ui_url or f"http://127.0.0.1:{port}/"
    window = webview.create_window(
        "Pipeline",
        url,
        js_api=api,
        width=1380,
        height=960,
        min_size=(760, 600),
        frameless=frameless,
        easy_drag=False,
        background_color="#F4F4F2",
    )
    api._attach(window)
    webview.start()

    server.should_exit = True
    thread.join(timeout=5)


if __name__ == "__main__":
    main()
