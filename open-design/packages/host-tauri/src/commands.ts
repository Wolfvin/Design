/**
 * Tauri IPC command wrappers.
 *
 * Every function in this module calls exactly one Tauri `invoke()`
 * (or a Tauri plugin API) and returns the raw result. Normalisation
 * into the `@open-design/host` contract shapes is done in `bridge.ts`.
 *
 * All Tauri APIs are imported lazily so the module can be loaded in
 * non-Tauri environments (e.g. during SSR or unit tests) without
 * throwing — the actual calls are only made when the bridge is
 * installed, which itself guards on `isTauriEnvironment()`.
 */

import type {
  TauriBrowserClearDataOptions,
  TauriCaptureOptions,
  TauriPdfPrintOptions,
  TauriProjectImportInit,
  TauriProjectImportResult,
  TauriReplaceWorkingDirResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Lazy Tauri API access
// ---------------------------------------------------------------------------

/**
 * Dynamically import `@tauri-apps/api/core` and return its `invoke`
 * function. Using a dynamic import ensures the module can be analysed
 * in non-Tauri environments without a hard dependency failure.
 */
async function getInvoke(): Promise<typeof import("@tauri-apps/api/core").invoke> {
  const core = await import("@tauri-apps/api/core");
  return core.invoke;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/**
 * Open a URL in the user's default browser / handler using the
 * `@tauri-apps/plugin-shell` plugin.
 */
export async function shellOpenExternal(url: string): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}

/**
 * Ask the Rust backend to reveal a project's working directory in the
 * OS file manager.
 */
export async function shellOpenPath(projectId: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke("open_in_editor", { projectId });
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

export async function clearBrowserData(
  options?: TauriBrowserClearDataOptions,
): Promise<void> {
  const invoke = await getInvoke();
  await invoke("clear_browser_data", { options: options ?? null });
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export async function captureScreenshot(
  options?: TauriCaptureOptions,
): Promise<string> {
  const invoke = await getInvoke();
  // Returns a data-URL string from the Rust side.
  return await invoke<string>("capture_screenshot", {
    options: options ?? null,
  });
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/**
 * Open a native folder-picker dialog (via `@tauri-apps/plugin-dialog`)
 * and then invoke the Rust `import_project` command with the selected
 * path.
 */
export async function pickAndImportProject(
  init?: TauriProjectImportInit,
): Promise<TauriProjectImportResult> {
  const dialog = await import("@tauri-apps/plugin-dialog");
  const selected = await dialog.open({ directory: true, multiple: false });
  if (selected === null) {
    return { canceled: true, ok: false };
  }
  // `dialog.open` returns `string | string[] | null` for directory mode.
  const path = Array.isArray(selected) ? selected[0] : selected;
  if (path == null) {
    return { canceled: true, ok: false };
  }

  const invoke = await getInvoke();
  return await invoke<TauriProjectImportResult>("import_project", {
    path,
    init: init ?? null,
  });
}

/**
 * Open a native folder-picker and invoke `replace_working_dir` with the
 * chosen path and the given project ID.
 */
export async function pickAndReplaceWorkingDir(
  projectId: string,
): Promise<TauriReplaceWorkingDirResult> {
  const dialog = await import("@tauri-apps/plugin-dialog");
  const selected = await dialog.open({ directory: true, multiple: false });
  if (selected === null) {
    return { canceled: true, ok: false };
  }
  const path = Array.isArray(selected) ? selected[0] : selected;
  if (path == null) {
    return { canceled: true, ok: false };
  }

  const invoke = await getInvoke();
  return await invoke<TauriReplaceWorkingDirResult>("replace_working_dir", {
    projectId,
    path,
  });
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function printPdf(
  html: string,
  nonce?: string,
  options?: TauriPdfPrintOptions,
): Promise<void> {
  const invoke = await getInvoke();
  await invoke("print_pdf", {
    html,
    nonce: nonce ?? null,
    options: options ?? null,
  });
}

// ---------------------------------------------------------------------------
// Updater
// ---------------------------------------------------------------------------

/**
 * Check for an update using `@tauri-apps/plugin-updater`.
 * Returns the update object if one is available, or `null`.
 */
export async function updaterCheck(): Promise<unknown> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    return await check();
  } catch {
    return null;
  }
}

/**
 * Download the available update using `@tauri-apps/plugin-updater`.
 */
export async function updaterDownload(
  update: unknown,
  onProgress?: (progress: { downloaded: number; total?: number }) => void,
): Promise<void> {
  if (update == null || typeof update !== "object" || !("download" in update)) {
    return;
  }
  const updateObj = update as { download: (onProgress?: (progress: { downloaded: number; total?: number }) => void) => Promise<void> };
  await updateObj.download(onProgress);
}

/**
 * Install a downloaded update using `@tauri-apps/plugin-updater`.
 */
export async function updaterInstall(update: unknown): Promise<void> {
  if (update == null || typeof update !== "object" || !("install" in update)) {
    return;
  }
  const updateObj = update as { install: () => Promise<void> };
  await updateObj.install();
}

/**
 * Quit and relaunch the app to apply an installed update.
 */
export async function updaterQuitAndInstall(): Promise<void> {
  const invoke = await getInvoke();
  await invoke("updater_quit_and_install");
}
