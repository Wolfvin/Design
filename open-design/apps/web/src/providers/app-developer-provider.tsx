/**
 * app-developer-provider — React context provider for app developer state.
 *
 * Manages:
 *   - Current project type (tauri-react, nextjs, vite-react, etc.)
 *   - Vite port for HMR preview
 *   - Recently edited files
 *   - Auto-apply file edits toggle
 *   - Backup-before-edit toggle
 *
 * Persists to localStorage keyed by project id so settings survive page reloads.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State managed by the AppDeveloperProvider */
export interface AppDeveloperState {
  /** Current project type (auto-detected or user-set) */
  projectType: string | null;
  /** Vite port for HMR preview */
  vitePort: number | null;
  /** Recently edited file paths (most recent first, max 50) */
  recentEdits: string[];
  /** Whether to auto-apply file edits without confirmation */
  autoApply: boolean;
  /** Whether to create .bak backups before editing files */
  backupBeforeEdit: boolean;
}

/** Context value: state + setters */
export interface AppDeveloperContextValue extends AppDeveloperState {
  /** Set the detected or user-chosen project type */
  setProjectType: (type: string) => void;
  /** Set the Vite dev server port */
  setVitePort: (port: number) => void;
  /** Add a file path to the recent edits list */
  addRecentEdit: (path: string) => void;
  /** Toggle auto-apply for file edits */
  setAutoApply: (value: boolean) => void;
  /** Toggle backup-before-edit */
  setBackupBeforeEdit: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const MAX_RECENT_EDITS = 50;

const DEFAULT_STATE: AppDeveloperState = {
  projectType: null,
  vitePort: null,
  recentEdits: [],
  autoApply: false,
  backupBeforeEdit: true,
};

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

function storageKey(projectId: string): string {
  return `open-design:app-dev:${projectId}`;
}

function loadState(projectId: string): AppDeveloperState {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<AppDeveloperState>;
    return {
      projectType: parsed.projectType ?? DEFAULT_STATE.projectType,
      vitePort: parsed.vitePort ?? DEFAULT_STATE.vitePort,
      recentEdits: Array.isArray(parsed.recentEdits)
        ? parsed.recentEdits.slice(0, MAX_RECENT_EDITS)
        : DEFAULT_STATE.recentEdits,
      autoApply: parsed.autoApply ?? DEFAULT_STATE.autoApply,
      backupBeforeEdit: parsed.backupBeforeEdit ?? DEFAULT_STATE.backupBeforeEdit,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(projectId: string, state: AppDeveloperState): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(state));
  } catch {
    // localStorage may be full or unavailable; degrade gracefully
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const AppDeveloperContext = createContext<AppDeveloperContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface AppDeveloperProviderProps {
  children: React.ReactNode;
  /** Project id — used to scope persisted state */
  projectId: string;
  /** Initial project type override (e.g. from daemon detection) */
  initialProjectType?: string;
  /** Initial Vite port override (e.g. from daemon detection) */
  initialVitePort?: number;
}

export const AppDeveloperProvider: React.FC<AppDeveloperProviderProps> = ({
  children,
  projectId,
  initialProjectType,
  initialVitePort,
}) => {
  // Load persisted state on mount
  const [state, setState] = useState<AppDeveloperState>(() => {
    const loaded = loadState(projectId);
    // Apply overrides from props (e.g. daemon-detected values)
    if (initialProjectType && !loaded.projectType) {
      loaded.projectType = initialProjectType;
    }
    if (initialVitePort != null && loaded.vitePort == null) {
      loaded.vitePort = initialVitePort;
    }
    return loaded;
  });

  // Persist state to localStorage on every change
  const projectIdRef = useRef(projectId);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    saveState(projectIdRef.current, state);
  }, [state]);

  // Re-load state when projectId changes (switching projects)
  useEffect(() => {
    const loaded = loadState(projectId);
    if (initialProjectType && !loaded.projectType) {
      loaded.projectType = initialProjectType;
    }
    if (initialVitePort != null && loaded.vitePort == null) {
      loaded.vitePort = initialVitePort;
    }
    setState(loaded);
  }, [projectId, initialProjectType, initialVitePort]);

  // --- Setters ---

  const setProjectType = useCallback((type: string) => {
    setState((prev) => ({ ...prev, projectType: type }));
  }, []);

  const setVitePort = useCallback((port: number) => {
    setState((prev) => ({ ...prev, vitePort: port }));
  }, []);

  const addRecentEdit = useCallback((path: string) => {
    setState((prev) => {
      // Remove if already in the list, then prepend
      const filtered = prev.recentEdits.filter((p) => p !== path);
      return {
        ...prev,
        recentEdits: [path, ...filtered].slice(0, MAX_RECENT_EDITS),
      };
    });
  }, []);

  const setAutoApply = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, autoApply: value }));
  }, []);

  const setBackupBeforeEdit = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, backupBeforeEdit: value }));
  }, []);

  // --- Context value ---

  const contextValue = useMemo<AppDeveloperContextValue>(
    () => ({
      ...state,
      setProjectType,
      setVitePort,
      addRecentEdit,
      setAutoApply,
      setBackupBeforeEdit,
    }),
    [state, setProjectType, setVitePort, addRecentEdit, setAutoApply, setBackupBeforeEdit],
  );

  return (
    <AppDeveloperContext.Provider value={contextValue}>
      {children}
    </AppDeveloperContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useAppDeveloper — access the app developer context.
 *
 * Must be used within an <AppDeveloperProvider>.
 * Falls back to a no-op context if no provider is present, so components
 * can still render (with default values) when used outside the provider.
 */
export function useAppDeveloper(): AppDeveloperContextValue {
  const ctx = useContext(AppDeveloperContext);
  // Return a safe fallback if no provider is present — this lets components
  // like ProjectStatusBar render in isolation during development.
  if (ctx) return ctx;
  return {
    ...DEFAULT_STATE,
    setProjectType: () => {},
    setVitePort: () => {},
    addRecentEdit: () => {},
    setAutoApply: () => {},
    setBackupBeforeEdit: () => {},
  };
}

export default AppDeveloperProvider;
