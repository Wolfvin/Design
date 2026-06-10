import { writeFileEditToProject } from './file-edit-pipeline.js';
import type { FileEdit, FileEditWriteResult } from './file-edit-pipeline.js';
import { insertFileEditHistory } from './file-edit-persistence.js';
import type Database from 'better-sqlite3';

/**
 * Events emitted by the ChatFileEditHandler during stream processing.
 */
export type FileEditEvent =
  | { type: 'edit_start'; filePath: string }
  | { type: 'edit_complete'; result: FileEditWriteResult }
  | { type: 'edit_error'; filePath: string; error: string };

/**
 * State machine states for parsing <file-edit> blocks from AI stream output.
 */
enum ParseState {
  TEXT = 'TEXT',
  TAG_OPEN = 'TAG_OPEN',
  ATTRIBUTES = 'ATTRIBUTES',
  CONTENT = 'CONTENT',
  TAG_CLOSE = 'TAG_CLOSE',
}

/**
 * Parsed <file-edit> block attributes.
 */
interface ParsedFileEdit {
  filePath: string;
  content: string;
  search?: string;
  replace?: string;
}

/**
 * Hook into the chat streaming pipeline to detect and process <file-edit>
 * blocks in AI responses. The AI emits structured XML-like blocks that
 * specify file path and content; this handler parses them incrementally
 * as the stream arrives and writes completed blocks to disk.
 *
 * Expected format:
 * ```
 * <file-edit path="src/components/App.tsx">
 * // file content here
 * </file-edit>
 * ```
 *
 * Or with search/replace:
 * ```
 * <file-edit path="src/components/App.tsx" search="old code" replace="new code">
 * </file-edit>
 * ```
 */
export class ChatFileEditHandler {
  private state: ParseState = ParseState.TEXT;
  private currentEdit: Partial<ParsedFileEdit> | null = null;
  private currentContent: string = '';
  private buffer: string = '';
  private completedEdits: FileEdit[] = [];
  private allResults: FileEditWriteResult[] = [];
  private db: Database.Database | null;
  private projectId: string;
  private conversationId?: string;
  private messageId?: string;

  constructor(
    projectId: string,
    projectsRoot: string,
    opts?: {
      db?: Database.Database;
      conversationId?: string;
      messageId?: string;
    },
  ) {
    this.projectId = projectId;
    this.projectsRoot = projectsRoot;
    this.db = opts?.db ?? null;
    this.conversationId = opts?.conversationId;
    this.messageId = opts?.messageId;
  }

  private projectsRoot: string;

  /**
   * Feed a delta from the AI stream. Returns events for any completed
   * file edits that were written to disk.
   */
  async processDelta(delta: string): Promise<FileEditEvent[]> {
    this.buffer += delta;
    const events: FileEditEvent[] = [];

    while (this.buffer.length > 0) {
      switch (this.state) {
        case ParseState.TEXT: {
          const tagStart = this.buffer.indexOf('<file-edit');
          if (tagStart === -1) {
            // No tag found, discard text (or keep a small overlap for safety)
            this.buffer = this.buffer.slice(Math.max(0, this.buffer.length - 20));
            return events;
          }
          // Discard text before tag
          this.buffer = this.buffer.slice(tagStart);
          this.state = ParseState.TAG_OPEN;
          break;
        }

        case ParseState.TAG_OPEN: {
          const closeBracket = this.buffer.indexOf('>');
          if (closeBracket === -1) return events; // Wait for more data

          const tagContent = this.buffer.slice(0, closeBracket);
          this.currentEdit = this.parseAttributes(tagContent);
          this.currentContent = '';
          this.buffer = this.buffer.slice(closeBracket + 1);
          this.state = ParseState.CONTENT;

          if (this.currentEdit.filePath) {
            events.push({ type: 'edit_start', filePath: this.currentEdit.filePath });
          }
          break;
        }

        case ParseState.CONTENT: {
          const closeTag = this.buffer.indexOf('</file-edit>');
          if (closeTag === -1) {
            // Accumulate content (but cap buffer size to prevent memory issues)
            const keepUpTo = Math.max(0, this.buffer.length - 100);
            this.currentContent += this.buffer.slice(0, keepUpTo);
            this.buffer = this.buffer.slice(keepUpTo);
            return events;
          }

          this.currentContent += this.buffer.slice(0, closeTag);
          this.buffer = this.buffer.slice(closeTag + '</file-edit>'.length);

          if (this.currentEdit?.filePath) {
            const edit: FileEdit = {
              filePath: this.currentEdit.filePath,
              content: this.currentContent,
              search: this.currentEdit.search,
              replace: this.currentEdit.replace,
              conversationId: this.conversationId,
              messageId: this.messageId,
            };

            try {
              const result = await writeFileEditToProject(
                this.getProjectBaseDir(),
                edit,
                { validatePaths: true, createBackup: true },
              );

              events.push({ type: 'edit_complete', result });
              this.completedEdits.push(edit);
              this.allResults.push(result);

              // Log to file_edit_history
              if (this.db && result.action !== 'skipped') {
                try {
                  insertFileEditHistory(this.db, {
                    projectId: this.projectId,
                    conversationId: this.conversationId,
                    messageId: this.messageId,
                    filePath: result.path,
                    action: result.action === 'created' ? 'create' : 'edit',
                    contentHash: result.newHash,
                  });
                } catch (err) {
                  console.warn(`[chat-file-edit-handler] history log failed: ${err}`);
                }
              }
            } catch (err: any) {
              events.push({
                type: 'edit_error',
                filePath: this.currentEdit.filePath,
                error: err.message,
              });
            }
          }

          this.currentEdit = null;
          this.currentContent = '';
          this.state = ParseState.TEXT;
          break;
        }

        default:
          this.state = ParseState.TEXT;
      }
    }

    return events;
  }

  /**
   * Flush remaining edits at end of stream. Processes any buffered content
   * that might still be in a partial <file-edit> block.
   */
  async flush(): Promise<FileEditWriteResult[]> {
    // If we're in CONTENT state, the tag wasn't properly closed.
    // Write what we have as a best-effort.
    if (this.state === ParseState.CONTENT && this.currentEdit?.filePath && this.currentContent.trim()) {
      const edit: FileEdit = {
        filePath: this.currentEdit.filePath,
        content: this.currentContent,
        search: this.currentEdit.search,
        replace: this.currentEdit.replace,
        conversationId: this.conversationId,
        messageId: this.messageId,
      };

      try {
        const result = await writeFileEditToProject(
          this.getProjectBaseDir(),
          edit,
          { validatePaths: true, createBackup: true },
        );
        this.allResults.push(result);
        this.completedEdits.push(edit);

        if (this.db && result.action !== 'skipped') {
          try {
            insertFileEditHistory(this.db, {
              projectId: this.projectId,
              conversationId: this.conversationId,
              messageId: this.messageId,
              filePath: result.path,
              action: result.action === 'created' ? 'create' : 'edit',
              contentHash: result.newHash,
            });
          } catch (err) {
            console.warn(`[chat-file-edit-handler] history log failed on flush: ${err}`);
          }
        }
      } catch (err: any) {
        console.warn(`[chat-file-edit-handler] flush write failed for ${this.currentEdit.filePath}: ${err.message}`);
      }
    }

    // Reset state
    this.state = ParseState.TEXT;
    this.currentEdit = null;
    this.currentContent = '';
    this.buffer = '';

    return this.allResults;
  }

  /**
   * Get all completed file edits from this session.
   */
  getCompletedEdits(): FileEdit[] {
    return [...this.completedEdits];
  }

  /**
   * Get the project base directory (resolved absolute path).
   */
  private getProjectBaseDir(): string {
    return this.projectsRoot;
  }

  /**
   * Parse attributes from the <file-edit> opening tag.
   * Supports: path="...", search="...", replace="..."
   */
  private parseAttributes(tagContent: string): Partial<ParsedFileEdit> {
    const result: Partial<ParsedFileEdit> = {};

    // Match path="..." attribute
    const pathMatch = tagContent.match(/path\s*=\s*"([^"]*)"/);
    if (pathMatch) {
      result.filePath = this.unescapeXml(pathMatch[1]);
    }

    // Also support filePath="..." as an alias
    if (!result.filePath) {
      const filePathMatch = tagContent.match(/filePath\s*=\s*"([^"]*)"/);
      if (filePathMatch) {
        result.filePath = this.unescapeXml(filePathMatch[1]);
      }
    }

    // Match search="..." attribute (optional)
    const searchMatch = tagContent.match(/search\s*=\s*"([^"]*)"/);
    if (searchMatch) {
      result.search = this.unescapeXml(searchMatch[1]);
    }

    // Match replace="..." attribute (optional)
    const replaceMatch = tagContent.match(/replace\s*=\s*"([^"]*)"/);
    if (replaceMatch) {
      result.replace = this.unescapeXml(replaceMatch[1]);
    }

    return result;
  }

  /**
   * Unescape basic XML entities in attribute values.
   */
  private unescapeXml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
