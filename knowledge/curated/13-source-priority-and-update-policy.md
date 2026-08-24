---
title: "Kebijakan Prioritas Sumber dan Pembaruan Corpus"
source_url: "https://www.pajak.go.id/coretaxpedia/"
source_type: "curated_official_synthesis"
published_at: "2026-08-24"
retrieved_at: "2026-08-24"
document_hash: "sha256:97c6b97f7f83afac36a7587b5d3050b936ab524f3023ee023d2761aa128c53ec"
status: "active_review"
time_sensitivity: "high"
---

# Kebijakan Prioritas Sumber dan Pembaruan Corpus

## Struktur corpus

- `knowledge/coretaxpedia/` — FAQ resmi DJP yang dipotong menjadi dokumen Markdown.
- `knowledge/manuals/` — teks hasil ekstraksi manual, panduan, leaflet, dan handbook PDF resmi.
- `knowledge/source_files/` — arsip PDF sumber asli.
- `knowledge/curated/` — peta intent, ringkasan alur, glossary, dan aturan agent yang menghubungkan pertanyaan real task dengan sumber resmi.
- `knowledge/_meta/source-manifest.json` — URL, hash, ukuran, halaman, status, dan file RAG sumber.

## Aturan retrieval

1. Ambil FAQ spesifik gejala sebelum manual yang sangat umum.
2. Gunakan manual jika pertanyaan meminta alur lengkap, jenis wajib pajak khusus, atau detail yang tidak ada pada FAQ.
3. Gunakan curated map untuk memperluas parafrasa dan menggabungkan modul; jawaban final tetap harus mengambil sumber primer.
4. Jangan menganggap file curated sebagai sumber hukum baru. Ia adalah peta navigasi terhadap sumber resmi.
5. Jika artikel dan manual bertentangan, sebutkan konflik dan eskalasi.

## Pembaruan

Jalankan dari root project:

```powershell
python tools\sync_official_knowledge.py
python tools\clean_extracted_text.py
python tools\audit_knowledge.py
pytest -q
```

Tinjau `source-manifest.json` sebelum menerima perubahan. Periksa jumlah sumber, status `error`/`warning`, hash, halaman kosong, karakter rusak, dan sample retrieval.

## Time-sensitive knowledge

FAQ Coretaxpedia dapat berubah mengikuti penyempurnaan sistem dan ketentuan terbaru. Informasi seperti kanal layanan, status gangguan, batas waktu, masa aktif billing, dan prosedur UI harus disertai `retrieved_at` dan diverifikasi ulang sebelum disebut sebagai kondisi saat ini.

## Sumber resmi

- [Coretax DJP](https://www.pajak.go.id/coretax)
- [Coretaxpedia](https://www.pajak.go.id/coretaxpedia/)
- [Kontak DJP](https://pajak.go.id/form/contact)
- [Implementasi Sistem Inti Administrasi Perpajakan](https://www.pajak.go.id/id/peraturan/implementasi-sistem-inti-administrasi-perpajakan)
