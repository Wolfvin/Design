/**
 * `od design rollback` — Restore previous design/ state
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile } from '../utils/fs-utils.js';

export function rollbackCommand(): Command {
  const cmd = new Command('rollback');

  cmd
    .description('Restore previous design/ state')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--list', 'List available rollback points', false)
    .option('--to <hash>', 'Specific hash to rollback to', '')
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

      if (options.list) {
        log.heading('Rollback History');
        if (!manifest.rollback?.history?.length) {
          log.info('No rollback history available.');
          return;
        }
        for (const entry of manifest.rollback.history) {
          console.log(`  \x1b[36m${entry.hash}\x1b[0m ${entry.date} (${entry.source})`);
        }
        return;
      }

      log.warn('Rollback is not yet fully implemented. Re-init with: od design init --from <name> --force');
    });

  return cmd;
}
