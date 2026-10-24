import { useEffect, useState } from "react";
import { desktop, type DesktopApi } from "../desktop";
import { Key } from "./Key";
import { Led } from "./Led";
import { LibCounter } from "./LibCounter";

export interface SourceLed {
  code: string;
  name: string;
  color: string;
  on: boolean;
}

interface Props {
  leds: SourceLed[];
  albums: number;
}

/** Device header (§5). The bare header surface is the window drag region. */
export function DeviceHeader({ leds, albums }: Props) {
  const [api, setApi] = useState<DesktopApi | null>(null);
  const [frameless, setFrameless] = useState(false);

  useEffect(() => {
    desktop().then(async (bridge) => {
      if (!bridge) return;
      setApi(bridge);
      setFrameless((await bridge.window_info()).frameless);
    });
  }, []);

  return (
    <header className="device-header pywebview-drag-region">
      <div className="wordmark">
        <span className="wordmark-name">PIPELINE</span>
        <span className="wordmark-model">PL-1 · MUSIC FETCHER</span>
      </div>
      <ul className="led-row" aria-label="Source status">
        {leds.map((led) => (
          <li key={led.code}>
            <Led color={led.color} on={led.on} code={led.code} name={led.name} />
          </li>
        ))}
      </ul>
      <div className="header-right">
        <LibCounter albums={albums} />
        {api && frameless && (
          <>
            <Key variant="square" icon="minimize" iconBack="transparent" iconSize={20} aria-label="Minimize" onClick={() => api.minimize()} />
            <Key variant="square" icon="eject" iconBack="var(--action)" aria-label="Close (eject)" onClick={() => api.close()} />
          </>
        )}
      </div>
    </header>
  );
}
