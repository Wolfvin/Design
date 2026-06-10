/**
 * VitePreview — Live preview component powered by Vite HMR.
 *
 * Renders an `<iframe>` that connects to the user's running Vite dev server.
 * When AI edits files via `<file-edit>`, Vite's filesystem watcher detects
 * changes and triggers HMR — instant visual update. This replaces the old
 * `iframe srcdoc` preview.
 *
 * Features:
 *   - Viewport controls: Desktop (1280px), Tablet (768px), Mobile (375px)
 *   - Scale-to-fit option
 *   - URL bar showing current preview URL
 *   - Refresh button + external open button
 *   - Connection status indicator (green/red dot)
 *   - Offline state with "Start Vite" guidance
 *   - Loading spinner during port detection
 *   - Manual port override
 *
 * Part of the Open Design App Developer migration (Phase 3-B).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVitePreview, type VitePreviewState } from '../providers/vite-preview';
import { openExternalUrl } from '../providers/registry';
import styles from './VitePreview.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VitePreviewProps {
  /** The OD project ID to preview. */
  projectId: string;
  /** Optional additional CSS class name for the root element. */
  className?: string;
}

/** Viewport size presets. */
type ViewportSize = 'desktop' | 'tablet' | 'mobile';

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

/** Refresh/reload icon. */
function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8a5.5 5.5 0 0 1 9.3-3.95M13.5 8a5.5 5.5 0 0 1-9.3 3.95" />
      <path d="M12 1.5v3h-3M4 14.5v-3h3" />
    </svg>
  );
}

/** External link icon. */
function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h7v7M13 3L6 10" />
      <path d="M3 6v7h7" />
    </svg>
  );
}

/** Monitor/desktop icon. */
function DesktopIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5" />
      <path d="M5.5 14h5M8 11v3" />
    </svg>
  );
}

/** Tablet icon. */
function TabletIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
      <circle cx="8" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Mobile phone icon. */
function MobileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" />
      <circle cx="8" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Lock icon for URL bar. */
function LockIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="7" height="5" rx="1" />
      <path d="M4 5V3.5a2 2 0 0 1 4 0V5" />
    </svg>
  );
}

/** Offline/server icon. */
function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="6" rx="2" />
      <rect x="3" y="15" width="18" height="6" rx="2" />
      <circle cx="7" cy="6" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Terminal/command line icon. */
function TerminalIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v10H2z" rx="1" />
      <path d="M5 7l2 2-2 2M9 11h2" />
    </svg>
  );
}

/** Expand/scale icon. */
function ScaleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10v4h4M14 6V2h-4M2 14l5-5M14 2l-5 5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Vite-powered live preview component.
 *
 * Renders an iframe connected to the Vite dev server with full toolbar
 * controls for viewport sizing, refresh, and server status.
 */
export function VitePreview({ projectId, className }: VitePreviewProps) {
  const preview: VitePreviewState = useVitePreview(projectId);
  const {
    previewUrl,
    vitePort,
    serverOnline,
    detecting,
    error,
    refresh,
    setPort,
    refreshKey,
  } = preview;

  // --- Viewport state ---
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [scaleToFit, setScaleToFit] = useState(false);
  const [portInput, setPortInput] = useState(String(vitePort));
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync port input when vitePort changes
  useEffect(() => {
    setPortInput(String(vitePort));
  }, [vitePort]);

  // --- Scale-to-fit calculation ---
  const scaleContainerRef = useRef<HTMLDivElement>(null);
  const [scaleTransform, setScaleTransform] = useState(1);

  useEffect(() => {
    if (!scaleToFit || !scaleContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const containerHeight = entry.contentRect.height;
        const baseWidth = 1280;
        const baseHeight = 900;

        const scaleX = containerWidth / baseWidth;
        const scaleY = containerHeight / baseHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        setScaleTransform(scale);
      }
    });

    observer.observe(scaleContainerRef.current);
    return () => observer.disconnect();
  }, [scaleToFit]);

  // --- Actions ---
  const handleOpenExternal = useCallback(() => {
    openExternalUrl(previewUrl);
  }, [previewUrl]);

  const handlePortSubmit = useCallback(() => {
    const port = parseInt(portInput, 10);
    if (port > 0 && port < 65536) {
      setPort(port);
    }
  }, [portInput, setPort]);

  const handlePortKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handlePortSubmit();
      }
    },
    [handlePortSubmit],
  );

  // --- Viewport switch ---
  const setDesktop = useCallback(() => {
    setViewport('desktop');
    setScaleToFit(false);
  }, []);
  const setTablet = useCallback(() => {
    setViewport('tablet');
    setScaleToFit(false);
  }, []);
  const setMobile = useCallback(() => {
    setViewport('mobile');
    setScaleToFit(false);
  }, []);
  const toggleScale = useCallback(() => {
    setScaleToFit((prev) => !prev);
  }, []);

  // --- iframe sandbox attributes ---
  const sandboxAttrs = 'allow-scripts allow-same-origin allow-forms allow-popups';

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* ---- Toolbar ---- */}
      <div className={styles.toolbar}>
        {/* Left: status + viewport controls */}
        <div className={styles.toolbarLeft}>
          <div
            className={styles.statusDot}
            data-online={serverOnline ? 'true' : 'false'}
            data-detecting={detecting ? 'true' : 'false'}
            title={
              detecting
                ? 'Detecting Vite server…'
                : serverOnline
                  ? 'Vite server online'
                  : 'Vite server offline'
            }
          />

          {/* Viewport size controls */}
          <div className={styles.viewportControls}>
            <button
              className={styles.viewportBtn}
              data-active={viewport === 'desktop' && !scaleToFit ? 'true' : undefined}
              onClick={setDesktop}
              title="Desktop (1280px)"
              aria-label="Desktop viewport"
            >
              <DesktopIcon />
            </button>
            <button
              className={styles.viewportBtn}
              data-active={viewport === 'tablet' && !scaleToFit ? 'true' : undefined}
              onClick={setTablet}
              title="Tablet (768px)"
              aria-label="Tablet viewport"
            >
              <TabletIcon />
            </button>
            <button
              className={styles.viewportBtn}
              data-active={viewport === 'mobile' && !scaleToFit ? 'true' : undefined}
              onClick={setMobile}
              title="Mobile (375px)"
              aria-label="Mobile viewport"
            >
              <MobileIcon />
            </button>
            <button
              className={styles.viewportBtn}
              data-active={scaleToFit ? 'true' : undefined}
              onClick={toggleScale}
              title="Scale to fit"
              aria-label="Scale to fit"
            >
              <ScaleIcon />
            </button>
          </div>
        </div>

        {/* Center: URL bar */}
        <div className={styles.toolbarCenter}>
          <div className={styles.urlBar}>
            <span className={styles.urlLockIcon}>
              <LockIcon />
            </span>
            <span className={styles.urlText} title={previewUrl}>
              localhost:{vitePort}
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div className={styles.toolbarRight}>
          {/* Port input */}
          <input
            className={styles.portInput}
            type="number"
            min={1}
            max={65535}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            onKeyDown={handlePortKeyDown}
            onBlur={handlePortSubmit}
            aria-label="Vite port"
            title="Vite dev server port"
          />

          {/* Refresh */}
          <button
            className={styles.btn}
            onClick={refresh}
            disabled={detecting}
            title="Refresh preview"
            aria-label="Refresh preview"
          >
            <RefreshIcon />
          </button>

          {/* Open in system browser */}
          <button
            className={styles.btn}
            onClick={handleOpenExternal}
            disabled={!serverOnline}
            title="Open in browser"
            aria-label="Open in system browser"
          >
            <ExternalIcon />
          </button>
        </div>
      </div>

      {/* ---- Viewport ---- */}
      {scaleToFit ? (
        <div className={styles.viewportScale} ref={scaleContainerRef}>
          <div
            className={styles.viewportScaleInner}
            style={{ transform: `scale(${scaleTransform})` }}
          >
            <iframe
              key={refreshKey}
              ref={iframeRef}
              src={previewUrl}
              sandbox={sandboxAttrs}
              className={styles.iframe}
              title="Vite Preview"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>
      ) : (
        <div className={`${styles.viewport} ${styles.viewportPad}`}>
          <div className={styles.iframeWrapper} data-viewport={viewport}>
            <iframe
              key={refreshKey}
              ref={iframeRef}
              src={previewUrl}
              sandbox={sandboxAttrs}
              className={styles.iframe}
              title="Vite Preview"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>
      )}

      {/* ---- Offline overlay ---- */}
      {!serverOnline && !detecting && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.overlayIcon} data-variant="offline">
              <ServerIcon />
            </div>
            <h3 className={styles.overlayTitle}>Vite server is not running</h3>
            <p className={styles.overlayDescription}>
              Start your Vite dev server to see a live preview. The preview will
              automatically connect once the server is online.
            </p>
            {error && (
              <p className={styles.overlayDescription} style={{ color: 'var(--red)' }}>
                {error}
              </p>
            )}
            <div className={styles.overlayActions}>
              <button className={styles.overlayBtn} onClick={handleOpenExternal}>
                <TerminalIcon />
                Start Vite
              </button>
              <button className={styles.overlayBtnSecondary} onClick={refresh}>
                <RefreshIcon />
                Retry
              </button>
            </div>
            <p className={styles.overlayDescription} style={{ fontSize: '12px' }}>
              Run <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-fill-tertiary)', padding: '1px 5px', borderRadius: '3px' }}>npm run dev</code> or <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-fill-tertiary)', padding: '1px 5px', borderRadius: '3px' }}>bun dev</code> in your project directory
            </p>
          </div>
        </div>
      )}

      {/* ---- Detecting overlay ---- */}
      {detecting && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.overlayIcon} data-variant="detecting">
              <div className={styles.spinner} />
            </div>
            <h3 className={styles.overlayTitle}>Detecting Vite server…</h3>
            <p className={styles.overlayDescription}>
              Looking for your Vite configuration to determine the dev server port.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
