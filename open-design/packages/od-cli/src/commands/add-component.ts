/**
 * `od design add component {name}` — Add a specific component from DS source
 *
 * This command allows adding individual components from the source design system
 * without re-running init. Useful when a project only needs specific components.
 *
 * Flow:
 * 1. Read manifest.json → get current DS name
 * 2. Find source DS directory
 * 3. Extract all components from source
 * 4. Find the requested component by name
 * 5. Write it to design/components/{name}.css
 * 6. Update contract.json and index.css
 * 7. Register as extension in manifest.json
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { log } from '../utils/logger.js';
import { fileExists, dirExists, readJsonFile, writeJsonFile, ensureDir, writeIfChanged, readTextFile } from '../utils/fs-utils.js';
import { extractComponents, generateComponentCss, type ExtractionResult } from '../core/component-forge.js';
import { generateIndexCss } from '../core/generators.js';
import { extractTokens } from '../core/token-extractor.js';
import { hashDesignDirectory } from '../core/hash.js';

export function addComponentCommand(): Command {
  const cmd = new Command('add');

  cmd
    .description('Add a component from design system')
    .argument('<type>', 'Resource type: component')
    .argument('<name>', 'Component name (e.g., button, card, badge)')
    .option('--project <path>', 'Target project path', process.cwd())
    .option('--from <ds>', 'Override source DS (default: current manifest source)', '')
    .action(async (type, name, options) => {
      if (type !== 'component') {
        log.error(`Unknown resource type "${type}". Only "component" is supported.`);
        process.exit(1);
      }

      const projectPath = resolve(options.project);
      const designDir = join(projectPath, 'design');

      log.heading(`od design add component ${name}`);

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
      const dsName = options.from || manifest.source?.designSystem;

      if (!dsName) {
        log.error('Cannot determine source design system. Use --from to specify.');
        process.exit(1);
      }

      // ── Check if component already exists ─────────────────────
      const componentPath = join(designDir, 'components', `${name}.css`);
      if (await fileExists(componentPath)) {
        log.warn(`Component "${name}" already exists at design/components/${name}.css`);
        log.info('To update it, run "od design update". To overwrite, delete it first.');
        return;
      }

      // ── Find source DS ────────────────────────────────────────
      log.step(1, 5, `Finding source DS: ${dsName}...`);

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

      // ── Extract components ────────────────────────────────────
      log.step(2, 5, 'Extracting components from source...');

      const extraction = await extractComponents(dsDir, dsName);

      // Find the requested component
      const component = extraction.components.find(c =>
        c.name === name || c.name === name.replace(/s$/, '') || c.name === `${name}s`
      );

      if (!component) {
        log.error(`Component "${name}" not found in ${dsName}.`);
        log.info('Available components:');
        for (const c of extraction.components) {
          log.dim(`  ${c.name} (${c.selectors.length} selectors)`);
        }
        process.exit(1);
      }

      log.success(`Found component: ${component.name} (${component.selectors.length} selectors)`);

      // ── Write component file ──────────────────────────────────
      log.step(3, 5, 'Writing component file...');

      await ensureDir(join(designDir, 'components'));
      const content = generateComponentCss(component, dsName);
      await writeIfChanged(componentPath, content);
      log.success(`Written: design/components/${name}.css`);

      // ── Update manifest ───────────────────────────────────────
      log.step(4, 5, 'Updating manifest...');

      // Add as extension
      if (!manifest.extensions) manifest.extensions = [];
      manifest.extensions.push({
        type: 'add',
        file: `components/${name}.css`,
        originalHash: null,
        currentHash: null,
        addedBy: 'od-cli add-component',
        addedAt: new Date().toISOString(),
      });

      await writeJsonFile(manifestPath, manifest);
      log.success('manifest.json updated');

      // ── Update index.css and contract.json ────────────────────
      log.step(5, 5, 'Regenerating index.css and contract.json...');

      // Re-read tokens for index.css generation
      const contractPath = join(designDir, 'contract.json');
      const contract = await readJsonFile<any>(contractPath);

      // Add component to contract
      if (!contract.components) contract.components = [];
      const existingComp = contract.components.find((c: any) => c.name === name);
      if (!existingComp) {
        contract.components.push({
          name: component.name,
          file: `components/${name}.css`,
          selectors: component.selectors,
        });
      }
      await writeJsonFile(contractPath, contract);

      // Regenerate index.css
      const tokensCss = await readTextFile(join(dsDir, (await readJsonFile<any>(join(dsDir, 'manifest.json'))).files?.tokens || 'tokens.css'));
      const tokenExtraction = extractTokens(tokensCss, dsName);

      // Re-extract all components (including the new one)
      const fullExtraction = await extractComponents(dsDir, dsName);

      // Check if the component exists in the source — if it was heuristically matched,
      // we need to make sure index.css includes it
      await generateIndexCss(designDir, dsName, tokenExtraction, fullExtraction, manifest);

      log.success('index.css and contract.json updated');

      // ── Summary ───────────────────────────────────────────────
      log.heading('Component Added!');
      console.log(`  Component:  \x1b[1m${name}\x1b[0m`);
      console.log(`  Source:     ${dsName}`);
      console.log(`  Selectors:  ${component.selectors.length}`);
      console.log(`  File:       design/components/${name}.css`);
      console.log('');
    });

  return cmd;
}
