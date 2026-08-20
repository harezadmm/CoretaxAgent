from pathlib import Path

from app.knowledge import KnowledgeBase


def test_knowledge_base_loads_and_finds_relevant_chunk(tmp_path: Path) -> None:
    (tmp_path / "panduan.md").write_text(
        "# Panduan\n\n## Aktivasi akun\n\nAktivasi akun mengikuti panduan resmi.",
        encoding="utf-8",
    )
    knowledge_base = KnowledgeBase(tmp_path)

    results = knowledge_base.search("Bagaimana aktivasi akun?", limit=2)

    assert results
    assert results[0].chunk.section == "Aktivasi akun"
    assert results[0].chunk.document == "panduan.md"


def test_knowledge_base_returns_empty_for_unrelated_question(tmp_path: Path) -> None:
    (tmp_path / "panduan.txt").write_text(
        "Informasi umum mengenai aktivasi akun.",
        encoding="utf-8",
    )
    knowledge_base = KnowledgeBase(tmp_path)

    assert knowledge_base.search("Bagaimana cuaca hari ini?") == []


def test_front_matter_is_not_indexed_and_duplicate_chunks_are_removed(
    tmp_path: Path,
) -> None:
    content = (
        "---\nsource_url: https://example.test/rahasia\n---\n\n"
        "# Panduan\n\nInformasi aktivasi akun resmi."
    )
    (tmp_path / "satu.md").write_text(content, encoding="utf-8")
    (tmp_path / "dua.md").write_text(content, encoding="utf-8")

    knowledge_base = KnowledgeBase(tmp_path)

    assert all("source_url" not in chunk.content for chunk in knowledge_base.chunks)
    assert sum("aktivasi akun" in chunk.content for chunk in knowledge_base.chunks) == 1
    assert knowledge_base.chunks[0].source_url == "https://example.test/rahasia"


def test_negated_document_is_penalized_when_query_is_not_negated(
    tmp_path: Path,
) -> None:
    (tmp_path / "pengguna.md").write_text(
        "# Akses Coretax bagi pengguna DJP Online\n\nPanduan membuat kata sandi baru.",
        encoding="utf-8",
    )
    (tmp_path / "bukan-pengguna.md").write_text(
        "# Akses Coretax bagi bukan pengguna DJP Online\n\nPanduan aktivasi akun.",
        encoding="utf-8",
    )

    results = KnowledgeBase(tmp_path).search(
        "akses Coretax bagi pengguna DJP Online",
        limit=2,
    )

    assert results[0].chunk.document == "pengguna.md"


def test_mostly_image_only_pdf_extract_is_not_indexed(tmp_path: Path) -> None:
    (tmp_path / "scan.md").write_text(
        "# Scan\n\n## Halaman 1\n\n"
        "[Halaman tidak memiliki teks yang dapat diekstrak.]\n\n"
        "## Halaman 2\n\n"
        "[Halaman tidak memiliki teks yang dapat diekstrak.]",
        encoding="utf-8",
    )

    assert KnowledgeBase(tmp_path).chunks == []
