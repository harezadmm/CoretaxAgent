import dataclasses

import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.config import get_settings
from app.main import app


client = TestClient(app)


@pytest.fixture
def configured_token(monkeypatch):
    """Put the app in token_required mode with the given admin token."""

    def _configure(token: str) -> None:
        monkeypatch.setattr(
            main_module,
            "settings",
            dataclasses.replace(main_module.settings, rag_admin_token=token),
        )

    return _configure


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["knowledge_chunks"] >= 1


def test_dashboard_is_served() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "Coretax Agent" in response.text


def test_non_ascii_stored_token_rejects_instead_of_crashing(configured_token) -> None:
    """A BOM on the configured token used to raise TypeError inside
    compare_digest, turning every RAG Management request into a 500."""
    configured_token("﻿rahasia")

    response = client.get(
        "/api/knowledge/documents",
        headers={"X-RAG-Admin-Token": "rahasia"},
    )

    assert response.status_code == 401


def test_matching_token_grants_access(configured_token) -> None:
    configured_token("rahasia")

    response = client.get(
        "/api/knowledge/documents",
        headers={"X-RAG-Admin-Token": "rahasia"},
    )

    assert response.status_code == 200


def test_bom_and_padding_are_stripped_from_admin_token(monkeypatch) -> None:
    monkeypatch.setenv("RAG_ADMIN_TOKEN", "﻿  rahasia  ")

    assert get_settings().rag_admin_token == "rahasia"


def test_personal_question_is_escalated_by_api() -> None:
    response = client.post(
        "/api/ask",
        json={"question": "Tolong ubah data NPWP saya"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "escalated"
