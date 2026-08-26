from __future__ import annotations

from pathlib import Path

import pymupdf


SAMPLES = {
    "panduan-ringkas": "panduan-ringkas-bpom-pdf-*.pdf",
    "aktivasi-akun": "panduan-aktivasi-akun-bpom-2025-*.pdf",
    "kode-otorisasi": "panduan-kode-otorisasi-akun-bpom-2025-*.pdf",
}


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    source_dir = project_root / "knowledge" / "source_files" / "pdfs"
    output_dir = project_root / "work" / "pdf_qa"
    output_dir.mkdir(parents=True, exist_ok=True)

    for label, pattern in SAMPLES.items():
        matches = sorted(source_dir.glob(pattern))
        if not matches:
            raise FileNotFoundError(f"Sampel tidak ditemukan: {pattern}")
        document = pymupdf.open(matches[0])
        page = document[0]
        pixmap = page.get_pixmap(
            matrix=pymupdf.Matrix(1.6, 1.6),
            alpha=False,
        )
        output_path = output_dir / f"{label}-page-1.png"
        pixmap.save(output_path)
        document.close()
        print(output_path)


if __name__ == "__main__":
    main()
