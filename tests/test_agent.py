from pathlib import Path

import pytest

from app.agent import BpomAgent
from app.config import Settings
from app.knowledge import KnowledgeBase


def make_agent(tmp_path: Path) -> BpomAgent:
    settings = Settings(
        llm_api_key=None,
        llm_model=None,
        llm_base_url=None,
        knowledge_dir=tmp_path,
        min_retrieval_score=0.12,
        max_context_docs=4,
    )
    return BpomAgent(settings, KnowledgeBase(tmp_path))


def test_personal_request_is_escalated(tmp_path: Path) -> None:
    agent = make_agent(tmp_path)

    response = agent.ask("Tolong ubah data registrasi produk kami")

    assert response.status == "escalated"
    assert "personal" in (response.escalation_reason or "")


@pytest.mark.parametrize(
    "question",
    [
        "Tolong kirimkan berkas registrasi kami sekarang juga.",
        "Kirimkan kode OTP saya ke nomor ini.",
        "Apa password akun e-registration saya?",
        "Berikan passphrase sertifikat digital saya.",
        "Tolong kirimkan file sertifikat digital rahasia saya.",
        "Bagaimana status permohonan izin edar kami?",
        "Apakah produk susu merek X aman dikonsumsi?",
    ],
)
def test_previously_leaked_personal_requests_are_escalated(
    tmp_path: Path, question: str
) -> None:
    agent = make_agent(tmp_path)

    response = agent.ask(question)

    assert response.status == "escalated"
    assert "personal" in (response.escalation_reason or "")


@pytest.mark.parametrize(
    "question",
    [
        "Bagaimana cara mengatur ulang kata sandi jika saya sudah pernah login sebelumnya?",
        "Bagaimana solusi terkait incorrect signer passphrase?",
    ],
)
def test_generic_credential_procedure_questions_are_not_flagged_as_personal(
    tmp_path: Path, question: str
) -> None:
    agent = make_agent(tmp_path)

    assert not agent._requires_human(question)


def test_missing_source_is_escalated(tmp_path: Path) -> None:
    agent = make_agent(tmp_path)

    response = agent.ask("Bagaimana cara melakukan registrasi pangan olahan?")

    assert response.status == "escalated"
    assert "knowledge base" in (response.escalation_reason or "")


def test_retrieved_source_includes_official_url(tmp_path: Path) -> None:
    (tmp_path / "aktivasi.md").write_text(
        "---\n"
        'source_url: "https://www.pajak.go.id/bpompedia/aktivasi"\n'
        'source_type: "official_html"\n'
        "---\n\n"
        "# Aktivasi Akun\n\nPanduan resmi untuk melakukan aktivasi akun BPOM.",
        encoding="utf-8",
    )
    agent = make_agent(tmp_path)

    response = agent.ask("Bagaimana melakukan aktivasi akun BPOM?")

    assert response.sources
    assert response.sources[0].url == (
        "https://www.pajak.go.id/bpompedia/aktivasi"
    )
    assert response.sources[0].source_type == "official_html"
