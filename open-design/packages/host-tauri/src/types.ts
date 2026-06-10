/**
 * Tauri-specific types for the host bridge.
 *
 * These types describe the request/response shapes that flow across
 * the Tauri IPC boundary (WebView → Rust `#[tauri::command]` handlers).
 * They are intentionally kept separate from the canonical host-bridge
 * types in `@open-design/host` so that the Rust side can evolve its
 * wire format independently.
 */

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export type TauriPlatform = "windows" | "macos" | "linux" | "unknown";

// ---------------------------------------------------------------------------
// Project commands
// ---------------------------------------------------------------------------

/** Mirrors `OpenDesignHostProjectImportInit` for the IPC boundary. */
export type TauriProjectImportInit = {
  designSystemId?: string | null;
  name?: string;
  skillId?: string | null;
};

/** Successful response from the Rust `import_project` command. */
export type TauriProjectImportSuccess = {
  conversationId: string;
  entryFile: string | null;
  projectId: string;
};

/** Full result from `import_project` — success, cancel, or error. */
export type TauriProjectImportResult =
  | ({ ok: true } & TauriProjectImportSuccess)
  | { canceled: true; ok: false }
  | { ok: false; reason: string; details?: unknown };

/** Successful response from the Rust `replace_working_dir` command. */
export type TauriReplaceWorkingDirSuccess = {
  baseDir: string;
  entryFile: string | null;
};

/** Full result from `replace_working_dir`. */
export type TauriReplaceWorkingDirResult =
  | ({ ok: true } & TauriReplaceWorkingDirSuccess)
  | { canceled: true; ok: false }
  | { ok: false; reason: string; details?: unknown };

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/** Options for the Rust `capture_screenshot` command. */
export type TauriCaptureOptions = {
  clip?: { x: number; y: number; width: number; height: number };
};

/** Successful response from `capture_screenshot` — returns a data-URL string. */
export type TauriCaptureResult =
  | { dataUrl: string; h: number; ok: true; w: number }
  | { ok: false; reason: string; details?: unknown };

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Options for the Rust `print_pdf` command. */
export type TauriPdfPrintOptions = {
  deck?: boolean;
};

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

/** Options for the Rust `clear_browser_data` command. */
export type TauriBrowserClearDataOptions = {
  cookies?: boolean;
  storage?: boolean;
};

// ---------------------------------------------------------------------------
// Updater
// ---------------------------------------------------------------------------

/**
 * Subset of `OpenDesignHostUpdaterStatusSnapshot` that the Tauri Rust
 * side returns. The bridge layer is responsible for filling in any
 * fields the Rust side does not provide (e.g., deriving `supported`
 * from the presence of the updater plugin).
 */
export type TauriUpdaterStatusSnapshot = {
  arch: string;
  availableVersion?: string;
  channel: string;
  currentVersion: string;
  enabled: boolean;
  error?: { code: string; message: string; details?: unknown };
  platform: string;
  progress?: { receivedBytes: number; totalBytes?: number };
  state: string;
};
