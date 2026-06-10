/**
 * App Developer type definitions for the Open Design migration.
 *
 * These types extend the existing contracts with app-developer-specific kinds.
 * After migration, ProjectKind will include these new types alongside
 * the existing ones (prototype, deck, template, image).
 *
 * @module app-developer-types
 */

// ---------------------------------------------------------------------------
// Project kinds
// ---------------------------------------------------------------------------

/**
 * New project kinds for app development.
 *
 * Each kind maps to a specific technology stack that the App Developer
 * mode knows how to scaffold, preview, and edit.
 */
export type AppDeveloperProjectKind =
  | 'tauri-react'       // Tauri + React + TypeScript
  | 'tauri-vue'         // Tauri + Vue + TypeScript
  | 'nextjs-standalone' // Next.js App Router (React SSR, output: standalone)
  | 'nextjs-pages'      // Next.js Pages Router (React SSR)
  | 'nextjs'            // Next.js (generic, before sub-type detection)
  | 'vite-react'        // Vite + React
  | 'vite-vue'          // Vite + Vue
  | 'astro'             // Astro static site
  | 'remix'             // Remix (React)
  | 'sveltekit'         // SvelteKit
  | 'nuxt'              // Nuxt (Vue SSR)
  | 'vite-vanilla';     // Vite + Vanilla JS/TS

/**
 * Extended ProjectKind that includes both legacy design-centric kinds
 * and new app-developer kinds.
 *
 * After the migration is complete, the canonical `ProjectKind` type in
 * `@open-design/contracts` should be replaced with this union.
 */
export type ExtendedProjectKind =
  | 'prototype'     // Legacy: design prototype
  | 'deck'          // Legacy: presentation deck
  | 'template'      // Legacy: design template
  | 'image'         // Legacy: image generation
  | 'video'         // Legacy: video generation
  | 'audio'         // Legacy: audio generation
  | AppDeveloperProjectKind;

// ---------------------------------------------------------------------------
// Tech stack
// ---------------------------------------------------------------------------

/**
 * Tech stack information for app-developer projects.
 *
 * Populated by `detectProjectType()` when a project is imported or created.
 */
export interface TechStackInfo {
  /** Primary UI framework (e.g., "React 19", "Vue 3") */
  framework: string;
  /** Primary language (e.g., "TypeScript", "JavaScript") */
  language: string;
  /** Build tool / bundler (e.g., "Vite", "Next.js", "Astro") */
  buildTool: string;
  /** CSS framework if present (e.g., "Tailwind CSS v4") */
  cssFramework?: string;
  /** Desktop runtime if applicable */
  desktopRuntime?: 'tauri' | 'electron' | 'none';
  /** Package manager preference */
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
}

// ---------------------------------------------------------------------------
// Project type detection
// ---------------------------------------------------------------------------

/**
 * Result of auto-detecting a project's type and tech stack.
 *
 * Returned by the project-type-detector module and the
 * `POST /api/projects/:id/detect-type` route.
 */
export interface ProjectTypeDetectionResult {
  /** Detected project kind */
  kind: ExtendedProjectKind;
  /** Resolved tech stack details */
  techStack: TechStackInfo;
  /** Vite dev server port, if applicable */
  vitePort?: number;
  /** Unified dev server port (Vite: 5173, Next.js: 3000) */
  devPort?: number;
  /** Dev server type for preview mechanism selection */
  devServerType?: 'vite' | 'nextjs' | 'custom';
  /** How confident the detection is */
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Skill output
// ---------------------------------------------------------------------------

/**
 * Skill output format type.
 *
 * - `file-edit`: The skill produces `<file-edit>` blocks that write directly
 *   to project files (App Developer mode).
 * - `artifact`: The skill produces `<artifact>` blocks rendered as HTML
 *   previews (legacy design mode).
 */
export type SkillOutputFormat = 'file-edit' | 'artifact';

/**
 * Skill mode type.
 *
 * Determines the operational context of a skill:
 * - `prototype`: Quick iteration, design-to-code
 * - `design`: Visual design exploration
 * - `engineering`: Production-quality code editing
 */
export type SkillMode = 'prototype' | 'design' | 'engineering';

/**
 * Extended skill frontmatter for the migration.
 *
 * This interface defines the `od:` frontmatter block that appears in
 * SKILL.md files. New fields (`outputFormat`, `mode`, etc.) were added
 * during the App Developer migration to control how skills produce output.
 */
export interface ExtendedSkillFrontmatter {
  od?: {
    /** Operating mode of the skill */
    mode?: SkillMode;
    /** Target surface (e.g., "web", "desktop") */
    surface?: string;
    /** Use-case scenario */
    scenario?: string;
    /** Skill category for filtering */
    category?: string;
    /** Kind of task the skill performs */
    taskKind?: string;
    /** Output format: file-edit (App Developer) or artifact (legacy design) */
    outputFormat?: SkillOutputFormat;
    /** Whether a design system is required */
    design_system?: { requires: boolean };
    /** Craft requirements */
    craft?: { requires: string[] };
    /** Whether this skill is deprecated */
    deprecated?: boolean;
    /** Reason for deprecation */
    deprecatedReason?: string;
  };
}

// ---------------------------------------------------------------------------
// File edit record (DB persistence)
// ---------------------------------------------------------------------------

/**
 * File edit record for DB persistence.
 *
 * Stored as a JSON array element in `messages.file_edits_json` and
 * aggregated into `conversations.last_file_edits`.
 */
export interface FileEditRecord {
  /** Relative file path within the project */
  path: string;
  /** What kind of edit was performed */
  action: 'edit' | 'create' | 'delete';
  /** Number of lines in the resulting file */
  lineCount?: number;
  /** SHA-256 hash of the file content after edit */
  contentHash?: string;
}

// ---------------------------------------------------------------------------
// Stack compatibility
// ---------------------------------------------------------------------------

/**
 * Stack compatibility info for skills.
 *
 * Skills can declare which project types they are compatible with.
 * The UI filters skills based on this information.
 */
export interface StackCompatibilityInfo {
  /** Which project types this skill works with. Empty = all types. */
  stackCompat?: AppDeveloperProjectKind[];
  /** Whether this skill is only for Next.js projects. */
  nextjsOnly?: boolean;
  /** Whether this skill is only for Tauri projects. */
  tauriOnly?: boolean;
}
