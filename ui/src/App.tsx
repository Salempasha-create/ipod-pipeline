import { useEffect, useState } from "react";
import { api, type DiscoveryError, type PluginInfo, type PluginKind } from "./api";
import { PluginCard } from "./components/PluginCard";

const GROUPS: { kind: PluginKind; title: string; blurb: string }[] = [
  { kind: "source", title: "Sources", blurb: "Where music comes from." },
  { kind: "processor", title: "Processors", blurb: "Tagging and conversion." },
  { kind: "target", title: "Targets", blurb: "Where finished music goes." },
];

export function App() {
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);
  const [errors, setErrors] = useState<DiscoveryError[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .plugins()
      .then((data) => {
        setPlugins(data.plugins);
        setErrors(data.errors);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const replace = (updated: PluginInfo) =>
    setPlugins((list) =>
      list?.map((p) => (p.kind === updated.kind && p.id === updated.id ? updated : p)) ?? null,
    );

  return (
    <div className="page">
      <header className="top">
        <h1>ipod-pipeline</h1>
        <p className="muted">Plugins — turn on what you use and fill in its settings.</p>
      </header>

      {loadError && <p className="error">Could not reach the backend: {loadError}</p>}

      {errors.length > 0 && (
        <section className="warning">
          <h2>Some plugins failed to load</h2>
          <ul>
            {errors.map((e) => (
              <li key={e.module}>
                <code>{e.module}</code>: {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plugins === null && !loadError && <p className="muted">Loading…</p>}

      {plugins &&
        GROUPS.map((group) => {
          const items = plugins.filter((p) => p.kind === group.kind);
          return (
            <section className="group" key={group.kind}>
              <h2>
                {group.title} <span className="count">{items.length}</span>
              </h2>
              <p className="muted">{group.blurb}</p>
              {items.length === 0 ? (
                <p className="muted empty">No {group.title.toLowerCase()} installed.</p>
              ) : (
                items.map((p) => <PluginCard key={p.id} plugin={p} onChange={replace} />)
              )}
            </section>
          );
        })}
    </div>
  );
}
