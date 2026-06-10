/**
 * Tauri host bridge — main entry point.
 *
 * Usage (call once at app boot, before the OD web app reads `window.__od__`):
 *
 * ```ts
 * import { installTauriHostBridge } from "@open-design/host-tauri";
 * installTauriHostBridge();
 * ```
 *
 * If the code is not running inside a Tauri WebView the call is a no-op,
 * so the same entry point can safely be used in builds that target both
 * web and Tauri.
 */

import { OPEN_DESIGN_HOST_GLOBAL } from "@open-design/host";

import { createTauriHostBridge } from "./bridge.js";
import { isTauriEnvironment } from "./detection.js";

export { createTauriHostBridge } from "./bridge.js";
export { isTauriEnvironment, detectTauriPlatform } from "./detection.js";
export type {
  TauriBrowserClearDataOptions,
  TauriCaptureOptions,
  TauriCaptureResult,
  TauriPdfPrintOptions,
  TauriPlatform,
  TauriProjectImportInit,
  TauriProjectImportResult,
  TauriProjectImportSuccess,
  TauriReplaceWorkingDirResult,
  TauriReplaceWorkingDirSuccess,
  TauriUpdaterStatusSnapshot,
} from "./types.js";

/**
 * Install the Tauri host bridge onto `globalThis.__od__` and
 * `window.__od__`, making it discoverable by the OD web app via
 * `getOpenDesignHost()`.
 *
 * The function is idempotent: if the global already contains a valid
 * host bridge (version match, correct shape) it will **not** be
 * overwritten.
 *
 * @returns `true` if the bridge was installed, `false` if the
 *          environment is not Tauri or a bridge is already present.
 */
export function installTauriHostBridge(): boolean {
  if (!isTauriEnvironment()) return false;

  // Avoid overwriting an already-installed bridge (e.g. if this
  // function is called twice, or another host has already injected).
  const globalScope = globalThis as Record<string, unknown>;
  if (OPEN_DESIGN_HOST_GLOBAL in globalScope) {
    return false;
  }

  const bridge = createTauriHostBridge();

  (globalThis as any).__od__ = bridge;
  (window as any).__od__ = bridge;

  return true;
}
