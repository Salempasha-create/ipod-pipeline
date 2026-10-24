import { Fragment } from "react";
import type { SearchResult } from "../api";
import { plan, qualityLabel } from "../quality";
import { Icon } from "./Icon";

/** Under the results: picked title, plain-language note and the route (§7). */
export function SelectionStrip({ result }: { result: SearchResult | null }) {
  if (!result) {
    return (
      <div className="selection-strip">
        <p className="selection-note">Pick a result to see what will happen to it.</p>
      </div>
    );
  }
  const { note, route } = plan(result);
  return (
    <div className="selection-strip" aria-live="polite">
      <div className="selection-text">
        <span className="selection-title">
          {result.title} · {qualityLabel(result)} · {result.source_name}
        </span>
        <span className="selection-note">{note}</span>
      </div>
      <ol className="route" aria-label="Route">
        {route.map((step, i) => (
          <Fragment key={step.label}>
            {i > 0 && (
              <li className="route-dash" aria-hidden="true">
                ——
              </li>
            )}
            <li className="route-step">
              <Icon name={step.icon} size={20} back="var(--screen-icon-back)" ink="var(--screen-text)" />
              {step.label}
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
