/**
 * `od design rollback` — Restore previous design/ state by re-generating from history
 *
 * Rollback strategy:
 * 1. Read manifest.json → rollback.history
 * 2. Find the target hash entry (last stable or specific --to hash)
 * 3. Re-generate design/ from the source DS at the recorded version
 * 4. Since we can't time-travel the source DS, we re-init from current source
 *    and update the manifest to reflect the rollback
 * 5. Preserve extensions[] (user modifications) during rollback
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, writeJsonFile, ensureDir, writeIfChanged } from '../utils/fs-utils.js';
import { extractTokens, writeTokenFiles } from '../core/token-extractor.js';
import { extractComponents, writeComponentFiles } from '../core/component-forge.js';
import { generateContract, generateExecutionPlan, generateIndexCss } from '../core/generators.js';
import { hashDesignDirectory } from '../core/hash.js';

export function rollbackCommand(): Command {
  const cmd = new Command('rollback');

  cmd
    .description('Restore previous design/ state')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--list', 'List available rollback points', false)
    .option('--to <hash>', 'Specific hash to rollback to', '')
    .action(async (options) => {
      const projectPath = resolve(options.project);
      const designDir = join(projectPath, 'design');

      log.heading('od design rollback');

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

      // ── List mode ─────────────────────────────────────────────
      if (options.list) {
        log.heading('Rollback History');
        const history = manifest.rollback?.history || [];
        if (history.length === 0) {
          log.info('No rollback history available.');
          log.dim('Rollback points are created automatically when you run "od design update".');
          return;
        }

        console.log('');
        for (let i = 0; i < history.length; i++) {
          const entry = history[i];
          const isCurrent = i === 0;
          const marker = isCurrent ? '\x1b[32m← current\x1b[0m' : '';
          console.log(`  \x1b[36m${entry.hash}\x1b[0m  ${entry.date}  (${entry.source})  ${marker}`);
        }
        console.log('');
        log.info(`Last stable: ${manifest.rollback?.lastStableHash || 'none'}`);
        return;
      }

      // ── Find target hash ──────────────────────────────────────
      const history = manifest.rollback?.history || [];
      let targetEntry: any = null;

      if (options.to) {
        // Find specific hash
        targetEntry = history.find((h: any) => h.hash === options.to);
        if (!targetEntry) {
          log.error(`Hash "${options.to}" not found in rollback history.`);
          log.info('Use --list to see available rollback points.');
          process.exit(1);
        }
      } else {
        // Rollback to last stable
        const lastStableHash = manifest.rollback?.lastStableHash;
        if (!lastStableHash) {
          log.error('No stable rollback point available.');
          log.info('Run "od design update" first to create a rollback point.');
          process.exit(1);
        }
        targetEntry = history.find((h: any) => h.hash === lastStableHash);
        if (!targetEntry) {
          log.error(`Last stable hash "${lastStableHash}" not found in history.`);
          process.exit(1);
        }
      }

      log.info(`Rolling back to: ${targetEntry.hash} (${targetEntry.source}, ${targetEntry.date})`);

      // ── Preserve extensions before rollback ───────────────────
      const extensions: Array<{ type: string; file: string; [key: string]: any }> = manifest.extensions || [];
      const overrideFiles = new Set<string>(
        extensions.filter(e => e.type === 'override').map(e => e.file)
      );
      const addFiles = new Set<string>(
        extensions.filter(e => e.type === 'add').map(e => e.file)
      );

      // Read override/add file contents to preserve them
      const preservedFiles: Record<string, string> = {};
      for (const file of [...overrideFiles, ...addFiles]) {
        const fullPath = join(designDir, file);
        if (await fileExists(fullPath)) {
          const { readTextFile } = await import('../utils/fs-utils.js');
          preservedFiles[file] = await readTextFile(fullPath);
          const ext = extensions.find(e => e.file === file);
          log.info(`Preserving: ${file} (${ext?.type})`);
        }
      }

      // ── Find source DS and re-init ───────────────────────────
      const dsName = targetEntry.source || manifest.source?.designSystem;
      if (!dsName) {
        log.error('Cannot determine source design system from rollback entry.');
        process.exit(1);
      }

      log.step(1, 4, `Re-generating from ${dsName}...`);

      // Find source DS directory
      let dsDir = '';
      const repoRoot = process.env.OD_REPO_ROOT;
      const candidates = [
        join(projectPath, 'design-systems', dsName),
        join(projectPath, 'open-design', 'design-systems', dsName),
        join(projectPath, 'Design', 'open-design', 'design-systems', dsName),
      ];
      if (repoRoot) candidates.push(join(repoRoot, 'design-systems', dsName));

      for (const c of candidates) {
        if (await dirExists(c)) { dsDir = c; break; }
      }

      if (!dsDir) {
        log.error(`Source DS "${dsName}" not found. Set OD_REPO_ROOT env variable.`);
        process.exit(1);
      }

      // Re-extract tokens
      const dsManifest = await readJsonFile<any>(join(dsDir, 'manifest.json'));
      const { readTextFile } = await import('../utils/fs-utils.js');
      const tokensCss = await readTextFile(join(dsDir, dsManifest.files?.tokens || 'tokens.css'));
      const tokenExtraction = extractTokens(tokensCss, dsName);

      // Re-extract components
      const componentExtraction = await extractComponents(dsDir, dsName);

      // Write token files
      log.step(2, 4, 'Writing design/ files...');
      await writeTokenFiles(designDir, tokenExtraction, dsName);
      await writeComponentFiles(designDir, componentExtraction, dsName);

      // ── Restore preserved override/add files ──────────────────
      log.step(3, 4, 'Restoring customizations...');
      let restoredCount = 0;
      for (const [file, content] of Object.entries(preservedFiles)) {
        const fullPath = join(designDir, file);
        await writeIfChanged(fullPath, content);
        restoredCount++;
      }
      if (restoredCount > 0) {
        log.success(`Restored ${restoredCount} customized file(s)`);
      }

      // ── Update manifest ──────────────────────────────────────
      log.step(4, 4, 'Updating manifest...');

      // Add current state to history before rolling back
      const currentHash = await hashDesignDirectory(designDir);
      manifest.rollback.history = manifest.rollback.history || [];
      manifest.rollback.history.unshift({
        hash: currentHash,
        date: new Date().toISOString(),
        source: dsName,
        repoHash: manifest.source?.repoHash || 'unknown',
        note: 'pre-rollback snapshot',
      });

      // Update manifest source — this is critical for rollback to switch back
      manifest.source.designSystem = dsName;
      manifest.source.repoHash = targetEntry.repoHash;
      manifest.source.generatedAt = new Date().toISOString();
      manifest.rollback.lastStableHash = targetEntry.hash;
      manifest.rollback.lastStableAt = new Date().toISOString();

      // Regenerate metadata
      const stack = { stack: manifest.stack, cssStrategy: manifest.cssStrategy, cssEntry: null };
      await generateContract(designDir, tokenExtraction, componentExtraction, stack as any);
      await generateExecutionPlan(designDir, dsName, tokenExtraction, componentExtraction, stack as any);
      await generateIndexCss(designDir, dsName, tokenExtraction, componentExtraction, manifest);
      await writeJsonFile(manifestPath, manifest);

      // ── Summary ───────────────────────────────────────────────
      log.heading('Rollback Complete!');
      console.log(`  Rolled back to: \x1b[1m${targetEntry.hash}\x1b[0m`);
      console.log(`  Source:         ${dsName}`);
      console.log(`  Tokens:         ${tokenExtraction.stats.total}`);
      console.log(`  Components:     ${componentExtraction.stats.total}`);
      console.log(`  Preserved:      ${restoredCount} custom file(s)`);
      console.log('');
    });

  return cmd;
}
