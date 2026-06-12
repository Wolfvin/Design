/**
 * `od design switch --from {name}` — Switch to a different DS source
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile } from '../utils/fs-utils.js';

export function switchCommand(): Command {
  const cmd = new Command('switch');

  cmd
    .description('Switch to a different design system source')
    .requiredOption('--from <name>', 'New source design system name')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--keep-customizations', 'Preserve override/add extensions', false)
    .option('--reset', 'Full reset — delete and re-init', false)
    .action(async (options) => {
      log.heading('od design switch');
      log.warn('Switch command is not yet fully implemented. Use init --force for now.');
      log.info(`To switch to ${options.from}: od design init --from ${options.from} --force`);
    });

  return cmd;
}
