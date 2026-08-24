from __future__ import annotations

import math
import re
from collections import Counter
from hashlib import sha256
from dataclasses import dataclass
from pathlib import Path
from threading import RLock


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_PATTERN.findall(text)]


@dataclass(frozen=True)
class Chunk:
    document: str
    section: str
    content: str
    source_url: str | None = None
    source_type: str | None = None
    validity_status: str | None = None


@dataclass(frozen=True)
class SearchResult:
    chunk: Chunk
    score: float


class KnowledgeBase:
    def __init__(self, directory: Path):
        self.directory = directory
        self._lock = RLock()
        self.chunks: list[Chunk] = []
        self.reload()

    def reload(self) -> int:
        """Rebuild the in-memory retrieval index after a managed document changes."""
        chunks = self._load_chunks()
        with self._lock:
            self.chunks = chunks
        return len(chunks)

    def document_chunk_counts(self) -> dict[str, int]:
        with self._lock:
            return dict(Counter(chunk.document for chunk in self.chunks))

    def _load_chunks(self) -> list[Chunk]:
        if not self.directory.exists():
            return []

        chunks: list[Chunk] = []
        seen_content: set[str] = set()
        for path in sorted(self.directory.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".md", ".txt"}:
                continue
            if path.name.lower() == "readme.md" or any(
                part.startswith("_") for part in path.relative_to(self.directory).parts
            ):
                continue
            text = path.read_text(encoding="utf-8-sig").strip()
            if not text:
                continue
            text, metadata = self._extract_front_matter(text)
            if metadata.get("source_type") == "official_regulation":
                try:
                    extracted_chars = int(metadata.get("extracted_chars", "0") or "0")
                except ValueError:
                    extracted_chars = 0
                if metadata.get("extraction_status") == "warning" or extracted_chars < 150:
                    continue
            page_count = text.count("## Halaman ")
            empty_page_count = text.count(
                "[Halaman tidak memiliki teks yang dapat diekstrak.]"
            )
            if page_count and empty_page_count / page_count >= 0.5:
                continue
            for chunk in self._split_document(path.name, text, metadata):
                normalized = re.sub(r"\s+", " ", chunk.content).strip().lower()
                content_hash = sha256(normalized.encode("utf-8")).hexdigest()
                if content_hash in seen_content:
                    continue
                seen_content.add(content_hash)
                chunks.append(chunk)
        return chunks

    @staticmethod
    def _extract_front_matter(text: str) -> tuple[str, dict[str, str]]:
        if not text.startswith("---"):
            return text, {}
        parts = text.split("---", 2)
        if len(parts) != 3:
            return text, {}
        metadata: dict[str, str] = {}
        for line in parts[1].splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip('"').strip("'")
        return parts[2].lstrip(), metadata

    @staticmethod
    def _split_document(
        document: str,
        text: str,
        metadata: dict[str, str] | None = None,
    ) -> list[Chunk]:
        chunks: list[Chunk] = []
        metadata = metadata or {}
        current_section = "Dokumen"
        buffer: list[str] = []

        def flush() -> None:
            if not buffer:
                return
            content = "\n".join(buffer).strip()
            if content:
                chunks.append(
                    Chunk(
                        document=document,
                        section=current_section,
                        content=content,
                        source_url=metadata.get("source_url"),
                        source_type=metadata.get("source_type"),
                        validity_status=metadata.get("validity_status"),
                    )
                )
            buffer.clear()

        for line in text.splitlines():
            heading = re.match(r"^#{1,6}\s+(.+)$", line.strip())
            if heading:
                flush()
                current_section = heading.group(1).strip()
                continue
            if not line.strip() and buffer:
                flush()
                continue
            if line.strip():
                buffer.append(line.strip())
        flush()
        return chunks

    def search(self, query: str, limit: int = 4) -> list[SearchResult]:
        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        with self._lock:
            chunks = tuple(self.chunks)
        query_set = set(query_tokens)
        query_normalized = " ".join(query_tokens)
        results: list[SearchResult] = []
        for chunk in chunks:
            chunk_tokens = tokenize(chunk.content + " " + chunk.section)
            if not chunk_tokens:
                continue
            chunk_set = set(chunk_tokens)
            section_tokens = set(tokenize(chunk.section))
            overlap = query_set & chunk_set
            if not overlap:
                continue

            coverage = len(overlap) / len(query_set)
            density = len(overlap) / math.sqrt(len(chunk_set))
            section_coverage = len(query_set & section_tokens) / len(query_set)
            phrase_bonus = (
                0.15
                if query_normalized
                in " ".join(tokenize(chunk.content + " " + chunk.section))
                else 0.0
            )
            score = (
                (coverage * 0.55)
                + (section_coverage * 0.30)
                + (density * 0.15)
                + phrase_bonus
            )
            if "bukan" in chunk_set and "bukan" not in query_set:
                score *= 0.65
            if chunk.source_type == "official_html":
                score *= 1.06
            if chunk.source_type == "official_regulation":
                status = (chunk.validity_status or "").casefold()
                if "aktif" in status and "tidak" not in status:
                    score *= 1.08
                elif any(term in status for term in ("tidak aktif", "dicabut", "berlaku")):
                    score *= 0.88
            score = min(1.0, score)
            results.append(SearchResult(chunk=chunk, score=round(score, 4)))

        return sorted(results, key=lambda item: item.score, reverse=True)[:limit]
