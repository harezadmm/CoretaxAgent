---
title: "Pencantuman identitas pembeli"
source_url: "https://www.pajak.go.id/coretaxpedia/pencantuman-identitas-pembeli"
publisher: "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
accessed_at: "2026-08-21"
source_type: "official_html"
---

## Pencantuman identitas pembeli

Terakhir diupdate pada:
17 Sep 2025

**Q: Kapan harus memilih NPWP/NIK pada bagian informasi pembeli dan kapan harus mengisi jenis ID pembeli TIN/*****National ID*** **pada XML, saat perekaman faktur pajak keluaran untuk pembeli orang pribadi?**

A: **Saat merekam identitas pembeli secara** ***key in*****:**

- Isi NPWP 16 digit atau NIK (jika pembeli terdaftar NPWP) pada kolom NPWP.
- Nama, alamat, IDTKU dan email akan terisi otomatis sesuai *database* Coretax DJP.

**Saat merekam identitas pembeli secara import XML:**

- Pengisian identitas pembeli berupa NPWP/NIK ada di kolom J.
- Pilih Jenis ID Pembeli "TIN" pada kolom K
- Jika muncul notif "Error NPWP tidak ditemukan!" cek ulang pengisian. Pastikan 16 digit:
  - WP badan atau WNA terdaftar NPWP isikan 0 + 15 digit NPWP lama
  - NIK pembeli sudah padan dengan NPWP 15 digit

**Apabila penerima barang/jasa kena pajak belum memiliki NPWP, input** ***key in*****:**

- Pada *toggle* identitas, pilih NIK.
- Kolom NPWP akan otomatis terisi 0000000000000000.
- Isikan NIK pembeli pada kolom nomor dokumen.
- Sistem akan memvalidasi NIK tersebut ke Dukcapil dengan notif "*Success National ID valid!*".
- Isi data nama dan alamat pembeli.

**Apabila penerima barang/jasa kena pajak belum memiliki NPWP, pengisian excel import XML:**

- Pengisian identitas pembeli yang tidak terdaftar NPWP berupa 0000000000000000 padakolom J
- Pilih jenis ID pembeli "*National ID*" pada kolom K

Jika muncul notif "Error NIK tidak ditemukan!" Cek ulang pengisian.

**Dampak Penggunaan NIK/memilih Jenis ID Pembeli National ID:**

Jika orang pribadi pembeli ternyata PKP dan diterbitkan faktur pajak keluaran dengan identitas menggunakan National ID (bukan TIN):

- Pajak masukan tidak akan muncul di *dashboard*.

Jika orang pribadi pembeli bukan PKP dan diisikan menggunakan *National ID*:

- Tidak dapat memanfaatkan fitur retur dalam Coretax DJP.

**Solusi:**

- Pastikan identitas pembeli sesuai dengan status perpajakan yang sesungguhnya sebelum menerbitkan faktur pajak.
- Bila sudah terlanjur, dapat dilakukan pembatalan. *Approval* faktur pajak paling lambat tanggal 20 bulan berikutnya.

**Catatan:**

- Jika pembeli orang pribadi PKP  mengakui terdaftar NPWP namun tidak padan dengan NIK, silakan ke KPP terdekat untuk lakukan pemadanan NIK dan NPWP.
