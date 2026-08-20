---
title: "Panduan CbCR pada Coretax DJP (new)"
source_url: "https://www.pajak.go.id/sites/default/files/2025-07/Panduan%20CbCR%20pada%20Coretax%20DJP_0.pdf"
publisher: "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
accessed_at: "2026-08-21"
source_type: "official_pdf"
---

# Panduan CbCR pada Coretax DJP (new)

## Halaman 1

www.pajak.go.id
Panduan
CORETAX DJP – CbCR
(Country by Country
Report)
Versi 1.0
coretaxdjp.pajak.go.id

## Halaman 2

2
Kewajiban Terkait CBCR

## Halaman 3

3Kewajiban Notifikasi
Berlaku untuk semua Wajib Pajak Badan
yang memiliki transaksi afiliasi atau anggota grup usaha

## Halaman 4

4Penyampaian CBCR – Primary Filing
Berlaku untuk Entitas Induk (Ultimate Parent Entity/UPE)
yang berdomisili di Indonesia.

## Halaman 5

5Penyampaian CBCR – Local Filing
Dilakukan oleh Anggota Grup (Induk berdomisili di Luar Negeri)

## Halaman 6

• Login menggunakan NPWP Wajib Pajak Badan
• Klik menu Exchange of Information
• Pilih Sub Menu CBCR untuk masuk ke Dashboard CBCR
6Menu EoI - CBCR
1
2
3

## Halaman 7

Pada dashboard Pelaporan EOI – CBCR pilih Tombol Input CBCR untuk memulai
7Dashboard CBCR

## Halaman 8

Isikan Tahun Pajak untuk CBCR (rentang 2017
s.d 2024)
Isi Form Notifikasi sesuai dengan keadaan Wajib
Pajak
Jika diwajibkan menyampaikan CBCR siapkan:
• Berkas elektronik CBCR dalam format XML
• Kertas Kerja untuk primary filing
• Template mengikuti petunjuk di
http://pajak.go.id/
• Format penamaan file :
CBC-<TIN>-<Periode(2digit)>-
<KodePrimary/LocalFiling>-<LaporanKe>.xml
WS-<TIN>-<Periode(2digit)>-
<KodePrimary/Local Filing>-<LaporanKe>.xml
Primary Filling : 1, Local Filing : 2
Laporan Ke : 1, 2, 3, 4, dan seterusnya
8Notifikasi
!
!
!

## Halaman 9

1
2
3
1. Pilih file CBC dan Kertas kerja lalu
klik Submit
2. Masukan OTP yang terkirim ke
email lalu klik Verify
3. Setelah berhasil ada pesan Success
9Notifikasi – Unggah Berkas
Tahapan Unggah

## Halaman 10

• Laporan Notifikasi berhasil dengan status Valid jika tidak
ada error atau Invalid jika ada Error
• Laporan masih bisa dihapus sepanjang belum di
submit/simpan (Status Berkas : Not Submitted)
• Laporan yang sudah Status Berkas : Submitted bisa di
lihat Tanda Terima/Receive
10Notifikasi – Laporan Notifikasi

## Halaman 11

• Negara Penerima : Untuk melihat list negara Penerima atas Laporan CBC yang disampaikan
• Check Error : Untuk melihat error atas File CBC dengan status Invalid
• Hapus : Untuk menghapus draft atas Laporan dengan Status Berkas Not Submitted
• Verifikasi : Untuk melakukan verifikasi atas kode verifikasi yang dikirimkan melalui email
• Simpan : Untuk melakukan submit Laporan ke DJP
• Unduh berkas CbC : Untuk mengunduh file XML CbC yang di upload
• Lihat Formulir Pemberitahuan CbCR : Untuk melihat detil Form Notifikasi yang diisi
• Lihat Tanda Terima : untuk melihat Tanda Terima/Receive Notifikasi CbCR atas Laporan yang sudah Submitted
11Notifikasi – Penjelasan Tombol
Keterangan Tombol

## Halaman 12

• Tanda Terima bisa dilihat setelah
proses Laporan di-Submit/Simpan.
• Tanda Terima tidak dikirimkan ke
email.
• Tanda Terima tidak dapat di-
download dalam bentuk PDF,
untuk pencetakan bisa dalam
bentuk HTML yang dicetak.
12Notifikasi – Tanda Terima

## Halaman 13

XML SCHEMA
MESSAGESPEC
CRS BODY
REPORTING ENTITY
(Identitas Entitas Pelapor)
CBC REPORT
(Tabel 1 dan 2 CBCR sesuai
PMK 213)
ADDITIONAL INFO
(Tabel 3 CBCR sesuai PMK
213)
13Tata Cara Pembuatan

## Halaman 14

1
Buka laman
www://pajak.go.i
d/cbcr dan ikuti
petunjuk yang
diberikan
2
Unduh file XSD
CbC di laman
www://pajak.go.id/
cbcr, terdiri dari:
•CbC schema v2.0
•KertasKerja_v1.3
3
Gunakan XML
editor (antara
lain Altova atau
Oxygen) untuk
memproduksi
file XML yang
siap untuk diisi
4
Isi file XML yang
dihasilkan oleh
XML editor
sesuai dengan
petunjuk
pengisian CbCR
5
Validasi
pengisian XML
dengan XSD
CbCR
6
Beri nama file
XML yang telah
divalidasi sesuai
petunjuk
penamaan file
XML CbCR
7
Unggah file XML
ke Coretax:
•Primary filing =>
file XML CBCR +
Kertas Kerja
•Local filing =>
file XML CBCR
14Tahapan Pembuatan File XML

## Halaman 15

Buka laman
www://pajak.go.id/cbcr dan
ikuti petunjuk yang diberikan
Dapatkan copy file XML CbCR
dari UPE di Luar Negeri
Sesuaikan Elemen
Messagespec:
• Transmitingcountry dan
Receivingcountry harus diisi dengan
"ID"
• Messagetypeindic diisi dengan kode
"CBC401"
Sesuaikan Elemen
ReportingEntity:
• ReportingRole diisi dengan kode
"CBC703"
• DocTypeIndic diisi dengan kode
"OECD1"
Sesuaikan Elemen CbCReports:
• DocTypeIndic diisi dengan kode
"OECD1"
(DALAM HAL UPE TELAH MEMBUAT XML CBCR)
15File XML Untuk Local Filing
Dalam hal UPE telah membuat XML CBCR
1 2 3
4 5

## Halaman 16

PENYAMPAIAN CBCR : LOCAL
FILING
16Tampilan XML CBCR
Contoh XML: CBC_OECD

## Halaman 17

Format Penulisan MessageRefId:
17MESSAGESPEC
ID + Tahun Pajak + NPWP 16 digit + Sequence 5 Digit

## Halaman 18

REPORTINGENTITY
MessageRefid + R + Sequence 5 Digit
18REPORTINGENTITY
Format Penulisan DocREfId:

## Halaman 19

PENYAMPAIAN CBCR : LOCAL
FILING
MessageRefid + C + Sequence 5 Digit
Format Penulisan DocRefid
CBCReports:
19CBCREPORTS

## Halaman 20

PENYAMPAIAN CBCR : LOCAL
FILING
Contoh XML: ConstEntities
20CBCREPORTS - 2

## Halaman 21

PENYAMPAIAN CBCR : LOCAL
FILING
MessageRefid + A + Sequence 5 Digit
Format Penulisan DocRefid
AdditionalInfo:
21ADDITIONALINFO

## Halaman 22

PENYAMPAIAN CBCR : LOCAL
FILING
XML Schema
Header
Report
Kode Negara
Entitas
22Kertas Kerja CBCR Versi 1.3

## Halaman 23

PENYAMPAIAN CBCR : LOCAL
FILING
Format Penulisan:
HeaderRefID = MessageRefid
DocRefID Report = DocRefid CBCReports
23CBC Kertas Kerja

## Halaman 24

DitjenPajakRI
 www.pajak.go.id
 1500200
Terima Kasih
P A J A K  K I T A  U N T U K  K I T A
