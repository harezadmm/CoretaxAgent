# Knowledge Base Coretax AI Agent

Folder ini berisi corpus RAG untuk agent informasi Coretax.

## Lapisan knowledge

- `coretaxpedia/` — 230 FAQ resmi DJP yang diekstrak dari Coretaxpedia.
- `manuals/` — 54 manual, handbook, leaflet, dan panduan PDF resmi.
- `source_files/` — arsip PDF sumber asli.
- `curated/` — 16 dokumen routing dan grounding: peta modul, intent real task, glosarium, troubleshooting, evaluasi, serta batas eskalasi.
- `_meta/source-manifest.json` — manifest URL, hash, ukuran, halaman, dan status sumber resmi.
- `_meta/curated-manifest.json` — manifest hash dan status dokumen curated.

## Prinsip pemakaian

Dokumen `curated/` memperluas pencarian dan menghubungkan pertanyaan ke FAQ/manual resmi. Dokumen tersebut bukan sumber hukum baru. Jawaban agent harus tetap mengambil isi dan URL sumber primer, menyebutkan keterbatasan, dan mengeskalasi kasus personal atau transaksional.

## Pembaruan

```powershell
python tools\sync_official_knowledge.py
python tools\clean_extracted_text.py
python tools\audit_knowledge.py
pytest -q
```

Jumlah chunk dapat berubah setelah sinkronisasi dan deduplikasi. Gunakan `/health` atau `audit_knowledge.py` sebagai sumber angka aktual.
