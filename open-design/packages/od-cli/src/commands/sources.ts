/**
 * `od design sources` — List available DS packages
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { dirExists, fileExists, readJsonFile, listDirs } from '../utils/fs-utils.js';

export function sourcesCommand(): Command {
  const cmd = new Command('sources');

  cmd
    .description('List available design system packages')
    .option('--json', 'Output as JSON', false)
    .option('--filter <category>', 'Filter by category', '')
    .action(async (options) => {
      const repoRoot = process.env.OD_REPO_ROOT;
      const candidates = [
        join(process.cwd(), 'design-systems'),
        join(process.cwd(), 'open-design', 'design-systems'),
        join(process.cwd(), 'Design', 'open-design', 'design-systems'),
      ];
      if (repoRoot) candidates.push(join(repoRoot, 'design-systems'));

      let dsRoot = '';
      for (const c of candidates) {
        if (await dirExists(c)) { dsRoot = c; break; }
      }

      if (!dsRoot) {
        log.error('design-systems/ directory not found. Set OD_REPO_ROOT env variable.');
        process.exit(1);
      }

      const dirs = await listDirs(dsRoot);
      const packages: Array<{ name: string; category: string; description: string }> = [];

      for (const dir of dirs) {
        if (dir.startsWith('_') || dir === 'node_modules') continue;
        const manifestPath = join(dsRoot, dir, 'manifest.json');
        if (await fileExists(manifestPath)) {
          try {
            const m = await readJsonFile<any>(manifestPath);
            packages.push({
              name: m.id || dir,
              category: m.category || 'Unknown',
              description: m.description || '',
            });
          } catch {
            packages.push({ name: dir, category: 'Unknown', description: '' });
          }
        }
      }

      if (options.json) {
        console.log(JSON.stringify(packages, null, 2));
        return;
      }

      log.heading(`Available Design Systems (${packages.length})`);

      // Group by category
      const byCategory: Record<string, typeof packages> = {};
      for (const pkg of packages) {
        if (options.filter && !pkg.category.toLowerCase().includes(options.filter.toLowerCase())) continue;
        if (!byCategory[pkg.category]) byCategory[pkg.category] = [];
        byCategory[pkg.category].push(pkg);
      }

      for (const [category, pkgs] of Object.entries(byCategory).sort()) {
        console.log(`\n  \x1b[1m${category}\x1b[0m`);
        for (const pkg of pkgs) {
          console.log(`    \x1b[36m${pkg.name}\x1b[0m ${pkg.description ? '— ' + pkg.description.slice(0, 60) : ''}`);
        }
      }
      console.log('');
    });

  return cmd;
}
