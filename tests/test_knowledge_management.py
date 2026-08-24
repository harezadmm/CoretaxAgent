from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

import app.main as main_module
from app.knowledge import KnowledgeBase
from app.knowledge_management import (
    InvalidDocumentError,
    KnowledgeManager,
    ReadOnlyDocumentError,
)
from app.schemas import KnowledgeDocumentInput


def make_manager(tmp_path: Path) -> KnowledgeManager:
    return KnowledgeManager(tmp_path, KnowledgeBase(tmp_path))


def test_managed_document_can_be_created_updated_and_soft_deleted(
    tmp_path: Path,
) -> None:
    manager = make_manager(tmp_path)
    created = manager.create_document(
        KnowledgeDocumentInput(
            title="SOP Aktivasi Akun",
            content="Pastikan pengguna mengikuti alur aktivasi akun resmi.",
            source_type="internal_procedure",
            tags=["aktivasi", "akun"],
        )
    )

    assert created.document is not None
    assert created.document.editable is True
    assert manager.knowledge_base.search("alur aktivasi akun")

    document_id = created.document.id
    updated = manager.update_document(
        document_id,
        KnowledgeDocumentInput(
            title="SOP Aktivasi Akun Terbaru",
            content="Gunakan panduan terbaru dan eskalasi jika identitas gagal.",
            source_type="internal_procedure",
            status="review",
            tags=["aktivasi", "eskalasi"],
        ),
    )

    assert updated.document is not None
    assert updated.document.status == "review"
    assert "panduan terbaru" in manager.get_document(document_id).content

    deleted = manager.delete_document(document_id)

    assert deleted.document is None
    assert manager.knowledge_base.search("panduan terbaru") == []
    assert list((tmp_path / "_trash").glob("*.md"))


def test_synced_official_document_is_read_only(tmp_path: Path) -> None:
    official_dir = tmp_path / "coretaxpedia"
    official_dir.mkdir()
    (official_dir / "aktivasi.md").write_text(
        "---\nsource_type: official_html\n---\n\n# Aktivasi\n\nPanduan resmi.",
        encoding="utf-8",
    )
    manager = make_manager(tmp_path)
    document = manager.list_documents(page_size=10).items[0]

    assert document.editable is False
    with pytest.raises(ReadOnlyDocumentError):
        manager.delete_document(document.id)
    with pytest.raises(ReadOnlyDocumentError):
        manager.update_document(
            document.id,
            KnowledgeDocumentInput(title="Diubah", content="Tidak boleh berubah."),
        )


def test_managed_document_rejects_unsafe_source_url(tmp_path: Path) -> None:
    manager = make_manager(tmp_path)

    with pytest.raises(InvalidDocumentError):
        manager.create_document(
            KnowledgeDocumentInput(
                title="Sumber tidak aman",
                content="Konten uji.",
                source_url="javascript:alert(1)",
            )
        )


def test_knowledge_management_api_crud_and_graph(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    knowledge_base = KnowledgeBase(tmp_path)
    manager = KnowledgeManager(tmp_path, knowledge_base)
    monkeypatch.setattr(main_module, "knowledge_base", knowledge_base)
    monkeypatch.setattr(main_module, "knowledge_manager", manager)
    client = TestClient(main_module.app)

    created = client.post(
        "/api/knowledge/documents",
        json={
            "title": "FAQ Kode Billing",
            "content": "Kode billing dibuat melalui menu pembayaran.",
            "source_type": "faq",
            "status": "active",
            "tags": ["billing"],
        },
    )

    assert created.status_code == 200
    document_id = created.json()["document"]["id"]
    listing = client.get("/api/knowledge/documents?q=billing")
    graph = client.get("/api/knowledge/graph?q=billing&limit=100")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert graph.status_code == 200
    assert graph.json()["displayed_documents"] == 1

    updated = client.put(
        f"/api/knowledge/documents/{document_id}",
        json={
            "title": "FAQ Kode Billing Baru",
            "content": "Kode billing baru mengikuti menu pembayaran Coretax.",
            "source_type": "faq",
            "status": "review",
            "tags": ["billing", "pembayaran"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["document"]["status"] == "review"

    deleted = client.delete(f"/api/knowledge/documents/{document_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/knowledge/documents/{document_id}").status_code == 404


def test_remote_management_is_disabled_without_admin_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/knowledge/documents",
            "headers": [],
            "scheme": "http",
            "server": ("example.test", 80),
            "client": ("203.0.113.10", 50_000),
            "query_string": b"",
        }
    )

    with pytest.raises(HTTPException) as error:
        main_module.require_knowledge_access(request, None)

    assert error.value.status_code == 503


def test_deployed_management_requires_the_configured_admin_token(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    knowledge_base = KnowledgeBase(tmp_path)
    manager = KnowledgeManager(tmp_path, knowledge_base)
    monkeypatch.setattr(main_module, "knowledge_base", knowledge_base)
    monkeypatch.setattr(main_module, "knowledge_manager", manager)
    monkeypatch.setattr(
        main_module,
        "settings",
        replace(main_module.settings, rag_admin_token="a-secure-test-token"),
    )
    monkeypatch.setenv("VERCEL", "1")
    client = TestClient(main_module.app)

    assert client.get("/api/knowledge/documents").status_code == 401
    assert (
        client.get(
            "/api/knowledge/documents",
            headers={"X-RAG-Admin-Token": "wrong-token"},
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/knowledge/documents",
            headers={"X-RAG-Admin-Token": "a-secure-test-token"},
        ).status_code
        == 200
    )
