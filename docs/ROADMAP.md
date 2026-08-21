# Roadmap Implementasi

## Fase 0 — Fondasi (selesai)

- Knowledge base resmi dikumpulkan dan diaudit.
- Agent teks dengan retrieval dan eskalasi tersedia.
- API `/health` dan `/api/ask` tersedia.
- Dashboard support operations dan workflow reference tersedia.
- Deploy Vercel aktif.

## Fase 1 — Demo terpadu

1. Hubungkan form/komponen dashboard ke `/api/ask`.
2. Ganti data mock Overview dengan response API dan fixture demo yang diberi label.
3. Tambahkan halaman detail eskalasi dan penyimpanan lokal sementara.
4. Buat dataset evaluasi JSONL dan laporan baseline.
5. Tulis satu workflow n8n minimal untuk webhook → agent → response.

**Output:** demo teks end-to-end yang dapat dipresentasikan.

## Fase 2 — Voice + n8n

1. Tentukan provider telephony, STT, dan TTS.
2. Implementasikan webhook signature verification.
3. Implementasikan session store dan idempotency.
4. Hubungkan jalur true/false sesuai `N8N_WORKFLOW_SPEC.md`.
5. Simpan transcript dengan masking data.

**Output:** satu panggilan uji dapat dijawab atau dieskalasi.

## Fase 3 — Operasional

1. Knowledge sync terjadwal dan review perubahan.
2. Monitoring latency, error rate, retrieval quality, dan escalation rate.
3. Role-based access untuk dashboard.
4. Audit log dan retention policy.
5. Load test dan failure drill.

**Output:** prototype siap pilot terbatas.

## Definition of Done proyek

- [ ] Semua requirement P0 pada PRD memiliki bukti demo atau test.
- [ ] Jalur answered dan escalated diuji dengan fixture.
- [ ] Knowledge corpus memiliki manifest dan tanggal pembaruan.
- [ ] Voice/n8n dipisahkan dari API teks melalui kontrak event yang jelas.
- [ ] Laporan final menyertakan metode, hasil, keterbatasan, dan rencana pengembangan.
