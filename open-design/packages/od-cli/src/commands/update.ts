/**
 * `od design update` — Smart sync from source DS
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, readTextFile, writeIfChanged } from '../utils/fs-utils.js';
import { extractTokens, writeTokenFiles } from '../core/token-extractor.js';
import { extractComponents, writeComponentFiles } from '../core/component-forge.js';
import { generateManifest, generateContract, generateExecutionPlan, generateIndexCss } from '../core/generators.js';
import { hashDesignSystemSource, hashDesignDirectory } from '../core/hash.js';

export function updateCommand(): Command {
  const cmd = new Command('update');

  cmd
    .description('Smart sync design/ from source DS (preserves user modifications)')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--force', 'Force update even if hash matches', false)
    .option('--dry-run', 'Show what would change without writing', false)
    .action(async (options) => {
      const projectPath = resolve(options.project);
      const designDir = join(projectPath, 'design');

      log.heading('od design update');

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
      const dsName = manifest.source?.designSystem;
      if (!dsName) {
        log.error('manifest.json missing source.designSystem');
        process.exit(1);
      }

      log.info(`Current design system: ${dsName}`);
      log.info(`Current repoHash: ${manifest.source?.repoHash || 'unknown'}`);

      // ── Find source DS ────────────────────────────────────────
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

      // ── Compare hashes ────────────────────────────────────────
      const dsManifest = await readJsonFile<any>(join(dsDir, 'manifest.json'));
      const newHash = await hashDesignSystemSource(dsDir, dsManifest.files || {});

      if (newHash === manifest.source?.repoHash && !options.force) {
        log.success('Design system is already up to date!');
        return;
      }

      log.info(`New repoHash: ${newHash} (was: ${manifest.source?.repoHash})`);

      // ── Backup for rollback ───────────────────────────────────
      const currentHash = await hashDesignDirectory(designDir);
      log.info(`Current design/ hash: ${currentHash}`);

      if (options.dryRun) {
        log.heading('Dry Run — would update:');
        log.info('Source DS has changed. Files would be regenerated.');
        log.info('Files in extensions[] with type: override would be skipped.');
        return;
      }

      // ── Smart merge ───────────────────────────────────────────
      const extensions = manifest.extensions || [];
      const overrideFiles = new Set(
        extensions.filter((e: any) => e.type === 'override').map((e: any) => e.file)
      );
      const addFiles = new Set(
        extensions.filter((e: any) => e.type === 'add').map((e: any) => e.file)
      );

      // Re-extract tokens
      const tokensCss = await readTextFile(join(dsDir, dsManifest.files?.tokens || 'tokens.css'));
      const tokenExtraction = extractTokens(tokensCss, dsName);

      // Re-extract components
      const componentExtraction = await extractComponents(dsDir, dsName);

      // Update manifest
      manifest.source.repoHash = newHash;
      manifest.source.generatedAt = new Date().toISOString();
      manifest.rollback.lastStableHash = currentHash;
      manifest.rollback.lastStableAt = new Date().toISOString();
      manifest.rollback.history = manifest.rollback.history || [];
      manifest.rollback.history.unshift({
        hash: currentHash,
        date: new Date().toISOString(),
        source: dsName,
        repoHash: manifest.source?.repoHash || 'unknown',
      });

      // Write updated files (respecting overrides)
      const tokenResult = await writeTokenFiles(designDir, tokenExtraction, dsName);
      const componentResult = await writeComponentFiles(designDir, componentExtraction, dsName);

      // Regenerate metadata
      const stack = { stack: manifest.stack, cssStrategy: manifest.cssStrategy, cssEntry: null };
      await generateContract(designDir, tokenExtraction, componentExtraction, stack as any);
      await generateExecutionPlan(designDir, dsName, tokenExtraction, componentExtraction, stack as any);
      await generateIndexCss(designDir, dsName, tokenExtraction, componentExtraction, manifest);
      await writeJsonFile(join(designDir, 'manifest.json'), manifest);

      log.heading('Update Complete!');
      console.log(`  Updated:  ${tokenResult.written.length + componentResult.written.length} files`);
      console.log(`  Skipped:  ${tokenResult.skipped.length + componentResult.skipped.length} files (unchanged)`);
      console.log(`  Rollback: hash ${currentHash}`);
    });

  return cmd;
}

// Helper that's used in multiple places
async function writeJsonFile(path: string, data: any) {
  const { writeJsonFile: wjf } = await import('../utils/fs-utils.js');
  await wjf(path, data);
}
