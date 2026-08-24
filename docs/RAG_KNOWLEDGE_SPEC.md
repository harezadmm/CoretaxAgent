# Spesifikasi Knowledge Base dan RAG

## 1. Corpus saat ini

- `knowledge/regulations/` berisi detail teks regulasi resmi dari katalog Dokumen Peraturan DJP.
- `knowledge/_meta/regulations-manifest.json` berisi URL detail, nomor, jenis, tanggal, status katalog, hash, dan status ekstraksi regulasi.

Snapshot knowledge base berasal dari materi resmi DJP yang disimpan di repository:

- `knowledge/coretaxpedia/` — FAQ dan artikel bantuan.
- `knowledge/manuals/` — hasil ekstraksi manual, panduan, dan leaflet.
- `knowledge/curated/` — peta intent, glosarium, troubleshooting, evaluasi, dan aturan grounding yang merutekan pertanyaan ke sumber primer.
- `knowledge/source_files/` — arsip sumber asli.
- `knowledge/_meta/source-manifest.json` — URL, hash, ukuran, halaman, dan status ekstraksi.

Health check terakhir setelah penambahan katalog regulasi menunjukkan **lebih dari 35.000 knowledge chunks**. Angka ini harus dibaca dari `/health`, bukan ditulis permanen dalam laporan sebagai angka yang tidak berubah.

## 2. Metadata minimum setiap dokumen

```yaml
title: "Panduan Aktivasi Akun Coretax"
source_url: "https://www.pajak.go.id/..."
source_type: "official"
published_at: "2025-01-01"
retrieved_at: "2026-08-21"
document_hash: "sha256:..."
validity_status: "Aktif"
extraction_status: "ok"
```

## 3. Kebijakan sumber

- Sumber resmi DJP mendapat prioritas tertinggi.
- Regulasi resmi berstatus aktif mendapat prioritas di atas regulasi historis atau yang dicabut.
- Dokumen `curated/` adalah lapisan routing/sintesis internal; bukan sumber hukum baru dan tidak boleh mengalahkan FAQ/manual primer ketika menjawab.
- Jika ada konflik, agent tidak memilih secara spekulatif; agent menyebutkan keterbatasan dan mengeskalasi.
- Jawaban harus menyertakan judul dokumen/section dan URL jika tersedia.
- Artikel yang kedaluwarsa harus diberi status review atau dikeluarkan dari retrieval.
- Dokumen yang hanya berisi gambar tanpa teks tidak boleh dianggap berhasil terindeks.
- Regulasi dengan ekstraksi di bawah ambang minimum disimpan untuk audit, tetapi dikeluarkan dari retrieval agar metadata katalog tidak menjadi jawaban semu.

## 4. Query yang wajib dieskalasi

- status pembayaran, saldo, atau data akun seseorang;
- permintaan mengubah profil, NPWP, role, rekening, atau transaksi;
- permintaan mengirim OTP, password, NIK, passphrase, atau file rahasia;
- keputusan “berapa pajak saya” tanpa data dan otorisasi yang tepat;
- pertanyaan di luar corpus yang tidak memperoleh skor retrieval minimum.

## 5. Proses pembaruan

```powershell
python tools\sync_official_knowledge.py
python tools\sync_official_regulations.py
python tools\clean_extracted_text.py
python tools\audit_knowledge.py
pytest -q
```

Sebelum merge hasil sinkronisasi:

1. Tinjau perubahan manifest.
2. Pastikan URL dan hash tercatat.
3. Cek dokumen gagal ekstraksi.
4. Jalankan pertanyaan regresi.
5. Catat tanggal corpus pada changelog.

## 6. Dataset evaluasi minimum

Buat file internal `tests/fixtures/eval_questions.jsonl` berisi minimal:

- 20 pertanyaan aktivasi/login;
- 20 pendaftaran/perubahan data;
- 20 billing/pembayaran/deposit;
- 20 faktur/bukti potong/SPT;
- 20 pertanyaan personal atau berbahaya yang harus dieskalasi.

Metrik yang dicatat: retrieval hit@k, source correctness, answer groundedness, escalation precision, dan latency.
