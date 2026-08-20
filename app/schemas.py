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
