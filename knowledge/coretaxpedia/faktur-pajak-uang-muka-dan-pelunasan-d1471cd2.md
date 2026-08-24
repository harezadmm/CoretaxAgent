---
title: "Faktur pajak uang muka dan pelunasan"
source_url: "https://www.pajak.go.id/coretaxpedia/faktur-pajak-uang-muka-dan-pelunasan"
publisher: "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
accessed_at: "2026-08-24"
source_type: "official_html"
---

## Faktur pajak uang muka dan pelunasan

Terakhir diupdate pada:
17 Sep 2025

**Q: Bagaimana cara pembuatan faktur pajak uang muka dan pelunasan yang keduanya dibuat di Coretax DJP?**

A: Pada isian e-Faktur Coretax DJP, Anda dapat membuat faktur pajak uang muka atau pelunasan dengan memberi tanda centang pada *checkbox* yang sesuai.

***Checkbox*** **uang muka**

1. Digunakan untuk transaksi dengan pembayaran bertahap (termin) atau pembayaran sebelum penyerahan BKP/JKP.
2. Faktur uang muka pertama mencantumkan total nilai kontrak/order, yakni memuat seluruh detail transaksi barang/jasanya.
3. Jika terdapat lebih dari satu kali pembayaran uang muka/tahap/termin:
   - Faktur kedua dst tetap centang *checkbox* "Uang Muka".
   - Harus selalu masukkan nomor faktur uang muka pertama pada kolom "Nomor Faktur."
   - Data detil transaksi akan terisi otomatis (dari FP UM pertama sebagai referensi).

**Pengisian faktur uang muka (pertama dan selanjutnya):**

1. Rekam seluruh detil transaksi di kontrak layaknya faktur pajak biasa.
2. Centang "DPP Nilai Lain" setiap penambahan transaksi detail barang/jasa.
3. Masukkan hasil kalkukasi nilai 11/12 x harga jual/DPP/penggantian secara manual pada baris DPP Nilai Lain setiap transaksi. Kecuali untuk FP uang muka kedua dan seterusnya, tidak perlu menambah transaksi lagi karena sudah terisi otomatis dari detail di FP UM pertama.
4. Pada isian "Uang Muka" di bawah daftar transaksi: isikan nilai uang muka yang diterima.

***Checkbox*** **Pelunasan:**

Khusus untuk pembayaran terakhir dari sebuah pembayaran bertahap, sistem akan otomatis menampilkan nilai sisa pembayaran baik itu DPP, DPP nilai lain, maupun PPN.

1. Dibuat saat pelunasan.
2. Centang *checkbox* "Pelunasan" dan input nomor faktur uang muka pertama.
3. Sistem akan otomatis mendeteksi hingga faktur uang muka yang terakhir.
4. Secara otomatis, sistem mencantumkan seluruh detail dan perhitungan transaksi.
5. PPN pelunasan dihitung dari tarif 12% x sisa nilai DPP nilai kontrak/total order setelah dikurangi total pembayaran uang muka.

**Pengisian Faktur Pelunasan:**

1. Tidak perlu menambah detil transaksi karena sudah terisi otomatis.
2. DPP dan PPN terisi otomatis sesuai perhitungan dari total DPP nilai Lain kontrak/total order dikurangi pembayaran uang muka nilai lain yang telah diterbitkan sebelumnya.
3. Hasil akhir pada cetakan faktur pajak pelunasan terhitung otomatis:
   - DPP = Total DPP Nilai Lain (pada FP UM-1) dikurangi "Uang Muka Nilai Lain" ke-1, ke-2 dst.
   - PPN = DPP x 12% (atau 11% x harga jual).
