from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["knowledge_chunks"] >= 1


def test_personal_question_is_escalated_by_api() -> None:
    response = client.post(
        "/api/ask",
        json={"question": "Tolong ubah data NPWP saya"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "escalated"
