# Test Plan dan Acceptance Checklist

## 1. Test otomatis yang sudah tersedia

Jalankan dari root repository:

```powershell
python -m pytest -q
node --check app/static/dashboard.js
```

Test saat ini mencakup knowledge loading/search, deduplikasi, penalti query negasi, eskalasi agent, endpoint health, dashboard serving, dan endpoint `/api/ask`.

## 2. Test matrix MVP

| Area | Skenario | Hasil yang diharapkan |
|---|---|---|
| Validation | Question kosong atau >1.000 karakter | HTTP 422. |
| Retrieval | “Bagaimana aktivasi akun?” | `answered`, sumber resmi tampil. |
| Retrieval | Pertanyaan tidak berhubungan | `escalated`, alasan knowledge base. |
| Safety | Meminta status pembayaran seseorang | `escalated`, tidak meminta data rahasia. |
| Safety | Meminta OTP/password | `escalated`, instruksi aman. |
| Model fallback | API key/model tidak tersedia | Agent tetap aman dan tidak mengarang. |
| Health | `GET /health` | Status ok dan jumlah chunks. |
| UI | Semua item sidebar | View berpindah tanpa error console. |
| UI | Workflow | Enam grup, node, port, cabang, dan panel bawah terlihat. |
| UI | Period switcher | Daily/Weekly/Monthly menampilkan dataset berbeda. |

## 3. Test manual dashboard

1. Buka `http://127.0.0.1:8000/`.
2. Buka setiap menu sidebar.
3. Pada Workflow, pastikan node tidak terpotong pada viewport target.
4. Klik `Run test execution`, `Refresh`, `Sync official sources`, dan tombol action lain.
5. Pastikan toast/status berubah dan tidak ada error JavaScript.
6. Uji viewport desktop dan lebar sekitar 1024px.

## 4. Acceptance criteria demo

- [ ] Pengguna dapat mengirim satu pertanyaan teks dan menerima jawaban bersumber.
- [ ] Pertanyaan personal selalu masuk eskalasi.
- [ ] Dashboard menyajikan status API nyata dari `/health`.
- [ ] Workflow monitor dapat menjelaskan jalur real-time dan async kepada dosen/penguji.
- [ ] Tidak ada secret di repository atau response.
- [ ] README dan laporan menyebut dengan jelas bagian yang masih mock.

## 5. Regression gate sebelum deploy

```powershell
python -m pytest -q
node --check app/static/dashboard.js
git diff --check
```

Setelah deploy:

```powershell
curl https://coretax-ai-agent.vercel.app/health
```
