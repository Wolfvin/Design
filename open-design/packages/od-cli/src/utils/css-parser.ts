/**
 * CSS Custom Property Parser
 * Extracts all CSS custom properties from a :root { } block in tokens.css
 */

export interface CssCustomProperty {
  name: string;       // e.g., "--color-primary-500"
  value: string;      // e.g., "#0071e3"
  comment?: string;   // inline comment after the value
  line: number;       // line number in source
}

/**
 * Parse all CSS custom properties from a CSS string.
 * Handles multi-line :root blocks, inline comments, and var() references.
 */
export function parseCustomProperties(css: string): CssCustomProperty[] {
  const properties: CssCustomProperty[] = [];
  const lines = css.split('\n');
  let inRoot = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect :root block start
    if (/^:root\s*\{/.test(trimmed)) {
      inRoot = true;
      continue;
    }

    // Detect block end
    if (inRoot && trimmed === '}') {
      inRoot = false;
      continue;
    }

    // Parse custom property inside :root
    if (inRoot) {
      const match = trimmed.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*(?:\/\*\s*(.+?)\s*\*\/)?\s*$/);
      if (match && match[1].startsWith('--')) {
        let value = match[2].trim();
        // Remove trailing semicolon if present
        if (value.endsWith(';')) {
          value = value.slice(0, -1).trim();
        }

        properties.push({
          name: match[1],
          value,
          comment: match[3] || undefined,
          line: i + 1,
        });
      }
    }
  }

  return properties;
}

/**
 * Extract the :root block content from a CSS string.
 * Returns the content between :root { ... }
 */
export function extractRootBlock(css: string): string | null {
  const rootStart = css.indexOf(':root');
  if (rootStart === -1) return null;

  const braceStart = css.indexOf('{', rootStart);
  if (braceStart === -1) return null;

  let depth = 1;
  let pos = braceStart + 1;

  while (pos < css.length && depth > 0) {
    if (css[pos] === '{') depth++;
    else if (css[pos] === '}') depth--;
    pos++;
  }

  return css.slice(braceStart + 1, pos - 1);
}

/**
 * Parse component CSS rules from a <style> block in components.html.
 * Returns an array of CSS rule objects.
 */
export interface CssRule {
  selector: string;
  declarations: string;
  selectorLine: number;
}

export function parseCssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const lines = css.split('\n');
  let currentSelector = '';
  let currentDeclarations: string[] = [];
  let currentLine = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('/*') || trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }

    // Detect selector (ends with {)
    if (!inBlock && trimmed.includes('{')) {
      const braceIdx = trimmed.indexOf('{');
      currentSelector = trimmed.slice(0, braceIdx).trim();
      currentDeclarations = [];
      currentLine = i + 1;
      inBlock = true;

      // If the line also has content after {
      const afterBrace = trimmed.slice(braceIdx + 1).trim();
      if (afterBrace && afterBrace !== '}') {
        currentDeclarations.push(afterBrace);
      }

      // Check if block ends on same line
      if (trimmed.endsWith('}')) {
        inBlock = false;
        if (currentSelector) {
          rules.push({
            selector: currentSelector,
            declarations: currentDeclarations.join('\n'),
            selectorLine: currentLine,
          });
        }
      }
      continue;
    }

    // Inside a block
    if (inBlock) {
      if (trimmed.endsWith('}')) {
        // Block end
        const content = trimmed.slice(0, -1).trim();
        if (content) currentDeclarations.push(content);
        inBlock = false;

        if (currentSelector) {
          rules.push({
            selector: currentSelector,
            declarations: currentDeclarations.join('\n'),
            selectorLine: currentLine,
          });
        }
      } else {
        currentDeclarations.push(trimmed);
      }
    }
  }

  return rules;
}
