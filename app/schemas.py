from typing import Literal

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1_000)


class Source(BaseModel):
    document: str
    section: str
    score: float
    url: str | None = None
    source_type: str | None = None


class AskResponse(BaseModel):
    status: Literal["answered", "escalated"]
    answer: str
    sources: list[Source] = Field(default_factory=list)
    escalation_reason: str | None = None


ManagedSourceType = Literal["operator_note", "internal_procedure", "faq"]
ManagedDocumentStatus = Literal["active", "review"]


class KnowledgeDocumentInput(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    content: str = Field(min_length=1, max_length=500_000)
    source_type: ManagedSourceType = "operator_note"
    status: ManagedDocumentStatus = "active"
    source_url: str | None = Field(default=None, max_length=2_048)
    tags: list[str] = Field(default_factory=list, max_length=12)


class KnowledgeDocumentSummary(BaseModel):
    id: str
    title: str
    relative_path: str
    folder: str
    source_type: str
    source_url: str | None = None
    validity_status: str | None = None
    extraction_status: str | None = None
    status: str
    updated_at: str
    size_bytes: int
    chunk_count: int
    preview: str
    editable: bool
    tags: list[str] = Field(default_factory=list)


class KnowledgeDocumentDetail(KnowledgeDocumentSummary):
    content: str


class KnowledgeStats(BaseModel):
    total_documents: int
    total_chunks: int
    editable_documents: int
    read_only_documents: int
    warning_documents: int
    source_types: dict[str, int]
    statuses: dict[str, int]


class KnowledgeDocumentPage(BaseModel):
    items: list[KnowledgeDocumentSummary]
    total: int
    page: int
    page_size: int
    stats: KnowledgeStats


class KnowledgeMutationResponse(BaseModel):
    message: str
    document: KnowledgeDocumentSummary | None = None
    knowledge_chunks: int


class KnowledgeGraphNode(BaseModel):
    id: str
    label: str
    kind: Literal["root", "source", "topic", "document", "chunk"]
    source_type: str | None = None
    status: str | None = None
    document_id: str | None = None
    editable: bool = False
    size: float = 1.0
    count: int | None = None


class KnowledgeGraphEdge(BaseModel):
    source: str
    target: str
    kind: Literal["contains", "topic"]
    weight: float = 1.0


class KnowledgeGraphResponse(BaseModel):
    nodes: list[KnowledgeGraphNode]
    edges: list[KnowledgeGraphEdge]
    total_documents: int
    displayed_documents: int
    total_chunks: int
    truncated: bool


class KnowledgeCapabilities(BaseModel):
    access_mode: Literal["local", "token_required", "disabled"]
    requires_token: bool
    write_enabled: bool
    max_document_chars: int = 500_000
