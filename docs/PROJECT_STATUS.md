# Status Proyek

**Snapshot:** 21 Agustus 2026  
**Branch:** `main`  
**Deploy:** `https://coretax-ai-agent.vercel.app`

## Sudah tersedia

- Corpus resmi DJP di `knowledge/` dengan manifest sumber.
- RAG lexical untuk file Markdown/TXT.
- Policy eskalasi untuk pertanyaan personal, transaksional, dan tanpa sumber.
- FastAPI `/health` dan `/api/ask`.
- Dashboard operator dengan tujuh layar utama.
- Workflow monitor enam area bergaya n8n.
- Test otomatis dan deploy Vercel.

## Belum terhubung ke produksi

- Telephony webhook dan audio stream.
- STT/TTS provider.
- n8n execution API.
- Database session, transcript, dan escalation ticket.
- Dashboard metrics yang berasal dari event produksi.
- Login dan role-based access.

## Urutan kerja yang disarankan

1. Bekukan PRD dan kontrak event.
2. Hubungkan satu endpoint dashboard ke `/api/ask`.
3. Buat dataset evaluasi dan baseline kualitas.
4. Buat workflow n8n minimal tanpa voice.
5. Tambahkan telephony, STT, dan TTS setelah jalur teks stabil.
6. Tambahkan storage, notifikasi, dan observability.

## Bukti penyelesaian

Setiap item roadmap harus memiliki minimal salah satu bukti: test otomatis, screenshot demo, log eksekusi, sample request/response, atau commit yang dapat ditelusuri.
