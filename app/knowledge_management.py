from __future__ import annotations

import json
import math
import os
import re
import shutil
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from threading import RLock
from urllib.parse import urlparse
from uuid import uuid4

from app.knowledge import KnowledgeBase
from app.schemas import (
    KnowledgeDocumentDetail,
    KnowledgeDocumentInput,
    KnowledgeDocumentPage,
    KnowledgeDocumentSummary,
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    KnowledgeGraphResponse,
    KnowledgeMutationResponse,
    KnowledgeStats,
)


SUPPORTED_SUFFIXES = {".md", ".txt"}
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
WORD_PATTERN = re.compile(r"[^\W\d_]{3,}", re.UNICODE)
TOPIC_STOPWORDS = {
    "administrasi",
    "aktif",
    "atau",
    "atas",
    "bagi",
    "cara",
    "badan",
    "dalam",
    "dan",
    "dari",
    "dengan",
    "direktur",
    "indonesia",
    "jenderal",
    "kepala",
    "keputusan",
    "ketentuan",
    "makanan",
    "menteri",
    "nomor",
    "obat",
    "official",
    "pada",
    "pelaksanaan",
    "pengawas",
    "pengawasan",
    "peraturan",
    "perubahan",
    "republik",
    "serta",
    "sistem",
    "tahun",
    "tata",
    "tentang",
    "terhadap",
    "untuk",
    "yang",
}


class KnowledgeManagementError(Exception):
    """Base class for safe, user-facing knowledge management errors."""


class DocumentNotFoundError(KnowledgeManagementError):
    pass


class ReadOnlyDocumentError(KnowledgeManagementError):
    pass


class InvalidDocumentError(KnowledgeManagementError):
    pass


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    path: Path
    relative_path: str
    title: str
    folder: str
    source_type: str
    source_url: str | None
    validity_status: str | None
    extraction_status: str | None
    status: str
    updated_at: str
    size_bytes: int
    chunk_count: int
    preview: str
    editable: bool
    tags: tuple[str, ...]


def _front_matter(text: str) -> tuple[str, dict[str, str]]:
    if not text.startswith("---"):
        return text, {}
    parts = text.split("---", 2)
    if len(parts) != 3:
        return text, {}
    metadata: dict[str, str] = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        value = raw_value.strip()
        if value.startswith(('"', "'")) and value.endswith(value[:1]):
            try:
                value = json.loads(value) if value.startswith('"') else value[1:-1]
            except json.JSONDecodeError:
                value = value[1:-1]
        metadata[key.strip()] = str(value)
    return parts[2].lstrip(), metadata


def _parse_tags(raw_value: str | None) -> tuple[str, ...]:
    if not raw_value:
        return ()
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        parsed = [item.strip() for item in raw_value.split(",")]
    if not isinstance(parsed, list):
        return ()
    tags: list[str] = []
    seen: set[str] = set()
    for value in parsed:
        tag = CONTROL_CHARACTERS.sub("", str(value)).strip()[:40]
        normalized = tag.casefold()
        if tag and normalized not in seen:
            tags.append(tag)
            seen.add(normalized)
    return tuple(tags[:12])


def _normalized_status(
    validity_status: str | None,
    extraction_status: str | None,
    managed_status: str | None,
) -> str:
    if (extraction_status or "").casefold() == "warning":
        return "warning"
    managed = (managed_status or "").casefold()
    if managed in {"active", "review"}:
        return managed
    validity = (validity_status or "").casefold()
    if "dicabut" in validity or "tidak aktif" in validity:
        return "repealed"
    if "diubah" in validity or "disempurnakan" in validity:
        return "superseded"
    return "active"


class KnowledgeManager:
    """Indexes visible RAG documents and safely mutates operator-owned sources."""

    def __init__(self, directory: Path, knowledge_base: KnowledgeBase):
        self.directory = directory.resolve()
        self.knowledge_base = knowledge_base
        self.managed_directory = self.directory / "managed"
        self.trash_directory = self.directory / "_trash"
        self._lock = RLock()
        self._records: dict[str, DocumentRecord] | None = None

    def _scan(self) -> dict[str, DocumentRecord]:
        chunk_counts = self.knowledge_base.document_chunk_counts()
        records: dict[str, DocumentRecord] = {}
        if not self.directory.exists():
            return records

        for path in sorted(self.directory.rglob("*")):
            if not path.is_file() or path.suffix.casefold() not in SUPPORTED_SUFFIXES:
                continue
            relative = path.relative_to(self.directory)
            if path.name.casefold() == "readme.md" or any(
                part.startswith("_") for part in relative.parts
            ):
                continue
            try:
                with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
                    head = handle.read(64_000)
                file_stat = path.stat()
            except OSError:
                continue

            body, metadata = _front_matter(head)
            heading = re.search(r"^#{1,6}\s+(.+)$", body, flags=re.MULTILINE)
            title = (
                metadata.get("title")
                or (heading.group(1).strip() if heading else "")
                or path.stem.replace("-", " ").replace("_", " ")
            )
            source_type = metadata.get("source_type") or self._source_type_for(relative)
            validity_status = metadata.get("validity_status")
            extraction_status = metadata.get("extraction_status")
            status = _normalized_status(
                validity_status,
                extraction_status,
                metadata.get("status"),
            )
            relative_posix = relative.as_posix()
            document_id = sha256(relative_posix.casefold().encode("utf-8")).hexdigest()[:20]
            preview = re.sub(r"[#>*`\[\]()]+", " ", body)
            preview = re.sub(r"\s+", " ", preview).strip()[:260]
            updated_at = metadata.get("updated_at") or metadata.get("retrieved_at")
            if not updated_at:
                updated_at = datetime.fromtimestamp(
                    file_stat.st_mtime,
                    tz=timezone.utc,
                ).isoformat()
            editable = bool(relative.parts and relative.parts[0] == "managed")
            records[document_id] = DocumentRecord(
                id=document_id,
                path=path,
                relative_path=relative_posix,
                title=CONTROL_CHARACTERS.sub("", title).strip()[:180],
                folder=relative.parts[0] if relative.parts else "knowledge",
                source_type=source_type,
                source_url=metadata.get("source_url") or None,
                validity_status=validity_status,
                extraction_status=extraction_status,
                status=status,
                updated_at=updated_at,
                size_bytes=file_stat.st_size,
                chunk_count=chunk_counts.get(path.name, 0),
                preview=preview,
                editable=editable,
                tags=_parse_tags(metadata.get("tags")),
            )
        return records

    @staticmethod
    def _source_type_for(relative: Path) -> str:
        folder = relative.parts[0] if relative.parts else "knowledge"
        return {
            "articles": "official_html",
            "manuals": "official_pdf",
            "regulations": "official_regulation",
            "curated": "curated",
            "managed": "operator_note",
        }.get(folder, "knowledge_document")

    def _snapshot(self) -> dict[str, DocumentRecord]:
        with self._lock:
            if self._records is None:
                self._records = self._scan()
            return dict(self._records)

    def invalidate(self) -> None:
        with self._lock:
            self._records = None

    def _get_record(self, document_id: str) -> DocumentRecord:
        record = self._snapshot().get(document_id)
        if not record:
            raise DocumentNotFoundError("Dokumen knowledge tidak ditemukan.")
        return record

    @staticmethod
    def _summary(record: DocumentRecord) -> KnowledgeDocumentSummary:
        return KnowledgeDocumentSummary(
            id=record.id,
            title=record.title,
            relative_path=record.relative_path,
            folder=record.folder,
            source_type=record.source_type,
            source_url=record.source_url,
            validity_status=record.validity_status,
            extraction_status=record.extraction_status,
            status=record.status,
            updated_at=record.updated_at,
            size_bytes=record.size_bytes,
            chunk_count=record.chunk_count,
            preview=record.preview,
            editable=record.editable,
            tags=list(record.tags),
        )

    def stats(self) -> KnowledgeStats:
        records = list(self._snapshot().values())
        source_types = Counter(record.source_type for record in records)
        statuses = Counter(record.status for record in records)
        editable = sum(record.editable for record in records)
        return KnowledgeStats(
            total_documents=len(records),
            total_chunks=sum(self.knowledge_base.document_chunk_counts().values()),
            editable_documents=editable,
            read_only_documents=len(records) - editable,
            warning_documents=statuses.get("warning", 0),
            source_types=dict(sorted(source_types.items())),
            statuses=dict(sorted(statuses.items())),
        )

    @staticmethod
    def _matches(
        record: DocumentRecord,
        query: str,
        source_type: str | None,
        status: str | None,
    ) -> bool:
        if source_type and source_type != "all" and record.source_type != source_type:
            return False
        if status and status != "all" and record.status != status:
            return False
        if not query:
            return True
        haystack = " ".join(
            (
                record.title,
                record.relative_path,
                record.source_type,
                record.preview,
                " ".join(record.tags),
            )
        ).casefold()
        return all(term in haystack for term in query.casefold().split())

    def list_documents(
        self,
        *,
        query: str = "",
        source_type: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 40,
    ) -> KnowledgeDocumentPage:
        records = [
            record
            for record in self._snapshot().values()
            if self._matches(record, query.strip(), source_type, status)
        ]
        records.sort(
            key=lambda record: (
                not record.editable,
                record.title.casefold(),
                record.relative_path.casefold(),
            )
        )
        total = len(records)
        start = (page - 1) * page_size
        items = [self._summary(record) for record in records[start : start + page_size]]
        return KnowledgeDocumentPage(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            stats=self.stats(),
        )

    def get_document(self, document_id: str) -> KnowledgeDocumentDetail:
        record = self._get_record(document_id)
        try:
            text = record.path.read_text(encoding="utf-8-sig")
        except OSError as exc:
            raise KnowledgeManagementError("Dokumen tidak dapat dibaca.") from exc
        body, _ = _front_matter(text)
        if record.editable:
            lines = body.lstrip().splitlines()
            if lines and re.fullmatch(r"#\s+.+", lines[0]):
                body = "\n".join(lines[1:]).lstrip()
        return KnowledgeDocumentDetail(**self._summary(record).model_dump(), content=body)

    @staticmethod
    def _clean_title(title: str) -> str:
        cleaned = CONTROL_CHARACTERS.sub("", title).replace("\r", " ").replace("\n", " ")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if len(cleaned) < 2:
            raise InvalidDocumentError("Judul dokumen terlalu pendek.")
        return cleaned[:180]

    @staticmethod
    def _clean_content(content: str) -> str:
        cleaned = CONTROL_CHARACTERS.sub("", content).replace("\r\n", "\n").replace("\r", "\n")
        cleaned = cleaned.strip()
        if not cleaned:
            raise InvalidDocumentError("Isi dokumen tidak boleh kosong.")
        return cleaned

    @staticmethod
    def _clean_source_url(source_url: str | None) -> str | None:
        if not source_url:
            return None
        candidate = CONTROL_CHARACTERS.sub("", source_url).strip()
        parsed = urlparse(candidate)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise InvalidDocumentError("URL sumber harus menggunakan http atau https.")
        return candidate

    @staticmethod
    def _clean_tags(tags: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw_tag in tags:
            tag = CONTROL_CHARACTERS.sub("", raw_tag).strip()[:40]
            normalized = tag.casefold()
            if tag and normalized not in seen:
                cleaned.append(tag)
                seen.add(normalized)
        return cleaned[:12]

    @staticmethod
    def _slug(title: str) -> str:
        normalized = unicodedata.normalize("NFKD", title)
        ascii_title = normalized.encode("ascii", "ignore").decode("ascii").casefold()
        slug = re.sub(r"[^a-z0-9]+", "-", ascii_title).strip("-")
        return (slug or "rag-memory")[:70]

    @staticmethod
    def _render_document(
        payload: KnowledgeDocumentInput,
        *,
        created_at: str,
    ) -> str:
        now = datetime.now(timezone.utc).isoformat()
        title = KnowledgeManager._clean_title(payload.title)
        content = KnowledgeManager._clean_content(payload.content)
        source_url = KnowledgeManager._clean_source_url(payload.source_url)
        tags = KnowledgeManager._clean_tags(payload.tags)
        metadata = [
            "---",
            f"title: {json.dumps(title, ensure_ascii=False)}",
            f"source_type: {json.dumps(payload.source_type)}",
            f"status: {json.dumps(payload.status)}",
            f"created_at: {json.dumps(created_at)}",
            f"updated_at: {json.dumps(now)}",
            f"tags: {json.dumps(tags, ensure_ascii=False)}",
        ]
        if source_url:
            metadata.append(f"source_url: {json.dumps(source_url, ensure_ascii=False)}")
        metadata.extend(("---", "", f"# {title}", "", content, ""))
        return "\n".join(metadata)

    @staticmethod
    def _atomic_write(path: Path, content: str) -> None:
        temp_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        try:
            temp_path.write_text(content, encoding="utf-8", newline="\n")
            os.replace(temp_path, path)
        finally:
            temp_path.unlink(missing_ok=True)

    def _reload_after_write(self) -> int:
        chunk_count = self.knowledge_base.reload()
        self.invalidate()
        return chunk_count

    def create_document(self, payload: KnowledgeDocumentInput) -> KnowledgeMutationResponse:
        title = self._clean_title(payload.title)
        created_at = datetime.now(timezone.utc).isoformat()
        self.managed_directory.mkdir(parents=True, exist_ok=True)
        path = self.managed_directory / f"{self._slug(title)}-{uuid4().hex[:8]}.md"
        content = self._render_document(payload, created_at=created_at)
        try:
            self._atomic_write(path, content)
        except OSError as exc:
            raise KnowledgeManagementError("Storage knowledge tidak dapat ditulis.") from exc
        chunk_count = self._reload_after_write()
        record_id = sha256(path.relative_to(self.directory).as_posix().casefold().encode("utf-8")).hexdigest()[:20]
        return KnowledgeMutationResponse(
            message="Memory RAG berhasil ditambahkan.",
            document=self._summary(self._get_record(record_id)),
            knowledge_chunks=chunk_count,
        )

    def update_document(
        self,
        document_id: str,
        payload: KnowledgeDocumentInput,
    ) -> KnowledgeMutationResponse:
        record = self._get_record(document_id)
        if not record.editable:
            raise ReadOnlyDocumentError("Sumber resmi dikelola oleh sinkronisasi dan tidak dapat diedit.")
        try:
            existing = record.path.read_text(encoding="utf-8-sig")
        except OSError as exc:
            raise KnowledgeManagementError("Dokumen tidak dapat dibaca.") from exc
        _, metadata = _front_matter(existing)
        created_at = metadata.get("created_at") or datetime.now(timezone.utc).isoformat()
        content = self._render_document(payload, created_at=created_at)
        try:
            self._atomic_write(record.path, content)
        except OSError as exc:
            raise KnowledgeManagementError("Perubahan dokumen tidak dapat disimpan.") from exc
        chunk_count = self._reload_after_write()
        return KnowledgeMutationResponse(
            message="Memory RAG berhasil diperbarui.",
            document=self._summary(self._get_record(document_id)),
            knowledge_chunks=chunk_count,
        )

    def delete_document(self, document_id: str) -> KnowledgeMutationResponse:
        record = self._get_record(document_id)
        if not record.editable:
            raise ReadOnlyDocumentError("Sumber resmi dikelola oleh sinkronisasi dan tidak dapat dihapus.")
        self.trash_directory.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        target = self.trash_directory / f"{timestamp}-{uuid4().hex[:6]}-{record.path.name}"
        try:
            shutil.move(str(record.path), str(target))
        except OSError as exc:
            raise KnowledgeManagementError("Dokumen tidak dapat dipindahkan ke trash.") from exc
        chunk_count = self._reload_after_write()
        return KnowledgeMutationResponse(
            message="Memory RAG dipindahkan ke trash dan tidak lagi dipakai AI.",
            document=None,
            knowledge_chunks=chunk_count,
        )

    @staticmethod
    def _topic_terms(record: DocumentRecord) -> set[str]:
        text = " ".join((record.title, " ".join(record.tags))).casefold()
        return {
            token
            for token in WORD_PATTERN.findall(text)
            if token not in TOPIC_STOPWORDS and len(token) <= 28
        }

    @staticmethod
    def _balanced_sample(records: list[DocumentRecord], limit: int) -> list[DocumentRecord]:
        if len(records) <= limit:
            return records
        selected: list[DocumentRecord] = []
        selected_ids: set[str] = set()
        editable = sorted(
            (record for record in records if record.editable),
            key=lambda record: record.updated_at,
            reverse=True,
        )
        for record in editable[: min(60, limit)]:
            selected.append(record)
            selected_ids.add(record.id)

        groups: dict[str, list[DocumentRecord]] = defaultdict(list)
        for record in records:
            if record.id not in selected_ids:
                groups[record.source_type].append(record)
        for group in groups.values():
            group.sort(key=lambda record: record.id)

        group_names = sorted(groups)
        cursor = 0
        while len(selected) < limit and group_names:
            group_name = group_names[cursor % len(group_names)]
            group = groups[group_name]
            if group:
                selected.append(group.pop())
            if not group:
                group_names.remove(group_name)
                cursor = 0
            else:
                cursor += 1
        return selected

    def _chunk_graph(
        self,
        records: list[DocumentRecord],
        limit: int,
    ) -> KnowledgeGraphResponse:
        """Plot retrieval chunks instead of documents.

        A document node map understates this corpus badly: 263 regulations hold
        51,482 chunks, so the graph drew 263 dots for the whole knowledge base.
        Chunks are the unit retrieval actually works in, and there are enough of
        them to show the shape of what the agent can reach.

        Node payload is deliberately lean. At the document node's size a 20,000
        node graph is 11MB of JSON; trimming to id, short label and parent gets
        the same node count under the payload the old tax graph already shipped.
        """
        by_file = {Path(record.relative_path).name: record for record in records}
        wanted = set(by_file)

        nodes: list[KnowledgeGraphNode] = [
            KnowledgeGraphNode(
                id="rag-root",
                label="BPOM RAG Memory",
                kind="root",
                size=10,
                count=len(records),
            )
        ]
        edges: list[KnowledgeGraphEdge] = []

        source_counts = Counter(record.source_type for record in records)
        for source_name, count in sorted(source_counts.items()):
            nodes.append(
                KnowledgeGraphNode(
                    id=f"source:{source_name}",
                    label=source_name.replace("_", " ").title(),
                    kind="source",
                    source_type=source_name,
                    size=5 + min(5, math.log2(count + 1)),
                    count=count,
                )
            )
            edges.append(
                KnowledgeGraphEdge(
                    source="rag-root",
                    target=f"source:{source_name}",
                    kind="contains",
                    weight=max(1, math.log2(count + 1)),
                )
            )

        # Round-robin across documents rather than taking the first N chunks.
        # Chunks arrive grouped by document, so a straight prefix drew 6,600
        # dots from 44 regulations and left the other 216 off the graph
        # entirely.
        grouped: dict[str, list] = defaultdict(list)
        for index, chunk in enumerate(self.knowledge_base.chunks):
            if chunk.document in wanted:
                grouped[chunk.document].append((index, chunk))

        interleaved: list[tuple[int, object]] = []
        if grouped:
            deepest = max(len(items) for items in grouped.values())
            for depth in range(deepest):
                if len(interleaved) >= limit:
                    break
                for items in grouped.values():
                    if depth < len(items):
                        interleaved.append(items[depth])

        emitted = 0
        ordinal: dict[str, int] = {}
        for index, chunk in interleaved:
            if emitted >= limit:
                break
            record = by_file.get(chunk.document)
            if record is None:
                continue
            # Every BPOM regulation carries a single "Isi peraturan" heading, so
            # section names label all 51k chunks identically — and identical
            # labels are what made the chunk graph unreadable: selecting one dot
            # lit a twin elsewhere and looked like the graph jumping. Number each
            # chunk within its own document so every dot names itself.
            ordinal[record.id] = ordinal.get(record.id, 0) + 1
            label = f"{record.title} §{ordinal[record.id]}"
            nodes.append(
                KnowledgeGraphNode(
                    id=f"c{index}",
                    label=label[:60],
                    kind="chunk",
                    source_type=record.source_type,
                    status=record.status,
                    # Selecting a chunk opens the regulation it came from; the
                    # inspector has no notion of a fragment.
                    document_id=record.id,
                    size=1.1 + min(3.2, math.log2(len(chunk.content) + 2) * 0.28),
                )
            )
            edges.append(
                KnowledgeGraphEdge(
                    source=f"source:{record.source_type}",
                    target=f"c{index}",
                    kind="contains",
                    weight=1.0,
                )
            )
            emitted += 1

        total_chunks = sum(record.chunk_count for record in records)
        return KnowledgeGraphResponse(
            nodes=nodes,
            edges=edges,
            total_documents=len(records),
            displayed_documents=emitted,
            total_chunks=total_chunks,
            truncated=emitted < total_chunks,
        )

    def graph(
        self,
        *,
        query: str = "",
        source_type: str | None = None,
        status: str | None = None,
        limit: int = 700,
        unit: str = "document",
    ) -> KnowledgeGraphResponse:
        records = [
            record
            for record in self._snapshot().values()
            if self._matches(record, query.strip(), source_type, status)
        ]
        if unit == "chunk":
            return self._chunk_graph(records, limit)
        selected = self._balanced_sample(records, limit)
        source_counts = Counter(record.source_type for record in records)
        nodes: list[KnowledgeGraphNode] = [
            KnowledgeGraphNode(
                id="rag-root",
                label="BPOM RAG Memory",
                kind="root",
                size=10,
                count=len(records),
            )
        ]
        edges: list[KnowledgeGraphEdge] = []
        for source_name, count in sorted(source_counts.items()):
            source_id = f"source:{source_name}"
            nodes.append(
                KnowledgeGraphNode(
                    id=source_id,
                    label=source_name.replace("_", " ").title(),
                    kind="source",
                    source_type=source_name,
                    size=5 + min(5, math.log2(count + 1)),
                    count=count,
                )
            )
            edges.append(
                KnowledgeGraphEdge(
                    source="rag-root",
                    target=source_id,
                    kind="contains",
                    weight=max(1, math.log2(count + 1)),
                )
            )

        term_frequency: Counter[str] = Counter()
        document_terms: dict[str, set[str]] = {}
        for record in selected:
            terms = self._topic_terms(record)
            document_terms[record.id] = terms
            term_frequency.update(terms)
        topics = [term for term, count in term_frequency.most_common(24) if count >= 3]
        topic_set = set(topics)
        for topic in topics:
            count = term_frequency[topic]
            nodes.append(
                KnowledgeGraphNode(
                    id=f"topic:{topic}",
                    label=topic.title(),
                    kind="topic",
                    size=3 + min(4, math.log2(count + 1)),
                    count=count,
                )
            )

        for record in selected:
            node_id = f"document:{record.id}"
            nodes.append(
                KnowledgeGraphNode(
                    id=node_id,
                    label=record.title,
                    kind="document",
                    source_type=record.source_type,
                    status=record.status,
                    document_id=record.id,
                    editable=record.editable,
                    size=1.2 + min(4.5, math.log2(record.chunk_count + 2) * 0.65),
                )
            )
            edges.append(
                KnowledgeGraphEdge(
                    source=f"source:{record.source_type}",
                    target=node_id,
                    kind="contains",
                )
            )
            ranked_terms = sorted(
                document_terms[record.id] & topic_set,
                key=lambda term: term_frequency[term],
                reverse=True,
            )[:2]
            for term in ranked_terms:
                edges.append(
                    KnowledgeGraphEdge(
                        source=f"topic:{term}",
                        target=node_id,
                        kind="topic",
                        weight=0.65,
                    )
                )

        stats = self.stats()
        return KnowledgeGraphResponse(
            nodes=nodes,
            edges=edges,
            total_documents=len(records),
            displayed_documents=len(selected),
            total_chunks=stats.total_chunks,
            truncated=len(records) > len(selected),
        )
