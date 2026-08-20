from pathlib import Path

from app.agent import CoretaxAgent
from app.config import Settings
from app.knowledge import KnowledgeBase


def make_agent(tmp_path: Path) -> CoretaxAgent:
    settings = Settings(
        openai_api_key=None,
        openai_model=None,
        knowledge_dir=tmp_path,
        min_retrieval_score=0.12,
        max_context_docs=4,
    )
    return CoretaxAgent(settings, KnowledgeBase(tmp_path))


def test_personal_request_is_escalated(tmp_path: Path) -> None:
    agent = make_agent(tmp_path)

    response = agent.ask("Tolong ubah data NPWP saya")

    assert response.status == "escalated"
    assert "personal" in (response.escalation_reason or "")


def test_missing_source_is_escalated(tmp_path: Path) -> None:
    agent = make_agent(tmp_path)

    response = agent.ask("Bagaimana cara melakukan aktivasi akun?")

    assert response.status == "escalated"
    assert "knowledge base" in (response.escalation_reason or "")


def test_retrieved_source_includes_official_url(tmp_path: Path) -> None:
    (tmp_path / "aktivasi.md").write_text(
        "---\n"
        'source_url: "https://www.pajak.go.id/coretaxpedia/aktivasi"\n'
        'source_type: "official_html"\n'
        "---\n\n"
        "# Aktivasi Akun\n\nPanduan resmi untuk melakukan aktivasi akun Coretax.",
        encoding="utf-8",
    )
    agent = make_agent(tmp_path)

    response = agent.ask("Bagaimana melakukan aktivasi akun Coretax?")

    assert response.sources
    assert response.sources[0].url == (
        "https://www.pajak.go.id/coretaxpedia/aktivasi"
    )
    assert response.sources[0].source_type == "official_html"
