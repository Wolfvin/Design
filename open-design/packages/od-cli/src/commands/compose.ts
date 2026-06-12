/**
 * `od design compose` — Compose design/ from multiple DS sources
 *
 * Each source contributes specific layers:
 *   - tokens: color, spacing, typography, shadows tokens
 *   - components: CSS component styles (button, card, etc.)
 *   - motion: transitions, animations
 *   - layout: grid, breakpoints
 *
 * Usage:
 *   od design compose --sources apple:tokens,layout brutalism:components creative:motion
 *
 * Conflict resolution: last-wins-per-layer. Cross-layer is orthogonal (no conflict).
 * Composition is recorded in manifest.composition[] for update/rollback.
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, writeJsonFile, ensureDir, writeIfChanged, readTextFile, detectProjectStack } from '../utils/fs-utils.js';
import { extractTokens, writeTokenFiles, generateTokenCss, type ExtractionResult, type ExtractedToken, type TokenCategory } from '../core/token-extractor.js';
import { extractComponents, writeComponentFiles, type ExtractionResult as ComponentExtractionResult } from '../core/component-forge.js';
import { generateContract, generateExecutionPlan, generateIndexCss, generateTailwindCss, type DesignManifest } from '../core/generators.js';
import { generateCssModulesFiles, generateJsTokensFiles } from '../core/strategies.js';
import { hashDesignDirectory, hashDesignSystemSource, hashContent } from '../core/hash.js';

// ─── Types ─────────────────────────────────────────────────

export type ComposeLayer = 'tokens' | 'components' | 'motion' | 'layout';

export interface CompositionEntry {
  source: string;
  layers: ComposeLayer[];
  hash: string;
  repoHash: string;
}

interface LayerExtraction {
  tokens: ExtractionResult | null;
  components: ComponentExtractionResult | null;
  source: string;
  dsDir: string;
}

// ─── Layer extraction from a single DS ─────────────────────

/**
 * Extract only specified layers from a DS source.
 * If 'tokens' layer is requested, extract all token categories.
 * If 'components' layer is requested, extract all components.
 * If 'motion' layer is requested, extract only motion tokens.
 * If 'layout' layer is requested, extract only layout tokens.
 */
async function extractLayers(
  dsDir: string,
  sourceName: string,
  layers: ComposeLayer[],
): Promise<LayerExtraction> {
  const dsManifestPath = join(dsDir, 'manifest.json');
  const dsManifest = await readJsonFile<Record<string, any>>(dsManifestPath);

  // Always extract tokens if any token-related layer is requested
  let fullTokenExtraction: ExtractionResult | null = null;
  const needsTokens = layers.includes('tokens') || layers.includes('motion') || layers.includes('layout');

  if (needsTokens) {
    const tokensCss = await readTextFile(join(dsDir, dsManifest.files?.tokens || 'tokens.css'));
    fullTokenExtraction = extractTokens(tokensCss, sourceName);
  }

  // Filter token extraction based on requested layers
  let tokens: ExtractionResult | null = null;
  if (fullTokenExtraction) {
    const tokenCategories = new Set<TokenCategory>();

    if (layers.includes('tokens')) {
      // tokens layer = colors, spacing, typography, shadows, custom
      tokenCategories.add('colors');
      tokenCategories.add('spacing');
      tokenCategories.add('typography');
      tokenCategories.add('shadows');
      tokenCategories.add('custom');
    }

    if (layers.includes('motion')) {
      tokenCategories.add('motion-transitions');
      tokenCategories.add('motion-animations');
    }

    if (layers.includes('layout')) {
      tokenCategories.add('layout-breakpoints');
      tokenCategories.add('layout-grid');
    }

    // Filter tokens to only include requested categories
    const filteredTokens = fullTokenExtraction.tokens.filter(t => tokenCategories.has(t.category));
    const filteredByCategory: Record<string, any> = {};
    for (const cat of tokenCategories) {
      filteredByCategory[cat] = fullTokenExtraction.byCategory[cat] || [];
    }

    tokens = {
      tokens: filteredTokens,
      byCategory: filteredByCategory as ExtractionResult['byCategory'],
      stats: {
        total: filteredTokens.length,
        byCategory: Object.fromEntries(
          Object.entries(filteredByCategory).map(([k, v]) => [k, (v as any[]).length])
        ),
        unclassified: (filteredByCategory['custom'] as any[])?.length || 0,
      },
    };
  }

  // Extract components if requested
  let components: ComponentExtractionResult | null = null;
  if (layers.includes('components')) {
    components = await extractComponents(dsDir, sourceName);
  }

  return { tokens, components, source: sourceName, dsDir };
}

// ─── Find DS directory ─────────────────────────────────────

async function findDsDir(projectPath: string, dsName: string): Promise<string> {
  const candidates = [
    join(projectPath, 'design-systems', dsName),
    join(projectPath, 'open-design', 'design-systems', dsName),
    join(projectPath, 'Design', 'open-design', 'design-systems', dsName),
  ];

  const cliDir = import.meta.dirname || __dirname;
  candidates.push(
    resolve(cliDir, '..', '..', '..', 'design-systems', dsName),
    resolve(cliDir, '..', '..', '..', '..', 'design-systems', dsName),
  );

  for (const candidate of candidates) {
    if (await dirExists(candidate)) return candidate;
  }

  const repoRoot = process.env.OD_REPO_ROOT;
  if (repoRoot) {
    const candidate = join(repoRoot, 'design-systems', dsName);
    if (await dirExists(candidate)) return candidate;
  }

  return '';
}

// ─── Compose Command ───────────────────────────────────────

export function composeCommand(): Command {
  const cmd = new Command('compose');

  cmd
    .description('Compose design/ from multiple design system sources (Multi-Vibe)')
    .option('--sources <entries...>', 'Source-layer mappings (e.g., apple:tokens,layout brutalism:components)')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--strategy <type>', 'CSS strategy: custom-properties | tailwind-theme | css-modules | js-tokens', '')
    .option('--force', 'Overwrite existing design/ directory', false)
    .option('--dry-run', 'Preview composition without writing files', false)
    .action(async (options) => {
      const projectPath = resolve(options.project);
      const designDir = join(projectPath, 'design');

      log.heading('od design compose — Multi-Vibe Composition');

      // ── Step 1: Parse sources ────────────────────────────────
      log.step(1, 8, 'Parsing composition sources...');

      if (!options.sources || options.sources.length === 0) {
        log.error('No sources specified. Use --sources <source:layers ...>');
        log.dim('Example: od design compose --sources apple:tokens,layout brutalism:components creative:motion');
        log.dim('Available layers: tokens, components, motion, layout');
        process.exit(1);
      }

      const composition: CompositionEntry[] = [];
      const layerAssignments = new Map<ComposeLayer, { source: string; index: number }>();

      for (let i = 0; i < options.sources.length; i++) {
        const entry = options.sources[i] as string;
        const [sourceName, layersStr] = entry.split(':');

        if (!sourceName || !layersStr) {
          log.error(`Invalid source format: "${entry}". Use "source:layers" (e.g., "apple:tokens,layout")`);
          process.exit(1);
        }

        const layers = layersStr.split(',').map(l => l.trim()) as ComposeLayer[];
        const validLayers: ComposeLayer[] = ['tokens', 'components', 'motion', 'layout'];
        const invalidLayers = layers.filter(l => !validLayers.includes(l));

        if (invalidLayers.length > 0) {
          log.error(`Invalid layer(s) for ${sourceName}: ${invalidLayers.join(', ')}`);
          log.dim(`Valid layers: ${validLayers.join(', ')}`);
          process.exit(1);
        }

        // Track layer assignments for conflict detection
        for (const layer of layers) {
          const existing = layerAssignments.get(layer);
          if (existing) {
            log.warn(`Layer "${layer}" assigned to both ${existing.source} and ${sourceName}. ${sourceName} wins (last-wins).`);
          }
          layerAssignments.set(layer, { source: sourceName, index: i });
        }

        composition.push({
          source: sourceName,
          layers,
          hash: '', // will be computed
          repoHash: '', // will be computed
        });

        log.info(`  ${sourceName}: ${layers.join(', ')}`);
      }

      // ── Step 2: Resolve and validate source directories ──────
      log.step(2, 8, 'Resolving source directories...');

      const extractions: LayerExtraction[] = [];

      for (const entry of composition) {
        const dsDir = await findDsDir(projectPath, entry.source);

        if (!dsDir) {
          log.error(`Source DS "${entry.source}" not found. Set OD_REPO_ROOT env variable.`);
          process.exit(1);
        }

        const dsManifest = await readJsonFile<Record<string, any>>(join(dsDir, 'manifest.json'));
        const repoHash = await hashDesignSystemSource(dsDir, dsManifest.files || {});
        entry.repoHash = repoHash;
        entry.hash = hashContent(`${entry.source}:${entry.layers.join(',')}:${repoHash}`);

        log.success(`  ${entry.source} (${dsManifest.category || 'unknown'}) — hash: ${repoHash}`);

        extractions.push(await extractLayers(dsDir, entry.source, entry.layers));
      }

      // ── Step 3: Check existing design/ ───────────────────────
      log.step(3, 8, 'Checking project state...');

      let existingManifest: DesignManifest | null = null;
      if (await dirExists(designDir)) {
        const manifestPath = join(designDir, 'manifest.json');
        if (await fileExists(manifestPath)) {
          existingManifest = await readJsonFile<DesignManifest>(manifestPath);

          if (!options.force) {
            const isComposition = existingManifest.composition && existingManifest.composition.length > 0;
            log.error(`design/ already exists (${isComposition ? 'composition' : existingManifest.source?.designSystem || 'unknown'}). Use --force to overwrite.`);
            process.exit(1);
          }
          log.warn('Overwriting existing design/ (--force)');
        }
      }

      // ── Step 4: Detect project stack ─────────────────────────
      log.step(4, 8, 'Detecting project stack...');

      let stack = await detectProjectStack(projectPath);
      if (options.strategy) {
        const strategyMap: Record<string, string> = {
          'custom-properties': 'custom-properties',
          'tailwind-theme': 'tailwind-theme',
          'css-modules': 'css-modules',
          'js-tokens': 'js-tokens',
        };
        const override = strategyMap[options.strategy];
        if (override) {
          stack = { ...stack, cssStrategy: override as any };
          log.info(`Strategy overridden to: ${override}`);
        }
      }

      log.success(`Stack: ${stack.stack} | Strategy: ${stack.cssStrategy}`);

      // ── Step 5: Compose merged extractions ───────────────────
      log.step(5, 8, 'Composing layers...');

      // Merge tokens from all sources (last-wins per category)
      const mergedTokens = composeTokens(extractions);
      // Merge components (last-wins)
      const mergedComponents = composeComponents(extractions);

      const tokenCount = mergedTokens?.stats.total || 0;
      const componentCount = mergedComponents?.stats.total || 0;
      log.success(`Composed: ${tokenCount} tokens + ${componentCount} components`);

      for (const [layer, assignment] of layerAssignments) {
        log.dim(`  ${layer}: ← ${assignment.source}`);
      }

      // ── Dry run mode ─────────────────────────────────────────
      if (options.dryRun) {
        log.heading('Dry Run — Preview');
        console.log('');
        console.log('  Composition:');
        for (const entry of composition) {
          console.log(`    ${entry.source}: ${entry.layers.join(', ')} (hash: ${entry.hash})`);
        }
        console.log(`  Tokens:     ${tokenCount}`);
        console.log(`  Components: ${componentCount}`);
        console.log(`  Strategy:   ${stack.cssStrategy}`);
        console.log('');
        log.dim('Run without --dry-run to generate design/');
        return;
      }

      // ── Step 6: Write design/ files ──────────────────────────
      log.step(6, 8, 'Writing design/ files...');

      // Ensure directories
      await ensureDir(designDir);
      await ensureDir(join(designDir, 'tokens'));
      await ensureDir(join(designDir, 'components'));
      await ensureDir(join(designDir, 'motion'));
      await ensureDir(join(designDir, 'layout'));

      // Write tokens — per-category with correct source attribution
      if (mergedTokens) {
        const tokenResult = await writeComposedTokenFiles(designDir, mergedTokens, layerAssignments);
        log.info(`Tokens: ${tokenResult.written.length} written, ${tokenResult.skipped.length} unchanged`);
      }

      // Write components
      if (mergedComponents) {
        const compSource = layerAssignments.get('components')?.source || composition[0]?.source || 'composed';
        const componentResult = await writeComponentFiles(designDir, mergedComponents, compSource);
        log.info(`Components: ${componentResult.written.length} written, ${componentResult.skipped.length} unchanged`);
      }

      // ── Step 7: Generate metadata ────────────────────────────
      log.step(7, 8, 'Generating metadata...');

      // Generate manifest with composition data
      const primarySource = composition[0]?.source || 'composed';
      const primaryDsDir = extractions[0]?.dsDir || '';
      const primaryManifest = await readJsonFile<Record<string, any>>(join(primaryDsDir, 'manifest.json'));

      const manifest: DesignManifest = {
        schemaVersion: 'od-design-local/v1',
        version: 1,
        source: {
          designSystem: `composed:${composition.map(c => c.source).join('+')}`,
          repoHash: hashContent(composition.map(c => `${c.source}:${c.repoHash}`).join('|')),
          generatedAt: new Date().toISOString(),
          generatedBy: 'od-cli/compose',
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
          history: existingManifest?.rollback?.history || [],
        },
        composition: composition,
      } as DesignManifest & { composition: CompositionEntry[] };

      await writeJsonFile(join(designDir, 'manifest.json'), manifest);
      log.success('manifest.json generated (with composition data)');

      // Generate contract
      if (mergedTokens && mergedComponents) {
        await generateContract(designDir, mergedTokens, mergedComponents, stack);
        log.success('contract.json generated');
      }

      // Generate execution plan
      if (mergedTokens && mergedComponents) {
        await generateExecutionPlan(designDir, `composed:${composition.map(c => c.source).join('+')}`, mergedTokens, mergedComponents, stack);
        log.success('execution-plan.json generated');
      }

      // Generate index.css
      if (mergedTokens && mergedComponents) {
        await generateIndexCss(designDir, primarySource, mergedTokens, mergedComponents, manifest);
        log.success('index.css generated');
      }

      // Strategy-specific files
      if (stack.cssStrategy === 'tailwind-theme' && mergedTokens) {
        await generateTailwindCss(designDir, primarySource, mergedTokens, manifest);
        log.success('tailwind.css generated');
      }

      if (stack.cssStrategy === 'css-modules' && mergedTokens && mergedComponents) {
        const moduleFiles = await generateCssModulesFiles(designDir, primarySource, mergedTokens, mergedComponents, manifest);
        log.success(`CSS Modules: ${moduleFiles.length} files generated`);
      }

      if (stack.cssStrategy === 'js-tokens' && mergedTokens) {
        const jsFiles = await generateJsTokensFiles(designDir, primarySource, mergedTokens);
        log.success(`JS Tokens: ${jsFiles.length} files generated`);
      }

      // ── Step 8: Update project imports ───────────────────────
      log.step(8, 8, 'Updating project imports...');

      if (stack.cssEntry) {
        const cssEntryPath = join(projectPath, stack.cssEntry);
        const entryFile = stack.cssStrategy === 'tailwind-theme' ? 'tailwind.css'
          : stack.cssStrategy === 'css-modules' ? 'modules.css'
          : 'index.css';
        const importLine = `@import "../design/${entryFile}";`;

        try {
          const existing = await readTextFile(cssEntryPath);
          if (!existing.includes(importLine)) {
            const updated = `${importLine}\n${existing}`;
            await writeIfChanged(cssEntryPath, updated);
            log.success(`Added import to ${stack.cssEntry}`);
          } else {
            log.info(`Import already exists in ${stack.cssEntry}`);
          }
        } catch {
          log.warn(`Could not update ${stack.cssEntry} — add this line manually:`);
          log.dim(`  ${importLine}`);
        }
      }

      // ── Summary ──────────────────────────────────────────────
      log.heading('Compose Complete!');

      console.log(`  Composition:`);
      for (const entry of composition) {
        console.log(`    \x1b[1m${entry.source}\x1b[0m → ${entry.layers.join(', ')}`);
      }
      console.log(`  Strategy:       ${stack.cssStrategy}`);
      console.log(`  Tokens:         ${tokenCount}`);
      console.log(`  Components:     ${componentCount}`);
      console.log(`  Entry:          design/${manifest.import.entry}`);
      console.log('');
      log.dim('Run "od design status" to see composition details.');
      log.dim('Run "od design rollback" to revert to previous state.');
    });

  return cmd;
}

/**
 * Write composed token files with correct per-layer source attribution.
 * Each category gets the source name from its layer assignment.
 */
async function writeComposedTokenFiles(
  designDir: string,
  extraction: ExtractionResult,
  layerAssignments: Map<ComposeLayer, { source: string; index: number }>,
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];

  // Map token categories to their layer for source attribution
  const categoryToLayer: Record<string, ComposeLayer> = {
    colors: 'tokens',
    spacing: 'tokens',
    typography: 'tokens',
    shadows: 'tokens',
    custom: 'tokens',
    'motion-transitions': 'motion',
    'motion-animations': 'motion',
    'layout-breakpoints': 'layout',
    'layout-grid': 'layout',
  };

  // Group tokens by file
  const byFile: Record<string, ExtractedToken[]> = {};
  for (const token of extraction.tokens) {
    if (!byFile[token.file]) byFile[token.file] = [];
    byFile[token.file].push(token);
  }

  for (const [file, tokens] of Object.entries(byFile)) {
    // Determine the source for this file based on the token category
    const category = tokens[0]?.category || 'custom';
    const layer = categoryToLayer[category] || 'tokens';
    const sourceName = layerAssignments.get(layer)?.source || 'composed';

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
        `/* Token Category: ${categoryLabel} | Source: composed */`,
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

// ─── Compose Helpers ───────────────────────────────────────

/**
 * Merge token extractions from multiple sources.
 * Last source wins per category.
 */
function composeTokens(extractions: LayerExtraction[]): ExtractionResult | null {
  const tokenExtractions = extractions.filter(e => e.tokens !== null);
  if (tokenExtractions.length === 0) return null;
  if (tokenExtractions.length === 1) return tokenExtractions[0].tokens!;

  // Merge tokens: last-wins per category
  const categoryOwnership = new Map<TokenCategory, { tokens: any[]; source: string }>();

  for (const extraction of tokenExtractions) {
    const t = extraction.tokens!;
    for (const [category, tokens] of Object.entries(t.byCategory)) {
      if ((tokens as any[]).length > 0) {
        categoryOwnership.set(category as TokenCategory, {
          tokens: tokens as any[],
          source: extraction.source,
        });
      }
    }
  }

  // Build merged result
  const mergedTokens: any[] = [];
  const mergedByCategory: Record<string, any> = {
    colors: [], spacing: [], typography: [], shadows: [],
    'motion-transitions': [], 'motion-animations': [],
    'layout-breakpoints': [], 'layout-grid': [], custom: [],
  };

  for (const [category, data] of categoryOwnership) {
    mergedByCategory[category] = data.tokens;
    mergedTokens.push(...data.tokens);
  }

  const statsByCategory: Record<string, number> = {};
  for (const [cat, tokens] of Object.entries(mergedByCategory)) {
    statsByCategory[cat] = (tokens as any[]).length;
  }

  return {
    tokens: mergedTokens,
    byCategory: mergedByCategory as ExtractionResult['byCategory'],
    stats: {
      total: mergedTokens.length,
      byCategory: statsByCategory,
      unclassified: (mergedByCategory['custom'] as any[])?.length || 0,
    },
  };
}

/**
 * Merge component extractions from multiple sources.
 * Last source wins per component name.
 */
function composeComponents(extractions: LayerExtraction[]): ComponentExtractionResult | null {
  const compExtractions = extractions.filter(e => e.components !== null);
  if (compExtractions.length === 0) return null;
  if (compExtractions.length === 1) return compExtractions[0].components!;

  // Merge components: last-wins per component name
  const componentMap = new Map<string, any>();
  const sharedRules: any[] = [];

  for (const extraction of compExtractions) {
    const c = extraction.components!;
    for (const component of c.components) {
      componentMap.set(component.name, component);
    }
    sharedRules.push(...c.sharedRules);
  }

  const mergedComponents = Array.from(componentMap.values());
  const bySource: Record<string, number> = {};
  for (const comp of mergedComponents) {
    bySource[comp.source] = (bySource[comp.source] || 0) + 1;
  }

  return {
    components: mergedComponents,
    sharedRules,
    stats: {
      total: mergedComponents.length,
      bySource,
      selectorCount: mergedComponents.reduce((sum: number, c: any) => sum + c.selectors.length, 0),
    },
  };
}
