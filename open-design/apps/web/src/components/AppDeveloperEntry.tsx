/**
 * AppDeveloperEntry — Developer-focused home/entry view.
 *
 * Replaces the design-centric EntryShell with a VS Code-like start screen:
 *   - Hero: "Open Design — App Developer"
 *   - Quick actions: Import, Open Recent, New from Template
 *   - Recent projects list with type badges (Tauri, Next.js, Vite, etc.)
 *   - No design-system-centric elements
 */
import React, { useCallback, useMemo } from 'react';
import type { Project } from '@open-design/contracts';
import styles from './AppDeveloperEntry.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppDeveloperEntryProps {
  /** Recent projects to display */
  recentProjects: Project[];
  /** Callback to create/open a project */
  onOpenProject: (projectId: string) => void;
  /** Callback to import an existing project folder */
  onImportProject: () => void;
  /** Callback to open settings */
  onOpenSettings: () => void;
  /** Callback to create a new project from template */
  onNewFromTemplate?: () => void;
  /** Additional CSS class */
  className?: string;
}

// ---------------------------------------------------------------------------
// Project type detection → badge config
// ---------------------------------------------------------------------------

type ProjectTypeBadge = 'tauri' | 'nextjs' | 'vite' | 'unknown';

interface BadgeStyle {
  className: string;
  label: string;
  icon: string;
}

const BADGE_STYLES: Record<ProjectTypeBadge, BadgeStyle> = {
  tauri: { className: styles.badgeTauri, label: 'Tauri', icon: '🖥️' },
  nextjs: { className: styles.badgeNextjs, label: 'Next.js', icon: '▲' },
  vite: { className: styles.badgeVite, label: 'Vite', icon: '⚡' },
  unknown: { className: styles.badgeUnknown, label: 'Project', icon: '📁' },
};

function detectProjectTypeBadge(project: Project): BadgeStyle {
  // Check project metadata for tech stack hints
  const meta = project as Record<string, unknown>;
  const techStack = meta?.techStack as string | undefined;
  const projectType = meta?.projectType as string | undefined;

  if (projectType === 'tauri-react' || techStack?.toLowerCase().includes('tauri')) {
    return BADGE_STYLES.tauri;
  }
  if (projectType === 'nextjs' || techStack?.toLowerCase().includes('next')) {
    return BADGE_STYLES.nextjs;
  }
  if (
    projectType === 'vite-react' ||
    projectType === 'vite-vue' ||
    techStack?.toLowerCase().includes('vite')
  ) {
    return BADGE_STYLES.vite;
  }
  return BADGE_STYLES.unknown;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// SVG icon helpers
// ---------------------------------------------------------------------------

function ImportIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
      <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.222C6.374 3.714 5.82 3.5 5.264 3.5H2.5z" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
    </svg>
  );
}

function EmptyFolderIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.4 }}>
      <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3H13.5a2 2 0 0 1 2 2.5l-.54 4A2 2 0 0 1 13 11H3a2 2 0 0 1-1.96-1.63L.54 3.87z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AppDeveloperEntry: React.FC<AppDeveloperEntryProps> = ({
  recentProjects,
  onOpenProject,
  onImportProject,
  onOpenSettings,
  onNewFromTemplate,
  className,
}) => {
  // Sort projects by most recent first
  const sortedProjects = useMemo(
    () =>
      [...recentProjects].sort((a, b) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      }),
    [recentProjects],
  );

  // Handle keyboard navigation on project cards
  const handleProjectKeyDown = useCallback(
    (e: React.KeyboardEvent, projectId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpenProject(projectId);
      }
    },
    [onOpenProject],
  );

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* ---- Hero ---- */}
      <section className={styles.hero}>
        <div className={styles.heroLogo} aria-hidden="true">
          {'</>'}
        </div>
        <h1 className={styles.heroTitle}>
          Open Design — App Developer
        </h1>
        <p className={styles.heroSubtitle}>
          Build, edit, and preview full-stack applications with AI-powered
          file editing, live Vite HMR preview, and integrated terminal.
        </p>
        <span className={styles.heroBadge}>
          Developer Mode
        </span>
      </section>

      {/* ---- Quick actions ---- */}
      <section className={styles.quickActions} aria-label="Quick actions">
        <button
          className={`${styles.quickAction} ${styles.quickActionPrimary}`}
          onClick={onImportProject}
          aria-label="Import an existing project folder"
        >
          <span className={styles.quickActionIcon}><ImportIcon /></span>
          <span>
            <span className={styles.quickActionLabel}>Import Project</span>
            <span className={styles.quickActionDesc}>
              Open an existing folder on disk
            </span>
          </span>
        </button>

        {sortedProjects.length > 0 && (
          <button
            className={styles.quickAction}
            onClick={() => {
              // Open the most recent project
              const mostRecent = sortedProjects[0];
              if (mostRecent) onOpenProject(mostRecent.id);
            }}
            aria-label="Open most recent project"
          >
            <span className={styles.quickActionIcon}><OpenIcon /></span>
            <span>
              <span className={styles.quickActionLabel}>Open Recent</span>
              <span className={styles.quickActionDesc}>
                {sortedProjects[0]?.name ?? 'Continue where you left off'}
              </span>
            </span>
          </button>
        )}

        {onNewFromTemplate && (
          <button
            className={styles.quickAction}
            onClick={onNewFromTemplate}
            aria-label="Create a new project from template"
          >
            <span className={styles.quickActionIcon}><TemplateIcon /></span>
            <span>
              <span className={styles.quickActionLabel}>New from Template</span>
              <span className={styles.quickActionDesc}>
                Start with Tauri, Next.js, or Vite
              </span>
            </span>
          </button>
        )}

        <button
          className={styles.quickAction}
          onClick={onOpenSettings}
          aria-label="Open developer settings"
        >
          <span className={styles.quickActionIcon}><SettingsIcon /></span>
          <span>
            <span className={styles.quickActionLabel}>Settings</span>
            <span className={styles.quickActionDesc}>
              Configure provider, terminal, and file edit options
            </span>
          </span>
        </button>
      </section>

      {/* ---- Recent projects ---- */}
      <section className={styles.section} aria-label="Recent projects">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Projects</h2>
          {sortedProjects.length > 0 && (
            <span className={styles.sectionCount}>{sortedProjects.length}</span>
          )}
        </div>

        {sortedProjects.length > 0 ? (
          <div className={styles.projectList} role="list">
            {sortedProjects.map((project) => {
              const badge = detectProjectTypeBadge(project);
              const relativeTime = project.updatedAt
                ? formatRelativeTime(project.updatedAt)
                : '';

              return (
                <div
                  key={project.id}
                  className={styles.projectCard}
                  role="listitem"
                  tabIndex={0}
                  onClick={() => onOpenProject(project.id)}
                  onKeyDown={(e) => handleProjectKeyDown(e, project.id)}
                  aria-label={`Open project ${project.name}`}
                >
                  <div className={styles.projectIcon} aria-hidden="true">
                    {badge.icon}
                  </div>
                  <div className={styles.projectInfo}>
                    <div className={styles.projectName}>
                      {project.name}
                    </div>
                    <div className={styles.projectPath}>
                      {project.id}
                    </div>
                  </div>
                  <div className={styles.projectMeta}>
                    <span className={`${styles.projectTypeBadge} ${badge.className}`}>
                      {badge.label}
                    </span>
                    {relativeTime && (
                      <span className={styles.projectTime}>
                        {relativeTime}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon} aria-hidden="true">
              <EmptyFolderIcon />
            </div>
            <p className={styles.emptyStateText}>
              No projects yet. Import an existing project folder or create one
              from a template to get started.
            </p>
            <button
              className={styles.emptyStateAction}
              onClick={onImportProject}
            >
              <ImportIcon />
              Import Project
            </button>
          </div>
        )}
      </section>

      {/* ---- Footer ---- */}
      <footer className={styles.footer}>
        <span>Open Design — App Developer Mode</span>
        <button
          className={styles.footerLink}
          onClick={onOpenSettings}
        >
          Settings
        </button>
        <span aria-hidden="true">·</span>
        <span>⌘B Toggle Explorer · ⌘J Toggle Preview</span>
      </footer>
    </div>
  );
};

export default AppDeveloperEntry;
