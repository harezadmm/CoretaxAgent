---
title: "Peta Modul dan Navigasi Coretax DJP"
source_url: "https://www.pajak.go.id/coretax"
source_type: "curated_official_synthesis"
published_at: "2026-08-24"
retrieved_at: "2026-08-24"
document_hash: "sha256:07141309ac21e53c215afa3dffb02b5547f889f2e9f629c35d80b1c0d3b21caa"
status: "active_review"
time_sensitivity: "medium"
---

# Peta Modul dan Navigasi Coretax DJP

## Gambaran umum

Coretax DJP adalah sistem inti administrasi perpajakan yang mengintegrasikan proses pendaftaran, administrasi akun, pelaporan SPT, pembayaran, faktur, bukti potong, layanan wajib pajak, dan proses administrasi lain. Gunakan hub [Coretax DJP](https://www.pajak.go.id/coretax) sebagai pintu masuk untuk panduan resmi.

## Peta menu berdasarkan intent

| Intent pengguna | Area/menu yang biasanya relevan | Rujukan pencarian |
|---|---|---|
| Pertama kali masuk | laman Coretax DJP, **Lupa Kata Sandi?**, aktivasi | `pertama-kali-akses-coretaxdjp`, `akses-coretax-bagi-user-djp-online` |
| Email atau nomor HP lama | **Permintaan Akses Digital**, perubahan detail kontak | `aktivasi-akun-lupa-email-nomor-telepon` |
| Kode untuk tanda tangan | **Portal Saya > Permintaan Kode Otorisasi/Sertifikat Elektronik** | `bagaimana-mendapat-kode-otorisasi` |
| Cek sertifikat | **Portal Saya > Profil Saya > Nomor Identifikasi Eksternal > Digital Certificate** | `bagaimana-mengetahui-status-kode-otorisasi` |
| Identitas/kontak/keluarga | **Portal Saya > Profil Saya > Informasi Umum > Edit** | `bagaimana-mengubah-data`, `data-unit-keluarga` |
| Rekening, pekerjaan, alamat utama | **Portal Saya > Perubahan Data** | `bagaimana-mengubah-data` |
| Mewakili badan/instansi | dropdown akun, **impersonate**, role | `apa-itu-impersonate`, `bagaimana-melakukan-impersonate` |
| Bukti potong | **eBupot**, **Create eBupot**, **Impor data** | `bagaimana-membuat-bukti-potong`, `upload-xml-bupot` |
| Faktur pajak | **e-Faktur > Pajak Keluaran**, buat/impor/upload | `cara-membuat-faktur`, `skema-umum-pembuatan-efaktur` |
| SPT | **Surat Pemberitahuan (SPT)**, buat konsep, posting, Bayar dan Lapor | `lapor-spt-tahunan-orang-pribadi`, `cara-buat-spt-masa-ppn` |
| Pembayaran | **Pembayaran**, kode billing, deposit, Dokumen Saya | `cara-membayar-spt-kurang-bayar`, `bayar-tagihan-dan-spt-dengan-deposit` |
| Permohonan administrasi | **Layanan Wajib Pajak > Layanan Administrasi** | `cara-mengakses-layanan-administrasi` |
| Pengaduan/saran/apresiasi | **Layanan Wajib Pajak > Layanan Pengaduan, Saran dan Apresiasi** | `pengajuan-layanan-pengaduan` |

## Disambiguasi yang wajib dilakukan

- **Aktivasi akun** berbeda dari **membuat kode otorisasi**. Aktivasi memberi akses; kode otorisasi/sertifikat digital dipakai untuk penandatanganan elektronik.
- **Kode billing** berbeda dari **deposit pajak**. Kode billing adalah dokumen/tagihan untuk pembayaran; deposit adalah saldo yang dapat dipakai sesuai alur yang tersedia.
- **Drafter** dan **signer** adalah role akses; **PIC** adalah penanggung jawab; **impersonate** adalah mode akses mewakili wajib pajak badan/instansi.
- **SPT konsep**, **SPT menunggu pembayaran**, dan **SPT dilaporkan** adalah status alur yang berbeda. Jangan menyamakan status konsep dengan status sudah dilaporkan.
- **TKU/NITKU** berkaitan dengan tempat kegiatan usaha dan identitas unit; jangan meminta pengguna mengirim nomor lengkapnya.

## Cara memakai peta ini saat retrieval

Cari dulu modul dan intent, lalu cari gejala spesifik. Contoh: pertanyaan "tidak bisa lapor karena signer passphrase" harus mengambil konteks **kode otorisasi**, **Digital Certificate**, dan **SPT**, bukan hanya kata "passphrase". Pertanyaan "menu saya hilang saat impersonate" harus mengambil konteks **role**, **PIC**, dan **permissions**.

## Sumber dasar

- [Coretax DJP — hub resmi](https://www.pajak.go.id/coretax)
- [Coretaxpedia — FAQ resmi](https://www.pajak.go.id/coretaxpedia/)
- [Pertama kali akses Coretax DJP](https://www.pajak.go.id/coretaxpedia/pertama-kali-akses-coretaxdjp)
