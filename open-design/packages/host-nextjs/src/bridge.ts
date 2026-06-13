/**
 * Next.js Host Bridge — browser-based bridge implementation.
 *
 * Unlike the Tauri bridge (which uses native IPC), the Next.js bridge
 * uses Web APIs and daemon API routes as the transport layer. This makes
 * it portable across any browser environment without requiring a native
 * runtime.
 *
 * The bridge is installed on `globalThis.__od__` and `window.__od__`,
 * making it discoverable by the OD web app via `getOpenDesignHost()`.
 */

import {
  OPEN_DESIGN_HOST_VERSION,
  type OpenDesignHostActionResult,
  type OpenDesignHostBrowserClearDataOptions,
  type OpenDesignHostCaptureResult,
  type OpenDesignHostUpdaterStatusSnapshot,
} from '@open-design/host';

import { detectNextjsPlatform, detectNextjsLocale } from './detection.js';
import type {
  NextjsBrowserClearDataOptions,
  NextjsPdfPrintOptions,
} from './types.js';

/** Configuration for creating the Next.js host bridge. */
export interface NextjsHostBridgeConfig {
  /** The daemon's base URL (e.g., http://localhost:3210). */
  daemonBaseUrl: string;
  /** The OD project ID. */
  projectId: string;
}

/**
 * Normalise clear-data options so that both the generic host contract
 * (`OpenDesignHostBrowserClearDataOptions` with `cookies` / `storage`)
 * and the Next.js-specific contract (`NextjsBrowserClearDataOptions` with
 * `cache` / `serviceWorkers` / `localStorage`) are accepted.
 */
function normalizeClearDataOptions(
  options?: OpenDesignHostBrowserClearDataOptions | NextjsBrowserClearDataOptions,
) {
  const generic = options as OpenDesignHostBrowserClearDataOptions | undefined;
  const nextjs = options as NextjsBrowserClearDataOptions | undefined;

  return {
    cache: nextjs?.cache ?? generic?.storage ?? false,
    serviceWorkers: nextjs?.serviceWorkers ?? false,
    localStorage: nextjs?.localStorage ?? generic?.storage ?? false,
    cookies: generic?.cookies ?? false,
  };
}

/** Build a minimal, but valid, updater status snapshot for the web bridge. */
function buildUpdaterStatusSnapshot(): OpenDesignHostUpdaterStatusSnapshot {
  return {
    arch: 'web',
    capabilities: {
      canApplyInPlace: false,
      canDownload: false,
      canOpenInstaller: false,
      requiresManualInstall: true,
    },
    channel: 'stable',
    currentVersion: '0.0.0',
    enabled: false,
    mode: 'js-incremental',
    platform: 'web',
    state: 'unsupported',
    supported: false,
  };
}

/**
 * Create a Next.js host bridge object.
 *
 * The bridge provides the same interface as the Tauri bridge but uses
 * Web APIs and daemon API routes instead of native IPC.
 */
export function createNextjsHostBridge(config: NextjsHostBridgeConfig) {
  const platform = detectNextjsPlatform();
  const locale = detectNextjsLocale();

  const bridge = {
    client: {
      type: 'web' as const,
      osLocale: locale,
      platform,
    },

    version: OPEN_DESIGN_HOST_VERSION,

    shell: {
      openExternal: async (url: string): Promise<OpenDesignHostActionResult> => {
        try {
          window.open(url, '_blank', 'noopener,noreferrer');
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
      openPath: async (projectId: string): Promise<OpenDesignHostActionResult> => {
        try {
          // Open in user's editor via daemon API
          await fetch(`${config.daemonBaseUrl}/api/projects/${projectId}/open-in-editor`, {
            method: 'POST',
          });
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    browser: {
      clearData: async (
        options?: OpenDesignHostBrowserClearDataOptions | NextjsBrowserClearDataOptions,
      ): Promise<OpenDesignHostActionResult> => {
        try {
          const normalized = normalizeClearDataOptions(options);

          if (normalized.cache) {
            // Clear Cache Storage API entries for the preview origin
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(
                keys
                  .filter((key) => key.startsWith('od-preview'))
                  .map((key) => caches.delete(key)),
              );
            }
          }

          if (normalized.serviceWorkers) {
            // Unregister service workers for the preview origin
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map((reg) => reg.unregister()));
            }
          }

          if (normalized.localStorage) {
            // Clear OD-related localStorage keys
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key?.startsWith('open-design:')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
          }

          if (normalized.cookies) {
            // Clear OD-related cookies
            document.cookie.split(';').forEach((cookie) => {
              const name = cookie.split('=')[0]?.trim();
              if (name?.startsWith('od-') || name?.startsWith('open-design-')) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
              }
            });
          }

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    capture: {
      page: async (options?: NextjsPdfPrintOptions): Promise<OpenDesignHostCaptureResult> => {
        try {
          // Screenshot via daemon API (Puppeteer/Playwright on server side)
          const res = await fetch(`${config.daemonBaseUrl}/api/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: options?.url,
              format: options?.format ?? 'png',
              width: options?.width,
              height: options?.height,
            }),
          });

          if (!res.ok) {
            return {
              ok: false,
              reason: `Capture failed: ${res.status} ${res.statusText}`,
            };
          }

          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          const w = options?.width ?? 1280;
          const h = options?.height ?? 720;

          return {
            dataUrl,
            h,
            ok: true,
            w,
          };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    project: {
      pickAndImport: async () => {
        // In browser context, we can't natively pick folders.
        // Use the daemon's folder picker API instead.
        const res = await fetch(`${config.daemonBaseUrl}/api/projects/pick-folder`, {
          method: 'POST',
        });
        return res.json();
      },
      pickAndReplaceWorkingDir: async (projectId: string) => {
        const res = await fetch(
          `${config.daemonBaseUrl}/api/projects/${projectId}/replace-working-dir`,
          { method: 'POST' },
        );
        return res.json();
      },
    },

    pdf: {
      print: async (
        html: string,
        nonce?: string,
        options?: NextjsPdfPrintOptions,
      ): Promise<OpenDesignHostActionResult> => {
        try {
          const res = await fetch(
            `${config.daemonBaseUrl}/api/projects/${config.projectId}/export/pdf`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ html, nonce, ...options }),
            },
          );

          if (!res.ok) {
            return {
              ok: false,
              reason: `PDF print failed: ${res.status} ${res.statusText}`,
            };
          }

          // Consume the response body so the connection is properly closed
          await res.blob();

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    pet: {
      setVisible: () => {
        // No pet in browser mode
      },
    },

    updater: {
      check: async () => buildUpdaterStatusSnapshot(),
      download: async () => buildUpdaterStatusSnapshot(),
      install: async () => buildUpdaterStatusSnapshot(),
      quit: async () => ({ ok: true as const }),
      status: async () => buildUpdaterStatusSnapshot(),
      subscribe: () => () => {},
    },
  };

  return bridge;
}
