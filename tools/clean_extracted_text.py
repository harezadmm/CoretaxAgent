from __future__ import annotations

import argparse
import re
from pathlib import Path

from ftfy import fix_text


FAQ_MARKERS = (
    "\nDilihat sebanyak:",
    "\n###### Apakah informasi ini membantu?",
    "\n##### Berikan Masukan",
)


def clean_file(path: Path, is_faq: bool) -> bool:
    original = path.read_text(encoding="utf-8-sig")
    cleaned = fix_text(original)
    if is_faq:
        for marker in FAQ_MARKERS:
            if marker in cleaned:
                cleaned = cleaned.split(marker, 1)[0].rstrip() + "\n"
                break
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    if cleaned == original:
        return False
    path.write_text(cleaned, encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bersihkan karakter rusak dan boilerplate hasil ekstraksi RAG."
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()
    knowledge_dir = args.project_root.resolve() / "knowledge"

    changed = 0
    checked = 0
    for path in sorted((knowledge_dir / "manuals").glob("*.md")):
        checked += 1
        changed += int(clean_file(path, is_faq=False))
    for path in sorted((knowledge_dir / "bpompedia").glob("*.md")):
        checked += 1
        changed += int(clean_file(path, is_faq=True))

    print(f"Diperiksa {checked} file; diperbarui {changed} file.")


if __name__ == "__main__":
    main()
