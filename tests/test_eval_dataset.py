"""Retrieval evaluation against the BPOM corpus.

The fixture holds 100 questions with known source regulations, built by
tools/build_eval_dataset.py. Integrity checks always run. The retrieval checks
score search() against the real corpus, which costs about a second per
question at 51k chunks -- so the default run scores a deterministic
20-question subset, and RUN_EVAL=1 scores all 100.

Measured baseline (2026-08-27, 263 documents / 51,482 chunks) lives in
docs/EVAL_BASELINE.md; thresholds sit under it with margin, so they catch a
retrieval regression rather than day-to-day jitter.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app.config import get_settings
from app.knowledge import KnowledgeBase

FIXTURE = Path(__file__).parent / "fixtures" / "eval_questions.jsonl"
SUBSET_SIZE = 20
SUBSET_STRIDE = 5  # every 5th question -> stable, style-mixed 20 of 100


def load_questions() -> list[dict]:
    lines = FIXTURE.read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


@pytest.fixture(scope="session")
def corpus() -> KnowledgeBase:
    knowledge_dir = get_settings().knowledge_dir
    if not knowledge_dir.is_dir():
        pytest.skip("Direktori knowledge tidak tersedia")
    return KnowledgeBase(knowledge_dir)


def test_fixture_is_complete_and_well_formed() -> None:
    questions = load_questions()
    assert len(questions) == 100
    assert {q["style"] for q in questions} == {"topical", "known_item"}
    assert len({q["id"] for q in questions}) == 100
    assert all(q["question"].strip().endswith("?") for q in questions)


def test_every_expected_document_exists_in_corpus(corpus: KnowledgeBase) -> None:
    known = {chunk.document for chunk in corpus.chunks}
    missing = [q["id"] for q in load_questions() if q["expected_document"] not in known]
    assert missing == []


def _score(corpus: KnowledgeBase, questions: list[dict]) -> dict[str, float]:
    hits5 = {"topical": 0, "known_item": 0}
    total = {"topical": 0, "known_item": 0}
    for question in questions:
        total[question["style"]] += 1
        results = corpus.search(question["question"], limit=5)
        documents = [result.chunk.document for result in results]
        if question["expected_document"] in documents:
            hits5[question["style"]] += 1
    overall = sum(hits5.values()) / max(1, sum(total.values()))
    known = hits5["known_item"] / max(1, total["known_item"])
    return {"overall": overall, "known_item": known}


def test_retrieval_subset_meets_baseline(corpus: KnowledgeBase) -> None:
    questions = load_questions()[::SUBSET_STRIDE]
    assert len(questions) == SUBSET_SIZE
    scores = _score(corpus, questions)
    # Full-run baseline is 0.93 overall; a 20-question subset swings harder,
    # so the gate sits lower and exists to catch collapses, not wobbles.
    assert scores["overall"] >= 0.75, f"hit@5 subset {scores['overall']:.2f} < 0.75"


@pytest.mark.skipif(
    os.environ.get("RUN_EVAL") != "1",
    reason="Eval penuh ~100 detik; jalankan dengan RUN_EVAL=1",
)
def test_retrieval_full_meets_baseline(corpus: KnowledgeBase) -> None:
    scores = _score(corpus, load_questions())
    assert scores["overall"] >= 0.85, f"hit@5 total {scores['overall']:.2f} < 0.85"
    assert scores["known_item"] >= 0.85, f"hit@5 kutipan {scores['known_item']:.2f} < 0.85"
