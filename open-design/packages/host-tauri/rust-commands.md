# Tauri Rust Commands Reference

This document describes the Rust `#[tauri::command]` functions that must be
implemented in the Tauri app's `src-tauri/` directory. The TypeScript bridge
in `@open-design/host-tauri` calls these commands via `invoke()`.

---

## Command Summary

| Command | TypeScript Caller | Purpose |
|---|---|---|
| `import_project` | `pickAndImportProject()` | Pick folder → import as project |
| `replace_working_dir` | `pickAndReplaceWorkingDir()` | Pick folder → replace project working dir |
| `open_in_editor` | `shellOpenPath()` | Reveal project dir in OS file manager |
| `capture_screenshot` | `captureScreenshot()` | Take a screenshot of the WebView |
| `clear_browser_data` | `clearBrowserData()` | Clear cookies/storage for the WebView |
| `print_pdf` | `printPdf()` | Render HTML to PDF and open/print it |
| `updater_quit_and_install` | `updaterQuitAndInstall()` | Quit app and apply pending update |

---

## Command Signatures

### `import_project`

```rust
#[tauri::command]
async fn import_project(
    path: String,
    init: Option<ProjectInit>,
) -> Result<ProjectImportResult, String>
```

**Behaviour:**

1. Validate that `path` is an existing directory on disk.
2. Create a new project via the Open Design daemon's import API (`POST /api/import/folder`).
3. Return the project identifiers (`projectId`, `conversationId`, `entryFile`).

**Types:**

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInit {
    pub name: Option<String>,
    pub skill_id: Option<String>,
    pub design_system_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(tag = "ok")]
pub enum ProjectImportResult {
    #[serde(rename = "true")]
    Success {
        project_id: String,
        conversation_id: String,
        entry_file: Option<String>,
    },
    // The user cancelled the folder-picker on the JS side before
    // invoking the command, but we keep the variant for robustness.
    // This should not normally be returned by the Rust side.
}

// On error, return `Err(String)` which the JS side maps to
// `{ ok: false, reason: "..." }`.
```

---

### `replace_working_dir`

```rust
#[tauri::command]
async fn replace_working_dir(
    project_id: String,
    path: String,
) -> Result<ReplaceWorkingDirResult, String>
```

**Behaviour:**

1. Validate that `path` is an existing directory.
2. Call the daemon API (`POST /api/projects/:id/working-dir`) to replace the
   project's working directory.
3. Return the new `baseDir` and `entryFile`.

**Types:**

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(tag = "ok")]
pub enum ReplaceWorkingDirResult {
    #[serde(rename = "true")]
    Success {
        base_dir: String,
        entry_file: Option<String>,
    },
}
```

---

### `open_in_editor`

```rust
#[tauri::command]
async fn open_in_editor(project_id: String) -> Result<(), String>
```

**Behaviour:**

1. Look up the project's resolved working directory from the daemon.
2. Open that directory in the OS file manager using
   `opener::open(path)` or `reveal_item_in_manager(path)`.
3. This is the Tauri equivalent of Electron's `shell.openPath()`.

---

### `capture_screenshot`

```rust
#[tauri::command]
async fn capture_screenshot(
    options: Option<serde_json::Value>,
) -> Result<String, String>
```

**Behaviour:**

1. Capture the current WebView content as a PNG image.
2. Encode the PNG as a base64 data-URL string (`data:image/png;base64,...`).
3. If `options.clip` is provided, crop the screenshot to the given rectangle.

**Options shape (from JS):**

```typescript
{
  clip?: { x: number; y: number; width: number; height: number };
}
```

**Implementation notes:**

- Use the `webview2` (Windows), `WKWebView` (macOS), or `webkit2gtk` (Linux)
  screenshot capabilities, or the `tauri-plugin-screenshot` community plugin.
- Return the data-URL string directly; the JS bridge wraps it into
  `OpenDesignHostCaptureResult`.

---

### `clear_browser_data`

```rust
#[tauri::command]
async fn clear_browser_data(
    options: Option<BrowserClearDataOptions>,
) -> Result<(), String>
```

**Behaviour:**

1. Clear WebView data stores according to the provided options.
2. If `options.cookies` is `true`, clear all cookies.
3. If `options.storage` is `true`, clear local/session storage and IndexedDB.

**Types:**

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserClearDataOptions {
    pub cookies: Option<bool>,
    pub storage: Option<bool>,
}
```

---

### `print_pdf`

```rust
#[tauri::command]
async fn print_pdf(
    html: String,
    nonce: Option<String>,
    options: Option<serde_json::Value>,
) -> Result<Vec<u8>, String>
```

**Behaviour:**

1. Render the provided `html` string in a headless WebView or HTML-to-PDF
   engine.
2. Return the raw PDF bytes. The JS bridge treats a successful invocation
   as `{ ok: true }` — the bytes can optionally be written to a temp file
   and opened in the system PDF viewer.
3. The `nonce` parameter can be embedded in the HTML to satisfy CSP
   requirements.

**Options shape (from JS):**

```typescript
{
  deck?: boolean;
}
```

**Implementation notes:**

- On macOS, `WKWebView` natively supports PDF printing via
  `WKWebView.createPDF()`.
- On Windows/Linux, consider using a headless Chromium instance or the
  `print_pdf` crate.

---

### `updater_quit_and_install`

```rust
#[tauri::command]
async fn updater_quit_and_install() -> Result<(), String>
```

**Behaviour:**

1. Trigger the Tauri updater's restart-and-install flow.
2. The app should quit and relaunch from the downloaded update artifact.

**Implementation notes:**

- This command is a thin wrapper around `tauri-plugin-updater`'s
  `Update::install_and_restart()` or equivalent.
- If the updater plugin is not configured, return an error string.

---

## Registration

All commands must be registered in the Tauri builder:

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        import_project,
        replace_working_dir,
        open_in_editor,
        capture_screenshot,
        clear_browser_data,
        print_pdf,
        updater_quit_and_install,
    ])
    // ...
```

## Permissions

In `src-tauri/capabilities/default.json`, grant the WebView permission to call
each command:

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:allow-open",
    "updater:default"
  ]
}
```
