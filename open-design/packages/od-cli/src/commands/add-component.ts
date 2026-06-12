/**
 * `od design add component {name}` — Add a component from DS
 */

import { Command } from 'commander';
import { log } from '../utils/logger.js';

export function addComponentCommand(): Command {
  const cmd = new Command('add');

  cmd
    .description('Add a component from design system')
    .argument('<type>', 'Component type (currently only "component" supported)')
    .argument('<name>', 'Component name')
    .option('--project <path>', 'Target project path', process.cwd())
    .action(async (type, name, options) => {
      log.heading('od design add');
      log.warn('Add component is not yet fully implemented.');
      log.info(`To add component "${name}", re-init with: od design init --from <ds-name> --force`);
    });

  return cmd;
}
