from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


# Any OpenAI-compatible endpoint works here. Vercel's AI Gateway is the default
# when its key is present because it fronts many providers behind one contract,
# so switching models is an env change rather than a code change.
AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1"


@dataclass(frozen=True)
class Settings:
    llm_api_key: str | None
    llm_model: str | None
    llm_base_url: str | None
    knowledge_dir: Path
    min_retrieval_score: float
    max_context_docs: int
    rag_admin_token: str | None = None


def _clean_secret(name: str) -> str | None:
    """Read a secret, dropping the stray BOM and padding tooling likes to add.

    Piping a value into `vercel env add` from a Windows shell can prepend a
    UTF-8 BOM, which then travels all the way into the comparison and breaks
    it, so normalise the value at the edge instead.
    """
    value = os.getenv(name) or ""
    return value.lstrip("﻿").strip() or None


def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[1]
    knowledge_value = os.getenv("KNOWLEDGE_DIR", "knowledge")
    knowledge_dir = Path(knowledge_value)
    if not knowledge_dir.is_absolute():
        knowledge_dir = project_root / knowledge_dir

    # Prefer the neutral names, fall back to the OpenAI-specific ones this
    # project started with so existing deployments keep working untouched.
    gateway_key = _clean_secret("AI_GATEWAY_API_KEY")
    llm_api_key = _clean_secret("LLM_API_KEY") or gateway_key or _clean_secret("OPENAI_API_KEY")
    base_url = _clean_secret("LLM_BASE_URL")
    if not base_url and gateway_key:
        base_url = AI_GATEWAY_BASE_URL

    return Settings(
        llm_api_key=llm_api_key,
        llm_model=_clean_secret("LLM_MODEL") or _clean_secret("OPENAI_MODEL"),
        llm_base_url=base_url,
        knowledge_dir=knowledge_dir,
        min_retrieval_score=float(os.getenv("MIN_RETRIEVAL_SCORE", "0.12")),
        max_context_docs=int(os.getenv("MAX_CONTEXT_DOCS", "4")),
        rag_admin_token=_clean_secret("RAG_ADMIN_TOKEN"),
    )
