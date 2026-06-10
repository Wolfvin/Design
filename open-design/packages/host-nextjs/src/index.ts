/**
 * Next.js host bridge — main entry point.
 *
 * Usage (call once at app boot, before the OD web app reads `window.__od__`):
 *
 * ```ts
 * import { installNextjsHostBridge } from "@open-design/host-nextjs";
 * installNextjsHostBridge({ daemonBaseUrl: "http://localhost:3210", projectId: "..." });
 * ```
 *
 * The bridge is only installed when the project type is detected as
 * nextjs-standalone or nextjs-pages. For Tauri projects, use the
 * Tauri bridge instead.
 */

import { OPEN_DESIGN_HOST_GLOBAL } from '@open-design/host';

import { createNextjsHostBridge, type NextjsHostBridgeConfig } from './bridge.js';
import { isNextjsEnvironment } from './detection.js';

export { createNextjsHostBridge } from './bridge.js';
export { isNextjsEnvironment, detectNextjsPlatform, detectNextjsLocale } from './detection.js';
export {
  buildOdInjectionHeaders,
  generateMiddlewareSnippet,
  readOdInjectionHeadersFromMeta,
  type OdMiddlewareConfig,
} from './middleware.js';
export type {
  NextjsBrowserClearDataOptions,
  NextjsPdfPrintOptions,
  NextjsCaptureResult,
  PrismaValidationResult,
  PrismaMigrationResult,
  NextjsDevServerStatus,
} from './types.js';

/**
 * Install the Next.js host bridge onto `globalThis.__od__` and
 * `window.__od__`, making it discoverable by the OD web app via
 * `getOpenDesignHost()`.
 *
 * The function is idempotent: if the global already contains a valid
 * host bridge it will **not** be overwritten.
 *
 * @returns `true` if the bridge was installed, `false` if the
 *          environment is not suitable or a bridge is already present.
 */
export function installNextjsHostBridge(config: NextjsHostBridgeConfig): boolean {
  if (!isNextjsEnvironment()) return false;

  // Avoid overwriting an already-installed bridge
  const globalScope = globalThis as Record<string, unknown>;
  if (OPEN_DESIGN_HOST_GLOBAL in globalScope) {
    return false;
  }

  const bridge = createNextjsHostBridge(config);

  (globalScope as any).__od__ = bridge;
  (window as any).__od__ = bridge;

  return true;
}
