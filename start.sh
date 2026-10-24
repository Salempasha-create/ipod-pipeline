#!/usr/bin/env bash
# Dev launcher for macOS and Linux: installs dependencies, builds the UI and opens the app.
# Extra arguments are passed to the app, e.g. "./start.sh --no-window".
set -euo pipefail
cd "$(dirname "$0")"

command -v uv >/dev/null || { echo 'uv is not installed. See "Development setup" in README.md.'; exit 1; }
command -v npm >/dev/null || { echo 'Node.js is not installed. See "Development setup" in README.md.'; exit 1; }

uv sync
npm --prefix ui install --no-fund --no-audit
npm --prefix ui run build
exec uv run python -m backend "$@"
