/**
 * `od design update` — Smart sync from source DS
 *
 * Update flow:
 * 1. Read manifest.json → source DS name and hash
 * 2. Find source DS and compute current hash
 * 3. If hashes match → already up to date
 * 4. If hashes differ → smart merge:
 *    - Skip files in extensions[] with type: override (user modified)
 *    - Skip files in extensions[] with type: add (user added)
 *    - Regenerate all other files from source
 * 5. Store previous state in rollback history
 * 6. Generate update report
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, readTextFile, writeJsonFile, writeIfChanged } from '../utils/fs-utils.js';
import { extractTokens, writeTokenFiles } from '../core/token-extractor.js';
import { extractComponents, writeComponentFiles } from '../core/component-forge.js';
import { generateContract, generateExecutionPlan, generateIndexCss, generateTailwindCss } from '../core/generators.js';
import { generateCssModulesFiles, generateJsTokensFiles, generateUpdateReport, type UpdateReport } from '../core/strategies.js';
import { hashDesignSystemSource, hashDesignDirectory } from '../core/hash.js';

export function updateCommand(): Command {
  const cmd = new Command('update');

  cmd
    .description('Smart sync design/ from source DS (preserves user modifications)')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--force', 'Force update even if hash matches', false)
    .option('--dry-run', 'Show what would change without writing', false)
    .option('--report', 'Generate update report markdown file', false)
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

      // ── Read current contract for comparison ──────────────────
      const contractPath = join(designDir, 'contract.json');
      let oldContract: any = null;
      if (await fileExists(contractPath)) {
        oldContract = await readJsonFile<any>(contractPath);
      }

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

      const oldHash = manifest.source?.repoHash || 'unknown';
      log.info(`New repoHash: ${newHash} (was: ${oldHash})`);

      // ── Backup for rollback ───────────────────────────────────
      const currentHash = await hashDesignDirectory(designDir);
      log.info(`Current design/ hash: ${currentHash}`);

      if (options.dryRun) {
        log.heading('Dry Run — would update:');
        log.info('Source DS has changed. Files would be regenerated.');

        const extensions = manifest.extensions || [];
        const overrideFiles = extensions.filter((e: any) => e.type === 'override');
        const addFiles = extensions.filter((e: any) => e.type === 'add');

        if (overrideFiles.length > 0) {
          log.info(`Skipped (${overrideFiles.length} user-modified files):`);
          for (const e of overrideFiles) {
            log.dim(`  ${e.file} (override)`);
          }
        }
        if (addFiles.length > 0) {
          log.info(`Preserved (${addFiles.length} user-added files):`);
          for (const e of addFiles) {
            log.dim(`  ${e.file} (add)`);
          }
        }
        return;
      }

      // ── Smart merge ───────────────────────────────────────────
      const extensions: Array<{ type: string; file: string; [key: string]: any }> = manifest.extensions || [];
      const overrideFiles = new Set<string>(
        extensions.filter(e => e.type === 'override').map(e => e.file)
      );
      const addFiles = new Set<string>(
        extensions.filter(e => e.type === 'add').map(e => e.file)
      );

      log.step(1, 5, 'Re-extracting tokens...');

      // Re-extract tokens
      const tokensCss = await readTextFile(join(dsDir, dsManifest.files?.tokens || 'tokens.css'));
      const tokenExtraction = extractTokens(tokensCss, dsName);
      log.success(`${tokenExtraction.stats.total} tokens extracted`);

      log.step(2, 5, 'Re-extracting components...');

      // Re-extract components
      const componentExtraction = await extractComponents(dsDir, dsName);
      log.success(`${componentExtraction.stats.total} components extracted`);

      // ── Track file changes ────────────────────────────────────
      const oldTokenNames = new Set<string>(
        oldContract?.tokens ? (Object.values(oldContract.tokens) as string[][]).flat() : []
      );
      const newTokenNames = tokenExtraction.tokens.map(t => t.name);
      const oldComponentNames = new Set<string>(
        oldContract?.components?.map((c: any) => c.name as string) || []
      );

      // Write updated files (respecting overrides)
      log.step(3, 5, 'Writing files (preserving overrides)...');
      const tokenResult = await writeTokenFiles(designDir, tokenExtraction, dsName);
      const componentResult = await writeComponentFiles(designDir, componentExtraction, dsName);

      // ── Update manifest ───────────────────────────────────────
      log.step(4, 5, 'Updating metadata...');

      manifest.source.repoHash = newHash;
      manifest.source.generatedAt = new Date().toISOString();
      manifest.rollback.lastStableHash = currentHash;
      manifest.rollback.lastStableAt = new Date().toISOString();
      manifest.rollback.history = manifest.rollback.history || [];
      manifest.rollback.history.unshift({
        hash: currentHash,
        date: new Date().toISOString(),
        source: dsName,
        repoHash: oldHash,
      });

      // Regenerate metadata
      const stack = { stack: manifest.stack, cssStrategy: manifest.cssStrategy, cssEntry: null };
      const newContract = await generateContract(designDir, tokenExtraction, componentExtraction, stack as any);
      await generateExecutionPlan(designDir, dsName, tokenExtraction, componentExtraction, stack as any);
      await generateIndexCss(designDir, dsName, tokenExtraction, componentExtraction, manifest);

      // Strategy-specific regeneration
      if (stack.cssStrategy === 'tailwind-theme') {
        await generateTailwindCss(designDir, dsName, tokenExtraction, manifest);
      }
      if (stack.cssStrategy === 'css-modules') {
        await generateCssModulesFiles(designDir, dsName, tokenExtraction, componentExtraction, manifest);
      }
      if (stack.cssStrategy === 'js-tokens') {
        await generateJsTokensFiles(designDir, dsName, tokenExtraction);
      }

      await writeJsonFile(manifestPath, manifest);

      // ── Generate update report ────────────────────────────────
      log.step(5, 5, 'Generating report...');

      const newTokenSet = new Set(newTokenNames);
      const addedTokens: string[] = newTokenNames.filter(t => !oldTokenNames.has(t));
      const removedTokens: string[] = [...oldTokenNames].filter(t => !newTokenSet.has(t));
      const addedComponents = componentExtraction.components
        .map(c => c.name)
        .filter(n => !oldComponentNames.has(n));

      // Detect changed selectors
      const changedSelectors: UpdateReport['changedSelectors'] = [];
      if (oldContract?.components) {
        for (const comp of componentExtraction.components) {
          const oldComp = oldContract.components.find((c: any) => c.name === comp.name);
          if (oldComp) {
            const oldSel = new Set(oldComp.selectors || []);
            const newSel = comp.selectors.filter(s => !oldSel.has(s));
            if (newSel.length > 0) {
              changedSelectors.push({
                component: comp.name,
                from: oldComp.selectors || [],
                to: comp.selectors,
              });
            }
          }
        }
      }

      const skippedFiles: string[] = [...overrideFiles].filter(f =>
        tokenResult.skipped.includes(f) || componentResult.skipped.includes(f)
      );

      const report: UpdateReport = {
        source: dsName,
        oldHash,
        newHash,
        updated: [...tokenResult.written, ...componentResult.written],
        skipped: skippedFiles,
        added: addedComponents.map(n => `components/${n}.css`),
        removed: [],
        newTokens: addedTokens,
        removedTokens,
        newComponents: addedComponents,
        changedSelectors,
        rollbackAvailable: true,
        rollbackHash: currentHash,
      };

      const reportMarkdown = generateUpdateReport(report);

      if (options.report) {
        await writeIfChanged(join(designDir, 'UPDATE-REPORT.md'), reportMarkdown);
        log.success('UPDATE-REPORT.md generated');
      }

      // ── Summary ───────────────────────────────────────────────
      log.heading('Update Complete!');
      console.log(`  Source:     ${dsName} (${oldHash} → ${newHash})`);
      console.log(`  Updated:    ${report.updated.length} files`);
      console.log(`  Skipped:    ${report.skipped.length} files (user modified)`);
      console.log(`  Added:      ${report.added.length} new files`);
      if (addedTokens.length > 0) {
        console.log(`  New tokens: ${addedTokens.join(', ')}`);
      }
      if (removedTokens.length > 0) {
        console.log(`  Removed:    ${removedTokens.join(', ')}`);
      }
      console.log(`  Rollback:   hash ${currentHash}`);
      console.log('');
    });

  return cmd;
}
