import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { api, type LibraryAlbum } from "../api";
import { Icon } from "../components/Icon";
import { Minidisc } from "../components/Minidisc";
import { QualityPill } from "../components/QualityPill";
import type { SourceStyle } from "../sources";
import type { PageProps } from "./types";

interface Props extends PageProps {
  sourceFor: (id: string) => SourceStyle;
  /** Bumped when downloads finish, to reload. */
  refreshKey: number;
  onGoToSearch: () => void;
}

export function LibraryPage({ active, registerPrimary, setStatus, sourceFor, refreshKey, onGoToSearch }: Props) {
  const [albums, setAlbums] = useState<LibraryAlbum[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.library();
      setAlbums(data.albums);
      setSelectedId((id) => (data.albums.some((a) => a.id === id) ? id : (data.albums[0]?.id ?? null)));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openSelected = async () => {
    if (!selectedId) return;
    try {
      await api.openFolder(selectedId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (!active) return;
    registerPrimary(albums && albums.length > 0 ? openSelected : onGoToSearch);
    setStatus(`${albums?.length ?? 0} ALBUMS · ALAC 16/44.1`);
  });

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!albums?.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const index = albums.findIndex((a) => a.id === selectedId);
    const next = Math.max(0, Math.min(albums.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
    setSelectedId(albums[next].id);
    event.currentTarget.querySelectorAll<HTMLElement>("button")[next]?.focus();
  };

  return (
    <div className="page" hidden={!active}>
      {error && <p className="screen-error">{error}</p>}
      {albums && albums.length === 0 && (
        <div className="screen-empty">
          <Icon name="library" size={48} back="var(--screen-icon-back)" ink="var(--screen-text)" />
          <p className="screen-empty-title">The library is empty</p>
          <p>Find an album on SEARCH and press DOWNLOAD. Finished albums land here.</p>
          <button type="button" className="screen-button" onClick={onGoToSearch}>
            GO TO SEARCH
          </button>
        </div>
      )}
      {albums && albums.length > 0 && (
        <>
          <ul className="album-list" aria-label="Albums" onKeyDown={onKeyDown}>
            {albums.map((a) => {
              const source = sourceFor(a.source_id);
              const selected = a.id === selectedId;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`result-row album-row${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedId(a.id)}
                    onDoubleClick={openSelected}
                  >
                    <Minidisc size="small" album={a.title} artist={a.artist} shell={source.shell} alt={`${source.name} minidisc`} />
                    <span className="result-release">
                      <span className="result-title">{a.title}</span>
                      <span className="result-sub">
                        {a.artist}
                        {a.year ? ` · ${a.year}` : ""} · {a.track_count} tracks · {source.name}
                      </span>
                    </span>
                    <span>
                      <QualityPill quality={a} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="screen-hint">
            Finished downloads for now; the full library arrives with the library folder target. The center button
            opens the selected album's folder.
          </p>
        </>
      )}
    </div>
  );
}
