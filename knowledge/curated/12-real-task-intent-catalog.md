---
title: "Katalog Intent dan Parafrasa Pertanyaan Real Task"
source_url: "https://www.pajak.go.id/coretaxpedia/"
source_type: "curated_official_synthesis"
published_at: "2026-08-24"
retrieved_at: "2026-08-24"
document_hash: "sha256:bad7284b7fdb1ff910737a2a146ce0cc3189918bded3495fd52e14c316264104"
status: "active_review"
time_sensitivity: "high"
---

# Katalog Intent dan Parafrasa Pertanyaan Real Task

Katalog ini membantu retrieval lexical mengenali cara pengguna berbicara. Setiap baris adalah petunjuk routing, bukan jawaban final. Setelah intent cocok, ambil FAQ/manual resmi yang ditunjuk.

## Akses dan aktivasi

- "cara masuk coretax pertama kali" → `pertama-kali-akses-coretaxdjp`
- "saya dulu pakai djp online, login coretax bagaimana" → `akses-coretax-bagi-user-djp-online`
- "lupa password coretax" → `atur-ulang-kata-sandi`
- "email lama sudah tidak aktif untuk aktivasi" → `aktivasi-akun-lupa-email-nomor-telepon`
- "nomor HP di DJP salah" → `aktivasi-akun-lupa-email-nomor-telepon` atau perubahan detail kontak
- "gagal foto selfie saat aktivasi" → `kendala-aktivasi-gagal-ambil-foto`
- "nomor HP tidak tervalidasi" → `kendala-aktivasi-gagal-validasi-nomor-hp`
- "foto terlalu besar untuk aktivasi" → `kendala-aktivasi-ukuran-file-foto`
- "status SPDN belum aktif" → `kendala-aktivasi-belum-aktif-spdn`
- "akun saya belum pernah punya DJP Online" → `akses-coretax-bagi-bukan-user-djp-online`
- "belum punya NPWP tapi perlu akses" → `akses-bagi-bukan-wp`, `menu-hanya-registrasi`
- "email reset Coretax asli atau palsu" → verifikasi domain, eskalasi phishing bila perlu

## Kode otorisasi dan tanda tangan

- "buat kode otorisasi DJP" → `bagaimana-mendapat-kode-otorisasi`
- "sertifikat digital Coretax di mana" → `bagaimana-mendapat-kode-otorisasi`
- "kode otorisasi invalid" → `bagaimana-mengetahui-status-kode-otorisasi`
- "KO Created Failed" → `bagaimana-mengetahui-status-kode-otorisasi`
- "kode otorisasi tidak muncul" → `kode-otorisasi-tidak-muncul`
- "lupa passphrase signer" → `lupa-passphrase-kode-otorisasi`; jangan meminta passphrase
- "incorrect signer passphrase padahal merasa benar" → `incorrect-signer-passphrase`
- "kode otorisasi kadaluarsa" → `masa-berlaku-kode-otorisasi`
- "istri suami perlu kode otorisasi" → `kode-otorisasi-suami-istri`

## Pendaftaran, data, dan keluarga

- "daftar NPWP orang pribadi di Coretax" → `pendaftaran-wp-orang-pribadi`
- "daftar badan di Coretax" → manual `Pendaftaran WP Badan`
- "NIK sudah terdaftar" → `nik-sudah-terdaftar`
- "NIK belum padan dengan NPWP" → `belum-pemadanan-npwp`
- "ubah alamat utama" → `bagaimana-mengubah-data`
- "ubah email atau nomor HP" → `bagaimana-mengubah-data`
- "ubah rekening bank" → `bagaimana-mengubah-data`, `data-rekening-bank`
- "ubah pekerjaan atau KLU" → `bagaimana-mengubah-data`
- "tambah anggota keluarga" → `data-unit-keluarga`, `kendala-penambahan-data-anak`
- "istri gabung NPWP suami" → `bagaimana-istri-gabung-npwp-suami`
- "istri punya NPWP sendiri" → `apa-arti-npwp-gabung-suami`, FAQ suami-istri
- "status PH MT" → `ubah-status-ph-mt`
- "ubah status nonaktif jadi aktif" → `ubah-status-menjadi-aktif`
- "NPWP otomatis nonaktif" → `apakah-npwp-istri-otomatis-nonaktif`, `otomatis-status-nonaktif`
- "NITKU cabang tidak muncul" → `nitku-cabang-tidak-muncul`
- "apa itu TKU" → `apa-itu-tku`

## PIC, role, dan impersonate

- "cara impersonate akun perusahaan" → `bagaimana-melakukan-impersonate`
- "impersonate tidak muncul" → `tidak-ada-menu-impersonate`, `kendala-impersonate`
- "menu Coretax hilang saat jadi PIC" → `error-permissions-96-99-225`
- "permission 96/99/225" → `error-permissions-96-99-225`
- "beri role drafter" → `beri-cabut-role`, `dua-jenis-role`
- "jadi signer perusahaan" → `beri-cabut-role`, `hak-akses-pic`
- "cek role yang diberikan" → `cek-role-akses-yang-diberikan`
- "ganti PIC perusahaan" → `bagaimana-mengganti-pic`
- "siapa boleh jadi PIC" → `siapa-dapat-menjadi-pic`, `pic-harus-pejabat-tertinggi`
- "akun badan dipakai bersama" → `akun-wp-badan-digunakan-bersama`

## Billing dan pembayaran

- "buat kode billing mandiri" → `buat-kode-billing-mandiri`
- "bayar SPT kurang bayar" → `cara-membayar-spt-kurang-bayar`
- "setelah Bayar dan Lapor perlu buat billing lagi?" → `cara-membayar-spt-kurang-bayar`
- "bayar SPT pakai deposit" → `bayar-tagihan-dan-spt-dengan-deposit`
- "saldo deposit tidak cukup" → `gabung-deposit-dan-kode-billing` dan eskalasi jika transaksi personal
- "deposit dan billing bisa digabung?" → `gabung-deposit-dan-kode-billing`
- "cek sisa deposit" → `cek-sisa-deposit`, eskalasi untuk saldo akun tertentu
- "kode billing belum dibayar di mana" → `cek-daftar-kode-billing`, `cara-membayar-spt-kurang-bayar`
- "kode billing sudah expired" → `masa-aktif-kode-billing`
- "cancel kode billing" → `membatalkan-kode-billing`
- "deposit berkurang tapi SPT konsep" → `deposit-berkurang-spt-tetap-di-konsep`
- "bayar tagihan lama" → `deposit-untuk-tagihan-sebelum-2025` atau FAQ jenis tagihan

## Bukti potong

- "buat bupot PPh" → `bagaimana-membuat-bukti-potong`
- "upload bupot XML" → `upload-xml-bupot`
- "format XML bupot" → `templat-impor-data-ke-coretax-djp`
- "impor bupot gagal" → `kendala-impor-bupot`
- "bupot pegawai pindah kantor" → `bupot-pegawai-yang-pindah-tempat-kerja`
- "bupot masuk akun suami" → `bupot-pph-salah-masuk-ke-akun-suami`
- "NITKU tidak muncul di bupot" → `pencantuman-nitku-pada-bukti-potong`, `nitku-cabang-tidak-muncul`
- "bupot salah mau dibetulkan" → `pembetulan-bupot`
- "download bupot" → `unduh-bukti-potong`
- "penerima belum terdaftar" → `penerima-penghasilan-belum-terdaftar`

## Faktur pajak

- "cara buat faktur pajak" → `cara-membuat-faktur`
- "buat faktur massal XML" → `skema-umum-pembuatan-efaktur`, `cara-membuat-faktur`
- "faktur approval" → `approval-faktur-pajak`
- "faktur pajak masukan tidak ada" → `faktur-pajak-masukan-tidak-ditemukan`
- "faktur tanggal mundur" → `faktur-tanggal-mundur`
- "faktur uang muka dan pelunasan" → `faktur-pajak-uang-muka-dan-pelunasan`
- "faktur retur barang" → `retur-barang`
- "nomor seri faktur" → `nomor-seri-faktur-pajak`
- "NITKU di faktur" → `pencantuman-nitku-pada-faktur-pajak`
- "faktur digunggung" → `identitas-pembeli-faktur-pajak-digunggung`, `xml-transaksi-digunggung`

## SPT dan pelaporan

- "lapor SPT tahunan orang pribadi" → `lapor-spt-tahunan-orang-pribadi`
- "lapor SPT badan" → `lapor-spt-tahunan-badan`
- "buat SPT masa PPN" → `cara-buat-spt-masa-ppn`
- "buat SPT PPh 21/26" → `cara-buat-spt-masa-pph-21-26`
- "SPT normal atau pembetulan" → FAQ SPT yang sesuai dan eskalasi untuk keputusan personal
- "tombol Posting tidak ada" → `tombol-posting-pada-spt-tahunan`
- "SPT masih konsep" → `edit-spt-menunggu-pembayaran`, `deposit-berkurang-spt-tetap-di-konsep`
- "BPE SPT di mana" → `bukti-penerimaan-elektronik-bpe-spt-tahunan`
- "SPT nihil" → `spt-berstatus-nihil`, `lapor-ppn-nihil`
- "riwayat SPT" → `akses-riwayat-spt`
- "tanggal lapor SPT" → `tanggal-pelaporan-spt`, `batas-waktu-pelaporan-pembayaran`
- "perpanjangan SPT badan" → `pemberitahuan-perpanjangan-spt-tahunan-pph-badan`, deposit perpanjangan

## Layanan dan eskalasi

- "buat permohonan layanan" → `cara-mengakses-layanan-administrasi`
- "sudah simpan tapi belum terkirim" → `cara-mengakses-layanan-administrasi`, cek tahap **Kirim**
- "buat pengaduan di Coretax" → `pengajuan-layanan-pengaduan`
- "komplain Coretax" → FAQ pengaduan dan kanal [Kontak DJP](https://pajak.go.id/form/contact)
- "tolong cek status akun/saldo/pembayaran saya" → eskalasi, jangan minta kredensial
- "tolong bayarkan atau laporkan SPT saya" → eskalasi transaksional
