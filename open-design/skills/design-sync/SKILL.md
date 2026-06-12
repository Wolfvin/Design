---
name: design-sync
skill-tree:
  type: leaf
  parent: twig-design-system
  also-matches: [twig-ui-design]
---

# Design Sync — Master Orchestrator

Generate or update a project-local `design/` directory from the repo's
`design-systems/` reference library. This skill orchestrates the full
lifecycle: init, update, switch vibe, and rollback.

## When to Activate

- User says: "setup design system", "init design system", "apply design system"
- User says: "update design system", "sync design system"
- User says: "switch vibe", "change design system"
- User accepts a design system preview in the UI (render → accept flow)
- User says: "rollback design system"

## Architecture

```
design-systems/ (repo, READ-ONLY)    design/ (project, READ-WRITE)
─────────────────────────────────    ──────────────────────────────────
152 DS packages                      Living design system owned by project
Source of truth                      Generated, editable, version-controlled
```

The repo's `design-systems/` is a REFERENCE LIBRARY — read-only source.
The project's `design/` is a LIVING ASSET — owned, editable, upgradeable.

## CRITICAL RULES

### 1. Read contract.json BEFORE writing any code

Before modifying ANY source file in the project, read `design/contract.json`.
This file tells you:
- What tokens are available (never hardcode a value that exists as a token)
- What naming convention to use (kebab-case, BEM, etc.)
- What CSS scope the project uses (global, modules, scoped)
- What component selectors exist (never invent your own class names)

If contract.json doesn't exist yet (first init), GENERATE it.

### 2. Follow execution-plan.json when integrating

When user ACCEPTS a design system, generate an execution-plan.json.
Follow it step by step. Do NOT improvise additional changes.
If a step has `"required": false` and the pattern is not found, SKIP it.
If a step has `"idempotent": true`, it's safe to re-run.

### 3. Never read from .od/ for design system data

Read design system source data from `design-systems/` in the repo directly.
The `.od/` directory is daemon internal state — not for agent consumption.

---

## Init Flow (First Time)

### Step 1: Validate Source

```
1. Read design-systems/{name}/manifest.json
2. Verify these files exist:
   - files.design (DESIGN.md) — REQUIRED
   - files.tokens (tokens.css) — REQUIRED
   - files.components (components.html) — OPTIONAL but preferred
3. If tokens.css missing → check for design-tokens.json as fallback
4. If both missing → ERROR: "Source design system has no tokens"
5. Read DESIGN.md to understand design philosophy
```

### Step 2: Detect Project Stack

Auto-detect CSS strategy based on project files:

```
IF tailwind.config.* exists AND postcss.config.* exists:
  → stack: react-tailwind, cssStrategy: tailwind-theme

ELSE IF *.module.css exists OR *.module.scss exists:
  → stack: react-css-modules, cssStrategy: custom-properties

ELSE IF "styled-components" OR "@emotion/styled" in package.json:
  → stack: react-css-in-js, cssStrategy: js-tokens

ELSE IF next.config.* exists:
  → stack: nextjs, cssStrategy: custom-properties (default)

ELSE IF vite.config.* exists OR package.json has "vue":
  → stack: vue, cssStrategy: custom-properties

ELSE:
  → stack: vanilla, cssStrategy: custom-properties
```

Override: If user explicitly specifies strategy, use that instead.

### Step 3: Generate design/ Directory

Execute in this order:

#### 3a. Token Extraction

Call the `token-extractor` skill:
- Input: `design-systems/{name}/tokens.css` (or `design-tokens.json`)
- Output: `design/tokens/colors.css`, `spacing.css`, `typography.css`, `shadows.css`
- Also generates: `design/tokens/custom.css` (uncategorized tokens)
- Also generates: `design/motion/transitions.css`, `design/motion/animations.css` (motion tokens)
- Also generates: `design/layout/grid.css`, `design/layout/breakpoints.css` (layout tokens)

#### 3b. Component Extraction

Call the `component-forge` skill:
- Input: `design-systems/{name}/components.html` + `components.manifest.json`
- Output: `design/components/{name}.css` for each component
- Also populates component registry for contract.json

#### 3c. Motion Generation (if creative-motion skill is relevant)

- Read creative-motion SKILL.md for motion rules
- Apply motion rules consistent with the DS's DESIGN.md philosophy
- Write `design/motion/transitions.css` and `design/motion/animations.css`
- Add `prefers-reduced-motion` fallback for ALL motion rules

#### 3d. Layout Generation

- Extract spacing tokens → `design/layout/grid.css`
- Extract breakpoint tokens → `design/layout/breakpoints.css`
- Generate container system based on DS spacing philosophy

### Step 4: Generate manifest.json

```json
{
  "schemaVersion": "od-design-local/v1",
  "version": 1,
  "source": {
    "designSystem": "{name}",
    "repoHash": "{content-hash-of-source-DS}",
    "generatedAt": "{ISO-datetime}",
    "generatedBy": "open-design-agent"
  },
  "extensions": [],
  "stack": "{detected-stack}",
  "cssStrategy": "{detected-strategy}",
  "import": {
    "strategy": "{index|direct|tailwind}",
    "entry": "{index.css|tailwind.css}"
  },
  "rollback": {
    "lastStableHash": null,
    "lastStableAt": null,
    "history": []
  }
}
```

To compute `repoHash`:
- Read all source files from `design-systems/{name}/` listed in its manifest.json
- Concatenate contents, compute SHA-256 hash
- Store first 7 chars as repoHash

### Step 5: Generate contract.json

```json
{
  "schemaVersion": "od-design-contract/v1",
  "tokens": {
    "colors": ["--accent", "--bg", "--surface", "..."],
    "spacing": ["--spacing-xs", "--spacing-sm", "..."],
    "typography": ["--font-body", "--text-sm", "..."],
    "shadows": ["--elev-flat", "--elev-raised", "..."],
    "motion": ["--motion-base", "--motion-fast", "--ease-standard", "..."],
    "layout": ["--radius-sm", "--radius-md", "--container-max", "..."]
  },
  "naming": {
    "componentSelector": "kebab-case",
    "tokenPrefix": "",
    "fileNaming": "kebab-case",
    "bemEnabled": false
  },
  "scope": {
    "type": "global",
    "customPropertiesRoot": ":root",
    "componentPrefix": ""
  },
  "components": [
    {
      "name": "button",
      "file": "components/button.css",
      "selectors": [".btn", ".btn-primary", ".btn-secondary"]
    }
  ],
  "strategyConfig": {
    "customProperties": {
      "rootSelector": ":root",
      "fallbackValues": false
    }
  }
}
```

Token lists come from reading the generated `tokens/*.css` files.
Component registry comes from `component-forge` output.
Naming convention is detected from source DS.

### Step 6: Generate execution-plan.json

```json
{
  "schemaVersion": "od-execution-plan/v1",
  "generatedAt": "{ISO-datetime}",
  "sourceDesignSystem": "{name}",
  "status": "pending",
  "phase1": {
    "description": "Generate design/ directory",
    "steps": [
      { "id": "p1-1", "action": "create-directory", "path": "design/" },
      { "id": "p1-2", "action": "write-file", "path": "design/tokens/colors.css", "source": "design-systems/{name}/tokens.css", "transform": "extract-colors" },
      "..."
    ]
  },
  "phase2": {
    "description": "Update project source files",
    "steps": [
      { "id": "p2-1", "action": "prepend-to-file", "path": "src/app/globals.css", "content": "@import \"../design/index.css\";", "idempotent": true },
      "..."
    ]
  },
  "rollback": {
    "snapshotBefore": "{hash}",
    "filesToBackup": ["src/app/globals.css"],
    "idempotent": true
  }
}
```

Phase 2 steps are generated by scanning project source files:
- Find hardcoded colors → generate replace steps with `var(--{token})`
- Find inline styles → generate refactoring steps
- Find CSS files without import → generate prepend-import steps
- Mark CSS Modules / incompatible files as `"action": "skip"`

### Step 7: Generate Entry Point CSS

**If cssStrategy = "custom-properties"** → generate `design/index.css`:
```css
/* design/index.css — AUTO-GENERATED */
/* Design System: {name} | Generated: {date} | DO NOT EDIT */
/* Source: design-systems/{name} (hash: {hash}) */
/* Contract: design/contract.json — read this before writing code */

/* ── Tokens ──── */
@import "./tokens/colors.css";
@import "./tokens/spacing.css";
@import "./tokens/typography.css";
@import "./tokens/shadows.css";

/* ── Layout ──── */
@import "./layout/grid.css";
@import "./layout/breakpoints.css";

/* ── Components ──── */
@import "./components/button.css";
/* ... all extracted components ... */

/* ── Motion ──── */
@import "./motion/transitions.css";
@import "./motion/animations.css";
```

**If cssStrategy = "tailwind-theme"** → generate `design/tailwind.css`:
```css
/* design/tailwind.css — AUTO-GENERATED */
/* Design System: {name} | Generated: {date} | DO NOT EDIT */

@theme {
  /* Map all tokens from tokens.css into @theme format */
  --color-accent: var(--accent);
  --color-bg: var(--bg);
  /* ... */
  --font-sans: var(--font-body);
  /* ... */
}
```

Also generate `design/index.css` for fallback — non-Tailwind consumers can still use it.

### Step 8: Update Project Entry CSS

Add import to the project's main CSS file:
```css
@import "../design/index.css";     /* for custom-properties strategy */
/* OR */
@import "../design/tailwind.css";  /* for tailwind-theme strategy */
```

This step is IDEMPOTENT:
- Check if import already exists → skip if present
- Find the correct CSS entry file (globals.css, app.css, main.css, styles.css)
- Prepend the import at the top of the file

---

## Update Flow (Existing design/)

### Step 1: Read Current State

```
1. Read design/manifest.json → source.designSystem, source.repoHash, extensions[]
2. Read design/contract.json → current conventions, token registry
3. Hash current repo DS content → newHash
4. Compare newHash with manifest source.repoHash
```

### Step 2: Determine Action

```
IF newHash == source.repoHash:
  → "Design system is already up to date"
  → STOP

IF newHash != source.repoHash:
  → Continue to Step 3
```

### Step 3: Backup for Rollback

```
1. Compute hash of current design/ directory
2. Store as manifest.rollback.lastStableHash
3. Store as manifest.rollback.lastStableAt = now
4. Append to manifest.rollback.history[]
```

### Step 4: Smart Merge

```
FOR each file in design/ (excluding manifest.json, contract.json, execution-plan.json):

  IF file is in extensions[] with type: "override":
    → SKIP — preserve user modification
    → Add to update report as "skipped (user modified)"

  ELSE IF file is in extensions[] with type: "add":
    → SKIP — preserve agent/user addition
    → Add to update report as "skipped (custom addition)"

  ELSE:
    → REGENERATE from source DS
    → Add to update report as "updated"
```

### Step 5: Regenerate Metadata

```
1. Regenerate contract.json (tokens may have changed)
2. Regenerate execution-plan.json (new integration steps)
3. Regenerate index.css (file list may have changed)
4. Update manifest.json:
   - source.repoHash = newHash
   - source.generatedAt = now
   - Keep extensions[] as-is
```

### Step 6: Generate Update Report

Show user what changed:

```
## Design System Update Report

**Source**: {name} (hash: {old} → {new})
**Updated**: {date}

### Updated (N files)
- tokens/spacing.css (source changed)
- components/button.css (source changed)

### Skipped — User Modified (N files)
- tokens/colors.css (override detected, preserving)

### Added (N files)
- components/dropdown.css (new in source DS)

### Removed (N files)
(none)

### Contract Changes
- New tokens: --color-primary-950
- Removed tokens: (none)
- New components: dropdown
```

---

## Switch Vibe Flow

### Step 1: Read Current State

```
1. Read design/manifest.json → current source, extensions
2. Read design/contract.json → current conventions
```

### Step 2: Confirm with User

```
"Switching from {current} to {new}. Keep your customizations?"
- YES → Smart merge (preserve extensions, regenerate everything else)
- NO → Full reset (delete design/ contents, re-init from new source)
```

### Step 3: Execute Switch

**Smart merge path:**
```
1. Keep all files in extensions[] (override + add)
2. Regenerate all other files from new source DS
3. Regenerate contract.json (new naming conventions!)
4. Regenerate execution-plan.json
5. Update manifest.json with new source
```

**Full reset path:**
```
1. Store rollback info from current manifest
2. Delete all files in design/ (keep the directory)
3. Re-run full Init Flow with new source DS
```

### Step 4: Update Project Integration

- Regenerate execution-plan.json with new integration steps
- Execute phase 2 of the new plan (update imports, replace hardcoded values)

---

## Rollback Flow

### When to Rollback

- User says: "rollback design system"
- User says: "the update broke something, revert"
- Agent detects execution failure

### Rollback Steps

```
1. Read design/manifest.json → rollback.lastStableHash
2. IF backup exists in .design-backup/:
     → Restore all files from backup
   ELSE:
     → Re-generate from rollback.history[0] source info
     → Re-run init flow with that source DS + repoHash
3. Regenerate execution-plan.json
4. Re-execute integration steps (idempotent — safe to re-run)
5. Update manifest.json with restored state
```

### Idempotent Execution

Every step in execution-plan.json is designed to be idempotent:
- `prepend-to-file` with `"idempotent": true` → checks if content already exists before adding
- `replace-in-file` → only replaces if exact match found, skips otherwise
- `write-file` → overwrites (safe for generated design/ files)
- `skip` → always safe, just logs reason

If an update fails at step 7 of 20, agent can re-run the entire plan.
Steps 1-6 will skip (already applied). Step 7+ will execute fresh.

---

## File Structure Reference

```
{project-root}/
├── design/
│   ├── manifest.json          ← Source tracking, extensions, rollback
│   ├── contract.json          ← Token registry, naming, scope, components
│   ├── execution-plan.json    ← Step-by-step integration instructions
│   ├── index.css              ← AUTO-GENERATED entry point
│   ├── tokens/
│   │   ├── colors.css
│   │   ├── spacing.css
│   │   ├── typography.css
│   │   └── shadows.css
│   ├── components/
│   │   ├── button.css
│   │   ├── card.css
│   │   └── ...
│   ├── motion/
│   │   ├── transitions.css
│   │   └── animations.css
│   └── layout/
│       ├── grid.css
│       └── breakpoints.css
├── src/
│   ├── app/
│   │   └── globals.css        ← @import "../design/index.css";
│   └── ...
└── package.json
```

## Layout Generation Algorithm

When generating `design/layout/`, follow this algorithm:

### grid.css Generation

```
1. Read all spacing tokens from tokens/spacing.css
2. Extract --spacing-* and --gap-* values
3. Generate container system:

   .container {
     width: 100%;
     max-width: var(--container-max, 1200px);
     margin-inline: auto;
     padding-inline: var(--container-gutter, var(--spacing-md));
   }

   .grid {
     display: grid;
     gap: var(--gap-md, var(--spacing-md));
   }

   .grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
   .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
   .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
   .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
   .grid-cols-6 { grid-template-columns: repeat(6, 1fr); }
   .grid-cols-12 { grid-template-columns: repeat(12, 1fr); }

4. Generate responsive grid using breakpoints from breakpoints.css:

   @media (min-width: var(--breakpoint-sm)) {
     .sm\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
   }

5. Generate z-index scale:

   :root {
     --z-base: 0;
     --z-dropdown: var(--z-dropdown, 100);
     --z-sticky: var(--z-sticky, 200);
     --z-overlay: var(--z-overlay, 300);
     --z-modal: var(--z-modal, 400);
     --z-popover: var(--z-popover, 500);
     --z-tooltip: var(--z-tooltip, 600);
     --z-toast: var(--z-toast, 700);
   }
```

If the source DS has specific grid/layout conventions in DESIGN.md, follow those instead.

### breakpoints.css Generation

```
1. Read --breakpoint-* tokens from token extraction output
2. If no breakpoint tokens exist, generate sensible defaults:

   :root {
     --breakpoint-xs: 320px;
     --breakpoint-sm: 640px;
     --breakpoint-md: 768px;
     --breakpoint-lg: 1024px;
     --breakpoint-xl: 1280px;
     --breakpoint-2xl: 1536px;
   }

3. If source DS has specific breakpoints (e.g. Apple uses compact/regular/extraLarge),
   map them to standard names:

   Apple compact (640px) → --breakpoint-sm
   Apple regular (768px) → --breakpoint-md
   Apple extraLarge (1024px) → --breakpoint-lg

4. Generate responsive utility classes if cssStrategy = custom-properties:

   @media (min-width: var(--breakpoint-sm)) { /* sm utilities */ }
   @media (min-width: var(--breakpoint-md)) { /* md utilities */ }
   @media (min-width: var(--breakpoint-lg)) { /* lg utilities */ }
   @media (min-width: var(--breakpoint-xl)) { /* xl utilities */ }
```

---

## Motion Generation Algorithm

When generating `design/motion/`, follow this algorithm:

### transitions.css Generation

```
1. Read all motion tokens from token extraction:
   - --duration-* tokens → transition durations
   - --ease-* tokens → timing functions
   - --motion-* tokens → combined motion values
   - --transition-* tokens → pre-composed transitions

2. If no motion tokens exist in source DS, generate sensible defaults:

   :root {
     --duration-instant: 75ms;
     --duration-fast: 150ms;
     --duration-normal: 250ms;
     --duration-slow: 400ms;
     --duration-glacial: 800ms;

     --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
     --ease-in: cubic-bezier(0.42, 0, 1, 1);
     --ease-out: cubic-bezier(0, 0, 0.58, 1);
     --ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
     --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
     --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
   }

3. Read creative-motion/SKILL.md if the project uses motion:
   - Check if creative-motion skill is relevant (project has animation needs)
   - Apply motion choreography rules from creative-motion
   - Ensure transitions align with the DS's DESIGN.md philosophy

4. Generate composed transition utilities:

   .transition-colors {
     transition-property: color, background-color, border-color;
     transition-duration: var(--duration-fast);
     transition-timing-function: var(--ease-default);
   }

   .transition-opacity {
     transition-property: opacity;
     transition-duration: var(--duration-fast);
     transition-timing-function: var(--ease-default);
   }

   .transition-transform {
     transition-property: transform;
     transition-duration: var(--duration-normal);
     transition-timing-function: var(--ease-spring);
   }

   .transition-all {
     transition-property: all;
     transition-duration: var(--duration-normal);
     transition-timing-function: var(--ease-default);
   }

5. Add prefers-reduced-motion fallback for ALL transitions:

   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       transition-duration: 0.01ms !important;
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
     }
   }
```

### animations.css Generation

```
1. Read --animate-* tokens from source DS
2. If no animate tokens, generate standard set:

   @keyframes fadeIn {
     from { opacity: 0; }
     to { opacity: 1; }
   }

   @keyframes fadeOut {
     from { opacity: 1; }
     to { opacity: 0; }
   }

   @keyframes slideInUp {
     from { transform: translateY(10px); opacity: 0; }
     to { transform: translateY(0); opacity: 1; }
   }

   @keyframes slideInDown {
     from { transform: translateY(-10px); opacity: 0; }
     to { transform: translateY(0); opacity: 1; }
   }

   @keyframes scaleIn {
     from { transform: scale(0.95); opacity: 0; }
     to { transform: scale(1); opacity: 1; }
   }

   @keyframes spin {
     from { transform: rotate(0deg); }
     to { transform: rotate(360deg); }
   }

   @keyframes pulse {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.5; }
   }

3. Generate animation utility classes:

   .animate-fade-in { animation: fadeIn var(--duration-normal) var(--ease-out); }
   .animate-fade-out { animation: fadeOut var(--duration-fast) var(--ease-in); }
   .animate-slide-up { animation: slideInUp var(--duration-normal) var(--ease-out); }
   .animate-scale-in { animation: scaleIn var(--duration-fast) var(--ease-spring); }
   .animate-spin { animation: spin 1s linear infinite; }
   .animate-pulse { animation: pulse 2s var(--ease-in-out) infinite; }

4. Map DS-specific animations from DESIGN.md if they exist
5. Add prefers-reduced-motion override:

   @media (prefers-reduced-motion: reduce) {
     .animate-fade-in,
     .animate-fade-out,
     .animate-slide-up,
     .animate-scale-in {
       animation: none !important;
     }
   }
```

---

## Multi-Strategy CSS Support

### Strategy A: custom-properties (Default)

Best for: React + CSS, Vue, Svelte, Vanilla, Next.js (non-Tailwind)

```css
/* design/index.css — single entry point */
@import "./tokens/colors.css";
@import "./tokens/spacing.css";
@import "./tokens/typography.css";
@import "./tokens/shadows.css";
@import "./layout/grid.css";
@import "./layout/breakpoints.css";
@import "./components/button.css";
/* ... all components ... */
@import "./motion/transitions.css";
@import "./motion/animations.css";
```

Project imports:
```css
/* src/app/globals.css */
@import "../design/index.css";
```

All tokens are CSS custom properties in `:root`. Components use `var(--token)`.
This is the simplest and most portable strategy.

### Strategy B: tailwind-theme (Tailwind v4)

Best for: React + Tailwind v4 projects

```css
/* design/tailwind.css — PRIMARY entry point */
@theme {
  /* Colors — map all color tokens */
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-fg: var(--fg);
  --color-fg-2: var(--fg-2);
  --color-meta: var(--meta);
  --color-border: var(--border);
  --color-danger: var(--danger);
  --color-success: var(--success);
  --color-warning: var(--warning);

  /* Typography */
  --font-sans: var(--font-body);
  --font-mono: var(--font-mono);

  /* Spacing — keep as-is */
  --spacing-xs: var(--spacing-xs);
  --spacing-sm: var(--spacing-sm);
  --spacing-md: var(--spacing-md);

  /* Radius */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
}
```

Project imports:
```css
/* src/app/globals.css */
@import "../design/tailwind.css";
```

ALSO generate `design/index.css` as fallback — non-Tailwind consumers can still use it.
Components stay in `design/components/*.css` and are imported via Tailwind's `@layer` or `@import`.

### Strategy C: CSS Modules Hybrid

Best for: React + CSS Modules projects

```css
/* src/app/globals.css — tokens ONLY (global scope) */
@import "../design/tokens/colors.css";
@import "../design/tokens/spacing.css";
@import "../design/tokens/typography.css";
@import "../design/tokens/shadows.css";
@import "../design/layout/grid.css";
@import "../design/layout/breakpoints.css";
@import "../design/motion/transitions.css";
```

```css
/* src/components/Button.module.css — uses var() from globals */
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
```

Component CSS from `design/components/` is REFERENCE ONLY — developer copies what
they need into their `.module.css` files. Global component files still exist for
non-module components (like layout shells, modals with portals, etc.).

In `manifest.json`:
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

### Strategy D: js-tokens (CSS-in-JS)

Best for: styled-components, Emotion, Vanilla Extract (if using JS tokens)

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
  fg: '#1d1d1f',
  fg2: '#6e6e73',
  meta: '#86868b',
  border: '#d2d2d7',
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
};

export const typography = {
  fontSans: '"SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  fontMono: '"SF Mono", ui-monospace, monospace',
  textXs: '0.75rem',
  textSm: '0.875rem',
  textBase: '1rem',
  textLg: '1.125rem',
  textXl: '1.25rem',
};

export const motion = {
  durationFast: '150ms',
  durationNormal: '250ms',
  durationSlow: '400ms',
  easeDefault: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Composed token object for convenience
const tokens = { colors, spacing, typography, motion };
export default tokens;
```

Project imports:
```javascript
// src/components/Button.tsx
import { colors, spacing, motion } from '../design/tokens';

const StyledButton = styled.button`
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

ALSO generate `design/index.css` and `design/tokens/*.css` for any non-CSS-in-JS parts
of the project (e.g. third-party overrides, legacy code).

In `manifest.json`:
```json
{
  "cssStrategy": "js-tokens",
  "import": {
    "strategy": "js-tokens",
    "entry": "tokens.js"
  }
}
```

### Strategy Auto-Detection Algorithm

```
1. Check for user explicit preference → use that, skip detection
2. Auto-detect in this priority order:

   a. IF tailwind.config.ts OR tailwind.config.js exists
      AND (postcss.config.js OR postcss.config.mjs exists):
      → strategy: tailwind-theme

   b. ELSE IF *.module.css OR *.module.scss exists in src/:
      → strategy: custom-properties (with modules-hybrid import)

   c. ELSE IF package.json contains "styled-components"
      OR "@emotion/styled" OR "@emotion/react":
      → strategy: js-tokens

   d. ELSE IF next.config.* exists:
      → strategy: custom-properties (default for Next.js)

   e. ELSE IF vite.config.* exists OR package.json contains "vue":
      → strategy: custom-properties

   f. ELSE:
      → strategy: custom-properties (universal fallback)

3. Store detected strategy in manifest.json cssStrategy field
4. Generate strategy-specific config in contract.json strategyConfig
5. Generate both primary AND fallback entry points
```

---

## Hash Computation Algorithm

### Source DS Hash (repoHash)

```
1. Read design-systems/{name}/manifest.json
2. Get list of source files from manifest.files
3. For each source file that exists:
   a. Read file content
   b. Strip trailing newlines and whitespace
4. Concatenate all file contents in manifest order, separated by null byte
5. Compute SHA-256 hash of the concatenated string
6. Store first 7 characters as repoHash

Implementation pseudocode:
  files = readManifest(name).files
  contents = []
  for file in [files.design, files.tokens, files.components]:
    if exists(file):
      contents.append(read(file).strip())
  combined = '\0'.join(contents)
  repoHash = sha256(combined).hexdigest()[:7]
```

### Design Directory Hash (for rollback)

```
1. List all files in design/ (excluding manifest.json, contract.json, execution-plan.json)
2. For each file:
   a. Read content
   b. Strip trailing newlines
3. Sort file paths alphabetically
4. Concatenate: "{relative-path}\0{content}" for each file
5. Compute SHA-256 hash
6. Store first 7 characters as the directory hash

This hash is used for:
- rollback.lastStableHash (hash before last update)
- rollback.history[].hash (hash at each historical point)
- extension detection (comparing original vs current file hash)
```

### Extension Detection Algorithm

After generating design/ for the first time, compute the hash of each file:

```
1. For each file in design/ (excluding manifest.json, contract.json, execution-plan.json):
   a. Compute SHA-256 of file content
   b. Store first 7 chars as originalHash
   c. Add to manifest.extensions[] as:
      { type: "source", file: "tokens/colors.css", originalHash: "a1b2c3d" }

During update:
2. For each file that was in the original generation:
   a. Compute current hash
   b. Compare with originalHash
   c. If different → file was modified by user/agent
      → Add to extensions[] as { type: "override", file: "...", originalHash: "...", currentHash: "..." }

For new files not in original generation:
3. These are additions:
   → Add to extensions[] as { type: "add", file: "...", addedBy: "agent", addedAt: "..." }
```

---

## Render → Accept → Execute Flow (Phase 3)

### Frontend Integration

When the open-design UI supports design system selection:

```
┌──────────────────────────────────────────────────────────────┐
│ RENDER PHASE                                                 │
│                                                               │
│ 1. User opens design system picker                            │
│ 2. Frontend reads design-systems/{name}/manifest.json        │
│ 3. Frontend loads tokens.css + components.html               │
│ 4. Frontend renders LIVE PREVIEW:                             │
│    - Color palette swatches                                   │
│    - Typography samples                                       │
│    - Component examples (button, card, etc.)                  │
│    - Spacing rhythm visualization                             │
│    - Motion examples (hover states, transitions)              │
│ 5. User can BROWSE and SWITCH between DS packages             │
│    - No files written yet                                     │
│    - Preview is ephemeral, re-renders on selection            │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ ACCEPT PHASE                                                  │
│                                                               │
│ 6. User clicks "Apply to project"                             │
│ 7. Backend triggers design-sync init flow                     │
│ 8. Backend generates:                                         │
│    - design/ directory with all files                         │
│    - manifest.json, contract.json, execution-plan.json        │
│    - index.css (or tailwind.css / tokens.js)                  │
│ 9. Backend returns execution-plan.json to frontend            │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ EXECUTE PHASE                                                 │
│                                                               │
│ 10. Agent reads execution-plan.json                           │
│ 11. Agent reads contract.json                                 │
│ 12. Agent executes each step:                                 │
│     - Prepend @import to globals.css                          │
│     - Replace hardcoded values with var(--token)              │
│     - Add motion to components                                │
│     - Skip incompatible files                                 │
│ 13. Agent reports completion                                  │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ ROLLBACK (if needed)                                          │
│                                                               │
│ 14. If something breaks:                                      │
│     - Agent reads manifest.json → rollback.lastStableHash     │
│     - Restore from backup or re-generate                      │
│     - Execution plan is idempotent — safe to re-run           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Preview Rendering Contract

For the frontend to render a preview, it needs:

```json
{
  "previewData": {
    "manifest": { /* from design-systems/{name}/manifest.json */ },
    "tokens": { /* parsed from design-systems/{name}/tokens.css */ },
    "components": { /* from design-systems/{name}/components.html */ },
    "design": { /* from design-systems/{name}/DESIGN.md */ },
    "tailwindV4": { /* from design-systems/{name}/tailwind-v4.css, if exists */ }
  }
}
```

The frontend should render this data in a standard preview layout:
- Color grid (all color tokens as swatches)
- Typography scale (all font/text tokens as sample text)
- Component showcase (rendered components.html)
- Spacing scale (visual representation of spacing tokens)
- Motion examples (animated hover states using motion tokens)

### Switching DS in Preview

When user switches to a different DS:
1. Unload current preview data
2. Load new DS preview data
3. Re-render preview
4. NO files written — preview is ephemeral
5. Only when user clicks "Apply" does the generation begin

---

## Multi-Vibe Composition (Phase 4)

### Composition Schema

When composing design/ from multiple DS sources:

```jsonc
// In manifest.json
{
  "composition": [
    {
      "source": "apple",
      "layers": ["tokens", "layout"],
      "repoHash": "a3f7b2c"
    },
    {
      "source": "brutalism",
      "layers": ["components"],
      "repoHash": "d4e5f6a"
    },
    {
      "source": "creative-motion",
      "layers": ["motion"],
      "repoHash": "b2c3d4e"
    }
  ]
}
```

### Layer-Based Extraction

Each DS can contribute one or more layers:

| Layer | What it provides | Output directory |
|-------|-----------------|------------------|
| tokens | CSS custom properties | design/tokens/ |
| components | Component CSS | design/components/ |
| motion | Transitions & animations | design/motion/ |
| layout | Grid & breakpoints | design/layout/ |

For each composition entry:
1. Read the source DS from design-systems/{name}/
2. Extract only the specified layers
3. Write to the corresponding output directory
4. Track the source in composition[] array

### Conflict Resolution: Last-Wins-Per-Layer

When multiple DS packages contribute to the SAME layer:
- The LAST entry in the composition[] array wins
- Cross-layer contributions are orthogonal (no conflict)
- Example: Apple tokens + Brutalism tokens → Brutalism tokens win (listed last)
- Example: Apple tokens + Brutalism components → No conflict (different layers)

### Composition contract.json

When composition is active, contract.json reflects the merged state:

```jsonc
{
  "tokens": {
    "colors": ["--accent", "--bg", /* from last token source */],
    "spacing": ["--spacing-xs", /* from last token source */]
  },
  "naming": {
    "componentSelector": "kebab-case",  // from component source
    "tokenPrefix": "",                    // from last token source
    "fileNaming": "kebab-case"
  },
  "components": [
    /* from component source only */
  ],
  "compositionMeta": {
    "tokenSource": "brutalism",
    "componentSource": "brutalism",
    "motionSource": "creative-motion",
    "layoutSource": "apple"
  }
}
```

### Composition Init Flow

```
1. User: "compose apple tokens with brutalism components"
2. For each composition entry:
   a. Validate source DS exists
   b. Extract specified layers
   c. Write to design/ directories
3. Generate merged manifest.json with composition[] array
4. Generate merged contract.json reflecting all layers
5. Generate execution-plan.json for the composed system
6. Generate index.css importing all layers
7. Update project imports
```

### Composition Update Flow

When updating a composed design/:

```
1. For each entry in composition[]:
   a. Hash current repo DS content
   b. Compare with stored repoHash
   c. If changed → mark for update
2. For each layer marked for update:
   a. Re-extract from updated source DS
   b. Apply smart merge (respect extensions)
   c. Update composition[].repoHash
3. Regenerate merged contract.json
4. Regenerate execution-plan.json
5. Generate update report per composition source
```

---

## CLI Interface (Phase 5)

### Command Specifications

When the `od` CLI supports design system management:

#### `od design init --from {name}`

Initialize design/ from a source DS.

```
Flags:
  --from {name}         Source DS from design-systems/ (required)
  --strategy {type}     CSS strategy: custom-properties|tailwind-theme|js-tokens (auto-detect)
  --project {path}      Target project path (default: current directory)
  --force               Overwrite existing design/ directory

Output:
  Creates design/ directory with all generated files
  Prints summary: DS name, strategy, token count, component count

Exit codes:
  0 = success
  1 = source DS not found
  2 = design/ already exists (use --force)
  3 = project path invalid
```

#### `od design update`

Smart sync from source DS.

```
Flags:
  --project {path}      Target project path (default: current directory)
  --force               Force update even if hash matches
  --dry-run             Show what would change without writing

Output:
  Update report showing:
  - Updated files
  - Skipped files (user modified)
  - Added files (new in source)
  - Removed files
  - Contract changes
  - Rollback available

Exit codes:
  0 = success, changes applied
  0 = already up to date (no changes)
  1 = no design/ directory found
  2 = source DS not found
```

#### `od design add component {name}`

Add a single component from any DS.

```
Flags:
  --from {ds-name}      Source DS (default: current source from manifest)
  --project {path}      Target project path

Output:
  Adds component CSS to design/components/
  Updates contract.json with new component entry
  Updates index.css with new import

Exit codes:
  0 = success
  1 = component not found in source
  2 = component already exists
```

#### `od design switch --from {name}`

Switch to a different DS source.

```
Flags:
  --from {name}         New source DS (required)
  --keep-customizations Preserve override/add extensions
  --reset               Full reset, delete and re-init
  --project {path}      Target project path

Output:
  Executes switch vibe flow
  Shows what changed and what was preserved

Exit codes:
  0 = success
  1 = new source DS not found
  2 = conflict resolution failed
```

#### `od design diff`

Show pending changes (what would update do).

```
Flags:
  --project {path}      Target project path
  --json                Output as JSON

Output:
  Same as update report but without applying changes
  Shows: would-update, would-skip, would-add, contract changes

Exit codes:
  0 = changes available
  1 = no design/ directory found
```

#### `od design sources`

List available DS packages.

```
Flags:
  --json                Output as JSON
  --filter {category}   Filter by category (e.g. "minimal", "bold", "playful")

Output:
  Table of available DS packages:
  NAME | CATEGORY | TOKENS | COMPONENTS | DESCRIPTION

Exit codes:
  0 = success
```

#### `od design rollback`

Restore previous design/ state.

```
Flags:
  --project {path}      Target project path
  --to {hash}           Specific hash to rollback to (default: lastStableHash)
  --list                List available rollback points

Output:
  Restores design/ to previous state
  Shows what was restored

Exit codes:
  0 = success
  1 = no design/ directory found
  2 = rollback point not found
  3 = no rollback history available
```

### CLI vs Agent Parity

Both CLI and agent produce IDENTICAL results:
- Same hash computation algorithm
- Same token classification rules
- Same component extraction logic
- Same smart merge behavior
- Same rollback mechanism

CLI can be used in:
- CI/CD pipelines (headless)
- Pre-commit hooks (diff check)
- Developer terminal workflows
- Automated batch operations

---

## What NOT to Do

- **NEVER** write to `design-systems/` in the repo — it's read-only reference
- **NEVER** modify files listed in extensions[] with type: "override" during update
- **NEVER** invent token names not in contract.json
- **NEVER** invent component class names not in contract.json components[]
- **NEVER** skip the execution-plan — it exists so you don't improvise
- **NEVER** run Phase 2 changes without reading contract.json first
- **NEVER** remove rollback history during update
- **NEVER** generate motion without prefers-reduced-motion fallback
- **NEVER** use .od/ as design system source — read from repo design-systems/ directly
- **NEVER** skip hash computation — it's the foundation of smart update and rollback
