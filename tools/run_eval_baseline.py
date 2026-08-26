from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

from app.agent import BpomAgent
from app.config import get_settings
from app.knowledge import KnowledgeBase


def load_cases(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def evaluate(cases: list[dict], knowledge_base: KnowledgeBase, min_score: float, top_k: int) -> dict:
    per_category: dict[str, dict] = {}
    latencies_ms: list[float] = []

    for case in cases:
        category = case["category"]
        bucket = per_category.setdefault(
            category,
            {
                "total": 0,
                "retrieval_hits": 0,
                "source_correct": 0,
                "escalation_correct": 0,
                "escalated_count": 0,
                "expected_escalated_count": 0,
            },
        )
        bucket["total"] += 1

        start = time.perf_counter()
        requires_human = BpomAgent._requires_human(case["question"])
        results = [] if requires_human else knowledge_base.search(case["question"], limit=top_k)
        latencies_ms.append((time.perf_counter() - start) * 1000)

        top_score = results[0].score if results else 0.0
        would_escalate = requires_human or (not results) or top_score < min_score
        retrieved_documents = [result.chunk.document for result in results]

        if case["expected_status"] == "escalated":
            bucket["expected_escalated_count"] += 1
            if would_escalate:
                bucket["escalation_correct"] += 1
        else:
            if not would_escalate:
                bucket["retrieval_hits"] += 1
            if case.get("expected_document") in retrieved_documents:
                bucket["source_correct"] += 1

        if would_escalate:
            bucket["escalated_count"] += 1

    summary = {}
    for category, bucket in per_category.items():
        answered_total = bucket["total"] - bucket["expected_escalated_count"]
        summary[category] = {
            "total": bucket["total"],
            "retrieval_hit_rate": round(bucket["retrieval_hits"] / answered_total, 4)
            if answered_total
            else None,
            "source_correctness": round(bucket["source_correct"] / answered_total, 4)
            if answered_total
            else None,
            "escalation_precision": round(
                bucket["escalation_correct"] / bucket["expected_escalated_count"], 4
            )
            if bucket["expected_escalated_count"]
            else None,
        }

    return {
        "per_category": summary,
        "latency_ms": {
            "p50": round(statistics.median(latencies_ms), 3),
            "p95": round(
                statistics.quantiles(latencies_ms, n=20)[18], 3
            )
            if len(latencies_ms) >= 20
            else round(max(latencies_ms), 3),
            "max": round(max(latencies_ms), 3),
        },
        "min_retrieval_score": min_score,
        "top_k": top_k,
        "knowledge_chunks": len(knowledge_base.chunks),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Jalankan baseline evaluasi retrieval BPOM AI Agent."
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=None,
        help="Default: tests/fixtures/eval_questions.jsonl",
    )
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    project_root = args.project_root.resolve()
    dataset_path = args.dataset or (
        project_root / "tests" / "fixtures" / "eval_questions.jsonl"
    )
    settings = get_settings()
    knowledge_base = KnowledgeBase(settings.knowledge_dir)
    cases = load_cases(dataset_path)

    report = evaluate(
        cases,
        knowledge_base,
        min_score=settings.min_retrieval_score,
        top_k=settings.max_context_docs,
    )
    report["dataset"] = str(dataset_path.relative_to(project_root))
    report["case_count"] = len(cases)

    output_json = json.dumps(report, ensure_ascii=False, indent=2)
    print(output_json)

    if args.output:
        args.output.write_text(output_json + "\n", encoding="utf-8")
        print(f"\nLaporan disimpan ke {args.output}")


if __name__ == "__main__":
    main()
