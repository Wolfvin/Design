/**
 * `od design switch --from {name}` — Switch to a different DS source
 *
 * Switch behavior:
 * 1. Read current manifest.json → get current DS name
 * 2. Find the NEW source DS
 * 3. If --keep-customizations: preserve override/add extensions
 * 4. If --reset: full re-init (delete design/ and start fresh)
 * 5. Default: re-init from new source, preserve extensions
 * 6. Update manifest with new source info + rollback history
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { rm } from 'node:fs/promises';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, writeJsonFile, ensureDir, writeIfChanged, readTextFile } from '../utils/fs-utils.js';
import { extractTokens, writeTokenFiles } from '../core/token-extractor.js';
import { extractComponents, writeComponentFiles } from '../core/component-forge.js';
import { generateManifest, generateContract, generateExecutionPlan, generateIndexCss, generateTailwindCss } from '../core/generators.js';
import { hashDesignDirectory, hashDesignSystemSource } from '../core/hash.js';
import { detectProjectStack } from '../utils/fs-utils.js';

export function switchCommand(): Command {
  const cmd = new Command('switch');

  cmd
    .description('Switch to a different design system source')
    .requiredOption('--from <name>', 'New source design system name')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--strategy <type>', 'CSS strategy: custom-properties | tailwind-theme | js-tokens', '')
    .option('--keep-customizations', 'Preserve override/add extensions', false)
    .option('--reset', 'Full reset — delete and re-init design/', false)
    .action(async (options) => {
      const projectPath = resolve(options.project);
      const designDir = join(projectPath, 'design');
      const newDsName = options.from;

      log.heading(`od design switch — from ${newDsName}`);

      // ── Check design/ exists ──────────────────────────────────
      if (!(await dirExists(designDir))) {
        log.error('No design/ directory found. Run "od design init" first.');
        process.exit(1);
      }

      const manifestPath = join(designDir, 'manifest.json');
      if (!(await fileExists(manifestPath))) {
        log.error('No manifest.json in design/. Run "od design init" first.');
        process.exit(1);
      }

      const manifest = await readJsonFile<any>(manifestPath);
      const oldDsName = manifest.source?.designSystem;

      if (oldDsName === newDsName) {
        log.warn(`Already using "${newDsName}". No switch needed.`);
        return;
      }

      log.info(`Switching: ${oldDsName} → ${newDsName}`);

      // ── Preserve extensions if --keep-customizations ──────────
      let extensions: any[] = [];
      let preservedFiles: Record<string, string> = {};

      if (options.keepCustomizations) {
        extensions = manifest.extensions || [];
        const overrideFiles = extensions.filter((e: any) => e.type === 'override' || e.type === 'add');
        for (const ext of overrideFiles) {
          const fullPath = join(designDir, ext.file);
          if (await fileExists(fullPath)) {
            preservedFiles[ext.file] = await readTextFile(fullPath);
            log.info(`Preserving: ${ext.file} (${ext.type})`);
          }
        }
      }

      // ── Find new source DS ────────────────────────────────────
      let dsDir = '';
      const repoRoot = process.env.OD_REPO_ROOT;
      const candidates = [
        join(projectPath, 'design-systems', newDsName),
        join(projectPath, 'open-design', 'design-systems', newDsName),
        join(projectPath, 'Design', 'open-design', 'design-systems', newDsName),
      ];
      if (repoRoot) candidates.push(join(repoRoot, 'design-systems', newDsName));

      for (const c of candidates) {
        if (await dirExists(c)) { dsDir = c; break; }
      }

      if (!dsDir) {
        log.error(`Source DS "${newDsName}" not found. Set OD_REPO_ROOT env variable.`);
        process.exit(1);
      }

      const dsManifest = await readJsonFile<any>(join(dsDir, 'manifest.json'));
      log.success(`Found ${newDsName} (${dsManifest.category || 'unknown category'})`);

      // ── Handle --reset mode ───────────────────────────────────
      if (options.reset) {
        log.step(1, 6, 'Resetting design/ (--reset)...');
        await rm(designDir, { recursive: true, force: true });
        await ensureDir(designDir);
      } else {
        log.step(1, 6, 'Recording rollback point...');
        // Store current state in rollback history
        const currentHash = await hashDesignDirectory(designDir);
        manifest.rollback.history = manifest.rollback.history || [];
        manifest.rollback.history.unshift({
          hash: currentHash,
          date: new Date().toISOString(),
          source: oldDsName,
          repoHash: manifest.source?.repoHash || 'unknown',
          note: `pre-switch from ${oldDsName}`,
        });
      }

      // ── Detect project stack ──────────────────────────────────
      log.step(2, 6, 'Detecting project stack...');
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

      // ── Extract tokens ────────────────────────────────────────
      log.step(3, 6, 'Extracting tokens...');
      const tokensCss = await readTextFile(join(dsDir, dsManifest.files?.tokens || 'tokens.css'));
      const tokenExtraction = extractTokens(tokensCss, newDsName);
      log.success(`${tokenExtraction.stats.total} tokens extracted`);

      // ── Extract components ────────────────────────────────────
      log.step(4, 6, 'Extracting components...');
      const componentExtraction = await extractComponents(dsDir, newDsName);
      log.success(`${componentExtraction.stats.total} components extracted`);

      // ── Write all files ──────────────────────────────────────
      log.step(5, 6, 'Writing design/ files...');
      await writeTokenFiles(designDir, tokenExtraction, newDsName);
      await writeComponentFiles(designDir, componentExtraction, newDsName);

      // Restore preserved customizations
      let restoredCount = 0;
      if (options.keepCustomizations) {
        for (const [file, content] of Object.entries(preservedFiles)) {
          const fullPath = join(designDir, file);
          await writeIfChanged(fullPath, content);
          restoredCount++;
        }
        if (restoredCount > 0) {
          log.success(`Restored ${restoredCount} customized file(s)`);
        }
      }

      // ── Generate metadata ─────────────────────────────────────
      log.step(6, 6, 'Generating metadata...');

      const newManifest = await generateManifest(designDir, dsDir, newDsName, dsManifest.files || {}, stack);

      // Transfer rollback history if not reset
      if (!options.reset) {
        newManifest.rollback = manifest.rollback;
        newManifest.rollback.lastStableHash = manifest.rollback.history?.[0]?.hash || null;
        newManifest.rollback.lastStableAt = manifest.rollback.history?.[0]?.date || null;
      }

      // Re-add extensions for preserved files
      if (options.keepCustomizations && Object.keys(preservedFiles).length > 0) {
        for (const file of Object.keys(preservedFiles)) {
          const existing = newManifest.extensions.find((e: any) => e.file === file);
          if (!existing) {
            newManifest.extensions.push({
              type: 'override',
              file,
              addedBy: 'switch --keep-customizations',
              addedAt: new Date().toISOString(),
            });
          }
        }
      }

      await generateContract(designDir, tokenExtraction, componentExtraction, stack);
      await generateExecutionPlan(designDir, newDsName, tokenExtraction, componentExtraction, stack);
      await generateIndexCss(designDir, newDsName, tokenExtraction, componentExtraction, newManifest);

      if (stack.cssStrategy === 'tailwind-theme') {
        await generateTailwindCss(designDir, newDsName, tokenExtraction, newManifest);
      }

      // Write final manifest
      await writeJsonFile(manifestPath, newManifest);

      // ── Summary ───────────────────────────────────────────────
      log.heading('Switch Complete!');
      console.log(`  Previous:       \x1b[2m${oldDsName}\x1b[0m`);
      console.log(`  Current:        \x1b[1m${newDsName}\x1b[0m`);
      console.log(`  Strategy:       ${stack.cssStrategy}`);
      console.log(`  Tokens:         ${tokenExtraction.stats.total}`);
      console.log(`  Components:     ${componentExtraction.stats.total}`);
      console.log(`  Preserved:      ${restoredCount} custom file(s)`);
      console.log('');
      log.dim('Run "od design rollback" if you want to switch back.');
    });

  return cmd;
}
