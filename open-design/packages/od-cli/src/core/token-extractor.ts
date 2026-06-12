/**
 * Token Extractor — Splits tokens.css into categorized CSS files
 *
 * Classification rules from SKILL.md decision tree with 40+ regex patterns.
 * First match wins. Unmatched → custom.css
 */

import { parseCustomProperties, type CssCustomProperty } from '../utils/css-parser.js';
import { ensureDir, writeIfChanged } from '../utils/fs-utils.js';
import { join } from 'node:path';

export type TokenCategory =
  | 'colors'
  | 'spacing'
  | 'typography'
  | 'shadows'
  | 'motion-transitions'
  | 'motion-animations'
  | 'layout-breakpoints'
  | 'layout-grid'
  | 'custom';

interface ClassificationRule {
  pattern: RegExp;
  category: TokenCategory;
  description: string;
}

/**
 * Token classification decision tree — ordered by priority (first match wins)
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ── Colors ──────────────────────────────────────────
  { pattern: /^--color-/,           category: 'colors',             description: 'Color palette' },
  { pattern: /^--accent/,           category: 'colors',             description: 'Accent colors (brand)' },
  { pattern: /^--bg/,               category: 'colors',             description: 'Background colors' },
  { pattern: /^--fg/,               category: 'colors',             description: 'Foreground/text colors' },
  { pattern: /^--surface/,          category: 'colors',             description: 'Surface colors' },
  { pattern: /^--border(?!-(?:radius|width))/, category: 'colors', description: 'Border colors (not radius/width)' },
  { pattern: /^--muted/,            category: 'colors',             description: 'Muted colors' },
  { pattern: /^--meta/,             category: 'colors',             description: 'Meta/secondary text colors' },
  { pattern: /^--success/,          category: 'colors',             description: 'Success semantic color' },
  { pattern: /^--warn/,             category: 'colors',             description: 'Warning semantic color' },
  { pattern: /^--warning/,          category: 'colors',             description: 'Warning semantic color (alt)' },
  { pattern: /^--danger/,           category: 'colors',             description: 'Danger/error semantic color' },
  { pattern: /^--error/,            category: 'colors',             description: 'Error semantic color' },
  { pattern: /^--info/,             category: 'colors',             description: 'Info semantic color' },
  { pattern: /^--gradient-/,        category: 'colors',             description: 'Gradient definitions' },
  { pattern: /^--opacity-/,         category: 'colors',             description: 'Opacity values' },
  { pattern: /^--tag-/,             category: 'colors',             description: 'Tag/badge colors' },
  { pattern: /^--ring/,             category: 'colors',             description: 'Ring/outline colors' },
  { pattern: /^--chart-/,           category: 'colors',             description: 'Chart visualization colors' },
  { pattern: /^--sidebar-/,         category: 'colors',             description: 'Sidebar colors' },
  { pattern: /^--input-/,           category: 'colors',             description: 'Input field colors' },
  { pattern: /^--popover-/,         category: 'colors',             description: 'Popover colors' },
  { pattern: /^--destructive/,      category: 'colors',             description: 'Destructive action colors' },
  { pattern: /^--primary/,          category: 'colors',             description: 'Primary brand colors' },
  { pattern: /^--secondary-?/,      category: 'colors',             description: 'Secondary brand colors' },
  { pattern: /^--tertiary/,         category: 'colors',             description: 'Tertiary brand colors' },

  // ── Spacing ─────────────────────────────────────────
  { pattern: /^--space-/,           category: 'spacing',            description: 'Spacing scale' },
  { pattern: /^--spacing-/,         category: 'spacing',            description: 'Spacing scale (alt)' },
  { pattern: /^--radius-/,          category: 'spacing',            description: 'Border radius' },
  { pattern: /^--gap-/,             category: 'spacing',            description: 'Gap values' },
  { pattern: /^--container-gutter/, category: 'spacing',            description: 'Container gutters' },

  // ── Typography ──────────────────────────────────────
  { pattern: /^--font-/,            category: 'typography',         description: 'Font families' },
  { pattern: /^--text-/,            category: 'typography',         description: 'Text size scale' },
  { pattern: /^--leading-/,         category: 'typography',         description: 'Line height' },
  { pattern: /^--tracking-/,        category: 'typography',         description: 'Letter spacing' },
  { pattern: /^--weight-/,          category: 'typography',         description: 'Font weight' },
  { pattern: /^--line-height-/,     category: 'typography',         description: 'Line height (alt)' },
  { pattern: /^--letter-spacing-/,  category: 'typography',         description: 'Letter spacing (alt)' },

  // ── Shadows ─────────────────────────────────────────
  { pattern: /^--shadow-/,          category: 'shadows',            description: 'Box shadows' },
  { pattern: /^--elev-/,            category: 'shadows',            description: 'Elevation shadows' },
  { pattern: /^--focus-ring/,       category: 'shadows',            description: 'Focus ring shadow' },

  // ── Motion / Transitions ────────────────────────────
  { pattern: /^--duration-/,        category: 'motion-transitions', description: 'Transition durations' },
  { pattern: /^--motion-/,          category: 'motion-transitions', description: 'Motion durations (alt)' },
  { pattern: /^--ease-/,            category: 'motion-transitions', description: 'Easing functions' },
  { pattern: /^--transition-/,      category: 'motion-transitions', description: 'Pre-composed transitions' },

  // ── Motion / Animations ─────────────────────────────
  { pattern: /^--animate-/,         category: 'motion-animations',  description: 'Animation definitions' },
  { pattern: /^--keyframe-/,        category: 'motion-animations',  description: 'Keyframe references' },

  // ── Layout / Breakpoints ────────────────────────────
  { pattern: /^--breakpoint-/,      category: 'layout-breakpoints', description: 'Responsive breakpoints' },
  { pattern: /^--screen-/,          category: 'layout-breakpoints', description: 'Screen size tokens' },

  // ── Layout / Grid ───────────────────────────────────
  { pattern: /^--container-/,       category: 'layout-grid',        description: 'Container sizing' },
  { pattern: /^--z-/,               category: 'layout-grid',        description: 'Z-index scale' },
  { pattern: /^--section-/,         category: 'layout-grid',        description: 'Section rhythm' },
  { pattern: /^--sidebar-w/,        category: 'layout-grid',        description: 'Sidebar width' },
];

/**
 * Classify a single CSS custom property by its name
 */
export function classifyToken(prop: CssCustomProperty): TokenCategory {
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(prop.name)) {
      return rule.category;
    }
  }
  return 'custom';
}

/**
 * Category → output file mapping
 */
export function categoryToFile(category: TokenCategory): { dir: string; filename: string } {
  switch (category) {
    case 'colors':             return { dir: 'tokens', filename: 'colors.css' };
    case 'spacing':            return { dir: 'tokens', filename: 'spacing.css' };
    case 'typography':         return { dir: 'tokens', filename: 'typography.css' };
    case 'shadows':            return { dir: 'tokens', filename: 'shadows.css' };
    case 'custom':             return { dir: 'tokens', filename: 'custom.css' };
    case 'motion-transitions': return { dir: 'motion', filename: 'transitions.css' };
    case 'motion-animations':  return { dir: 'motion', filename: 'animations.css' };
    case 'layout-breakpoints': return { dir: 'layout', filename: 'breakpoints.css' };
    case 'layout-grid':        return { dir: 'layout', filename: 'grid.css' };
  }
}

export interface ExtractedToken {
  name: string;
  value: string;
  comment?: string;
  category: TokenCategory;
  file: string; // relative path like "tokens/colors.css"
}

export interface ExtractionResult {
  tokens: ExtractedToken[];
  byCategory: Record<TokenCategory, ExtractedToken[]>;
  stats: {
    total: number;
    byCategory: Record<string, number>;
    unclassified: number;
  };
}

/**
 * Main extraction: parse tokens.css and classify all custom properties
 */
export function extractTokens(tokensCss: string, sourceName: string): ExtractionResult {
  const properties = parseCustomProperties(tokensCss);
  const tokens: ExtractedToken[] = [];
  const byCategory: Record<string, ExtractedToken[]> = {
    colors: [],
    spacing: [],
    typography: [],
    shadows: [],
    'motion-transitions': [],
    'motion-animations': [],
    'layout-breakpoints': [],
    'layout-grid': [],
    custom: [],
  };

  for (const prop of properties) {
    const category = classifyToken(prop);
    const { dir, filename } = categoryToFile(category);
    const file = `${dir}/${filename}`;

    const token: ExtractedToken = {
      name: prop.name,
      value: prop.value,
      comment: prop.comment,
      category,
      file,
    };

    tokens.push(token);
    byCategory[category].push(token);
  }

  const statsByCategory: Record<string, number> = {};
  for (const [cat, toks] of Object.entries(byCategory)) {
    statsByCategory[cat] = toks.length;
  }

  return {
    tokens,
    byCategory: byCategory as Record<TokenCategory, ExtractedToken[]>,
    stats: {
      total: tokens.length,
      byCategory: statsByCategory,
      unclassified: (byCategory.custom || []).length,
    },
  };
}

/**
 * Generate CSS file content for a token category
 */
export function generateTokenCss(
  tokens: ExtractedToken[],
  category: TokenCategory,
  sourceName: string,
): string {
  const { dir, filename } = categoryToFile(category);
  const categoryLabel = category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const lines: string[] = [
    `/* Token Category: ${categoryLabel} | Source: design-systems/${sourceName} */`,
    `/* Generated by od-cli token-extractor — safe to customize */`,
    '',
    ':root {',
  ];

  for (const token of tokens) {
    const comment = token.comment ? ` /* ${token.comment} */` : '';
    lines.push(`  ${token.name}: ${token.value};${comment}`);
  }

  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

/**
 * Write all extracted token files to the design/ directory
 */
export async function writeTokenFiles(
  designDir: string,
  extraction: ExtractionResult,
  sourceName: string,
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];

  // Group by file
  const byFile: Record<string, ExtractedToken[]> = {};
  for (const token of extraction.tokens) {
    if (!byFile[token.file]) byFile[token.file] = [];
    byFile[token.file].push(token);
  }

  // Always ensure all category dirs exist
  await ensureDir(join(designDir, 'tokens'));
  await ensureDir(join(designDir, 'motion'));
  await ensureDir(join(designDir, 'layout'));

  for (const [file, tokens] of Object.entries(byFile)) {
    const category = tokens[0]?.category || 'custom';
    const content = generateTokenCss(tokens, category as TokenCategory, sourceName);
    const fullPath = join(designDir, file);

    const changed = await writeIfChanged(fullPath, content);
    if (changed) {
      written.push(file);
    } else {
      skipped.push(file);
    }
  }

  // Write empty placeholder files for missing categories
  const allFiles = [
    'tokens/colors.css', 'tokens/spacing.css', 'tokens/typography.css',
    'tokens/shadows.css', 'tokens/custom.css',
    'motion/transitions.css', 'motion/animations.css',
    'layout/breakpoints.css', 'layout/grid.css',
  ];

  for (const file of allFiles) {
    if (!byFile[file]) {
      const { dir, filename } = { dir: file.split('/')[0], filename: file.split('/')[1] };
      const categoryLabel = filename.replace('.css', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const content = [
        `/* Token Category: ${categoryLabel} | Source: design-systems/${sourceName} */`,
        `/* Generated by od-cli token-extractor — no tokens in this category */`,
        '',
        ':root {',
        '}',
        '',
      ].join('\n');
      const fullPath = join(designDir, file);
      await writeIfChanged(fullPath, content);
      skipped.push(file);
    }
  }

  return { written, skipped };
}
