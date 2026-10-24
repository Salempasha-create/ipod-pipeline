import { useState, type FormEvent } from "react";
import type { PluginInfo, SettingField, Value } from "../api";

interface Props {
  plugin: PluginInfo;
  onSave: (values: Record<string, Value>) => Promise<void>;
}

type Draft = Record<string, string | boolean>;

function initialDraft(plugin: PluginInfo): Draft {
  const draft: Draft = {};
  for (const field of plugin.settings_schema) {
    const value = field.secret ? "" : plugin.values[field.key];
    draft[field.key] = field.type === "boolean" ? value === true : value == null ? "" : String(value);
  }
  return draft;
}

/** Turn a draft entry back into a typed value, or throw a readable error. */
function parse(field: SettingField, raw: string | boolean): Value {
  if (field.type === "boolean") return raw === true;
  const text = String(raw).trim();
  if (field.type === "integer" || field.type === "number") {
    if (text === "") return null; // back to the default
    const num = Number(text);
    if (!Number.isFinite(num) || (field.type === "integer" && !Number.isInteger(num))) {
      throw new Error(`${field.label}: enter a ${field.type === "integer" ? "whole " : ""}number`);
    }
    return num;
  }
  return field.type === "choice" ? text : String(raw);
}

/** Settings form generated from a plugin's settings schema (issue #1), styled for the screen. */
export function SettingsForm({ plugin, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(plugin));
  const [clearSecrets, setClearSecrets] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (plugin.settings_schema.length === 0) {
    return <p className="screen-hint">This plugin has no settings.</p>;
  }

  const set = (key: string, value: string | boolean) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setStatus(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const changes: Record<string, Value> = {};
    try {
      for (const field of plugin.settings_schema) {
        const raw = draft[field.key];
        if (field.secret) {
          if (clearSecrets.has(field.key)) changes[field.key] = null;
          else if (raw !== "") changes[field.key] = String(raw);
          continue;
        }
        const value = parse(field, raw);
        if (value !== plugin.values[field.key]) changes[field.key] = value;
      }
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
      return;
    }
    setSaving(true);
    try {
      await onSave(changes);
      setDraft((d) => {
        const next = { ...d };
        for (const f of plugin.settings_schema) if (f.secret) next[f.key] = "";
        return next;
      });
      setClearSecrets(new Set());
      setStatus({ ok: true, text: "SAVED" });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={submit}>
      {plugin.settings_schema.map((field) => {
        const id = `${plugin.kind}-${plugin.id}-${field.key}`;
        const helpId = `${id}-help`;
        const value = draft[field.key];
        const isSet = plugin.secrets_set[field.key] && !clearSecrets.has(field.key);
        const help = [
          field.help,
          field.secret && clearSecrets.has(field.key) ? "Will be removed when you save." : "",
          field.secret ? "Kept in your computer's password store, never in a file." : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div className="setting" key={field.key}>
            {field.type === "boolean" ? (
              <label className="screen-check" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={value === true}
                  aria-describedby={help ? helpId : undefined}
                  onChange={(e) => set(field.key, e.target.checked)}
                />
                {field.label.toUpperCase()}
              </label>
            ) : (
              <>
                <label className="screen-label" htmlFor={id}>
                  {field.label.toUpperCase()}
                </label>
                {field.type === "choice" ? (
                  <select
                    id={id}
                    className="screen-input"
                    value={String(value)}
                    aria-describedby={help ? helpId : undefined}
                    onChange={(e) => set(field.key, e.target.value)}
                  >
                    {field.choices.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <div className="setting-row">
                    <input
                      id={id}
                      className="screen-input"
                      type={
                        field.secret ? "password" : field.type === "string" || field.type === "path" ? "text" : "number"
                      }
                      inputMode={field.type === "integer" ? "numeric" : field.type === "number" ? "decimal" : undefined}
                      step={field.type === "number" ? "any" : undefined}
                      min={field.min ?? undefined}
                      max={field.max ?? undefined}
                      value={String(value)}
                      aria-describedby={help ? helpId : undefined}
                      placeholder={
                        field.secret
                          ? isSet
                            ? "Saved. Type to replace"
                            : "Not set"
                          : field.default != null && field.default !== ""
                            ? `Default: ${field.default}`
                            : undefined
                      }
                      autoComplete={field.secret ? "new-password" : "off"}
                      onChange={(e) => set(field.key, e.target.value)}
                    />
                    {field.secret && isSet && (
                      <button
                        type="button"
                        className="screen-button"
                        aria-label={`Clear ${field.label}`}
                        onClick={() => {
                          setClearSecrets((s) => new Set(s).add(field.key));
                          set(field.key, "");
                        }}
                      >
                        CLEAR
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {help && (
              <p className="screen-hint" id={helpId}>
                {help}
              </p>
            )}
          </div>
        );
      })}
      <div className="setting-row">
        <button type="submit" className="screen-button" disabled={saving}>
          {saving ? "SAVING…" : "SAVE SETTINGS"}
        </button>
        {status && (
          <span className={status.ok ? "screen-ok" : "screen-error"} role="status">
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
