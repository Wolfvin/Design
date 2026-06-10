/**
 * Next.js / browser environment detection utilities.
 *
 * These helpers determine whether the OD web app is running in a
 * browser context where the Next.js host bridge should be used
 * (as opposed to Tauri or Electron).
 */

/**
 * Returns `true` when running in a standard browser environment
 * and NOT inside a Tauri WebView or Electron renderer.
 */
export function isBrowserEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  // Tauri injects __TAURI_INTERNALS__
  if ('__TAURI_INTERNALS__' in window) return false;
  // Electron injects process.versions.electron
  if (typeof process !== 'undefined' && process?.versions?.electron) return false;
  return true;
}

/**
 * Best-effort detection of the desktop OS from the browser's
 * navigator.userAgent. Used to populate `client.platform`.
 */
export function detectBrowserPlatform(): 'linux' | 'macos' | 'unknown' | 'windows' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}
