#!/usr/bin/env node

/**
 * Open Design CLI — Generate and manage project-local design systems
 *
 * Usage:
 *   od design init --from apple --project ./my-project
 *   od design update
 *   od design sources
 *   od design switch --from brutalism
 *   od design rollback
 *   od design diff
 *   od design status
 *   od design add component button
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';
import { switchCommand } from './commands/switch.js';
import { sourcesCommand } from './commands/sources.js';
import { rollbackCommand } from './commands/rollback.js';
import { diffCommand } from './commands/diff.js';
import { addComponentCommand } from './commands/add-component.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('od')
  .description('Open Design CLI — generate and manage project-local design systems')
  .version('0.2.0');

const designCmd = program.command('design').description('Design system management');

designCmd.addCommand(initCommand());
designCmd.addCommand(updateCommand());
designCmd.addCommand(switchCommand());
designCmd.addCommand(sourcesCommand());
designCmd.addCommand(rollbackCommand());
designCmd.addCommand(diffCommand());
designCmd.addCommand(addComponentCommand());
designCmd.addCommand(statusCommand());

program.parse();
