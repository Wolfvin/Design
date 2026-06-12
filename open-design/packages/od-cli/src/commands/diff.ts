/**
 * `od design diff` — Show pending changes
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile } from '../utils/fs-utils.js';
import { hashDesignSystemSource } from '../core/hash.js';

export function diffCommand(): Command {
  const cmd = new Command('diff');

  cmd
    .description('Show pending changes (what would update do)')
    .option('--project <path>', 'Target project path', process.cwd())
    .action(async (options) => {
      const designDir = join(resolve(options.project), 'design');

      if (!(await dirExists(designDir))) {
        log.error('No design/ directory found.');
        process.exit(1);
      }

      const manifestPath = join(designDir, 'manifest.json');
      if (!(await fileExists(manifestPath))) {
        log.error('No manifest.json in design/.');
        process.exit(1);
      }

      const manifest = await readJsonFile<any>(manifestPath);
      const dsName = manifest.source?.designSystem;

      // Find source DS
      let dsDir = '';
      const repoRoot = process.env.OD_REPO_ROOT;
      const candidates = [
        join(resolve(options.project), 'design-systems', dsName),
      ];
      if (repoRoot) candidates.push(join(repoRoot, 'design-systems', dsName));

      for (const c of candidates) {
        if (await dirExists(c)) { dsDir = c; break; }
      }

      if (!dsDir) {
        log.error(`Source DS "${dsName}" not found.`);
        process.exit(1);
      }

      const dsManifest = await readJsonFile<any>(join(dsDir, 'manifest.json'));
      const newHash = await hashDesignSystemSource(dsDir, dsManifest.files || {});

      if (newHash === manifest.source?.repoHash) {
        log.success('Design system is up to date — no pending changes.');
        return;
      }

      log.heading('Pending Changes');
      console.log(`  Current hash: ${manifest.source?.repoHash}`);
      console.log(`  New hash:     ${newHash}`);
      console.log(`  Source:       ${dsName}`);
      console.log('');
      log.info('Run "od design update" to apply changes.');
    });

  return cmd;
}
