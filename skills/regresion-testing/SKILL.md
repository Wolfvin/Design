---
name: regression-testing
description: >
  Output-based regression testing skill for AI-driven refactoring. Use this skill whenever
  the user wants to safely refactor, simplify, or restructure code without breaking behavior.
  Trigger when user mentions: refactor, simplify, clean up modules, split big files, make
  maintainable, regression test, snapshot test, or "make sure nothing breaks after refactor".
  This skill captures behavioral fingerprints of code clusters BEFORE refactoring, then
  validates them AFTER — so AI can freely restructure internals as long as outputs stay identical.
  Always use this skill before any non-trivial refactor.
---

# Regression Testing — Output Fingerprint Skill

A skill for AI-driven refactoring with zero fear. Capture what code *produces*, not how it works. Refactor freely. Validate outputs match. Green = safe.

**Core Mantra:** Test the contract, not the implementation.

---

## Mental Model

```
BEFORE REFACTOR                    AFTER REFACTOR
─────────────────                  ──────────────
Analyze codebase                   Run all .regret files
Tag clusters to watch         →    Compare fingerprints
Ghost-capture outputs              All green? Ship it.
Save to regrets/                   Any red? Fix code, NOT regrets.
Validate all green ← GATE
```

**The `regrets/` folder is sacred. Never edit `.regret` files after they are green.**

---

## Three Phases

### PHASE 1 — AUDIT (capture truth)
### PHASE 2 — REFACTOR (restructure freely)  
### PHASE 3 — VALIDATE (prove nothing broke)

Read `references/phases.md` for detailed instructions per phase.

---

## The `.regret` File Format

One file per behavioral cluster. Filename = the contract name.

```
regrets/
  transform-user-data.regret
  fetch-invoice.regret
  login-flow.regret
```

Each `.regret` file:

```
cluster: transform-user-data
fingerprint: 9jadb
captured: 2024-01-15T10:30:00Z
watches: [g, gHelper]
entry: a
stack: js
---
INPUT  {"user":{"id":1,"name":"Ali"}}
OUTPUT {"transformed":true,"code":"ALI-001"}
HASH   9jadb
```

Rules:
- `fingerprint` = short hash of (INPUT + OUTPUT) deterministically hashed
- `watches` = function names being monitored in this cluster
- `entry` = the top-level caller that triggers the cluster
- One `.regret` = one behavioral unit = one responsibility
- Human readable, AI readable, git-diffable

---

## The Ghost Proxy Pattern

The fingerprinter wraps functions **transparently** — real execution is untouched.

```js
// Ghost never modifies behavior. It only observes.
const ghost = new Proxy(targetFn, {
  apply(target, thisArg, args) {
    const result = target.apply(thisArg, args)
    recorder.capture({ fn: target.name, args, result })
    return result  // real flow unchanged
  }
})
```

Read `scripts/fingerprint.js` for the full implementation.

---

## Cluster Manifest

Clusters are defined in `regrets/manifest.json` — placed **inside the target project** being refactored (plug-and-run pattern).

### Plug-and-Run Pattern

The `regrets/` directory lives **inside** the target project, not at the skill level. When you want to refactor a project, its `regrets/` folder appears within it:

```
my-project/
  src/
  regrets/          ← plug-and-run: lives inside target project
    manifest.json
    *.regret
    audit.log
```

This makes regrets portable, self-contained, and version-controlled alongside the code they protect.

### Manifest Format

```json
{
  "clusters": [
    {
      "id": "transform-user-data",
      "entry": "processUser",
      "watches": ["transformUser", "normalizeCode", "applyRules"],
      "file": "src/user/processor.js",
      "stack": "js",
      "fingerprintLevel": "entry",
      "description": "Transform user data with normalization",
      "inputs": [
        {"id": 1, "name": "Ali"},
        null,
        {"id": 0, "name": ""}
      ]
    },
    {
      "id": "compute-total",
      "entry": "computeTotal",
      "watches": ["computeTotal", "applyTax"],
      "file": "src/billing.js",
      "stack": "js",
      "multiArgs": true,
      "normalize": ["dynamicDates"],
      "inputs": [
        [100, 0.11, "OUTPUT_TAX"],
        [0, 0, "INPUT_TAX"]
      ]
    }
  ]
}
```

AI writes this manifest during PHASE 1. It lives in `regrets/` alongside `.regret` files.

### Cluster Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Unique cluster identifier (kebab-case) |
| `entry` | ✅ | Function name to call (exported from `file`) |
| `watches` | ✅ | Array of function names to monitor via Ghost Proxy |
| `file` | ✅ | Path to compiled JS module (relative to project root) |
| `stack` | ✅ | Runtime stack: `js`, `ts`, `python`, `rust`, `react`, or `extension` |
| `fingerprintLevel` | ❌ | `entry` (default) or `full` (entire call sequence) |
| `description` | ❌ | Human-readable purpose |
| `inputs` | ❌ | Array of test inputs (one `.regret` per first input) |
| `multiArgs` | ❌ | `true` → each input is spread as separate arguments |
| `normalize` | ❌ | Array of normalization rules for non-deterministic values |
| `ignoreFields` | ❌ | Fields to strip before hashing |
| `fingerprintMode` | ❌ | `value` (default), `schema`, or `mixed` — see Fingerprint Modes |
| `valuePaths` | ❌ | JSONPath selectors for mixed mode (e.g., `"$.status"`) |
| `module` | ❌ | Module path (dot notation for Python, colon notation for Rust) |
| `pythonPath` | ❌ | Directory to add to `sys.path` for Python imports |
| `renderMode` | ❌ | `static` for React (uses `renderToStaticMarkup`) |
| `stripAttrs` | ❌ | HTML attributes to strip before fingerprinting (React) |

---

## Fingerprint Algorithm

```
INPUT_HASH  = sha256(JSON.stringify(inputs, sortedKeys))
OUTPUT_HASH = sha256(JSON.stringify(outputs, sortedKeys))
FINGERPRINT = base36(INPUT_HASH XOR OUTPUT_HASH).slice(0, 7)
```

Properties:
- **Deterministic** — same data always produces same hash
- **Order-insensitive** — JSON keys sorted before hashing (semantic match)
- **Short** — 7 chars, human memorable (`9jadb`)
- **Opaque** — reveals nothing about internals, only that contract held

### Normalization Rules

Non-deterministic values are normalized before hashing:

| Rule | Pattern | Replacement |
|------|---------|-------------|
| `timestamps` | ISO 8601 datetime strings | `<TIMESTAMP>` |
| `uuids` | UUID v4 format | `<UUID>` |
| `epochs` | Unix epoch numbers (1B–10T) | `<EPOCH>` |
| `absPaths` | Absolute file paths | `<ROOT>/...` |
| `dynamicDates` | Embedded MMYYYY/YYYY in strings | `<MMYYYY>`/`<YYYY>` |

Use `dynamicDates` for functions that produce date-dependent output (e.g. filename generation).

Read `references/fingerprint-spec.md` for edge cases (timestamps, random IDs, etc).

---

## The Golden Rule

```
┌─────────────────────────────────────────────────┐
│  regrets/ files are written ONCE.               │
│  They are validated MANY times.                 │
│  They are NEVER edited after first green pass.  │
│                                                 │
│  If a test is red → fix the CODE.              │
│  Never fix the .regret.                         │
└─────────────────────────────────────────────────┘
```

---

## Quick Reference — AI Workflow

```
1. Read codebase → identify refactor targets
2. For chrome-dependent modules: extract pure logic into *-logic.ts files
3. Build: npm run regret:build (tsc only, preserves individual JS files)
4. Write regrets/manifest.json (clusters + watches)
5. Run: npm run regret:capture → generates .regret files
6. Run: npm run regret:drift → ALL must be green AND stable (5 runs)
7. [GATE] If any red or unstable → fix before proceeding
8. Refactor: simplify, split modules, rename, restructure
9. Run: npm run regret:validate → ALL must still be green
10. If red → fix code, re-run validate, repeat until green
11. Done. Check: npm run regret:health for cluster health score
12. Full build: npm run build (includes bundling + minification)
```

### NPM Scripts (Plug-and-Run)

Add these to the target project's `package.json`:

```json
{
  "regret:build": "npx tsc -p tsconfig.json",
  "regret:capture": "node ../../skills/regresion-testing/scripts/capture.js",
  "regret:validate": "node ../../skills/regresion-testing/scripts/validate.js",
  "regret:health": "node ../../skills/regresion-testing/scripts/health.js",
  "regret:drift": "node ../../skills/regresion-testing/scripts/validate.js --runs 5",
  "regret:update": "node ../../skills/regresion-testing/scripts/validate.js --update",
  "regret:ci": "node ../../skills/regresion-testing/scripts/validate.js --fail-fast",
  "regret:guard": "node ../../skills/regresion-testing/scripts/validate.js --fail-fast && echo '✅ Regret guard passed' || (echo '❌ Regret guard FAILED' && exit 1)"
}
```

- `regret:build` — tsc only (no bundle/minify) — preserves individual JS files for capture
- `regret:ci` — fast validation for CI pipelines
- `regret:guard` — pre-build gate: if regrets fail, block the build

---

## Gap 1 — Safe Update with Audit Trail

When behavior *intentionally* changes (new business rule, updated rate, etc), fingerprint must be updated. But unlike Jest's `--updateSnapshot` (no questions asked), updates here require a reason.

```bash
node scripts/validate.js --update transform-user-data \
  --reason "tax rate updated from 11% to 12% per regulation change"
```

This rewrites the `.regret` file AND appends to `regrets/audit.log`:

```
2024-03-01T09:00:00Z  UPDATE  transform-user-data
  old: 9jadb
  new: x3kp1
  reason: tax rate updated from 11% to 12% per regulation change
  by: AI refactor session
```

Rules:
- `--reason` is **required** — no reason, no update
- Audit log is **append-only** — never overwritten
- AI must supply a specific reason, not a generic one like "behavior changed"

Read `references/update-protocol.md` for full update flow.

---

## Gap 2 — Drift Detection

A fingerprint that changes between runs (without code changes) reveals **hidden non-determinism** — timestamps, random IDs, race conditions, global state leaks.

```bash
node scripts/validate.js --runs 5
```

Runs each cluster 5 times, fingerprints all runs, checks for consistency:

```
✅ transform-user-data    9jadb  × 5   STABLE
❌ fetch-invoice          x7k2m / ff3z / x7k2m  DRIFT DETECTED
```

If drift is detected:
1. Check `fingerprint-spec.md` — likely timestamps or random IDs not normalized
2. Add `normalize` or `ignoreFields` to manifest
3. Re-capture and re-run with `--runs 5`
4. All runs must produce identical hash before GATE passes

**Drift is a code smell, not a test problem.** Fix the non-determinism in the source.

---

## Gap 3 — Cluster Health Score

After multiple refactor cycles, `regrets/` accumulates history. Run health check to see which clusters are stable vs fragile:

```bash
node scripts/health.js
```

Output:

```
CLUSTER HEALTH REPORT
─────────────────────────────────────────────────────
cluster                    updates  drifts  age      health
transform-user-data        0        0       47d      ██████ SOLID
login-flow                 1        0       12d      █████░ GOOD
fetch-invoice              3        2       3d       ██░░░░ FRAGILE
build-request              0        1       31d      ███░░░ UNSTABLE
─────────────────────────────────────────────────────
Recommendation:
  fetch-invoice   → high update rate, consider splitting cluster
  build-request   → drift detected, check for hidden randomness
```

Health score is derived from:
- `updates` — how many times fingerprint was intentionally changed
- `drifts` — how many times drift was detected
- `age` — days since last capture

**SOLID** clusters → don't touch, they represent stable contracts
**FRAGILE** clusters → candidates for deeper refactor or cluster split

---

## Refactor Targets (what AI should push toward)

- No single file over ~200 lines
- No module that imports everything (god object)
- Each function has one job
- Pure functions preferred (easier to fingerprint)
- Side effects isolated to boundary layers
- Naming reflects intent, not implementation

---

## Multi-Args Support

For functions that take multiple arguments, add `"multiArgs": true` to the cluster definition. Each input is then spread as separate arguments:

```json
{
  "id": "filename-from-hint",
  "entry": "filenameFromHint",
  "multiArgs": true,
  "inputs": [
    ["FPK-", "202505", "OUTPUT_TAX"],
    ["DOC-", "2025", "DOC_MANAGEMENT"]
  ]
}
```

This calls `filenameFromHint("FPK-", "202505", "OUTPUT_TAX")` etc.

## Pure Logic Extraction (Chrome Extensions)

When a module depends on `chrome.*` APIs or DOM, extract the pure business logic into a separate module:

```
BEFORE (untestable):
  subscription.ts → isSubscribed() → chrome.storage.local.get(...)

AFTER (testable):
  subscription-logic.ts → isSubscriptionActive(sub, now) → boolean  (pure!)
  subscription.ts       → isSubscribed() → chrome.storage.local.get() → isSubscriptionActive(data, Date.now())
```

The pure module can be fingerprinted directly. The original module delegates to the pure function after handling side effects. See `references/extension.md` for details.

---

## Stack Support

| Stack | Capture method | Fingerprint target | Notes |
|-------|---------------|-------------------|-------|
| JS/TS | Proxy wrapping | Value (default) | Best support |
| Python | Ghost decorator + `importlib` | Value (default) | Full support — see `references/python.md` |
| Rust | Trait wrapping + `cargo test` | Value (default) | See `references/rust.md` |
| React/JSX | `renderToStaticMarkup` | Rendered HTML | See `references/react.md` |
| Browser extension | Pure logic extraction + Proxy | Value (default) | See `references/extension.md` |

---

## Fingerprint Modes

| Mode | Field | Fingerprint from | Best for |
|------|-------|-----------------|----------|
| Value | `"fingerprintMode": "value"` | Full output JSON | Pure functions, formatters (default) |
| Schema | `"fingerprintMode": "schema"` | Output shape/structure only | Config builders, API response factories |
| Mixed | `"fingerprintMode": "mixed"` | Schema + selected value paths | Validators, hybrid outputs |
| Render | Stack `react` with `renderMode` | Rendered HTML string | React components |

Read `references/structural.md` for the full specification including `extractSchema()`, `valuePaths`, and mode selection decision tree.

---

## Files in This Skill

```
regression-testing/
├── SKILL.md                    ← you are here
├── scripts/
│   ├── capture.js              ← ghost-proxy runner, writes .regret files (JS/TS)
│   ├── validate.js             ← compares fingerprints, reports green/red (JS/TS)
│   ├── health.js               ← cluster health score report (all stacks)
│   ├── fingerprint.js          ← hashing logic (core algorithm)
│   ├── capture.py              ← ghost-decorator runner (Python)
│   ├── validate.py             ← regression validator (Python)
│   ├── health.py               ← cluster health report (Python)
│   ├── capture_react.mjs       ← React component render capture
│   └── capture_rust.sh         ← Rust cluster capture runner
└── references/
    ├── phases.md               ← detailed per-phase AI instructions
    ├── fingerprint-spec.md     ← edge cases, non-deterministic values
    ├── update-protocol.md      ← safe update + audit trail rules
    ├── python.md               ← Python stack — full implementation
    ├── rust.md                 ← Rust stack — trait wrapping + cargo test
    ├── react.md                ← React/JSX stack — render fingerprinting
    ├── structural.md           ← Output Design Fingerprint (schema/mixed modes)
    └── extension.md            ← Browser extension variant
```
