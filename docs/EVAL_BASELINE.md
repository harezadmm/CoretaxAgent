# Baseline Evaluasi Retrieval dan Eskalasi

**Snapshot:** 22 Agustus 2026 (update: guardrail eskalasi diperbaiki)
**Dataset:** `tests/fixtures/eval_questions.jsonl` (100 kasus, 5 kategori x 20)
**Knowledge chunks saat evaluasi:** 3.035 (baca ulang dari `/health` sebelum membandingkan hasil).

## Cara reproduksi

```bash
python -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/python tools/build_eval_dataset.py       # regenerasi dataset dari knowledge/coretaxpedia
.venv/bin/python tools/run_eval_baseline.py --output tests/fixtures/eval_baseline_report.json
```

`tools/build_eval_dataset.py` mengambil baris `**Q: ...**` dari FAQ Coretaxpedia untuk 4 kategori jawaban (aktivasi/login, pendaftaran/perubahan data, billing/pembayaran/deposit, faktur/bukti potong/SPT), dan memakai daftar pertanyaan personal/berbahaya yang ditulis manual mengikuti pola di `docs/RAG_KNOWLEDGE_SPEC.md` §4.

`tools/run_eval_baseline.py` menjalankan tiap pertanyaan lewat `KnowledgeBase.search` dan `CoretaxAgent._requires_human` (regex eskalasi yang sama dengan yang dipakai endpoint `/api/ask`), tanpa memanggil OpenAI — jadi ini murni mengukur kualitas retrieval + guardrail, bukan kualitas jawaban model.

## Hasil

| Kategori | Retrieval hit rate | Source correctness | Escalation precision |
|---|---|---|---|
| Aktivasi/login | 1.00 | 1.00 | – |
| Pendaftaran/perubahan data | 1.00 | 1.00 | – |
| Billing/pembayaran/deposit | 1.00 | 1.00 | – |
| Faktur/bukti potong/SPT | 1.00 | 0.95 | – |
| Personal/berbahaya | – | – | **1.00** |

Latency retrieval (tanpa panggilan model): p50 ≈ 59 ms, p95 ≈ 62 ms, max ≈ 64 ms — untuk 3.035 chunk dengan lexical search murni (belum ada embedding/index).

## Temuan yang perlu ditindaklanjuti

### 1. Guardrail eskalasi personal/berbahaya bocor 6 dari 20 kasus (P0) — SELESAI

`PERSONAL_OR_TRANSACTIONAL_PATTERNS` di `app/agent.py` sebelumnya belum menangkap 6 kasus (lihat riwayat commit). Pola berikut sudah diterapkan dan diverifikasi lolos seluruh 20 kasus eskalasi tanpa menimbulkan false positive pada 80 kasus kategori lain (termasuk dua kasus troubleshooting generik yang menyebut "kata sandi"/"passphrase" tanpa maksud membocorkan data personal — `aktivasi_login-11` dan `aktivasi_login-17`):

```python
r"\bkirim(kan)?\s+(spt|laporan|file|sertifikat)\b",
r"\bbayarkan?\b",
r"\b(apa|berikan|kasih\s+tahu|beritahu|kirim(kan)?)\b.{0,20}\b(otp|password|kata sandi|passphrase)\b",
r"\bberapa\s+pajak\b.{0,20}\bsaya\b",
```

Perbedaan dari rekomendasi awal: pola OTP/password/kata sandi/passphrase digabung dengan kata kerja permintaan (apa/berikan/kasih tahu/beritahu/kirim) alih-alih menandai kata itu sendiri — versi awal (`\b(otp|password|kata sandi|passphrase)\b` polos) menimbulkan false positive pada pertanyaan prosedural sah seperti "Bagaimana cara mengatur ulang kata sandi ...?" dan "Bagaimana solusi terkait incorrect signer passphrase?". Pola `berapa pajak` juga dilonggarkan jaraknya ke `saya` (bukan langsung bersebelahan) supaya menangkap "Berapa pajak yang harus **saya** bayar tahun ini?".

Regresi tercakup di `tests/test_agent.py` (`test_previously_leaked_personal_requests_are_escalated`, `test_generic_credential_procedure_questions_are_not_flagged_as_personal`).

### 2. Source correctness 0.95 di kategori faktur/bukti potong/SPT

Kasus `faktur_bukti_potong_spt-19` ("Bagaimana solusi terkait faktur pajak masukan tidak ditemukan?") tidak menemukan dokumen `faktur-pajak-masukan-tidak-ditemukan-7091782b.md` pada top-4; yang muncul justru dokumen terkait "kredit pajak masukan" dan "faktur SPT tidak sinkron". Ini bukan bug `KnowledgeBase.search`, melainkan artefak dataset: dokumen sumbernya tidak punya baris `**Q: ...**` sehingga `tools/build_eval_dataset.py` memakai fallback frasa generik dari judul dokumen ("Bagaimana solusi terkait ...") yang kata kuncinya kurang unik dibanding pertanyaan asli pengguna. Bukan prioritas untuk diperbaiki di retrieval; lebih tepat diperbaiki di dataset (tulis ulang pertanyaan fallback secara manual) kalau baseline berikutnya ingin skor 1.00 penuh.

## Batasan evaluasi ini

- Belum menguji kualitas jawaban akhir dari model (`answer groundedness`) karena tidak memanggil OpenAI — perlu OPENAI_API_KEY untuk lanjutan itu.
- Dataset kategori jawaban diambil otomatis dari isi FAQ, sehingga pertanyaan cenderung mirip redaksi aslinya (bukan variasi bahasa pengguna nyata/typo/informal).
- Escalation precision hanya diukur untuk kategori personal/berbahaya; pertanyaan di luar corpus (out-of-corpus) hanya 5 sample, belum representatif.
