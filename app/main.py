from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.agent import CoretaxAgent
from app.config import get_settings
from app.knowledge import KnowledgeBase
from app.schemas import AskRequest, AskResponse


settings = get_settings()
knowledge_base = KnowledgeBase(settings.knowledge_dir)
agent = CoretaxAgent(settings, knowledge_base)

app = FastAPI(
    title="Coretax AI Agent",
    description="Prototype agent informasi Coretax dengan RAG dan eskalasi.",
    version="0.1.0",
)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    """Serve the local Coretax support-operations dashboard."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "knowledge_chunks": len(knowledge_base.chunks),
        "model_configured": bool(
            settings.openai_api_key and settings.openai_model
        ),
    }


@app.post("/api/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    return agent.ask(request.question)
