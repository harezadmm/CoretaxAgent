from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    openai_model: str | None
    knowledge_dir: Path
    min_retrieval_score: float
    max_context_docs: int


def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[1]
    knowledge_value = os.getenv("KNOWLEDGE_DIR", "knowledge")
    knowledge_dir = Path(knowledge_value)
    if not knowledge_dir.is_absolute():
        knowledge_dir = project_root / knowledge_dir

    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL") or None,
        knowledge_dir=knowledge_dir,
        min_retrieval_score=float(os.getenv("MIN_RETRIEVAL_SCORE", "0.12")),
        max_context_docs=int(os.getenv("MAX_CONTEXT_DOCS", "4")),
    )

