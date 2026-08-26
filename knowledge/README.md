# Knowledge Base BPOM AI Agent

Folder ini berisi corpus RAG untuk agent informasi Badan Pengawas Obat dan
Makanan (BPOM).

## Lapisan knowledge

- `regulations/` — peraturan resmi BPOM: Peraturan BPOM dan Peraturan Kepala
  BPOM, lengkap dengan teks penuh hasil ekstraksi PDF resmi.
- `managed/` — dokumen yang dibuat dan disunting operator lewat RAG Management.
- `_meta/regulations-manifest.json` — manifest judul, nomor, tahun, status, dan
  URL sumber setiap peraturan.
- `_meta/SCOPE.md` — batas cakupan knowledge base.
- `_trash/` — dokumen yang dihapus operator, disimpan agar dapat dipulihkan.

## Sumber

Peraturan diambil dari basis data peraturan BPK (`peraturan.bpk.go.id`) dengan
filter entitas Badan Pengawas Obat dan Makanan.

JDIH BPOM sendiri tidak dipakai sebagai sumber: endpoint katalognya membalas
500, dan id dokumennya terlalu jarang untuk dienumerasi. Agregator nasional
JDIHN merender hasil di sisi klien dan membatasi keluarannya. BPK menerbitkan
peraturan yang sama sebagai HTML sisi server dengan filter dan paginasi yang
berfungsi.

Pembaruan dilakukan dengan `python tools/sync_bpom_regulations.py`.

## Catatan

Corpus ini seluruhnya berisi teks peraturan. Bahasa peraturan bersifat normatif,
sehingga pertanyaan bergaya "bagaimana cara ..." belum tentu terjawab baik dari
sini saja. Lapisan panduan praktis belum tersedia.
