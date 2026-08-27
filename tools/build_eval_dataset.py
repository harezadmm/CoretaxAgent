"""Build the retrieval-evaluation dataset from the BPOM corpus.

Rebuilds ``tests/fixtures/eval_questions.jsonl``: 100 questions, each carrying
the document that should answer it. Two styles, because they fail differently:

* ``topical`` -- the question paraphrases the regulation's subject ("Peraturan
  mana yang mengatur ...?"). Measures whether a user describing a topic in
  their own frame reaches the right regulation.
* ``known_item`` -- the question quotes a fragment lifted from the body text,
  the way someone pastes half a provision into a search box. Measures whether
  an exact provision can be traced back to its source.

Everything is deterministic (fixed seed, sorted inputs), so rebuilding on the
same corpus yields the same file and the baseline stays comparable over time.

Usage:

    python tools/build_eval_dataset.py
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

from app.config import get_settings
from app.knowledge import KnowledgeBase
from app.knowledge_management import KnowledgeManager

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "tests" / "fixtures" / "eval_questions.jsonl"

TOPICAL_COUNT = 60
KNOWN_ITEM_COUNT = 40
SEED = 20260827

# Everything a regulation title says before it gets to its actual subject.
TITLE_BOILERPLATE = re.compile(
    r"^(peraturan|keputusan|perka|perbpom|kepka)\s*(kepala\s+)?"
    r"(badan\s+pengawas\s+obat\s+dan\s+makanan|bpom)?"
    r"(\s+(republik\s+indonesia|ri))?"
    r"(\s+no\.?(mor)?\s*\S+)?(\s+tahun\s+\d{4})?(\s+tentang)?\s*",
    re.IGNORECASE,
)
AMENDMENT_PREFIX = re.compile(
    r"^perubahan(\s+\w+)?\s+atas\s+", re.IGNORECASE
)

TOPICAL_TEMPLATES = [
    "Peraturan BPOM mana yang mengatur tentang {topic}?",
    "Apa dasar hukum BPOM mengenai {topic}?",
    "Bagaimana ketentuan BPOM tentang {topic}?",
    "Regulasi apa yang menjadi acuan untuk {topic}?",
]

# Body lines that are letterhead rather than substance.
BODY_NOISE = re.compile(
    r"badan\s+pengawas\s+obat|dengan\s+rahmat|republik\s+indonesia|menimbang|mengingat"
    r"|memutuskan|menetapkan|berita\s+negara|ditetapkan\s+di|www\.|halaman"
    # Citations of other statutes live in every regulation's "Mengingat" block,
    # so a fragment quoting one identifies the entire corpus, not its source.
    r"|undang\s*-\s*undang|peraturan\s+pemerintah|peraturan\s+presiden"
    r"|lembaran\s+negara|keputusan\s+presiden",
    re.IGNORECASE,
)

# Words that carry a statute's plumbing rather than its subject. A fragment
# made mostly of these ("di antara ayat (1) dan ayat (2) disisipkan...") reads
# identically in every amendment regulation, so it cannot identify its source
# and only adds noise to the baseline.
STRUCTURAL_WORDS = {
    "pasal", "ayat", "huruf", "angka", "butir", "disisipkan", "diubah",
    "dihapus", "ditambahkan", "sebagaimana", "dimaksud", "dalam", "pada",
    "dan", "atau", "yang", "dengan", "untuk", "dari", "ke", "di", "sehingga",
    "berbunyi", "berikut", "antara", "ketentuan", "sebagai",
}


def mostly_structural(words: list[str]) -> bool:
    plain = [re.sub(r"[^a-z]", "", word.lower()) for word in words]
    # Single letters ("huruf a, huruf b") and bare numbers count as plumbing too.
    hits = sum(word in STRUCTURAL_WORDS or len(word) <= 2 for word in plain)
    substantive = sum(len(word) >= 5 and word not in STRUCTURAL_WORDS for word in plain)
    return hits > len(words) * 0.45 or substantive < 4


def topic_of(title: str) -> str | None:
    """The subject a title is about, or None when the title never states one."""
    topic = AMENDMENT_PREFIX.sub("", title.strip())
    topic = TITLE_BOILERPLATE.sub("", topic).strip(" .,-")
    # "Peraturan BPOM No. 12 Tahun 2019" reduces to nothing; a subject of one
    # or two words ("Obat", "Label Gizi") makes a question too ambiguous to
    # score fairly against 263 regulations.
    if len(topic.split()) < 3:
        return None
    return topic


def quote_of(body: str, rng: random.Random) -> str | None:
    """A 9-14 word fragment from the substance of the document."""
    candidates = []
    for raw_line in body.splitlines():
        line = raw_line.strip(" #*-•\t")
        words = line.split()
        if len(words) < 12 or BODY_NOISE.search(line):
            continue
        if sum(ch.isdigit() for ch in line) > len(line) * 0.2:
            continue
        candidates.append(words)
    if not candidates:
        return None
    rng.shuffle(candidates)
    for words in candidates:
        start = rng.randrange(0, max(1, len(words) - 12))
        fragment = words[start : start + rng.randint(9, 14)]
        if mostly_structural(fragment):
            continue
        return " ".join(fragment).strip(" .,;:")
    return None


def main() -> None:
    settings = get_settings()
    knowledge_base = KnowledgeBase(settings.knowledge_dir)
    manager = KnowledgeManager(settings.knowledge_dir, knowledge_base)
    records = sorted(
        manager.list_documents(page_size=100, page=1).items
        + manager.list_documents(page_size=100, page=2).items
        + manager.list_documents(page_size=100, page=3).items,
        key=lambda record: record.relative_path,
    )
    bodies: dict[str, str] = {}
    for chunk in knowledge_base.chunks:
        if len(bodies.get(chunk.document, "")) < 20_000:
            bodies[chunk.document] = bodies.get(chunk.document, "") + "\n" + chunk.content

    rng = random.Random(SEED)
    questions = []

    topical_pool = []
    for record in records:
        # A file can exist on disk yet contribute zero chunks -- the extraction
        # quality gate drops scans and metadata-only stubs. A question whose
        # answer was never indexed is unanswerable by construction, so it can
        # only ever count as a miss. Skip those documents for both styles.
        if Path(record.relative_path).name not in bodies:
            continue
        topic = topic_of(record.title)
        if topic:
            topical_pool.append((record, topic))
    rng.shuffle(topical_pool)
    for index, (record, topic) in enumerate(topical_pool[:TOPICAL_COUNT]):
        template = TOPICAL_TEMPLATES[index % len(TOPICAL_TEMPLATES)]
        questions.append(
            {
                "id": f"topical-{index + 1:03d}",
                "style": "topical",
                "question": template.format(topic=topic.lower()),
                "expected_document": Path(record.relative_path).name,
            }
        )

    used = {q["expected_document"] for q in questions}
    quote_pool = [r for r in records if Path(r.relative_path).name in bodies]
    rng.shuffle(quote_pool)
    # Prefer documents the topical half never touched, so the two styles
    # together cover as many distinct regulations as possible.
    quote_pool.sort(key=lambda r: Path(r.relative_path).name in used)
    count = 0
    for record in quote_pool:
        if count >= KNOWN_ITEM_COUNT:
            break
        name = Path(record.relative_path).name
        fragment = quote_of(bodies[name], rng)
        if not fragment:
            continue
        count += 1
        questions.append(
            {
                "id": f"known-{count:03d}",
                "style": "known_item",
                "question": f"Ketentuan mana yang menyebutkan bahwa {fragment.lower()}?",
                "expected_document": name,
            }
        )

    # Some regulations never yield an acceptable quote (tables, lists, scans),
    # so the known-item half can come up short. Top back up to 100 from the
    # topical reserve rather than shipping a 98-question "100-question" set.
    reserve = topical_pool[TOPICAL_COUNT:]
    topical_total = TOPICAL_COUNT
    while len(questions) < TOPICAL_COUNT + KNOWN_ITEM_COUNT and reserve:
        record, topic = reserve.pop(0)
        topical_total += 1
        template = TOPICAL_TEMPLATES[topical_total % len(TOPICAL_TEMPLATES)]
        questions.append(
            {
                "id": f"topical-{topical_total:03d}",
                "style": "topical",
                "question": template.format(topic=topic.lower()),
                "expected_document": Path(record.relative_path).name,
            }
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        for question in questions:
            handle.write(json.dumps(question, ensure_ascii=False) + "\n")

    documents = {q["expected_document"] for q in questions}
    print(f"{len(questions)} pertanyaan -> {OUTPUT.relative_to(REPO)}")
    print(f"  topical    : {sum(q['style'] == 'topical' for q in questions)}")
    print(f"  known_item : {sum(q['style'] == 'known_item' for q in questions)}")
    print(f"  dokumen unik sebagai ground truth: {len(documents)}")


if __name__ == "__main__":
    main()
