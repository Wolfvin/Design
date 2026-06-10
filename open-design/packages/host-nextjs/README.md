# @open-design/host-nextjs

Browser-based host bridge for Open Design when working with Next.js projects.

Unlike the Tauri bridge which uses native IPC, this bridge delegates to standard Web APIs and the OD daemon REST API for native-like operations (folder picking, file access, screenshots, etc.).

## Installation

```ts
import { installNextjsHostBridge } from "@open-design/host-nextjs";

// Call once at app boot
installNextjsHostBridge("http://localhost:3847");
```

## When to Use

- When OD is running in a browser (not inside Tauri WebView or Electron)
- When working with Next.js projects that run on `localhost:3000`
- When you need web-deployable mode without native desktop runtime

## Capabilities

| Feature | Implementation |
|---------|---------------|
| Shell open | `window.open()` |
| Folder picker | Daemon REST API |
| Screenshots | Daemon capture API |
| PDF printing | Browser `window.print()` |
| Auto-update | Not available (web mode) |
| Browser data | Web Cache API + localStorage |
