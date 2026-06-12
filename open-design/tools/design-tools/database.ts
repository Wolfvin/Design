import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../library.db");

export type DesignCategory =
  | "css"
  | "tailwind"
  | "react-component"
  | "nextjs-pattern"
  | "typescript"
  | "framer-motion"
  | "animation"
  | "hover-effect"
  | "gradient"
  | "design-system"
  | "micro-interaction";

export type DesignSource = "web" | "claude";

export interface DesignElement {
  id: number;
  name: string;
  category: DesignCategory;
  source: DesignSource;
  source_url: string | null;
  code: string;
  mood: string;         // JSON array: ["elegant","minimal"]
  context: string;      // JSON array: ["hero","card"]
  compatible_with: string; // JSON array of element names
  clash_with: string;      // JSON array of element names
  tags: string;            // JSON array of free tags
  framework: string;       // JSON array: ["react","nextjs","tailwind"]
  status: "pending" | "approved" | "rejected";
  used_count: number;
  rating: number | null;
  extracted_at: string;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL"); // faster writes
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS design_elements (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      category        TEXT NOT NULL,
      source          TEXT NOT NULL DEFAULT 'web',
      source_url      TEXT,
      code            TEXT NOT NULL,
      mood            TEXT NOT NULL DEFAULT '[]',
      context         TEXT NOT NULL DEFAULT '[]',
      compatible_with TEXT NOT NULL DEFAULT '[]',
      clash_with      TEXT NOT NULL DEFAULT '[]',
      tags            TEXT NOT NULL DEFAULT '[]',
      framework       TEXT NOT NULL DEFAULT '[]',
      status          TEXT NOT NULL DEFAULT 'pending',
      used_count      INTEGER NOT NULL DEFAULT 0,
      rating          REAL,
      extracted_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_category ON design_elements(category);
    CREATE INDEX IF NOT EXISTS idx_status   ON design_elements(status);
    CREATE INDEX IF NOT EXISTS idx_source   ON design_elements(source);
    CREATE INDEX IF NOT EXISTS idx_name     ON design_elements(name);
  `);

  return _db;
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function insertElement(
  el: Omit<DesignElement, "id" | "used_count" | "extracted_at">
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO design_elements
      (name, category, source, source_url, code, mood, context,
       compatible_with, clash_with, tags, framework, status, rating)
    VALUES
      (@name, @category, @source, @source_url, @code, @mood, @context,
       @compatible_with, @clash_with, @tags, @framework, @status, @rating)
  `);
  const result = stmt.run(el);
  return result.lastInsertRowid as number;
}

export function queryElements(filters: {
  category?: DesignCategory;
  status?: string;
  source?: DesignSource;
  search?: string;
  limit?: number;
}): DesignElement[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.category) {
    conditions.push("category = @category");
    params.category = filters.category;
  }
  if (filters.status) {
    conditions.push("status = @status");
    params.status = filters.status;
  }
  if (filters.source) {
    conditions.push("source = @source");
    params.source = filters.source;
  }
  if (filters.search) {
    conditions.push("(name LIKE @search OR tags LIKE @search OR mood LIKE @search)");
    params.search = `%${filters.search}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ? `LIMIT ${filters.limit}` : "";

  return db
    .prepare(`SELECT * FROM design_elements ${where} ORDER BY extracted_at DESC ${limit}`)
    .all(params) as DesignElement[];
}

export function updateElementStatus(id: number, status: "approved" | "rejected"): void {
  getDb()
    .prepare("UPDATE design_elements SET status = ? WHERE id = ?")
    .run(status, id);
}

export function updateElementName(id: number, name: string): void {
  getDb()
    .prepare("UPDATE design_elements SET name = ? WHERE id = ?")
    .run(name, id);
}

export function incrementUsed(id: number): void {
  getDb()
    .prepare("UPDATE design_elements SET used_count = used_count + 1 WHERE id = ?")
    .run(id);
}

export function deleteElement(id: number): void {
  getDb()
    .prepare("DELETE FROM design_elements WHERE id = ?")
    .run(id);
}

export function getStats(): Record<string, number> {
  const db = getDb();
  const rows = db
    .prepare("SELECT category, COUNT(*) as count FROM design_elements WHERE status='approved' GROUP BY category")
    .all() as { category: string; count: number }[];

  return Object.fromEntries(rows.map((r) => [r.category, r.count]));
}
