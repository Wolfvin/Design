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

import { OPEN_DESIGN_HOST_GLOBAL } from '@open-design/host';

import { isNextjsEnvironment, detectNextjsPlatform, detectNextjsLocale } from './detection.js';
import type {
  NextjsBrowserClearDataOptions,
  NextjsPdfPrintOptions,
  NextjsCaptureResult,
} from './types.js';

/** Configuration for creating the Next.js host bridge. */
export interface NextjsHostBridgeConfig {
  /** The daemon's base URL (e.g., http://localhost:3210). */
  daemonBaseUrl: string;
  /** The OD project ID. */
  projectId: string;
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

    shell: {
      openExternal: (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      openPath: async (projectId: string) => {
        // Open in user's editor via daemon API
        await fetch(`${config.daemonBaseUrl}/api/projects/${projectId}/open-in-editor`, {
          method: 'POST',
        });
      },
    },

    browser: {
      clearData: async (options?: NextjsBrowserClearDataOptions) => {
        if (options?.cache) {
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

        if (options?.serviceWorkers) {
          // Unregister service workers for the preview origin
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((reg) => reg.unregister()));
          }
        }

        if (options?.localStorage) {
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
      },
    },

    capture: {
      page: async (options?: NextjsPdfPrintOptions): Promise<NextjsCaptureResult> => {
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
          throw new Error(`Capture failed: ${res.status} ${res.statusText}`);
        }

        const blob = await res.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });

        return {
          base64,
          mimeType: blob.type || 'image/png',
          width: options?.width ?? 1280,
          height: options?.height ?? 720,
        };
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
      print: async (html: string, nonce?: string, options?: NextjsPdfPrintOptions) => {
        const res = await fetch(`${config.daemonBaseUrl}/api/projects/${config.projectId}/export/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, nonce, ...options }),
        });
        return res.blob();
      },
    },

    pet: {
      setVisible: async () => {
        // No pet in browser mode
      },
    },

    updater: {
      check: async () => ({ available: false, version: null }),
      download: async () => {},
      install: async () => {},
      quit: async () => {},
      status: async () => ({ status: 'up-to-date' as const }),
      subscribe: () => {},
    },
  };

  return bridge;
}
