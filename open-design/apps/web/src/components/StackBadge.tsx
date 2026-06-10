/**
 * StackBadge — shows the current project's tech stack.
 *
 * Displays a colored badge indicating whether the project is a Tauri
 * desktop app or a Next.js web app. Used in the project status bar
 * and workspace header.
 */

import styles from './StackBadge.module.css';

interface StackBadgeProps {
  /** The project type string (e.g., 'tauri-react', 'nextjs-standalone'). */
  projectType?: string;
  /** Compact mode — shows only the icon, no text. */
  compact?: boolean;
}

const STACK_DISPLAY: Record<string, { label: string; icon: string; className: string }> = {
  'tauri-react': { label: 'Tauri', icon: '🖥', className: styles.tauri },
  'vite-react': { label: 'Vite', icon: '⚡', className: styles.vite },
  'nextjs-standalone': { label: 'Next.js', icon: '▲', className: styles.nextjs },
  'nextjs-pages': { label: 'Next.js (Pages)', icon: '▲', className: styles.nextjs },
};

export function StackBadge({ projectType, compact = false }: StackBadgeProps) {
  if (!projectType) return null;

  const display = STACK_DISPLAY[projectType] ?? {
    label: projectType,
    icon: '📦',
    className: styles.default,
  };

  return (
    <span className={`${styles.badge} ${display.className}`}>
      <span className={styles.icon}>{display.icon}</span>
      {!compact && <span className={styles.label}>{display.label}</span>}
    </span>
  );
}
