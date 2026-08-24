# Coretax AI Agent

Fondasi awal AI agent untuk membantu menjawab pertanyaan umum mengenai Coretax berdasarkan knowledge base yang disediakan.

## Fokus versi saat ini

- menerima pertanyaan teks melalui `POST /api/ask`;
- mencari konteks dari dokumen `.md` atau `.txt`;
- menyusun jawaban hanya dari konteks yang ditemukan;
- menyertakan sumber dokumen;
- mengeskalasi pertanyaan personal, transaksional, atau yang tidak memiliki sumber memadai;
- menyediakan dashboard operator dengan Overview, Escalations, Knowledge Base, Analytics, Virtual Office, dan Settings;
- menyediakan Virtual Office: visualisasi pixel-art real-time lantai call center — meja agent AI menjawab panggilan, kasus yang tidak bisa dijawab diantar ke inbox eskalasi, dan petugas menindaklanjutinya pada jam kerja.

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

Snapshot diperbarui pada 24 Agustus 2026 dari situs resmi Direktorat Jenderal Pajak. Isinya mencakup:

- 54 PDF panduan, manual, leaflet, dan materi Coretax;
- 230 halaman FAQ Coretaxpedia;
- 6.266 halaman detail regulasi resmi DJP dari katalog peraturan, termasuk PMK, PER, keputusan, dan regulasi historis;
- 35.000+ potongan teks unik setelah deduplikasi;
- manifest terpisah untuk corpus Coretax dan katalog regulasi, berisi URL, hash, tanggal, status hukum katalog, serta status ekstraksi.

FAQ Coretaxpedia mendapat prioritas ringan karena umumnya lebih baru daripada buku manual 2024. Regulasi yang berstatus aktif mendapat prioritas lebih tinggi daripada regulasi yang tidak aktif atau dicabut. Dokumen regulasi yang hanya berisi metadata ditandai `warning` dan tidak dimasukkan ke retrieval. Jika jawaban tidak memiliki konteks yang memadai atau menyangkut tindakan personal/transaksional, agent melakukan eskalasi.

Struktur utama:

```text
knowledge/
├── coretaxpedia/          # Markdown FAQ terbaru untuk RAG
├── manuals/               # Hasil ekstraksi PDF untuk RAG
├── curated/               # Routing intent, glosarium, troubleshooting, dan guardrails
├── source_files/          # Arsip PDF dan HTML resmi
└── _meta/                 # Manifest sumber dan curated layer
```

Regulasi detail hasil sinkronisasi disimpan di `knowledge/regulations/` dan metadata katalog di `knowledge/_meta/regulations-manifest.json`.

Untuk menyinkronkan ulang materi resmi:

```powershell
python tools\sync_official_knowledge.py
python tools\sync_official_regulations.py
python tools\clean_extracted_text.py
python tools\audit_knowledge.py
```

## Virtual Office

View **Virtual Office** menggantikan diagram workflow n8n statis dengan visualisasi
lantai call center yang berjalan real-time di browser. Delapan belas meja agent AI
menerima panggilan, mendengarkan, mencari di knowledge base, lalu menjawab; pada
puncak pagi sekitar 14 dari 18 meja terpakai bersamaan. Sekitar 7% panggilan tidak
bisa diselesaikan AI; agent berdiri, mengantar kasusnya ke inbox eskalasi, dan kembali
ke mejanya. Di luar jam kerja kasus menumpuk di inbox — enam petugas datang pukul
08:00 pada hari kerja dan mengosongkannya.

Jika view dibuka di luar jam kerja asli (malam atau akhir pekan), jam simulasi dimulai
pada pukul 09:30 hari kerja berikutnya supaya kantor langsung terlihat ramai, bukan
separuh mati. HUD menandainya dengan "jam simulasi · di luar jam kerja asli" agar
jamnya tidak disalahartikan sebagai waktu sungguhan.

Semua data bersifat simulasi di sisi klien (tidak ada endpoint baru). Kontrol kecepatan
1×–300× ada di toolbar untuk mempercepat pergantian shift; klik meja mana pun untuk
melihat panggilan atau kasus yang sedang ditangani; tombol **Edit layout** membuka palet
sprite untuk menata ulang perabot dan lantai, tersimpan otomatis di `localStorage`.

```text
app/static/office/          # tilemap, simulasi, renderer, panel, editor (ES module, tanpa build step)
app/static/assets/office/   # sprite pixel-art (lihat ATTRIBUTION.md — pixel-agents, MIT)
tests/js/                   # test untuk logika murni tilemap + simulasi
```

Sinkronkan ulang sprite dan bangun ulang `catalog.json`:

```powershell
python tools\sync_office_assets.py
```

Jalankan test JavaScript (butuh Node 18+, tanpa dependensi tambahan):

```powershell
node --test "tests/js/*.test.js"
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
