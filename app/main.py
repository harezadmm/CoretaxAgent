import os
import secrets
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.agent import BpomAgent
from app.config import get_settings
from app.knowledge import KnowledgeBase
from app.knowledge_management import (
    DocumentNotFoundError,
    InvalidDocumentError,
    KnowledgeManagementError,
    KnowledgeManager,
    ReadOnlyDocumentError,
)
from app.schemas import (
    AskRequest,
    AskResponse,
    KnowledgeCapabilities,
    KnowledgeDocumentDetail,
    KnowledgeDocumentInput,
    KnowledgeDocumentPage,
    KnowledgeGraphResponse,
    KnowledgeMutationResponse,
)


settings = get_settings()
knowledge_base = KnowledgeBase(settings.knowledge_dir)
knowledge_manager = KnowledgeManager(settings.knowledge_dir, knowledge_base)
agent = BpomAgent(settings, knowledge_base)

app = FastAPI(
    title="BPOM AI Agent",
    description="Prototype agent informasi BPOM dengan RAG dan eskalasi.",
    version="0.1.0",
)

# public/ is the CDN output directory on Vercel, which means it is served by
# the edge and deliberately left out of the function bundle. Mounting it
# unconditionally crashes the function at import time there, so the mount and
# the dashboard route below exist only to back local development.
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
STATIC_DIR = PUBLIC_DIR / "static"
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    """Serve the local BPOM support-operations dashboard."""
    index_file = PUBLIC_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Dashboard tidak tersedia.")
    return FileResponse(index_file)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "knowledge_chunks": len(knowledge_base.chunks),
        "model_configured": bool(
            settings.llm_api_key and settings.llm_model
        ),
    }


@app.post("/api/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    return agent.ask(request.question)


def _local_management_allowed(request: Request) -> bool:
    if os.getenv("VERCEL") or os.getenv("VERCEL_ENV"):
        return False
    client_host = request.client.host.casefold() if request.client else ""
    return client_host in {"127.0.0.1", "::1", "localhost", "testclient"}


def _knowledge_access_mode(request: Request) -> str:
    if settings.rag_admin_token:
        return "token_required"
    if _local_management_allowed(request):
        return "local"
    return "disabled"


def require_knowledge_access(
    request: Request,
    admin_token: Annotated[
        str | None,
        Header(alias="X-RAG-Admin-Token"),
    ] = None,
) -> None:
    mode = _knowledge_access_mode(request)
    if mode == "local":
        return
    if mode == "disabled":
        raise HTTPException(
            status_code=503,
            detail="RAG Management dinonaktifkan. Konfigurasikan RAG_ADMIN_TOKEN.",
        )
    expected = settings.rag_admin_token or ""
    # compare_digest() rejects str arguments holding non-ASCII characters with
    # a TypeError, which surfaces as a 500 instead of the 401 the caller earned.
    # Comparing the UTF-8 bytes keeps the timing guarantee without that trap.
    if not admin_token or not secrets.compare_digest(
        admin_token.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Token RAG Management tidak valid.")


def _raise_management_http_error(error: KnowledgeManagementError) -> None:
    if isinstance(error, DocumentNotFoundError):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, ReadOnlyDocumentError):
        raise HTTPException(status_code=403, detail=str(error)) from error
    if isinstance(error, InvalidDocumentError):
        raise HTTPException(status_code=422, detail=str(error)) from error
    raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/api/knowledge/capabilities", response_model=KnowledgeCapabilities)
def knowledge_capabilities(request: Request) -> KnowledgeCapabilities:
    mode = _knowledge_access_mode(request)
    return KnowledgeCapabilities(
        access_mode=mode,
        requires_token=mode == "token_required",
        write_enabled=mode in {"local", "token_required"},
    )


@app.get(
    "/api/knowledge/documents",
    response_model=KnowledgeDocumentPage,
    dependencies=[Depends(require_knowledge_access)],
)
def list_knowledge_documents(
    q: Annotated[str, Query(max_length=200)] = "",
    source_type: Annotated[str | None, Query(max_length=64)] = None,
    status_filter: Annotated[str | None, Query(alias="status", max_length=32)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 40,
) -> KnowledgeDocumentPage:
    return knowledge_manager.list_documents(
        query=q,
        source_type=source_type,
        status=status_filter,
        page=page,
        page_size=page_size,
    )


@app.get(
    "/api/knowledge/graph",
    response_model=KnowledgeGraphResponse,
    dependencies=[Depends(require_knowledge_access)],
)
def knowledge_graph(
    q: Annotated[str, Query(max_length=200)] = "",
    source_type: Annotated[str | None, Query(max_length=64)] = None,
    status_filter: Annotated[str | None, Query(alias="status", max_length=32)] = None,
    limit: Annotated[int, Query(ge=100, le=20_000)] = 700,
    unit: Annotated[str, Query(pattern="^(document|chunk)$")] = "document",
) -> KnowledgeGraphResponse:
    return knowledge_manager.graph(
        query=q,
        source_type=source_type,
        status=status_filter,
        limit=limit,
        unit=unit,
    )


@app.get(
    "/api/knowledge/documents/{document_id}",
    response_model=KnowledgeDocumentDetail,
    dependencies=[Depends(require_knowledge_access)],
)
def get_knowledge_document(document_id: str) -> KnowledgeDocumentDetail:
    try:
        return knowledge_manager.get_document(document_id)
    except KnowledgeManagementError as error:
        _raise_management_http_error(error)


@app.post(
    "/api/knowledge/documents",
    response_model=KnowledgeMutationResponse,
    dependencies=[Depends(require_knowledge_access)],
)
def create_knowledge_document(
    payload: KnowledgeDocumentInput,
) -> KnowledgeMutationResponse:
    try:
        return knowledge_manager.create_document(payload)
    except KnowledgeManagementError as error:
        _raise_management_http_error(error)


@app.put(
    "/api/knowledge/documents/{document_id}",
    response_model=KnowledgeMutationResponse,
    dependencies=[Depends(require_knowledge_access)],
)
def update_knowledge_document(
    document_id: str,
    payload: KnowledgeDocumentInput,
) -> KnowledgeMutationResponse:
    try:
        return knowledge_manager.update_document(document_id, payload)
    except KnowledgeManagementError as error:
        _raise_management_http_error(error)


@app.delete(
    "/api/knowledge/documents/{document_id}",
    response_model=KnowledgeMutationResponse,
    dependencies=[Depends(require_knowledge_access)],
)
def delete_knowledge_document(document_id: str) -> KnowledgeMutationResponse:
    try:
        return knowledge_manager.delete_document(document_id)
    except KnowledgeManagementError as error:
        _raise_management_http_error(error)
