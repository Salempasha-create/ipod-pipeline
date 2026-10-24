"""FastAPI app: plugin listing, enable/disable, settings and source jobs."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.jobs import JobManager
from backend.plugins.base import Plugin, PluginKind, Source
from backend.plugins.discovery import PluginRegistry, discover
from backend.settings import SettingsError, SettingsStore

LOCAL_HOSTS = ["127.0.0.1", "localhost"]
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

UI_NOT_BUILT = """<!doctype html><meta charset="utf-8"><title>ipod-pipeline</title>
<body style="font-family:system-ui;padding:2rem">
<h1>UI not built</h1>
<p>Run <code>npm --prefix ui install</code> and <code>npm --prefix ui run build</code>,
or use <code>start.bat</code> / <code>start.sh</code>, which do it for you.</p>"""


def default_ui_dir() -> Path:
    override = os.environ.get("IPOD_PIPELINE_UI_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parent.parent / "ui" / "dist"


class EnabledBody(BaseModel):
    enabled: bool


class SettingsBody(BaseModel):
    values: dict[str, Any]


class JobBody(BaseModel):
    request: dict[str, Any] = {}


def create_app(
    registry: PluginRegistry | None = None,
    store: SettingsStore | None = None,
    jobs: JobManager | None = None,
    ui_dir: Path | None = None,
    allowed_hosts: list[str] | None = None,
) -> FastAPI:
    registry = registry if registry is not None else discover()
    store = store if store is not None else SettingsStore()
    hosts = allowed_hosts or LOCAL_HOSTS
    state: dict[str, JobManager] = {}

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        state["jobs"] = jobs if jobs is not None else JobManager()
        yield
        await state["jobs"].shutdown()

    app = FastAPI(title="ipod-pipeline", lifespan=lifespan)
    # The API only serves the local UI: reject other Host headers (DNS rebinding) and
    # state-changing requests coming from other web pages.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)

    @app.middleware("http")
    async def same_origin_only(request: Request, call_next):  # type: ignore[no-untyped-def]
        origin = request.headers.get("origin")
        if request.method not in SAFE_METHODS and origin and urlsplit(origin).hostname not in hosts:
            return JSONResponse({"detail": "cross-origin request refused"}, status_code=403)
        return await call_next(request)

    def plugin_or_404(kind: str, plugin_id: str) -> type[Plugin]:
        try:
            plugin_kind = PluginKind(kind)
        except ValueError:
            raise HTTPException(404, f"unknown plugin kind {kind!r}") from None
        plugin = registry.get(plugin_kind, plugin_id)
        if plugin is None:
            raise HTTPException(404, f"unknown plugin {kind}/{plugin_id}")
        return plugin

    def describe(plugin: type[Plugin]) -> dict[str, Any]:
        info = plugin.describe()
        info["enabled"] = store.is_enabled(plugin)
        info["values"] = store.values(plugin)
        info["secrets_set"] = store.secrets_set(plugin)
        info["can_test"] = issubclass(plugin, Source) and plugin.test_request is not None
        return info

    @app.get("/api/plugins")
    def list_plugins() -> dict[str, Any]:
        return {
            "plugins": [describe(p) for p in registry.all()],
            "errors": [
                {"kind": e.kind.value, "module": e.module, "message": e.message}
                for e in registry.errors
            ],
        }

    @app.put("/api/plugins/{kind}/{plugin_id}/enabled")
    def set_enabled(kind: str, plugin_id: str, body: EnabledBody) -> dict[str, Any]:
        plugin = plugin_or_404(kind, plugin_id)
        store.set_enabled(plugin, body.enabled)
        return describe(plugin)

    @app.put("/api/plugins/{kind}/{plugin_id}/settings")
    def update_settings(kind: str, plugin_id: str, body: SettingsBody) -> dict[str, Any]:
        plugin = plugin_or_404(kind, plugin_id)
        try:
            store.update(plugin, body.values)
        except SettingsError as exc:
            raise HTTPException(422, str(exc)) from None
        return describe(plugin)

    @app.post("/api/sources/{plugin_id}/jobs", status_code=201)
    async def start_job(plugin_id: str, body: JobBody | None = None) -> dict[str, Any]:
        plugin = plugin_or_404(PluginKind.SOURCE.value, plugin_id)
        assert issubclass(plugin, Source)
        if not store.is_enabled(plugin):
            raise HTTPException(409, f"{plugin.name} is disabled; enable it first")
        request = body.request if body and body.request else (plugin.test_request or {})
        job = state["jobs"].start(plugin(store.resolved(plugin)), request)
        return job.to_dict()

    @app.get("/api/jobs")
    def list_jobs() -> dict[str, Any]:
        return {"jobs": [j.to_dict() for j in state["jobs"].all()]}

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, Any]:
        job = state["jobs"].get(job_id)
        if job is None:
            raise HTTPException(404, "unknown job")
        return job.to_dict()

    @app.post("/api/jobs/{job_id}/cancel")
    def cancel_job(job_id: str) -> dict[str, Any]:
        manager = state["jobs"]
        job = manager.get(job_id)
        if job is None:
            raise HTTPException(404, "unknown job")
        if not manager.cancel(job_id):
            raise HTTPException(409, f"job is already {job.status.value}")
        return job.to_dict()

    ui = ui_dir or default_ui_dir()
    if (ui / "index.html").is_file():
        app.mount("/", StaticFiles(directory=ui, html=True), name="ui")
    else:

        @app.get("/", response_class=HTMLResponse, include_in_schema=False)
        def ui_missing() -> str:
            return UI_NOT_BUILT

    return app
