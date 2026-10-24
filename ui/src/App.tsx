import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Appearance, type AppearanceChanges, type DiscoveryError, type Job, type PluginInfo } from "./api";
import { Backdrop } from "./components/Backdrop";
import { Changer } from "./components/Changer";
import { ClickWheel, type Page } from "./components/ClickWheel";
import { DeviceHeader, type SourceLed } from "./components/DeviceHeader";
import { Key } from "./components/Key";
import { PageTabs } from "./components/PageTabs";
import { LibraryPage } from "./pages/LibraryPage";
import { QueuePage } from "./pages/QueuePage";
import { SearchPage } from "./pages/SearchPage";
import { SetupPage } from "./pages/SetupPage";
import { SourcesPage } from "./pages/SourcesPage";
import { KNOWN_SOURCES, sourceStyle, type SourceStyle } from "./sources";

type View = Page | "setup";
const VIEWS: View[] = ["search", "queue", "library", "sources", "setup"];

/** Startup deep link, e.g. #queue or #search?q=artist (handy in development). */
function readHash(): { view: View; query: string } {
  const [name, params] = window.location.hash.slice(1).split("?");
  const view = (VIEWS as string[]).includes(name) ? (name as View) : "search";
  return { view, query: new URLSearchParams(params ?? "").get("q") ?? "" };
}

const initial = readHash();
const JOBS_POLL_MS = 500;

const DEFAULT_APPEARANCE: Appearance = {
  skin: "ivory",
  backdrop: { kind: "white", id: null },
  fit: "fill",
  darken: 0,
  blur: false,
  image_url: null,
};

export function App() {
  const [view, setView] = useState<View>(initial.view);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [errors, setErrors] = useState<DiscoveryError[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);

  // The page on the screen registers what the wheel's center button and the DOWNLOAD key do.
  const primaryAction = useRef<(() => void) | null>(null);
  const registerPrimary = useCallback((action: (() => void) | null) => {
    primaryAction.current = action;
  }, []);
  const [download, setDownload] = useState<(() => Promise<void>) | null>(null);
  const registerDownload = useCallback((action: (() => Promise<void>) | null) => {
    setDownload(() => action);
  }, []);

  const skin = appearance.skin;
  useEffect(() => {
    document.documentElement.dataset.skin = skin;
  }, [skin]);

  useEffect(() => {
    api.appearance().then(setAppearance).catch(() => undefined);
  }, []);

  const changeAppearance = useCallback(async (changes: AppearanceChanges) => {
    // Show the change right away, then keep what the backend saved.
    setAppearance((a) => ({ ...a, ...changes }));
    try {
      setAppearance(await api.saveAppearance(changes));
    } catch (err) {
      setAppearance(await api.appearance());
      throw err;
    }
  }, []);

  useEffect(() => {
    api
      .plugins()
      .then((data) => {
        setPlugins(data.plugins);
        setErrors(data.errors);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const data = await api.jobs();
      setJobs(data.jobs);
      setPaused(data.paused);
    } catch {
      // The backend being briefly unreachable is shown by other calls.
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const timer = window.setInterval(loadJobs, JOBS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadJobs]);

  const replace = (updated: PluginInfo) =>
    setPlugins((list) => list.map((p) => (p.kind === updated.kind && p.id === updated.id ? updated : p)));

  const navigate = useCallback((next: View) => {
    primaryAction.current = null;
    setView(next);
  }, []);

  const sources = plugins.filter((p) => p.kind === "source");
  const styles = useMemo(() => new Map(sources.map((p) => [p.id, sourceStyle(p)])), [sources]);
  const sourceFor = useCallback(
    (id: string): SourceStyle =>
      styles.get(id) ?? sourceStyle({ id, name: id, icon: null, code: null, color: null }),
    [styles],
  );

  const leds: SourceLed[] = [
    ...KNOWN_SOURCES.map((s) => ({
      code: s.code,
      name: s.name,
      color: s.color,
      on: sources.some((p) => p.id === s.id && p.enabled),
    })),
    ...sources
      .filter((p) => !KNOWN_SOURCES.some((s) => s.id === p.id))
      .map((p) => ({ code: sourceFor(p.id).code, name: p.name, color: sourceFor(p.id).color, on: p.enabled })),
  ];

  const albums = jobs.filter((j) => j.status === "done" && j.request.result).length;
  const active = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const searchable = sources.filter((p) => p.enabled && p.can_search).length;

  const tabs = [
    { id: "search" as const, label: "SEARCH" },
    { id: "queue" as const, label: active > 0 ? `QUEUE ${active}` : "QUEUE" },
    { id: "library" as const, label: "LIBRARY" },
    { id: "sources" as const, label: "SOURCES" },
  ];
  const page = view === "setup" ? null : view;

  const pressDownload = async () => {
    if (!download) return;
    setDownloading(true);
    try {
      await download();
      await loadJobs();
    } finally {
      setDownloading(false);
    }
  };

  const pageProps = (p: View) => ({
    active: view === p,
    registerPrimary,
    setStatus,
  });

  return (
    <>
      <Backdrop
        kind={appearance.image_url ? "image" : (appearance.backdrop.kind as "white" | "black" | "system")}
        imageUrl={appearance.image_url}
        fit={appearance.fit}
        darken={appearance.darken}
        blur={appearance.blur}
      />
      <div className="stage">
        <div className="device">
          <span className="grain" aria-hidden="true" />
          <DeviceHeader leds={leds} albums={albums} />
          <div className="main-row">
            <section className="screen-bezel" aria-label="Screen">
              <div className="screen">
                <div className="screen-top">
                  <PageTabs tabs={tabs} active={page} onSelect={navigate} />
                  <span className="screen-status" aria-live="polite">
                    {view === "setup" ? "SETUP" : status}
                  </span>
                </div>
                {loadError && <p className="screen-error">Could not reach the backend: {loadError}</p>}
                <SearchPage
                  {...pageProps("search")}
                  searchableSources={searchable}
                  sourceFor={sourceFor}
                  initialQuery={initial.query}
                  registerDownload={registerDownload}
                  onGoToSources={() => navigate("sources")}
                />
                <QueuePage
                  {...pageProps("queue")}
                  jobs={jobs}
                  paused={paused}
                  sourceFor={sourceFor}
                  onChanged={loadJobs}
                />
                <LibraryPage
                  {...pageProps("library")}
                  sourceFor={sourceFor}
                  refreshKey={albums}
                  onGoToSearch={() => navigate("search")}
                />
                <SourcesPage
                  {...pageProps("sources")}
                  plugins={plugins}
                  errors={errors}
                  sourceFor={sourceFor}
                  onChange={replace}
                />
                <SetupPage {...pageProps("setup")} appearance={appearance} onChange={changeAppearance} />
              </div>
            </section>
            <aside className="controls" aria-label="Controls">
              <ClickWheel
                active={page}
                onNavigate={navigate}
                onSelect={() => primaryAction.current?.()}
                selectHint="Runs the main action of the page on the screen."
              />
              <Key
                variant="primary"
                icon="download"
                onClick={pressDownload}
                disabled={!download || downloading}
                aria-describedby="download-hint"
              >
                DOWNLOAD
              </Key>
              <span id="download-hint" className="visually-hidden">
                {download ? "Loads the selected search result into the changer." : "Pick a search result first."}
              </span>
              <div className="key-pair">
                <Key
                  icon="skin"
                  iconBack="var(--action)"
                  aria-label={`Skin: ${skin === "ivory" ? "Ivory" : "Graphite"}. Switch to ${skin === "ivory" ? "Graphite" : "Ivory"}`}
                  onClick={() => changeAppearance({ skin: skin === "ivory" ? "graphite" : "ivory" }).catch(() => undefined)}
                >
                  SKIN
                </Key>
                <Key icon="setup" aria-pressed={view === "setup"} onClick={() => navigate(view === "setup" ? "search" : "setup")}>
                  SETUP
                </Key>
              </div>
              <div className="grille" aria-hidden="true" />
            </aside>
          </div>
          <Changer jobs={jobs} sourceFor={sourceFor} />
          <footer className="device-footer">
            <span>FIND · TAG · CONVERT · CARRY</span>
            <span>ALAC 16/44.1 · iPOD CLASSIC READY · SER. 0001</span>
          </footer>
        </div>
      </div>
    </>
  );
}
