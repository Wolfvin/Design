/**
 * `od design init --from {name}` — Initialize design/ from a source DS
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, readTextFile, writeIfChanged, detectProjectStack } from '../utils/fs-utils.js';
import { extractTokens, writeTokenFiles } from '../core/token-extractor.js';
import { extractComponents, writeComponentFiles } from '../core/component-forge.js';
import { generateManifest, generateContract, generateExecutionPlan, generateIndexCss, generateTailwindCss } from '../core/generators.js';

export function initCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Initialize design/ from a source design system')
    .requiredOption('--from <name>', 'Source design system name (e.g., apple, brutalism, supabase)')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--strategy <type>', 'CSS strategy: custom-properties | tailwind-theme | js-tokens', '')
    .option('--force', 'Overwrite existing design/ directory', false)
    .action(async (options) => {
      const projectPath = resolve(options.project);
      const dsName = options.from;
      const force = options.force;

      log.heading(`od design init — from ${dsName}`);

      // ── Step 1: Validate source DS ────────────────────────────
      log.step(1, 8, 'Validating source design system...');

      // Find the DS directory - check multiple possible locations
      const dsDirCandidates = [
        join(projectPath, 'design-systems', dsName),
        join(projectPath, 'open-design', 'design-systems', dsName),
        join(projectPath, 'Design', 'open-design', 'design-systems', dsName),
      ];

      // Also try relative to the od-cli package
      const cliDir = import.meta.dirname || __dirname;
      dsDirCandidates.push(
        resolve(cliDir, '..', '..', '..', 'design-systems', dsName),
        resolve(cliDir, '..', '..', '..', '..', 'design-systems', dsName),
      );

      let dsDir = '';
      for (const candidate of dsDirCandidates) {
        if (await dirExists(candidate)) {
          dsDir = candidate;
          break;
        }
      }

      // Allow absolute path or env variable
      if (!dsDir) {
        const repoRoot = process.env.OD_REPO_ROOT;
        if (repoRoot) {
          const candidate = join(repoRoot, 'design-systems', dsName);
          if (await dirExists(candidate)) {
            dsDir = candidate;
          }
        }
      }

      if (!dsDir) {
        log.error(`Design system "${dsName}" not found. Searched:`);
        for (const c of dsDirCandidates) {
          log.dim(`  - ${c}`);
        }
        log.dim('Set OD_REPO_ROOT env variable to your open-design repo root.');
        process.exit(1);
      }

      const manifestPath = join(dsDir, 'manifest.json');
      if (!(await fileExists(manifestPath))) {
        log.error(`No manifest.json found in ${dsDir}`);
        process.exit(1);
      }

      const dsManifest = await readJsonFile<Record<string, unknown>>(manifestPath);
      log.success(`Found ${dsName} (${(dsManifest as any).category || 'unknown category'})`);

      // ── Step 2: Check for existing design/ ─────────────────────
      const designDir = join(projectPath, 'design');

      if (await dirExists(designDir)) {
        if (!force) {
          const manifestExists = await fileExists(join(designDir, 'manifest.json'));
          if (manifestExists) {
            log.error(`design/ already exists. Use --force to overwrite, or run "od design update" instead.`);
            process.exit(1);
          }
        }
        log.warn('Overwriting existing design/ (--force)');
      }

      // ── Step 3: Detect project stack ───────────────────────────
      log.step(2, 8, 'Detecting project stack...');

      let stack = await detectProjectStack(projectPath);
      if (options.strategy) {
        const strategyMap: Record<string, string> = {
          'custom-properties': 'custom-properties',
          'tailwind-theme': 'tailwind-theme',
          'js-tokens': 'js-tokens',
        };
        const override = strategyMap[options.strategy];
        if (override) {
          stack = { ...stack, cssStrategy: override as any };
          log.info(`Strategy overridden to: ${override}`);
        }
      }

      log.success(`Stack: ${stack.stack} | Strategy: ${stack.cssStrategy}`);
      if (stack.cssEntry) log.info(`CSS entry: ${stack.cssEntry}`);

      // ── Step 4: Read source tokens ─────────────────────────────
      log.step(3, 8, 'Extracting tokens...');

      const tokensPath = join(dsDir, (dsManifest as any).files?.tokens || 'tokens.css');
      let tokensCss = '';
      if (await fileExists(tokensPath)) {
        tokensCss = await readTextFile(tokensPath);
      } else {
        log.error(`tokens.css not found at ${tokensPath}`);
        process.exit(1);
      }

      const tokenExtraction = extractTokens(tokensCss, dsName);
      log.success(`${tokenExtraction.stats.total} tokens extracted (${tokenExtraction.stats.unclassified} unclassified)`);

      for (const [cat, count] of Object.entries(tokenExtraction.stats.byCategory)) {
        if (count > 0) log.dim(`  ${cat}: ${count}`);
      }

      // ── Step 5: Extract components ─────────────────────────────
      log.step(4, 8, 'Extracting components...');

      const componentExtraction = await extractComponents(dsDir, dsName);
      log.success(`${componentExtraction.stats.total} components extracted`);

      for (const comp of componentExtraction.components) {
        log.dim(`  ${comp.name} (${comp.source}: ${comp.selectors.length} selectors)`);
      }

      if (componentExtraction.sharedRules.length > 0) {
        log.info(`  + ${componentExtraction.sharedRules.length} shared rules → _shared.css`);
      }

      // ── Step 6: Write all files ────────────────────────────────
      log.step(5, 8, 'Writing design/ files...');

      const tokenResult = await writeTokenFiles(designDir, tokenExtraction, dsName);
      log.info(`Tokens: ${tokenResult.written.length} written, ${tokenResult.skipped.length} unchanged`);

      const componentResult = await writeComponentFiles(designDir, componentExtraction, dsName);
      log.info(`Components: ${componentResult.written.length} written, ${componentResult.skipped.length} unchanged`);

      // ── Step 7: Generate metadata ──────────────────────────────
      log.step(6, 8, 'Generating metadata...');

      const manifest = await generateManifest(designDir, dsDir, dsName, (dsManifest as any).files || {}, stack);
      log.success('manifest.json generated');

      const contract = await generateContract(designDir, tokenExtraction, componentExtraction, stack);
      log.success(`contract.json generated (${Object.values(contract.tokens).flat().length} tokens, ${contract.components.length} components)`);

      const plan = await generateExecutionPlan(designDir, dsName, tokenExtraction, componentExtraction, stack);
      log.success('execution-plan.json generated');

      // ── Step 8: Generate entry CSS ─────────────────────────────
      log.step(7, 8, 'Generating entry CSS...');

      await generateIndexCss(designDir, dsName, tokenExtraction, componentExtraction, manifest);
      log.success('index.css generated');

      if (stack.cssStrategy === 'tailwind-theme') {
        await generateTailwindCss(designDir, dsName, tokenExtraction, manifest);
        log.success('tailwind.css generated');
      }

      // ── Step 9: Update project CSS ─────────────────────────────
      log.step(8, 8, 'Updating project imports...');

      if (stack.cssEntry) {
        const cssEntryPath = join(projectPath, stack.cssEntry);
        const importLine = `@import "../design/${stack.cssStrategy === 'tailwind-theme' ? 'tailwind.css' : 'index.css'}";`;

        try {
          const existing = await readTextFile(cssEntryPath);
          if (existing.includes(importLine)) {
            log.info(`Import already exists in ${stack.cssEntry}`);
          } else {
            const updated = `${importLine}\n${existing}`;
            await writeIfChanged(cssEntryPath, updated);
            log.success(`Added import to ${stack.cssEntry}`);
          }
        } catch {
          log.warn(`Could not update ${stack.cssEntry} — add this line manually:`);
          log.dim(`  ${importLine}`);
        }
      } else {
        log.info('No CSS entry file found. Add this to your main CSS file:');
        log.dim(`  @import "./design/index.css";`);
      }

      // ── Summary ───────────────────────────────────────────────
      log.heading('Init Complete!');

      console.log(`  Design System:  \x1b[1m${dsName}\x1b[0m`);
      console.log(`  Strategy:       ${stack.cssStrategy}`);
      console.log(`  Tokens:         ${tokenExtraction.stats.total}`);
      console.log(`  Components:     ${componentExtraction.stats.total}`);
      console.log(`  Entry:          design/${manifest.import.entry}`);
      console.log('');
    });

  return cmd;
}
