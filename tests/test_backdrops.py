from __future__ import annotations

import io
from pathlib import Path
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import create_app
from backend.backdrops import DEFAULT_APPEARANCE, Backdrops
from backend.jobs import JobManager
from backend.settings import SettingsStore


def png_bytes(size: tuple[int, int] = (1200, 800), color: str = "orange") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture
def dirs(tmp_path: Path) -> dict[str, Path]:
    return {
        "settings": tmp_path / "config" / "settings.json",
        "uploads": tmp_path / "data" / "backdrops",
        "thumbs": tmp_path / "cache" / "thumbs",
    }


def make_client(tmp_path: Path, dirs: dict[str, Path]) -> TestClient:
    store = SettingsStore(dirs["settings"])
    app = create_app(
        store=store,
        jobs=JobManager(work_root=tmp_path / "jobs"),
        ui_dir=tmp_path / "no-ui",
        allowed_hosts=["testserver"],
        backdrops=Backdrops(store, uploads_dir=dirs["uploads"], thumbs_dir=dirs["thumbs"]),
    )
    return TestClient(app)


@pytest.fixture
def client(tmp_path: Path, dirs, fake_keyring):
    with make_client(tmp_path, dirs) as c:
        yield c


def upload(client: TestClient, name: str = "Sunset Photo.PNG", data: bytes | None = None):
    return client.post(
        f"/api/backdrops/uploads?name={quote(name)}",
        content=data if data is not None else png_bytes(),
        headers={"Content-Type": "image/png"},
    )


@pytest.fixture
def photo_folder(tmp_path: Path) -> Path:
    folder = tmp_path / "My Photos"
    (folder / "trips" / "2024").mkdir(parents=True)
    Image.new("RGB", (900, 600), "blue").save(folder / "a.jpg")
    Image.new("RGB", (600, 900), "green").save(folder / "trips" / "b.png")
    Image.new("RGB", (640, 480), "red").save(folder / "trips" / "2024" / "c.webp")
    (folder / "notes.txt").write_text("not an image", encoding="utf-8")
    (folder / ".hidden.jpg").write_bytes(b"skip me")
    return folder


# ---- skin and backdrop settings ------------------------------------------


def test_appearance_defaults(client: TestClient):
    assert client.get("/api/appearance").json() == {**DEFAULT_APPEARANCE, "image_url": None}


def test_skin_and_backdrop_settings_persist_across_restarts(tmp_path, dirs, fake_keyring):
    with make_client(tmp_path, dirs) as first:
        res = first.put(
            "/api/appearance",
            json={
                "skin": "graphite",
                "backdrop": {"kind": "black"},
                "fit": "center",
                "darken": 40,
                "blur": True,
            },
        )
        assert res.status_code == 200

    with make_client(tmp_path, dirs) as second:
        assert second.get("/api/appearance").json() == {
            "skin": "graphite",
            "backdrop": {"kind": "black", "id": None},
            "fit": "center",
            "darken": 40,
            "blur": True,
            "image_url": None,
        }


def test_partial_update_keeps_other_settings(client: TestClient):
    client.put("/api/appearance", json={"skin": "graphite", "darken": 25})
    body = client.put("/api/appearance", json={"fit": "fit"}).json()

    assert (body["skin"], body["darken"], body["fit"]) == ("graphite", 25, "fit")


@pytest.mark.parametrize(
    "changes",
    [
        {"skin": "pink"},
        {"fit": "tile"},
        {"darken": 81},
        {"darken": -1},
        {"darken": 2.5},
        {"blur": "yes"},
        {"backdrop": {"kind": "poster"}},
        {"backdrop": {"kind": "upload"}},
        {"backdrop": {"kind": "upload", "id": "missing.png"}},
        {"backdrop": {"kind": "folder", "id": "nope/a.jpg"}},
        {"colour": "red"},
    ],
)
def test_invalid_appearance_is_rejected(client: TestClient, changes):
    assert client.put("/api/appearance", json=changes).status_code == 422
    assert client.get("/api/appearance").json()["skin"] == "ivory"


# ---- uploads -------------------------------------------------------------


def test_upload_is_copied_into_user_data_and_listed(client: TestClient, dirs):
    res = upload(client)

    assert res.status_code == 201
    item = res.json()
    assert item["id"].startswith("sunset-photo-") and item["id"].endswith(".png")
    assert (dirs["uploads"] / item["id"]).read_bytes() == png_bytes()
    assert client.get("/api/backdrops/uploads").json()["items"] == [item]
    assert client.get(item["image_url"]).content == png_bytes()


def test_upload_can_be_chosen_as_backdrop(client: TestClient):
    item = upload(client).json()
    body = client.put(
        "/api/appearance", json={"backdrop": {"kind": "upload", "id": item["id"]}}
    ).json()

    assert body["image_url"] == item["image_url"]


def test_upload_thumbnail_is_made_on_request_and_cached(client: TestClient, dirs):
    item = upload(client).json()
    assert not dirs["thumbs"].exists()

    res = client.get(item["thumb_url"])

    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(res.content)) as thumb:
        assert max(thumb.size) == 400
    assert len(list(dirs["thumbs"].iterdir())) == 1
    client.get(item["thumb_url"])
    assert len(list(dirs["thumbs"].iterdir())) == 1


def test_non_images_are_refused(client: TestClient, dirs):
    assert upload(client, "fake.png", b"definitely not a png").status_code == 415
    assert upload(client, "script.exe", png_bytes()).status_code == 415
    assert upload(client, "empty.png", b"").status_code == 400
    assert not dirs["uploads"].exists() or list(dirs["uploads"].iterdir()) == []


def test_removing_the_current_upload_resets_the_backdrop(client: TestClient, dirs):
    item = upload(client).json()
    client.put(
        "/api/appearance", json={"backdrop": {"kind": "upload", "id": item["id"]}, "darken": 30}
    )

    assert client.delete(f"/api/backdrops/uploads/{item['id']}").status_code == 204

    assert not (dirs["uploads"] / item["id"]).exists()
    body = client.get("/api/appearance").json()
    assert body["backdrop"] == {"kind": "white", "id": None}
    assert body["darken"] == 30


@pytest.mark.parametrize("bad_id", ["..%2Fsettings.json", "%2E%2E", "nope.png", ".hidden.png"])
def test_upload_ids_cannot_escape_the_uploads_folder(client: TestClient, bad_id):
    upload(client)
    assert client.get(f"/api/backdrops/uploads/{bad_id}/image").status_code == 404
    assert client.delete(f"/api/backdrops/uploads/{bad_id}").status_code in (404, 405)


# ---- linked folders ------------------------------------------------------


def test_folder_is_linked_in_place_not_copied(client: TestClient, dirs, photo_folder: Path):
    res = client.post("/api/backdrops/folders", json={"path": str(photo_folder)})

    assert res.status_code == 201
    folder = res.json()
    assert folder["path"] == str(photo_folder.resolve())
    assert folder["available"] is True
    assert folder["image_count"] == 3
    assert not dirs["uploads"].exists()
    assert client.get("/api/backdrops/folders").json()["items"] == [folder]


def test_adding_the_same_folder_twice_keeps_one_link(client: TestClient, photo_folder: Path):
    client.post("/api/backdrops/folders", json={"path": str(photo_folder)})
    client.post("/api/backdrops/folders", json={"path": str(photo_folder)})

    assert len(client.get("/api/backdrops/folders").json()["items"]) == 1


def test_missing_folder_is_refused(client: TestClient, tmp_path: Path):
    assert (
        client.post("/api/backdrops/folders", json={"path": str(tmp_path / "nope")}).status_code
        == 400
    )


def test_folder_images_are_paged_and_thumbnails_are_lazy(
    client: TestClient, dirs, photo_folder: Path
):
    folder_id = client.post("/api/backdrops/folders", json={"path": str(photo_folder)}).json()["id"]

    first = client.get(f"/api/backdrops/folders/{folder_id}/images?offset=0&limit=2").json()
    second = client.get(f"/api/backdrops/folders/{folder_id}/images?offset=2&limit=2").json()

    assert first["total"] == second["total"] == 3
    names = [i["name"] for i in first["items"] + second["items"]]
    assert names == ["a.jpg", "c.webp", "b.png"]  # sorted by relative path
    assert not dirs["thumbs"].exists()  # listing alone makes no thumbnails

    res = client.get(first["items"][0]["thumb_url"])
    assert res.status_code == 200
    assert len(list(dirs["thumbs"].iterdir())) == 1


def test_folder_image_can_be_chosen_as_backdrop(client: TestClient, photo_folder: Path):
    folder_id = client.post("/api/backdrops/folders", json={"path": str(photo_folder)}).json()["id"]
    image = client.get(f"/api/backdrops/folders/{folder_id}/images").json()["items"][1]

    body = client.put(
        "/api/appearance", json={"backdrop": {"kind": "folder", "id": image["id"]}}
    ).json()

    assert body["image_url"] == image["image_url"]
    assert client.get(body["image_url"]).status_code == 200


@pytest.mark.parametrize(
    "bad", ["../outside.jpg", "notes.txt", "missing.jpg", "", "trips/../../outside.jpg"]
)
def test_folder_paths_cannot_escape_the_folder(client: TestClient, photo_folder: Path, bad):
    Image.new("RGB", (10, 10)).save(photo_folder.parent / "outside.jpg")
    folder_id = client.post("/api/backdrops/folders", json={"path": str(photo_folder)}).json()["id"]

    res = client.get(f"/api/backdrops/folders/{folder_id}/image?path={quote(bad)}")

    assert res.status_code in (404, 422)


def test_removing_a_folder_never_touches_the_originals(client: TestClient, photo_folder: Path):
    before = sorted(p.relative_to(photo_folder) for p in photo_folder.rglob("*"))
    folder_id = client.post("/api/backdrops/folders", json={"path": str(photo_folder)}).json()["id"]
    image = client.get(f"/api/backdrops/folders/{folder_id}/images").json()["items"][0]
    client.get(image["thumb_url"])
    client.put("/api/appearance", json={"backdrop": {"kind": "folder", "id": image["id"]}})

    assert client.delete(f"/api/backdrops/folders/{folder_id}").status_code == 204

    assert sorted(p.relative_to(photo_folder) for p in photo_folder.rglob("*")) == before
    assert client.get("/api/backdrops/folders").json()["items"] == []
    assert client.get("/api/appearance").json()["backdrop"] == {"kind": "white", "id": None}


def test_unavailable_folder_is_reported_not_fatal(client: TestClient, tmp_path: Path):
    folder = tmp_path / "usb-stick"
    folder.mkdir()
    Image.new("RGB", (10, 10)).save(folder / "x.jpg")
    folder_id = client.post("/api/backdrops/folders", json={"path": str(folder)}).json()["id"]
    (folder / "x.jpg").unlink()
    folder.rmdir()

    items = client.get("/api/backdrops/folders").json()["items"]
    assert items[0]["available"] is False
    assert client.get(f"/api/backdrops/folders/{folder_id}/images").status_code == 404
