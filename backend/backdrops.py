"""Skin and backdrop settings, uploaded images and linked folders (DESIGN.md §10, SPEC §16).

- Uploads are copied into the app's user-data folder.
- Linked folders are only remembered by path; their files are never copied, moved or deleted.
- Thumbnails are made on first request and cached, so folders with thousands of images stay fast.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

from PIL import Image, ImageOps, UnidentifiedImageError
from platformdirs import user_cache_path, user_data_path

from backend import APP_NAME
from backend.settings import SettingsStore

log = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
THUMB_SIZE = 400
SCAN_TTL_SECONDS = 30.0

SKINS = ("ivory", "graphite")
BUILTIN_BACKDROPS = ("white", "black", "system")
BACKDROP_KINDS = (*BUILTIN_BACKDROPS, "upload", "folder")
FITS = ("fill", "fit", "center")
MAX_DARKEN = 80

DEFAULT_APPEARANCE: dict[str, Any] = {
    "skin": "ivory",
    "backdrop": {"kind": "white", "id": None},
    "fit": "fill",
    "darken": 0,
    "blur": False,
}


class BackdropError(ValueError):
    """Invalid request; ``status`` is the HTTP status to answer with."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


def default_uploads_dir() -> Path:
    return user_data_path(APP_NAME, appauthor=False) / "backdrops"


def default_thumbs_dir() -> Path:
    return user_cache_path(APP_NAME, appauthor=False) / "thumbs"


def _folder_id(path: Path) -> str:
    return hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:12]


@dataclass
class _Scan:
    images: list[str]  # paths relative to the folder, POSIX style, sorted
    at: float


class Backdrops:
    def __init__(
        self,
        store: SettingsStore,
        uploads_dir: Path | None = None,
        thumbs_dir: Path | None = None,
    ) -> None:
        self.store = store
        self.uploads_dir = uploads_dir or default_uploads_dir()
        self.thumbs_dir = thumbs_dir or default_thumbs_dir()
        self._scans: dict[str, _Scan] = {}
        self._lock = threading.Lock()

    # --- appearance ------------------------------------------------------

    def appearance(self) -> dict[str, Any]:
        saved = self.store.section("appearance") or {}
        result = {
            **DEFAULT_APPEARANCE,
            **{k: v for k, v in saved.items() if k in DEFAULT_APPEARANCE},
        }
        try:
            self._validate(result)
            image_url = self._image_url(result["backdrop"])
        except BackdropError:
            # A saved image that has since been removed falls back to the default backdrop.
            result["backdrop"] = dict(DEFAULT_APPEARANCE["backdrop"])
            image_url = None
        return {**result, "image_url": image_url}

    def update_appearance(self, changes: dict[str, Any]) -> dict[str, Any]:
        unknown = set(changes) - set(DEFAULT_APPEARANCE)
        if unknown:
            raise BackdropError(f"unknown setting(s): {', '.join(sorted(unknown))}", 422)
        current = {k: v for k, v in self.appearance().items() if k != "image_url"}
        merged = {**current, **changes}
        self._validate(merged)
        self.store.set_section("appearance", merged)
        return self.appearance()

    def _validate(self, value: dict[str, Any]) -> None:
        if value["skin"] not in SKINS:
            raise BackdropError(f"skin must be one of {', '.join(SKINS)}", 422)
        if value["fit"] not in FITS:
            raise BackdropError(f"fit must be one of {', '.join(FITS)}", 422)
        darken = value["darken"]
        if isinstance(darken, bool) or not isinstance(darken, int) or not 0 <= darken <= MAX_DARKEN:
            raise BackdropError(f"darken must be a whole number from 0 to {MAX_DARKEN}", 422)
        if not isinstance(value["blur"], bool):
            raise BackdropError("blur must be true or false", 422)
        backdrop = value["backdrop"]
        if not isinstance(backdrop, dict) or backdrop.get("kind") not in BACKDROP_KINDS:
            raise BackdropError(f"backdrop kind must be one of {', '.join(BACKDROP_KINDS)}", 422)
        if backdrop["kind"] in BUILTIN_BACKDROPS:
            backdrop["id"] = None
            return
        try:
            self._image_url(backdrop)
        except BackdropError as exc:
            raise BackdropError(f"backdrop image not found: {exc}", 422) from exc

    def _image_url(self, backdrop: dict[str, Any]) -> str | None:
        kind, image_id = backdrop.get("kind"), backdrop.get("id")
        if kind in BUILTIN_BACKDROPS:
            return None
        if not isinstance(image_id, str) or not image_id:
            raise BackdropError(f"a {kind} backdrop needs an image id", 422)
        if kind == "upload":
            self.upload_path(image_id)
            return f"/api/backdrops/uploads/{quote(image_id)}/image"
        folder_id, _, rel = image_id.partition("/")
        self.folder_image_path(folder_id, rel)
        return f"/api/backdrops/folders/{quote(folder_id)}/image?path={quote(rel)}"

    def _reset_if_using(self, predicate) -> None:  # type: ignore[no-untyped-def]
        saved = self.store.section("appearance") or {}
        backdrop = saved.get("backdrop") or {}
        if predicate(backdrop.get("kind"), backdrop.get("id") or ""):
            saved["backdrop"] = dict(DEFAULT_APPEARANCE["backdrop"])
            self.store.set_section("appearance", saved)

    # --- uploads -----------------------------------------------------------

    def uploads(self) -> list[dict[str, str]]:
        if not self.uploads_dir.is_dir():
            return []
        files = sorted(
            (
                p
                for p in self.uploads_dir.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            ),
            key=lambda p: p.stat().st_mtime,
        )
        return [self._upload_item(p.name) for p in files]

    def add_upload(self, data: bytes, filename: str) -> dict[str, str]:
        if not data:
            raise BackdropError("the file is empty")
        if len(data) > MAX_UPLOAD_BYTES:
            raise BackdropError("images must be 50 MB or smaller", 413)
        suffix = Path(filename).suffix.lower()
        if suffix not in IMAGE_EXTENSIONS:
            raise BackdropError("use a JPEG, PNG, WebP, GIF or BMP image", 415)
        self._check_image_bytes(data)
        stem = re.sub(r"[^a-z0-9]+", "-", Path(filename).stem.lower()).strip("-")[:40] or "image"
        name = (
            f"{stem}-{hashlib.sha1(data).hexdigest()[:8]}{'.jpg' if suffix == '.jpeg' else suffix}"
        )
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        target = self.uploads_dir / name
        if not target.exists():
            tmp = target.with_suffix(target.suffix + ".part")
            tmp.write_bytes(data)
            os.replace(tmp, target)
        return self._upload_item(name)

    def remove_upload(self, upload_id: str) -> None:
        path = self.upload_path(upload_id)
        path.unlink()
        self._reset_if_using(lambda kind, image_id: kind == "upload" and image_id == upload_id)

    def upload_path(self, upload_id: str) -> Path:
        if not upload_id or upload_id != Path(upload_id).name or upload_id.startswith("."):
            raise BackdropError("unknown image", 404)
        path = self.uploads_dir / upload_id
        if path.suffix.lower() not in IMAGE_EXTENSIONS or not path.is_file():
            raise BackdropError("unknown image", 404)
        return path

    def _upload_item(self, name: str) -> dict[str, str]:
        base = f"/api/backdrops/uploads/{quote(name)}"
        return {
            "id": name,
            "name": name,
            "thumb_url": f"{base}/thumb",
            "image_url": f"{base}/image",
        }

    @staticmethod
    def _check_image_bytes(data: bytes) -> None:
        import io

        try:
            with Image.open(io.BytesIO(data)) as img:
                img.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise BackdropError("that file is not an image this app can read", 415) from exc

    # --- linked folders ----------------------------------------------------

    def _folders(self) -> list[dict[str, str]]:
        return list(self.store.section("backdrop_folders") or [])

    def folders(self) -> list[dict[str, Any]]:
        result = []
        for entry in self._folders():
            path = Path(entry["path"])
            available = path.is_dir()
            result.append(
                {
                    "id": entry["id"],
                    "path": entry["path"],
                    "name": path.name or entry["path"],
                    "available": available,
                    "image_count": len(self._scan(entry["id"], path)) if available else 0,
                }
            )
        return result

    def add_folder(self, raw_path: str) -> dict[str, Any]:
        path = Path(raw_path).expanduser()
        if not raw_path.strip() or not path.is_dir():
            raise BackdropError("that folder does not exist")
        path = path.resolve()
        folder_id = _folder_id(path)
        entries = self._folders()
        if not any(e["id"] == folder_id for e in entries):
            entries.append({"id": folder_id, "path": str(path)})
            self.store.set_section("backdrop_folders", entries)
        return next(f for f in self.folders() if f["id"] == folder_id)

    def remove_folder(self, folder_id: str) -> None:
        """Forget a linked folder. The folder and its files are left exactly as they are."""
        entries = self._folders()
        remaining = [e for e in entries if e["id"] != folder_id]
        if len(remaining) == len(entries):
            raise BackdropError("unknown folder", 404)
        self.store.set_section("backdrop_folders", remaining)
        with self._lock:
            self._scans.pop(folder_id, None)
        self._reset_if_using(
            lambda kind, image_id: kind == "folder" and image_id.startswith(folder_id + "/")
        )

    def folder_images(self, folder_id: str, offset: int, limit: int) -> dict[str, Any]:
        root = self._folder_root(folder_id)
        images = self._scan(folder_id, root)
        page = images[offset : offset + limit]
        return {
            "items": [self._folder_item(folder_id, rel) for rel in page],
            "total": len(images),
            "offset": offset,
        }

    def folder_image_path(self, folder_id: str, rel: str) -> Path:
        root = self._folder_root(folder_id)
        candidate = (root / rel).resolve()
        if (
            not rel
            or not candidate.is_relative_to(root)
            or candidate.suffix.lower() not in IMAGE_EXTENSIONS
            or not candidate.is_file()
        ):
            raise BackdropError("unknown image", 404)
        return candidate

    def _folder_root(self, folder_id: str) -> Path:
        entry = next((e for e in self._folders() if e["id"] == folder_id), None)
        if entry is None:
            raise BackdropError("unknown folder", 404)
        root = Path(entry["path"]).resolve()
        if not root.is_dir():
            raise BackdropError("that folder is not available right now", 404)
        return root

    def _folder_item(self, folder_id: str, rel: str) -> dict[str, str]:
        base = f"/api/backdrops/folders/{quote(folder_id)}"
        return {
            "id": f"{folder_id}/{rel}",
            "name": Path(rel).name,
            "thumb_url": f"{base}/thumb?path={quote(rel)}",
            "image_url": f"{base}/image?path={quote(rel)}",
        }

    def _scan(self, folder_id: str, root: Path) -> list[str]:
        """Image paths under ``root``, cached briefly so paging through big folders stays fast."""
        with self._lock:
            cached = self._scans.get(folder_id)
            if cached and time.monotonic() - cached.at < SCAN_TTL_SECONDS:
                return cached.images
        images: list[str] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
            base = Path(dirpath)
            for name in filenames:
                if not name.startswith(".") and Path(name).suffix.lower() in IMAGE_EXTENSIONS:
                    images.append((base / name).relative_to(root).as_posix())
        images.sort(key=str.lower)
        with self._lock:
            self._scans[folder_id] = _Scan(images, time.monotonic())
        return images

    # --- thumbnails --------------------------------------------------------

    def thumbnail(self, source: Path) -> Path:
        """Cached JPEG thumbnail (max 400px), created on first request."""
        stat = source.stat()
        key = hashlib.sha1(f"{source}|{stat.st_mtime_ns}|{stat.st_size}".encode()).hexdigest()
        target = self.thumbs_dir / f"{key}.jpg"
        if target.is_file():
            return target
        self.thumbs_dir.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(source) as img:
                img.draft(
                    "RGB", (THUMB_SIZE * 2, THUMB_SIZE * 2)
                )  # fast JPEG decode at reduced size
                img = ImageOps.exif_transpose(img)
                img.thumbnail((THUMB_SIZE, THUMB_SIZE))
                tmp = target.with_suffix(".part")
                img.convert("RGB").save(tmp, "JPEG", quality=82, optimize=True)
            os.replace(tmp, target)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise BackdropError("could not read that image", 415) from exc
        return target
