# 🎨 Design Library Tools — MCP Server

Tools lokal untuk AI Design Library. Bisa connect ke Claude, Cursor, Goose, dan AI agent lainnya via MCP.

## Tools yang Tersedia

| Tool | Fungsi |
|------|--------|
| `fetch_web_design` | Fetch URL → ekstrak CSS, Tailwind, animasi, gradient, deteksi React/Next.js/Framer |
| `generate_from_claude` | Generate design element dari knowledge Claude (tanpa internet) |
| `save_design_element` | Simpan elemen design manual ke library |
| `review_library` | Tampilkan elemen pending untuk di-approve/reject |
| `approve_element` | Approve elemen → masuk library aktif |
| `reject_element` | Hapus elemen dari library |
| `rename_element` | Rename elemen di library |
| `query_library` | Search & filter library |
| `get_element_code` | Ambil kode lengkap elemen (untuk generate frontend) |
| `library_stats` | Statistik library per kategori |

## Setup

```bash
# Install dependencies
npm install

# Run dev (tanpa build)
npm run dev

# Build + run production
npm run build && npm start
```

## Connect ke Claude Desktop

Tambahkan ke `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "design-library": {
      "command": "node",
      "args": ["/path/to/design-tools/dist/index.js"]
    }
  }
}
```

## Connect ke Cursor

Tambahkan ke `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "design-library": {
      "command": "npx",
      "args": ["tsx", "/path/to/design-tools/src/index.ts"]
    }
  }
}
```

## Kategori Library

- `animation` — CSS keyframes & transitions
- `hover-effect` — CSS & Tailwind hover states
- `gradient` — Linear, radial, mesh gradients
- `design-system` — CSS variables, tokens, typography, colors
- `tailwind` — Tailwind class combinations
- `react-component` — React/TypeScript components
- `nextjs-pattern` — Next.js app router patterns
- `framer-motion` — Framer Motion variants & animations
- `micro-interaction` — Scroll reveal, cursor, loading states
- `css` — Pure CSS utilities
- `typescript` — TypeScript types & interfaces

## Mood System

`elegant` `playful` `brutal` `minimal` `luxury` `editorial` `futuristic` `organic` `corporate` `experimental`

## Database

SQLite lokal di `library.db` — otomatis dibuat saat pertama kali dijalankan.
