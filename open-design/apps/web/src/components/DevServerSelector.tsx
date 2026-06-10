/**
 * DevServerSelector — switch between Vite HMR and Next.js Fast Refresh preview.
 *
 * Shows the current dev server type and allows the user to switch modes.
 * The selector persists the choice to localStorage.
 */

import { useCallback, useEffect, useState } from 'react';
import type { DevServerType } from '../providers/dev-port-detector';
import styles from './DevServerSelector.module.css';

interface DevServerSelectorProps {
  projectId: string;
  currentType: DevServerType;
  onTypeChange: (type: DevServerType) => void;
}

const STORAGE_KEY_PREFIX = 'open-design:dev-server-type:';

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function readPersistedType(projectId: string): DevServerType | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (raw === 'vite' || raw === 'nextjs' || raw === 'custom') return raw;
  } catch {}
  return null;
}

function persistType(projectId: string, type: DevServerType): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), type);
  } catch {}
}

export function DevServerSelector({ projectId, currentType, onTypeChange }: DevServerSelectorProps) {
  const [selected, setSelected] = useState<DevServerType>(currentType);

  useEffect(() => {
    const persisted = readPersistedType(projectId);
    if (persisted) {
      setSelected(persisted);
      onTypeChange(persisted);
    }
  }, [projectId]);

  const handleChange = useCallback((type: DevServerType) => {
    setSelected(type);
    persistType(projectId, type);
    onTypeChange(type);
  }, [projectId, onTypeChange]);

  return (
    <div className={styles.container}>
      <button
        className={`${styles.option} ${selected === 'vite' ? styles.active : ''}`}
        onClick={() => handleChange('vite')}
        title="Vite HMR preview"
      >
        <span className={styles.icon}>⚡</span>
        <span className={styles.label}>Vite</span>
      </button>
      <button
        className={`${styles.option} ${selected === 'nextjs' ? styles.active : ''}`}
        onClick={() => handleChange('nextjs')}
        title="Next.js Fast Refresh preview"
      >
        <span className={styles.icon}>▲</span>
        <span className={styles.label}>Next.js</span>
      </button>
    </div>
  );
}
