/**
 * skill-stack-filter — Frontend utility for filtering skills by stack compatibility.
 *
 * A skill is compatible with a project when:
 *   - `stackCompatibility === 'both'` (works everywhere)
 *   - `stackCompatibility === null` or `undefined` (legacy skill, assumed compatible)
 *   - `stackCompatibility` matches the project's stack
 *
 * The `projectType` is the raw project type string (e.g. 'nextjs',
 * 'tauri-react', 'vite-react'). It is normalised internally:
 *   - any type starting with 'nextjs' → 'nextjs'
 *   - any other type → 'tauri' (covers tauri-react, vite-react, etc.)
 *
 * Part of the Open Design App Developer migration (Stack Compatibility Matrix).
 */

import type { SkillSummary } from '../types';

type StackCompat = 'both' | 'nextjs' | 'tauri';

/**
 * Normalise a project type string to a stack key.
 *
 * @param projectType - Raw project type (e.g. 'nextjs', 'tauri-react', 'vite-react')
 * @returns Normalised stack key: 'nextjs' or 'tauri'
 */
export function stackFromProjectType(projectType: string | null | undefined): 'nextjs' | 'tauri' {
  if (!projectType) return 'tauri';
  return projectType.startsWith('nextjs') ? 'nextjs' : 'tauri';
}

/**
 * Check if a single skill is compatible with a given project stack.
 *
 * @param skill - Skill with optional `stackCompatibility` field
 * @param stack - Normalised stack key ('nextjs' or 'tauri')
 * @returns true if the skill is compatible with the project's stack
 */
export function isSkillCompatibleWithStack(
  skill: Pick<SkillSummary, 'stackCompatibility'>,
  stack: 'nextjs' | 'tauri',
): boolean {
  const compat = skill.stackCompatibility;
  if (compat === null || compat === undefined || compat === 'both') return true;
  return compat === stack;
}

/**
 * Filter a list of skills by stack compatibility.
 *
 * @param skills - Full skill list from the API
 * @param projectType - The current project's detected type
 * @returns Filtered skill list containing only compatible skills
 */
export function filterSkillsByStack(
  skills: SkillSummary[],
  projectType: string | null | undefined,
): SkillSummary[] {
  if (!projectType) return skills;
  const stack = stackFromProjectType(projectType);
  return skills.filter((skill) => isSkillCompatibleWithStack(skill, stack));
}
