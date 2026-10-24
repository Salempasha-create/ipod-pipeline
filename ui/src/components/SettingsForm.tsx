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

export function SettingsForm({ plugin, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(plugin));
  const [clearSecrets, setClearSecrets] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (plugin.settings_schema.length === 0) {
    return <p className="muted">This plugin has no settings.</p>;
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
      setStatus({ kind: "error", text: (err as Error).message });
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
      setStatus({ kind: "ok", text: "Saved" });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings" onSubmit={submit}>
      {plugin.settings_schema.map((field) => {
        const id = `${plugin.kind}-${plugin.id}-${field.key}`;
        const value = draft[field.key];
        const isSet = plugin.secrets_set[field.key] && !clearSecrets.has(field.key);
        return (
          <div className={`field field-${field.type}`} key={field.key}>
            {field.type === "boolean" ? (
              <label className="check" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => set(field.key, e.target.checked)}
                />
                {field.label}
              </label>
            ) : (
              <>
                <label htmlFor={id}>{field.label}</label>
                {field.type === "choice" ? (
                  <select id={id} value={String(value)} onChange={(e) => set(field.key, e.target.value)}>
                    {field.choices.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <div className="input-row">
                    <input
                      id={id}
                      type={field.secret ? "password" : field.type === "string" || field.type === "path" ? "text" : "number"}
                      inputMode={field.type === "integer" ? "numeric" : field.type === "number" ? "decimal" : undefined}
                      step={field.type === "number" ? "any" : undefined}
                      min={field.min ?? undefined}
                      max={field.max ?? undefined}
                      value={String(value)}
                      placeholder={
                        field.secret
                          ? isSet
                            ? "Saved in the OS credential store; type to replace"
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
                        className="ghost"
                        onClick={() => {
                          setClearSecrets((s) => new Set(s).add(field.key));
                          set(field.key, "");
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {field.help && <p className="help">{field.help}</p>}
            {field.secret && clearSecrets.has(field.key) && (
              <p className="help">Will be removed when you save.</p>
            )}
          </div>
        );
      })}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {status && (
          <span className={status.kind === "ok" ? "ok" : "error"} role="status">
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
