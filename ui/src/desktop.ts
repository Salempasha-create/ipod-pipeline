// Bridge to the native window (backend/desktop.py). Absent when the UI runs in a browser.

export interface DesktopApi {
  window_info(): Promise<{ frameless: boolean; platform: string }>;
  minimize(): Promise<void>;
  close(): Promise<void>;
  pick_folder(): Promise<string | null>;
}

declare global {
  interface Window {
    pywebview?: { api?: Partial<DesktopApi> };
  }
}

const WAIT_MS = 5000;
const POLL_MS = 100;

let ready: Promise<DesktopApi | null> | null = null;

/**
 * Resolves to the desktop API inside the app window, or null in a plain browser.
 * pywebview creates `window.pywebview.api` first and adds its methods a little later,
 * so wait until the methods exist rather than checking once.
 */
export function desktop(): Promise<DesktopApi | null> {
  ready ??= new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const api = window.pywebview?.api;
      if (api && typeof api.window_info === "function") return resolve(api as DesktopApi);
      if (Date.now() - started > WAIT_MS) return resolve(null);
      window.setTimeout(check, POLL_MS);
    };
    check();
  });
  return ready;
}
