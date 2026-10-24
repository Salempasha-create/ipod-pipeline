export type PluginKind = "source" | "processor" | "target";
export type FieldType = "string" | "integer" | "number" | "boolean" | "choice" | "path";
export type Value = string | number | boolean | null;

export interface SettingField {
  key: string;
  type: FieldType;
  label: string;
  default: Value;
  secret: boolean;
  help: string;
  choices: string[];
  min: number | null;
  max: number | null;
}

export interface PluginInfo {
  kind: PluginKind;
  id: string;
  name: string;
  description: string;
  icon: string | null;
  code?: string | null;
  color?: string | null;
  settings_schema: SettingField[];
  enabled: boolean;
  values: Record<string, Value>;
  secrets_set: Record<string, boolean>;
  can_test: boolean;
}

export interface DiscoveryError {
  kind: PluginKind;
  module: string;
  message: string;
}

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface Job {
  id: string;
  source_id: string;
  status: JobStatus;
  percent: number;
  message: string;
  files: string[];
  error: string | null;
}

export const isFinished = (status: JobStatus) =>
  status === "done" || status === "failed" || status === "cancelled";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      // keep the status text
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  plugins: () => call<{ plugins: PluginInfo[]; errors: DiscoveryError[] }>("GET", "/api/plugins"),
  setEnabled: (p: PluginInfo, enabled: boolean) =>
    call<PluginInfo>("PUT", `/api/plugins/${p.kind}/${p.id}/enabled`, { enabled }),
  saveSettings: (p: PluginInfo, values: Record<string, Value>) =>
    call<PluginInfo>("PUT", `/api/plugins/${p.kind}/${p.id}/settings`, { values }),
  startJob: (sourceId: string) => call<Job>("POST", `/api/sources/${sourceId}/jobs`, {}),
  job: (id: string) => call<Job>("GET", `/api/jobs/${id}`),
  cancelJob: (id: string) => call<Job>("POST", `/api/jobs/${id}/cancel`),
};
