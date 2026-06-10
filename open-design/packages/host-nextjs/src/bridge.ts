/**
 * Next.js (browser) host bridge implementation.
 *
 * This module creates a concrete `OpenDesignHostBridge` object whose
 * methods delegate to standard Web APIs and the daemon REST API.
 * Unlike the Tauri bridge which uses IPC, this bridge uses HTTP
 * fetch calls to the daemon server for native-like operations
 * (folder picking, file access, etc.).
 *
 * The bridge is installed on `window.__od__` / `globalThis.__od__`
 * by `installNextjsHostBridge()` (see `index.ts`).
 */

import {
  OPEN_DESIGN_HOST_VERSION,
  type OpenDesignHostActionResult,
  type OpenDesignHostBrowserClearDataOptions,
  type OpenDesignHostBridge,
  type OpenDesignHostCaptureOptions,
  type OpenDesignHostCaptureResult,
  type OpenDesignHostFailure,
  type OpenDesignHostPdfPrintOptions,
  type OpenDesignHostProjectImportInit,
  type OpenDesignHostProjectImportResult,
  type OpenDesignHostProjectReplaceWorkingDirResult,
  type OpenDesignHostUpdaterActionOptions,
  type OpenDesignHostUpdaterCapabilitySet,
  type OpenDesignHostUpdaterState,
  type OpenDesignHostUpdaterStatusListener,
  type OpenDesignHostUpdaterStatusSnapshot,
} from "@open-design/host";

import { detectBrowserPlatform } from "./detection.js";
import type {
  NextjsProjectImportResult,
  NextjsReplaceWorkingDirResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failure(reason: string, details?: unknown): OpenDesignHostFailure {
  return {
    ...(details === undefined ? {} : { details }),
    ok: false,
    reason,
  };
}

function reasonFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalizeImportResult(
  input: NextjsProjectImportResult,
): OpenDesignHostProjectImportResult {
  if (!isRecord(input)) {
    return failure("Daemon import returned an invalid response", input);
  }
  if (input.ok === true) {
    return {
      conversationId: input.conversationId,
      entryFile: input.entryFile,
      ok: true,
      projectId: input.projectId,
    };
  }
  if ((input as { canceled?: boolean }).canceled === true) {
    return { canceled: true, ok: false };
  }
  const reason =
    typeof (input as { reason?: string }).reason === "string" &&
    (input as { reason?: string }).reason!.length > 0
      ? (input as { reason: string }).reason
      : "unknown failure";
  return failure(reason, (input as { details?: unknown }).details);
}

function normalizeReplaceWorkingDirResult(
  input: NextjsReplaceWorkingDirResult,
): OpenDesignHostProjectReplaceWorkingDirResult {
  if (!isRecord(input)) {
    return failure("Daemon working-dir replace returned an invalid response", input);
  }
  if (input.ok === true) {
    return {
      baseDir: input.baseDir,
      entryFile: input.entryFile,
      ok: true,
    };
  }
  if ((input as { canceled?: boolean }).canceled === true) {
    return { canceled: true, ok: false };
  }
  const reason =
    typeof (input as { reason?: string }).reason === "string" &&
    (input as { reason?: string }).reason!.length > 0
      ? (input as { reason: string }).reason
      : "unknown failure";
  return failure(reason, (input as { details?: unknown }).details);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a fully-populated `OpenDesignHostBridge` whose methods
 * delegate to Web APIs and the daemon REST API.
 *
 * @param daemonBaseUrl - Base URL of the OD daemon (e.g. "http://localhost:3847")
 */
export function createNextjsHostBridge(daemonBaseUrl: string): OpenDesignHostBridge {
  const platform = detectBrowserPlatform();
  const apiBase = daemonBaseUrl.replace(/\/+$/, "");

  return {
    version: OPEN_DESIGN_HOST_VERSION,

    client: {
      type: "web", // Next.js = web (not desktop)
      platform,
    },

    // ── Shell ────────────────────────────────────────────────────────────

    shell: {
      openExternal: async (url: string): Promise<OpenDesignHostActionResult> => {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
          return { ok: true };
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },

      openPath: async (projectId: string): Promise<OpenDesignHostActionResult> => {
        try {
          const resp = await fetch(`${apiBase}/api/projects/${encodeURIComponent(projectId)}/open-in-editor`, {
            method: "POST",
          });
          if (!resp.ok) {
            return failure(`Daemon returned ${resp.status}`);
          }
          return { ok: true };
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },
    },

    // ── Browser ──────────────────────────────────────────────────────────

    browser: {
      clearData: async (
        options?: OpenDesignHostBrowserClearDataOptions,
      ): Promise<OpenDesignHostActionResult> => {
        try {
          // Clear browser caches via Web APIs
          if (options?.cache && "caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
          // Clear storage via Web APIs
          if (options?.storage && "localStorage" in window) {
            localStorage.clear();
          }
          return { ok: true };
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },
    },

    // ── Capture ──────────────────────────────────────────────────────────

    capture: {
      page: async (
        options?: OpenDesignHostCaptureOptions,
      ): Promise<OpenDesignHostCaptureResult> => {
        try {
          // Screenshot via daemon API (server-side capture)
          const resp = await fetch(`${apiBase}/api/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: options?.url,
              clip: options?.clip,
            }),
          });
          if (!resp.ok) {
            return failure(`Capture API returned ${resp.status}`);
          }
          const result = await resp.json();
          if (result.ok) {
            return {
              dataUrl: result.dataUrl,
              h: result.h ?? 0,
              ok: true,
              w: result.w ?? 0,
            };
          }
          return failure(result.reason ?? "Capture failed");
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },
    },

    // ── Project ──────────────────────────────────────────────────────────

    project: {
      pickAndImport: async (
        init?: OpenDesignHostProjectImportInit,
      ): Promise<OpenDesignHostProjectImportResult> => {
        try {
          // Show directory picker dialog via daemon API
          const resp = await fetch(`${apiBase}/api/projects/pick-folder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(init ?? {}),
          });
          if (!resp.ok) {
            return failure(`Pick folder API returned ${resp.status}`);
          }
          const result = await resp.json();
          return normalizeImportResult(result);
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },

      pickAndReplaceWorkingDir: async (
        projectId: string,
      ): Promise<OpenDesignHostProjectReplaceWorkingDirResult> => {
        try {
          const resp = await fetch(`${apiBase}/api/projects/pick-folder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ replaceProjectId: projectId }),
          });
          if (!resp.ok) {
            return failure(`Pick folder API returned ${resp.status}`);
          }
          const result = await resp.json();
          return normalizeReplaceWorkingDirResult(result);
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },
    },

    // ── PDF ──────────────────────────────────────────────────────────────

    pdf: {
      print: async (
        html: string,
        nonce?: string,
        options?: OpenDesignHostPdfPrintOptions,
      ): Promise<OpenDesignHostActionResult> => {
        try {
          // Browser print API for Next.js mode
          const printWindow = window.open("", "_blank", "noopener");
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.print();
            return { ok: true };
          }
          return failure("Could not open print window — popup blocked");
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },
    },

    // ── Pet (no-op in browser) ───────────────────────────────────────────

    pet: {
      setVisible: (_visible: boolean): void => {
        // No desktop pet in the browser — intentionally a no-op.
      },
    },

    // ── Updater (no auto-update in web mode) ─────────────────────────────

    updater: {
      check: async (
        options?: OpenDesignHostUpdaterActionOptions,
      ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
        // No auto-update in web mode — always report "not available"
        return {
          arch: "unknown",
          capabilities: {
            canApplyInPlace: false,
            canDownload: false,
            canOpenInstaller: false,
            requiresManualInstall: true,
          } as OpenDesignHostUpdaterCapabilitySet,
          channel: "stable",
          currentVersion: "0.0.0",
          enabled: false,
          mode: "none",
          platform,
          state: "not-available" as OpenDesignHostUpdaterState,
          supported: false,
        };
      },

      download: async (
        options?: OpenDesignHostUpdaterActionOptions,
      ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
        // No download in web mode
        return {
          arch: "unknown",
          capabilities: {
            canApplyInPlace: false,
            canDownload: false,
            canOpenInstaller: false,
            requiresManualInstall: true,
          } as OpenDesignHostUpdaterCapabilitySet,
          channel: "stable",
          currentVersion: "0.0.0",
          enabled: false,
          error: { code: "NOT_SUPPORTED", message: "Auto-update is not available in web mode" },
          mode: "none",
          platform,
          state: "error" as OpenDesignHostUpdaterState,
          supported: false,
        };
      },

      install: async (
        options?: OpenDesignHostUpdaterActionOptions,
      ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
        return {
          arch: "unknown",
          capabilities: {
            canApplyInPlace: false,
            canDownload: false,
            canOpenInstaller: false,
            requiresManualInstall: true,
          } as OpenDesignHostUpdaterCapabilitySet,
          channel: "stable",
          currentVersion: "0.0.0",
          enabled: false,
          mode: "none",
          platform,
          state: "error" as OpenDesignHostUpdaterState,
          supported: false,
        };
      },

      quit: async (
        options?: OpenDesignHostUpdaterActionOptions,
      ): Promise<OpenDesignHostActionResult> => {
        return failure("Quit-and-install is not available in web mode");
      },

      status: async (
        options?: OpenDesignHostUpdaterActionOptions,
      ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
        return {
          arch: "unknown",
          capabilities: {
            canApplyInPlace: false,
            canDownload: false,
            canOpenInstaller: false,
            requiresManualInstall: true,
          } as OpenDesignHostUpdaterCapabilitySet,
          channel: "stable",
          currentVersion: "0.0.0",
          enabled: false,
          mode: "none",
          platform,
          state: "not-available" as OpenDesignHostUpdaterState,
          supported: false,
        };
      },

      subscribe: (
        listener: OpenDesignHostUpdaterStatusListener,
      ): (() => void) => {
        // No updates in web mode — return a no-op unsubscribe
        return () => {};
      },
    },
  };
}
