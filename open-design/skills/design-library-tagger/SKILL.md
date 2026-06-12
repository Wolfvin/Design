---
name: design-library-tagger
description: |
  Menganalisis elemen design yang baru diekstrak, memberi nama yang bermakna,
  menentukan mood, konteks penggunaan, dan tag kompatibilitas. Skill ini adalah
  "kurator cerdas" yang memastikan setiap item di library mudah ditemukan dan
  dikombinasikan dengan tepat.

  Gunakan ketika: elemen baru masuk library, user ingin rename design, user
  ingin retag koleksi, "beri nama design ini", "tag design ini", "kategorikan
  style ini", "analisis design", "nama yang cocok untuk animasi ini",
  "update metadata library".
license: Apache-2.0
metadata:
  author: design-library-ai
  version: "1.0"
  library-role: tagger
skill-tree:
  type: leaf
  parent: twig-design-system

---

# Design Library Tagger

## Overview

Skill ini menganalisis kode CSS/JS dari sebuah elemen design dan secara
otomatis menentukan: nama yang deskriptif, mood, kecepatan (untuk animasi),
konteks terbaik, dan kompatibilitasnya dengan elemen lain di library. Tujuannya
memastikan library mudah dicari dan dikombinasikan secara cerdas.

## Kapan Menggunakan Skill Ini

- Setelah design-library-curator mengekstrak elemen baru
- User ingin memperbaiki atau memperbarui metadata elemen yang sudah ada
- User ingin memahami karakter dari sebuah design sebelum menyimpannya
- Secara otomatis dipanggil oleh skill lain sebelum menyimpan ke library

## Langkah-Langkah

1. **Baca Kode**: Analisis kode CSS/JS dari elemen yang diberikan. Perhatikan
   properti seperti `transition-timing-function`, `transform`, `color`,
   `font-family`, dan `animation-duration`.

2. **Tentukan Nama**: Beri nama yang deskriptif dan mudah diingat menggunakan
   pola: `[karakter]-[aksi/bentuk]-[konteks-opsional]`
   Contoh: `elegant-fade-hero`, `brutal-hover-button`, `soft-bounce-card`

3. **Tentukan Mood**: Pilih 1-3 mood dari daftar ini berdasarkan karakter
   visual dan feel dari elemen:
   - `elegant` — halus, refined, high-end
   - `playful` — fun, bouncy, energetik
   - `brutal` — bold, raw, no-nonsense
   - `minimal` — bersih, whitespace, tersimpel
   - `luxury` — premium, gold, exclusive
   - `editorial` — magazine-style, typographic
   - `futuristic` — sci-fi, neon, tech
   - `organic` — natural, curved, earthly
   - `corporate` — profesional, trustworthy
   - `experimental` — unik, avant-garde, tidak biasa

4. **Tentukan Konteks**: Di mana elemen ini paling cocok digunakan? Pilih dari:
   `hero`, `navbar`, `card`, `button`, `footer`, `landing-page`,
   `portfolio`, `dashboard`, `e-commerce`, `blog`, `any`

5. **Tentukan Kompatibilitas**: Berdasarkan mood dan karakter, daftar elemen
   dari kategori lain yang akan cocok dikombinasikan. Ini adalah kunci untuk
   kombinasi yang harmonis.
   Aturan kompatibilitas:
   - Elemen dengan mood yang sama → selalu compatible
   - Elemen dengan mood berlawanan (contoh: playful + luxury) → catat sebagai
     `clash`, hindari kombinasi kecuali user ingin efek kontras

6. **Update JSON**: Tulis metadata lengkap ke file JSON elemen tersebut.

## Contoh

### Contoh 1: Tagging animasi fade sederhana

Input kode:
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
.element {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

Output metadata:
```json
{
  "name": "smooth-fade-up",
  "mood": ["elegant", "minimal"],
  "speed": "medium",
  "context": ["hero", "content-section", "any"],
  "compatible_with": ["clean-hover-underline", "minimal-color-palette",
                      "editorial-typography"],
  "clash_with": ["heavy-bounce-playful", "neon-glow-futuristic"]
}
```

### Contoh 2: Tagging hover effect yang agresif

Input kode:
```css
.btn:hover {
  transform: scale(1.05) rotate(-2deg);
  background: #ff0040;
  box-shadow: 8px 8px 0px #000;
  transition: all 0.15s steps(3);
}
```

Output metadata:
```json
{
  "name": "brutal-shake-button",
  "mood": ["brutal", "experimental"],
  "speed": "fast",
  "context": ["button", "landing-page", "portfolio"],
  "compatible_with": ["brutalist-grid-layout", "bold-typography-system",
                      "high-contrast-palette"],
  "clash_with": ["elegant-fade-hero", "soft-luxury-gradient"]
}
```

## Edge Cases & Troubleshooting

- **Kode terlalu kompleks untuk satu nama**: Pecah menjadi beberapa elemen
  mandiri sebelum tagging.
- **Mood tidak jelas**: Pilih mood yang paling dominan, maksimal 2 saja.
- **Elemen baru, library kosong**: Biarkan `compatible_with` sebagai array
  kosong, akan diisi saat library bertumbuh.
- **User tidak setuju dengan nama/tag**: Tanyakan preferensi dan update sesuai
  input user.

## Format Output

Metadata lengkap dalam JSON, siap di-merge ke file library:
```json
{
  "name": "string — deskriptif, lowercase-with-hyphens",
  "mood": ["array", "of", "moods"],
  "speed": "fast | medium | slow | null (jika bukan animasi)",
  "context": ["array", "of", "contexts"],
  "compatible_with": ["nama-elemen-lain"],
  "clash_with": ["nama-elemen-yang-tidak-cocok"]
}
```
