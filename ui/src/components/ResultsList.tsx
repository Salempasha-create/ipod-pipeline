import { useRef, type KeyboardEvent } from "react";
import type { SearchResult } from "../api";
import { formatSize } from "../quality";
import type { SourceStyle } from "../sources";
import { BestBadge } from "./BestBadge";
import { Icon } from "./Icon";
import { QualityPill } from "./QualityPill";
import { SpeedBars } from "./SpeedBars";

interface RowProps {
  result: SearchResult;
  source: SourceStyle;
  selected: boolean;
  onSelect: () => void;
}

/** One result on the screen (§7): icon · title + BEST + source line · quality · size · tracks · speed. */
export function ResultRow({ result, source, selected, onSelect }: RowProps) {
  const tracks =
    result.tracks_expected != null ? `${result.track_count}/${result.tracks_expected}` : String(result.track_count);
  const who = result.uploader ? ` · ${result.uploader}` : "";
  return (
    <button
      type="button"
      className={`result-row${selected ? " selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <Icon name={source.icon} size={32} back={source.color} ink="var(--screen-text)" />
      <span className="result-release">
        <span className="result-title">
          {result.title}
          {result.best_match && <BestBadge />}
        </span>
        <span className="result-sub">
          {result.source_name}
          {who}
        </span>
      </span>
      <span>
        <QualityPill quality={result} />
      </span>
      <span className="result-data">{formatSize(result.size_bytes)}</span>
      <span className="result-data">
        {tracks}
        <span className="visually-hidden"> tracks</span>
      </span>
      <SpeedBars level={result.speed} color={source.color} />
    </button>
  );
}

interface ListProps {
  results: SearchResult[];
  sourceFor: (sourceId: string) => SourceStyle;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MOVES: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** Results table on the screen; up/down arrows move the selection. */
export function ResultsList({ results, sourceFor, selectedId, onSelect }: ListProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.key in MOVES) || results.length === 0) return;
    event.preventDefault();
    const index = results.findIndex((r) => r.id === selectedId);
    const next = Math.min(results.length - 1, Math.max(0, index + MOVES[event.key]));
    onSelect(results[next].id);
    ref.current?.querySelectorAll<HTMLElement>(".result-row")[next]?.focus();
  };

  return (
    <div className="results-scroll">
      <div className="results" ref={ref} onKeyDown={onKeyDown}>
        <div className="results-head" aria-hidden="true">
          <span />
          <span>RELEASE</span>
          <span>QUALITY</span>
          <span>SIZE</span>
          <span>TRACKS</span>
          <span>SPEED</span>
        </div>
        {results.map((r) => (
          <ResultRow
            key={r.id}
            result={r}
            source={sourceFor(r.source_id)}
            selected={r.id === selectedId}
            onSelect={() => onSelect(r.id)}
          />
        ))}
      </div>
    </div>
  );
}
