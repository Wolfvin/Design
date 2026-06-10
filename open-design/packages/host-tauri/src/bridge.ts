/**
 * Tauri host bridge implementation.
 *
 * This module creates a concrete `OpenDesignHostBridge` object whose
 * methods delegate to Tauri IPC commands (defined in `commands.ts`).
 * The bridge is installed on `window.__od__` / `globalThis.__od__`
 * by `installTauriHostBridge()` (see `index.ts`).
 *
 * Design notes
 * ────────────
 * - Every method returns the *exact* shape that `@open-design/host`
 *   defines so that `isOpenDesignHostBridge()` validates successfully.
 * - Errors from Tauri IPC are caught and mapped to `OpenDesignHostFailure`
 *   rather than being allowed to propagate as unstructured exceptions.
 * - The `pet.setVisible` method is a no-op because the Tauri build does
 *   not include a desktop pet feature.
 * - The updater namespace delegates to `@tauri-apps/plugin-updater`
 *   and translates its API into the host-bridge updater contract.
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

import {
  captureScreenshot,
  clearBrowserData,
  pickAndImportProject,
  pickAndReplaceWorkingDir,
  printPdf,
  shellOpenExternal,
  shellOpenPath,
  updaterCheck,
  updaterDownload,
  updaterInstall,
  updaterQuitAndInstall,
} from "./commands.js";
import { detectTauriPlatform } from "./detection.js";
import type { TauriProjectImportResult, TauriReplaceWorkingDirResult } from "./types.js";

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

/**
 * Convert the Tauri IPC result for `import_project` into the canonical
 * `OpenDesignHostProjectImportResult` shape.
 */
function normalizeImportResult(
  input: TauriProjectImportResult,
): OpenDesignHostProjectImportResult {
  if (!isRecord(input)) {
    return failure("Tauri import returned an invalid response", input);
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

/**
 * Convert the Tauri IPC result for `replace_working_dir` into the
 * canonical `OpenDesignHostProjectReplaceWorkingDirResult` shape.
 */
function normalizeReplaceWorkingDirResult(
  input: TauriReplaceWorkingDirResult,
): OpenDesignHostProjectReplaceWorkingDirResult {
  if (!isRecord(input)) {
    return failure("Tauri working-dir replace returned an invalid response", input);
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
// Updater state
// ---------------------------------------------------------------------------

/**
 * Internal updater state machine. Because `@tauri-apps/plugin-updater`
 * exposes an imperative API (check → download → install) rather than a
 * stateful one, we track state locally and notify subscribers.
 */
type UpdaterState = {
  availableUpdate: unknown | null;
  listeners: Set<OpenDesignHostUpdaterStatusListener>;
  status: OpenDesignHostUpdaterStatusSnapshot;
};

function createDefaultUpdaterStatus(
  platform: string,
): OpenDesignHostUpdaterStatusSnapshot {
  return {
    arch: "unknown",
    capabilities: {
      canApplyInPlace: true,
      canDownload: true,
      canOpenInstaller: false,
      requiresManualInstall: false,
    },
    channel: "stable",
    currentVersion: "0.0.0",
    enabled: true,
    mode: "js-incremental",
    platform,
    state: "idle",
    supported: true,
  };
}

function createUpdaterNamespace(
  platform: string,
): OpenDesignHostBridge["updater"] & {
  _state: UpdaterState;
} {
  const _state: UpdaterState = {
    availableUpdate: null,
    listeners: new Set(),
    status: createDefaultUpdaterStatus(platform),
  };

  function notifyListeners(): void {
    for (const listener of _state.listeners) {
      try {
        listener(_state.status);
      } catch {
        // Swallow listener errors.
      }
    }
  }

  const updater: OpenDesignHostBridge["updater"] & { _state: UpdaterState } = {
    _state,

    check: async (
      options?: OpenDesignHostUpdaterActionOptions,
    ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
      _state.status = { ..._state.status, state: "checking" as OpenDesignHostUpdaterState };
      notifyListeners();

      try {
        const update = await updaterCheck();
        if (update != null && isRecord(update)) {
          _state.availableUpdate = update;
          const version = typeof update.version === "string" ? update.version : "unknown";
          _state.status = {
            ..._state.status,
            availableVersion: version,
            state: "available" as OpenDesignHostUpdaterState,
          };
        } else {
          _state.availableUpdate = null;
          _state.status = {
            ..._state.status,
            state: "not-available" as OpenDesignHostUpdaterState,
          };
        }
      } catch (error) {
        _state.status = {
          ..._state.status,
          error: {
            code: "CHECK_FAILED",
            message: reasonFromError(error),
          },
          state: "error" as OpenDesignHostUpdaterState,
        };
      }

      notifyListeners();
      return _state.status;
    },

    download: async (
      options?: OpenDesignHostUpdaterActionOptions,
    ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
      _state.status = { ..._state.status, state: "downloading" as OpenDesignHostUpdaterState };
      notifyListeners();

      try {
        await updaterDownload(_state.availableUpdate, (progress) => {
          _state.status = {
            ..._state.status,
            progress: {
              receivedBytes: progress.downloaded,
              totalBytes: progress.total,
            },
            state: "downloading" as OpenDesignHostUpdaterState,
          };
          notifyListeners();
        });

        _state.status = {
          ..._state.status,
          progress: undefined,
          state: "downloaded" as OpenDesignHostUpdaterState,
        };
      } catch (error) {
        _state.status = {
          ..._state.status,
          error: {
            code: "DOWNLOAD_FAILED",
            message: reasonFromError(error),
          },
          state: "error" as OpenDesignHostUpdaterState,
        };
      }

      notifyListeners();
      return _state.status;
    },

    install: async (
      options?: OpenDesignHostUpdaterActionOptions,
    ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
      _state.status = { ..._state.status, state: "installing" as OpenDesignHostUpdaterState };
      notifyListeners();

      try {
        await updaterInstall(_state.availableUpdate);
        _state.status = {
          ..._state.status,
          state: "downloaded" as OpenDesignHostUpdaterState,
        };
      } catch (error) {
        _state.status = {
          ..._state.status,
          error: {
            code: "INSTALL_FAILED",
            message: reasonFromError(error),
          },
          state: "error" as OpenDesignHostUpdaterState,
        };
      }

      notifyListeners();
      return _state.status;
    },

    quit: async (
      options?: OpenDesignHostUpdaterActionOptions,
    ): Promise<OpenDesignHostActionResult> => {
      try {
        await updaterQuitAndInstall();
        return { ok: true };
      } catch (error) {
        return failure(reasonFromError(error));
      }
    },

    status: async (
      options?: OpenDesignHostUpdaterActionOptions,
    ): Promise<OpenDesignHostUpdaterStatusSnapshot> => {
      return _state.status;
    },

    subscribe: (
      listener: OpenDesignHostUpdaterStatusListener,
    ): (() => void) => {
      _state.listeners.add(listener);
      return () => {
        _state.listeners.delete(listener);
      };
    },
  };

  return updater;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a fully-populated `OpenDesignHostBridge` whose methods
 * delegate to Tauri IPC commands.
 */
export function createTauriHostBridge(): OpenDesignHostBridge {
  const platform = detectTauriPlatform();

  const updater = createUpdaterNamespace(platform);

  return {
    version: OPEN_DESIGN_HOST_VERSION,

    client: {
      type: "desktop",
      platform,
    },

    // ── Shell ────────────────────────────────────────────────────────────

    shell: {
      openExternal: async (url: string): Promise<OpenDesignHostActionResult> => {
        try {
          await shellOpenExternal(url);
          return { ok: true };
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },

      openPath: async (projectId: string): Promise<OpenDesignHostActionResult> => {
        try {
          await shellOpenPath(projectId);
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
          await clearBrowserData(options);
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
          const dataUrl = await captureScreenshot(options);
          // The Rust command returns a data-URL string. We don't have
          // pixel dimensions from the Rust side, so we parse them from
          // the browser's `Image` element if available, or report 0×0.
          let w = 0;
          let h = 0;
          if (typeof Image !== "undefined") {
            const img = new Image();
            img.src = dataUrl;
            // Synchronous access won't work for data URLs in all browsers,
            // but naturalWidth/Height are available synchronously once decoded.
            // As a safe fallback we just report 0 and let the renderer handle
            // it.
            w = img.naturalWidth || img.width || 0;
            h = img.naturalHeight || img.height || 0;
          }
          return { dataUrl, h, ok: true, w };
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
          const result = await pickAndImportProject(init);
          return normalizeImportResult(result);
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },

      pickAndReplaceWorkingDir: async (
        projectId: string,
      ): Promise<OpenDesignHostProjectReplaceWorkingDirResult> => {
        try {
          const result = await pickAndReplaceWorkingDir(projectId);
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
          await printPdf(html, nonce, options);
          return { ok: true };
        } catch (error) {
          return failure(reasonFromError(error));
        }
      },
    },

    // ── Pet (no-op in Tauri) ─────────────────────────────────────────────

    pet: {
      setVisible: (_visible: boolean): void => {
        // No desktop pet in the Tauri build — intentionally a no-op.
      },
    },

    // ── Updater ──────────────────────────────────────────────────────────

    updater,
  };
}
