# Spesifikasi Workflow n8n Coretax Agent

Dokumen ini menjadi acuan implementasi workflow n8n dan tampilan Workflow Monitor pada dashboard.

## 1. Jalur utama real-time

### 1. Trigger & Input

1. **Incoming Call** — Webhook telephony menerima event.
2. **Twilio** — Mengambil metadata dan media call.
3. **Call Session Init** — Membuat `session_id`, timestamp, dan status `received`.
4. **Extract Caller Info & Metadata** — Sanitasi nomor, channel, dan correlation ID.

### 2. Voice Processing

1. Download audio dari telephony provider.
2. Speech-to-Text (Whisper/provider yang disepakati).
3. Text normalization dan pembersihan.
4. Deteksi Bahasa Indonesia.
5. Sanitasi `user_query` sebelum masuk ke agent.

### 3. AI Understanding (LLM + RAG)

1. Generate embedding untuk query.
2. Vector search pada Coretax knowledge base.
3. Format context dan prompt RAG.
4. LLM Coretax Agent menyusun jawaban.
5. Guardrail memeriksa sumber, cakupan, dan keamanan.
6. **Can AI Answer?** menentukan cabang.

### 4. Decision & Escalation

**True:** TTS → kirim jawaban ke caller → update session `answered`.  
**False:** buat escalation ticket → notify petugas → update session `escalated`.

### 5. Knowledge Base async

Schedule Trigger → ambil dokumen resmi → extract & chunk → generate embeddings → upsert vector index.

### 6. Monitoring & Logging async

Call session log → simpan transcript → update dashboard metrics → alert jika gagal.

## 2. Kontrak event minimal

```json
{
  "event_id": "evt_01H...",
  "session_id": "sess_01H...",
  "occurred_at": "2026-08-21T10:00:00Z",
  "channel": "voice",
  "caller_ref": "masked",
  "query": "Bagaimana aktivasi akun Coretax?",
  "status": "received"
}
```

## 3. Aturan retry dan idempotensi

- Setiap webhook harus memiliki `event_id` unik.
- Node write tidak boleh dieksekusi dua kali untuk `event_id` yang sama.
- Retry network maksimal tiga kali dengan backoff.
- Timeout setiap node eksternal harus eksplisit.
- Jika retry habis, tulis status `failed` dan buat alert operator.

## 4. Credential boundary

Credential hanya disimpan di n8n credential store atau environment variable. Jangan menaruh token OpenAI, Twilio, Gmail, Slack, database, atau webhook secret di JSON workflow yang dikomit ke GitHub.

## 5. Status node standar

| Status | Arti |
|---|---|
| `IDLE` | Belum dipanggil pada eksekusi aktif. |
| `RUNNING` | Sedang memproses. |
| `SUCCESS` | Berhasil. |
| `FAILED` | Gagal setelah retry. |
| `ESCALATED` | Berhasil dialihkan ke petugas. |

## 6. Definition of Done workflow

- Satu event test dapat ditelusuri dengan `event_id` dari trigger sampai outcome.
- Jalur jawaban dan eskalasi diuji terpisah.
- Retry tidak membuat duplikasi session atau ticket.
- Transcript tidak memuat secret atau data yang tidak diperlukan.
- Dashboard menampilkan status eksekusi dan timestamp yang sama dengan log n8n.
