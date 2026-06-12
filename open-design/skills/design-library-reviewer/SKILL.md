---
name: design-library-reviewer
description: |
  Menampilkan elemen design yang baru diekstrak satu per satu kepada user dan
  meminta keputusan: simpan permanen, hapus, atau edit dulu. Skill ini adalah
  "quality gate" yang memastikan library hanya berisi design yang benar-benar
  diinginkan user, bukan sampah otomatis.

  Gunakan ketika: setelah ekstraksi selesai, user ingin review koleksi,
  "review design", "cek library", "hapus yang tidak perlu", "tanya dulu sebelum
  simpan", "saya mau pilih", "tampilkan hasil ekstraksi", "approve design",
  "filter koleksi", "bersihkan library".
license: Apache-2.0
metadata:
  author: design-library-ai
  version: "1.0"
  library-role: reviewer
skill-tree:
  type: leaf
  parent: twig-design-system

---

# Design Library Reviewer

## Overview

Skill ini menampilkan setiap elemen design yang baru diekstrak secara visual
(dengan preview kode dan metadata), lalu menunggu keputusan user: simpan,
hapus, atau rename. Ini memastikan library benar-benar mencerminkan selera
personal user, bukan sekadar kumpulan otomatis.

## Kapan Menggunakan Skill Ini

- Setelah design-library-curator selesai mengekstrak dari URL
- User ingin membersihkan atau merapikan library yang sudah ada
- User ingin mereview koleksi sebelum digunakan untuk generate design baru
- Dipanggil otomatis jika setting `auto-review: true`

## Langkah-Langkah

1. **Load Antrian Review**: Ambil semua elemen yang belum diapprove dari
   library (status: `pending`). Jika semua sudah approved, tampilkan pesan
   bahwa library sudah bersih.

2. **Tampilkan Satu Per Satu**: Untuk setiap elemen, tampilkan:
   - Nama dan kategori
   - Preview kode (maks 20 baris pertama)
   - Metadata: mood, context, source URL
   - Pertanyaan keputusan yang jelas

3. **Tunggu Keputusan User**: Terima input berikut:
   - `ya` / `simpan` / `y` → set status: `approved`, lanjut ke berikutnya
   - `tidak` / `hapus` / `n` → hapus elemen dari library
   - `rename [nama baru]` → update nama, set status: `approved`
   - `skip` → lewati dulu, review nanti (status tetap `pending`)
   - `selesai` / `stop` → hentikan review, simpan progress

4. **Batch Mode** (opsional): Jika user berkata "approve semua" atau "hapus
   semua [kategori]", jalankan aksi secara batch tanpa konfirmasi satu per satu.

5. **Laporan Akhir**: Setelah review selesai, tampilkan ringkasan:
   jumlah yang disimpan, dihapus, di-skip, dan di-rename.

## Contoh

### Contoh 1: Review setelah ekstraksi

Input: "Review design yang tadi diambil"

Output:
```
📋 Review Library — 10 elemen menunggu keputusan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/10] animations › smooth-fade-up
Mood: elegant, minimal | Speed: medium | Context: hero, any

Preview kode:
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}

Simpan? (ya / tidak / rename [nama] / skip)
```

User: "ya"

```
✅ Disimpan: smooth-fade-up

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2/10] hover-effects › brutal-shake-button
Mood: brutal, experimental | Speed: fast | Context: button

Preview kode:
.btn:hover {
  transform: scale(1.05) rotate(-2deg);
  background: #ff0040;
  ...
}

Simpan? (ya / tidak / rename [nama] / skip)
```

### Contoh 2: Batch delete

Input: "Hapus semua yang mood-nya corporate"

Output:
```
🗑️ Ditemukan 3 elemen dengan mood "corporate":
- professional-hover-link
- clean-corporate-card  
- trustworthy-button-style

Hapus semua 3 elemen ini? (konfirmasi: ya/tidak)
```

## Edge Cases & Troubleshooting

- **Library kosong / semua sudah approved**: Beritahu user bahwa tidak ada
  yang perlu di-review.
- **User tidak merespons format yang dikenali**: Tanya ulang dengan pilihan
  yang lebih jelas.
- **User ingin undo setelah hapus**: Jika masih dalam sesi yang sama,
  kembalikan elemen. Jika sudah berbeda sesi, beritahu bahwa tidak bisa
  di-recover.
- **Banyak elemen (>20)**: Tawari batch review per kategori, bukan satu per
  satu.

## Format Output

Setiap tampilan review mengikuti struktur ini:
```
[nomor/total] kategori › nama-elemen
Mood: ... | Speed: ... | Context: ...
Source: URL

Preview kode:
[maks 20 baris]

Simpan? (ya / tidak / rename [nama] / skip)
```

Laporan akhir:
```
✅ Review selesai
Disimpan : X elemen
Dihapus  : X elemen
Di-skip  : X elemen (akan muncul di review berikutnya)
Di-rename: X elemen
```
