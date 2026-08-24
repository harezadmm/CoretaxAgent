from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from app.knowledge import KnowledgeBase


MOJIBAKE_MARKERS = ("â€", "ï¬", "�")
SAMPLE_QUERIES = (
    "Bagaimana cara akses Coretax bagi pengguna DJP Online?",
    "Bagaimana cara mendapatkan kode otorisasi DJP?",
    "Bagaimana cara membuat kode billing mandiri?",
    "Bagaimana cara melaporkan SPT tahunan orang pribadi?",
    "Bagaimana melakukan impersonate?",
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit knowledge base resmi Coretax.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()
    project_root = args.project_root.resolve()
    knowledge_dir = project_root / "knowledge"
    manifest_path = knowledge_dir / "_meta" / "source-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    base_records = manifest["records"]
    regulations_manifest_path = knowledge_dir / "_meta" / "regulations-manifest.json"
    if regulations_manifest_path.exists():
        regulations_manifest = json.loads(
            regulations_manifest_path.read_text(encoding="utf-8")
        )
    else:
        regulations_manifest = {"records": []}
    regulation_records = [
        {"source_type": "official_regulation", **record}
        for record in regulations_manifest.get("records", [])
    ]
    records = base_records + regulation_records

    status_counts = Counter(record["status"] for record in records)
    type_counts = Counter(record["source_type"] for record in records)
    hash_counts = Counter(
        record.get("sha256") or record.get("source_sha256")
        for record in records
        if record.get("sha256") or record.get("source_sha256")
    )
    duplicate_groups = sum(count > 1 for count in hash_counts.values())
    missing_files: list[str] = []
    mojibake_files: list[str] = []
    for record in records:
        for key in ("source_file", "rag_file"):
            relative = record.get(key)
            if relative and not (project_root / relative).exists():
                missing_files.append(relative)
        rag_relative = record.get("rag_file")
        if rag_relative:
            text = (project_root / rag_relative).read_text(encoding="utf-8")
            if any(marker in text for marker in MOJIBAKE_MARKERS):
                mojibake_files.append(rag_relative)

    pdf_records = [record for record in base_records if record["source_type"] == "official_pdf"]
    empty_pages = sum(record.get("empty_pages") or 0 for record in pdf_records)
    total_pages = sum(record.get("pages") or 0 for record in pdf_records)

    knowledge_base = KnowledgeBase(knowledge_dir)

    print(
        f"Sumber resmi: {len(records)} "
        f"(Coretax corpus: {len(base_records)}; regulasi DJP: {len(regulation_records)})"
    )
    print(f"Jenis: {dict(type_counts)}")
    print(f"Status: {dict(status_counts)}")
    print(f"PDF pages: {total_pages}; empty extracted pages: {empty_pages}")
    print(f"Duplicate content hash groups: {duplicate_groups}")
    print(f"Missing files: {len(missing_files)}")
    print(f"Mojibake files: {len(mojibake_files)}")
    print(f"Unique RAG chunks after deduplication: {len(knowledge_base.chunks)}")

    print("\nSample retrieval:")
    for query in SAMPLE_QUERIES:
        results = knowledge_base.search(query, limit=1)
        if not results:
            print(f"- {query} -> NO RESULT")
            continue
        result = results[0]
        print(
            f"- {query} -> {result.chunk.document} | "
            f"{result.chunk.section} | {result.score:.4f}"
        )

    if missing_files or mojibake_files or status_counts.get("error", 0):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
