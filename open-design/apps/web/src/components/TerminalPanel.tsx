/**
 * TerminalPanel — Upgraded multi-session terminal component.
 *
 * Wraps the existing `TerminalViewer` component, adding:
 *   - Tab support (multiple terminal sessions)
 *   - Split terminal (side by side)
 *   - Working directory breadcrumb
 *   - Quick actions dropdown (npm run dev, build, test, custom)
 *   - Terminal session management (create, destroy, focus)
 *
 * Designed for the AppDeveloperWorkspace layout.
 * Part of the Open Design App Developer migration (Phase 3.3, GAP 3).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TerminalViewer } from './workspace/TerminalViewer';
import {
  createTerminal,
  killTerminal,
} from '../state/projects';
import styles from './TerminalPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single terminal session tracked by the panel. */
interface TerminalSession {
  /** Unique id for this tab (used as React key and tab identifier). */
  id: string;
  /** The daemon PTY session id (set once the terminal is created). */
  sessionId: string;
  /** Display label shown in the tab. */
  label: string;
  /** Working directory for this terminal. */
  workingDir: string;
  /** Whether this is the primary (left/top) or secondary (right/bottom) pane. */
  pane: 'primary' | 'secondary';
}

/** Props for the TerminalPanel component. */
export interface TerminalPanelProps {
  /** The OD project id. */
  projectId: string;
  /** Default working directory for new terminals. */
  workingDir?: string;
  /** Called when a command is executed in a terminal. */
  onCommand?: (command: string) => void;
  /** Additional CSS class. */
  className?: string;
}

/** Quick action presets. */
interface QuickAction {
  label: string;
  command: string;
  shortcut?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'npm run dev', command: 'npm run dev', shortcut: '⌘⇧R' },
  { label: 'npm run build', command: 'npm run build', shortcut: '⌘⇧B' },
  { label: 'npm test', command: 'npm test', shortcut: '⌘⇧T' },
  { label: 'npm run lint', command: 'npm run lint' },
  { label: 'npm install', command: 'npm install' },
  { label: 'git status', command: 'git status' },
];

let tabCounter = 0;

function nextTabId(): string {
  tabCounter++;
  return `term-tab-${tabCounter}`;
}

function nextTabLabel(index: number): string {
  if (index <= 1) return 'Terminal';
  return `Terminal ${index}`;
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="7" y1="2" x2="7" y2="12" />
      <line x1="2" y1="7" x2="12" y2="7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="8" y2="8" />
      <line x1="8" y1="2" x2="2" y2="8" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="12" height="12" rx="1.5" />
      <line x1="7" y1="1" x2="7" y2="13" />
    </svg>
  );
}

function ChevronIcon({ direction = 'down' }: { direction?: 'down' | 'up' }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: direction === 'up' ? 'rotate(180deg)' : undefined }}>
      <polyline points="2,4 5,7 8,4" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="12" rx="2" />
      <polyline points="4,7 6.5,9 4,11" />
      <line x1="8" y1="11" x2="12" y2="11" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <polygon points="2,1 9,5 2,9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Multi-session terminal panel with tabs, split view, and quick actions.
 *
 * @example
 * ```tsx
 * <TerminalPanel
 *   projectId={project.id}
 *   workingDir="/home/user/my-app"
 *   onCommand={(cmd) => console.log('ran:', cmd)}
 * />
 * ```
 */
export function TerminalPanel({ projectId, workingDir, onCommand, className }: TerminalPanelProps) {
  // ---- State ----
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isSplit, setIsSplit] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const quickActionsRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const sessionIdMapRef = useRef<Map<string, string>>(new Map());

  // ---- Computed ----
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeTabId) ?? null,
    [sessions, activeTabId],
  );

  const primarySessions = useMemo(
    () => sessions.filter((s) => s.pane === 'primary'),
    [sessions],
  );

  const secondarySessions = useMemo(
    () => sessions.filter((s) => s.pane === 'secondary'),
    [sessions],
  );

  const activePrimary = useMemo(
    () => primarySessions.find((s) => s.id === activeTabId)
      ?? primarySessions[0]
      ?? null,
    [primarySessions, activeTabId],
  );

  const activeSecondary = useMemo(
    () => secondarySessions.find((s) => s.id === activeTabId)
      ?? secondarySessions[0]
      ?? null,
    [secondarySessions, activeTabId],
  );

  // ---- Session Management ----

  const addSession = useCallback(async (pane: 'primary' | 'secondary' = 'primary') => {
    const id = nextTabId();
    const index = sessions.length + 1;
    const label = nextTabLabel(index);

    // Create PTY on the daemon
    let sessionId = id;
    try {
      const result = await createTerminal(projectId, {
        cwd: workingDir,
      });
      if (result?.id) {
        sessionId = result.id;
      }
    } catch {
      // Terminal creation will show unavailable state in TerminalViewer
    }

    const session: TerminalSession = {
      id,
      sessionId,
      label,
      workingDir: workingDir ?? '~',
      pane,
    };

    sessionIdMapRef.current.set(id, sessionId);
    setSessions((prev) => [...prev, session]);
    setActiveTabId(id);

    return session;
  }, [projectId, workingDir, sessions.length]);

  const removeSession = useCallback(async (tabId: string) => {
    const session = sessions.find((s) => s.id === tabId);
    if (!session) return;

    // Kill the PTY
    try {
      await killTerminal(projectId, session.sessionId, { keepalive: true });
    } catch {
      // Best-effort kill
    }

    sessionIdMapRef.current.delete(tabId);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== tabId);
      // If we removed the active tab, focus the next one
      if (activeTabId === tabId) {
        const remainingInPane = next.filter((s) => s.pane === session.pane);
        if (remainingInPane.length > 0) {
          setActiveTabId(remainingInPane[0].id);
        } else if (next.length > 0) {
          setActiveTabId(next[0].id);
        } else {
          setActiveTabId(null);
        }
      }
      return next;
    });

    // If we removed the last secondary session, exit split mode
    if (session.pane === 'secondary') {
      setSessions((prev) => {
        const secondaries = prev.filter((s) => s.pane === 'secondary');
        if (secondaries.length === 0) {
          setIsSplit(false);
        }
        return prev;
      });
    }
  }, [sessions, activeTabId, projectId]);

  const focusSession = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // ---- Split ----

  const toggleSplit = useCallback(async () => {
    if (isSplit) {
      // Exit split: remove all secondary sessions
      const toRemove = sessions.filter((s) => s.pane === 'secondary');
      for (const s of toRemove) {
        try {
          await killTerminal(projectId, s.sessionId, { keepalive: true });
        } catch { /* best-effort */ }
        sessionIdMapRef.current.delete(s.id);
      }
      setSessions((prev) => prev.filter((s) => s.pane !== 'primary'));
      setIsSplit(false);
      // Focus primary
      const primaries = sessions.filter((s) => s.pane === 'primary');
      if (primaries.length > 0) {
        setActiveTabId(primaries[0].id);
      }
    } else {
      // Enter split: create a secondary session
      setIsSplit(true);
      await addSession('secondary');
    }
  }, [isSplit, sessions, projectId, addSession]);

  // ---- Quick Actions ----

  const handleQuickAction = useCallback((command: string) => {
    // In a real integration, we'd send this to the active terminal's stdin
    // via sendTerminalStdin. For now, we notify via the callback.
    onCommand?.(command);
    setShowQuickActions(false);
  }, [onCommand]);

  const handleCustomCommand = useCallback(() => {
    if (customCommand.trim()) {
      onCommand?.(customCommand.trim());
      setCustomCommand('');
      setShowQuickActions(false);
    }
  }, [customCommand, onCommand]);

  // ---- Split Drag ----

  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  }, []);

  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.max(20, Math.min(80, ratio)));
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit]);

  // ---- Click Outside for Quick Actions ----

  useEffect(() => {
    if (!showQuickActions) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setShowQuickActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickActions]);

  // ---- Auto-create first session ----

  useEffect(() => {
    if (sessions.length === 0) {
      void addSession('primary');
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Breadcrumb ----

  const breadcrumbSegments = useMemo(() => {
    const dir = activeSession?.workingDir ?? workingDir ?? '~';
    return dir.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  }, [activeSession, workingDir]);

  // ---- Render ----

  return (
    <div className={`${styles.root} ${className ?? ''}`} data-testid="terminal-panel">
      {/* Tab Bar */}
      <div className={styles.tabBar} role="tablist" aria-label="Terminal sessions">
        {sessions.map((session) => (
          <button
            key={session.id}
            role="tab"
            className={`${styles.tabItem} ${activeTabId === session.id ? styles.tabItemActive : ''}`}
            aria-selected={activeTabId === session.id}
            onClick={() => focusSession(session.id)}
            title={session.workingDir}
          >
            <span className={styles.tabLabel}>{session.label}</span>
            <span
              className={styles.tabClose}
              role="button"
              aria-label={`Close ${session.label}`}
              onClick={(e) => {
                e.stopPropagation();
                void removeSession(session.id);
              }}
            >
              <CloseIcon />
            </span>
          </button>
        ))}

        <button
          className={styles.addTab}
          aria-label="New terminal"
          onClick={() => void addSession(isSplit && activeSession?.pane === 'secondary' ? 'secondary' : 'primary')}
          title="New terminal"
        >
          <PlusIcon />
        </button>

        <div className={styles.tabSpacer} />

        <div className={styles.tabActions}>
          <button
            className={`${styles.iconBtn} ${isSplit ? styles.iconBtnActive : ''}`}
            aria-label={isSplit ? 'Exit split view' : 'Split terminal'}
            onClick={() => void toggleSplit()}
            title={isSplit ? 'Exit split view' : 'Split terminal'}
          >
            <SplitIcon />
          </button>

          <div ref={quickActionsRef} style={{ position: 'relative' }}>
            <button
              className={styles.iconBtn}
              aria-label="Quick actions"
              onClick={() => setShowQuickActions(!showQuickActions)}
              title="Run task"
            >
              <PlayIcon />
            </button>

            {showQuickActions && (
              <div className={styles.quickActionsDropdown} role="menu" aria-label="Quick actions">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.command}
                    className={styles.quickActionItem}
                    role="menuitem"
                    onClick={() => handleQuickAction(action.command)}
                  >
                    <span className={styles.quickActionLabel}>{action.label}</span>
                    {action.shortcut && (
                      <span className={styles.quickActionShortcut}>{action.shortcut}</span>
                    )}
                  </button>
                ))}
                <div className={styles.quickActionDivider} />
                <div style={{ padding: '4px 4px 2px' }}>
                  <input
                    className={styles.customCommandInput}
                    type="text"
                    placeholder="Custom command…"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomCommand();
                      if (e.key === 'Escape') setShowQuickActions(false);
                    }}
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Working Directory Breadcrumb */}
      {breadcrumbSegments.length > 0 && (
        <div className={styles.breadcrumb} aria-label="Working directory">
          {breadcrumbSegments.map((segment, i) => (
            <span key={`${segment}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span className={styles.breadcrumbSep}>/</span>}
              <span className={styles.breadcrumbSegment}>{segment}</span>
            </span>
          ))}
        </div>
      )}

      {/* Terminal Content */}
      <div className={styles.content}>
        {!isSplit ? (
          /* Single terminal */
          <div className={styles.contentSingle}>
            {activeSession ? (
              <TerminalViewer
                terminalId={activeSession.sessionId}
                projectId={projectId}
                onClose={() => void removeSession(activeSession.id)}
                onSessionIdChange={(tabId, newSessionId) => {
                  sessionIdMapRef.current.set(tabId, newSessionId);
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === tabId ? { ...s, sessionId: newSessionId } : s,
                    ),
                  );
                }}
              />
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><TerminalIcon /></span>
                <span className={styles.emptyText}>No terminal sessions</span>
                <button
                  className={styles.emptyAction}
                  onClick={() => void addSession('primary')}
                >
                  <PlusIcon /> New Terminal
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Split terminal */
          <div
            ref={splitContainerRef}
            className={styles.contentSplit}
            style={{ '--split-ratio': `${splitRatio}%` } as React.CSSProperties}
          >
            <div
              className={styles.splitPane}
              style={{ flex: `0 0 ${splitRatio}%` }}
            >
              {activePrimary ? (
                <TerminalViewer
                  terminalId={activePrimary.sessionId}
                  projectId={projectId}
                  onClose={() => void removeSession(activePrimary.id)}
                  onSessionIdChange={(tabId, newSessionId) => {
                    sessionIdMapRef.current.set(tabId, newSessionId);
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === tabId ? { ...s, sessionId: newSessionId } : s,
                      ),
                    );
                  }}
                />
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyText}>No primary terminal</span>
                </div>
              )}
            </div>

            <div
              className={`${styles.splitHandle} ${isDraggingSplit ? styles.splitHandleDragging : ''}`}
              onMouseDown={handleSplitMouseDown}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={splitRatio}
              aria-valuemin={20}
              aria-valuemax={80}
              aria-label="Resize terminal panes"
            />

            <div className={styles.splitPane}>
              {activeSecondary ? (
                <TerminalViewer
                  terminalId={activeSecondary.sessionId}
                  projectId={projectId}
                  onClose={() => void removeSession(activeSecondary.id)}
                  onSessionIdChange={(tabId, newSessionId) => {
                    sessionIdMapRef.current.set(tabId, newSessionId);
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === tabId ? { ...s, sessionId: newSessionId } : s,
                      ),
                    );
                  }}
                />
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyText}>No secondary terminal</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
