/**
 * Next.js (browser) host bridge — main entry point.
 *
 * Usage (call once at app boot, before the OD web app reads `window.__od__`):
 *
 * ```ts
 * import { installNextjsHostBridge } from "@open-design/host-nextjs";
 * installNextjsHostBridge("http://localhost:3847");
 * ```
 *
 * If the code is running inside a Tauri WebView the call is a no-op
 * (the Tauri bridge should be used instead), so the same entry point
 * can safely be used in builds that target both web and Tauri.
 */

import { OPEN_DESIGN_HOST_GLOBAL } from "@open-design/host";

import { createNextjsHostBridge } from "./bridge.js";
import { isBrowserEnvironment } from "./detection.js";

export { createNextjsHostBridge } from "./bridge.js";
export { isBrowserEnvironment, detectBrowserPlatform } from "./detection.js";
export type {
  NextjsBrowserClearDataOptions,
  NextjsCaptureOptions,
  NextjsCaptureResult,
  NextjsPdfPrintOptions,
  NextjsPlatform,
  NextjsProjectImportInit,
  NextjsProjectImportResult,
  NextjsProjectImportSuccess,
  NextjsReplaceWorkingDirResult,
  NextjsReplaceWorkingDirSuccess,
} from "./types.js";

/**
 * Install the Next.js host bridge onto `globalThis.__od__` and
 * `window.__od__`, making it discoverable by the OD web app via
 * `getOpenDesignHost()`.
 *
 * The function is idempotent: if the global already contains a valid
 * host bridge (version match, correct shape) it will **not** be
 * overwritten.
 *
 * @param daemonBaseUrl - Base URL of the OD daemon REST API (e.g. "http://localhost:3847")
 * @returns `true` if the bridge was installed, `false` if the
 *          environment is not a standard browser or a bridge is already present.
 */
export function installNextjsHostBridge(daemonBaseUrl: string): boolean {
  if (!isBrowserEnvironment()) return false;

  // Avoid overwriting an already-installed bridge
  const globalScope = globalThis as Record<string, unknown>;
  if (OPEN_DESIGN_HOST_GLOBAL in globalScope) {
    return false;
  }

  const bridge = createNextjsHostBridge(daemonBaseUrl);

  (globalThis as any).__od__ = bridge;
  (window as any).__od__ = bridge;

  return true;
}
