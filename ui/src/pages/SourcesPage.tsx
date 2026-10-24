import { useEffect, useState } from "react";
import { api, isFinished, type Job, type PluginInfo, type PluginKind } from "../api";
import { Icon, isIconName } from "../components/Icon";
import { Led } from "../components/Led";
import { SegmentedProgress } from "../components/SegmentedProgress";
import { SettingsForm } from "../components/SettingsForm";
import { Toggle } from "../components/Toggle";
import type { SourceStyle } from "../sources";
import type { PageProps } from "./types";

const GROUPS: { kind: PluginKind; title: string }[] = [
  { kind: "source", title: "SOURCES" },
  { kind: "processor", title: "PROCESSORS" },
  { kind: "target", title: "TARGETS" },
];

const POLL_MS = 200;

function TestJob({ plugin, color }: { plugin: PluginInfo; color: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job || isFinished(job.status)) return;
    const timer = window.setTimeout(async () => {
      try {
        setJob(await api.job(job.id));
      } catch (err) {
        setError((err as Error).message);
      }
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [job]);

  const running = job !== null && !isFinished(job.status);

  const run = async () => {
    setError(null);
    try {
      setJob(running && job ? await api.cancelJob(job.id) : await api.startJob(plugin.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="test-job">
      <div className="setting-row">
        <button type="button" className="screen-button" onClick={run} disabled={!plugin.enabled && !running}>
          {running ? "CANCEL TEST JOB" : "RUN TEST JOB"}
        </button>
        {!plugin.enabled && !running && <span className="screen-hint">Turn the source on to run a test job.</span>}
      </div>
      {job && (
        <div className="test-job-status" aria-live="polite">
          <div className="queue-head">
            <span className="screen-label">{job.status.toUpperCase()}</span>
            <span className="result-sub">{job.error ?? job.message}</span>
            <span className="queue-pct">{Math.round(job.percent)}%</span>
          </div>
          <SegmentedProgress off="var(--screen-bar-off)" percent={job.percent} color={color} label="Test job progress" />
          {job.status === "done" && (
            <ul className="file-list">
              {job.files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="screen-error">{error}</p>}
    </div>
  );
}

interface RowProps {
  plugin: PluginInfo;
  style: SourceStyle | null;
  open: boolean;
  selected: boolean;
  onToggleOpen: () => void;
  onSelect: () => void;
  onChange: (p: PluginInfo) => void;
}

function PluginRow({ plugin, style, open, selected, onToggleOpen, onSelect, onChange }: RowProps) {
  const [error, setError] = useState<string | null>(null);
  const panelId = `settings-${plugin.kind}-${plugin.id}`;

  const toggle = async (enabled: boolean) => {
    setError(null);
    try {
      onChange(await api.setEnabled(plugin, enabled));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <li className={`plugin-row${selected ? " selected" : ""}`} id={`plugin-${plugin.kind}-${plugin.id}`} onFocus={onSelect} onClick={onSelect}>
      <div className="plugin-head">
        {style ? (
          <Icon name={style.icon} size={32} back={style.color} ink="var(--screen-text)" />
        ) : (
          <Icon
            name={isIconName(plugin.icon) ? plugin.icon : "levels"}
            size={32}
            back="var(--screen-icon-back)"
            ink="var(--screen-text)"
          />
        )}
        <div className="plugin-text">
          <span className="result-title">
            {plugin.name}
            {style && <Led color={style.color} on={plugin.enabled} code={style.code} name={plugin.name} />}
          </span>
          <span className="result-sub">{plugin.description}</span>
        </div>
        <Toggle checked={plugin.enabled} onChange={toggle} label={`${plugin.name} on or off`} />
        <button type="button" className="screen-button" aria-expanded={open} aria-controls={panelId} onClick={onToggleOpen}>
          {open ? "CLOSE" : "SETTINGS"}
        </button>
      </div>
      {error && <p className="screen-error">{error}</p>}
      {open && (
        <div className="plugin-settings" id={panelId}>
          <SettingsForm plugin={plugin} onSave={async (values) => onChange(await api.saveSettings(plugin, values))} />
          {plugin.can_test && <TestJob plugin={plugin} color={style?.color ?? "var(--screen-text)"} />}
        </div>
      )}
    </li>
  );
}

interface Props extends PageProps {
  plugins: PluginInfo[];
  errors: { module: string; message: string }[];
  sourceFor: (id: string) => SourceStyle;
  onChange: (p: PluginInfo) => void;
}

export function SourcesPage({ active, registerPrimary, setStatus, plugins, errors, sourceFor, onChange }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const key = (p: PluginInfo) => `${p.kind}-${p.id}`;
  const sources = plugins.filter((p) => p.kind === "source");

  const toggleOpen = (k: string, force?: boolean) =>
    setOpen((s) => {
      const next = new Set(s);
      if (force ?? !next.has(k)) next.add(k);
      else next.delete(k);
      return next;
    });

  useEffect(() => {
    if (!active) return;
    const target = selected ?? (sources[0] ? key(sources[0]) : null);
    registerPrimary(target ? () => toggleOpen(target, true) : null);
    setStatus(`${sources.filter((s) => s.enabled).length} OF ${sources.length} SOURCES ON`);
  });

  return (
    <div className="page" hidden={!active}>
      {errors.length > 0 && (
        <div className="screen-error">
          {errors.map((e) => (
            <p key={e.module}>
              {e.module}: {e.message}
            </p>
          ))}
        </div>
      )}
      {GROUPS.map((group) => {
        const items = plugins.filter((p) => p.kind === group.kind);
        return (
          <section key={group.kind} className="plugin-group" aria-label={group.title}>
            <h3 className="screen-label">{group.title}</h3>
            {items.length === 0 ? (
              <p className="screen-hint">None installed.</p>
            ) : (
              <ul className="plugin-list">
                {items.map((p) => (
                  <PluginRow
                    key={key(p)}
                    plugin={p}
                    style={p.kind === "source" ? sourceFor(p.id) : null}
                    open={open.has(key(p))}
                    selected={selected === key(p)}
                    onToggleOpen={() => toggleOpen(key(p))}
                    onSelect={() => setSelected(key(p))}
                    onChange={onChange}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
