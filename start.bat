@echo off
rem Dev launcher for Windows: installs dependencies, builds the UI and opens the app.
rem Extra arguments are passed to the app, e.g. "start.bat --no-window".
setlocal
cd /d "%~dp0"

where uv >nul 2>nul || (echo uv is not installed. See "Development setup" in README.md. & exit /b 1)
where npm >nul 2>nul || (echo Node.js is not installed. See "Development setup" in README.md. & exit /b 1)

uv sync || exit /b 1
call npm --prefix ui install --no-fund --no-audit || exit /b 1
call npm --prefix ui run build || exit /b 1
uv run python -m backend %*
