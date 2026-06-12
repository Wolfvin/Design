---
name: component-forge
skill-tree:
  type: leaf
  parent: twig-design-system
  also-matches: [twig-ui-design]
---

# Component Forge

Extract individual component CSS from a design system's `components.html`
and generate a machine-readable component registry for `contract.json`.

This skill is called by `design-sync` as part of the init or update flow.
It can also be activated directly when the user says:
- "extract components", "split components", "organize components"

## Input

| Source | Required | Description |
|--------|----------|-------------|
| `design-systems/{name}/components.html` | Preferred | HTML fixture with embedded `<style>` blocks |
| `design-systems/{name}/components.manifest.json` | Preferred | Structured component metadata |
| `design-systems/{name}/DESIGN.md` | Fallback | Prose descriptions of components |

## Output

```
design/components/
├── button.css
├── card.css
├── sidebar.css
├── modal.css
├── input.css
├── nav.css
├── ...
└── {component-name}.css
```

Plus updates to `design/contract.json` component registry.

---

## Extraction Decision Tree

```
START
  │
  ├─ Step 1: components.manifest.json exists?
  │   ├─ YES → MANIFEST-FIRST extraction (most reliable)
  │   │   │
  │   │   ├─ Read manifest → get component list + selectors
  │   │   ├─ Read components.html → extract <style> blocks
  │   │   ├─ FOR each component in manifest:
  │   │   │   ├─ Find CSS rules matching component selectors
  │   │   │   ├─ Extract rules → write {component-name}.css
  │   │   │   └─ Record selectors in contract.json
  │   │   └─ DONE
  │   │
  │   └─ NO → Go to Step 2
  │
  ├─ Step 2: components.html exists?
  │   ├─ YES → HEURISTIC extraction (less reliable)
  │   │   │
  │   │   ├─ Parse HTML → extract all <style> block CSS
  │   │   ├─ Identify component boundaries by:
  │   │   │   ├─ CSS comment markers: /* Component: button */
  │   │   │   ├─ Selector prefixes: .btn-*, .card-*, .modal-*
  │   │   │   └─ Rule clustering (adjacent rules sharing prefix)
  │   │   ├─ FOR each identified component:
  │   │   │   ├─ Extract rules → write {component-name}.css
  │   │   │   └─ Record selectors in contract.json
  │   │   ├─ WARN: "No components.manifest.json — extraction may be incomplete"
  │   │   └─ DONE
  │   │
  │   └─ NO → Go to Step 3
  │
  ├─ Step 3: DESIGN.md exists?
  │   ├─ YES → PROSE-TO-CSS generation (placeholder quality)
  │   │   │
  │   │   ├─ Read DESIGN.md → find component descriptions
  │   │   ├─ Parse structured sections (## Button, ### Card, etc.)
  │   │   ├─ FOR each described component:
  │   │   │   ├─ Generate minimal CSS from description
  │   │   │   ├─ Use CSS custom properties from tokens.css
  │   │   │   ├─ Write {component-name}.css
  │   │   │   └─ Record in contract.json with note: "generated from prose"
  │   │   ├─ WARN: "Components generated from prose, not source CSS — may need manual refinement"
  │   │   └─ DONE
  │   │
  │   └─ NO → Go to Step 4
  │
  └─ Step 4: No sources available
      ├─ Write single file: design/components/README.css
      │   /* No component source found. Add components manually. */
      ├─ contract.json components: []
      └─ WARN: "No component sources found in design system"
```

---

## Manifest-First Extraction (Step 1 — Preferred)

When `components.manifest.json` exists, use it as the authoritative source.

### Reading the Manifest

The manifest follows this structure (from `design-systems/_schema/`):
```json
{
  "schemaVersion": 1,
  "brandId": "apple",
  "tokens": {
    "declared": ["--accent", "--bg", "--radius-md", "..."]
  },
  "components": [
    {
      "name": "button",
      "selectors": [".btn", ".btn-primary", ".btn-secondary"],
      "html": "<button class=\"btn btn-primary\">...</button>"
    }
  ]
}
```

### Extraction Algorithm

```
1. Read components.manifest.json
2. FOR each component entry:
   a. Get component name and selectors
   b. Find all CSS rules in components.html that match any selector
   c. Extract those rules with surrounding context (comments, etc.)
   d. Write to design/components/{name}.css
   e. Add entry to contract.json components[]
3. Handle CSS rules not matched by any component:
   a. These are "orphan" rules
   b. Write to design/components/_shared.css
   c. Add to contract.json as { name: "_shared", ... }
```

### Selector Matching

When matching CSS rules to component selectors:

```
FOR each CSS rule in components.html <style>:
  FOR each selector in the rule:
    FOR each component in manifest:
      FOR each componentSelector in component.selectors:
        IF selector contains componentSelector:
          → Assign rule to this component
          → BREAK (rule assigned, move to next)
        IF selector starts with componentSelector + "-" or componentSelector + "__":
          → Also assign to this component (BEM variant)
```

A single CSS rule can belong to only ONE component. If it matches
multiple components, assign it to the first match (manifest order).

---

## Heuristic Extraction (Step 2 — Fallback)

When no manifest exists, infer component boundaries from CSS structure.

### Identification Methods

**Method A: CSS Comment Markers**

```css
/* Component: button */
.btn { ... }
.btn-primary { ... }

/* Component: card */
.card { ... }
```

If the source has comment markers, they are the most reliable heuristic.

**Method B: Selector Prefix Clustering**

```
1. Parse all selectors from <style> blocks
2. Extract the first class name from each selector
3. Find the "base" class (shortest form):
   - .btn → base = "btn"
   - .btn-primary → base = "btn" (extends btn)
   - .card → base = "card"
   - .card-body → base = "card" (extends card)
4. Group rules by base class
5. Each group = one component
```

**Method C: HTML Structure Analysis**

If the HTML has clear structural boundaries:
```html
<section class="component-button">
  <button class="btn">...</button>
</section>
<section class="component-card">
  <div class="card">...</div>
</section>
```

Use the section wrapper to identify component boundaries.

### Disambiguation Rules

```
IF multiple methods disagree:
  → Method A (comments) wins
  → Then Method B (prefix clustering)
  → Then Method C (HTML structure)

IF a selector doesn't fit any component:
  → Add to _shared.css
```

### Naming

Component names are derived from base class names:
- `.btn` → component name: "button" (expand common abbreviations)
- `.card` → component name: "card"
- `.nav` → component name: "nav"
- `.modal` → component name: "modal"
- `.input` → component name: "input"
- `.sidebar` → component name: "sidebar"

Common abbreviation expansions:
| Abbreviation | Full Name |
|---|---|
| btn | button |
| nav | nav |
| dlg | dialog |
| dlg | modal |
| fld | field |
| inp | input |
| tbl | table |
| chk | checkbox |
| drp | dropdown |
| acc | accordion |
| tgl | toggle |

---

## Prose-to-CSS Generation (Step 3 — Last Resort)

When only DESIGN.md is available, generate placeholder CSS from prose.

### Parsing DESIGN.md

Look for structured component sections:
```markdown
## Button
Primary actions use Apple Action Blue (#0071e3) with white text
on rounded capsules (radius-pill). Hover lifts the blue slightly.
```

### Generation Rules

```
1. Extract component name from heading (## Button → "button")
2. Find color references → map to CSS custom properties
3. Find spacing references → map to spacing tokens
4. Find typography references → map to typography tokens
5. Generate CSS using var(--{token}) for all mapped values
6. Add comment: /* Generated from DESIGN.md prose — verify visually */
```

### Output Quality

This is PLACEHOLDER quality CSS. It follows the design system's
philosophy but may not match the exact implementation. Always mark
these files clearly:

```css
/* Component: button | Source: design-systems/apple/DESIGN.md (prose) */
/* ⚠ GENERATED FROM PROSE — may not match exact implementation */
/* Verify visually and adjust as needed */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--accent-on);
  border-radius: var(--radius-pill);
  transition: background var(--motion-fast) var(--ease-standard);
}

.btn:hover {
  background: var(--accent-hover);
}
```

---

## Output Format

Each `design/components/{name}.css`:

```css
/* ───────────────────────────────────────────────────────────────
 * Component: button
 * Source: design-systems/apple/components.html
 * Selectors: .btn, .btn-primary, .btn-secondary, .btn-ghost
 * Generated by component-forge — safe to customize
 *
 * To add new variants: add them here AND update design/contract.json
 * ─────────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  transition: background var(--motion-fast) var(--ease-standard);
  cursor: pointer;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-on);
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}

.btn-ghost {
  background: transparent;
  color: var(--fg);
}
```

Key formatting rules:
- Use CSS custom properties (`var(--token)`) for ALL values that have tokens
- Hardcode ONLY values that don't have token equivalents
- Preserve the original CSS rule ordering from source
- Group related variants together
- Add `prefers-reduced-motion` fallback if component has transitions

---

## Contract.json Integration

After extraction, update `design/contract.json` components section:

```json
{
  "components": [
    {
      "name": "button",
      "file": "components/button.css",
      "selectors": [".btn", ".btn-primary", ".btn-secondary", ".btn-ghost"],
      "source": "manifest"
    },
    {
      "name": "card",
      "file": "components/card.css",
      "selectors": [".card", ".card-header", ".card-body", ".card-footer"],
      "source": "manifest"
    },
    {
      "name": "sidebar",
      "file": "components/sidebar.css",
      "selectors": [".sidebar", ".sidebar-item", ".sidebar-active"],
      "source": "heuristic"
    },
    {
      "name": "_shared",
      "file": "components/_shared.css",
      "selectors": [],
      "source": "orphan-rules"
    }
  ]
}
```

The `source` field indicates extraction method:
- `"manifest"` — extracted using components.manifest.json (most reliable)
- `"heuristic"` — extracted using prefix clustering (may be incomplete)
- `"prose"` — generated from DESIGN.md descriptions (placeholder quality)
- `"orphan-rules"` — unmatched CSS rules

---

## Edge Cases

### Component with no CSS rules

If a component is listed in the manifest but has no matching CSS rules:
```css
/* Component: dropdown | Source: design-systems/apple */
/* ⚠ No CSS rules found for this component in source */
/* Add styles manually if needed */
```

Skip in contract.json components[] (no selectors to register).

### Shared styles between components

Some CSS rules apply to multiple components (e.g., reset styles,
base typography). These go into `_shared.css` and are always
imported before component-specific files in `index.css`.

### BEM notation

If the source uses BEM (Block__Element--Modifier):
```
.card__header--highlighted → block = "card"
.btn__icon--small → block = "btn"
```

Extract the block name as the component name.
Include all elements and modifiers in the same component file.

### Very large components

If a single component has 100+ CSS rules, consider splitting:
```css
/* button.css — core styles */
/* button-variants.css — variant overrides (separate file) */
```

But only split if the component is genuinely too large (>200 lines).
Otherwise keep it together for simplicity.

### HTML-only components (no <style>)

If components.html only has HTML markup and no <style> blocks:
- This means components are styled by tokens.css alone
- Generate component CSS that references tokens
- Mark as `"source": "inferred-from-html"`

### Components using @import or @layer

Preserve these directives if present in source:
```css
@layer components {
  .btn { ... }
}
```

If source uses `@layer`, maintain the layer structure in output.

---

## Multi-Strategy Component Generation

Components must be generated differently depending on the project's
CSS strategy (stored in `design/manifest.json` cssStrategy field).

### Strategy: custom-properties (Default)

Standard CSS with `:root` custom properties. This is the default output
format described in the rest of this skill.

```css
/* design/components/button.css */
.btn {
  background: var(--accent);
  color: var(--accent-on);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--ease-default);
}
```

### Strategy: tailwind-theme

When `cssStrategy = "tailwind-theme"`, component CSS uses Tailwind utility
classes where possible, with custom properties mapped to `@theme` tokens.

```css
/* design/components/button.css — Tailwind-aware */

/* Base styles using Tailwind @apply or direct Tailwind-compatible tokens */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--ease-default);
  cursor: pointer;
}

/* Variants — these work with Tailwind's variant system */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-on);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}
```

Note: Token names use `var(--color-accent)` instead of `var(--accent)`
when tailwind-theme is active, because the @theme block maps tokens
with the `--color-` prefix.

Also generate a `design/components/tailwind-components.css` that uses
`@layer components` for proper Tailwind specificity:

```css
/* design/components/tailwind-components.css */
@layer components {
  .btn { /* ... */ }
  .btn-primary { /* ... */ }
  .card { /* ... */ }
}
```

### Strategy: js-tokens (CSS-in-JS)

When `cssStrategy = "js-tokens"`, generate JavaScript component style
objects alongside the CSS files.

```javascript
// design/components/button.styles.js — AUTO-GENERATED
// Design System: {name} | Generated: {date}
// Contract: design/contract.json — read this before writing code

import { colors, spacing, motion, layout } from '../tokens';

export const buttonStyles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.sm} ${spacing.md}`,
    fontFamily: typography.fontSans,
    fontSize: typography.textSm,
    borderRadius: layout.radiusMd,
    transition: `background ${motion.durationFast} ${motion.easeDefault}`,
    cursor: 'pointer',
  },
  primary: {
    background: colors.accent,
    color: colors.accentOn,
  },
  primaryHover: {
    background: colors.accentHover,
  },
  secondary: {
    background: 'transparent',
    color: colors.accent,
    border: `1px solid ${colors.accent}`,
  },
  ghost: {
    background: 'transparent',
    color: colors.fg,
  },
};
```

Usage with styled-components:
```javascript
import { buttonStyles } from '../design/components/button.styles';
import styled from 'styled-components';

const Button = styled.button`
  ${buttonStyles.base}
  ${({ variant }) => variant === 'primary' && buttonStyles.primary}
`;
```

Usage with Emotion:
```javascript
import { buttonStyles } from '../design/components/button.styles';
import { css } from '@emotion/react';

const buttonBase = css(buttonStyles.base);
const buttonPrimary = css(buttonStyles.primary);
```

ALWAYS also generate the standard CSS component files as fallback.

### Strategy: CSS Modules Hybrid

When using CSS Modules hybrid, component CSS files in `design/components/`
serve as REFERENCE ONLY. They are not directly imported by the project.

Instead, the developer copies relevant styles into their `.module.css` files:

```css
/* design/components/button.css — REFERENCE ONLY */
/* Copy what you need into src/components/Button.module.css */
/* Tokens are available globally via globals.css */

/* Reference implementation: */
.btn {
  background: var(--accent);
  color: var(--accent-on);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
}
```

Add a header comment to each reference component:
```css
/* ═══ REFERENCE ONLY ═══════════════════════════════════════════
 * This file is a reference for your CSS Module implementation.
 * Tokens are available as CSS custom properties via globals.css.
 * Copy the styles you need into your .module.css files.
 * ═════════════════════════════════════════════════════════════ */
```

---

## Shared Styles Handling

### What goes in _shared.css

The `_shared.css` file catches CSS rules that don't belong to any specific
component. Common examples:

1. **Reset/normalize styles** — box-sizing, margin reset, font inheritance
2. **Base typography** — body font, heading defaults, paragraph spacing
3. **Utility classes** — `.sr-only`, `.truncate`, `.visually-hidden`
4. **Global link styles** — `a { color: var(--accent); }`
5. **Form base styles** — input/text-area base styling

### _shared.css Format

```css
/* ───────────────────────────────────────────────────────────────
 * Shared Styles
 * Source: design-systems/{name}/components.html (orphan rules)
 * These styles apply globally and are not tied to a specific component.
 * Generated by component-forge
 * ─────────────────────────────────────────────────────────────── */

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Base Typography */
body {
  font-family: var(--font-body);
  color: var(--fg);
  background: var(--bg);
  line-height: var(--leading-normal);
}

/* Accessibility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### _shared.css in index.css

`_shared.css` is always imported FIRST (before components) in `index.css`:

```css
/* design/index.css */
/* ... tokens ... */
/* ... layout ... */
@import "./components/_shared.css";
@import "./components/button.css";
@import "./components/card.css";
/* ... other components ... */
```

### When _shared.css is Empty

If no orphan rules are found during extraction:
```css
/* Shared Styles — no orphan rules found during extraction */
/* Common reset/normalize styles will be added as needed */
```

---

## Component Extraction Validation

After extraction, validate the output:

### Completeness Check

```
1. Read components.manifest.json (if exists)
2. For each component listed in manifest:
   a. Verify design/components/{name}.css exists
   b. Verify it contains CSS rules (not just a placeholder comment)
   c. Verify it's listed in contract.json components[]
3. If any component is missing:
   → WARN: "Component {name} listed in manifest but not extracted"
   → Generate placeholder file
```

### Selector Coverage Check

```
1. Read contract.json components[].selectors for each component
2. For each selector listed:
   a. Verify the selector appears in the component's CSS file
   b. If missing → WARN: "Selector {selector} not found in {component}.css"
3. For each CSS rule in components.html:
   a. Verify the rule was assigned to a component file
   b. If not assigned → add to _shared.css
```

### contract.json Consistency Check

```
1. For every CSS file in design/components/:
   a. Verify there's a matching entry in contract.json components[]
   b. Verify the selectors field matches what's in the CSS file
2. For every entry in contract.json components[]:
   a. Verify the CSS file exists
   b. Verify the selectors exist in that CSS file
3. Any inconsistency → WARN and suggest fix
```
