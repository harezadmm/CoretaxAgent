---
title: "Identitas pembeli faktur pajak digunggung"
source_url: "https://www.pajak.go.id/coretaxpedia/identitas-pembeli-faktur-pajak-digunggung"
publisher: "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
accessed_at: "2026-08-24"
source_type: "official_html"
---

## Identitas pembeli faktur pajak digunggung

Terakhir diupdate pada:
17 Sep 2025

**Q: Bagaimana cara pengisian identitas pembeli pada XML faktur pajak pedagang eceran (digunggung) untuk XML Induk IA5 padahal pembeli konsumen akhir tidak diketahui identitasnya?**

A: Pencantuman detil transaksi yang digunggung dalam SPT masa PPN merupakan fitur yang disediakan dalam Coretax DJP bagi pengusaha kena pajak untuk dapat menyampaikan detil transaksi penyerahan kepada konsumen akhir.

Pengusaha kena pajak tetap dapat menyampaikan data secara digunggung atau total dalam satu baris dengan menggunakan skema *upload* XML pada SPT masa PPN atas pembelian yang dilakukan oleh pembeli yang memenuhi kriteria konsumen akhir tersebut.

**Pengisian kolom Identitas Pembeli mengikuti format sebagai berikut:**

- BuyerName: "-"
- BuyerIdOpt: "NIK"
- BuyerIdNumber: "0000000000000000"
