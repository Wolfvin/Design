# @open-design/host-tauri

Tauri host bridge for Open Design — provides native desktop capabilities to the
OD web app when it is running inside a Tauri WebView.

## Overview

The Open Design web app discovers native capabilities through the
`window.__od__` host bridge (defined in `@open-design/host`). In the Electron
build, this bridge is injected via a preload script. In the Tauri build, this
package provides the equivalent bridge that uses **Tauri IPC** as transport.

## Installation

```bash
pnpm add @open-design/host-tauri
```

### Peer dependencies

You also need the Tauri v2 packages installed in your app:

```bash
pnpm add @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-shell
```

## Usage

Call `installTauriHostBridge()` **once** at app boot, before the OD web app
reads `window.__od__`:

```ts
import { installTauriHostBridge } from "@open-design/host-tauri";

// Safe to call in any environment — returns false if not in Tauri.
installTauriHostBridge();
```

If the code is not running inside a Tauri WebView the call is a no-op, so the
same entry point can safely be used in builds that target both web and Tauri.

## Bridge Method Mapping

| Bridge Method | Tauri API |
|---|---|
| `shell.openExternal(url)` | `@tauri-apps/plugin-shell` `Shell.open()` |
| `shell.openPath(projectId)` | Tauri `invoke('open_in_editor')` |
| `browser.clearData()` | Tauri `invoke('clear_browser_data')` |
| `capture.page()` | Tauri `invoke('capture_screenshot')` |
| `project.pickAndImport()` | `@tauri-apps/plugin-dialog` `open({ directory: true })` + `invoke('import_project')` |
| `project.pickAndReplaceWorkingDir()` | dialog `open` + `invoke('replace_working_dir')` |
| `pdf.print()` | Tauri `invoke('print_pdf')` |
| `updater.check/download/install/quit/status` | `@tauri-apps/plugin-updater` |
| `pet.setVisible()` | No-op (no pet in Tauri) |
| `client.type` | Always `"desktop"` |

## Detection

```ts
import { isTauriEnvironment, detectTauriPlatform } from "@open-design/host-tauri";

if (isTauriEnvironment()) {
  const platform = detectTauriPlatform(); // "windows" | "macos" | "linux" | "unknown"
  console.log("Running on", platform);
}
```

## Rust Commands

The TypeScript bridge calls Tauri `invoke()` commands that must be implemented
in the Tauri Rust backend (`src-tauri/`). See [rust-commands.md](./rust-commands.md)
for the full command signatures and documentation.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  OD Web App                                     │
│  reads window.__od__ via @open-design/host      │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  @open-design/host-tauri                        │
│  installTauriHostBridge() → window.__od__       │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ bridge.ts │  │commands.ts│  │ detection.ts │  │
│  └─────┬────┘  └─────┬────┘  └──────────────┘  │
└────────┼─────────────┼──────────────────────────┘
         │             │
         ▼             ▼
┌─────────────────────────────────────────────────┐
│  Tauri IPC Layer                                │
│  invoke() / @tauri-apps/plugin-*                │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Rust Backend (src-tauri/)                      │
│  #[tauri::command] handlers                     │
└─────────────────────────────────────────────────┘
```

## Development

```bash
# Type-check
pnpm typecheck

# Build
pnpm build
```
