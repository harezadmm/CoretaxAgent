# Knowledge Base Coretax AI Agent

Folder ini berisi corpus RAG untuk agent informasi Coretax.

## Lapisan knowledge

- `coretaxpedia/` — 230 FAQ resmi DJP yang diekstrak dari Coretaxpedia.
- `manuals/` — 54 manual, handbook, leaflet, dan panduan PDF resmi.
- `source_files/` — arsip PDF sumber asli.
- `curated/` — 16 dokumen routing dan grounding: peta modul, intent real task, glosarium, troubleshooting, evaluasi, serta batas eskalasi.
- `_meta/source-manifest.json` — manifest URL, hash, ukuran, halaman, dan status sumber resmi.
- `_meta/curated-manifest.json` — manifest hash dan status dokumen curated.

`regulations/` berisi detail teks regulasi dari katalog Dokumen Peraturan DJP. Metadata nomor, jenis, tanggal, status katalog, hash halaman, dan status ekstraksi tersedia di `_meta/regulations-manifest.json`.

## Prinsip pemakaian

Dokumen `curated/` memperluas pencarian dan menghubungkan pertanyaan ke FAQ/manual resmi. Dokumen tersebut bukan sumber hukum baru. Jawaban agent harus tetap mengambil isi dan URL sumber primer, menyebutkan keterbatasan, dan mengeskalasi kasus personal atau transaksional.

Regulasi berstatus aktif diprioritaskan dalam lexical retrieval. Regulasi yang hanya memiliki metadata katalog atau ekstraksi di bawah ambang minimum tetap disimpan untuk audit, tetapi tidak dimasukkan ke indeks RAG.

## Pembaruan

```powershell
python tools\sync_official_knowledge.py
python tools\sync_official_regulations.py
python tools\clean_extracted_text.py
python tools\audit_knowledge.py
pytest -q
```

Jumlah chunk dapat berubah setelah sinkronisasi dan deduplikasi. Gunakan `/health` atau `audit_knowledge.py` sebagai sumber angka aktual.
