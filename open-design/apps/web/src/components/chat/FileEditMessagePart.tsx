/**
 * FileEditMessagePart — drop-in replacement for artifact rendering in
 * chat messages. Integrates with the existing AssistantMessage rendering
 * system.
 *
 * Renders a list of FileEditCards with:
 *   - Original content fetched from the daemon API
 *   - Apply action that calls writeProjectTextFile from the registry
 *   - Streaming progress for active edits
 *   - Auto-collapsing completed edits after a timeout
 *   - "View all changes" summary at the bottom
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FileEdit } from '../../parsers/file-edit-parser';
import {
  parseFileEditsComplete,
  hasFileEditTags,
} from '../../parsers/file-edit-parser';
import type { ChatMessage } from '../../types';
import {
  writeProjectTextFileDetailed,
  projectRawUrl,
} from '../../providers/registry';
import { FileEditCard } from '../FileEditCard';
import styles from './FileEditMessagePart.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEditMessagePartProps {
  /** All file edits from this message */
  edits: FileEdit[];
  /** Project ID for fetching original content */
  projectId: string;
  /** Callback to open a file in workspace */
  onOpenFile?: (path: string) => void;
  /** Callback to apply an edit */
  onApplyEdit?: (edit: FileEdit) => Promise<void>;
  /** Currently streaming edit */
  streamingEdit?: FileEdit | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Original content cache (module-level to survive re-renders)
// ---------------------------------------------------------------------------

const originalContentCache = new Map<string, Map<string, string>>();

function getCacheForProject(projectId: string): Map<string, string> {
  let cache = originalContentCache.get(projectId);
  if (!cache) {
    cache = new Map();
    originalContentCache.set(projectId, cache);
  }
  return cache;
}

/**
 * Fetch the original content of a project file. Uses an in-memory cache
 * keyed by (projectId, filePath) so each file is fetched at most once
 * per session.
 */
async function fetchOriginalContent(
  projectId: string,
  filePath: string,
): Promise<string | null> {
  const cache = getCacheForProject(projectId);

  // Check cache first.
  const cached = cache.get(filePath);
  if (cached !== undefined) return cached;

  try {
    // Use the raw file URL to fetch content.
    const url = projectRawUrl(projectId, filePath);
    const resp = await fetch(url);
    if (!resp.ok) {
      // File might not exist yet (create action). Cache null to avoid retrying.
      cache.set(filePath, '');
      return '';
    }
    const text = await resp.text();
    cache.set(filePath, text);
    return text;
  } catch {
    cache.set(filePath, '');
    return '';
  }
}

// ---------------------------------------------------------------------------
// Auto-collapse timeout (ms)
// ---------------------------------------------------------------------------

const AUTO_COLLAPSE_DELAY = 15_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileEditMessagePart: React.FC<FileEditMessagePartProps> = ({
  edits,
  projectId,
  onOpenFile,
  onApplyEdit,
  streamingEdit,
  className,
}) => {
  // Map of filePath → original content.
  const [originalContents, setOriginalContents] = useState<
    Record<string, string>
  >({});
  // Track which files we've already fetched.
  const [fetchedPaths, setFetchedPaths] = useState<Set<string>>(new Set());
  // Track completed edits that should be auto-collapsed.
  const [collapsedEdits, setCollapsedEdits] = useState<Set<string>>(new Set());
  // Track applying state per path.
  const [applyingPaths, setApplyingPaths] = useState<Set<string>>(new Set());
  // Track apply errors per path.
  const [applyErrors, setApplyErrors] = useState<
    Record<string, string>
  >({});

  // Fetch original content for each edit that we haven't fetched yet.
  useEffect(() => {
    const pathsToFetch = edits
      .filter((e) => !fetchedPaths.has(e.path))
      .map((e) => e.path);

    if (pathsToFetch.length === 0) return;

    const newFetched = new Set(fetchedPaths);
    for (const p of pathsToFetch) newFetched.add(p);
    setFetchedPaths(newFetched);

    let cancelled = false;

    Promise.all(
      pathsToFetch.map(async (filePath) => {
        const content = await fetchOriginalContent(projectId, filePath);
        return { filePath, content: content ?? '' };
      }),
    ).then((results) => {
      if (cancelled) return;
      setOriginalContents((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.filePath] = r.content;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [edits, fetchedPaths, projectId]);

  // Auto-collapse completed edits after a delay.
  useEffect(() => {
    const completedEdits = edits.filter(
      (e) =>
        e.status === 'complete' &&
        !collapsedEdits.has(e.path) &&
        // Only auto-collapse if there are multiple edits.
        edits.length > 1,
    );

    if (completedEdits.length === 0) return;

    const timer = setTimeout(() => {
      setCollapsedEdits((prev) => {
        const next = new Set(prev);
        for (const e of completedEdits) {
          next.add(e.path);
        }
        return next;
      });
    }, AUTO_COLLAPSE_DELAY);

    return () => clearTimeout(timer);
  }, [edits, collapsedEdits]);

  // Apply handler — writes the file via the daemon API.
  const handleApply = useCallback(
    async (edit: FileEdit) => {
      if (applyingPaths.has(edit.path)) return;

      setApplyingPaths((prev) => new Set(prev).add(edit.path));
      setApplyErrors((prev) => {
        const next = { ...prev };
        delete next[edit.path];
        return next;
      });

      try {
        if (onApplyEdit) {
          await onApplyEdit(edit);
        } else {
          // Default apply: use writeProjectTextFileDetailed from registry.
          const result = await writeProjectTextFileDetailed(
            projectId,
            edit.path,
            edit.content,
          );
          if (!result.ok) {
            setApplyErrors((prev) => ({
              ...prev,
              [edit.path]: result.message,
            }));
          }
        }
      } catch (err) {
        setApplyErrors((prev) => ({
          ...prev,
          [edit.path]: err instanceof Error ? err.message : 'Apply failed',
        }));
      } finally {
        setApplyingPaths((prev) => {
          const next = new Set(prev);
          next.delete(edit.path);
          return next;
        });
      }
    },
    [applyingPaths, onApplyEdit, projectId],
  );

  // Compute edit statistics for the summary banner.
  const stats = useMemo(() => {
    const total = edits.length;
    const completed = edits.filter((e) => e.status === 'complete').length;
    const created = edits.filter((e) => e.action === 'create').length;
    const edited = edits.filter((e) => e.action !== 'create').length;
    const isStreaming = !!streamingEdit || edits.some((e) => e.status === 'streaming');

    return { total, completed, created, edited, isStreaming };
  }, [edits, streamingEdit]);

  if (edits.length === 0) return null;

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* Summary banner */}
      <div className={styles.summaryBanner}>
        <span className={styles.summaryIcon}>
          {stats.total}
        </span>
        <span>
          <span className={styles.summaryCount}>
            {stats.total} file{stats.total !== 1 ? 's' : ''}
          </span>
          {' changed'}
          {stats.created > 0 && ` (${stats.created} new)`}
        </span>
        <div className={styles.summarySpacer} />
        {stats.isStreaming && (
          <span className={styles.streamingOverlay}>
            <span className={styles.streamingPulse} />
            Streaming…
          </span>
        )}
      </div>

      {/* Edit cards */}
      <div className={styles.cards}>
        {edits.map((edit) => {
          const isStreaming = edit.status === 'streaming' || edit === streamingEdit;
          const original = originalContents[edit.path];

          return (
            <FileEditCard
              key={edit.path}
              edit={edit}
              originalContent={original}
              onOpenFile={onOpenFile}
              onApply={handleApply}
              isStreaming={isStreaming}
            />
          );
        })}
      </div>

      {/* View all changes footer */}
      {edits.length > 2 && (
        <div className={styles.viewAllFooter}>
          <button
            type="button"
            className={styles.viewAllBtn}
            aria-label={`View all ${stats.total} file changes`}
          >
            View all {stats.total} changes
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Utility: extract FileEdit[] from a ChatMessage
// ---------------------------------------------------------------------------

/**
 * Extract FileEdit objects from a ChatMessage's content.
 * Parses the message content for <file-edit> tags using the parser.
 */
export function extractFileEditsFromMessage(
  message: ChatMessage,
): FileEdit[] {
  const content = message.content ?? '';
  if (!content || !hasFileEditTags(content)) return [];
  return parseFileEditsComplete(content);
}

export default FileEditMessagePart;
