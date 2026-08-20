# Knowledge Base Coretax

Folder ini berisi snapshot sumber resmi DJP yang diambil pada 21 Agustus 2026. File PDF dan HTML asli disimpan untuk audit, sedangkan hasil ekstraksi Markdown digunakan oleh RAG.

Prioritas sumber ketika terdapat perbedaan informasi:

1. FAQ Coretaxpedia dengan tanggal pembaruan terbaru;
2. panduan atau leaflet resmi tahun 2025–2026;
3. Panduan Ringkas Coretax DJP versi 1.0;
4. buku manual Coretax 2024.

Sumber resmi dapat berubah. Jalankan sinkronisasi ulang dan evaluasi jawaban sebelum demonstrasi atau penggunaan lebih lanjut.

## Menambahkan dokumen sendiri

Masukkan hanya dokumen resmi dan terverifikasi dalam format Markdown (`.md`) atau teks (`.txt`).

Saran struktur setiap dokumen:

```markdown
# Judul dokumen

## Topik atau prosedur

Isi yang berasal dari sumber resmi.

## Sumber dan tanggal pembaruan

- URL atau identitas dokumen
- Tanggal terakhir diverifikasi
```

Jangan memasukkan data pribadi wajib pajak, kredensial, token, atau dokumen yang tidak memiliki izin penggunaan.

Manifest sumber tersedia di `_meta/source-manifest.json`. Folder dengan nama berawalan `_` dan file `README.md` tidak dimasukkan ke indeks RAG.
