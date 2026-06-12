/**
 * Manifest, Contract, and Execution Plan generators
 */

import { writeJsonFile, ensureDir, writeIfChanged, fileExists } from '../utils/fs-utils.js';
import { join } from 'node:path';
import type { ExtractionResult, ExtractedToken, TokenCategory } from './token-extractor.js';
import type { ExtractionResult as ComponentExtractionResult, ExtractedComponent } from './component-forge.js';
import { hashDesignSystemSource, hashDesignDirectory } from './hash.js';
import type { CssStrategy, StackDetectionResult } from '../utils/fs-utils.js';

// ─── Manifest Generator ────────────────────────────────────

export interface CompositionEntry {
  source: string;
  layers: string[];
  hash: string;
  repoHash: string;
}

export interface DesignManifest {
  schemaVersion: string;
  version: number;
  source: {
    designSystem: string;
    repoHash: string;
    generatedAt: string;
    generatedBy: string;
  };
  extensions: Array<{
    type: 'source' | 'override' | 'add';
    file: string;
    originalHash?: string;
    currentHash?: string;
    addedBy?: string;
    addedAt?: string;
  }>;
  composition?: CompositionEntry[];
  stack: string;
  cssStrategy: string;
  import: {
    strategy: string;
    entry: string;
  };
  rollback: {
    lastStableHash: string | null;
    lastStableAt: string | null;
    history: Array<{
      hash: string;
      date: string;
      source: string;
      repoHash: string;
    }>;
  };
}

export async function generateManifest(
  designDir: string,
  dsDir: string,
  sourceName: string,
  dsManifest: { files?: Record<string, string> },
  stack: StackDetectionResult,
): Promise<DesignManifest> {
  const repoHash = await hashDesignSystemSource(dsDir, dsManifest);

  const manifest: DesignManifest = {
    schemaVersion: 'od-design-local/v1',
    version: 1,
    source: {
      designSystem: sourceName,
      repoHash,
      generatedAt: new Date().toISOString(),
      generatedBy: 'od-cli',
    },
    extensions: [],
    stack: stack.stack,
    cssStrategy: stack.cssStrategy,
    import: {
      strategy: stack.cssStrategy === 'tailwind-theme' ? 'tailwind' : 'index',
      entry: stack.cssStrategy === 'tailwind-theme' ? 'tailwind.css' : 'index.css',
    },
    rollback: {
      lastStableHash: null,
      lastStableAt: null,
      history: [],
    },
  };

  await writeJsonFile(join(designDir, 'manifest.json'), manifest);
  return manifest;
}

// ─── Contract Generator ─────────────────────────────────────

export interface DesignContract {
  schemaVersion: string;
  tokens: Record<string, string[]>;
  naming: {
    componentSelector: string;
    tokenPrefix: string;
    fileNaming: string;
    bemEnabled: boolean;
  };
  scope: {
    type: string;
    customPropertiesRoot: string;
    componentPrefix: string;
  };
  components: Array<{
    name: string;
    file: string;
    selectors: string[];
  }>;
  strategyConfig: Record<string, unknown>;
}

export async function generateContract(
  designDir: string,
  tokenExtraction: ExtractionResult,
  componentExtraction: ComponentExtractionResult,
  stack: StackDetectionResult,
): Promise<DesignContract> {
  // Build token registry grouped by human-readable category
  const tokensByCategory: Record<string, string[]> = {};
  const categoryLabels: Record<TokenCategory, string> = {
    colors: 'colors',
    spacing: 'spacing',
    typography: 'typography',
    shadows: 'shadows',
    'motion-transitions': 'motion',
    'motion-animations': 'motion',
    'layout-breakpoints': 'layout',
    'layout-grid': 'layout',
    custom: 'custom',
  };

  for (const token of tokenExtraction.tokens) {
    const label = categoryLabels[token.category] || 'custom';
    if (!tokensByCategory[label]) tokensByCategory[label] = [];
    tokensByCategory[label].push(token.name);
  }

  // Deduplicate (motion-transitions and motion-animations both map to 'motion')
  for (const key of Object.keys(tokensByCategory)) {
    tokensByCategory[key] = [...new Set(tokensByCategory[key])];
  }

  // Build component registry
  const components = componentExtraction.components.map(c => ({
    name: c.name,
    file: `components/${c.name}.css`,
    selectors: c.selectors,
  }));

  // Strategy-specific config
  const strategyConfig: Record<string, unknown> = {};
  if (stack.cssStrategy === 'tailwind-theme') {
    strategyConfig.tailwind = {
      themeFile: 'tailwind.css',
      tokenMapping: 'custom-properties-to-theme',
    };
  } else if (stack.cssStrategy === 'custom-properties') {
    strategyConfig.customProperties = {
      rootSelector: ':root',
      fallbackValues: false,
    };
  } else if (stack.cssStrategy === 'js-tokens') {
    strategyConfig.jsTokens = {
      entryFile: 'tokens.js',
      typeDefinition: 'tokens.d.ts',
    };
  }

  const contract: DesignContract = {
    schemaVersion: 'od-design-contract/v1',
    tokens: tokensByCategory,
    naming: {
      componentSelector: 'kebab-case',
      tokenPrefix: '',
      fileNaming: 'kebab-case',
      bemEnabled: false,
    },
    scope: {
      type: stack.cssStrategy === 'css-modules' ? 'modules' : 'global',
      customPropertiesRoot: ':root',
      componentPrefix: '',
    },
    components,
    strategyConfig,
  };

  await writeJsonFile(join(designDir, 'contract.json'), contract);
  return contract;
}

// ─── Execution Plan Generator ───────────────────────────────

export interface ExecutionStep {
  id: string;
  action: string;
  path: string;
  content?: string;
  source?: string;
  transform?: string;
  idempotent?: boolean;
  required?: boolean;
  reason?: string;
}

export interface ExecutionPlan {
  schemaVersion: string;
  generatedAt: string;
  sourceDesignSystem: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  phase1: {
    description: string;
    steps: ExecutionStep[];
  };
  phase2: {
    description: string;
    steps: ExecutionStep[];
  };
  rollback: {
    snapshotBefore: string | null;
    filesToBackup: string[];
    idempotent: boolean;
  };
}

export async function generateExecutionPlan(
  designDir: string,
  sourceName: string,
  tokenExtraction: ExtractionResult,
  componentExtraction: ComponentExtractionResult,
  stack: StackDetectionResult,
): Promise<ExecutionPlan> {
  const steps1: ExecutionStep[] = [];
  let stepNum = 1;

  // Phase 1: Design directory creation
  steps1.push({ id: `p1-${stepNum++}`, action: 'create-directory', path: 'design/' });

  // Token files
  const tokenFiles = new Set(tokenExtraction.tokens.map(t => t.file));
  for (const file of tokenFiles) {
    steps1.push({
      id: `p1-${stepNum++}`,
      action: 'write-file',
      path: `design/${file}`,
      source: `design-systems/${sourceName}/tokens.css`,
      transform: `extract-${file.split('/').pop()?.replace('.css', '') || 'tokens'}`,
    });
  }

  // Component files
  for (const comp of componentExtraction.components) {
    steps1.push({
      id: `p1-${stepNum++}`,
      action: 'write-file',
      path: `design/components/${comp.name}.css`,
      source: `design-systems/${sourceName}/components.html`,
      transform: 'extract-component',
    });
  }

  // Metadata files
  steps1.push({ id: `p1-${stepNum++}`, action: 'write-file', path: 'design/manifest.json', source: 'generated' });
  steps1.push({ id: `p1-${stepNum++}`, action: 'write-file', path: 'design/contract.json', source: 'generated' });
  steps1.push({ id: `p1-${stepNum++}`, action: 'write-file', path: 'design/index.css', source: 'generated' });

  // Phase 2: Project integration
  const steps2: ExecutionStep[] = [];
  let p2Num = 1;

  if (stack.cssEntry) {
    steps2.push({
      id: `p2-${p2Num++}`,
      action: 'prepend-to-file',
      path: stack.cssEntry,
      content: `@import "../design/${stack.cssStrategy === 'tailwind-theme' ? 'tailwind.css' : 'index.css'}";`,
      idempotent: true,
    });
  }

  const plan: ExecutionPlan = {
    schemaVersion: 'od-execution-plan/v1',
    generatedAt: new Date().toISOString(),
    sourceDesignSystem: sourceName,
    status: 'pending',
    phase1: {
      description: 'Generate design/ directory with tokens, components, motion, layout',
      steps: steps1,
    },
    phase2: {
      description: 'Update project source files to use design system',
      steps: steps2,
    },
    rollback: {
      snapshotBefore: null,
      filesToBackup: stack.cssEntry ? [stack.cssEntry] : [],
      idempotent: true,
    },
  };

  await writeJsonFile(join(designDir, 'execution-plan.json'), plan);
  return plan;
}

// ─── Index CSS Generator ────────────────────────────────────

export async function generateIndexCss(
  designDir: string,
  sourceName: string,
  tokenExtraction: ExtractionResult,
  componentExtraction: ComponentExtractionResult,
  manifest: DesignManifest,
): Promise<string> {
  const lines: string[] = [
    '/* design/index.css — AUTO-GENERATED */',
    `/* Design System: ${sourceName} | Generated: ${manifest.source.generatedAt} | DO NOT EDIT */`,
    `/* Source: design-systems/${sourceName} (hash: ${manifest.source.repoHash}) */`,
    '/* Contract: design/contract.json — read this before writing code */',
    '',
  ];

  // Group files by category
  const tokenFiles = [...new Set(tokenExtraction.tokens.map(t => t.file))].sort();
  const componentFiles = componentExtraction.components.map(c => `components/${c.name}.css`).sort();

  if (tokenExtraction.byCategory['layout-grid']?.length || tokenExtraction.byCategory['layout-breakpoints']?.length) {
    lines.push('/* ── Layout ──── */');
    if (tokenExtraction.byCategory['layout-grid']?.length) lines.push('@import "./layout/grid.css";');
    if (tokenExtraction.byCategory['layout-breakpoints']?.length) lines.push('@import "./layout/breakpoints.css";');
    lines.push('');
  }

  if (tokenFiles.some(f => f.startsWith('tokens/'))) {
    lines.push('/* ── Tokens ──── */');
    for (const file of tokenFiles.filter(f => f.startsWith('tokens/')).sort()) {
      lines.push(`@import "./${file}";`);
    }
    lines.push('');
  }

  if (componentFiles.length > 0) {
    lines.push('/* ── Components ──── */');
    // Import _shared.css first if it exists
    if (componentExtraction.sharedRules.length > 0) {
      lines.push('@import "./components/_shared.css";');
    }
    for (const file of componentFiles) {
      lines.push(`@import "./${file}";`);
    }
    lines.push('');
  }

  if (tokenExtraction.byCategory['motion-transitions']?.length || tokenExtraction.byCategory['motion-animations']?.length) {
    lines.push('/* ── Motion ──── */');
    if (tokenExtraction.byCategory['motion-transitions']?.length) lines.push('@import "./motion/transitions.css";');
    if (tokenExtraction.byCategory['motion-animations']?.length) lines.push('@import "./motion/animations.css";');
    lines.push('');
  }

  const content = lines.join('\n');
  await writeIfChanged(join(designDir, 'index.css'), content);
  return content;
}

// ─── Tailwind CSS Generator ─────────────────────────────────

export async function generateTailwindCss(
  designDir: string,
  sourceName: string,
  tokenExtraction: ExtractionResult,
  manifest: DesignManifest,
): Promise<string | null> {
  // Read existing tailwind-v4.css from DS package if it exists
  const { fileExists, readTextFile } = await import('../utils/fs-utils.js');
  const { dirname } = await import('node:path');

  // We just copy the DS's tailwind-v4.css into the project's design/tailwind.css
  // The DS already has the proper @theme mapping
  const dsDir = dirname(dirname(designDir)); // rough estimate, better to pass explicitly
  // Actually, let's just generate from tokens

  const byCategory = tokenExtraction.byCategory;

  const themeLines: string[] = [
    '/* design/tailwind.css — AUTO-GENERATED */',
    `/* Design System: ${sourceName} | Generated: ${manifest.source.generatedAt} | DO NOT EDIT */`,
    '',
    '@import "tailwindcss";',
    '',
    '@theme {',
  ];

  // Map tokens to @theme namespace
  for (const token of tokenExtraction.tokens) {
    if (token.category === 'colors') {
      // Map --accent → --color-accent
      const twName = token.name.startsWith('--color-') ? token.name : `--color-${token.name.replace(/^--/, '')}`;
      themeLines.push(`  ${twName}: var(${token.name});`);
    } else if (token.category === 'spacing') {
      if (token.name.startsWith('--space-')) {
        themeLines.push(`  --spacing-${token.name.replace('--space-', '')}: var(${token.name});`);
      } else if (token.name.startsWith('--radius-')) {
        themeLines.push(`  ${token.name}: var(${token.name});`);
      }
    } else if (token.category === 'typography') {
      if (token.name.startsWith('--font-')) {
        const twName = token.name.replace('--font-body', '--font-sans');
        themeLines.push(`  ${twName}: var(${token.name});`);
      } else {
        themeLines.push(`  ${token.name}: var(${token.name});`);
      }
    } else if (token.category === 'shadows') {
      const twName = token.name.replace('--elev-', '--shadow-');
      themeLines.push(`  ${twName}: var(${token.name});`);
    } else if (token.category === 'motion-transitions') {
      if (token.name.startsWith('--motion-') || token.name.startsWith('--duration-')) {
        const twName = token.name.replace('--motion-fast', '--duration-fast').replace('--motion-base', '--duration-base');
        themeLines.push(`  ${twName}: var(${token.name});`);
      } else if (token.name.startsWith('--ease-')) {
        themeLines.push(`  ${token.name}: var(${token.name});`);
      }
    } else if (token.category === 'layout-grid') {
      themeLines.push(`  ${token.name}: var(${token.name});`);
    }
  }

  themeLines.push('}');
  themeLines.push('');

  const content = themeLines.join('\n');
  await writeIfChanged(join(designDir, 'tailwind.css'), content);
  return content;
}
