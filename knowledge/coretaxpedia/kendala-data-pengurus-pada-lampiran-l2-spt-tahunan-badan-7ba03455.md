---
title: "Kendala data pengurus pada Lampiran L2 SPT Tahunan Badan"
source_url: "https://www.pajak.go.id/coretaxpedia/kendala-data-pengurus-lampiran-l2-spt-tahunan-badan"
publisher: "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
accessed_at: "2026-08-21"
source_type: "official_html"
---

## Kendala data pengurus pada Lampiran L2 SPT Tahunan Badan

Terakhir diupdate pada:
28 Apr 2026

**Q: Mengapa data pengurus tidak tercantum, atau tercantum ganda pada Lampiran L2A SPT Tahunan Badan 2025 atau tetap muncul meskipun sudah dihapus dari tabel Pihak Terkait?**

A: Sistem Coretax menentukan kemunculan data pengurus/pemegang saham di Lampiran L2A SPT Tahunan Badan berdasarkan pengaturan tanggal pada tabel Pihak Terkait, bukan sekadar status aktif/hapus. Masalah seperti data tidak muncul (*prefill*), muncul ganda, atau tetap tampil meskipun sudah dihapus, umumnya disebabkan oleh kesalahan pengisian atau tidak diisinya kolom **Tanggal Mulai (*****Valid From*****)** dan **Tanggal Berakhir (*****Valid To*****)**.

**Ketentuan pengisian tanggal untuk Tahun Pajak 2025**

Agar data pengurus masuk ke L2A SPT Tahunan Badan 2025, pastikan pengisian tanggal pada tabel Pihak Terkait memenuhi syarat berikut:

- **Agar muncul di L2A 2025**
  Isi Tanggal Mulai (*Valid From*) dengan tanggal sebelum 31 Desember 2025 (contoh: 30 Desember 2025), dan kosongkan kolom Tanggal Berakhir (*Valid To*).
- **Agar tidak muncul di L2A 2025**
  Isi Tanggal Mulai sesuai SK awal menjabat, dan isi Tanggal Berakhir dengan tanggal sebelum 1 Januari 2025 (contoh: 30 Desember 2024).

⚠️**Perhatian:**

- Jika Tanggal Berakhir diisi dengan tanggal yang sama dengan atau setelah 1 Januari 2025, data akan tetap muncul pada L2A 2025, meskipun sudah dihapus dari tabel Pihak Terkait.
- Jangan langsung menghapus data pengurus dari tabel Pihak Terkait tanpa mengisi Tanggal Berakhir terlebih dahulu. Jika data dihapus tanpa mengatur Tanggal Berakhir ke tanggal sebelum 2025 maka data akan hilang dari tabel namun tetap muncul pada lampiran SPT Tahunan.

**Contoh Kasus**

***Pergantian pengurus di tengah tahun 2025***

Apabila terjadi pergantian pengurus dalam tahun pajak 2025, kedua pengurus (lama dan baru) tetap akan muncul di L2A karena masing-masing aktif dalam periode tahun pajak tersebut.

Pengisian yang benar pada tabel Pihak Terkait adalah sebagai berikut:

- Pengurus lama (misal: Tuan A, menjabat hingga 30 Juni 2025) – Tanggal Mulai diisi sesuai SK awal, Tanggal Berakhir diisi 30 Juni 2025.
- Pengurus baru (misal: Tuan B, mulai menjabat 1 Juli 2025) – Tanggal Mulai diisi 1 Juli 2025, Tanggal Berakhir dikosongkan.

**Ringkasan:**

|  |  |  |
| --- | --- | --- |
| **Kondisi yang diiginkan** | **Tanggal Mulai** | **Tanggal Berakhir** |
| Muncul di L2A SPT Tahun Pajak 2025 | Sebelum 31 Des 2025 | Kosong |
| Tidak muncul di L2A SPT Tahun Pajak 2025 | Sesuai SK awal | Sebelum 1 Jan 2025 |
