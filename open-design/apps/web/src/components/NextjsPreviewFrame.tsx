/**
 * NextjsPreviewFrame — iframe-based preview for Next.js projects.
 *
 * Renders a Next.js app inside an iframe pointing to the dev server
 * URL. Handles:
 *   - Server reachability check with loading state
 *   - Restart notification (after middleware/config changes)
 *   - Error state when server is not reachable
 *   - Responsive iframe sizing
 */

import { useRef, useEffect, useState } from 'react';
import type { NextjsPreviewState } from '../providers/nextjs-preview';
import styles from './NextjsPreviewFrame.module.css';

interface NextjsPreviewFrameProps {
  /** The Next.js preview state from useNextjsPreview(). */
  state: NextjsPreviewState;
  /** Optional class name for the container. */
  className?: string;
}

export function NextjsPreviewFrame({ state, className }: NextjsPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // Force iframe reload when server comes back online
  useEffect(() => {
    if (state.serverOnline && state.previewUrl) {
      setIframeKey((k) => k + 1);
    }
  }, [state.serverOnline, state.previewUrl]);

  // ----- Render states -----

  if (state.checking && !state.serverOnline) {
    return (
      <div className={`${styles.container} ${className ?? ''}`}>
        <div className={styles.statusOverlay}>
          <div className={styles.spinner} />
          <p className={styles.statusText}>Checking Next.js dev server...</p>
        </div>
      </div>
    );
  }

  if (!state.serverOnline) {
    return (
      <div className={`${styles.container} ${className ?? ''}`}>
        <div className={styles.statusOverlay}>
          <p className={styles.errorIcon}>▲</p>
          <p className={styles.statusText}>Next.js dev server not running</p>
          <p className={styles.statusHint}>
            Start the dev server with <code>npm run dev</code> on port {state.port}
          </p>
          <button className={styles.retryButton} onClick={state.checkServer}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state.requiresRestart) {
    return (
      <div className={`${styles.container} ${className ?? ''}`}>
        <div className={styles.restartBanner}>
          <span className={styles.restartIcon}>⚠️</span>
          <span>Middleware or config changed — restart required</span>
          <button className={styles.restartButton} onClick={state.restartServer}>
            Restart Server
          </button>
        </div>
        {state.previewUrl && (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            className={styles.iframe}
            src={state.previewUrl}
            title="Next.js Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      {state.previewUrl && (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          className={styles.iframe}
          src={state.previewUrl}
          title="Next.js Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  );
}
