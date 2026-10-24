"""HTTP routes for skin/backdrop settings, uploads and linked folders."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.backdrops import MAX_UPLOAD_BYTES, BackdropError, Backdrops

PAGE_LIMIT_MAX = 200


class FolderBody(BaseModel):
    path: str


def _http(exc: BackdropError) -> HTTPException:
    return HTTPException(exc.status, str(exc))


def backdrop_router(backdrops: Backdrops) -> APIRouter:
    router = APIRouter(prefix="/api")

    # --- appearance ----------------------------------------------------

    @router.get("/appearance")
    def get_appearance() -> dict[str, Any]:
        return backdrops.appearance()

    @router.put("/appearance")
    def put_appearance(changes: dict[str, Any]) -> dict[str, Any]:
        try:
            return backdrops.update_appearance(changes)
        except BackdropError as exc:
            raise _http(exc) from None

    # --- uploads ---------------------------------------------------------

    @router.get("/backdrops/uploads")
    def list_uploads() -> dict[str, Any]:
        return {"items": backdrops.uploads()}

    @router.post("/backdrops/uploads", status_code=201)
    async def add_upload(request: Request, name: str = Query(..., min_length=1)) -> dict[str, str]:
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "images must be 50 MB or smaller")
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "images must be 50 MB or smaller")
            chunks.append(chunk)
        try:
            return backdrops.add_upload(b"".join(chunks), name)
        except BackdropError as exc:
            raise _http(exc) from None

    @router.delete("/backdrops/uploads/{upload_id}", status_code=204)
    def remove_upload(upload_id: str) -> Response:
        try:
            backdrops.remove_upload(upload_id)
        except BackdropError as exc:
            raise _http(exc) from None
        return Response(status_code=204)

    @router.get("/backdrops/uploads/{upload_id}/image")
    def upload_image(upload_id: str) -> FileResponse:
        try:
            return FileResponse(backdrops.upload_path(upload_id))
        except BackdropError as exc:
            raise _http(exc) from None

    @router.get("/backdrops/uploads/{upload_id}/thumb")
    def upload_thumb(upload_id: str) -> FileResponse:
        try:
            return FileResponse(
                backdrops.thumbnail(backdrops.upload_path(upload_id)), media_type="image/jpeg"
            )
        except BackdropError as exc:
            raise _http(exc) from None

    # --- linked folders --------------------------------------------------

    @router.get("/backdrops/folders")
    def list_folders() -> dict[str, Any]:
        return {"items": backdrops.folders()}

    @router.post("/backdrops/folders", status_code=201)
    def add_folder(body: FolderBody) -> dict[str, Any]:
        try:
            return backdrops.add_folder(body.path)
        except BackdropError as exc:
            raise _http(exc) from None

    @router.delete("/backdrops/folders/{folder_id}", status_code=204)
    def remove_folder(folder_id: str) -> Response:
        try:
            backdrops.remove_folder(folder_id)
        except BackdropError as exc:
            raise _http(exc) from None
        return Response(status_code=204)

    @router.get("/backdrops/folders/{folder_id}/images")
    def folder_images(
        folder_id: str,
        offset: int = Query(0, ge=0),
        limit: int = Query(60, ge=1, le=PAGE_LIMIT_MAX),
    ) -> dict[str, Any]:
        try:
            return backdrops.folder_images(folder_id, offset, limit)
        except BackdropError as exc:
            raise _http(exc) from None

    @router.get("/backdrops/folders/{folder_id}/image")
    def folder_image(folder_id: str, path: str) -> FileResponse:
        try:
            return FileResponse(backdrops.folder_image_path(folder_id, path))
        except BackdropError as exc:
            raise _http(exc) from None

    @router.get("/backdrops/folders/{folder_id}/thumb")
    def folder_thumb(folder_id: str, path: str) -> FileResponse:
        try:
            source = backdrops.folder_image_path(folder_id, path)
            return FileResponse(backdrops.thumbnail(source), media_type="image/jpeg")
        except BackdropError as exc:
            raise _http(exc) from None

    return router
