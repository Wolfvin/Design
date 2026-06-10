# Worklog

---
Task ID: 1
Agent: Main
Task: Create comprehensive migration plan for Open Design → App Developer tool

Work Log:
- Deep-dived Open Design daemon architecture (API routes, skills, artifacts, design systems, chat system)
- Deep-dived Open Design web app architecture (pages, components, artifact rendering pipeline, chat interface)
- Deep-dived Open Design packages (host bridge, sidecar proto, contracts)
- Explored user's Tauri app (doesn't exist on server yet - needs to be created)
- Explored OD built-in skills (~200+ design-centric skills)
- Validated user's hypothesis: HALF CORRECT - OD always creates new projects, BUT pickAndImport exists
- Identified 3 fundamental problems: output format (artifacts), preview (srcdoc iframe), design system (prompt-only)
- Designed new architecture: App Developer mode with <file-edit> parser, Vite HMR preview, design token sync
- Created comprehensive migration plan document (14 sections)
- Generated DOCX with proper formatting, TOC, and cover page

Stage Summary:
- Document saved to /home/z/my-project/download/open-design-app-developer-migration-plan.docx
- Plan covers: Executive Summary, Hypothesis Validation, New Architecture, File Edit Parser, System Prompt, Design Token Sync, Vite HMR Preview, Skill System Overhaul, Tauri Bridge, Migration Phases (4 phases, 6 weeks), Database Schema Changes, API Routes Changes, Risk Analysis, Success Criteria
- Post-check: 6/9 passed, 0 errors, 2 warnings (line spacing variation for code blocks is expected)

---
Task ID: 4A
Agent: Tauri Host Bridge
Task: Create `packages/host-tauri/` — Tauri Host Bridge package implementing the `OpenDesignHostBridge` interface via Tauri IPC

Work Log:
- Read existing `@open-design/host` package: `src/index.ts` (full `OpenDesignHostBridge` interface, 300+ types, validators, helper functions), `src/testing.ts` (mock host utilities), `package.json`, `tsconfig.json`
- Read Electron preload script (`apps/desktop/src/main/preload.cts`) to understand how the Electron bridge is injected via `contextBridge.exposeInMainWorld()`
- Noted that `packages/host/src/detection.ts` does not exist — detection logic is inline in the host `index.ts`
- Created `packages/host-tauri/` directory structure with 9 files total
- **package.json**: `@open-design/host-tauri` v0.1.0, ESM, peer deps on `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-shell`, `@open-design/host`
- **tsconfig.json**: Strict TS5 config with DOM libs, NodeNext module resolution, declaration output
- **src/types.ts**: Tauri-specific IPC types (`TauriProjectImportInit`, `TauriProjectImportResult`, `TauriReplaceWorkingDirResult`, `TauriCaptureOptions`, `TauriPdfPrintOptions`, `TauriBrowserClearDataOptions`, `TauriUpdaterStatusSnapshot`)
- **src/detection.ts**: `isTauriEnvironment()` (checks `__TAURI_INTERNALS__` in window), `detectTauriPlatform()` (user-agent based OS detection)
- **src/commands.ts**: All Tauri IPC command wrappers with lazy dynamic imports — `shellOpenExternal`, `shellOpenPath`, `clearBrowserData`, `captureScreenshot`, `pickAndImportProject`, `pickAndReplaceWorkingDir`, `printPdf`, `updaterCheck`, `updaterDownload`, `updaterInstall`, `updaterQuitAndInstall`
- **src/bridge.ts**: Full `OpenDesignHostBridge` implementation via `createTauriHostBridge()` — normalizes all Tauri IPC results into host-bridge contract shapes, includes updater state machine with subscriber notification, `pet.setVisible` as no-op
- **src/index.ts**: `installTauriHostBridge()` entry point — guards on `isTauriEnvironment()`, checks for existing bridge, installs on `globalThis.__od__` and `window.__od__`
- **rust-commands.md**: Complete documentation for 7 Rust `#[tauri::command]` functions (`import_project`, `replace_working_dir`, `open_in_editor`, `capture_screenshot`, `clear_browser_data`, `print_pdf`, `updater_quit_and_install`) with type definitions, behaviour descriptions, and registration/permissions guidance
- **README.md**: Package overview, usage, bridge method mapping table, detection examples, architecture diagram, development commands

Stage Summary:
- All 9 files created in `packages/host-tauri/`
- Bridge implements the full `OpenDesignHostBridge` interface from `@open-design/host` v2
- Every bridge method maps to the correct Tauri API per the specification table
- Lazy dynamic imports ensure the package can be loaded in non-Tauri environments without errors
- No issues encountered — all types align with the canonical host bridge definitions

---
Task ID: 1-C
Agent: Main
Task: Create Design Token Sync service at `apps/daemon/src/design-token-sync.ts`

Work Log:
- Read reference files: `design-token-contract.ts`, `derived-token-outputs.ts`, `token-schema.ts`, `skills.ts`, `project-watchers.ts`, `project-routes.ts`, `db.ts`, `projects.ts`, `design-systems.ts`, `frontmatter.ts`, `design-token-evidence.ts`, `design-token-contract-rebuild.ts`, `server-context.ts`
- Studied the existing TOKEN_SCHEMA binding algorithm (ROLE_HINTS, fallback chains, A1/A2/B-slot layers)
- Studied the `renderTailwindV4Css()` function from `@open-design/contracts/design-systems/derived-token-outputs`
- Studied the `resolveDesignSystemAssets()` function that reads tokens.css from both built-in and user-installed roots
- Studied the `resolveProjectDir()` function that handles both managed (.od/projects/) and folder-imported projects
- Studied the chokidar watcher pattern from `project-watchers.ts`
- Studied the route registration pattern from `project-routes.ts`

Created `apps/daemon/src/design-token-sync.ts` with:
1. **TokenSyncResult interface**: tokensPath, tailwindPath, tokensHash, wasUpdated, backupCreated
2. **syncDesignTokensToProject()**: Core sync function implementing the full 10-step flow
   - Reads project metadata from DB via `getProject()`
   - Resolves project directory (managed + folder-imported)
   - Reads design system assets via `resolveDesignSystemAssets()`
   - Falls back to deriving tokens.css from DESIGN.md using `buildDesignTokenContract()`
   - Renders tailwind-theme.css via `renderTailwindV4Css()`
   - SHA-256 hash-based change detection (skips write if unchanged)
   - Backup strategy (.bak files created only when content differs)
   - Writes `src/styles/tokens.css` and `src/styles/tailwind-theme.css`
   - Logs sync to `design_token_sync_log` table
3. **startDesignTokenWatcher()**: Chokidar-based watcher monitoring DESIGN.md, tokens.css, tailwind-v4.css, manifest.json changes with debounced sync
4. **handleSyncTokensRoute()**: Express route handler for `POST /api/projects/:id/sync-tokens`
5. **migrateDesignTokenSyncLog()**: Database migration creating the sync log table with project FK and index
6. **extractSourceTokensFromDesignMd()**: Extracts SourceDesignToken entries from DESIGN.md frontmatter (colors, typography, spacing) and body (CSS custom properties, Markdown table hex colors)

Modified `apps/daemon/src/db.ts`:
- Added import for `migrateDesignTokenSyncLog`
- Added `migrateDesignTokenSyncLog(db)` call in the migrate() function

Modified `apps/daemon/src/project-routes.ts`:
- Added import for `handleSyncTokensRoute`
- Added `app.post('/api/projects/:id/sync-tokens', handleSyncTokensRoute(ctx))` route

Stage Summary:
- Core design-token-sync.ts created with full sync flow, watcher, and API route handler
- Database migration for design_token_sync_log table integrated into db.ts
- API route registered in project-routes.ts
- No issues encountered — all patterns follow daemon conventions

---
Task ID: 2A
Agent: Skill Migration
Task: Phase 2-A — Migrate key existing skills from `<artifact>` output format to `<file-edit>` output format

Work Log:
- Surveyed all 155 SKILL.md files in `skills/` directory
- Extracted frontmatter for each skill: name, od.mode, od.scenario, od.category, od.outputFormat, has_artifact
- Categorized each skill into one of: migrated, legacy, deprecated
- Selected top 10 most relevant skills for migration (web-prototype style, component builders, React-relevant)
- Wrote and executed Python migration script to batch-process all categorizations
- Migrated 10 skills: frontend-design, frontend-dev, web-artifacts-builder, artifacts-builder, image-to-code-skill, shadcn-ui, gsap-react, login-flow, faq-page, emilkowalski-motion
  - Added `od.outputFormat: file-edit` to frontmatter
  - Replaced `<artifact>` tags with `<file-edit>` tags in body
  - Replaced "HTML artifact" → "React component file set" in descriptions
  - Updated output examples from single HTML artifact to React component + CSS module + types as separate `<file-edit>` blocks
  - Added `<!-- MIGRATED: output changed from <artifact> to <file-edit> -->` comment
  - Manual cleanup: updated login-flow workflow steps, faq-page output contract, emilkowalski-motion references
- Marked 20 legacy skills: 9 deck/presentation skills, 9 template skills, 2 other design-only skills
  - Added `od.outputFormat: artifact` and `od.mode: design` to frontmatter
  - Added `<!-- LEGACY: retained for design mode compatibility -->` comment
- Marked 2 deprecated skills: swiftui-design, flutter-animating-apps
  - Added `od.deprecated: true` and `od.deprecatedReason` to frontmatter
  - Added `<!-- DEPRECATED: not relevant for Tauri + React stack -->` comment
- Created comprehensive MIGRATION-REPORT.md with full details of all changes
- 123 skills remain uncategorized and need manual review in subsequent phases

Stage Summary:
- Total skills: 155
- Migrated: 10 (output changed from `<artifact>` to `<file-edit>`)
- Legacy: 20 (retained for design mode compatibility with `od.outputFormat: artifact`)
- Deprecated: 2 (not relevant for Tauri + React stack)
- Needs manual review: 123
- New frontmatter field introduced: `od.outputFormat` (values: `file-edit`, `artifact`, or absent)
- All YAML frontmatter remained valid after edits
- Migration report saved to `skills/MIGRATION-REPORT.md`

---
Task ID: 1a
Agent: file-edit-parser-builder
Task: Build <file-edit> streaming parser + tests

Work Log:
- Read existing artifact parser (`apps/web/src/artifacts/parser.ts`) to understand the generator pattern, buffer management, and partial-tag hold-back logic
- Read existing markdown-context module (`apps/web/src/artifacts/markdown-context.ts`) for fenced code block / inline code skip-range logic
- Read existing artifact parser tests (`apps/web/tests/artifacts/parser.test.ts`) for test patterns
- Reviewed tsconfig.json and vitest.config.ts to ensure compatibility (ES2022, ESM, vitest 4.x)
- Created `apps/web/src/parsers/file-edit-parser.ts` with:
  - `FileEdit` and `FileEditEvent` types matching the spec
  - `createFileEditParserWithFlush()` generator-based streaming parser (same pattern as artifact parser)
  - `createFileEditParser()` basic variant for simpler use cases
  - `flushFileEditParser()` utility to force-close open edits
  - `hasFileEditTags()` quick check for tag presence
  - `parseFileEditsComplete()` convenience wrapper for non-streaming use
  - Full markdown-context integration: skips `<file-edit>` tags inside fenced code blocks, inline backticks, double backticks
  - Partial-tag buffering: holds back when open tags arrive across chunk boundaries
  - Tail-line fence-opener hold-back (mirrors artifact parser's streaming caveats)
  - Prefix-shared identifier guard (`<file-editor>` is not treated as a real tag)
- Created `apps/web/tests/parsers/file-edit-parser.test.ts` with 32 tests covering:
  - Simple single file edit
  - Multiple file edits in one response
  - action="create" attribute
  - Default action="edit" when not specified
  - Non-"create" action attribute fallback
  - Mixed text and file edits
  - Chunk events during streaming
  - Empty content
  - Paths with spaces
  - Content with nested angle brackets
  - Fenced code block skipping
  - Inline backtick skipping
  - Double backtick skipping
  - Real tag parsing when prose contains non-fence triple-backtick
  - Prefix-shared identifier rejection (`<file-editor>`)
  - Tags arriving across multiple chunks
  - Fenced tags arriving across multiple chunks
  - Fence opener prefix hold-back
  - Stray backtick between paragraphs
  - Stray backticks across HR-shaped lines
  - flushFileEditParser utility
  - hasFileEditTags utility
  - parseFileEditsComplete utility (including unclosed tag force-completion)
  - Multiline content handling
- Verified: TypeScript compiles with zero new type errors, all 32 tests pass

Stage Summary:
- Created `apps/web/src/parsers/file-edit-parser.ts` (310 lines) — full streaming parser
- Created `apps/web/tests/parsers/file-edit-parser.test.ts` (260 lines) — 32 passing tests
- Parser is fully compatible with the SSE delta streaming used by the OD daemon
- Reuses the existing `markdown-context.ts` module for code-block skipping (no duplication)
- Zero type errors, 32/32 tests passing

---
Task ID: 1-D
Agent: Main
Task: Phase 1-D — Create App Developer skill and skill migration helpers

Work Log:
- Explored full skills/ directory (~155 SKILL.md files) and read 5 key skills for migration
- Read web-prototype SKILL.md (design-templates), frontend-dev SKILL.md, shadcn-ui SKILL.md, login-flow SKILL.md, live-dashboard SKILL.md
- Confirmed dashboard-builder does not exist; live-dashboard is the closest match
- Read existing reference files (login-flow/references/checklist.md)

Created App Developer skill:
- `skills/app-developer/SKILL.md` — Full skill definition with YAML frontmatter (od.mode: prototype, od.surface: web, od.scenario: engineering, od.category: app-development, od.taskKind: code-edit, od.outputFormat: file-edit, od.design_system.requires: true, od.craft.requires: [file-conventions, editing-rules])
- Body includes: read-before-edit rule, <file-edit> output format specification with 4 examples (basic, multiple files, new files, partial edits), style guidelines with design token reference table (var(--bg), var(--accent), etc.), CSS module and Tailwind+tokens examples, file preservation rules, workflow steps, anti-patterns
- `skills/app-developer/references/editing-rules.md` — Conventions for editing React/Tauri source files (general rules, React component rules with file structure template, naming conventions, export rules, props/state rules, CSS module rules, Tauri integration rules with Rust command + TypeScript binding patterns, import order, testing conventions)
- `skills/app-developer/references/file-conventions.md` — Standard folder structure (src/app/, src/components/, src/hooks/, src/lib/, src/types/, src-tauri/src/), naming conventions table, file sizing guidelines, import path aliases table, new file checklist

Created 3 additional dev skills:
- `skills/component-builder/SKILL.md` — For building new React components; output: <file-edit> for component file + optional CSS module + optional types file; includes component anatomy, folder placement guide, style rules
- `skills/page-creator/SKILL.md` — For creating new pages/routes; output: <file-edit> for page component + route registration; includes page anatomy, folder structure, page composition pattern
- `skills/tauri-bridge/SKILL.md` — For implementing Tauri IPC commands and frontend bindings; output: <file-edit> for Rust command + TypeScript binding; includes Rust command rules, TypeScript binding rules, error handling pattern

Migrated 5 existing skills from <artifact> to <file-edit>:
1. `design-templates/web-prototype/SKILL.md` — Added od.outputFormat: file-edit; changed Step 5 and Output contract from <artifact> to <file-edit>; added note about splitting into React component + CSS module
2. `skills/frontend-dev/SKILL.md` — Added od.outputFormat: file-edit; added output format section with <file-edit> examples
3. `skills/shadcn-ui/SKILL.md` — Added od.outputFormat: file-edit; added output format section with shadcn component <file-edit> example
4. `skills/login-flow/SKILL.md` — Added od.outputFormat: file-edit; changed workflow step 4 and Output section from <artifact> to <file-edit> with component + CSS module split
5. `design-templates/live-dashboard/SKILL.md` — Added od.outputFormat: file-edit; changed Output contract section from implicit to explicit <file-edit> tags for index.html and connectors.json

All 5 migrated skills have:
- `od.outputFormat: file-edit` added to YAML frontmatter
- `<!-- MIGRATED: output changed from <artifact> to <file-edit> -->` comment at top of body
- Output sections updated from <artifact> to <file-edit> format
- Original skill body content otherwise preserved intact

Created migration helper script:
- `scripts/migrate-skill.sh` — Bash script that automates the common parts of skill migration
  - Reads a SKILL.md file
  - Adds `outputFormat: file-edit` to od: frontmatter block (if not present)
  - Replaces `<artifact` with `<file-edit` in body
  - Replaces `</artifact>` with `</file-edit>` in body
  - Adds migration comment after frontmatter closing ---
  - Creates .bak backup
  - Supports --dry-run and --no-backup flags
  - Detects already-migrated files and skips them
- Tested with --dry-run on frontend-dev SKILL.md — correctly identifies as already migrated

Stage Summary:
- 4 new skills created: app-developer, component-builder, page-creator, tauri-bridge
- 5 existing skills migrated: web-prototype, frontend-dev, shadcn-ui, login-flow, live-dashboard
- 2 reference files created: editing-rules.md, file-conventions.md
- 1 migration script created: migrate-skill.sh
- Total files created/modified: 11
- No issues encountered

---
Task ID: 1-B
Agent: Main
Task: Create the App Developer system prompt composer that replaces the old design-centric prompt

Work Log:
- Read existing `apps/daemon/src/prompts/system.ts` (765+ lines) to understand the old 27-layer prompt structure: injection resistance, discovery/philosophy layer, identity charter, design system sections, skill/craft/plugin blocks, deck framework, media contract, metadata rendering, panel prompts, critique addenda
- Read `apps/daemon/src/design-token-contract.ts` to understand the token rendering logic (buildDesignTokenContract, renderDesignTokenContractCss, validation, ROLE_HINTS)
- Studied the daemon's tsconfig.json: ES2022, NodeNext module resolution, strict, exactOptionalPropertyTypes, ESM
- Studied the daemon's package.json: @open-design/contracts, express, chokidar dependencies

Created 3 new files:

1. **`apps/daemon/src/prompts/app-developer-system.ts`** (463 lines)
   - `AppDeveloperPromptInput` interface with 11 fields: projectName, techStack, baseDir, fileMap, tokensCss, designMd, skillBody?, memory?, customInstructions?, vitePort?, projectType?
   - `composeAppDeveloperPrompt(input)` — main prompt composer producing 10 ordered sections:
     1. Identity (expert React + TypeScript + Tauri developer, NOT designer)
     2. Critical Rules (9 rules: read-before-edit, file-edit format, design tokens, preserve structure, HMR, no standalone artifacts, respect tech stack, type safety, import paths)
     3. Output Format (`<file-edit path="...">` specification with 3 detailed examples: React component, CSS file, new file creation)
     4. Project Context (name, tech stack, working dir, project type, vite port)
     5. File Map (project file tree for AI navigation)
     6. Design System Tokens (tokens.css as real CSS code block)
     7. Design System Documentation (DESIGN.md body)
     8. Active Task Instructions (SKILL.md body)
     9. Custom Instructions (user/project-level)
     10. Memory (personal context from past chats)
   - `composeAppDeveloperPromptAuto(input)` — convenience wrapper that auto-detects project type and file map
   - Prompt injection resistance section (carried over from old prompt)
   - Re-exports `generateProjectFileMap` and `detectProjectType` for convenience
   - Key differences from old prompt: NO discovery/philosophy, NO identity charter as designer, NO artifact instructions, NO deck framework, NO media contract; YES file-edit format, YES design tokens as CSS, YES file map, YES tech stack conventions

2. **`apps/daemon/src/prompts/file-map-generator.ts`** (161 lines)
   - `generateProjectFileMap(baseDir, maxDepth=4)` — async function that walks project directory tree
   - Skips: node_modules, .git, dist, .next, target, .od, .open-design, coverage, etc. (14 directories)
   - Skips binary files: images, fonts, audio/video, archives, compiled files, lockfiles, SQLite (40+ extensions)
   - Skips lockfiles by name: package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb, etc.
   - Produces compact tree with Unicode box-drawing connectors (├──, └──, │)
   - Directories marked with trailing `/`
   - Sorted: directories first, then files, alphabetical within each group
   - Graceful error handling (permission denied, missing directory, non-directory paths)

3. **`apps/daemon/src/prompts/project-type-detector.ts`** (310 lines)
   - `ProjectTypeDetection` interface: type, techStack, vitePort?
   - `detectProjectType(baseDir)` — async detection function with priority chain:
     1. `src-tauri/tauri.conf.json` → tauri-react
     2. `next.config.{ts,mts,js,mjs}` → nextjs
     3. `vite.config.{ts,mts,js,mjs}` + package.json deps → vite-react or vite-vue
     4. Fallback → unknown
   - Auto-detects Vite port from: tauri.conf.json devUrl, vite.config.* `port:` field, package.json scripts `--port` flag
   - `buildTechStack()` — generates human-readable stack string (e.g., "React 19 + TypeScript + Tauri + Tailwind CSS v4 + Vite")
   - `detectFrameworkFromPkg()` — reads package.json dependencies to determine React vs Vue vs unknown
   - Handles exactOptionalPropertyTypes by declaring `vitePort?: number | undefined`

Fixed TypeScript issues:
- Escaped backticks inside template literals (`.tsx`, `.ts`, `.css` etc. on line 162)
- Fixed exactOptionalPropertyTypes violation in composeAppDeveloperPromptAuto by conditionally building the composed input object with spread syntax for optional properties
- Fixed ProjectTypeDetection.vitePort type to include `| undefined`
- Verified zero type errors in all 3 new files

Stage Summary:
- 3 new files created in `apps/daemon/src/prompts/`
- All files pass TypeScript strict mode with exactOptionalPropertyTypes
- No external dependencies added
- No modifications to existing files
- All patterns follow daemon codebase conventions (ESM imports with .js extensions, async functions, consistent error handling)

---
Task ID: 1-E
Agent: Main
Task: Phase 1-E — Create the file edit → disk write pipeline and new API routes

Work Log:
- Read reference files: `project-routes.ts` (RouteDeps pattern, Express route registration), `chat-routes.ts` (streaming handler patterns), `server.ts` (route registration, httpDeps structure), `server-context.ts` (RouteDeps type), `db.ts` (migration pattern, SQLite CRUD patterns), `design-token-sync.ts` (existing design_token_sync_log table — avoids schema conflict)
- Studied the existing `projects.ts` module (projectDir, resolveProjectDir, isSafeId functions)
- Studied `http/response.ts` (sendApiError signature) and the server.ts local `sendApiError` 4-arg signature

Created 6 new files:

1. **`apps/daemon/src/file-path-validator.ts`** (107 lines)
   - `validateFilePath(editPath, projectBaseDir)` function
   - Rejects absolute paths, path traversal (..), drive letters
   - Validates path resolves within project base directory
   - Blocks `.git/`, `node_modules/`, `.env` files
   - Allowed extensions: `.tsx`, `.ts`, `.jsx`, `.js`, `.css`, `.scss`, `.html`, `.json`, `.md`, `.yaml`, `.yml`, `.toml`, `.rs`
   - Blocks binary extensions: `.exe`, `.dll`, `.so`, `.dylib`, `.wasm`
   - Returns `PathValidationResult` with valid/reason/resolvedPath/relativePath

2. **`apps/daemon/src/file-edit-pipeline.ts`** (235 lines)
   - `FileEdit` interface (filePath, content, search?, replace?, conversationId?, messageId?)
   - `FileEditWriteResult` interface (path, action, previousHash?, newHash, bytesWritten)
   - `FileEditPipelineOptions` interface (validatePaths?, validateSyntax?, createBackup?, dryRun?)
   - `writeFileEditToProject(projectId, edit, options)` — main write function with:
     - Path validation via `validateFilePath()`
     - Read-before-write for diff/hash tracking
     - SHA-256 hash of content before and after write
     - Identical content skip (returns 'skipped' action)
     - Dry-run mode (validate without writing)
     - `.bak` backup creation (non-fatal on failure)
     - Atomic write via `.tmp` file + `fs.rename()`
     - Search/replace patch mode (finds first occurrence)
   - `writeFileEditsBatch(projectId, edits, options)` — sequential batch processor

3. **`apps/daemon/src/file-edit-persistence.ts`** (143 lines)
   - `migrateFileEditHistory(db)` — creates `file_edit_history` table + adds `project_type`, `tech_stack`, `vite_port` columns to projects
   - Note: does NOT recreate `design_token_sync_log` (already exists from design-token-sync.ts) — avoids schema conflict
   - `insertFileEditHistory(db, input)` — insert a history record
   - `listFileEditHistory(db, projectId, opts)` — list history with optional filePath filter and limit
   - `updateProjectType()`, `updateProjectTechStack()`, `updateProjectVitePort()` — update new project columns

4. **`apps/daemon/src/file-edit-routes.ts`** (327 lines)
   - `registerFileEditRoutes(app, ctx)` — registers 6 new API routes:
     - `POST /api/projects/:id/file-edits` — Write one or more file edits to project, with pipeline options, logs to file_edit_history
     - `GET /api/projects/:id/file-edits` — List file edit history with optional filePath and limit query params
     - `POST /api/projects/:id/validate-edit` — Validate a file edit without writing (returns PathValidationResult)
     - `GET /api/projects/:id/file-map` — Generate project file map (walks directory, skips .dotfiles, node_modules)
     - `POST /api/projects/:id/detect-type` — Auto-detect project type (nextjs, vite-react, astro, etc.) + tech stack, persists to DB
     - `POST /api/projects/:id/detect-vite-port` — Detect Vite dev server port from config files, persists to DB
   - Uses `RouteDeps<'db' | 'http' | 'paths' | 'projectFiles'>` pattern
   - Follows existing route patterns (isSafeId validation, sendApiError, resolveProjectDir)

5. **`apps/daemon/src/chat-file-edit-handler.ts`** (311 lines)
   - `ChatFileEditHandler` class — hooks into chat streaming pipeline
   - `processDelta(delta)` — feeds stream delta, parses `<file-edit>` blocks incrementally, writes completed blocks to disk
   - `flush()` — processes any buffered/partial blocks at end of stream
   - `getCompletedEdits()` — returns all completed FileEdit objects
   - State machine: TEXT → TAG_OPEN → CONTENT → TEXT
   - Parses `<file-edit path="...">` and `<file-edit path="..." search="..." replace="...">`
   - XML entity unescaping for attribute values
   - Logs each edit to file_edit_history via insertFileEditHistory()
   - Best-effort flush for unclosed tags at stream end

6. **`apps/daemon/src/migrations/007-file-edit-history.sql`** (canonical SQL reference for the migration)

Modified 2 existing files:

- **`apps/daemon/src/db.ts`**: Added import for `migrateFileEditHistory` and call in `migrate()` function
- **`apps/daemon/src/server.ts`**: Added import for `registerFileEditRoutes` and route registration with db/http/paths/projectFiles deps

Stage Summary:
- 6 new files created, 2 existing files modified
- Full file edit write pipeline: path validation → read-before-write → hash tracking → atomic write → history logging
- 6 new API routes following existing daemon patterns
- ChatFileEditHandler for streaming <file-edit> block detection and processing
- Database migration adds file_edit_history table + 3 new columns to projects
- No schema conflicts with existing design_token_sync_log table
- All patterns consistent with daemon codebase conventions
