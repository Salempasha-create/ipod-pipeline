import type { AudioQuality } from "./quality";

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
  can_search: boolean;
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
  request: { result?: SearchResult; query?: string; [key: string]: unknown };
  status: JobStatus;
  percent: number;
  message: string;
  files: string[];
  error: string | null;
}

export interface SearchResult extends AudioQuality {
  id: string;
  source_id: string;
  source_name: string;
  kind: "album" | "track";
  title: string;
  artist: string;
  year: number | null;
  uploader: string | null;
  size_bytes: number;
  track_count: number;
  tracks_expected: number | null;
  /** 0–5 rising bars. */
  speed: number;
  free_slot: boolean;
  best_match: boolean;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  sources_searched: string[];
  errors: { source_id: string; message: string }[];
  seconds: number;
}

export interface LibraryAlbum extends AudioQuality {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  track_count: number;
  source_id: string;
  source_name: string;
  folder: string;
}

export type Skin = "ivory" | "graphite";
export type BackdropKind = "white" | "black" | "system" | "upload" | "folder";
export type Fit = "fill" | "fit" | "center";

export interface Appearance {
  skin: Skin;
  backdrop: { kind: BackdropKind; id: string | null };
  fit: Fit;
  darken: number;
  blur: boolean;
  /** Full-size URL of the chosen image, or null for a plain color. */
  image_url: string | null;
}

export type AppearanceChanges = Partial<Omit<Appearance, "image_url">>;

export interface BackdropImage {
  id: string;
  name: string;
  thumb_url: string;
  image_url: string;
}

export interface LinkedFolder {
  id: string;
  path: string;
  name: string;
  available: boolean;
  image_count: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
}

export const isFinished = (status: JobStatus) =>
  status === "done" || status === "failed" || status === "cancelled";

async function call<T>(method: string, path: string, body?: unknown, raw?: Blob): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (raw) {
    headers["Content-Type"] = raw.type || "application/octet-stream";
    payload = raw;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload });
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
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

const q = encodeURIComponent;

export const api = {
  plugins: () => call<{ plugins: PluginInfo[]; errors: DiscoveryError[] }>("GET", "/api/plugins"),
  setEnabled: (p: PluginInfo, enabled: boolean) =>
    call<PluginInfo>("PUT", `/api/plugins/${p.kind}/${p.id}/enabled`, { enabled }),
  saveSettings: (p: PluginInfo, values: Record<string, Value>) =>
    call<PluginInfo>("PUT", `/api/plugins/${p.kind}/${p.id}/settings`, { values }),

  search: (query: string) => call<SearchResponse>("GET", `/api/search?q=${q(query)}`),

  startJob: (sourceId: string, request?: Record<string, unknown>) =>
    call<Job>("POST", `/api/sources/${sourceId}/jobs`, { request: request ?? {} }),
  jobs: () => call<{ jobs: Job[]; paused: boolean }>("GET", "/api/jobs"),
  job: (id: string) => call<Job>("GET", `/api/jobs/${id}`),
  cancelJob: (id: string) => call<Job>("POST", `/api/jobs/${id}/cancel`),
  setPaused: (paused: boolean) => call<{ paused: boolean }>("PUT", "/api/jobs/paused", { paused }),

  library: () => call<{ albums: LibraryAlbum[] }>("GET", "/api/library"),
  openFolder: (albumId: string) => call<void>("POST", `/api/library/${q(albumId)}/open`),

  appearance: () => call<Appearance>("GET", "/api/appearance"),
  saveAppearance: (changes: AppearanceChanges) => call<Appearance>("PUT", "/api/appearance", changes),
  uploads: () => call<{ items: BackdropImage[] }>("GET", "/api/backdrops/uploads"),
  upload: (file: File) =>
    call<BackdropImage>("POST", `/api/backdrops/uploads?name=${q(file.name)}`, undefined, file),
  removeUpload: (id: string) => call<void>("DELETE", `/api/backdrops/uploads/${q(id)}`),
  folders: () => call<{ items: LinkedFolder[] }>("GET", "/api/backdrops/folders"),
  addFolder: (path: string) => call<LinkedFolder>("POST", "/api/backdrops/folders", { path }),
  removeFolder: (id: string) => call<void>("DELETE", `/api/backdrops/folders/${q(id)}`),
  folderImages: (id: string, offset: number, limit: number) =>
    call<Page<BackdropImage>>("GET", `/api/backdrops/folders/${q(id)}/images?offset=${offset}&limit=${limit}`),
};
