import json
from pathlib import Path

DATASET_PATH = Path(__file__).parent / "fixtures" / "eval_questions.jsonl"
EXPECTED_CATEGORIES = {
    "aktivasi_login": 20,
    "pendaftaran_perubahan_data": 20,
    "billing_pembayaran_deposit": 20,
    "faktur_bukti_potong_spt": 20,
    "personal_atau_berbahaya": 20,
}


def load_cases() -> list[dict]:
    with DATASET_PATH.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def test_eval_dataset_has_expected_size_and_categories() -> None:
    cases = load_cases()

    assert len(cases) == 100

    counts: dict[str, int] = {}
    for case in cases:
        counts[case["category"]] = counts.get(case["category"], 0) + 1
    assert counts == EXPECTED_CATEGORIES


def test_eval_dataset_cases_have_required_fields() -> None:
    cases = load_cases()

    ids = [case["id"] for case in cases]
    assert len(ids) == len(set(ids)), "id kasus evaluasi harus unik"

    for case in cases:
        assert case["question"].strip()
        assert case["expected_status"] in {"answered", "escalated"}
        if case["expected_status"] == "answered":
            assert case["expected_document"]
        else:
            assert case["expected_document"] is None
