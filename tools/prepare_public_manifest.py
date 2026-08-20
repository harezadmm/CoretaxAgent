from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    manifest_path = project_root / "knowledge" / "_meta" / "source-manifest.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    changed = 0
    for record in payload.get("records", []):
        if record.get("source_type") == "official_html" and record.get("source_file"):
            record["source_file"] = ""
            changed += 1

    manifest_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest diperbarui: {changed} cache HTML mentah tidak dipublikasikan.")


if __name__ == "__main__":
    main()
