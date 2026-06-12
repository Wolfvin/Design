---
name: token-extractor
skill-tree:
  type: leaf
  parent: twig-design-system
  also-matches: [twig-brand-identity]
---

# Token Extractor

Split a design system's `tokens.css` (or `design-tokens.json`) into
individual categorized CSS files inside the project's `design/tokens/` directory.

This skill is called by `design-sync` as part of the init or update flow.
It can also be activated directly when the user says:
- "extract tokens", "split tokens", "organize tokens"

## Input

| Source | Priority | Description |
|--------|----------|-------------|
| `design-systems/{name}/tokens.css` | 1st | CSS custom properties in `:root` block |
| `design-systems/{name}/design-tokens.json` | 2nd | Structured JSON token data |
| Both exist | Merge | tokens.css takes priority, JSON supplements missing categories |

## Output

```
design/tokens/
├── colors.css        ← --color-*, --gradient-*, --opacity-*
├── spacing.css       ← --spacing-*, --radius-*, --gap-*
├── typography.css    ← --font-*, --text-*, --leading-*, --tracking-*, --weight-*
├── shadows.css       ← --shadow-*, --elev-*
└── custom.css        ← anything that doesn't match other categories
```

Additionally writes to sibling directories:
```
design/motion/
├── transitions.css   ← --duration-*, --ease-*, --transition-*
└── animations.css    ← --animate-*

design/layout/
├── grid.css          ← --container-*, --z-*
└── breakpoints.css   ← --breakpoint-*
```

---

## Token Classification Decision Tree

> CRITICAL: Follow these rules EXACTLY. No guessing.
> If a property doesn't match any rule, put it in custom.css.
> Classification is based on the property NAME, not its value.

| Pattern | Category | Output File |
|---------|----------|-------------|
| `--color-*` | colors | `tokens/colors.css` |
| `--gradient-*` | colors | `tokens/colors.css` |
| `--opacity-*` | colors | `tokens/colors.css` |
| `--accent*` | colors | `tokens/colors.css` |
| `--bg*` | colors | `tokens/colors.css` |
| `--surface*` | colors | `tokens/colors.css` |
| `--fg*` | colors | `tokens/colors.css` |
| `--muted*` | colors | `tokens/colors.css` |
| `--meta*` | colors | `tokens/colors.css` |
| `--danger*` | colors | `tokens/colors.css` |
| `--success*` | colors | `tokens/colors.css` |
| `--warning*` | colors | `tokens/colors.css` |
| `--warn*` | colors | `tokens/colors.css` |
| `--border` | colors | `tokens/colors.css` |
| `--border-soft` | colors | `tokens/colors.css` |
| `--tag-*` | colors | `tokens/colors.css` |
| `--spacing-*` | spacing | `tokens/spacing.css` |
| `--space-*` | spacing | `tokens/spacing.css` |
| `--radius-*` | spacing | `tokens/spacing.css` |
| `--gap-*` | spacing | `tokens/spacing.css` |
| `--section-y*` | spacing | `tokens/spacing.css` |
| `--container-gutter*` | spacing | `tokens/spacing.css` |
| `--font-*` | typography | `tokens/typography.css` |
| `--text-*` | typography | `tokens/typography.css` |
| `--leading-*` | typography | `tokens/typography.css` |
| `--tracking-*` | typography | `tokens/typography.css` |
| `--weight-*` | typography | `tokens/typography.css` |
| `--shadow-*` | shadows | `tokens/shadows.css` |
| `--elev-*` | shadows | `tokens/shadows.css` |
| `--focus-ring*` | shadows | `tokens/shadows.css` |
| `--duration-*` | motion | `motion/transitions.css` |
| `--ease-*` | motion | `motion/transitions.css` |
| `--motion-*` | motion | `motion/transitions.css` |
| `--transition-*` | motion | `motion/transitions.css` |
| `--animate-*` | motion | `motion/animations.css` |
| `--breakpoint-*` | layout | `layout/breakpoints.css` |
| `--container-max` | layout | `layout/grid.css` |
| `--container-*` | layout | `layout/grid.css` |
| `--z-*` | layout | `layout/grid.css` |
| NO MATCH | custom | `tokens/custom.css` |

### Classification Algorithm

```
FOR each custom property in source tokens.css:

  1. Extract property name (e.g., --accent from --accent: #0071e3;)
  2. Match against patterns in ORDER (top to bottom of table above)
  3. FIRST match wins — more specific patterns should be listed first
  4. IF no match → tokens/custom.css

Special handling:
  - Properties starting with --border but NOT --border-soft → check value
    If value is a color → colors.css
    If value is a width → spacing.css
    Default → colors.css (border is usually a color in design systems)

  - Properties starting with --radius → ALWAYS spacing.css
    (radius is a spatial measurement, not a color)
```

---

## Processing Order

### Source 1: tokens.css

```
1. Read the full tokens.css file
2. Parse ALL custom properties from :root { } block
3. Ignore comments, whitespace, non-custom-property rules
4. Apply classification decision tree to each property
5. Group properties by category
6. Write each group to the corresponding output file
```

### Source 2: design-tokens.json

```
1. Read the JSON file
2. Parse token structure (typically nested by category)
3. Convert each token to CSS custom property format:
   --{path-joined-with-dash}: {value};
4. Apply same classification decision tree
5. Merge with tokens.css results (tokens.css takes priority on conflicts)
```

### Source 3: Neither exists

```
1. WARN: "Source design system has no tokens"
2. Generate empty placeholder files for each category
3. Add comment in each: /* No tokens found in source DS */
```

---

## Output Format

Each output file follows this structure:

```css
/* ───────────────────────────────────────────────────────────────
 * Token Category: colors
 * Source: design-systems/apple/tokens.css
 * Generated by token-extractor — safe to customize
 *
 * To add new tokens: add them here AND update design/contract.json
 * ─────────────────────────────────────────────────────────────── */

:root {
  --accent: #0071e3;
  --accent-hover: #0077ed;
  --accent-active: #0066cc;
  --accent-on: #ffffff;
  --bg: #ffffff;
  --surface: #f5f5f7;
  --surface-warm: #fbfbfd;
  --fg: #1d1d1f;
  --fg-2: #6e6e73;
  --meta: #86868b;
  --border: #d2d2d7;
  --border-soft: #e8e8ed;
  --muted: #f5f5f7;
  --danger: #ff3b30;
}
```

Key formatting rules:
- Preserve comments from source when they appear immediately before a property
- Use 2-space indentation
- One property per line
- Semicolon after every value
- Group related properties with blank lines between groups
- If source has brand-specific comments (like Apple's explanation of why
  --accent-hover lifts instead of darkens), preserve them as CSS comments

---

## Tailwind v4 Strategy Override

If `cssStrategy = "tailwind-theme"` in manifest.json:

### Instead of `:root` custom properties, generate `@theme` block

```css
/* design/tailwind.css — AUTO-GENERATED */
/* Design System: apple | Generated: {date} | DO NOT EDIT */

@theme {
  /* Colors */
  --color-accent: #0071e3;
  --color-accent-hover: #0077ed;
  --color-bg: #ffffff;
  --color-surface: #f5f5f7;
  /* ... */

  /* Typography */
  --font-sans: "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
  --font-mono: "SF Mono", ui-monospace, monospace;
  /* ... */

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  /* ... */
}
```

### Mapping rules for Tailwind @theme

| Source Token | Tailwind @theme Token |
|---|---|
| `--accent` | `--color-accent` |
| `--bg` | `--color-bg` |
| `--surface` | `--color-surface` |
| `--fg` | `--color-fg` |
| `--font-body` | `--font-sans` |
| `--font-mono` | `--font-mono` |
| `--spacing-*` | `--spacing-*` |
| `--radius-*` | `--radius-*` |
| `--text-*` | `--text-*` |

Still generate individual `tokens/*.css` files as fallback reference.
The `tailwind.css` file is the PRIMARY entry point for Tailwind projects.
The `index.css` file is the fallback for non-Tailwind consumers.

---

## Edge Cases

### Mixed property types in one declaration block

Some DS packages put all tokens in a single `:root` block.
This is normal — extract and classify each property individually.

### Properties with `var()` references

```css
--color-primary-hover: var(--color-primary-600);
```

Preserve as-is. Don't resolve the reference.
The dependency order in the output file should match the source order.

### Properties with fallback values

```css
--font-body: "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
```

Preserve the full value including fallbacks.

### Tokens with no obvious category

If a token like `--sabbath` or `--mode` appears and doesn't match any
pattern in the decision tree → `tokens/custom.css`.

If custom.css has more than 10 properties, consider whether the decision
tree needs a new category. But DO NOT create new categories on the fly —
that would break the contract with design-sync and contract.json.

### Duplicate property names

If the same property appears in both tokens.css and design-tokens.json:
tokens.css wins. Log a warning: "Duplicate token --{name} found in both
sources; using tokens.css value."

### Empty categories

If no tokens match a category (e.g., no shadows), still create the file:
```css
/* Token Category: shadows */
/* No tokens found in this category for the source design system */
```

---

## Contract.json Integration

After extraction, update `design/contract.json` tokens section:

```json
{
  "tokens": {
    "colors": ["--accent", "--bg", "--surface", "--fg", "..."],
    "spacing": ["--spacing-xs", "--spacing-sm", "..."],
    "typography": ["--font-body", "--text-sm", "..."],
    "shadows": ["--elev-flat", "--elev-raised", "..."],
    "motion": ["--motion-base", "--ease-standard", "..."],
    "layout": ["--radius-sm", "--container-max", "..."]
  }
}
```

This is CRITICAL for the agent — it reads contract.json to know what
tokens are available. Never make the agent read individual CSS files
to discover available tokens.

The token list in contract.json must EXACTLY match what's in the CSS files.
If you add a token to CSS, add it to contract.json.
If you remove a token from CSS, remove it from contract.json.

---

## js-tokens Strategy (CSS-in-JS Projects)

When `cssStrategy = "js-tokens"` in manifest.json, also generate
a JavaScript token file for CSS-in-JS consumption.

### Output: design/tokens.js

```javascript
// design/tokens.js — AUTO-GENERATED
// Design System: {name} | Generated: {date} | DO NOT EDIT
// Contract: design/contract.json — read this before writing code

export const colors = {
  accent: '#0071e3',
  accentHover: '#0077ed',
  accentActive: '#0066cc',
  accentOn: '#ffffff',
  bg: '#ffffff',
  surface: '#f5f5f7',
  surfaceWarm: '#fbfbfd',
  fg: '#1d1d1f',
  fg2: '#6e6e73',
  meta: '#86868b',
  border: '#d2d2d7',
  borderSoft: '#e8e8ed',
  muted: '#f5f5f7',
  danger: '#ff3b30',
  success: '#34c759',
  warning: '#ff9f0a',
};

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
};

export const typography = {
  fontSans: '"SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  fontMono: '"SF Mono", ui-monospace, monospace',
  textXs: '0.75rem',
  textSm: '0.875rem',
  textBase: '1rem',
  textLg: '1.125rem',
  textXl: '1.25rem',
  text2xl: '1.5rem',
  leadingTight: '1.25',
  leadingNormal: '1.5',
  leadingRelaxed: '1.75',
};

export const shadows = {
  flat: 'none',
  raised: '0 2px 8px rgba(0,0,0,0.08)',
  overlay: '0 8px 32px rgba(0,0,0,0.12)',
};

export const motion = {
  durationInstant: '75ms',
  durationFast: '150ms',
  durationNormal: '250ms',
  durationSlow: '400ms',
  easeDefault: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
  easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const layout = {
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusFull: '9999px',
  breakpointSm: '640px',
  breakpointMd: '768px',
  breakpointLg: '1024px',
  breakpointXl: '1280px',
};

// Composed token object for convenience
const tokens = { colors, spacing, typography, shadows, motion, layout };
export default tokens;
```

### Token Name Conversion Rules (CSS → JS)

| CSS Custom Property | JS Export Key | Rule |
|---|---|---|
| `--accent` | `accent` | Strip `--` prefix |
| `--accent-hover` | `accentHover` | Strip `--`, camelCase after dash |
| `--color-primary-500` | `colorPrimary500` | Strip `--`, camelCase |
| `--spacing-xs` | `xs` | Strip `--spacing-` category prefix |
| `--font-sans` | `fontSans` | Strip `--`, camelCase |
| `--text-sm` | `textSm` | Strip `--`, camelCase |
| `--duration-fast` | `durationFast` | Strip `--`, camelCase |
| `--ease-default` | `easeDefault` | Strip `--`, camelCase |
| `--radius-sm` | `radiusSm` | Categorized under layout, strip `--` |
| `--breakpoint-md` | `breakpointMd` | Categorized under layout, strip `--` |

General rule:
1. Strip the `--` prefix
2. For tokens that start with a category prefix (like `--spacing-`, `--color-`),
   strip the prefix when categorizing into the JS object
3. Convert remaining kebab-case to camelCase
4. Group by category: colors, spacing, typography, shadows, motion, layout

### TypeScript Support

Also generate `design/tokens.d.ts`:

```typescript
// design/tokens.d.ts — AUTO-GENERATED

export interface ColorTokens {
  accent: string;
  accentHover: string;
  bg: string;
  surface: string;
  fg: string;
  fg2: string;
  meta: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  [key: string]: string;
}

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  [key: string]: string;
}

export interface TypographyTokens {
  fontSans: string;
  fontMono: string;
  textXs: string;
  textSm: string;
  textBase: string;
  textLg: string;
  textXl: string;
  [key: string]: string;
}

export interface MotionTokens {
  durationFast: string;
  durationNormal: string;
  durationSlow: string;
  easeDefault: string;
  easeSpring: string;
  [key: string]: string;
}

export const colors: ColorTokens;
export const spacing: SpacingTokens;
export const typography: TypographyTokens;
export const motion: MotionTokens;

interface TokenSet {
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  motion: MotionTokens;
}

declare const tokens: TokenSet;
export default tokens;
```

### Usage with styled-components

```javascript
import { colors, spacing, motion } from '../design/tokens';

const Button = styled.button`
  background: ${colors.accent};
  color: ${colors.accentOn};
  padding: ${spacing.sm} ${spacing.md};
  border-radius: ${spacing.sm};
  transition: background ${motion.durationFast} ${motion.easeDefault};

  &:hover {
    background: ${colors.accentHover};
  }
`;
```

### Usage with Emotion

```javascript
import { colors, spacing, motion } from '../design/tokens';

const buttonStyles = css({
  background: colors.accent,
  color: colors.accentOn,
  padding: `${spacing.sm} ${spacing.md}`,
  borderRadius: spacing.sm,
  transition: `background ${motion.durationFast} ${motion.easeDefault}`,
  '&:hover': {
    background: colors.accentHover,
  },
});
```

### ALWAYS Generate CSS Fallback

Even when `js-tokens` strategy is active, ALWAYS generate the standard
CSS token files (`tokens/*.css`) and `index.css`. This ensures:
- Third-party libraries that need CSS can still consume tokens
- Legacy code using CSS var() still works
- Progressive migration from CSS to JS is possible
- Mixed codebase (some CSS, some styled-components) is supported

---

## CSS Modules Hybrid Strategy

When `cssStrategy = "custom-properties"` and the project uses CSS Modules
(`*.module.css` files detected), apply a hybrid approach:

### Token Distribution

**Global CSS** (imported in `src/app/globals.css`):
- `design/tokens/colors.css` — All color custom properties
- `design/tokens/spacing.css` — All spacing custom properties
- `design/tokens/typography.css` — All typography custom properties
- `design/tokens/shadows.css` — All shadow custom properties
- `design/layout/grid.css` — Grid system
- `design/layout/breakpoints.css` — Breakpoint tokens
- `design/motion/transitions.css` — Transition tokens

**CSS Modules** (per-component `*.module.css`):
- Use `var(--token)` to reference global tokens
- No `:root` declaration needed in modules — tokens are inherited
- Component-specific overrides use CSS Modules scoping naturally

### Module Import Pattern

```css
/* src/components/Button.module.css */
/* Tokens are available via globals.css — no import needed */

.btn {
  background: var(--accent);
  color: var(--accent-on);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--ease-default);
}

.btn:hover {
  background: var(--accent-hover);
}

.btnSmall {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--text-sm);
}
```

### Component CSS as Reference

When using CSS Modules hybrid, the `design/components/*.css` files serve
as REFERENCE ONLY — they show the design system's intended component styling.
Developers copy what they need into their `.module.css` files.

Global component files still exist for:
- Layout shells (header, sidebar, footer)
- Portal-rendered components (modals, tooltips, toasts)
- Third-party component overrides

### manifest.json for CSS Modules Hybrid

```json
{
  "cssStrategy": "custom-properties",
  "import": {
    "strategy": "modules-hybrid",
    "entry": "index.css",
    "modulesNote": "Tokens imported globally, components as reference only"
  }
}
```

### contract.json for CSS Modules Hybrid

```json
{
  "scope": {
    "type": "modules-hybrid",
    "customPropertiesRoot": ":root",
    "componentPrefix": "",
    "modulesPattern": "*.module.css"
  },
  "strategyConfig": {
    "modulesHybrid": {
      "globalImports": [
        "tokens/colors.css",
        "tokens/spacing.css",
        "tokens/typography.css",
        "tokens/shadows.css",
        "layout/grid.css",
        "layout/breakpoints.css",
        "motion/transitions.css"
      ],
      "referenceOnly": [
        "components/*.css"
      ]
    }
  }
}
```
