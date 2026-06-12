---
name: design-library-curator
description: |
  Mengambil design dari URL website dan mengekstrak elemen-elemen desain
  secara terpisah ke dalam library pribadi AI. Ekstrak animasi, hover effects,
  color palettes, typography, layout, gradients, dan micro-interactions sebagai
  komponen mandiri yang bisa dikombinasikan nanti.

  Gunakan ketika user mengatakan: "ambil design dari", "ekstrak style dari",
  "simpan design ini", "fetch website ini", "masukkan ke library", "tambah ke
  koleksi", "save design", "input web design", "ambil animasi dari URL",
  "kumpulkan style dari situs ini".
license: Apache-2.0
metadata:
  author: design-library-ai
  version: "1.0"
  library-role: curator
skill-tree:
  type: leaf
  parent: twig-design-system

---

# Design Library Curator

## Overview

Skill ini mengambil sebuah URL, mengekstrak semua elemen desain yang ada,
memisahkannya ke dalam kategori (animations, hover-effects, design-systems,
components, gradients, micro-interactions), lalu menyimpannya ke library
dalam format JSON yang terstruktur. Setiap elemen disimpan mandiri agar bisa
dikombinasikan secara bebas di masa depan.

## Kapan Menggunakan Skill Ini

- User memberikan URL dan meminta untuk mengambil atau menyimpan designnya
- User ingin menambah referensi design baru ke koleksi library
- User menemukan website bagus dan ingin elemen designnya disimpan
- User ingin AI mempelajari gaya visual dari sebuah website

## Langkah-Langkah

1. **Fetch URL**: Ambil konten HTML, CSS, dan JavaScript dari URL yang
   diberikan. Prioritaskan file CSS inline, stylesheet eksternal, dan style
   tags. Tujuannya adalah mendapatkan semua properti visual yang digunakan.

2. **Parse & Kategorisasi**: Pisahkan elemen design ke dalam 6 kategori:
   - `animations` — keyframes, transition, CSS animation properties
   - `hover-effects` — pseudo-class :hover, :focus, transform on interaction
   - `design-systems` — typography (font-family, size scale), color palette,
     spacing system, border-radius tokens
   - `components` — card, button, navbar, hero, footer patterns
   - `gradients` — linear-gradient, radial-gradient, mesh gradient, background
   - `micro-interactions` — scroll behavior, click feedback, loading states

3. **Ekstrak Kode Bersih**: Untuk setiap elemen yang ditemukan, ekstrak hanya
   kode CSS/JS yang relevan. Hapus selector yang terlalu spesifik dan buat
   menjadi reusable. Contoh: ubah `.hero-section h1` menjadi `.text-display`.

4. **Buat Metadata**: Untuk setiap elemen, catat:
   - `source_url` — asal URL
   - `extracted_at` — timestamp
   - `mood` — (pilih: elegant, playful, brutal, minimal, luxury, editorial,
     futuristic, organic, corporate, experimental)
   - `speed` — (untuk animasi: fast/medium/slow)
   - `context` — di mana elemen ini cocok digunakan

5. **Simpan ke Library**: Tulis hasil ke file JSON di folder library sesuai
   kategori. Format penyimpanan ada di seksi Format Output.

6. **Laporan Hasil**: Tampilkan ringkasan apa saja yang berhasil diekstrak dan
   disimpan. Sebutkan jumlah per kategori.

## Contoh

### Contoh 1: Mengambil design dari website portfolio

Input: "Ambil design dari https://example-portfolio.com dan simpan ke library"

Output:
```
✅ Berhasil mengekstrak dari https://example-portfolio.com

📁 Yang disimpan ke library:
  animations/       → 3 elemen (fade-in-up, stagger-reveal, scroll-parallax)
  hover-effects/    → 2 elemen (magnetic-button, text-underline-slide)
  design-systems/   → 1 elemen (palette: midnight-blue + warm-gold)
  components/       → 2 elemen (project-card, minimal-navbar)
  gradients/        → 1 elemen (dark-mesh-hero)
  micro-interactions/ → 1 elemen (smooth-scroll-indicator)

Total: 10 elemen baru ditambahkan ke library.
Mau saya review satu per satu sebelum disimpan permanen?
```

### Contoh 2: Hanya mengambil animasi saja

Input: "Dari https://awwwards-site.com ambil animasinya saja"

Output:
```
✅ Fokus ekstraksi: animations

Ditemukan 5 animasi:
1. hero-text-split     | mood: dramatic | speed: slow
2. image-reveal-wipe   | mood: editorial | speed: medium
3. counter-increment   | mood: corporate | speed: fast
4. floating-element    | mood: playful | speed: slow
5. page-transition-fade| mood: minimal | speed: medium

Disimpan ke: library/animations/
```

## Edge Cases & Troubleshooting

- **CSS tidak ter-load (JavaScript-heavy site)**: Catat bahwa ekstraksi mungkin
  tidak lengkap, simpan apa yang tersedia, dan informasikan ke user.
- **URL tidak bisa diakses**: Beritahu user dan minta URL alternatif atau
  minta user paste kode HTML/CSS langsung.
- **Elemen sangat spesifik/tidak reusable**: Skip atau generalisasi selector
  sebelum menyimpan.
- **Library belum ada**: Buat struktur folder library secara otomatis.

## Format Output

File disimpan di `library/` dengan struktur:

```
library/
├── animations/
│   └── [nama].json
├── hover-effects/
│   └── [nama].json
├── design-systems/
│   └── [nama].json
├── components/
│   └── [nama].json
├── gradients/
│   └── [nama].json
└── micro-interactions/
    └── [nama].json
```

Format setiap file JSON:
```json
{
  "id": "fade-in-up-001",
  "name": "Fade In Up",
  "category": "animations",
  "code": "/* CSS code di sini */",
  "mood": ["elegant", "minimal"],
  "speed": "medium",
  "context": ["hero", "content-section"],
  "source_url": "https://...",
  "extracted_at": "2026-03-10",
  "used_count": 0,
  "compatible_with": [],
  "rating": null
}
```
