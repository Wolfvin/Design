/**
 * Tauri environment detection utilities.
 *
 * These helpers let the bridge (and any early-boot code) determine
 * whether the web app is running inside a Tauri WebView and, if so,
 * which desktop platform the Tauri shell is running on.
 */

/**
 * Returns `true` when the current JavaScript context is executing
 * inside a Tauri WebView. Tauri v2 injects `__TAURI_INTERNALS__`
 * onto the `window` object before user code runs, so this check is
 * reliable at any point after the page loads.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Best-effort detection of the desktop OS from the WebView's
 * `navigator.userAgent`. This is used to populate the
 * `client.platform` field on the host bridge so the renderer can
 * make platform-aware UI decisions.
 *
 * The Tauri Rust side can also communicate the platform via a
 * command or an event; this JS-side detection is provided as a
 * fallback that works without an additional IPC round-trip.
 */
export function detectTauriPlatform(): "linux" | "macos" | "unknown" | "windows" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}
