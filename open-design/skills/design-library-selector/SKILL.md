---
name: design-library-selector
description: |
  Memilih dan mengkombinasikan elemen design dari library secara cerdas
  berdasarkan konteks, mood, dan kompatibilitas. Skill ini adalah "kurator
  otomatis" yang membaca intent user lalu merakit kombinasi terbaik dari
  koleksi yang tersedia — tidak hanya mengambil satu style, tapi meracik
  seperti seorang designer berpengalaman.

  Gunakan ketika: "buat design untuk", "pilih style dari library", "kombinasikan
  design", "pakai koleksi saya", "buat landing page pakai library", "generate
  dengan style saya", "pilihkan design yang cocok", "rakit design dari koleksi".
license: Apache-2.0
metadata:
  author: design-library-ai
  version: "1.0"
  library-role: selector
skill-tree:
  type: leaf
  parent: twig-design-system

---

# Design Library Selector

## Overview

Skill ini membaca semua elemen yang ada di library, memahami konteks dan
tujuan project dari user, lalu memilih kombinasi yang harmonis dari berbagai
kategori (animations + hover-effects + design-system + gradients, dll).
Hasilnya adalah "resep design" yang siap dipakai untuk generate frontend.

## Kapan Menggunakan Skill Ini

- User meminta generate frontend dan memiliki library yang sudah terisi
- User ingin tahu kombinasi design apa yang cocok untuk project tertentu
- Dipanggil oleh design-library-generator sebelum menulis kode
- User ingin eksplorasi kombinasi baru dari koleksinya

## Langkah-Langkah

1. **Pahami Konteks Project**: Ekstrak informasi dari permintaan user:
   - Tipe website: portfolio, landing page, dashboard, e-commerce, blog, dll
   - Industri/niche: tech, fashion, food, fintech, creative, dll
   - Target audience: profesional, anak muda, luxury buyer, dll
   - Mood yang diinginkan (jika disebutkan)

2. **Load Library**: Baca semua elemen yang ada di library dengan status
   `approved`. Kelompokkan per kategori.

3. **Filter Berdasarkan Konteks**: Dari setiap kategori, saring elemen yang:
   - `context` cocok dengan tipe website
   - `mood` sesuai dengan industri dan audience
   Jika tidak ada yang exact match, pilih yang paling dekat.

4. **Cek Kompatibilitas**: Dari elemen yang tersisa, pastikan semua yang
   dipilih saling compatible. Periksa field `compatible_with` dan `clash_with`.
   Hindari kombinasi yang clash kecuali user secara eksplisit ingin kontras.

5. **Rakit Kombinasi**: Pilih 1 elemen dari setiap kategori yang relevan:
   - 1-2 animations (untuk entrance effects dan scroll)
   - 1 hover-effect (untuk interaktivitas)
   - 1 design-system (typography + color palette)
   - 0-1 gradient (untuk background atau hero)
   - 0-1 micro-interaction (untuk polish)
   - 1-2 components (jika tersedia yang sesuai)

6. **Tampilkan Pilihan**: Presentasikan kombinasi terpilih beserta reasoning
   singkat. Tawari alternatif jika user ingin eksplorasi lain.

## Contoh

### Contoh 1: Landing page untuk startup fintech

Input: "Buat landing page untuk startup fintech, kesan modern dan terpercaya"

Output:
```
🎨 Kombinasi Design untuk: Fintech Landing Page
Mood target: corporate + minimal dengan sentuhan futuristic

Dari library kamu, saya pilih:

animations/
  → smooth-fade-up (elegant, minimal) ✓ cocok untuk entrance hero text

hover-effects/
  → subtle-scale-link (minimal, corporate) ✓ profesional, tidak berlebihan

design-systems/
  → midnight-blue-warm-gold (luxury, corporate) ✓ trustworthy + premium

gradients/
  → dark-mesh-hero (futuristic, minimal) ✓ modern tech feel

micro-interactions/
  → smooth-scroll-indicator (minimal) ✓ polish tanpa distraksi

Semua elemen compatible satu sama lain ✅

Lanjut generate dengan kombinasi ini?
Atau mau saya tunjukkan alternatif lain dari library?
```

### Contoh 2: Portfolio kreatif

Input: "Buat portfolio untuk fotografer, mau yang bold dan tidak biasa"

Output:
```
🎨 Kombinasi Design untuk: Photography Portfolio
Mood target: editorial + experimental

Dari library kamu, saya pilih:

animations/
  → image-reveal-wipe (editorial, dramatic) ✓ cinematic feel untuk foto
  → stagger-text-reveal (editorial) ✓ untuk judul yang impactful

hover-effects/
  → brutal-shake-button (brutal, experimental) ✓ unexpected, memorable

design-systems/
  → high-contrast-mono (editorial, brutal) ✓ foto jadi fokus utama

gradients/
  → (tidak dipilih — akan clash dengan foto sebagai hero)

micro-interactions/
  → cursor-follower (experimental) ✓ immersive experience

⚠️ Catatan: brutal-shake-button dan high-contrast-mono punya tension yang
disengaja — cocok untuk kesan "photographer yang punya karakter kuat".

Lanjut generate?
```

## Edge Cases & Troubleshooting

- **Library kosong atau terlalu sedikit elemen**: Beritahu user kategori apa
  yang masih kosong dan sarankan untuk menambah elemen dulu via curator.
- **Tidak ada elemen yang compatible**: Tampilkan yang paling mendekati dan
  beri tahu user tentang potensi clash.
- **User ingin semua dari satu mood tapi library tidak punya cukup**: Gunakan
  yang ada dan rekomendasikan penambahan di masa depan.
- **User minta override pilihan**: Hormati preferensi user dan gunakan elemen
  yang mereka tentukan sendiri.

## Format Output

```
🎨 Kombinasi Design untuk: [nama project]
Mood target: [mood yang dipilih]

[kategori]/
  → [nama elemen] ([mood]) [reasoning singkat]

[status kompatibilitas]

[pertanyaan lanjutan]
```
