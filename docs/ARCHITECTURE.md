# Arsitektur dan Technical Design

## 1. Kondisi saat ini

Komponen yang sudah berjalan:

```text
Browser dashboard ──> FastAPI /
                         ├── GET /health
                         └── POST /api/ask
                              ├── KnowledgeBase (Markdown)
                              └── CoretaxAgent (RAG + policy escalation)
```

API menggunakan `app/main.py`, `app/agent.py`, dan `app/knowledge.py`. Dashboard disajikan sebagai static HTML/CSS/JavaScript dan sebagian datanya masih berupa simulasi UI.

## 2. Target arsitektur P1

```text
Caller
  │
  ▼
n8n Webhook / Telephony
  │
  ├── Download Audio ──> STT ──> Normalize ──> Detect Language
  │                                         │
  │                                         ▼
  │                           FastAPI Coretax Agent
  │                              ├── Retrieval
  │                              ├── LLM answer
  │                              └── Guardrail
  │                                         │
  │                         ┌───────────────┴───────────────┐
  │                         ▼                               ▼
  │                  TTS + answer                    Escalation ticket
  │                         │                               │
  └───────────────<─────────┘                 Petugas + notification

Async: knowledge sync, transcript archive, dashboard metrics, alerts.
```

## 3. Batas tanggung jawab komponen

| Komponen | Tanggung jawab | Tidak boleh dilakukan |
|---|---|---|
| FastAPI | Validasi request, routing agent, response schema, health check. | Menyimpan secret di source code. |
| KnowledgeBase | Load, split, deduplicate, dan search dokumen. | Menganggap dokumen tidak resmi sebagai kebijakan final. |
| CoretaxAgent | Menentukan apakah pertanyaan aman dijawab, menyusun jawaban, dan eskalasi. | Memberi keputusan pajak personal. |
| n8n | Orkestrasi node, retry, cabang, pencatatan, dan integrasi. | Menaruh API key di node yang dibagikan tanpa credential store. |
| Dashboard | Monitoring operasional dan human handover. | Mengubah data pajak pengguna secara langsung. |

## 4. Konfigurasi environment

| Variable | Wajib | Keterangan |
|---|---:|---|
| `OPENAI_API_KEY` | P1 | API key provider model. |
| `OPENAI_MODEL` | P1 | Nama model yang diizinkan. |
| `KNOWLEDGE_DIR` | Tidak | Default `knowledge`. |
| `MIN_RETRIEVAL_SCORE` | Tidak | Default `0.12`. |
| `MAX_CONTEXT_DOCS` | Tidak | Default `4`. |

## 5. API yang sudah tersedia

### `GET /health`

Mengembalikan `status`, jumlah `knowledge_chunks`, dan `model_configured`.

### `POST /api/ask`

Menerima `question` dan mengembalikan status jawaban, answer, sources, serta alasan eskalasi.

Dokumentasi interaktif tersedia di `/docs` saat API berjalan lokal.

## 6. Alur RAG

1. Ambil file `.md`/`.txt` dari `knowledge/`.
2. Baca front matter metadata.
3. Pecah isi menjadi chunk berbasis paragraf/ukuran.
4. Hilangkan duplikasi chunk.
5. Tokenisasi query dan hitung relevansi lexical.
6. Terapkan penalti untuk dokumen yang bertentangan dengan bentuk pertanyaan.
7. Ambil konteks teratas di atas `MIN_RETRIEVAL_SCORE`.
8. Susun prompt berbasis sumber.
9. Jika model tidak tersedia atau gagal, eskalasi dengan aman.

## 7. Risiko teknis

- Corpus berubah sehingga jawaban lama tidak lagi valid.
- Voice provider timeout atau mengubah format webhook.
- n8n retry menggandakan pencatatan session.
- Prompt injection dari dokumen atau ucapan pengguna.
- Dashboard terlihat “live” tetapi belum terhubung ke event produksi.

Mitigasi minimal: versioning manifest, source allowlist, timeout, idempotency key, masking data, dan label demo/mock pada UI.
