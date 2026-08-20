---
title: "Step by step XML"
source_url: "https://www.pajak.go.id/coretaxpedia/step-by-step-xml"
publisher: "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
accessed_at: "2026-08-21"
source_type: "official_html"
---

## Step by step XML

Terakhir diupdate pada:
17 Sep 2025

**Q: Bagaimana cara membuat faktur pajak untuk banyak transaksi sekaligus dengan menggunakan Excel dan XML pada Coretax DJP?**

A: Metode impor data XML lebih efektif untuk membuat faktur pajak dalam jumlah banyak sekaligus. Pembuatan faktur dengan format XML dapat Anda lakukan menggunakan *file* *template* Microsoft Excel dengan mengikuti langkah-langkah sebagai berikut:

1. Kunjungi [www.pajak.go.id/coretax](https://www.pajak.go.id/coretax), dan klik tombol **Lebih Lanjut** pada bagian "Template XML dan Converter Excel ke XML"
2. Unduh *file* pada kategori Faktur Keluaran.
3. Buka folder "TemplateExcel", lalu buka file "Sample Faktur PK Template [versi terakhir]" menggunakan Microsoft Excel. File ini memiliki empat *sheets*: Faktur, DetailFaktur, Ref, dan Keterangan.
4. Isi *sheets* Faktur dan DetailFaktur sesuai petunjuk pengisian.
5. Simpan *file* Excel dengan nama yang diinginkan (contoh: ImporFK.xlsx).
6. Buka folder Converter Efaktur, lalu jalankan *file* "Converter.Efaktur.Coretax.exe".
7. Pilih *file* Excel yang sudah disiapkan, pilih jenis XML "Faktur Pajak Keluaran", lalu klik "Simpan".
8. *File* hasil konversi (ImporFK.xml) akan tersimpan di folder yang sama dengan folder Converter Faktur Keluaran.
9. *Login* ke sistem Coretax DJP, pada menu **e-Faktur**, lalu pilih e-Faktur **Pajak Keluaran** dan klik tombol **Impor Data**.
10. Pilih *file* XML yang sudah disiapkan, lalu tunggu hingga proses unggah selesai.
11. Beri tanda centang pada faktur pajak keluaran yang telah diunggah kemudian klik **Upload Faktur**.
12. Tandatangani secara elektronik menggunakan sertifikat elektronik atau kode otorisasi DJP.
13. Klik **Konfirmasi Tanda Tangan**.

**Hal-hal yang perlu diperhatikan:**

- Jangan membulatkan nilai di Excel secara manual untuk menghindari perbedaan nilai PPN/DPP. Biarkan ada dua digit di belakang titik.
- Pembatas desimal menggunakan titik. Apabila komputer Anda menggunakan setting regional yang berbeda, ubah desimal dari koma ke titik kemudian *restart* Excel dan ulangi proses konversi menjadi XML.
