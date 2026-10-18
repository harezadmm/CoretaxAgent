# Mockup Hi-Fi SIGAP (HaloBPOM) — Tugas Data Mockup PPL Praktikum I4, Kelompok 2

Sumber desain: `sigap-mockup-hifi.pen` (buka dengan Pen / pen.dev). Draft aslinya juga tersimpan otomatis di
`C:\Users\Hariz\.pencil\documents\f891f0a0-23c3-4240-8f7c-941fb2538a97\pencil-new.pen`.
Ekspor PNG 2x ada di `sigap-mockup-png/`. Dibuat 8 Oktober 2026 mengikuti daftar halaman lo-fi pada
laporan UTS (`Downloads\2_I4_TugasWeek6.pdf`, Bab V) dan skenario Gherkin Bab VI.

| No | Berkas PNG | Halaman (alamat) | Use case | State yang ditunjukkan |
|----|------------|------------------|----------|------------------------|
| 1 | 01-halaman-publik-homepage | Halaman Publik HaloBPOM (/homepage) | UC-01, UC-02 | Tombol mengambang "Telepon CS AI" (TeleponCSAI) |
| 2 | 02-panel-suara-menu-layanan | Panel Percakapan Suara (komponen /homepage) | UC-01, UC-02 | Menu IVR: tombol 1 & 2, transkrip langsung |
| 3 | 03-panel-suara-jawaban-informasi-produk | Panel Percakapan Suara | UC-01 | Produk ditemukan: nomor izin edar MD 807012345678, status Berlaku |
| 4 | 04-panel-suara-pengaduan-nomor-tiket | Panel Percakapan Suara | UC-02 | Pengaduan dicatat, tiket PGD-2026-0183, data perlu klarifikasi |
| 4b | 04b-panel-suara-eskalasi-petugas | Panel Percakapan Suara | UC-01 alt 3c | Nasihat medis → eskalasi, tiket ESK-2026-0021 |
| 5 | 05-login-petugas | Login Petugas (/login) | UC-03 | Pesan "Login gagal. Email atau password Anda salah." |
| 6 | 06-ringkasan-layanan | Ringkasan Layanan (/ringkasan) | UC-04 | Kartu statistik, kasus perlu tindak lanjut, kategori pertanyaan |
| 7 | 07-panggilan-berjalan | Panggilan Berjalan (/panggilan-berjalan) | UC-04 | Daftar panggilan aktif + durasi |
| 7b | 07b-panggilan-berjalan-kosong | Panggilan Berjalan | UC-04 alt 4a | "Tidak ada panggilan berjalan saat ini." |
| 8 | 08-tiket-eskalasi | Tiket Eskalasi (/tiket-eskalasi) | UC-04 | Antrean tindak lanjut, tautan transkrip, tombol Buka kasus |
| 9 | 09-riwayat-percakapan | Riwayat Percakapan (/riwayat-percakapan) | UC-05 | Daftar percakapan; baris transkrip diproses (tombol nonaktif + pesan) |
| 10 | 10-detail-transkrip-percakapan | Detail Transkrip (/riwayat-percakapan/detail) | UC-05 | Transkrip dengan data pribadi tersamarkan, ringkasan, catatan pemeriksaan tersimpan |
| 11 | 11-daftar-pengaduan | Daftar Pengaduan (/pengaduan) | UC-06 | Semua status berjenjang, tombol Telaah/Buka |
| 12 | 12-detail-pengaduan | Detail Pengaduan (/pengaduan/detail) | UC-06 | StepperPenanganan, telaah tersimpan, jadwal bentrok + SaranTanggalPengganti, tahap terkunci |
| 13 | 13-basis-pengetahuan | Basis Pengetahuan (/basis-pengetahuan) | UC-07 | GrafPengetahuan, filter & detail simpul, daftar materi, pesan "Materi siap digunakan sistem." |
| 13b | 13b-modal-tambah-materi | Basis Pengetahuan (modal) | UC-07 alt 3a | Validasi "Rujukan sumber wajib diisi." |
| 14 | 14-rekap-laporan-layanan | Rekap dan Laporan (/rekap-laporan) | UC-08 | GrafikRekapitulasi, TabelRekapitulasi, total periode |
| 14b | 14b-modal-unduh-laporan | Rekap dan Laporan (modal) | UC-08 | Format berkas + TautanUnduh |

Data mock konsisten antar-halaman: petugas Dewi Lestari (petugas@halobpom.go.id), tanggal 8 Okt 2026,
tiket PGD-2026-0183 / ESK-2026-0021, produk "Susu Formula Sehat 400 g" (MD 807012345678), periode rekap September 2026.
