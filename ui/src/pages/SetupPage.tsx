import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  api,
  type Appearance,
  type AppearanceChanges,
  type BackdropImage,
  type Fit,
  type LinkedFolder,
  type Skin,
} from "../api";
import { desktop } from "../desktop";
import { FilterChip } from "../components/FilterChip";
import type { PageProps } from "./types";

const PAGE_SIZE = 60;

interface Props extends PageProps {
  appearance: Appearance;
  onChange: (changes: AppearanceChanges) => Promise<void>;
}

function Swatch({
  label,
  selected,
  onSelect,
  preview,
  previewClass,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  preview?: string;
  previewClass?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="swatch" onClick={onSelect}>
      <span className={`swatch-preview ${previewClass ?? ""}`} aria-hidden="true">
        {preview && <img src={preview} alt="" loading="lazy" decoding="async" />}
      </span>
      <span className="swatch-name">{label}</span>
    </button>
  );
}

function FolderImages({
  folder,
  selectedId,
  onPick,
}: {
  folder: LinkedFolder;
  selectedId: string | null;
  onPick: (image: BackdropImage) => void;
}) {
  const [items, setItems] = useState<BackdropImage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const page = await api.folderImages(folder.id, offset, PAGE_SIZE);
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
      } finally {
        setLoading(false);
      }
    },
    [folder.id],
  );

  useEffect(() => {
    if (folder.available) loadMore(0);
  }, [folder.available, loadMore]);

  if (!folder.available) return <p className="screen-hint">This folder isn't available right now.</p>;
  return (
    <>
      <div className="swatch-grid" role="radiogroup" aria-label={`Images in ${folder.name}`}>
        {items.map((img) => (
          <Swatch
            key={img.id}
            label={img.name}
            preview={img.thumb_url}
            selected={selectedId === img.id}
            onSelect={() => onPick(img)}
          />
        ))}
      </div>
      {items.length < total && (
        <button type="button" className="screen-button" disabled={loading} onClick={() => loadMore(items.length)}>
          {loading ? "LOADING…" : `SHOW MORE (${total - items.length} LEFT)`}
        </button>
      )}
    </>
  );
}

export function SetupPage({ active, registerPrimary, setStatus, appearance, onChange }: Props) {
  const [uploads, setUploads] = useState<BackdropImage[]>([]);
  const [folders, setFolders] = useState<LinkedFolder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [hasPicker, setHasPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const [u, f] = await Promise.all([api.uploads(), api.folders()]);
    setUploads(u.items);
    setFolders(f.items);
  }, []);

  useEffect(() => {
    if (!active) return;
    reload().catch((err: Error) => setError(err.message));
    desktop().then((d) => setHasPicker(d !== null));
  }, [active, reload]);

  useEffect(() => {
    if (!active) return;
    registerPrimary(null);
    setStatus("SETUP · SKIN · BACKDROP");
  });

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (changes: AppearanceChanges) => run(() => onChange(changes));
  const backdrop = appearance.backdrop;
  const selectedImage = backdrop.kind === "upload" || backdrop.kind === "folder" ? backdrop.id : null;

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    run(async () => {
      const item = await api.upload(file);
      await reload();
      await onChange({ backdrop: { kind: "upload", id: item.id } });
    });
  };

  const linkFolder = (path: string) =>
    run(async () => {
      await api.addFolder(path);
      setFolderPath("");
      await reload();
    });

  const addFolder = async () => {
    const bridge = await desktop();
    if (bridge) {
      const path = await bridge.pick_folder();
      if (path) linkFolder(path);
    }
  };

  return (
    <div className="page setup" hidden={!active}>
      {error && (
        <p className="screen-error" role="alert">
          {error}
        </p>
      )}

      <section className="setup-section" aria-labelledby="setup-skin">
        <h3 id="setup-skin" className="screen-label">
          SKIN
        </h3>
        <div className="chip-row" role="radiogroup" aria-labelledby="setup-skin">
          {(["ivory", "graphite"] as Skin[]).map((skin) => (
            <FilterChip key={skin} active={appearance.skin === skin} role="radio" aria-checked={appearance.skin === skin} aria-pressed={undefined} onClick={() => choose({ skin })}>
              {skin.toUpperCase()}
            </FilterChip>
          ))}
        </div>
      </section>

      <section className="setup-section" aria-labelledby="setup-builtin">
        <h3 id="setup-builtin" className="screen-label">
          BACKDROP · BUILT-IN
        </h3>
        <div className="swatch-grid" role="radiogroup" aria-labelledby="setup-builtin">
          <Swatch label="White" previewClass="swatch-white" selected={backdrop.kind === "white"} onSelect={() => choose({ backdrop: { kind: "white", id: null } })} />
          <Swatch label="Black" previewClass="swatch-black" selected={backdrop.kind === "black"} onSelect={() => choose({ backdrop: { kind: "black", id: null } })} />
          <Swatch label="Match system" previewClass="swatch-system" selected={backdrop.kind === "system"} onSelect={() => choose({ backdrop: { kind: "system", id: null } })} />
        </div>
      </section>

      <section className="setup-section" aria-labelledby="setup-mine">
        <h3 id="setup-mine" className="screen-label">
          BACKDROP · MY IMAGES
        </h3>
        <p className="screen-hint">Images stay on this computer. Uploads are copied into the app's own folder; added folders are linked where they are and never changed.</p>
        <div className="setting-row">
          <button type="button" className="screen-button" disabled={busy} onClick={() => fileRef.current?.click()}>
            UPLOAD IMAGE
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" hidden onChange={onFile} />
          {hasPicker && (
            <button type="button" className="screen-button" disabled={busy} onClick={addFolder}>
              ADD FOLDER
            </button>
          )}
        </div>
        {!hasPicker && (
          <form
            className="setting-row"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (folderPath.trim()) linkFolder(folderPath.trim());
            }}
          >
            <label htmlFor="folder-path" className="visually-hidden">
              Folder path
            </label>
            <input id="folder-path" className="screen-input" placeholder="Folder path, e.g. C:\Users\you\Pictures" value={folderPath} onChange={(e) => setFolderPath(e.target.value)} />
            <button type="submit" className="screen-button" disabled={busy || !folderPath.trim()}>
              ADD FOLDER
            </button>
          </form>
        )}

        {uploads.length > 0 && (
          <div className="swatch-grid" role="radiogroup" aria-label="Uploaded images">
            {uploads.map((img) => (
              <div key={img.id} className="swatch-wrap">
                <Swatch label={img.name} preview={img.thumb_url} selected={selectedImage === img.id} onSelect={() => choose({ backdrop: { kind: "upload", id: img.id } })} />
                <button type="button" className="screen-button swatch-remove" aria-label={`Remove ${img.name}`} onClick={() => run(async () => { await api.removeUpload(img.id); await reload(); await onChange({}); })}>
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        )}

        {folders.map((folder) => (
          <div key={folder.id} className="folder-block">
            <div className="setting-row">
              <span className="folder-name">
                {folder.name} <span className="result-sub">· {folder.image_count} images · {folder.path}</span>
              </span>
              <button type="button" className="screen-button" aria-label={`Unlink ${folder.name}`} onClick={() => run(async () => { await api.removeFolder(folder.id); await reload(); await onChange({}); })}>
                UNLINK
              </button>
            </div>
            <FolderImages folder={folder} selectedId={selectedImage} onPick={(img) => choose({ backdrop: { kind: "folder", id: img.id } })} />
          </div>
        ))}
      </section>

      <section className="setup-section" aria-labelledby="setup-fit">
        <h3 id="setup-fit" className="screen-label">
          FIT · DARKEN · BLUR
        </h3>
        <div className="chip-row" role="radiogroup" aria-labelledby="setup-fit">
          {(["fill", "fit", "center"] as Fit[]).map((fit) => (
            <FilterChip key={fit} active={appearance.fit === fit} role="radio" aria-checked={appearance.fit === fit} aria-pressed={undefined} onClick={() => choose({ fit })}>
              {fit.toUpperCase()}
            </FilterChip>
          ))}
        </div>
        <div className="setting-row">
          <label htmlFor="darken" className="screen-label">
            DARKEN
          </label>
          <input
            id="darken"
            className="slider"
            type="range"
            min={0}
            max={80}
            step={5}
            value={appearance.darken}
            onChange={(e) => choose({ darken: Number(e.target.value) })}
          />
          <span className="queue-pct" aria-hidden="true">
            {appearance.darken}%
          </span>
        </div>
        <label className="screen-check">
          <input type="checkbox" checked={appearance.blur} onChange={(e) => choose({ blur: e.target.checked })} />
          BLUR THE BACKDROP
        </label>
      </section>
    </div>
  );
}
