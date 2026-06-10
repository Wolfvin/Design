/**
 * ProjectStatusBar — VS Code-style status bar at the bottom of the workspace.
 *
 * Displays: file path, language, line count, Vite status, git branch.
 * Color-coded Vite status indicator (green=online, red=offline, yellow=detecting).
 * Click sections for quick actions.
 */
import React, { useCallback, useMemo } from 'react';
import { useAppDeveloper } from '../../providers/app-developer-provider';
import styles from './ProjectStatusBar.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectStatusBarProps {
  /** Current project id */
  projectId: string;
  /** Currently active file path */
  activeFilePath?: string | null;
  /** Language of the active file */
  language?: string;
  /** Line count of the active file */
  lineCount?: number;
  /** Vite dev server status */
  viteStatus?: 'online' | 'offline' | 'detecting';
  /** Current git branch */
  gitBranch?: string;
  /** Additional CSS class */
  className?: string;
}

// ---------------------------------------------------------------------------
// SVG icon helpers
// ---------------------------------------------------------------------------

function GitBranchIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor" className={styles.branchIcon}>
      <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor" className={styles.icon}>
      <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z" />
    </svg>
  );
}

function FilePathIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor" className={styles.icon}>
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm0 1h5.586a1 1 0 0 1 .707.293L12.707 3.5a1 1 0 0 1 .293.707V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Vite status dot
// ---------------------------------------------------------------------------

const ViteStatusDot: React.FC<{ status: 'online' | 'offline' | 'detecting' }> = ({ status }) => {
  const dotClass = status === 'online'
    ? styles.dotOnline
    : status === 'detecting'
      ? styles.dotDetecting
      : styles.dotOffline;

  return <span className={`${styles.dot} ${dotClass}`} aria-hidden="true" />;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ProjectStatusBar: React.FC<ProjectStatusBarProps> = ({
  projectId,
  activeFilePath,
  language,
  lineCount,
  viteStatus = 'offline',
  gitBranch,
  className,
}) => {
  const devState = useAppDeveloper();

  // Resolve vite status from props or context
  const resolvedViteStatus = useMemo(() => {
    if (viteStatus !== 'offline') return viteStatus;
    if (devState.vitePort) return 'online';
    return 'offline';
  }, [viteStatus, devState.vitePort]);

  // Short file path (show just the filename)
  const shortPath = useMemo(() => {
    if (!activeFilePath) return '';
    return activeFilePath.split('/').pop() ?? activeFilePath;
  }, [activeFilePath]);

  // Handle click on Vite status → open preview or show retry
  const handleViteClick = useCallback(() => {
    if (resolvedViteStatus === 'online' && devState.vitePort) {
      window.open(`http://localhost:${devState.vitePort}`, '_blank');
    }
  }, [resolvedViteStatus, devState.vitePort]);

  // Handle click on file path → copy to clipboard
  const handlePathClick = useCallback(() => {
    if (activeFilePath) {
      navigator.clipboard.writeText(activeFilePath).catch(() => {});
    }
  }, [activeFilePath]);

  // Handle click on git branch → show branch picker (future)
  const handleBranchClick = useCallback(() => {
    // Future: open branch picker / git menu
  }, []);

  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      role="status"
      aria-label="Project status bar"
    >
      {/* Left section: file info */}
      {activeFilePath && (
        <>
          <button
            className={`${styles.item} ${styles.itemClickable}`}
            onClick={handlePathClick}
            title={activeFilePath}
            aria-label={`File: ${activeFilePath}. Click to copy path.`}
          >
            <FilePathIcon />
            <span>{shortPath}</span>
          </button>

          <span className={styles.sep} aria-hidden="true" />
        </>
      )}

      {language && (
        <>
          <div className={styles.item} aria-label={`Language: ${language}`}>
            <CodeIcon />
            <span>{language}</span>
          </div>

          <span className={styles.sep} aria-hidden="true" />
        </>
      )}

      {lineCount != null && lineCount > 0 && (
        <>
          <div className={styles.item} aria-label={`${lineCount} lines`}>
            <span>{lineCount} lines</span>
          </div>

          <span className={styles.sep} aria-hidden="true" />
        </>
      )}

      {/* Spacer */}
      <div className={styles.spacer} />

      {/* Right section: vite status, git branch, project id */}

      <button
        className={`${styles.item} ${styles.itemClickable}`}
        onClick={handleViteClick}
        title={
          resolvedViteStatus === 'online'
            ? `Vite dev server running on port ${devState.vitePort}. Click to open.`
            : resolvedViteStatus === 'detecting'
              ? 'Detecting Vite dev server...'
              : 'Vite dev server offline. Click to retry.'
        }
        aria-label={`Vite status: ${resolvedViteStatus}`}
      >
        <ViteStatusDot status={resolvedViteStatus} />
        <span>
          {resolvedViteStatus === 'online'
            ? `Vite :${devState.vitePort}`
            : resolvedViteStatus === 'detecting'
              ? 'Vite detecting...'
              : 'Vite offline'}
        </span>
      </button>

      {gitBranch && (
        <>
          <span className={styles.sep} aria-hidden="true" />

          <button
            className={`${styles.item} ${styles.itemClickable}`}
            onClick={handleBranchClick}
            title={`Git branch: ${gitBranch}`}
            aria-label={`Git branch: ${gitBranch}`}
          >
            <GitBranchIcon />
            <span>{gitBranch}</span>
          </button>
        </>
      )}

      <span className={styles.sep} aria-hidden="true" />

      <div className={styles.item} title={`Project: ${projectId}`}>
        <span>{projectId}</span>
      </div>
    </div>
  );
};

export default ProjectStatusBar;
