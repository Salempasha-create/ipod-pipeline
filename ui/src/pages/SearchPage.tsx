import { useEffect, useMemo, useRef, useState } from "react";
import { api, type SearchResponse, type SearchResult } from "../api";
import { FilterChip } from "../components/FilterChip";
import { ResultsList } from "../components/ResultsList";
import { SearchInput } from "../components/SearchInput";
import { SelectionStrip } from "../components/SelectionStrip";
import { isLossless } from "../quality";
import type { SourceStyle } from "../sources";
import type { PageProps } from "./types";

type FormatFilter = "all" | "flac" | "mp3";

interface Props extends PageProps {
  searchableSources: number;
  sourceFor: (id: string) => SourceStyle;
  initialQuery?: string;
  /** Registers what the DOWNLOAD key does: queue the selected result, or null when nothing is picked. */
  registerDownload: (action: (() => Promise<void>) | null) => void;
  onGoToSources: () => void;
}

const complete = (r: SearchResult) => !r.tracks_expected || r.track_count >= r.tracks_expected;

export function SearchPage({
  active,
  registerPrimary,
  setStatus,
  searchableSources,
  sourceFor,
  initialQuery = "",
  registerDownload,
  onGoToSources,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatFilter>("all");
  const [completeFirst, setCompleteFirst] = useState(true);

  const run = async (text = query.trim()) => {
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    setSearching(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.search(text);
      setResponse(data);
      setSelectedId(data.results[0]?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const results = useMemo(() => {
    const filtered = (response?.results ?? []).filter((r) =>
      format === "flac" ? isLossless(r) : format === "mp3" ? r.format.toUpperCase() === "MP3" : true,
    );
    // Stable sort keeps the backend's ranking inside each group.
    return completeFirst ? [...filtered].sort((a, b) => Number(complete(b)) - Number(complete(a))) : filtered;
  }, [response, format, completeFirst]);
  const selected = results.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!active) return;
    registerPrimary(() => run());
    if (searching) setStatus("SEARCHING…");
    else if (response)
      setStatus(
        `${results.length} RESULTS · ${response.sources_searched.length} ${
          response.sources_searched.length === 1 ? "SOURCE" : "SOURCES"
        } · ${response.seconds.toFixed(1)} S`,
      );
    else setStatus(`${searchableSources} ${searchableSources === 1 ? "SOURCE" : "SOURCES"} READY`);
  });

  useEffect(() => {
    registerDownload(
      selected
        ? async () => {
            setNotice(null);
            try {
              await api.startJob(selected.source_id, { result: selected });
              setNotice(`Loaded "${selected.title}" into the changer.`);
            } catch (err) {
              setNotice((err as Error).message);
            }
          }
        : null,
    );
  }, [selected, registerDownload]);

  const ranInitial = useRef(false);
  useEffect(() => {
    if (initialQuery && searchableSources > 0 && !ranInitial.current) {
      ranInitial.current = true;
      run(initialQuery.trim());
    }
  });

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  return (
    <div className="page" hidden={!active}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <SearchInput
          ref={inputRef}
          value={query}
          placeholder="Artist, album or song"
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="chip-row" role="group" aria-label="Filter results">
        <FilterChip active={format === "all"} onClick={() => setFormat("all")}>
          ALL SOURCES
        </FilterChip>
        <FilterChip active={format === "flac"} onClick={() => setFormat("flac")}>
          FLAC ONLY
        </FilterChip>
        <FilterChip active={format === "mp3"} onClick={() => setFormat("mp3")}>
          MP3 ONLY
        </FilterChip>
        <label className="screen-check">
          <input type="checkbox" checked={completeFirst} onChange={(e) => setCompleteFirst(e.target.checked)} />
          COMPLETE ALBUMS FIRST
        </label>
      </div>

      <div className="page-body" aria-live="polite" aria-busy={searching}>
        {searchableSources === 0 ? (
          <div className="screen-empty">
            <p>No sources are on, so there is nowhere to search yet.</p>
            <button type="button" className="screen-button" onClick={onGoToSources}>
              OPEN SOURCES
            </button>
          </div>
        ) : error ? (
          <p className="screen-error">{error}</p>
        ) : !response ? (
          <p className="screen-hint">Type an artist, album or song, then press the center button or Enter.</p>
        ) : results.length === 0 ? (
          <p className="screen-hint">
            {response.results.length === 0 ? `Nothing found for "${response.query}".` : "No results match these filters."}
          </p>
        ) : (
          <ResultsList results={results} sourceFor={sourceFor} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        )}
        {response?.errors.map((e) => (
          <p key={e.source_id} className="screen-error">
            {e.source_id.toUpperCase()}: {e.message}
          </p>
        ))}
      </div>

      <SelectionStrip result={selected} />
      {notice && (
        <p className="screen-hint" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
