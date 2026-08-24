---
title: "Akses, Aktivasi, Atur Ulang Kata Sandi, dan Keamanan"
source_url: "https://www.pajak.go.id/coretaxpedia/pertama-kali-akses-coretaxdjp"
source_type: "curated_official_synthesis"
published_at: "2026-08-24"
retrieved_at: "2026-08-24"
document_hash: "sha256:f932fc7c80deeafd70201a65941b534d8dc68096672e4747ed18331d28611005"
status: "active_review"
time_sensitivity: "high"
---

# Akses, Aktivasi, Atur Ulang Kata Sandi, dan Keamanan

## Decision tree akses pertama kali

### Pengguna DJP Online

Jika pengguna sudah memiliki akun DJP Online dan pemadanan NIK sebagai NPWP sudah dilakukan, rujuk alur berikut:

1. Buka [coretaxdjp.pajak.go.id](https://coretaxdjp.pajak.go.id/).
2. Klik **Lupa Kata Sandi?**.
3. Pilih tujuan konfirmasi dan masukkan email atau nomor ponsel.
4. Masukkan captcha, baca pernyataan, lalu klik **Kirim**.
5. Buka email dari domain `@pajak.go.id`, ikuti tautan, ubah kata sandi, dan buat passphrase sesuai panduan.

Sumber: [Akses Coretax bagi user DJP Online](https://www.pajak.go.id/coretaxpedia/akses-coretax-bagi-user-djp-online).

### Belum memiliki atau belum pernah menggunakan DJP Online

Rujuk artikel **Akses Coretax bagi bukan user DJP Online** dan prosedur aktivasi resmi. Jangan menyamakan alur ini dengan reset password pengguna DJP Online.

### Belum terdaftar sebagai wajib pajak

Rujuk artikel [Akses bagi bukan WP](https://www.pajak.go.id/coretaxpedia/akses-bagi-bukan-wp) dan panduan pendaftaran. Jika kebutuhan hanya akses tertentu tanpa pendaftaran penuh, artikel resmi menjelaskan menu **Daftar Disini > Perorangan > Memiliki NIK > Hanya Registrasi** untuk kondisi yang dijelaskan pada sumber tersebut. Agent tidak menentukan sendiri apakah seseorang memenuhi syarat.

## Lupa email atau nomor telepon

Artikel resmi mengarahkan pengguna untuk memperbarui detail kontak melalui layar **Permintaan Akses Digital**:

1. Tandai bahwa wajib pajak sudah terdaftar.
2. Isi NPWP dan klik **Cari**.
3. Lakukan swafoto dan **Validasi Foto**.
4. Masukkan email dan nomor telepon baru.
5. Selesaikan verifikasi kontak yang dikirim ke email/nomor yang baru dimasukkan.
6. Setujui pernyataan dan klik **Simpan**.

Sumber: [Aktivasi akun lupa email dan nomor telepon](https://www.pajak.go.id/coretaxpedia/aktivasi-akun-lupa-email-nomor-telepon).

## Setelah berhasil masuk

Untuk wajib pajak orang pribadi, alur pertama kali pada FAQ DJP memuat tiga tahap besar: masuk/aktivasi, membuat kode otorisasi atau sertifikat elektronik, lalu mengaktifkan verifikasi dua langkah. Ambil detail tahap kedua dari dokumen kode otorisasi, bukan dari ringkasan ini.

## Pemeriksaan keamanan

- Pastikan tautan masuk adalah domain resmi yang dirujuk DJP.
- Jika menerima email reset, verifikasi domain pengirim `@pajak.go.id` seperti yang ditekankan FAQ resmi.
- Jangan meminta atau menyalin OTP, password, passphrase, atau foto identitas ke agent.
- Jika pengguna melaporkan phishing, penyalahgunaan, atau akun diambil alih, hentikan troubleshooting biasa dan eskalasi ke kanal resmi.

## Kendala akses yang perlu diarahkan ke FAQ spesifik

- **Belum aktif SPDN** → `kendala-aktivasi-belum-aktif-spdn` dan `status-belum-aktif-spdn`.
- **Gagal ambil foto** → `kendala-aktivasi-gagal-ambil-foto`.
- **Gagal validasi nomor HP** → `kendala-aktivasi-gagal-validasi-nomor-hp`.
- **Ukuran file foto** → `kendala-aktivasi-ukuran-file-foto`.
- **Atur ulang kata sandi gagal** → `kendala-atur-ulang-kata-sandi`.
- **NIK sudah terdaftar** → `nik-sudah-terdaftar`.

Untuk error teknis yang berulang setelah langkah resmi dicoba, minta pengguna mencatat pesan error tanpa mengirim kredensial, lalu eskalasi.
