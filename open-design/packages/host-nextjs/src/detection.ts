/**
 * Next.js Host Bridge — environment detection.
 *
 * Determines whether the OD web app is running inside a Next.js project
 * context (as opposed to Tauri, Electron, or standalone browser).
 */

/** Supported platforms for the Next.js host bridge. */
export type NextjsPlatform = 'web' | 'pwa';

/**
 * Detect whether the current environment is a Next.js project context.
 *
 * In practice this is always `true` when this package is used, because
 * the Next.js bridge is only installed for Next.js projects. The function
 * exists for symmetry with the Tauri bridge's `isTauriEnvironment()`.
 */
export function isNextjsEnvironment(): boolean {
  // If the host-nextjs bridge code is executing, we are in a Next.js
  // project context. The OD web app installs this bridge only when the
  // project type is detected as nextjs-standalone or nextjs-pages.
  return typeof window !== 'undefined';
}

/**
 * Detect the runtime platform for the Next.js host bridge.
 *
 * Returns 'pwa' if the app is running as an installed PWA, 'web' otherwise.
 */
export function detectNextjsPlatform(): NextjsPlatform {
  if (typeof window === 'undefined') return 'web';

  // Check if running as an installed PWA (standalone display mode)
  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return 'pwa';
  }

  // iOS Safari PWA detection
  if ('standalone' in navigator && (navigator as any).standalone === true) {
    return 'pwa';
  }

  return 'web';
}

/**
 * Detect the OS locale from the browser.
 */
export function detectNextjsLocale(): string {
  if (typeof navigator === 'undefined') return 'en-US';
  return navigator.language || 'en-US';
}
