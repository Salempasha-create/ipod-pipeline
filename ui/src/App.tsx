import { useEffect, useState } from "react";
import { api, type DiscoveryError, type PluginInfo } from "./api";
import { Backdrop } from "./components/Backdrop";
import { DeviceHeader, type SourceLed } from "./components/DeviceHeader";
import { Key } from "./components/Key";
import { PluginCard } from "./components/PluginCard";
import { KNOWN_SOURCES, sourceStyle } from "./sources";

export function App() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [, setErrors] = useState<DiscoveryError[]>([]);
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
    setPlugins((list) => list.map((p) => (p.kind === updated.kind && p.id === updated.id ? updated : p)));

  const sources = plugins.filter((p) => p.kind === "source");
  const leds: SourceLed[] = [
    ...KNOWN_SOURCES.map((s) => ({
      code: s.code,
      name: s.name,
      color: s.color,
      on: sources.some((p) => p.id === s.id && p.enabled),
    })),
    ...sources
      .filter((p) => !KNOWN_SOURCES.some((s) => s.id === p.id))
      .map((p) => {
        const style = sourceStyle(p);
        return { code: style.code, name: p.name, color: style.color, on: p.enabled };
      }),
  ];

  return (
    <>
      <Backdrop kind="white" />
      <div className="stage">
        <div className="device">
          <span className="grain" aria-hidden="true" />
          <DeviceHeader leds={leds} albums={0} />
          <div className="main-row">
            <section className="screen-bezel" aria-label="Screen">
              <div className="screen">
                {loadError && <p>Could not reach the backend: {loadError}</p>}
                {plugins.map((p) => (
                  <PluginCard key={`${p.kind}-${p.id}`} plugin={p} onChange={replace} />
                ))}
              </div>
            </section>
            <aside className="controls" aria-label="Controls">
              <Key variant="primary" icon="download" className="key-primary">
                DOWNLOAD
              </Key>
              <div className="key-pair">
                <Key icon="skin" iconBack="var(--action)">
                  SKIN
                </Key>
                <Key icon="setup">SETUP</Key>
              </div>
              <div className="grille" aria-hidden="true" />
            </aside>
          </div>
          <section className="changer" aria-label="Changer">
            <div className="changer-head">
              <div className="changer-title">
                <h2>CHANGER</h2>
                <span className="changer-status">0 DISCS LOADED · DISC COLOR = SOURCE</span>
              </div>
              <Key icon="iopenpod" iconBack="var(--action)" iconSize={24}>
                SEND TO iOPENPOD
              </Key>
            </div>
          </section>
          <footer className="device-footer">
            <span>FIND · TAG · CONVERT · CARRY</span>
            <span>ALAC 16/44.1 · iPOD CLASSIC READY · SER. 0001</span>
          </footer>
        </div>
      </div>
    </>
  );
}
