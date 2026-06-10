/**
 * @open-design/contracts — public API surface.
 *
 * Re-exports all shared type definitions used across the Open Design
 * monorepo (daemon, web, host packages).
 */

// App Developer types (Phase 5 — Next.js mode)
export type {
  AppDeveloperProjectKind,
  ExtendedProjectKind,
  TechStackInfo,
  ProjectTypeDetectionResult,
  SkillOutputFormat,
  SkillMode,
  ExtendedSkillFrontmatter,
  FileEditRecord,
  StackCompatibilityInfo,
} from './app-developer-types.js';
