# Coretax AI Agent

Fondasi awal AI agent untuk membantu menjawab pertanyaan umum mengenai Coretax berdasarkan knowledge base yang disediakan.

## Fokus versi pertama

- menerima pertanyaan dalam bentuk teks;
- mencari konteks dari dokumen `.md` atau `.txt`;
- menyusun jawaban hanya dari konteks yang ditemukan;
- menyertakan sumber dokumen;
- mengeskalasi pertanyaan personal, transaksional, atau yang tidak memiliki sumber memadai.

Voice agent dan dashboard belum dimasukkan pada tahap ini. Keduanya akan dibangun setelah kualitas jawaban teks dapat diuji.

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
