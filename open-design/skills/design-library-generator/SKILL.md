---
name: design-library-generator
description: |
  Menggenerate kode frontend lengkap (HTML/CSS/JS atau React) menggunakan
  kombinasi elemen dari design library pribadi. Skill ini memanggil selector
  untuk memilih kombinasi terbaik, lalu meracik kode yang benar-benar
  mencerminkan "DNA design" koleksi user — bukan template generik.

  Gunakan ketika: "buat website pakai library saya", "generate frontend dari
  koleksi", "buat landing page dengan design library", "pakai style saya",
  "generate dengan koleksi design saya", "buat komponen dari library",
  "create page using my designs", "generate dari perpustakaan design saya".
license: Apache-2.0
metadata:
  author: design-library-ai
  version: "1.0"
  library-role: generator
skill-tree:
  type: leaf
  parent: twig-design-system

---

# Design Library Generator

## Overview

Skill ini adalah tahap akhir dari pipeline: setelah library terisi dan
kombinasi dipilih oleh selector, generator menghasilkan kode frontend yang
benar-benar mengintegrasikan semua elemen terpilih secara harmonis. Hasilnya
bukan sekadar kode generik — melainkan sesuatu yang unik karena berasal dari
koleksi design yang dikurasi sendiri oleh user.

## Kapan Menggunakan Skill Ini

- User meminta generate halaman web, komponen, atau UI lengkap
- Library sudah memiliki elemen yang approved
- Setelah design-library-selector memilih kombinasi
- User ingin hasil nyata berupa file yang bisa langsung dipakai

## Langkah-Langkah

1. **Panggil Selector**: Jalankan design-library-selector terlebih dahulu
   untuk mendapatkan kombinasi elemen yang tepat berdasarkan konteks project.
   Jika user sudah menentukan elemen mana yang ingin dipakai, skip langkah ini.

2. **Load Kode Elemen**: Ambil kode aktual dari setiap elemen yang terpilih
   dari file JSON library. Ini adalah raw CSS/JS yang akan diintegrasikan.

3. **Rencanakan Struktur**: Tentukan struktur halaman berdasarkan tipe project:
   - Landing page: hero → features → CTA → footer
   - Portfolio: intro → work grid → about → contact
   - Dashboard: sidebar → header → main content area
   - Blog: header → article → sidebar → footer

4. **Integrasikan Elemen**: Tulis kode dengan cara:
   - Design-system sebagai CSS variables (`:root { --color-primary: ...; }`)
   - Animations sebagai keyframes yang dipanggil di class utility
   - Hover-effects diterapkan pada elemen interaktif yang relevan
   - Gradients sebagai background layer, bukan overlay yang menghalangi konten
   - Micro-interactions sebagai enhancement, bukan fokus utama

5. **Polish & Refinement**: Pastikan semua elemen:
   - Tidak saling bertabrakan secara visual
   - Responsive (mobile-first)
   - Accessibility dasar (contrast, focus states)
   - Performa: animasi pakai `will-change`, hindari layout thrashing

6. **Update Used Count**: Setelah generate, increment `used_count` di setiap
   elemen library yang dipakai. Data ini berguna untuk analisis "design apa
   yang paling sering kamu pakai".

7. **Serahkan Output**: Simpan sebagai file HTML tunggal (default) atau
   komponen React jika user meminta. Tampilkan preview ringkas.

## Contoh

### Contoh 1: Landing page fintech dari library

Input: "Generate landing page fintech pakai library saya"

(Setelah selector memilih kombinasi)

Output:
```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fintech Landing</title>
  <style>
    /* === DARI LIBRARY: midnight-blue-warm-gold design-system === */
    :root {
      --color-primary: #0a1628;
      --color-accent: #c9a84c;
      --font-display: 'Playfair Display', serif;
      --font-body: 'DM Sans', sans-serif;
      --space-unit: 8px;
    }

    /* === DARI LIBRARY: dark-mesh-hero gradient === */
    .hero {
      background: radial-gradient(ellipse at 20% 50%, #1a3a6b 0%, #0a1628 60%);
    }

    /* === DARI LIBRARY: smooth-fade-up animation === */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-in {
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* === DARI LIBRARY: subtle-scale-link hover === */
    .nav-link {
      transition: transform 0.2s ease, color 0.2s ease;
    }
    .nav-link:hover {
      transform: translateY(-2px);
      color: var(--color-accent);
    }

    /* ... kode lengkap ... */
  </style>
</head>
<body>
  <!-- struktur HTML lengkap -->
</body>
</html>
```

Library usage updated:
- smooth-fade-up: used_count → 1
- midnight-blue-warm-gold: used_count → 1
- dark-mesh-hero: used_count → 1
- subtle-scale-link: used_count → 1

### Contoh 2: React component dari library

Input: "Buat hero section React pakai library saya, mood editorial"

Output:
```jsx
// Hero.jsx — Generated from design library
// Using: image-reveal-wipe + high-contrast-mono + stagger-text-reveal

const Hero = () => {
  return (
    <section className="hero">
      {/* ... komponen lengkap ... */}
    </section>
  );
};

export default Hero;
```

## Edge Cases & Troubleshooting

- **Library kosong**: Beritahu user dan tawarkan untuk menjalankan curator
  dulu dengan URL referensi, atau generate dengan style default.
- **Kombinasi elemen tidak cukup untuk halaman penuh**: Generate dengan apa
  yang ada, isi sisanya dengan style yang konsisten secara manual.
- **User tidak puas dengan hasil**: Tawari untuk swap satu elemen dari library
  dan regenerate, tanpa harus ubah kombinasi seluruhnya.
- **Elemen dari library konflik satu sama lain di kode nyata**: Resolusi manual
  dengan prioritas design-system sebagai base, elemen lain sebagai layer atas.

## Format Output

File HTML tunggal (default):
- Semua CSS di `<style>` tag dalam `<head>`
- Semua JS di `<script>` sebelum `</body>`
- Komentar menunjukkan asal setiap elemen dari library
- Responsive, mobile-first

File React (jika diminta):
- Satu file `.jsx` per komponen
- CSS-in-JS atau Tailwind + inline style untuk library elements
- Named export + default export

Selalu sertakan komentar: `/* === DARI LIBRARY: [nama-elemen] === */`
agar user tahu persis bagian mana yang berasal dari koleksi mereka.
