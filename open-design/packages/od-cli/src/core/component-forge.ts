/**
 * Component Forge — Extract per-component CSS from components.html + manifest
 */

import { parseCssRules, type CssRule } from '../utils/css-parser.js';
import { ensureDir, writeIfChanged, readJsonFile, readTextFile, fileExists } from '../utils/fs-utils.js';
import { join, basename } from 'node:path';
import { log } from '../utils/logger.js';

export interface ComponentManifestGroup {
  id: string;
  label: string;
  present?: boolean;
  selectors?: string[];
  classes?: string[];
  elements?: string[];
  tokenReferences?: string[];
}

export interface ComponentManifest {
  schemaVersion: number;
  brandId: string;
  source: { componentsHtml: string; tokensCss: string };
  fixture: {
    title: string;
    description?: string;
    styleBlockCount: number;
    selectorCount: number;
    classCount: number;
    elementCount: number;
  };
  selectors?: string[];
  classes?: string[];
  groups: ComponentManifestGroup[];
}

export interface ExtractedComponent {
  name: string;
  selectors: string[];
  rules: CssRule[];
  source: 'manifest' | 'heuristic' | 'prose' | 'orphan';
}

export interface ExtractionResult {
  components: ExtractedComponent[];
  sharedRules: CssRule[];  // orphan rules not assigned to any component
  stats: {
    total: number;
    bySource: Record<string, number>;
    selectorCount: number;
  };
}

/**
 * Extract component CSS from components.html + components.manifest.json
 */
export async function extractComponents(
  dsDir: string,
  sourceName: string,
): Promise<ExtractionResult> {
  const componentsHtmlPath = join(dsDir, 'components.html');
  const manifestPath = join(dsDir, 'components.manifest.json');

  // Read components.html
  let componentsHtml = '';
  if (await fileExists(componentsHtmlPath)) {
    componentsHtml = await readTextFile(componentsHtmlPath);
  } else {
    log.warn(`No components.html found for ${sourceName}`);
    return { components: [], sharedRules: [], stats: { total: 0, bySource: {}, selectorCount: 0 } };
  }

  // Extract <style> block from HTML
  const styleMatch = componentsHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styleContent = styleMatch ? styleMatch[1] : '';

  // Parse all CSS rules
  const allRules = parseCssRules(styleContent);

  // Skip :root rules (those are tokens, not components)
  const componentRules = allRules.filter(r => !r.selector.startsWith(':root'));

  // Read manifest if available
  let manifest: ComponentManifest | null = null;
  if (await fileExists(manifestPath)) {
    try {
      manifest = await readJsonFile<ComponentManifest>(manifestPath);
    } catch (e) {
      log.warn(`Failed to parse components.manifest.json for ${sourceName}: ${e}`);
    }
  }

  if (manifest) {
    return extractWithManifest(componentRules, manifest, sourceName);
  } else {
    return extractWithHeuristics(componentRules, sourceName);
  }
}

/**
 * Manifest-first extraction: use groups to assign rules
 */
function extractWithManifest(
  rules: CssRule[],
  manifest: ComponentManifest,
  sourceName: string,
): ExtractionResult {
  const components: ExtractedComponent[] = [];
  const assignedRules = new Set<number>();
  const bySource: Record<string, number> = { manifest: 0 };

  for (const group of manifest.groups) {
    if (group.present === false) continue;

    const groupSelectors = new Set(group.selectors || group.classes || []);
    const matchedRules: CssRule[] = [];

    for (let i = 0; i < rules.length; i++) {
      if (assignedRules.has(i)) continue;
      const rule = rules[i];

      // Check if rule selector matches any group selector
      const ruleSelectors = rule.selector.split(',').map(s => s.trim());
      const matches = ruleSelectors.some(rs =>
        groupSelectors.has(rs) ||
        groupSelectors.has(rs.replace(/^\./, '')) ||
        Array.from(groupSelectors).some(gs => rs.startsWith(gs.replace(/^\./, '.')) || rs === gs)
      );

      if (matches) {
        matchedRules.push(rule);
        assignedRules.add(i);
      }
    }

    if (matchedRules.length > 0) {
      components.push({
        name: group.id,
        selectors: group.selectors || group.classes || [],
        rules: matchedRules,
        source: 'manifest',
      });
      bySource.manifest++;
    }
  }

  // Collect unassigned rules as shared/orphan
  const sharedRules = rules.filter((_, i) => !assignedRules.has(i));

  return {
    components,
    sharedRules,
    stats: {
      total: components.length,
      bySource,
      selectorCount: rules.length,
    },
  };
}

/**
 * Heuristic extraction: group by selector prefix
 */
function extractWithHeuristics(
  rules: CssRule[],
  sourceName: string,
): ExtractionResult {
  const components: ExtractedComponent[] = [];
  const bySource: Record<string, number> = { heuristic: 0 };
  const assignedRules = new Set<number>();

  // Group rules by their selector prefix (e.g., .btn → button)
  const prefixMap: Record<string, { rules: CssRule[]; indices: number[] }> = {};

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const mainSelector = rule.selector.split(',')[0].trim();
    const classMatch = mainSelector.match(/^\.([\w-]+)/);
    if (classMatch) {
      const prefix = classMatch[1].split('-')[0];
      if (!prefixMap[prefix]) prefixMap[prefix] = { rules: [], indices: [] };
      prefixMap[prefix].rules.push(rule);
      prefixMap[prefix].indices.push(i);
    }
  }

  // Map common prefixes to component names
  const prefixToName: Record<string, string> = {
    btn: 'button', button: 'button',
    card: 'card', panel: 'card',
    badge: 'badge', chip: 'badge', tag: 'badge', status: 'badge',
    input: 'input', field: 'input', form: 'input',
    modal: 'modal', dialog: 'modal', overlay: 'modal',
    nav: 'navigation', sidebar: 'sidebar',
    link: 'links', a: 'links',
    kbd: 'keyboard',
    hero: 'hero',
    metric: 'metrics', stat: 'metrics',
  };

  for (const [prefix, data] of Object.entries(prefixMap)) {
    const name = prefixToName[prefix] || prefix;
    const selectors = data.rules.map(r => r.selector);

    components.push({
      name,
      selectors,
      rules: data.rules,
      source: 'heuristic',
    });

    for (const idx of data.indices) {
      assignedRules.add(idx);
    }

    bySource.heuristic++;
  }

  const sharedRules = rules.filter((_, i) => !assignedRules.has(i));

  return {
    components,
    sharedRules,
    stats: {
      total: components.length,
      bySource,
      selectorCount: rules.length,
    },
  };
}

/**
 * Generate CSS content for a single component
 */
export function generateComponentCss(
  component: ExtractedComponent,
  sourceName: string,
): string {
  const selectors = component.selectors.join(', ');
  const lines: string[] = [
    `/* Component: ${component.name} | Source: design-systems/${sourceName} */`,
    `/* Generated by od-cli component-forge — safe to customize */`,
    `/* Selectors: ${selectors} */`,
    '',
  ];

  for (const rule of component.rules) {
    lines.push(`${rule.selector} {`);
    lines.push(rule.declarations.split('\n').map(l => `  ${l}`).join('\n'));
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write all component CSS files to design/components/
 */
export async function writeComponentFiles(
  designDir: string,
  extraction: ExtractionResult,
  sourceName: string,
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];

  await ensureDir(join(designDir, 'components'));

  for (const component of extraction.components) {
    const filename = `${component.name}.css`;
    const content = generateComponentCss(component, sourceName);
    const fullPath = join(designDir, 'components', filename);

    const changed = await writeIfChanged(fullPath, content);
    if (changed) {
      written.push(`components/${filename}`);
    } else {
      skipped.push(`components/${filename}`);
    }
  }

  // Write shared/orphan rules to _shared.css
  if (extraction.sharedRules.length > 0) {
    const lines: string[] = [
      `/* Shared Styles | Source: design-systems/${sourceName} */`,
      `/* Generated by od-cli component-forge — orphan rules not assigned to any component */`,
      '',
    ];

    for (const rule of extraction.sharedRules) {
      lines.push(`${rule.selector} {`);
      lines.push(rule.declarations.split('\n').map(l => `  ${l}`).join('\n'));
      lines.push('}');
      lines.push('');
    }

    const fullPath = join(designDir, 'components', '_shared.css');
    await writeIfChanged(fullPath, lines.join('\n'));
    written.push('components/_shared.css');
  }

  return { written, skipped };
}
