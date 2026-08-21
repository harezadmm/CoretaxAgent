# PRD — Coretax AI Agent

**Versi:** 0.1 (draft implementasi)  
**Status:** MVP teks + dashboard monitor; voice/n8n masih tahap integrasi  
**Pemilik:** Tim Coretax Agent  
**Tanggal:** 21 Agustus 2026

## 1. Ringkasan produk

Coretax AI Agent adalah layanan bantuan informasi Coretax berbasis knowledge base resmi DJP. Pengguna mengirim pertanyaan, sistem mencari konteks yang relevan, lalu menyusun jawaban dengan sumber. Pertanyaan yang membutuhkan data personal, transaksi, keputusan perpajakan, atau tidak memiliki sumber memadai harus diteruskan ke petugas.

Produk akhir memiliki tiga permukaan:

1. **API agent** untuk pertanyaan dan jawaban berbasis RAG.
2. **Workflow n8n** untuk orkestrasi voice, pencatatan, eskalasi, dan sinkronisasi knowledge base.
3. **Dashboard operator** untuk memantau panggilan, workflow, knowledge base, dan antrean eskalasi.

## 2. Masalah yang ingin diselesaikan

- Pengguna kesulitan menemukan prosedur Coretax yang tepat.
- Pertanyaan berulang membebani petugas layanan.
- Jawaban dari sumber tidak resmi berisiko keliru atau kedaluwarsa.
- Kasus personal dan transaksional tidak boleh dijawab otomatis.
- Belum ada alur terukur dari pertanyaan masuk sampai eskalasi dan evaluasi.

## 3. Tujuan

### Tujuan utama

Menyediakan bantuan informasi Coretax yang cepat, bersumber, dapat diaudit, dan aman dengan tetap menyediakan handover kepada manusia.

### Sasaran MVP

- Menjawab pertanyaan umum dari knowledge base resmi.
- Menampilkan sumber dokumen pada setiap jawaban.
- Mengeskalasi pertanyaan berisiko atau tanpa konteks memadai.
- Menyediakan dashboard operasional dan visualisasi workflow n8n.

## 4. Di luar cakupan

Agent tidak boleh:

- meminta atau menyimpan password, OTP, passphrase, NIK, atau data rahasia;
- membuka, mengubah, membayar, atau melaporkan data wajib pajak;
- memberikan keputusan atau perhitungan pajak personal;
- mengaku sebagai petugas manusia;
- menjawab tanpa sumber resmi yang cukup.

## 5. Pengguna dan kebutuhan

| Pengguna | Kebutuhan |
|---|---|
| Wajib pajak/pengguna umum | Mendapatkan prosedur Coretax yang mudah dipahami dan memiliki sumber. |
| Petugas layanan | Melihat kasus yang perlu ditangani, alasan eskalasi, dan riwayat percakapan. |
| Admin knowledge base | Memastikan dokumen resmi, status sumber, dan pembaruan corpus terpantau. |
| Pengembang/operator | Memantau kesehatan API, workflow, latency, dan kegagalan integrasi. |

## 6. User stories prioritas

- Sebagai pengguna, saya ingin bertanya “Bagaimana cara aktivasi akun?” dan memperoleh langkah yang bersumber.
- Sebagai pengguna, saya ingin mengetahui dokumen rujukan jawaban agar dapat memverifikasinya.
- Sebagai pengguna, saya ingin diarahkan ke petugas ketika pertanyaan menyangkut data pribadi atau transaksi.
- Sebagai petugas, saya ingin melihat antrean eskalasi beserta ringkasan dan alasan eskalasinya.
- Sebagai admin, saya ingin menyinkronkan dokumen resmi tanpa mengubah kode agent.
- Sebagai operator, saya ingin melihat node workflow yang gagal dan waktu eksekusinya.

## 7. Ruang lingkup fitur

### P0 — wajib untuk demo MVP

- `POST /api/ask` untuk pertanyaan teks.
- Retrieval dari `knowledge/coretaxpedia` dan `knowledge/manuals`.
- Jawaban dengan daftar sumber.
- Deteksi pertanyaan personal/transaksional dan eskalasi.
- `GET /health`.
- Dashboard: Overview, Live Calls (mock), Escalations, Call History, Knowledge Base, Analytics, Workflow, Settings.
- Workflow n8n reference view dengan enam area: Trigger & Input, Voice Processing, AI Understanding, Decision & Escalation, Knowledge Base, Monitoring & Logging.

### P1 — integrasi berikutnya

- Webhook telephony dan audio call.
- Speech-to-Text dan Text-to-Speech.
- Eksekusi n8n nyata dengan idempotency dan retry.
- Penyimpanan session, transcript, dan escalation ticket.
- Tombol dashboard untuk membuka detail eksekusi.

### P2 — pengembangan lanjutan

- Handoff live ke petugas.
- Notifikasi email/Slack.
- Pengukuran kualitas retrieval dan containment rate.
- Sinkronisasi sumber resmi terjadwal.
- Role-based access dan audit log operator.

## 8. Persyaratan fungsional

| ID | Persyaratan | Prioritas | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | Agent menerima pertanyaan 3–1.000 karakter. | P0 | Request valid menghasilkan respons `answered` atau `escalated`. |
| FR-02 | Agent mencari maksimal empat konteks teratas. | P0 | Sumber yang dipakai dikembalikan pada response. |
| FR-03 | Agent menolak jawaban tanpa konteks memadai. | P0 | Status menjadi `escalated` dengan alasan yang jelas. |
| FR-04 | Agent mengeskalasi personal/transaksional. | P0 | Pertanyaan tentang NIK, pembayaran, perubahan data, atau keputusan personal tidak dijawab langsung. |
| FR-05 | Dashboard menampilkan status kesehatan dan jumlah knowledge chunks. | P0 | Nilai berasal dari `/health`, bukan angka hard-coded untuk status API. |
| FR-06 | Dashboard menampilkan workflow sesuai desain n8n. | P0 | Enam area, node, port, ikon, cabang true/false, dan legenda terlihat tanpa crop pada breakpoint yang didukung. |
| FR-07 | Workflow memiliki jalur sukses dan eskalasi. | P1 | Node jawaban dan node handover dapat dibedakan. |
| FR-08 | Knowledge base dapat disinkronkan dari sumber resmi. | P1 | Manifest, hash, dan hasil audit ikut diperbarui. |
| FR-09 | Setiap eskalasi memiliki ringkasan, alasan, timestamp, dan status. | P1 | Petugas dapat menandai kasus sebagai ditangani. |
| FR-10 | Semua integrasi eksternal memiliki timeout dan retry terbatas. | P1 | Kegagalan tidak membuat workflow menggantung tanpa status. |

## 9. Persyaratan non-fungsional

- **Keamanan:** rahasia hanya dari environment variable; jangan commit `.env` atau token.
- **Privasi:** minimalkan data personal; masking nomor telepon dan identifier pada dashboard demo.
- **Keterlacakan:** jawaban menyertakan sumber dan versi corpus.
- **Ketersediaan:** endpoint health dapat dipanggil tanpa API key.
- **Kinerja target P1:** median jawaban teks < 3 detik pada corpus lokal; node voice memiliki batas waktu per langkah.
- **Kualitas:** target awal ≥ 80% jawaban evaluasi memiliki sumber yang benar; 100% kasus personal masuk eskalasi.
- **Aksesibilitas:** tombol dashboard memiliki label yang dapat dibaca dan status tidak hanya dibedakan melalui warna.

## 10. Kontrak data inti

### Request

```json
{ "question": "Bagaimana cara aktivasi akun Coretax?" }
```

### Response berhasil

```json
{
  "status": "answered",
  "answer": "...",
  "sources": [{"document":"...","section":"...","score":0.82,"url":"...","source_type":"official"}],
  "escalation_reason": null
}
```

### Response eskalasi

```json
{
  "status": "escalated",
  "answer": "Pertanyaan ini perlu ditangani petugas...",
  "sources": [],
  "escalation_reason": "Pertanyaan menyangkut data atau tindakan personal."
}
```

## 11. Indikator keberhasilan

- Pengguna dapat memahami jawaban tanpa membuka banyak dokumen.
- Sumber jawaban selalu dapat dilacak.
- Pertanyaan berisiko tidak lolos sebagai jawaban otomatis.
- Petugas dapat menemukan dan memproses eskalasi.
- Workflow dapat dipantau dari trigger hingga outcome.

## 12. Keputusan yang masih harus ditetapkan

- Provider telephony, STT, dan TTS untuk P1.
- Apakah n8n dijalankan self-hosted atau managed.
- Database session/ticket yang dipakai di luar corpus file.
- Kanal notifikasi petugas.
- Dataset pertanyaan evaluasi dan target kualitas final.
