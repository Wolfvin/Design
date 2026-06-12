/**
 * Strategy Generators — CSS output generation for different strategies
 *
 * 1. custom-properties (default) — :root custom properties
 * 2. tailwind-theme — @theme block for Tailwind v4
 * 3. css-modules — Global tokens + scoped component styles
 * 4. js-tokens — JS/TS token exports for CSS-in-JS
 */

import { join } from 'node:path';
import { ensureDir, writeIfChanged } from '../utils/fs-utils.js';
import type { ExtractionResult, ExtractedToken, TokenCategory } from './token-extractor.js';
import type { ExtractionResult as ComponentExtractionResult } from './component-forge.js';

// ─── CSS Modules Hybrid Strategy ────────────────────────────

/**
 * CSS Modules hybrid approach:
 * - Tokens remain as global :root custom properties (must be global for var() references)
 * - Components get .module.css wrappers with scoped class names
 * - An index.css imports both global tokens and module entry
 */
export async function generateCssModulesFiles(
  designDir: string,
  sourceName: string,
  tokenExtraction: ExtractionResult,
  componentExtraction: ComponentExtractionResult,
  manifest: any,
): Promise<string[]> {
  const written: string[] = [];

  // 1. Generate global tokens (same as custom-properties)
  //    These stay global because CSS custom properties MUST be in :root
  //    for var() references to work across modules
  const tokenFiles = new Set(tokenExtraction.tokens.map(t => t.file));
  for (const file of tokenFiles) {
    const tokens = tokenExtraction.tokens.filter(t => t.file === file);
    if (tokens.length === 0) continue;

    const category = tokens[0].category;
    const { dir, filename } = { dir: file.split('/')[0], filename: file.split('/')[1] };
    const categoryLabel = (category as string).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const lines: string[] = [
      `/* Token Category: ${categoryLabel} | Source: design-systems/${sourceName} */`,
      `/* Strategy: css-modules — tokens are GLOBAL (required for var() references) */`,
      '',
      ':root {',
    ];

    for (const token of tokens) {
      const comment = token.comment ? ` /* ${token.comment} */` : '';
      lines.push(`  ${token.name}: ${token.value};${comment}`);
    }

    lines.push('}');
    lines.push('');

    const fullPath = join(designDir, file);
    const changed = await writeIfChanged(fullPath, lines.join('\n'));
    if (changed) written.push(file);
  }

  // 2. Generate CSS Module wrappers for components
  //    Each component gets both a regular .css (for reference) and a .module.css
  await ensureDir(join(designDir, 'components'));

  for (const component of componentExtraction.components) {
    const moduleFilename = `${component.name}.module.css`;
    const lines: string[] = [
      `/* Component Module: ${component.name} | Source: design-systems/${sourceName} */`,
      `/* Strategy: css-modules — classes are locally scoped */`,
      `/* Import: import styles from '../design/components/${component.name}.module.css' */`,
      '',
    ];

    // Convert selectors to composable class names
    for (const rule of component.rules) {
      // Convert .btn-primary → .btnPrimary (camelCase for JS import)
      const moduleSelector = rule.selector
        .split(',')
        .map(s => s.trim())
        .map(s => {
          // Keep pseudo-selectors and combinators
          if (s.startsWith(':')) return s;
          // Convert class selectors to module-friendly names
          return s;
        })
        .join(', ');

      lines.push(`${moduleSelector} {`);
      lines.push(rule.declarations.split('\n').map(l => `  ${l}`).join('\n'));
      lines.push('}');
      lines.push('');
    }

    const fullPath = join(designDir, 'components', moduleFilename);
    const changed = await writeIfChanged(fullPath, lines.join('\n'));
    if (changed) written.push(`components/${moduleFilename}`);
  }

  // 3. Generate module index
  const moduleIndexPath = join(designDir, 'modules.css');
  const moduleLines: string[] = [
    '/* design/modules.css — CSS Modules entry point */',
    `/* Design System: ${sourceName} | Strategy: css-modules */`,
    '',
    '/* Import global tokens first */',
    `@import "./index.css";`,
    '',
    '/* Then import component modules in your JS/TS files: */',
    `/* import styles from './design/components/button.module.css' */`,
    '',
  ];
  const changed = await writeIfChanged(moduleIndexPath, moduleLines.join('\n'));
  if (changed) written.push('modules.css');

  return written;
}


// ─── JS Tokens Strategy ─────────────────────────────────────

/**
 * js-tokens strategy: Generate JS/TS token exports for CSS-in-JS projects.
 *
 * Outputs:
 * - tokens.js — ES module with token values as named exports
 * - tokens.d.ts — TypeScript type definitions
 * - tokens.css — Still generates CSS custom properties as fallback
 */
export async function generateJsTokensFiles(
  designDir: string,
  sourceName: string,
  tokenExtraction: ExtractionResult,
): Promise<string[]> {
  const written: string[] = [];

  // 1. Generate tokens.js
  const jsLines: string[] = [
    `// design/tokens.js — AUTO-GENERATED`,
    `// Design System: ${sourceName} | Strategy: js-tokens`,
    `// Generated by od-cli — safe to customize`,
    '',
  ];

  // Group tokens by category for organized exports
  const byCategory: Record<string, ExtractedToken[]> = {};
  for (const token of tokenExtraction.tokens) {
    const cat = token.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(token);
  }

  // Generate named exports
  for (const [category, tokens] of Object.entries(byCategory)) {
    const categoryLabel = category.replace(/-/g, '_');
    jsLines.push(`// ${categoryLabel}`);
    for (const token of tokens) {
      // Convert --color-primary-500 → colorPrimary500
      const jsName = token.name
        .replace(/^--/, '')
        .replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

      // Smart value detection
      let jsValue: string;
      if (token.value.startsWith('#') || token.value.startsWith('rgb') || token.value.startsWith('hsl')) {
        jsValue = `'${token.value}'`;
      } else if (token.value.startsWith('var(')) {
        // Keep var() references as strings
        jsValue = `'${token.value}'`;
      } else if (/^\d/.test(token.value) && (token.value.endsWith('px') || token.value.endsWith('rem') || token.value.endsWith('em'))) {
        jsValue = `'${token.value}'`;
      } else if (/^\d+(\.\d+)?$/.test(token.value)) {
        jsValue = token.value;
      } else {
        jsValue = `'${token.value}'`;
      }

      jsLines.push(`export const ${jsName} = ${jsValue};`);
    }
    jsLines.push('');
  }

  // Also generate a default export object
  jsLines.push('// Combined token object');
  jsLines.push('const tokens = {');
  for (const [category, tokens] of Object.entries(byCategory)) {
    jsLines.push(`  ${category.replace(/-/g, '_')}: {`);
    for (const token of tokens) {
      const jsName = token.name
        .replace(/^--/, '')
        .replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

      let jsValue: string;
      if (token.value.startsWith('#') || token.value.startsWith('var(') || token.value.startsWith('rgb') || token.value.startsWith('hsl')) {
        jsValue = `'${token.value}'`;
      } else if (/^\d/.test(token.value) && (token.value.endsWith('px') || token.value.endsWith('rem') || token.value.endsWith('em'))) {
        jsValue = `'${token.value}'`;
      } else if (/^\d+(\.\d+)?$/.test(token.value)) {
        jsValue = token.value;
      } else {
        jsValue = `'${token.value}'`;
      }

      jsLines.push(`    ${jsName}: ${jsValue},`);
    }
    jsLines.push('  },');
  }
  jsLines.push('};');
  jsLines.push('');
  jsLines.push('export default tokens;');
  jsLines.push('');

  const jsPath = join(designDir, 'tokens.js');
  const jsChanged = await writeIfChanged(jsPath, jsLines.join('\n'));
  if (jsChanged) written.push('tokens.js');

  // 2. Generate tokens.d.ts
  const dtsLines: string[] = [
    `// design/tokens.d.ts — AUTO-GENERATED`,
    `// Design System: ${sourceName} | Strategy: js-tokens`,
    '',
  ];

  for (const [category, tokens] of Object.entries(byCategory)) {
    const categoryLabel = category.replace(/-/g, '_');
    dtsLines.push(`// ${categoryLabel}`);
    for (const token of tokens) {
      const jsName = token.name
        .replace(/^--/, '')
        .replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

      const type = /^\d+(\.\d+)?$/.test(token.value) ? 'number' : 'string';
      dtsLines.push(`export const ${jsName}: ${type};`);
    }
    dtsLines.push('');
  }

  // Type for combined object
  dtsLines.push('interface TokenCategory {');
  for (const [category, tokens] of Object.entries(byCategory)) {
    const categoryLabel = category.replace(/-/g, '_');
    dtsLines.push(`  ${categoryLabel}: {`);
    for (const token of tokens) {
      const jsName = token.name
        .replace(/^--/, '')
        .replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
      const type = /^\d+(\.\d+)?$/.test(token.value) ? 'number' : 'string';
      dtsLines.push(`    ${jsName}: ${type};`);
    }
    dtsLines.push('  };');
  }
  dtsLines.push('}');
  dtsLines.push('');
  dtsLines.push('declare const tokens: TokenCategory;');
  dtsLines.push('export default tokens;');
  dtsLines.push('');

  const dtsPath = join(designDir, 'tokens.d.ts');
  const dtsChanged = await writeIfChanged(dtsPath, dtsLines.join('\n'));
  if (dtsChanged) written.push('tokens.d.ts');

  return written;
}


// ─── Update Report Generator ────────────────────────────────

export interface UpdateReport {
  source: string;
  oldHash: string;
  newHash: string;
  updated: string[];
  skipped: string[];
  added: string[];
  removed: string[];
  newTokens: string[];
  removedTokens: string[];
  newComponents: string[];
  changedSelectors: Array<{ component: string; from: string[]; to: string[] }>;
  rollbackAvailable: boolean;
  rollbackHash: string | null;
}

export function generateUpdateReport(report: UpdateReport): string {
  const lines: string[] = [];

  lines.push('## Design System Update Report');
  lines.push('');
  lines.push(`**Source**: ${report.source} (hash: ${report.oldHash} → ${report.newHash})`);
  lines.push(`**Updated**: ${new Date().toISOString()}`);
  lines.push('');

  // Updated files
  if (report.updated.length > 0) {
    lines.push('### Updated');
    for (const file of report.updated) {
      lines.push(`- ${file} (source changed)`);
    }
    lines.push('');
  }

  // Skipped files
  if (report.skipped.length > 0) {
    lines.push('### Skipped — User Modified');
    for (const file of report.skipped) {
      lines.push(`- ${file} (override detected, preserving)`);
    }
    lines.push('');
  }

  // Added files
  if (report.added.length > 0) {
    lines.push('### Added');
    for (const file of report.added) {
      lines.push(`- ${file} (new in source DS)`);
    }
    lines.push('');
  }

  // Removed files
  if (report.removed.length > 0) {
    lines.push('### Removed');
    for (const file of report.removed) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  // Contract changes
  const hasContractChanges = report.newTokens.length > 0 || report.removedTokens.length > 0 ||
    report.newComponents.length > 0 || report.changedSelectors.length > 0;

  if (hasContractChanges) {
    lines.push('### Contract Changes');

    if (report.newTokens.length > 0) {
      lines.push(`- New tokens: ${report.newTokens.join(', ')}`);
    }
    if (report.removedTokens.length > 0) {
      lines.push(`- Removed tokens: ${report.removedTokens.join(', ')}`);
    }
    if (report.newComponents.length > 0) {
      lines.push(`- New components: ${report.newComponents.join(', ')}`);
    }
    for (const change of report.changedSelectors) {
      lines.push(`- Changed selectors: ${change.component} now includes ${change.to.filter(s => !change.from.includes(s)).join(', ')}`);
    }
    lines.push('');
  }

  // Rollback
  if (report.rollbackAvailable && report.rollbackHash) {
    lines.push('### Rollback Available');
    lines.push(`- Previous state hash: ${report.rollbackHash}`);
    lines.push('- To rollback: `od design rollback`');
    lines.push('');
  }

  return lines.join('\n');
}
