const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, PageNumber, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak, TableOfContents, SectionType, NumberFormat } = require("docx");
const fs = require("fs");

// Palette: Deep Cyan (tech/AI)
const P = { primary: "162235", body: "000000", secondary: "5A6080", accent: "37DCF2", surface: "F8F9FF" };
const c = (hex) => hex.replace("#", "");

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// Helper: heading
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32 })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28 })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 26 })],
  });
}

// Helper: body paragraph
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: opts.noIndent ? undefined : { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    ...opts.paraOpts,
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, ...opts.runOpts })],
  });
}

// Helper: bullet list
function bullet(text, level = 0) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 480 + level * 360 },
    spacing: { line: 312, after: 60 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, color: c(P.accent), font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

// Helper: code block
function codeBlock(text) {
  const lines = text.split("\n");
  return lines.map((line, i) => new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 480 },
    spacing: { line: 276, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F4F6F8" },
    children: [new TextRun({ text: line || " ", size: 20, color: c(P.primary), font: { ascii: "Consolas", eastAsia: "Consolas" } })],
  }));
}

// Helper: table
function makeTable(headers, rows) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: "D0D8E0" };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideHorizontal: borderStyle, insideVertical: borderStyle };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(h => new TableCell({
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "E0F7FA" },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: h, bold: true, size: 22, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] })],
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map(cell => new TableCell({
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          shading: ri % 2 === 0 ? { type: ShadingType.CLEAR, fill: "FFFFFF" } : { type: ShadingType.CLEAR, fill: "F8FAFB" },
          margins: { top: 50, bottom: 50, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 300 }, children: [new TextRun({ text: cell, size: 21, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
        })),
      })),
    ],
  });
}

// Helper: spacer
function spacer(twips = 200) {
  return new Paragraph({ spacing: { before: twips } });
}

// Helper: accent paragraph (for key insights)
function accentPara(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 360 },
    spacing: { line: 312, before: 120, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: c(P.accent), space: 120 } },
    children: [new TextRun({ text, size: 24, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, italics: true })],
  });
}

// ============ BUILD DOCUMENT ============

const coverChildren = [
  new Paragraph({ spacing: { before: 4200 } }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200, right: 1200 },
    spacing: { line: 1200, lineRule: "atLeast" },
    children: [new TextRun({ text: "Open Design", size: 80, bold: true, color: c(P.accent), font: { ascii: "Calibri" } })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200, right: 1200 },
    spacing: { line: 700, lineRule: "atLeast" },
    children: [new TextRun({ text: "App Developer Migration Plan", size: 52, color: c(P.primary), font: { ascii: "Calibri" } })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200, right: 1200 },
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: c(P.accent), space: 200 } },
    children: [],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { before: 200, line: 400 },
    children: [new TextRun({ text: "From Design/Mockup Tool to Real App Development Software", size: 28, color: "5A6080", font: { ascii: "Calibri" } })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { before: 200, line: 400 },
    children: [new TextRun({ text: "Full Migration \u2014 Not a Mode Addition", size: 24, color: "5A6080", font: { ascii: "Calibri" } })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { before: 600 },
    children: [new TextRun({ text: "Date: 2026-06-10", size: 22, color: "8090A0", font: { ascii: "Calibri" } })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    children: [new TextRun({ text: "Target: smart-tax-assistance/app (Tauri + React + Vite)", size: 22, color: "8090A0", font: { ascii: "Calibri" } })],
  }),
];

const tocSection = [
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "Table of Contents", size: 32, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  }),
  new TableOfContents("TOC", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({
    children: [new PageBreak()],
  }),
];

// ============ CONTENT SECTIONS ============
const content = [];

// ========== SECTION 1: EXECUTIVE SUMMARY ==========
content.push(h1("1. Executive Summary"));
content.push(body("Dokumen ini adalah rencana migrasi komprehensif untuk mengubah Open Design dari sebuah design/mockup tool menjadi app development software yang sesungguhnya. Ini bukan penambahan mode baru \u2014 ini adalah migrasi total yang menghapus seluruh sistem artifact/mockup lama dan menggantinya dengan sistem yang bekerja langsung di source code project yang sudah ada."));
content.push(spacer(100));
content.push(accentPara("Key Insight: Open Design saat ini generate standalone HTML artifacts di sandbox-nya sendiri (.od/projects/). Kita mau AI-nya edit file .tsx/.ts/.css langsung di project user, dan setiap perubahan langsung terlihat via Vite HMR di Tauri app."));
content.push(spacer(100));
content.push(body("Migrasi ini mencakup 3 area utama: (1) Daemon backend \u2014 mengubah cara AI menghasilkan output dari artifact menjadi file edits, (2) Web frontend \u2014 mengganti preview iframe/srcdoc dengan code editor dan Vite HMR integration, dan (3) Skills dan System Prompt \u2014 mengubah instruksi AI dari \"generate HTML artifact\" menjadi \"edit source code in-place\". Seluruh perubahan bersifat breaking change yang menghapus fitur lama secara permanen."));

// ========== SECTION 2: VALIDASI HIPOTESIS ==========
content.push(h1("2. Validasi Hipotesis User"));
content.push(body("User bertanya: \"Apakah hipotesis saya benar bahwa Open Design selalu pakai design baru dan tidak bisa plug and play?\" Setelah analisis mendalam terhadap seluruh codebase, jawabannya adalah: SETENGAH BENAR."));
content.push(spacer(80));
content.push(h2("2.1 Hipotesis yang Benar"));
content.push(body("Open Design secara default memang SELALU membuat project baru di .od/projects/<id>/ directory. Artifact-artifact dihasilkan di sandbox-nya sendiri, bukan di kodebase user. AI di-instruct untuk menghasilkan single-page artifact HTML, bukan React component atau TypeScript file yang bisa di-import. Preview menggunakan iframe srcdoc yang sandboxed, tanpa Vite dev server dan tanpa HMR. Design system tokens cuma di-inject ke system prompt sebagai teks dan di-paste ke dalam artifact HTML, bukan di-write ke file CSS di project user."));
content.push(spacer(80));
content.push(h2("2.2 Jalan Masuk yang Sudah Ada"));
content.push(body("Open Design punya fitur pickAndImport yang memungkinkan user memilih folder yang sudah ada. Ketika user pick folder, OD TIDAK copy file, tapi reference in-place. Agent CWD (current working directory) jadi pointing ke folder yang user pilih, dan semua file write langsung ke folder tersebut. Ini sudah sangat dekat dengan apa yang kita mau, tapi ada 3 masalah fundamental yang harus dipecahkan."));
content.push(spacer(80));
content.push(h2("2.3 Tiga Masalah Fundamental"));

content.push(h3("Masalah 1: Output Format \u2014 Artifacts, Bukan Source Code"));
content.push(body("Skill OD selalu menginstruksikan AI untuk generate <artifact type=\"text/html\"> \u2014 standalone HTML. Bukan React component file, bukan TypeScript, bukan Tailwind CSS yang bisa di-import. AI-nya di-instruct untuk bikin \"single-page artifact\", bukan \"edit file X di src/components/\". Ini adalah konsekuensi langsung dari SKILL.md yang mendefinisikan output format sebagai artifact, dan system prompt composition yang membangun prompt berdasarkan skill aktif."));

content.push(h3("Masalah 2: Preview \u2014 srcdoc Iframe, Bukan Vite HMR"));
content.push(body("Preview OD menggunakan iframe srcdoc yang sandboxed. Tidak ada Vite dev server, tidak ada HMR. Jika AI edit file .tsx di folder user, OD tidak bisa mereload Tauri app user \u2014 dia cuma bisa reload iframe-nya sendiri. Seluruh pipeline dari buildSrcdoc(), injectSandboxShim(), injectSelectionBridge(), injectSnapshotBridge(), dan IframeKeepAlivePool harus diganti dengan mekanisme yang mengarah ke Vite dev server yang sudah berjalan."));

content.push(h3("Masalah 3: Design System \u2014 Hanya di Prompt, Bukan di File"));
content.push(body("DESIGN.md itu cuma di-inject ke system prompt AI sebagai teks. tokens.css di-generate tapi di-paste ke dalam artifact HTML, bukan di-write ke src/styles/tokens.css di project user. Artinya design system yang sudah didefinisikan tidak accessible sebagai CSS custom properties yang bisa dipakai oleh React components. Ini harus diubah supaya tokens.css dan tailwind-theme.css otomatis di-write ke project user setiap kali design system berubah."));

// ========== SECTION 3: ARSITEKTUR BARU ==========
content.push(h1("3. Arsitektur Baru: App Developer"));
content.push(body("Arsitektur baru menghapus seluruh konsep \"mode\" \u2014 tidak ada lagi \"Design Mode\" vs \"Dev Mode\". Seluruh tool adalah app development software. Setiap project yang di-import langsung bekerja sebagai app developer workspace di mana AI bisa edit source code, dan perubahan langsung terlihat di Tauri app via Vite HMR."));

content.push(h2("3.1 Arsitektur Overview"));
content.push(...codeBlock(
`smart-tax-assistance/app/          \u2190 WORKING DIRECTORY
\u251c\u2500\u2500 src/
\u2502   \u251c\u2500\u2500 components/         \u2190 AI edit files HERE
\u2502   \u251c\u2500\u2500 styles/
\u2502   \u2502   \u2514\u2500\u2500 tokens.css      \u2190 Auto-generated dari DESIGN.md
\u2502   \u2502   \u2514\u2500\u2500 tailwind-theme.css \u2190 Auto-generated
\u2502   \u2514\u2500\u2500 App.tsx
\u251c\u2500\u2500 src-tauri/              \u2190 Tauri backend
\u2514\u2500\u2500 .open-design/
    \u251c\u2500\u2500 project.json           \u2190 Project manifest
    \u251c\u2500\u2500 DESIGN.md              \u2190 Active design system
    \u2514\u2500\u2500 .live-artifacts/       \u2190 (removed, replaced by source files)

Tauri App (Vite Dev Server)
\u2192 http://localhost:1420         \u2190 HOT RELOAD!
\u2192 AI edit .tsx \u2192 Vite HMR \u2192 instant preview

Open Design Daemon (sidecar)
\u2192 /api/runs  \u2192 spawn agent di CWD=smart-tax-assistance/app
\u2192 /api/design-systems \u2192 inject DESIGN.md + tokens.css
\u2192 File watcher \u2192 detect changes \u2192 notify frontend`
));

content.push(h2("3.2 Komponen yang Dihapus"));
content.push(body("Berikut adalah komponen yang dihapus secara permanen dari codebase Open Design. Penghapusan ini bersifat total dan tidak ada backward compatibility."));

content.push(makeTable(
  ["Komponen", "Lokasi", "Alasan Penghapusan"],
  [
    ["Artifact parser (<artifact>)", "apps/web/src/artifacts/parser.ts", "Diganti dengan <file-edit> parser"],
    ["Artifact manifest system", "apps/web/src/artifacts/manifest.ts", "Tidak ada lagi artifact files"],
    ["Artifact renderer registry", "apps/web/src/artifacts/renderer-registry.ts", "Diganti code viewer/editor"],
    ["srcdoc builder + all bridges", "apps/web/src/runtime/srcdoc.ts", "Diganti Vite HMR preview"],
    ["IframeKeepAlivePool", "apps/web/src/components/IframeKeepAlivePool.tsx", "Tidak ada lagi iframe preview"],
    ["HtmlViewer / DeckHtmlViewer", "apps/web/src/components/FileViewer.tsx", "Diganti CodeViewer"],
    ["ReactComponentViewer", "apps/web/src/runtime/react-component.ts", "Diganti live app preview"],
    ["Critique Theater", "apps/daemon + apps/web", "Tidak ada artifact untuk dikritik"],
    ["Live Artifacts system", "apps/daemon + apps/web + packages/contracts", "Diganti real source files"],
    ["Design Handoff (React/Vue/Next export)", "apps/daemon + apps/web", "Sudah di project React, tidak perlu export"],
    ["Design Templates gallery", "apps/web + apps/daemon/design-templates/", "Diganti project templates"],
    ["Artifact save/lint API", "apps/daemon/src/project-routes.ts", "Diganti file write API"],
    ["Deck system + DeckBridge", "apps/web + apps/daemon", "Bukan presentation tool lagi"],
    ["Manual Edit Bridge", "apps/web/src/edit-mode/", "Diganti direct file editing"],
    ["Sketch Editor", "apps/web/src/components/SketchEditor.tsx", "Bukan drawing tool lagi"],
    ["Palette Bridge (re-skin)", "apps/web/src/runtime/srcdoc.ts", "Design system di tokens.css"],
    ["Snapshot Bridge (capture)", "apps/web/src/runtime/srcdoc.ts", "Tauri capture API"],
    ["PDF export via iframe", "apps/daemon + apps/web", "Tauri print API"],
    ["All design-centric skills (~200)", "apps/daemon/skills/ + design-templates/", "Diganti dev skills"],
    ["Design system review flow", "apps/web + apps/daemon", "Simplified: just tokens sync"],
  ]
));

content.push(h2("3.3 Komponen yang Dibangun Baru"));

content.push(makeTable(
  ["Komponen", "Lokasi", "Fungsi"],
  [
    ["<file-edit> parser", "apps/web/src/parsers/file-edit-parser.ts", "Parse AI output jadi file writes"],
    ["App Developer system prompt", "apps/daemon/src/prompts/app-developer-system.ts", "Compose prompt untuk code editing"],
    ["Design token sync service", "apps/daemon/src/design-token-sync.ts", "DESIGN.md \u2192 tokens.css \u2192 project files"],
    ["Vite HMR integration", "apps/web/src/providers/vite-preview.ts", "Connect ke Vite dev server untuk preview"],
    ["CodeViewer component", "apps/web/src/components/CodeViewer.tsx", "Syntax-highlighted code view"],
    ["FileTree component", "apps/web/src/components/FileTree.tsx", "Real project file browser"],
    ["TerminalPanel component", "apps/web/src/components/TerminalPanel.tsx", "Embedded terminal (sudah ada, perlu upgrade)"],
    ["App Developer skill", "skills/app-developer/SKILL.md", "Skill definition untuk code editing"],
    ["Tauri Host Bridge", "packages/host-tauri/", "Native dialog, shell, capture untuk Tauri"],
    ["File change notifier", "apps/daemon/src/file-change-notifier.ts", "Notify frontend saat files berubah"],
  ]
));

content.push(h2("3.4 Komponen yang Dimodifikasi"));

content.push(makeTable(
  ["Komponen", "Perubahan", "Detail"],
  [
    ["composeSystemPrompt()", "Replace artifact-centric prompt dengan code-editing prompt", "Hapus discovery/philosophy layer, ganti identity charter, inject file map + design tokens sebagai CSS"],
    ["Project creation flow", "Remove skill+design-system selection, auto-detect project type", "pickAndImport jadi satu-satunya cara buat project"],
    ["Chat streaming handler", "Parse <file-edit> selain <artifact>", "file edits \u2192 write to disk \u2192 HMR reload"],
    ["FileWorkspace", "Replace artifact tabs dengan code editor tabs", "FileTree + CodeViewer jadi primary workspace"],
    ["ChatPane", "Show file edit diffs, bukan artifact preview", "Inline diff view setiap file yang di-edit"],
    ["Daemon project routes", "Remove artifact-specific endpoints", "Simplify ke file CRUD + chat + runs"],
    ["DESIGN.md integration", "Auto-sync tokens ke project files", "Bukan hanya inject ke prompt, tapi write ke disk"],
    ["Skill system", "Replace ~200 design skills dengan dev skills", "Hanya skill yang edit source code yang relevan"],
    ["ProjectKind type", "Remove prototype/deck/template, add app-developer types", "tauri-react, nextjs, vite-react, etc."],
    ["Host Bridge", "Add Tauri bridge selain Electron", "window.__od__ untuk Tauri WebView"],
  ]
));

// ========== SECTION 4: FILE EDIT PARSER ==========
content.push(h1("4. Implementasi Detail: <file-edit> Parser"));
content.push(body("Komponen paling kritis dari migrasi ini adalah <file-edit> parser yang menggantikan <artifact> parser. Ini adalah titik di mana output AI ditransformasikan dari standalone HTML menjadi file writes di project user. Parser harus streaming-compatible (bisa parse incrementally saat AI masih generating), error-tolerant (gracefully handle malformed XML), dan real-time (setiap file edit di-write ke disk sesegera mungkin supaya Vite HMR bisa trigger reload)."));

content.push(h2("4.1 Spesifikasi Format"));
content.push(body("AI menghasilkan output dalam format <file-edit> yang mirip dengan <artifact> tapi dengan semantic yang berbeda. Setiap <file-edit> block berisi path relatif ke file yang harus di-write dan content lengkap file tersebut. Parser harus mendukung multiple file edits dalam satu response, dan setiap edit harus di-write secara independen."));

content.push(...codeBlock(
`// AI output format
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
</file-edit>`
));

content.push(h2("4.2 Streaming Parser Implementation"));
content.push(body("Parser harus bekerja secara streaming untuk memberikan feedback secepat mungkin. Saat AI masih menulis content untuk satu file, parser sudah bisa mulai menampilkan progress di UI. Begitu closing tag terdeteksi, file langsung di-write ke disk dan Vite HMR akan trigger reload. Ini memberikan pengalaman real-time yang jauh lebih baik dibanding menunggu seluruh response selesai."));

content.push(...codeBlock(
`export interface FileEdit {
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
      const openMatch = buffer.match(/<file-edit\\s+path="([^"]+)">\\n?/);
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
}`
));

// ========== SECTION 5: SYSTEM PROMPT ==========
content.push(h1("5. App Developer System Prompt"));
content.push(body("System prompt adalah jantung dari perubahan ini. Di Open Design lama, composeSystemPrompt() membangun prompt berlapis-lapis yang menginstruksikan AI sebagai \"expert designer\" yang menghasilkan HTML artifacts. Di versi baru, AI adalah \"expert developer\" yang edit source code in-place. Seluruh identity charter, discovery layer, philosophy layer, dan artifact-specific instructions harus diganti."));

content.push(h2("5.1 Prompt Composition Flow (Baru)"));
content.push(body("Prompt composition yang baru jauh lebih sederhana dan langsung. Alih-alih 27 lapisan prompt yang berorientasi design, kita punya prompt yang fokus pada code editing dengan design system awareness. Urutan injection adalah: (1) Identity \u2014 you are a developer, not a designer, (2) Project context \u2014 file map, tech stack, conventions, (3) Design system \u2014 DESIGN.md body + tokens.css as real CSS, (4) Active skill \u2014 task-specific instructions, (5) Memory \u2014 personal context from past chats."));

content.push(...codeBlock(
`export function composeAppDeveloperPrompt(input: AppDeveloperPromptInput): string {
  const parts: string[] = [];

  // 1. Identity \u2014 you're a developer, not a designer
  parts.push(\`You are an expert React + TypeScript + Tauri developer working
inside an EXISTING codebase. You EDIT source files in-place.
You do NOT generate standalone HTML artifacts.

CRITICAL RULES:
1. Always read existing files before editing them
2. Use <file-edit path="..."> blocks for every file change
3. Follow the design system tokens (var(--bg), var(--accent), etc.)
4. Preserve the existing file structure \u2014 don't create new files
   unless explicitly asked
5. Every edit will trigger Vite HMR \u2014 the user sees changes
   instantly in their running app\`);

  // 2. Project context \u2014 file map + tech stack
  parts.push(\`## Project: \${input.projectName}
Tech Stack: \${input.techStack}
Working Directory: \${input.baseDir}

### File Map
\${input.fileMap}

### Conventions
- React 19 + TypeScript strict mode
- Tailwind CSS v4 with design tokens as CSS custom properties
- Tauri for desktop (src-tauri/)
- File edits only \u2014 no artifacts, no standalone HTML\`);

  // 3. Design system \u2014 REAL CSS, not just prompt text
  parts.push(\`## Design System Tokens

\`\`\`css
\${input.tokensCss}
\`\`\`

### Design System Documentation
\${input.designMd}\`);

  // 4. Active skill instructions
  if (input.skillBody) {
    parts.push(\`## Active Task Instructions
\${input.skillBody}\`);
  }

  // 5. Memory \u2014 personal context
  if (input.memory) {
    parts.push(\`## Context from Previous Conversations
\${input.memory}\`);
  }

  return parts.join('\\n\\n');
}`
));

content.push(h2("5.2 Perbandingan Prompt Lama vs Baru"));

content.push(makeTable(
  ["Aspek", "Prompt Lama (Design Mode)", "Prompt Baru (App Developer)"],
  [
    ["Identity", "\"You are an expert designer\"", "\"You are an expert developer\""],
    ["Output format", "<artifact type=\"text/html\">", "<file-edit path=\"...\">"],
    ["Design tokens", "Inject as text in prompt", "Inject as CSS + write to project files"],
    ["File context", "Pull-layer file index (optional)", "Full file map always included"],
    ["Discovery questions", "Mandatory multi-round discovery", "Read existing code first, ask minimal questions"],
    ["Critique", "Multi-round Critique Theater", "Build + test verification only"],
    ["Preview", "srcdoc iframe", "Vite HMR in running app"],
    ["Skill body", "Design-focused SKILL.md", "Code-editing focused SKILL.md"],
    ["Project kind", "prototype/deck/template/image", "tauri-react/nextjs/vite-react"],
  ]
));

// ========== SECTION 6: DESIGN TOKEN SYNC ==========
content.push(h1("6. Design Token Sync Service"));
content.push(body("Design Token Sync adalah service baru yang menjembatani antara DESIGN.md (design system definition) dan project files. Di sistem lama, tokens.css hanya di-paste ke dalam artifact HTML. Di sistem baru, tokens.css dan tailwind-theme.css di-write ke project files secara otomatis, sehingga bisa di-import oleh React components. Service ini berjalan setiap kali design system berubah, dan hasilnya langsung terlihat di app via Vite HMR."));

content.push(h2("6.1 Sync Flow"));
content.push(...codeBlock(
`DESIGN.md changes
    \u2192
design-token-sync.ts
    \u2192 parse DESIGN.md frontmatter + body
    \u2192 extract color palette, typography, spacing
    \u2192 bind to TOKEN_SCHEMA (60+ CSS custom properties)
    \u2192 render tokens.css (:root { --bg: ...; --fg: ...; })
    \u2192 render tailwind-theme.css (@theme { ... })
    \u2192 write to project:
       src/styles/tokens.css
       src/styles/tailwind-theme.css
    \u2192 Vite HMR detects change
    \u2192 instant visual update in Tauri app!`
));

content.push(h2("6.2 Implementation"));
content.push(...codeBlock(
`export async function syncDesignTokensToProject(
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

  // 3. Write to project files
  await fs.mkdir(stylesDir, { recursive: true });
  await fs.writeFile(
    path.join(stylesDir, 'tokens.css'),
    tokensCss,
    'utf-8'
  );
  await fs.writeFile(
    path.join(stylesDir, 'tailwind-theme.css'),
    tailwindCss,
    'utf-8'
  );

  // 4. Vite HMR will auto-detect and reload
  // No manual notification needed \u2014 chokidar already watching
}`
));

// ========== SECTION 7: VITE HMR PREVIEW ==========
content.push(h1("7. Vite HMR Preview Integration"));
content.push(body("Di sistem lama, preview dilakukan via iframe srcdoc yang sandboxed. Di sistem baru, preview adalah Tauri app yang sudah berjalan dengan Vite dev server. Tidak perlu iframe, tidak perlu srcdoc, tidak perlu sandbox shim. AI edit file \u2192 Vite HMR detect \u2192 browser reload \u2192 user lihat perubahan secara instan. Ini adalah perubahan paling signifikan dalam UX karena menghilangkan seluruh lapisan abstraction antara AI edit dan visual result."));

content.push(h2("7.1 Preview Architecture"));
content.push(...codeBlock(
`// apps/web/src/providers/vite-preview.ts
export function useVitePreview(projectId: string) {
  // 1. Connect ke Vite dev server yang sudah jalan di Tauri
  const previewUrl = 'http://localhost:1420';

  // 2. Listen ke daemon SSE untuk file changes (metadata)
  const { events } = useProjectFileEvents(projectId);

  // 3. File change \u2192 Vite HMR auto-reload (native filesystem watch)
  // Tidak perlu manual reload \u2014 Vite watch filesystem via chokidar

  // 4. Return preview URL untuk di-embed di UI
  return { previewUrl, events };
}

// Di FileWorkspace: replace iframe srcdoc dengan:
<webview src={previewUrl} />
// atau
<iframe src={previewUrl} />
// Karena Vite dev server, HMR works natively`
));

content.push(h2("7.2 Perbandingan Preview Lama vs Baru"));

content.push(makeTable(
  ["Aspek", "Preview Lama", "Preview Baru"],
  [
    ["Rendering", "iframe srcdoc (sandboxed HTML)", "Vite dev server + HMR"],
    ["Reload mechanism", "Manual: replace srcdoc content", "Automatic: Vite filesystem watch"],
    ["React support", "None (plain HTML only)", "Full React + TypeScript"],
    ["State preservation", "None (iframe recreated)", "HMR preserves component state"],
    ["CSS support", "Inline styles only", "Full Tailwind + CSS imports"],
    ["Dev tools", "None", "Full browser DevTools"],
    ["File watching", "chokidar via daemon SSE", "Vite native + daemon SSE for metadata"],
    ["Hot reload speed", "1-3 seconds (full iframe rebuild)", "<100ms (HMR patch)"],
  ]
));

// ========== SECTION 8: SKILL SYSTEM ==========
content.push(h1("8. Skill System Overhaul"));
content.push(body("Seluruh skill system harus di-overhaul. Dari ~200+ design-centric skills (web-prototype, deck-presentation, image-generation, dll.), kita perlu mengganti dengan skills yang berorientasi app development. Ini bukan sekadar mengganti SKILL.md content \u2014 tapi juga mengubah cara skills mengarahkan AI untuk menghasilkan output. Semua skill lama dihapus dan diganti dengan skill baru yang menggunakan <file-edit> sebagai output format."));

content.push(h2("8.1 Skill Baru: App Developer"));
content.push(...codeBlock(
`---
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
   asked \u2014 prefer editing existing files
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
- Never inline entire stylesheets \u2014 reference tokens.css`
));

content.push(h2("8.2 Daftar Skill yang Akan Dibuat"));
content.push(makeTable(
  ["Skill Name", "Scenario", "Description"],
  [
    ["app-developer", "engineering", "General-purpose source code editing in React + Tauri project"],
    ["component-builder", "engineering", "Build new React components with design system tokens"],
    ["page-creator", "engineering", "Create new pages/routes with proper routing setup"],
    ["api-integration", "engineering", "Integrate REST/GraphQL APIs with React Query"],
    ["state-management", "engineering", "Add or modify Zustand stores and state logic"],
    ["tauri-bridge", "engineering", "Implement Tauri IPC commands and frontend bindings"],
    ["style-refactor", "engineering", "Refactor inline styles to use design token system"],
    ["test-writer", "engineering", "Generate unit/integration tests for existing components"],
  ]
));

// ========== SECTION 9: TAURI BRIDGE ==========
content.push(h1("9. Tauri Host Bridge"));
content.push(body("Open Design sudah punya Host Bridge system untuk Electron via window.__od__. Untuk Tauri, kita perlu membuat bridge yang setara tapi menggunakan Tauri IPC sebagai transport. Ini memungkinkan OD web app yang jalan di Tauri WebView untuk mengakses native capabilities seperti folder picker, shell commands, dan screen capture."));

content.push(h2("9.1 Bridge Architecture"));
content.push(...codeBlock(
`// packages/host-tauri/src/index.ts
// Tauri implementation of OpenDesignHostBridge

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
      print: async (html, nonce?, options?) => invoke('print_pdf', { html, nonce, options }),
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
}`
));

content.push(h2("9.2 Tauri Rust Commands"));
content.push(body("Di sisi Rust (src-tauri/), kita perlu mengimplementasikan Tauri commands yang dipanggil oleh bridge. Ini mencakup file dialog, shell integration, screenshot capture, dan update management. Setiap command harus mempertimbangkan security dengan hanya mengizinkan akses ke directory yang sudah di-approve oleh user."));

content.push(...codeBlock(
`// src-tauri/src/commands.rs
#[tauri::command]
async fn import_project(path: String, init: Option<ProjectInit>) -> Result<ProjectImportResult, String> {
    // Validate path exists and is directory
    let path = PathBuf::from(&path);
    if !path.is_dir() {
        return Err("Path is not a directory".into());
    }
    // Auto-detect project type (Tauri, Next.js, Vite, etc.)
    let project_type = detect_project_type(&path);
    // Call daemon API to create project with this baseDir
    let result = daemon_client::create_project(CreateProjectRequest {
        base_dir: path.to_string_lossy().to_string(),
        project_type,
        ..Default::default()
    }).await.map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
async fn open_in_editor(project_id: String) -> Result<(), String> {
    // Open project directory in VS Code or configured editor
    let project = daemon_client::get_project(&project_id).await.map_err(|e| e.to_string())?;
    Command::new("code").arg(&project.base_dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn capture_screenshot(options: Option<CaptureOptions>) -> Result<String, String> {
    // Use Tauri WebView capture or OS screenshot
    // Returns base64 encoded PNG
    todo!("Implement with tauri WebView screenshot API")
}`
));

// ========== SECTION 10: MIGRATION PHASES ==========
content.push(h1("10. Migration Phases"));
content.push(body("Migrasi dilakukan dalam 4 fase yang terstruktur. Setiap fase menghasilkan versi yang bisa dijalankan dan ditest secara independen. Fase 1 adalah yang paling kritis karena membuktikan konsep bahwa <file-edit> parser + Vite HMR bisa bekerja. Fase 2 menghapus semua komponen lama. Fase 3 membangun UI baru. Fase 4 mengintegrasikan Tauri."));

content.push(h2("10.1 Phase 1: Core Engine (Week 1-2)"));
content.push(body("Fase ini membuktikan konsep bahwa sistem baru bisa bekerja. Fokus pada 3 komponen paling kritis: <file-edit> parser, App Developer system prompt, dan Design Token Sync. Di akhir fase ini, AI sudah bisa edit source code in-place dan perubahan terlihat via Vite HMR."));
content.push(makeTable(
  ["Task", "File", "Estimasi", "Priority"],
  [
    ["Buat <file-edit> streaming parser", "apps/web/src/parsers/file-edit-parser.ts", "2 hari", "P0"],
    ["Buat App Developer system prompt", "apps/daemon/src/prompts/app-developer-system.ts", "2 hari", "P0"],
    ["Buat Design Token Sync service", "apps/daemon/src/design-token-sync.ts", "1 hari", "P0"],
    ["Buat App Developer skill SKILL.md", "skills/app-developer/SKILL.md", "1 hari", "P0"],
    ["Integrate <file-edit> ke Chat streaming handler", "apps/web/src/components/ProjectView.tsx", "2 hari", "P0"],
    ["File edit \u2192 disk write pipeline", "apps/daemon/src/project-routes.ts", "1 hari", "P0"],
    ["Test end-to-end: prompt \u2192 file edit \u2192 HMR reload", "Manual test", "1 hari", "P0"],
  ]
));

content.push(h2("10.2 Phase 2: Purge Old System (Week 3)"));
content.push(body("Fase ini menghapus seluruh sistem lama yang sudah tidak diperlukan. Ini termasuk artifact parser, srcdoc builder, iframe pool, semua design-centric skills, critique theater, live artifacts, dan export system. Penghapusan dilakukan secara sistematis per modul untuk meminimalkan breakage."));
content.push(makeTable(
  ["Task", "File/Directory", "Estimasi", "Risk"],
  [
    ["Hapus artifact parser + manifest", "apps/web/src/artifacts/", "0.5 hari", "Low"],
    ["Hapus srcdoc + all bridge injections", "apps/web/src/runtime/srcdoc.ts", "0.5 hari", "Medium"],
    ["Hapus IframeKeepAlivePool", "apps/web/src/components/IframeKeepAlivePool.tsx", "0.5 hari", "Low"],
    ["Hapus HtmlViewer / DeckHtmlViewer / SvgViewer", "apps/web/src/components/FileViewer.tsx", "0.5 hari", "Medium"],
    ["Hapus ~200 design skills", "apps/daemon/skills/ + design-templates/", "0.5 hari", "Low"],
    ["Hapus Critique Theater system", "apps/daemon/src/critique/ + apps/web/src/critique/", "1 hari", "Medium"],
    ["Hapus Live Artifacts system", "apps/daemon/src/live-artifact.ts + contracts", "1 hari", "Medium"],
    ["Hapus export system (PDF, ZIP, React, Vue, Next)", "apps/daemon + apps/web export routes", "1 hari", "Medium"],
    ["Hapus Manual Edit Bridge + Sketch Editor", "apps/web/src/edit-mode/ + SketchEditor", "0.5 hari", "Low"],
    ["Clean up unused API routes", "apps/daemon/src/", "1 hari", "Medium"],
    ["Update types di packages/contracts", "packages/contracts/src/", "1 hari", "High"],
  ]
));

content.push(h2("10.3 Phase 3: New UI (Week 4-5)"));
content.push(body("Fase ini membangun UI baru yang menggantikan semua komponen yang dihapus di Phase 2. FileTree menggantikan DesignFilesPanel, CodeViewer menggantikan HtmlViewer, dan Vite Preview menggantikan iframe srcdoc. Chat interface diupdate untuk menampilkan file edit diffs."));
content.push(makeTable(
  ["Task", "File", "Estimasi", "Priority"],
  [
    ["Buat FileTree component", "apps/web/src/components/FileTree.tsx", "2 hari", "P0"],
    ["Buat CodeViewer dengan syntax highlighting", "apps/web/src/components/CodeViewer.tsx", "3 hari", "P0"],
    ["Buat VitePreview component", "apps/web/src/providers/vite-preview.ts", "2 hari", "P0"],
    ["Update FileWorkspace layout", "apps/web/src/components/FileWorkspace.tsx", "2 hari", "P0"],
    ["Update ChatPane: show file edit diffs", "apps/web/src/components/ChatPane.tsx", "3 hari", "P1"],
    ["Update EntryView: remove skill/template gallery", "apps/web/src/components/EntryView.tsx", "1 hari", "P1"],
    ["Update Settings: remove design-centric options", "apps/web/src/components/SettingsDialog.tsx", "1 hari", "P2"],
    ["Upgrade Terminal integration", "apps/web/src/components/TerminalViewer.tsx", "2 hari", "P1"],
  ]
));

content.push(h2("10.4 Phase 4: Tauri Integration (Week 6)"));
content.push(body("Fase ini mengintegrasikan Tauri Host Bridge supaya OD web app bisa berjalan di dalam Tauri WebView dengan akses ke native capabilities. Ini termasuk folder picker, shell integration, screenshot capture, dan auto-update."));
content.push(makeTable(
  ["Task", "File", "Estimasi", "Priority"],
  [
    ["Buat packages/host-tauri", "packages/host-tauri/", "2 hari", "P0"],
    ["Implement Tauri Rust commands", "src-tauri/src/commands.rs", "2 hari", "P0"],
    ["Install bridge di Tauri WebView", "src-tauri/src/main.rs", "1 hari", "P0"],
    ["Test: folder picker \u2192 import \u2192 edit \u2192 HMR", "Manual test", "1 hari", "P0"],
    ["Implement auto-update via Tauri", "src-tauri/src/updater.rs", "1 hari", "P2"],
    ["End-to-end integration test", "Full flow test", "1 hari", "P0"],
  ]
));

// ========== SECTION 11: DATABASE SCHEMA ==========
content.push(h1("11. Database Schema Changes"));
content.push(body("SQLite schema perlu disederhanakan karena banyak tabel yang hanya relevan untuk artifact/design system. Berikut perubahan yang diperlukan pada skema database daemon."));

content.push(h2("11.1 Tabel yang Dihapus"));
content.push(makeTable(
  ["Tabel", "Alasan"],
  [
    ["deployments", "Tidak ada artifact untuk di-deploy"],
    ["templates", "Diganti project templates (sudah ada di codebase)"],
    ["preview_comments", "Tidak ada iframe preview untuk dikomentari"],
    ["critique_* tables", "Critique Theater dihapus"],
    ["media_tasks*", "Media generation di-scope out dulu"],
    ["live_artifacts (jika ada tabel)", "Live artifacts dihapus"],
  ]
));

content.push(h2("11.2 Tabel yang Dimodifikasi"));
content.push(makeTable(
  ["Tabel", "Perubahan"],
  [
    ["projects", "Tambah kolom: project_type (tauri-react, nextjs, dll), tech_stack, vite_port. Ubah kind dari prototype/deck/template menjadi app-developer types"],
    ["conversations", "Tambah kolom: last_file_edits (JSON array of file paths edited in this conversation)"],
    ["messages", "Ubah produced_files_json: dari artifact manifest menjadi file edit records. Tambah kolom: file_edits_json"],
  ]
));

content.push(h2("11.3 Tabel yang Ditambahkan"));
content.push(makeTable(
  ["Tabel", "Kolom", "Fungsi"],
  [
    ["design_token_sync_log", "id, project_id, tokens_css_hash, synced_at", "Track kapan tokens terakhir di-sync ke project"],
    ["file_edit_history", "id, project_id, conversation_id, message_id, file_path, action (edit/create/delete), diff_json, created_at", "History semua file edits yang dilakukan AI"],
  ]
));

// ========== SECTION 12: API ROUTES ==========
content.push(h1("12. API Routes Changes"));
content.push(body("Daemon API routes perlu disederhanakan dan diarahkan ulang. Banyak route yang hanya relevan untuk artifact/design system harus dihapus, dan route baru untuk file editing dan design token sync harus ditambahkan."));

content.push(h2("12.1 Routes yang Dihapus"));
content.push(makeTable(
  ["Route", "Alasan"],
  [
    ["POST /api/artifacts/save", "Tidak ada artifact system lagi"],
    ["POST /api/artifacts/lint", "Tidak ada artifact HTML untuk di-lint"],
    ["GET /api/projects/:id/preview-url", "Preview via Vite dev server, bukan daemon"],
    ["GET /api/projects/:id/preview/*", "Diganti Vite dev server serving"],
    ["POST /api/projects/:id/export/pdf", "Diganti Tauri print API"],
    ["GET /api/projects/:id/export/*", "Tidak ada artifact export lagi"],
    ["POST /api/projects/:id/finalize/:provider", "Tidak ada design finalization"],
    ["POST /api/projects/:id/handoff", "Sudah di project, tidak perlu handoff"],
    ["All /api/live-artifacts/* routes", "Live artifacts dihapus"],
    ["All /api/deploy/* routes", "Deployment di-scope out"],
    ["All critique routes", "Critique Theater dihapus"],
  ]
));

content.push(h2("12.2 Routes yang Ditambahkan"));
content.push(makeTable(
  ["Route", "Method", "Fungsi"],
  [
    ["/api/projects/:id/sync-tokens", "POST", "Trigger design token sync ke project files"],
    ["/api/projects/:id/file-edits", "GET", "List file edit history untuk project"],
    ["/api/projects/:id/detect-type", "POST", "Auto-detect project type (Tauri, Next.js, dll)"],
    ["/api/projects/:id/file-map", "GET", "Generate file map untuk system prompt injection"],
    ["/api/projects/:id/validate-edit", "POST", "Validate file edit sebelum write (check path, syntax)"],
  ]
));

// ========== SECTION 13: RISK ANALYSIS ==========
content.push(h1("13. Risk Analysis"));
content.push(body("Setiap migrasi besar memiliki risiko. Berikut analisis risiko utama beserta mitigasi yang direncanakan untuk setiap risiko."));

content.push(makeTable(
  ["Risk", "Impact", "Probability", "Mitigation"],
  [
    ["AI tidak mengikuti <file-edit> format", "HIGH - file tidak ter-write", "Medium", "Robust parser dengan fallback ke plain text detection + validation sebelum write"],
    ["Vite HMR tidak detect perubahan dari AI", "HIGH - preview tidak update", "Low", "Vite native chokidar watch sudah handle filesystem changes; test dengan multiple OS"],
    ["Design token sync merusak existing styles", "HIGH - visual regression", "Medium", "Backup existing tokens.css sebelum overwrite; add .bak file; validate via Tailwind v4 @theme parser"],
    ["Breaking change pada daemon API", "MEDIUM - web app crash", "High", "Phase migration: support old + new format selama Phase 2, remove old di Phase 3"],
    ["Tauri WebView limitations", "MEDIUM - beberapa fitur tidak jalan", "Low", "Test early di Phase 4; fallback ke browser mode jika Tauri tidak support"],
    ["Skill prompt terlalu panjang (token limit)", "MEDIUM - AI output truncated", "Medium", "Optimize file map: hanya include top-level structure, lazy-load detail on demand"],
    ["File edit conflicts (AI + user edit same file)", "HIGH - lost changes", "Medium", "File locking during edit; diff-based merge; always read-before-write"],
  ]
));

// ========== SECTION 14: SUCCESS CRITERIA ==========
content.push(h1("14. Success Criteria"));
content.push(body("Migrasi dianggap berhasil jika semua kriteria berikut terpenuhi. Setiap kriteria harus bisa diverifikasi secara objektif dan di-test secara otomatis atau manual."));

content.push(makeTable(
  ["#", "Criteria", "Verification Method"],
  [
    ["1", "AI menghasilkan <file-edit> blocks, bukan <artifact> blocks", "Unit test: parser hanya recognize <file-edit>"],
    ["2", "File edits di-write ke disk di project directory yang benar", "Integration test: check file exists + content matches"],
    ["3", "Vite HMR trigger reload setelah file write", "Manual test: edit file via AI, verify UI updates"],
    ["4", "Design tokens di-sync ke src/styles/tokens.css secara otomatis", "Unit test: compare generated tokens.css with expected output"],
    ["5", "Tidak ada artifact HTML files di project directory", "File system test: no .html artifacts in project"],
    ["6", "Chat interface menampilkan file edit diffs, bukan artifact preview", "Manual test: verify UI shows code changes"],
    ["7", "Tauri app bisa di-import sebagai project via folder picker", "Manual test: pick folder, verify CWD and file access"],
    ["8", "Semua API routes lama yang di-delete return 404", "API test: hit deleted routes, verify 404"],
    ["9", "Tidak ada import error atau runtime crash di web app", "Build test: npm run build succeeds without errors"],
    ["10", "End-to-end flow: prompt \u2192 file edit \u2192 HMR reload \u2192 visual update < 2 seconds", "Performance test: measure time from AI output to visual update"],
  ]
));

// ============ ASSEMBLE DOCUMENT ============
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 26, bold: true, color: c(P.primary) },
      },
    },
  },
  sections: [
    // Section 1: Cover
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: "portrait" },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: allNoBorders,
          rows: [new TableRow({
            height: { value: 16838, rule: "exact" },
            children: [new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              verticalAlign: "top",
              borders: allNoBorders,
              shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
              children: coverChildren,
            })],
          })],
        }),
      ],
    },
    // Section 2: TOC
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "8090A0" })],
          })],
        }),
      },
      children: tocSection,
    },
    // Section 3: Content
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "8090A0" })],
          })],
        }),
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Open Design \u2014 App Developer Migration Plan", size: 18, color: "B0B8C0", font: { ascii: "Calibri" } })],
          })],
        }),
      },
      children: content,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/open-design-app-developer-migration-plan.docx", buf);
  console.log("Document generated successfully!");
});
