# Template Laporan Proyek Coretax AI Agent

## Halaman awal

- Judul proyek
- Nama anggota dan pembagian peran
- Mata kuliah/dosen
- Institusi dan tanggal

## Abstrak

> Jelaskan masalah layanan informasi Coretax, solusi agent berbasis RAG, mekanisme eskalasi, hasil pengujian, dan keterbatasan dalam 150–250 kata.

## BAB I — Pendahuluan

### 1.1 Latar belakang

Jelaskan banyaknya prosedur Coretax, kebutuhan sumber resmi, risiko jawaban tanpa sumber, dan beban petugas.

### 1.2 Rumusan masalah

1. Bagaimana memberikan jawaban Coretax berbasis sumber resmi?
2. Bagaimana menangani pertanyaan personal atau tanpa konteks?
3. Bagaimana memantau alur agent dan eskalasi?

### 1.3 Tujuan

Gunakan tujuan pada PRD bagian 3.

### 1.4 Batasan

Gunakan cakupan dan non-goals pada PRD bagian 4.

## BAB II — Landasan teori

- Coretax dan layanan informasi pajak.
- Information retrieval dan RAG.
- LLM dan grounding berbasis sumber.
- Human-in-the-loop dan escalation policy.
- Workflow automation dengan n8n.

## BAB III — Analisis dan perancangan

### 3.1 Kebutuhan pengguna

Masukkan persona dan user story dari PRD.

### 3.2 Arsitektur sistem

Masukkan diagram dari `ARCHITECTURE.md`.

### 3.3 Perancangan knowledge base

Jelaskan corpus, metadata, chunking, retrieval, dan kebijakan sumber.

### 3.4 Perancangan workflow

Jelaskan enam area n8n dan jalur answered/escalated.

### 3.5 Perancangan dashboard

Jelaskan Overview, Escalations, Call History, Knowledge Base, Analytics, Workflow, dan Settings.

## BAB IV — Implementasi

- Struktur repository.
- Endpoint FastAPI.
- Implementasi agent dan policy escalation.
- Implementasi dashboard static.
- Proses sinkronisasi dokumen.
- Integrasi n8n/voice jika sudah tersedia; tandai bagian mock jika belum.

## BAB V — Pengujian dan hasil

### 5.1 Metode

Gunakan `TEST_PLAN.md` dan dataset evaluasi.

### 5.2 Hasil

Laporkan minimal:

- jumlah test lulus;
- jumlah knowledge chunks dan tanggal corpus;
- persentase jawaban dengan sumber benar;
- precision eskalasi untuk pertanyaan personal;
- median/percentile latency;
- screenshot dashboard dan workflow.

### 5.3 Pembahasan

Bahas kasus berhasil, kasus gagal, kualitas sumber, dan trade-off pendekatan lexical/RAG.

## BAB VI — Kesimpulan dan saran

Simpulkan apakah tujuan MVP tercapai. Saran harus mengacu pada roadmap: voice nyata, n8n execution, session store, monitoring, dan evaluasi lanjutan.

## Lampiran

- API request/response.
- Daftar environment variable tanpa nilai secret.
- Dataset pertanyaan evaluasi.
- Test output.
- Screenshot dashboard.
- Manifest sumber knowledge base.
