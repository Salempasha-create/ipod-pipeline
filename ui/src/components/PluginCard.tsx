import { useState } from "react";
import { api, type PluginInfo, type Value } from "../api";
import { SettingsForm } from "./SettingsForm";
import { TestJob } from "./TestJob";

interface Props {
  plugin: PluginInfo;
  onChange: (plugin: PluginInfo) => void;
}

export function PluginCard({ plugin, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleId = `toggle-${plugin.kind}-${plugin.id}`;

  const toggle = async () => {
    setError(null);
    try {
      onChange(await api.setEnabled(plugin, !plugin.enabled));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = async (values: Record<string, Value>) => {
    onChange(await api.saveSettings(plugin, values));
  };

  return (
    <article className={`card ${plugin.enabled ? "is-enabled" : ""}`}>
      <header className="card-head">
        <div>
          <h3>{plugin.name}</h3>
          <p className="muted">{plugin.description}</p>
        </div>
        <label className="switch" htmlFor={toggleId}>
          <input id={toggleId} type="checkbox" role="switch" checked={plugin.enabled} onChange={toggle} />
          <span className="switch-track" aria-hidden="true" />
          <span className="switch-label">{plugin.enabled ? "On" : "Off"}</span>
        </label>
      </header>
      {error && <p className="error">{error}</p>}

      {plugin.can_test && <TestJob plugin={plugin} />}

      <button className="disclosure" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span> Settings
      </button>
      {open && <SettingsForm plugin={plugin} onSave={save} />}
    </article>
  );
}
