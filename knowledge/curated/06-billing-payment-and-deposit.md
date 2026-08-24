---
title: "Kode Billing, Pembayaran SPT, dan Deposit Pajak"
source_url: "https://www.pajak.go.id/coretaxpedia/cara-membayar-spt-kurang-bayar"
source_type: "curated_official_synthesis"
published_at: "2026-08-24"
retrieved_at: "2026-08-24"
document_hash: "sha256:f548522200f67ea4a1fd3ffc755bac0eaa0db40ed58fb8744462a48f30c3bfc5"
status: "active_review"
time_sensitivity: "high"
---

# Kode Billing, Pembayaran SPT, dan Deposit Pajak

## Bedakan tiga intent

1. Membuat kode billing mandiri untuk setoran tertentu.
2. Membayar tagihan atau SPT kurang bayar.
3. Menggunakan atau memeriksa deposit pajak.

Jangan menggabungkan ketiganya hanya karena pengguna menyebut kata "bayar".

## SPT kurang bayar setelah Bayar dan Lapor

FAQ resmi menyebut dua pilihan:

- **Deposit** jika saldo deposit mencukupi.
- **Kode billing** jika pengguna memilih pembayaran melalui billing; sistem otomatis membentuk kode billing dan konsep SPT berpindah ke **SPT menunggu pembayaran**.

Pengguna tidak perlu membuat kode billing mandiri lagi untuk alur SPT kurang bayar ketika sistem sudah membentuk billing otomatis. Setelah pembayaran berhasil, SPT berpindah ke **SPT Dilaporkan** sesuai alur sumber.

Sumber: [Cara membayar SPT kurang bayar](https://www.pajak.go.id/coretaxpedia/cara-membayar-spt-kurang-bayar).

## Pembayaran tagihan dengan deposit

Untuk tagihan pajak, FAQ menjelaskan area **Pembayaran > Pembuatan Kode Billing atas Tagihan Pajak**, memilih tagihan, mengisi nominal, lalu memilih **Bayar dengan Pemindahbukuan Deposit Pajak**. Jika berhasil, bukti pemindahbukuan tersedia di **Portal Saya > Dokumen Saya**.

Untuk SPT kurang bayar, pengguna memilih **Bayar dan Lapor**, lalu memilih deposit apabila saldo mencukupi.

Sumber: [Bayar tagihan dan SPT dengan deposit](https://www.pajak.go.id/coretaxpedia/bayar-tagihan-dan-spt-dengan-deposit).

## Deposit dan kode billing tidak digabung

FAQ [Gabung deposit dan kode billing](https://www.pajak.go.id/coretaxpedia/gabung-deposit-dan-kode-billing) menyatakan pembayaran untuk konteks tersebut tidak dipecah sebagian deposit dan sebagian kode billing. Agent harus mengambil konteks jenis pembayaran sebelum menyampaikan aturan ini.

## Jejak dokumen dan status

Untuk pencarian dokumen, rujuk **Pembayaran > Daftar Kode Billing Belum Dibayar** dan **Portal Saya > Dokumen Saya** sesuai FAQ. Tabel mungkin perlu di-refresh. Jangan menyatakan kode billing atau pembayaran pengguna sudah ada tanpa pemeriksaan akun yang sah.

## Deposit yang sensitif terhadap waktu

Pertanyaan tentang saldo, urutan FIFO, masa aktif, pengembalian, tagihan sebelum tahun tertentu, atau SPT yang tetap konsep harus mengambil FAQ masing-masing:

- `cek-sisa-deposit`
- `metode-fifo-pada-deposit`
- `masa-aktif-kode-billing`
- `kode-billing-deposit`
- `auto-alokasi-deposit`
- `pemanfaatan-deposit-secara-manual`
- `deposit-berkurang-spt-tetap-di-konsep`
- `deposit-untuk-tagihan-sebelum-2025`

## Eskalasi

Status saldo, nominal, kode billing, atau pembayaran tertentu adalah data personal/transaksional. Agent hanya menjelaskan alur umum dan lokasi menu; permintaan pengecekan atau perubahan harus diteruskan kepada petugas.
