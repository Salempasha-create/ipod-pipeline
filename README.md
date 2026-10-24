# ipod-pipeline

A free, open-source desktop app that **finds music, downloads it at the best available quality, tags it cleanly, converts it, and builds an iPod-ready library** — with no command line. It covers the whole path from "I want this song" to "it's ready for my iPod," treats single songs and albums equally, and hands syncing off to [iOpenPod](https://github.com/TheRealSavi/iOpenPod).

**Status:** Early development — no release yet.

- [Project specification](SPEC.md) — what the app does
- [Contributing guide](CONTRIBUTING.md) — how to propose changes
- [Decision log](docs/DECISIONS.md)

> **Note:** This app is a tool. You are responsible for what you download and for complying with the laws and terms of service that apply to you.

## Development setup

You need:

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** for the Python environment
- **Node.js LTS** (includes npm) for the UI

On Windows you can install them with winget:

```powershell
winget install Python.Python.3.12 astral-sh.uv OpenJS.NodeJS.LTS
```

On macOS use Homebrew (`brew install python@3.12 uv node`); on Linux use your package manager, or the installers from each project's site.

**Linux only:** the native window needs a GTK or Qt web view that pywebview can use; see [pywebview's Linux notes](https://pywebview.flowrl.com/guide/installation.html#linux). Until that's set up, run with `--no-window` and open the printed address in a browser. (The Linux window hasn't been tested yet.)

## Running the app

From the repository folder:

| OS | Command |
|---|---|
| Windows | `start.bat` |
| macOS / Linux | `./start.sh` |

The launcher installs dependencies, builds the UI and opens the app in a native window. Add `--no-window` to run only the backend and use it in your browser instead.

### Working on the UI with hot reload

Run the backend on a fixed port in one terminal, and the Vite dev server in another:

```sh
uv run python -m backend --port 8765 --no-window
npm --prefix ui run dev
```

Then open the address Vite prints (usually http://localhost:5173). Requests to `/api` are forwarded to the backend.

### Tests and linting

```sh
uv run pytest
uv run ruff format .
uv run ruff check .
```

CI runs the same checks, plus a UI build, on Windows, macOS and Linux for every pull request.

## Project layout

```
backend/                 Python backend (FastAPI)
  __main__.py            desktop entry point: starts the backend, opens the pywebview window
  app.py                 HTTP API used by the UI
  jobs.py                background jobs for source plugins
  settings.py            settings (platformdirs) and secrets (keyring)
  plugins/
    base.py              Source, Processor and Target base classes and SettingField
    discovery.py         auto-discovery of plugins
    sources/<plugin>/    one folder per source plugin
    processors/<plugin>/ one folder per processor plugin
    targets/<plugin>/    one folder per target plugin
ui/                      React + Vite UI
tests/                   pytest tests
```

### Writing a plugin

Create a folder under `backend/plugins/sources/`, `processors/` or `targets/` with an `__init__.py` that defines a subclass of `Source`, `Processor` or `Target`. It is picked up automatically on the next start. Copy one of the `dummy` plugins to get started.

Each plugin declares an `id`, `name`, `description` and a `settings_schema` of `SettingField`s. The UI builds the plugin's settings form from that schema. Fields marked `secret=True` are stored in the OS credential store, never in the settings file. Plugins are off until the user turns them on.

Settings are saved in your OS's config folder (e.g. `%LOCALAPPDATA%\ipod-pipeline\settings.json` on Windows, `~/Library/Application Support/ipod-pipeline/` on macOS, `~/.config/ipod-pipeline/` on Linux).

## License

[MIT](LICENSE)
