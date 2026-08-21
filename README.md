# Coretax AI Agent

Fondasi awal AI agent untuk membantu menjawab pertanyaan umum mengenai Coretax berdasarkan knowledge base yang disediakan.

## Fokus versi saat ini

- menerima pertanyaan teks melalui `POST /api/ask`;
- mencari konteks dari dokumen `.md` atau `.txt`;
- menyusun jawaban hanya dari konteks yang ditemukan;
- menyertakan sumber dokumen;
- mengeskalasi pertanyaan personal, transaksional, atau yang tidak memiliki sumber memadai;
- menyediakan dashboard operator dengan Overview, Escalations, Knowledge Base, Analytics, Workflow, dan Settings;
- menyediakan visualisasi workflow n8n Coretax Agent.

Voice provider, eksekusi n8n nyata, penyimpanan session, dan data dashboard produksi masih berada pada roadmap P1. Dashboard saat ini merupakan UI operasional dengan sebagian data simulasi.

## Dokumentasi proyek

- [`docs/PRD.md`](docs/PRD.md) — product requirements, scope, user story, dan acceptance criteria.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arsitektur saat ini dan target integrasi.
- [`docs/N8N_WORKFLOW_SPEC.md`](docs/N8N_WORKFLOW_SPEC.md) — spesifikasi node dan jalur workflow n8n.
- [`docs/RAG_KNOWLEDGE_SPEC.md`](docs/RAG_KNOWLEDGE_SPEC.md) — kebijakan corpus, retrieval, dan evaluasi RAG.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — test matrix dan checklist penerimaan.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — tahapan pengerjaan sampai pilot.
- [`docs/REPORT_TEMPLATE.md`](docs/REPORT_TEMPLATE.md) — template laporan akademik.

## Knowledge base resmi

Snapshot awal diambil pada 21 Agustus 2026 dari situs resmi Direktorat Jenderal Pajak. Isinya mencakup:

- 54 PDF panduan, manual, leaflet, dan materi Coretax;
- 230 halaman FAQ Coretaxpedia;
- 3.000+ potongan teks unik setelah deduplikasi;
- manifest sumber berisi URL, hash file, ukuran, jumlah halaman, dan status ekstraksi.

FAQ Coretaxpedia mendapat prioritas ringan dalam pencarian karena umumnya lebih baru daripada buku manual 2024. Jika jawaban tidak memiliki konteks yang memadai atau menyangkut tindakan personal/transaksional, agent melakukan eskalasi.

Struktur utama:

```text
knowledge/
├── coretaxpedia/          # Markdown FAQ terbaru untuk RAG
├── manuals/               # Hasil ekstraksi PDF untuk RAG
├── source_files/          # Arsip PDF dan HTML resmi
└── _meta/source-manifest.json
```

Untuk menyinkronkan ulang materi resmi:

```powershell
python tools\sync_official_knowledge.py
python tools\clean_extracted_text.py
python tools\audit_knowledge.py
```

## Menjalankan proyek

1. Buat virtual environment dan aktifkan.
2. Instal dependensi:

   ```powershell
   pip install -e ".[dev]"
   ```

3. Salin `.env.example` menjadi `.env`, lalu isi `OPENAI_API_KEY` dan `OPENAI_MODEL`.
4. Jalankan API:

   ```powershell
   uvicorn app.main:app --reload
   ```

5. Buka dokumentasi interaktif di `http://127.0.0.1:8000/docs`.

Contoh request:

```json
{
  "question": "Bagaimana cara melakukan aktivasi akun Coretax?"
}
```

## Catatan penting

Dokumen contoh dalam repositori bukan sumber informasi perpajakan. Ganti dengan materi resmi yang telah diverifikasi sebelum melakukan demonstrasi. Agent tidak dirancang untuk mengubah data, menjalankan transaksi, atau memberikan keputusan perpajakan personal.
