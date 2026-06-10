# Open Design — App Developer Migration Plan

**From Design/Mockup Tool to Real App Development Software**

Full Migration — Not a Mode Addition

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Target** | smart-tax-assistance/app (Tauri + React + Vite) |
| **Approach** | Evolution, not revolution |

> *Catatan: Recovery dari migrasi ini tidak memerlukan prosedur khusus — cukup clone ulang dari upstream `nexu-io/open-design`. Semua project files user tetap aman di disk karena arsitektur local-first.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Validasi Hipotesis User](#2-validasi-hipotesis-user)
3. [Arsitektur Baru: App Developer](#3-arsitektur-baru-app-developer)
4. [Implementasi Detail: `<file-edit>` Parser](#4-implementasi-detail-file-edit-parser)
5. [App Developer System Prompt](#5-app-developer-system-prompt)
6. [Design Token Sync Service](#6-design-token-sync-service)
7. [Vite HMR Preview Integration](#7-vite-hmr-preview-integration)
8. [Skill System Migration](#8-skill-system-migration)
9. [Tauri Host Bridge](#9-tauri-host-bridge)
10. [Migration Phases](#10-migration-phases)
11. [Database Schema Changes](#11-database-schema-changes)
12. [API Routes Changes](#12-api-routes-changes)
13. [Risk Analysis](#13-risk-analysis)
14. [Success Criteria](#14-success-criteria)

---

## 1. Executive Summary

Dokumen ini adalah rencana migrasi komprehensif untuk mengubah Open Design dari sebuah design/mockup tool menjadi app development software yang sesungguhnya. Ini bukan penambahan mode baru — ini adalah migrasi total yang mengubah seluruh pipeline output dari artifact generation menjadi source code editing, sambil mempertahankan semua keunggulan yang sudah dimiliki Open Design.

Migrasi ini mencakup 3 area utama: (1) **Daemon backend** — mengubah cara AI menghasilkan output dari artifact menjadi file edits, (2) **Web frontend** — mengganti preview iframe/srcdoc dengan code editor dan Vite HMR integration, dan (3) **Skills dan System Prompt** — memigrasikan ~259 skill yang ada dari output `<artifact>` menjadi output `<file-edit>`, dan mengubah instruksi AI dari "generate HTML artifact" menjadi "edit source code in-place".

> **Key Insight:** Open Design saat ini generate standalone HTML artifacts di sandbox-nya sendiri (`.od/projects/`). Kita mau AI-nya edit file `.tsx`/`.ts`/`.css` langsung di project user, dan setiap perubahan langsung terlihat via Vite HMR di Tauri app.

> *Recovery note: Migrasi dilakukan di fork terpisah. Rollback = clone fresh dari upstream `nexu-io/open-design`. Tidak ada data user yang hilang karena project files selalu di disk user (local-first architecture).*

---

## 2. Validasi Hipotesis User

User bertanya: *"Apakah hipotesis saya benar bahwa Open Design selalu pakai design baru dan tidak bisa plug and play?"* Setelah analisis mendalam terhadap seluruh codebase, jawabannya adalah: **SETENGAH BENAR**.

### 2.1 Hipotesis yang Benar

Open Design secara default memang **SELALU** membuat project baru di `.od/projects/<id>/` directory. Artifact-artifact dihasilkan di sandbox-nya sendiri, bukan di kodebase user. AI di-instruct untuk menghasilkan single-page artifact HTML, bukan React component atau TypeScript file yang bisa di-import. Preview menggunakan `iframe srcdoc` yang sandboxed, tanpa Vite dev server dan tanpa HMR. Design system tokens cuma di-inject ke system prompt sebagai teks dan di-paste ke dalam artifact HTML, bukan di-write ke file CSS di project user.

### 2.2 Jalan Masuk yang Sudah Ada

Open Design punya fitur **`pickAndImport`** yang memungkinkan user memilih folder yang sudah ada. Ketika user pick folder, OD **TIDAK** copy file, tapi **reference in-place**. Agent CWD (current working directory) jadi pointing ke folder yang user pilih, dan semua file write langsung ke folder tersebut. Ini sudah sangat dekat dengan apa yang kita mau, tapi ada 3 masalah fundamental yang harus dipecahkan.

### 2.3 Tiga Masalah Fundamental

#### Masalah 1: Output Format — Artifacts, Bukan Source Code

Skill OD selalu menginstruksikan AI untuk generate `<artifact type="text/html">` — standalone HTML. Bukan React component file, bukan TypeScript, bukan Tailwind CSS yang bisa di-import. AI-nya di-instruct untuk bikin "single-page artifact", bukan "edit file X di `src/components/`". Ini adalah konsekuensi langsung dari SKILL.md yang mendefinisikan output format sebagai artifact, dan system prompt composition yang membangun prompt berdasarkan skill aktif.

#### Masalah 2: Preview — srcdoc Iframe, Bukan Vite HMR

Preview OD menggunakan `iframe srcdoc` yang sandboxed. Tidak ada Vite dev server, tidak ada HMR. Jika AI edit file `.tsx` di folder user, OD tidak bisa mereload Tauri app user — dia cuma bisa reload iframe-nya sendiri. Seluruh pipeline dari `buildSrcdoc()`, `injectSandboxShim()`, `injectSelectionBridge()`, `injectSnapshotBridge()`, dan `IframeKeepAlivePool` harus diganti dengan mekanisme yang mengarah ke Vite dev server yang sudah berjalan.

#### Masalah 3: Design System — Hanya di Prompt, Bukan di File

`DESIGN.md` itu cuma di-inject ke system prompt AI sebagai teks. `tokens.css` di-generate tapi di-paste ke dalam artifact HTML, bukan di-write ke `src/styles/tokens.css` di project user. Artinya design system yang sudah didefinisikan tidak accessible sebagai CSS custom properties yang bisa dipakai oleh React components. Ini harus diubah supaya `tokens.css` dan `tailwind-theme.css` otomatis di-write ke project user setiap kali design system berubah.

### 2.4 Kelebihan Open Design yang Harus Dipertahankan

Migrasi ini adalah **evolusi**, bukan revolusi. Open Design tidak kehilangan identitasnya sebagai design platform — ia memperluas kapabilitasnya agar bisa bekerja langsung di source code project yang nyata. Semua yang membuat Open Design unggul tetap ada; yang berubah hanya pipeline output-nya.

| Keunggulan | Deskripsi | Status Setelah Migrasi |
|---|---|---|
| **Local-first & BYOK** | Semua data di disk user, tidak ada vendor lock-in. User bawa API key sendiri (Claude, OpenAI, Gemini, dll) | ✅ Dipertahankan penuh |
| **Multi-agent CLI support** | Auto-detect 12+ CLI agents di PATH: Claude Code, Codex, Cursor, Gemini CLI, Copilot, Devin, OpenCode, Qwen, Hermes, Kimi, Pi, Kiro | ✅ Dipertahankan penuh |
| **259+ Composable Skills** | Library skill yang kaya: web prototype, deck, editorial, dashboard, dll | ✅ Dimigrasikan, tidak dihapus |
| **142+ Brand-grade Design Systems** | Stripe, Apple, Linear, Vercel, dan 138+ lainnya — color palette, typography, spacing sudah siap pakai | ✅ Dipertahankan penuh, malah diperkuat via Token Sync |
| **Sandboxed preview (iframe)** | Preview aman untuk artifact HTML | ⚠️ Diganti Vite HMR untuk app-developer mode, tapi tetap ada untuk legacy/design skills |
| **Multi-format export** | HTML, PDF, PPTX, MP4, ZIP | ⚠️ PDF via Tauri print API, yang lain dikaji ulang |
| **Open source (Apache-2.0)** | Bebas self-host, modifikasi, distribute | ✅ Dipertahankan |
| **Tauri native desktop** | Performa native, akses filesystem langsung | ✅ Diperkuat di migrasi ini |
| **Skill-driven workflow** | AI diarahkan oleh skill spesifik, bukan prompt bebas | ✅ Dipertahankan dan diperluas ke dev skills |
| **Design System → tokens.css** | `DESIGN.md` otomatis jadi CSS custom properties | ✅ Diperkuat — sekarang di-write ke project files |

---

## 3. Arsitektur Baru: App Developer

Arsitektur baru menghapus seluruh konsep "mode" — tidak ada lagi "Design Mode" vs "Dev Mode". Seluruh tool adalah app development software. Setiap project yang di-import langsung bekerja sebagai app developer workspace di mana AI bisa edit source code, dan perubahan langsung terlihat di Tauri app via Vite HMR.

### 3.1 Arsitektur Overview

```
smart-tax-assistance/app/          ← WORKING DIRECTORY (bukan .od!)
├── src/
│   ├── components/         ← AI edit files HERE
│   ├── styles/
│   │   └── tokens.css      ← Auto-generated dari DESIGN.md
│   │   └── tailwind-theme.css ← Auto-generated
│   └── App.tsx
├── src-tauri/              ← Tauri backend
└── .open-design/
    ├── project.json        ← Project manifest
    └── DESIGN.md           ← Active design system

Tauri App (Vite Dev Server)
→ http://localhost:{vitePort}   ← HOT RELOAD! (auto-detected)
→ AI edit .tsx → Vite HMR → instant preview

Open Design Daemon (sidecar)
→ /api/runs  → spawn agent di CWD=smart-tax-assistance/app
→ /api/design-systems → inject DESIGN.md + tokens.css
→ File watcher → detect changes → notify frontend
```

### 3.2 Komponen yang Dihapus

Berikut adalah komponen yang dihapus secara permanen dari codebase Open Design. Penghapusan ini bersifat total dan tidak ada backward compatibility.

| Komponen | Lokasi | Alasan Penghapusan |
|---|---|---|
| Artifact parser (`<artifact>`) | `apps/web/src/artifacts/parser.ts` | Diganti dengan `<file-edit>` parser |
| Artifact manifest system | `apps/web/src/artifacts/manifest.ts` | Tidak ada lagi artifact files |
| Artifact renderer registry | `apps/web/src/artifacts/renderer-registry.ts` | Diganti code viewer/editor |
| srcdoc builder + all bridges | `apps/web/src/runtime/srcdoc.ts` | Diganti Vite HMR preview |
| IframeKeepAlivePool | `apps/web/src/components/IframeKeepAlivePool.tsx` | Tidak ada lagi iframe preview |
| HtmlViewer / DeckHtmlViewer | `apps/web/src/components/FileViewer.tsx` | Diganti CodeViewer |
| ReactComponentViewer | `apps/web/src/runtime/react-component.ts` | Diganti live app preview |
| Critique Theater | `apps/daemon` + `apps/web` | Tidak ada artifact untuk dikritik |
| Live Artifacts system | `apps/daemon` + `apps/web` + `packages/contracts` | Diganti real source files |
| Design Handoff (React/Vue/Next export) | `apps/daemon` + `apps/web` | Sudah di project React, tidak perlu export |
| Design Templates gallery | `apps/web` + `apps/daemon/design-templates/` | Diganti project templates |
| Artifact save/lint API | `apps/daemon/src/project-routes.ts` | Diganti file write API |
| Deck system + DeckBridge | `apps/web` + `apps/daemon` | Bukan presentation tool lagi |
| Manual Edit Bridge | `apps/web/src/edit-mode/` | Diganti direct file editing |
| Sketch Editor | `apps/web/src/components/SketchEditor.tsx` | Bukan drawing tool lagi |
| Palette Bridge (re-skin) | `apps/web/src/runtime/srcdoc.ts` | Design system di `tokens.css` |
| Snapshot Bridge (capture) | `apps/web/src/runtime/srcdoc.ts` | Tauri capture API |
| PDF export via iframe | `apps/daemon` + `apps/web` | Tauri print API |

> **Note:** Skills **TIDAK** dihapus — mereka dimigrasikan ke format `<file-edit>`. Lihat [Section 8: Skill System Migration](#8-skill-system-migration) untuk detail.

### 3.3 Komponen yang Dibangun Baru

| Komponen | Lokasi | Fungsi |
|---|---|---|
| `<file-edit>` parser | `apps/web/src/parsers/file-edit-parser.ts` | Parse AI output jadi file writes |
| App Developer system prompt | `apps/daemon/src/prompts/app-developer-system.ts` | Compose prompt untuk code editing |
| Design token sync service | `apps/daemon/src/design-token-sync.ts` | `DESIGN.md` → `tokens.css` → project files |
| Vite HMR integration | `apps/web/src/providers/vite-preview.ts` | Connect ke Vite dev server untuk preview |
| CodeViewer component | `apps/web/src/components/CodeViewer.tsx` | Syntax-highlighted code view |
| FileTree component | `apps/web/src/components/FileTree.tsx` | Real project file browser |
| TerminalPanel component | `apps/web/src/components/TerminalPanel.tsx` | Embedded terminal (upgrade dari yang sudah ada) |
| App Developer skill | `skills/app-developer/SKILL.md` | Skill definition untuk code editing |
| Tauri Host Bridge | `packages/host-tauri/` | Native dialog, shell, capture untuk Tauri |
| File change notifier | `apps/daemon/src/file-change-notifier.ts` | Notify frontend saat files berubah |

### 3.4 Komponen yang Dimodifikasi

| Komponen | Perubahan | Detail |
|---|---|---|
| `composeSystemPrompt()` | Replace artifact-centric prompt dengan code-editing prompt | Hapus discovery/philosophy layer, ganti identity charter, inject file map + design tokens sebagai CSS |
| Project creation flow | Remove skill+design-system selection, auto-detect project type | `pickAndImport` jadi satu-satunya cara buat project |
| Chat streaming handler | Parse `<file-edit>` selain `<artifact>` | File edits → write to disk → HMR reload |
| FileWorkspace | Replace artifact tabs dengan code editor tabs | FileTree + CodeViewer jadi primary workspace |
| ChatPane | Show file edit diffs, bukan artifact preview | Inline diff view setiap file yang di-edit |
| Daemon project routes | Remove artifact-specific endpoints | Simplify ke file CRUD + chat + runs |
| `DESIGN.md` integration | Auto-sync tokens ke project files | Bukan hanya inject ke prompt, tapi write ke disk |
| Skill system | Migrasi ~259 skills ke format `<file-edit>` | Skill yang relevan di-update, yang design-only jadi legacy |
| `ProjectKind` type | Replace prototype/deck/template, add app-developer types | `tauri-react`, `nextjs`, `vite-react`, etc. |
| Host Bridge | Add Tauri bridge selain Electron | `window.__od__` untuk Tauri WebView |

---

## 4. Implementasi Detail: `<file-edit>` Parser

Komponen paling kritis dari migrasi ini adalah `<file-edit>` parser yang menggantikan `<artifact>` parser. Ini adalah titik di mana output AI ditransformasikan dari standalone HTML menjadi file writes di project user. Parser harus **streaming-compatible** (bisa parse incrementally saat AI masih generating), **error-tolerant** (gracefully handle malformed XML), dan **real-time** (setiap file edit di-write ke disk sesegera mungkin supaya Vite HMR bisa trigger reload).

### 4.1 Spesifikasi Format

AI menghasilkan output dalam format `<file-edit>` yang mirip dengan `<artifact>` tapi dengan semantic yang berbeda. Setiap `<file-edit>` block berisi path relatif ke file yang harus di-write dan content lengkap file tersebut. Parser harus mendukung multiple file edits dalam satu response, dan setiap edit harus di-write secara independen.

```xml
<!-- AI output format -->
<file-edit path="src/components/LoginPage.tsx">
import '../styles/tokens.css';

export function LoginPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <h1 style={{ color: 'var(--fg)' }}>Login</h1>
    </div>
  );
}
</file-edit>

<file-edit path="src/styles/tokens.css">
/* OD TOKEN_SCHEMA - auto-generated */
:root {
  --bg: #0a0a0f;
  --fg: #e8e8ed;
  --accent: #37dcf2;
}
</file-edit>
```

### 4.2 Streaming Parser Implementation

Parser harus bekerja secara streaming untuk memberikan feedback secepat mungkin. Saat AI masih menulis content untuk satu file, parser sudah bisa mulai menampilkan progress di UI. Begitu closing tag terdeteksi, file langsung di-write ke disk dan Vite HMR akan trigger reload. Ini memberikan pengalaman real-time yang jauh lebih baik dibanding menunggu seluruh response selesai.

```typescript
export interface FileEdit {
  path: string;       // relative to project root
  content: string;    // full file content
  status: 'streaming' | 'complete';
}

export interface FileEditEvent {
  type: 'text' | 'file-edit:start' | 'file-edit:chunk' | 'file-edit:complete';
  path?: string;
  delta?: string;
  edit?: FileEdit;
}

export function* createFileEditParser(): Generator<FileEditEvent, void, string> {
  let buffer = '';
  let currentPath: string | null = null;
  let currentContent = '';

  while (true) {
    const delta: string = yield;
    buffer += delta;

    // Check for <file-edit path="..."> opening tag
    if (!currentPath) {
      const openMatch = buffer.match(/<file-edit\s+path="([^"]+)">\n?/);
      if (openMatch) {
        currentPath = openMatch[1];
        currentContent = '';
        buffer = buffer.slice(openMatch.index! + openMatch[0].length);
        yield { type: 'file-edit:start', path: currentPath };
      }
    }

    // Check for </file-edit> closing tag
    if (currentPath) {
      const closeIdx = buffer.indexOf('</file-edit>');
      if (closeIdx !== -1) {
        currentContent += buffer.slice(0, closeIdx);
        buffer = buffer.slice(closeIdx + '</file-edit>'.length);
        yield {
          type: 'file-edit:complete',
          edit: { path: currentPath, content: currentContent, status: 'complete' }
        };
        currentPath = null;
        currentContent = '';
      } else {
        // Still streaming content
        currentContent += buffer;
        buffer = '';
        yield { type: 'file-edit:chunk', path: currentPath, delta };
      }
    }

    // Yield plain text outside file edits
    if (!currentPath && buffer.length > 0) {
      const nextOpen = buffer.indexOf('<file-edit');
      if (nextOpen === -1) {
        yield { type: 'text', delta: buffer };
        buffer = '';
      } else if (nextOpen > 0) {
        yield { type: 'text', delta: buffer.slice(0, nextOpen) };
        buffer = buffer.slice(nextOpen);
      }
    }
  }
}
```

### 4.3 File Edit → Disk Write Pipeline

Setiap `file-edit:complete` event harus segera ditulis ke disk. Pipeline ini memastikan bahwa file write terjadi secara atomic dan aman:

```typescript
// apps/web/src/pipelines/file-edit-writer.ts
export async function handleFileEditComplete(
  edit: FileEdit,
  projectId: string
): Promise<void> {
  // 1. Validate path — no path traversal attacks
  if (edit.path.startsWith('..') || path.isAbsolute(edit.path)) {
    throw new Error(`Invalid file path: ${edit.path}`);
  }

  // 2. Syntax validation (optional, for .tsx/.ts files)
  if (edit.path.endsWith('.tsx') || edit.path.endsWith('.ts')) {
    const diagnostics = await validateTypeScript(edit.content);
    if (diagnostics.hasErrors()) {
      // Log warning but still write — user can fix in editor
      console.warn(`TypeScript errors in ${edit.path}:`, diagnostics.errors);
    }
  }

  // 3. Write to project via daemon API
  await writeProjectTextFile(projectId, edit.path, edit.content);

  // 4. Vite HMR auto-detects filesystem change
  // No manual notification needed — Vite watches via chokidar
}
```

---

## 5. App Developer System Prompt

System prompt adalah jantung dari perubahan ini. Di Open Design lama, `composeSystemPrompt()` membangun prompt berlapis-lapis yang menginstruksikan AI sebagai "expert designer" yang menghasilkan HTML artifacts. Di versi baru, AI adalah "expert developer" yang edit source code in-place. Seluruh identity charter, discovery layer, philosophy layer, dan artifact-specific instructions harus diganti.

### 5.1 Prompt Composition Flow (Baru)

Prompt composition yang baru jauh lebih sederhana dan langsung. Alih-alih 27 lapisan prompt yang berorientasi design, kita punya prompt yang fokus pada code editing dengan design system awareness. Urutan injection adalah:

1. **Identity** — you are a developer, not a designer
2. **Project context** — file map, tech stack, conventions
3. **Design system** — `DESIGN.md` body + `tokens.css` as real CSS
4. **Active skill** — task-specific instructions
5. **Memory** — personal context from past chats

```typescript
export function composeAppDeveloperPrompt(input: AppDeveloperPromptInput): string {
  const parts: string[] = [];

  // 1. Identity — you're a developer, not a designer
  parts.push(`You are an expert React + TypeScript + Tauri developer working
inside an EXISTING codebase. You EDIT source files in-place.
You do NOT generate standalone HTML artifacts.

CRITICAL RULES:
1. Always read existing files before editing them
2. Use <file-edit path="..."> blocks for every file change
3. Follow the design system tokens (var(--bg), var(--accent), etc.)
4. Preserve the existing file structure — don't create new files
   unless explicitly asked
5. Every edit will trigger Vite HMR — the user sees changes
   instantly in their running app`);

  // 2. Project context — file map + tech stack
  parts.push(`## Project: ${input.projectName}
Tech Stack: ${input.techStack}
Working Directory: ${input.baseDir}

### File Map
${input.fileMap}

### Conventions
- React 19 + TypeScript strict mode
- Tailwind CSS v4 with design tokens as CSS custom properties
- Tauri for desktop (src-tauri/)
- File edits only — no artifacts, no standalone HTML`);

  // 3. Design system — REAL CSS, not just prompt text
  parts.push(`## Design System Tokens

\`\`\`css
${input.tokensCss}
\`\`\`

### Design System Documentation
${input.designMd}`);

  // 4. Active skill instructions
  if (input.skillBody) {
    parts.push(`## Active Task Instructions
${input.skillBody}`);
  }

  // 5. Memory — personal context
  if (input.memory) {
    parts.push(`## Context from Previous Conversations
${input.memory}`);
  }

  return parts.join('\n\n');
}
```

### 5.2 Perbandingan Prompt Lama vs Baru

| Aspek | Prompt Lama (Design Mode) | Prompt Baru (App Developer) |
|---|---|---|
| Identity | "You are an expert designer" | "You are an expert developer" |
| Output format | `<artifact type="text/html">` | `<file-edit path="...">` |
| Design tokens | Inject as text in prompt | Inject as CSS + write to project files |
| File context | Pull-layer file index (optional) | Full file map always included |
| Discovery questions | Mandatory multi-round discovery | Read existing code first, ask minimal questions |
| Critique | Multi-round Critique Theater | Build + test verification only |
| Preview | srcdoc iframe | Vite HMR in running app |
| Skill body | Design-focused SKILL.md | Code-editing focused SKILL.md |
| Project kind | prototype/deck/template/image | tauri-react/nextjs/vite-react |

---

## 6. Design Token Sync Service

Design Token Sync adalah service baru yang menjembatani antara `DESIGN.md` (design system definition) dan project files. Di sistem lama, `tokens.css` hanya di-paste ke dalam artifact HTML. Di sistem baru, `tokens.css` dan `tailwind-theme.css` di-write ke project files secara otomatis, sehingga bisa di-import oleh React components. Service ini berjalan setiap kali design system berubah, dan hasilnya langsung terlihat di app via Vite HMR.

### 6.1 Sync Flow

```
DESIGN.md changes
    →
design-token-sync.ts
    → parse DESIGN.md frontmatter + body
    → extract color palette, typography, spacing
    → bind to TOKEN_SCHEMA (60+ CSS custom properties)
    → render tokens.css (:root { --bg: ...; --fg: ...; })
    → render tailwind-theme.css (@theme { ... })
    → write to project:
       src/styles/tokens.css
       src/styles/tailwind-theme.css
    → Vite HMR detects change
    → instant visual update in Tauri app!
```

### 6.2 Implementation

```typescript
export async function syncDesignTokensToProject(
  projectId: string,
  projectsRoot: string,
): Promise<void> {
  // 1. Read active design system
  const project = await getProject(projectId);
  const dsId = project.designSystemId;
  if (!dsId) return;

  const designMd = await readDesignSystemMarkdown(dsId);
  const tokensCss = await renderTokensCss(designMd);
  const tailwindCss = renderTailwindV4Css(designMd);

  // 2. Resolve project directory
  const dir = resolveProjectDir(projectsRoot, projectId);
  const stylesDir = path.join(dir, 'src', 'styles');

  // 3. Backup existing files before overwriting
  const tokensPath = path.join(stylesDir, 'tokens.css');
  const tailwindPath = path.join(stylesDir, 'tailwind-theme.css');

  if (await fs.pathExists(tokensPath)) {
    await fs.copy(tokensPath, tokensPath + '.bak');
  }

  // 4. Write to project files
  await fs.mkdir(stylesDir, { recursive: true });
  await fs.writeFile(tokensPath, tokensCss, 'utf-8');
  await fs.writeFile(tailwindPath, tailwindCss, 'utf-8');

  // 5. Log the sync
  await logDesignTokenSync(projectId, tokensCss, tailwindCss);

  // 6. Vite HMR will auto-detect and reload
  // No manual notification needed — chokidar already watching
}
```

### 6.3 Token Schema Integration

Open Design sudah punya TOKEN_SCHEMA dengan 4 layer dan ~60 CSS custom properties. Ini tetap dipakai, tapi sekarang output-nya di-write ke disk, bukan di-paste ke prompt:

| Layer | Properties | Description |
|---|---|---|
| **A1-identity** (required, no fallback) | `--bg`, `--fg`, `--accent` | Core identity tokens |
| **A1-structure** (required) | `--text-*`, `--space-*`, `--radius-*` | Structural tokens |
| **A2** (required-with-fallback) | `--elev-*`, `--motion-*`, `--container-*` | Enhancement tokens |
| **B-slot** (optional, aliases) | Brand-specific extensions | Brand extension tokens |

---

## 7. Vite HMR Preview Integration

Di sistem lama, preview dilakukan via `iframe srcdoc` yang sandboxed. Di sistem baru, preview adalah Tauri app yang sudah berjalan dengan Vite dev server. Tidak perlu iframe, tidak perlu srcdoc, tidak perlu sandbox shim. AI edit file → Vite HMR detect → browser reload → user lihat perubahan secara instan. Ini adalah perubahan paling signifikan dalam UX karena menghilangkan seluruh lapisan abstraction antara AI edit dan visual result.

### 7.1 Preview Architecture

```typescript
// apps/web/src/providers/vite-preview.ts
export function useVitePreview(projectId: string) {
  // Port menyesuaikan project — auto-detect atau dari project config
  const project = useProject(projectId);
  const vitePort = project.config?.vitePort ?? autoDetectVitePort(project.baseDir);
  const previewUrl = `http://localhost:${vitePort}`;

  // Listen ke daemon SSE untuk file changes (metadata)
  const { events } = useProjectFileEvents(projectId);

  // File change → Vite HMR auto-reload (native filesystem watch)
  // Tidak perlu manual reload — Vite watch filesystem via chokidar

  // Return preview URL untuk di-embed di UI
  return { previewUrl, events };
}

// Auto-detect dari vite.config.ts atau package.json scripts
async function autoDetectVitePort(baseDir: string): Promise<number> {
  // 1. Cek vite.config.ts untuk server.port
  try {
    const viteConfig = await fs.readFile(
      path.join(baseDir, 'vite.config.ts'), 'utf-8'
    );
    const portMatch = viteConfig.match(/server:\s*\{[^}]*port:\s*(\d+)/);
    if (portMatch) return parseInt(portMatch[1], 10);
  } catch {}

  // 2. Cek package.json scripts untuk --port flag
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(baseDir, 'package.json'), 'utf-8')
    );
    const devScript = pkg.scripts?.dev || '';
    const portMatch = devScript.match(/--port\s+(\d+)/);
    if (portMatch) return parseInt(portMatch[1], 10);
  } catch {}

  // 3. Cek tauri.conf.json untuk devUrl port
  try {
    const tauriConfig = await fs.readFile(
      path.join(baseDir, 'src-tauri/tauri.conf.json'), 'utf-8'
    );
    const config = JSON.parse(tauriConfig);
    const devUrl = config.build?.devUrl || '';
    const urlMatch = devUrl.match(/localhost:(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1], 10);
  } catch {}

  // 4. Fallback ke 5173 (Vite default), bukan 1420 (Tauri default)
  return 5173;
}
```

### 7.2 Perbandingan Preview Lama vs Baru

| Aspek | Preview Lama | Preview Baru |
|---|---|---|
| Rendering | iframe srcdoc (sandboxed HTML) | Vite dev server + HMR |
| Reload mechanism | Manual: replace srcdoc content | Automatic: Vite filesystem watch |
| React support | None (plain HTML only) | Full React + TypeScript |
| State preservation | None (iframe recreated) | HMR preserves component state |
| CSS support | Inline styles only | Full Tailwind + CSS imports |
| Dev tools | None | Full browser DevTools |
| File watching | chokidar via daemon SSE | Vite native + daemon SSE for metadata |
| Hot reload speed | 1-3 seconds (full iframe rebuild) | <100ms (HMR patch) |
| Port | Hardcoded (daemon port) | Auto-detect dari `vite.config.ts` / `tauri.conf.json` |

### 7.3 Legacy Preview: Design Skills

Untuk skill yang masih menggunakan mode `design` (legacy skills), iframe preview tetap tersedia sebagai fallback. Ketika user menggunakan skill dengan `od.mode: design` di frontmatter, preview otomatis switch ke iframe srcdoc mode:

```typescript
export function usePreview(projectId: string, activeSkill: SkillInfo) {
  const isDesignMode = activeSkill?.frontmatter?.od?.mode === 'design';

  if (isDesignMode) {
    // Legacy: iframe srcdoc preview
    return useLegacyArtifactPreview(projectId);
  }

  // Default: Vite HMR preview
  return useVitePreview(projectId);
}
```

---

## 8. Skill System Migration

Seluruh skill system **dimigrasikan**, bukan dihapus. Dari ~259 composable skills, sebagian besar akan di-update output format-nya dari `<artifact>` menjadi `<file-edit>`, sementara skill yang bersifat design-only (deck, presentation, image-generation) tetap dipertahankan sebagai **legacy skills** dengan flag `mode: design`. Ini memastikan tidak ada kapabilitas yang hilang dalam migrasi.

### 8.1 Skill Baru: App Developer

```yaml
---
name: app-developer
description: |
  Edit source code in an existing React + Tauri + TypeScript project.
  Works directly on project files with Vite HMR for instant preview.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: code-edit
  design_system:
    requires: true
  craft:
    requires:
      - file-conventions
      - editing-rules
---

# App Developer Mode

You are working inside an EXISTING React + Tauri + TypeScript codebase.
You do NOT generate standalone HTML artifacts. Instead:

1. **Read before edit**: Always read the existing file first using
   the project file tools
2. **Edit in-place**: Modify existing .tsx/.ts/.css files directly
   using <file-edit> blocks
3. **Follow the design system**: Use tokens from tokens.css
   (var(--bg), var(--accent), etc.) for all styling
4. **Preserve structure**: Don't create new files unless explicitly
   asked — prefer editing existing files
5. **Hot reload**: The user will see changes via Vite HMR instantly

## Output format

For each file you modify, output a FILE EDIT block:

<file-edit path="src/components/Header.tsx">
// full file content here
</file-edit>

For new files that MUST be created:

<file-edit path="src/components/NewFeature.tsx" action="create">
// full file content here
</file-edit>

## Style guidelines

- Use Tailwind CSS classes with design token CSS variables
- Example: className="bg-[var(--bg)] text-[var(--fg)]"
- For complex styles: style={{ background: 'var(--bg)' }}
- Import tokens.css in components that need it
- Never inline entire stylesheets — reference tokens.css
```

### 8.2 Daftar Skill dengan Migration Status

| Skill Name | Scenario | Migration Status | Notes |
|---|---|---|---|
| `app-developer` | engineering | **new** | General-purpose source code editing |
| `component-builder` | engineering | **new** | Build new React components with design tokens |
| `page-creator` | engineering | **new** | Create new pages/routes with routing setup |
| `api-integration` | engineering | **new** | Integrate REST/GraphQL APIs with React Query |
| `state-management` | engineering | **new** | Add or modify Zustand stores |
| `tauri-bridge` | engineering | **new** | Implement Tauri IPC commands |
| `style-refactor` | engineering | **new** | Refactor inline styles to design token system |
| `test-writer` | engineering | **new** | Generate unit/integration tests |
| `web-prototype` | design | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `frontend-dev` | engineering | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `artifacts-builder` | engineering | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `web-artifacts-builder` | engineering | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `shadcn-ui` | design | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `login-flow` | design | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `canvas-design` | design | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `dashboard-builder` | design | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `landing-page` | design | **migrated** | Output `<file-edit>` bukan `<artifact>` |
| `editorial` | design | **legacy** | Deck/editorial — tetap pakai `<artifact>`, flag `mode: design` |
| `deck-presentation` | design | **legacy** | Slide deck — tetap pakai `<artifact>`, flag `mode: design` |
| `image-generation` | media | **legacy** | Image gen — tetap pakai `<artifact>`, flag `mode: design` |
| `video-generation` | media | **legacy** | Video gen — tetap pakai `<artifact>`, flag `mode: design` |
| `audio-generation` | media | **legacy** | Audio gen — tetap pakai `<artifact>`, flag `mode: design` |
| `flutter-animating-apps` | design | **deprecated** | Tidak relevan untuk Tauri + React stack |
| `swiftui-design` | design | **deprecated** | Tidak relevan untuk Tauri + React stack |

### 8.3 Skill Migration Strategy

Migrasi skill dilakukan dalam 3 kategori berdasarkan relevansi dan kompleksitas:

#### Kategori 1: `migrated` — Skill yang di-update ke `<file-edit>` output

Skill yang menghasilkan HTML/CSS/JS yang bisa dipecah menjadi file-file terpisah. Contoh: `web-prototype`, `frontend-dev`, `artifacts-builder`, `shadcn-ui`, `login-flow`, dll.

**Cara migrasi:**

1. **Update SKILL.md body** — ganti semua instruksi yang menyebut `<artifact>` menjadi `<file-edit>`
2. **Update output format section** — dari:
   ```
   Output a single HTML artifact: <artifact identifier="..." type="text/html">
   ```
   menjadi:
   ```
   Output file edits for each file: <file-edit path="src/components/X.tsx">
   ```
3. **Tambahkan `od.outputFormat: file-edit`** di frontmatter (field baru)
4. **Update file splitting logic** — skill yang sebelumnya menghasilkan satu HTML file sekarang menghasilkan multiple files (component + styles + types)
5. **Test** — pastikan AI mengikuti format baru dengan benar

**Contoh konversi `web-prototype` skill:**

Sebelum (artifact):
```markdown
## Output
Generate a complete HTML artifact with inline CSS and JavaScript:
<artifact identifier="prototype" type="text/html" title="...">
```

Sesudah (file-edit):
```markdown
## Output
Generate source files for the React + TypeScript project:
<file-edit path="src/components/Prototype.tsx">
<file-edit path="src/styles/prototype.css">
```

#### Kategori 2: `legacy` — Skill yang tetap pakai `<artifact>` dengan flag `mode: design`

Skill yang menghasilkan output yang secara fundamental tidak cocok dengan source code editing (presentations, images, videos, audio). Skill ini tetap berfungsi seperti sebelumnya, tapi diaktifkan hanya ketika user secara eksplisit memilih design mode.

**Cara penanganan:**

1. **Tambahkan `od.mode: design`** di frontmatter skill
2. **Tambahkan `od.outputFormat: artifact`** di frontmatter (field baru, explicit)
3. **Tidak ada perubahan pada SKILL.md body** — skill tetap bekerja seperti sebelumnya
4. **UI treatment** — skill legacy ditampilkan dengan badge "Design" di skill picker
5. **Preview fallback** — ketika skill legacy aktif, preview otomatis switch ke iframe srcdoc

#### Kategori 3: `deprecated` — Skill yang tidak relevan untuk stack baru

Skill yang secara fundamental tidak relevan dengan Tauri + React + TypeScript stack (Flutter, SwiftUI, dll). Skill ini tetap ada di repository tapi tidak ditampilkan di UI default.

**Cara penanganan:**

1. **Tambahkan `od.deprecated: true`** di frontmatter
2. **Tambahkan `od.deprecatedReason`** dengan penjelasan singkat
3. **UI filter** — skill deprecated di-hidden secara default, tapi bisa di-unhide via settings
4. **Tidak ada perubahan pada SKILL.md body** — skill tetap berfungsi jika user manual invoke

#### Tabel Mapping: Skill Lama → Skill Baru

| Skill Lama | Category | Skill Baru (atau Status) | Migration Notes |
|---|---|---|---|
| `web-prototype` | migrated | `web-prototype` (updated) | Output → `<file-edit>`, split HTML → React component + CSS |
| `frontend-dev` | migrated | `frontend-dev` (updated) | Output → `<file-edit>`, React + Tailwind source files |
| `artifacts-builder` | migrated | `artifacts-builder` (updated) | Output → `<file-edit>`, multi-component source files |
| `web-artifacts-builder` | migrated | `web-artifacts-builder` (updated) | Output → `<file-edit>`, React + Tailwind source files |
| `shadcn-ui` | migrated | `shadcn-ui` (updated) | Output → `<file-edit>`, component files + types |
| `login-flow` | migrated | `login-flow` (updated) | Output → `<file-edit>`, login page + auth logic |
| `dashboard-builder` | migrated | `dashboard-builder` (updated) | Output → `<file-edit>`, dashboard components + data hooks |
| `landing-page` | migrated | `landing-page` (updated) | Output → `<file-edit>`, landing page sections |
| `canvas-design` | migrated | `canvas-design` (updated) | Output → `<file-edit>`, canvas component |
| `editorial` | legacy | `editorial` (unchanged) | Flag `mode: design`, tetap `<artifact>` |
| `deck-presentation` | legacy | `deck-presentation` (unchanged) | Flag `mode: design`, tetap `<artifact>` |
| `image-generation` | legacy | `image-generation` (unchanged) | Flag `mode: design`, tetap `<artifact>` |
| `video-generation` | legacy | `video-generation` (unchanged) | Flag `mode: design`, tetap `<artifact>` |
| `audio-generation` | legacy | `audio-generation` (unchanged) | Flag `mode: design`, tetap `<artifact>` |
| `flutter-animating-apps` | deprecated | — | Tidak relevan untuk Tauri + React |
| `swiftui-design` | deprecated | — | Tidak relevan untuk Tauri + React |

---

## 9. Tauri Host Bridge

Open Design sudah punya Host Bridge system untuk Electron via `window.__od__`. Untuk Tauri, kita perlu membuat bridge yang setara tapi menggunakan Tauri IPC sebagai transport. Ini memungkinkan OD web app yang jalan di Tauri WebView untuk mengakses native capabilities seperti folder picker, shell commands, dan screen capture.

### 9.1 Bridge Architecture

```typescript
// packages/host-tauri/src/index.ts
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Shell } from '@tauri-apps/plugin-shell';

export const OPEN_DESIGN_HOST_GLOBAL = "__od__";
export const OPEN_DESIGN_HOST_VERSION = 2;

export function installTauriHostBridge() {
  const bridge: OpenDesignHostBridge = {
    client: {
      type: "desktop",  // Tauri = desktop
      osLocale: navigator.language,
      platform: detectPlatform(),
    },
    shell: {
      openExternal: (url: string) => Shell.open(url),
      openPath: (projectId: string) => invoke('open_in_editor', { projectId }),
    },
    browser: {
      clearData: async (options?) => { /* Tauri WebView clear */ },
    },
    capture: {
      page: async (options?) => invoke('capture_screenshot', { options }),
    },
    project: {
      pickAndImport: async (init?) => {
        const selected = await open({ directory: true, multiple: false });
        if (!selected) return null;
        return invoke('import_project', { path: selected, ...init });
      },
      pickAndReplaceWorkingDir: async (projectId: string) => {
        const selected = await open({ directory: true, multiple: false });
        if (!selected) return null;
        return invoke('replace_working_dir', { projectId, path: selected });
      },
    },
    pdf: {
      print: async (html, nonce?, options?) =>
        invoke('print_pdf', { html, nonce, options }),
    },
    pet: { setVisible: async () => {} },  // No pet in Tauri
    updater: {
      check: async () => invoke('check_update'),
      download: async () => invoke('download_update'),
      install: async () => invoke('install_update'),
      quit: async () => invoke('quit_app'),
      status: async () => invoke('update_status'),
      subscribe: (listener) => { /* SSE or Tauri event */ },
    },
  };

  (globalThis as any).__od__ = bridge;
  (window as any).__od__ = bridge;
}
```

### 9.2 Tauri Rust Commands

Di sisi Rust (`src-tauri/`), kita perlu mengimplementasikan Tauri commands yang dipanggil oleh bridge. Ini mencakup file dialog, shell integration, screenshot capture, dan update management. Setiap command harus mempertimbangkan security dengan hanya mengizinkan akses ke directory yang sudah di-approve oleh user.

```rust
// src-tauri/src/commands.rs
#[tauri::command]
async fn import_project(
    path: String,
    init: Option<ProjectInit>
) -> Result<ProjectImportResult, String> {
    let path = PathBuf::from(&path);
    if !path.is_dir() {
        return Err("Path is not a directory".into());
    }
    let project_type = detect_project_type(&path);
    let result = daemon_client::create_project(CreateProjectRequest {
        base_dir: path.to_string_lossy().to_string(),
        project_type,
        ..Default::default()
    }).await.map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
async fn open_in_editor(project_id: String) -> Result<(), String> {
    let project = daemon_client::get_project(&project_id)
        .await.map_err(|e| e.to_string())?;
    Command::new("code")
        .arg(&project.base_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn capture_screenshot(
    options: Option<CaptureOptions>
) -> Result<String, String> {
    // Returns base64 encoded PNG
    todo!("Implement with tauri WebView screenshot API")
}
```

---

## 10. Migration Phases

Migrasi dilakukan dalam 4 fase yang terstruktur. Setiap fase menghasilkan versi yang bisa dijalankan dan ditest secara independen. Fase 1 adalah yang paling kritis karena membuktikan konsep bahwa `<file-edit>` parser + Vite HMR bisa bekerja. Fase 2 menghapus semua komponen lama. Fase 3 membangun UI baru. Fase 4 mengintegrasikan Tauri.

### 10.1 Phase 1: Core Engine (Week 1-2)

Fase ini membuktikan konsep bahwa sistem baru bisa bekerja. Fokus pada 3 komponen paling kritis: `<file-edit>` parser, App Developer system prompt, dan Design Token Sync. Di akhir fase ini, AI sudah bisa edit source code in-place dan perubahan terlihat via Vite HMR.

| Task | File | Estimasi | Priority |
|---|---|---|---|
| Buat `<file-edit>` streaming parser | `apps/web/src/parsers/file-edit-parser.ts` | 2 hari | P0 |
| Buat App Developer system prompt | `apps/daemon/src/prompts/app-developer-system.ts` | 2 hari | P0 |
| Buat Design Token Sync service | `apps/daemon/src/design-token-sync.ts` | 1 hari | P0 |
| Buat App Developer skill SKILL.md | `skills/app-developer/SKILL.md` | 1 hari | P0 |
| Integrate `<file-edit>` ke Chat streaming handler | `apps/web/src/components/ProjectView.tsx` | 2 hari | P0 |
| File edit → disk write pipeline | `apps/daemon/src/project-routes.ts` | 1 hari | P0 |
| Test end-to-end: prompt → file edit → HMR reload | Manual test | 1 hari | P0 |

### 10.2 Phase 2: Migrate Skills & Purge Artifact System (Week 3)

Fase ini memigrasikan semua skill ke format baru dan menghapus sistem artifact lama. Skill yang bisa di-migrate di-update ke `<file-edit>`, skill design-only ditandai sebagai legacy, dan skill yang tidak relevan ditandai sebagai deprecated. Setelah fase ini, artifact parser, srcdoc builder, dan iframe pool sudah dihapus.

| Task | File/Directory | Estimasi | Risk |
|---|---|---|---|
| Migrasi skill ke format `<file-edit>` (batch 1: web-prototype, frontend-dev, dll) | `skills/` | 2 hari | Medium |
| Tambah `od.outputFormat` dan `od.mode: design` ke legacy skills | `skills/` + `design-templates/` | 1 hari | Low |
| Tambah `od.deprecated` ke skill yang tidak relevan | `skills/` | 0.5 hari | Low |
| Hapus artifact parser + manifest | `apps/web/src/artifacts/` | 0.5 hari | Low |
| Hapus srcdoc + all bridge injections | `apps/web/src/runtime/srcdoc.ts` | 0.5 hari | Medium |
| Hapus IframeKeepAlivePool | `apps/web/src/components/IframeKeepAlivePool.tsx` | 0.5 hari | Low |
| Hapus HtmlViewer / DeckHtmlViewer / SvgViewer | `apps/web/src/components/FileViewer.tsx` | 0.5 hari | Medium |
| Hapus Critique Theater system | `apps/daemon/src/critique/` + `apps/web/src/critique/` | 1 hari | Medium |
| Hapus Live Artifacts system | `apps/daemon/src/live-artifact.ts` + contracts | 1 hari | Medium |
| Hapus export system (PDF, ZIP, React, Vue, Next) | `apps/daemon` + `apps/web` export routes | 1 hari | Medium |
| Hapus Manual Edit Bridge + Sketch Editor | `apps/web/src/edit-mode/` + SketchEditor | 0.5 hari | Low |
| Clean up unused API routes | `apps/daemon/src/` | 1 hari | Medium |
| Update types di `packages/contracts` | `packages/contracts/src/` | 1 hari | High |

### 10.3 Phase 3: New UI (Week 4-5)

Fase ini membangun UI baru yang menggantikan semua komponen yang dihapus di Phase 2. FileTree menggantikan DesignFilesPanel, CodeViewer menggantikan HtmlViewer, dan Vite Preview menggantikan iframe srcdoc. Chat interface diupdate untuk menampilkan file edit diffs.

| Task | File | Estimasi | Priority |
|---|---|---|---|
| Buat FileTree component | `apps/web/src/components/FileTree.tsx` | 2 hari | P0 |
| Buat CodeViewer dengan syntax highlighting | `apps/web/src/components/CodeViewer.tsx` | 3 hari | P0 |
| Buat VitePreview component (dengan configurable port) | `apps/web/src/providers/vite-preview.ts` | 2 hari | P0 |
| Update FileWorkspace layout | `apps/web/src/components/FileWorkspace.tsx` | 2 hari | P0 |
| Update ChatPane: show file edit diffs | `apps/web/src/components/ChatPane.tsx` | 3 hari | P1 |
| Update EntryView: restructure untuk app-developer focus | `apps/web/src/components/EntryView.tsx` | 1 hari | P1 |
| Update Settings: remove design-centric options | `apps/web/src/components/SettingsDialog.tsx` | 1 hari | P2 |
| Upgrade Terminal integration | `apps/web/src/components/TerminalViewer.tsx` | 2 hari | P1 |

### 10.4 Phase 4: Tauri Integration (Week 6)

Fase ini mengintegrasikan Tauri Host Bridge supaya OD web app bisa berjalan di dalam Tauri WebView dengan akses ke native capabilities. Ini termasuk folder picker, shell integration, screenshot capture, dan auto-update.

| Task | File | Estimasi | Priority |
|---|---|---|---|
| Buat `packages/host-tauri` | `packages/host-tauri/` | 2 hari | P0 |
| Implement Tauri Rust commands | `src-tauri/src/commands.rs` | 2 hari | P0 |
| Install bridge di Tauri WebView | `src-tauri/src/main.rs` | 1 hari | P0 |
| Test: folder picker → import → edit → HMR | Manual test | 1 hari | P0 |
| Implement auto-update via Tauri | `src-tauri/src/updater.rs` | 1 hari | P2 |
| End-to-end integration test | Full flow test | 1 hari | P0 |

---

## 11. Database Schema Changes

SQLite schema perlu disederhanakan karena banyak tabel yang hanya relevan untuk artifact/design system. Berikut perubahan yang diperlukan pada skema database daemon.

### 11.1 Tabel yang Dihapus

| Tabel | Alasan |
|---|---|
| `deployments` | Tidak ada artifact untuk di-deploy |
| `templates` | Diganti project templates (sudah ada di codebase) |
| `preview_comments` | Tidak ada iframe preview untuk dikomentari |
| `critique_*` tables | Critique Theater dihapus |
| `media_tasks*` | Media generation di-scope out dulu |

### 11.2 Tabel yang Dimodifikasi

| Tabel | Perubahan |
|---|---|
| `projects` | Tambah kolom: `project_type` (tauri-react, nextjs, dll), `tech_stack`, `vite_port` (nullable, di-populate via auto-detect saat import). Ubah `kind` dari prototype/deck/template menjadi app-developer types |
| `conversations` | Tambah kolom: `last_file_edits` (JSON array of file paths edited in this conversation) |
| `messages` | Ubah `produced_files_json`: dari artifact manifest menjadi file edit records. Tambah kolom: `file_edits_json` |

### 11.3 Tabel yang Ditambahkan

| Tabel | Kolom | Fungsi |
|---|---|---|
| `design_token_sync_log` | `id`, `project_id`, `tokens_css_hash`, `synced_at` | Track kapan tokens terakhir di-sync ke project |
| `file_edit_history` | `id`, `project_id`, `conversation_id`, `message_id`, `file_path`, `action` (edit/create/delete), `diff_json`, `created_at` | History semua file edits yang dilakukan AI |

> **Note tentang `vite_port`:** Kolom ini nullable. Nilainya di-populate saat project import melalui `autoDetectVitePort()` yang membaca `vite.config.ts`, `package.json` scripts, dan `tauri.conf.json`. Jika tidak terdeteksi, fallback ke 5173 (Vite default). User juga bisa manual override via project settings.

---

## 12. API Routes Changes

Daemon API routes perlu disederhanakan dan diarahkan ulang. Banyak route yang hanya relevan untuk artifact/design system harus dihapus, dan route baru untuk file editing dan design token sync harus ditambahkan.

### 12.1 Routes yang Dihapus

| Route | Alasan |
|---|---|
| `POST /api/artifacts/save` | Tidak ada artifact system lagi |
| `POST /api/artifacts/lint` | Tidak ada artifact HTML untuk di-lint |
| `GET /api/projects/:id/preview-url` | Preview via Vite dev server, bukan daemon |
| `GET /api/projects/:id/preview/*` | Diganti Vite dev server serving |
| `POST /api/projects/:id/export/pdf` | Diganti Tauri print API |
| `GET /api/projects/:id/export/*` | Tidak ada artifact export lagi |
| `POST /api/projects/:id/finalize/:provider` | Tidak ada design finalization |
| `POST /api/projects/:id/handoff` | Sudah di project, tidak perlu handoff |
| All `/api/live-artifacts/*` routes | Live artifacts dihapus |
| All `/api/deploy/*` routes | Deployment di-scope out |
| All critique routes | Critique Theater dihapus |

### 12.2 Routes yang Ditambahkan

| Route | Method | Fungsi |
|---|---|---|
| `/api/projects/:id/sync-tokens` | POST | Trigger design token sync ke project files |
| `/api/projects/:id/file-edits` | GET | List file edit history untuk project |
| `/api/projects/:id/detect-type` | POST | Auto-detect project type (Tauri, Next.js, dll) |
| `/api/projects/:id/file-map` | GET | Generate file map untuk system prompt injection |
| `/api/projects/:id/validate-edit` | POST | Validate file edit sebelum write (check path, syntax) |
| `/api/projects/:id/detect-vite-port` | POST | Auto-detect Vite dev server port dari project config |

---

## 13. Risk Analysis

Setiap migrasi besar memiliki risiko. Berikut analisis risiko utama beserta mitigasi yang direncanakan untuk setiap risiko.

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| AI tidak mengikuti `<file-edit>` format | HIGH — file tidak ter-write | Medium | Robust parser dengan fallback ke plain text detection + validation sebelum write |
| Vite HMR tidak detect perubahan dari AI | HIGH — preview tidak update | Low | Vite native chokidar watch sudah handle filesystem changes; test dengan multiple OS |
| Design token sync merusak existing styles | HIGH — visual regression | Medium | Backup existing `tokens.css` sebelum overwrite (`.bak` file); validate via Tailwind v4 `@theme` parser |
| Breaking change pada daemon API | MEDIUM — web app crash | High | Phase migration: support old + new format selama Phase 2, remove old di Phase 3 |
| Tauri WebView limitations | MEDIUM — beberapa fitur tidak jalan | Low | Test early di Phase 4; fallback ke browser mode jika Tauri tidak support |
| Skill prompt terlalu panjang (token limit) | MEDIUM — AI output truncated | Medium | Optimize file map: hanya include top-level structure, lazy-load detail on demand |
| File edit conflicts (AI + user edit same file) | HIGH — lost changes | Medium | File locking during edit; diff-based merge; always read-before-write |
| **Butuh rollback ke versi sebelum migrasi** | LOW | Low | Clone fresh dari `nexu-io/open-design` (upstream) kapanpun. Migrasi ini dilakukan di fork terpisah. Tidak ada data user yang hilang karena project files selalu di disk user. |

---

## 14. Success Criteria

Migrasi dianggap berhasil jika semua kriteria berikut terpenuhi. Setiap kriteria harus bisa diverifikasi secara objektif dan di-test secara otomatis atau manual.

| # | Criteria | Verification Method |
|---|---|---|
| 1 | AI menghasilkan `<file-edit>` blocks, bukan `<artifact>` blocks | Unit test: parser hanya recognize `<file-edit>` |
| 2 | File edits di-write ke disk di project directory yang benar | Integration test: check file exists + content matches |
| 3 | Vite HMR trigger reload setelah file write | Manual test: edit file via AI, verify UI updates |
| 4 | Design tokens di-sync ke `src/styles/tokens.css` secara otomatis | Unit test: compare generated `tokens.css` with expected output |
| 5 | Tidak ada artifact HTML files di project directory | File system test: no `.html` artifacts in project |
| 6 | Chat interface menampilkan file edit diffs, bukan artifact preview | Manual test: verify UI shows code changes |
| 7 | Tauri app bisa di-import sebagai project via folder picker | Manual test: pick folder, verify CWD and file access |
| 8 | Semua API routes lama yang di-delete return 404 | API test: hit deleted routes, verify 404 |
| 9 | Tidak ada import error atau runtime crash di web app | Build test: `npm run build` succeeds without errors |
| 10 | End-to-end flow: prompt → file edit → HMR reload → visual update < 2 seconds | Performance test: measure time from AI output to visual update |
| 11 | Legacy skills (design mode) masih berfungsi dengan iframe preview | Manual test: invoke legacy skill, verify artifact preview |
| 12 | Skill migration status tercatat di SKILL.md frontmatter | Validation test: all skills have `od.outputFormat` field |
