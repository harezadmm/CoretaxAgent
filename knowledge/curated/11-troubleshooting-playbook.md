---
title: "Playbook Troubleshooting Coretax Berbasis Gejala"
source_url: "https://www.pajak.go.id/coretaxpedia/"
source_type: "curated_official_synthesis"
published_at: "2026-08-24"
retrieved_at: "2026-08-24"
document_hash: "sha256:e1e65268920bd49d287f018a049384f0ec6544aec07c6aebc993d180bdef083a"
status: "active_review"
time_sensitivity: "high"
---

# Playbook Troubleshooting Coretax Berbasis Gejala

## Pola diagnosis umum

1. Identifikasi modul: akses, profil, role, bupot, faktur, SPT, pembayaran, atau layanan.
2. Ambil FAQ yang judulnya paling dekat dengan pesan/gejala.
3. Cek prasyarat yang dapat dilihat pengguna tanpa membagikan data rahasia.
4. Ikuti langkah resmi satu per satu.
5. Catat hasil dan pesan error persisnya.
6. Jika tetap gagal, eskalasi; jangan membuat workaround yang mengubah data atau transaksi.

## Gejala dan rujukan utama

| Gejala | Konteks yang harus diambil |
|---|---|
| Tidak bisa masuk pertama kali | `pertama-kali-akses-coretaxdjp`, `akses-coretax-bagi-user-djp-online` |
| Lupa email/HP lama | `aktivasi-akun-lupa-email-nomor-telepon` |
| Tidak bisa validasi foto/HP | `kendala-aktivasi-gagal-ambil-foto`, `kendala-aktivasi-gagal-validasi-nomor-hp` |
| NIK sudah terdaftar | `nik-sudah-terdaftar` |
| Kode otorisasi invalid/tidak muncul | `bagaimana-mengetahui-status-kode-otorisasi`, `kode-otorisasi-tidak-muncul` |
| Incorrect signer passphrase | `incorrect-signer-passphrase` dan status Digital Certificate |
| Menu hilang saat impersonate | `error-permissions-96-99-225`, `kendala-impersonate`, role/PIC |
| Tidak bisa impor bupot | `upload-xml-bupot`, `templat-impor-data-ke-coretax-djp`, `kendala-impor-bupot` |
| NITKU cabang tidak ada | `nitku-cabang-tidak-muncul`, `cara-penerbitan-bupot-tku` |
| Pajak masukan/faktur tidak muncul | `faktur-pajak-masukan-tidak-ditemukan`, `daftar-faktur-tidak-muncul` |
| SPT tetap konsep/menunggu pembayaran | `edit-spt-menunggu-pembayaran`, `deposit-berkurang-spt-tetap-di-konsep`, `cara-membayar-spt-kurang-bayar` |
| Nilai SPT atau PPN berubah | `kendala-total-ppn-telah-berubah`, `pengaruh-konsep-delta`, `nilai-kompensasi-tidak-terisi` |
| Permohonan belum selesai | `cara-mengakses-layanan-administrasi`, cek tahap **Kirim** |

## Rules untuk error teknis

- Jangan menyimpulkan akar masalah hanya dari kata "error".
- Bedakan error otorisasi dari error data, error format XML, timeout, dan status proses.
- Jangan menyuruh pengguna mencoba berulang kali jika langkah tersebut dapat menggandakan transaksi atau dokumen.
- Jangan menyarankan akun baru, pembatalan, pembayaran ulang, atau penghapusan tanpa sumber yang tepat.
- Saat perlu handover, minta hanya kode/pesan error yang tidak memuat data rahasia.

## Jalur eskalasi

Eskalasi jika status tidak berubah setelah interval yang wajar menurut sumber, data akun tidak sinkron, transaksi sudah terjadi tetapi status berbeda, dokumen hilang, atau pengguna meminta agent memeriksa/mengubah akun.
