from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import threading
import time
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from ftfy import fix_text
from markdownify import markdownify


CATALOG_URL = "https://www.pajak.go.id/id/peraturan"
PUBLISHER = "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
USER_AGENT = (
    "CoretaxAgentKnowledgeResearch/0.1 "
    "(+https://github.com/harezadmm/CoretaxAgent)"
)
CATALOG_PARAMS = {
    "title": "",
    "field_body_peraturan_value": "",
    "field_kategori_peraturan_target_id": "All",
    "field_jenis_dokumen_target_id": "All",
    "field_nomor_value": "",
    "field_tanggal_peraturan_value[min]": "",
    "field_tanggal_peraturan_value[max]": "",
    "field_tahun_peraturan_value": "All",
}

_thread_state = threading.local()


@dataclass
class RegulationRecord:
    title: str
    number: str
    document_type: str
    regulation_date: str
    validity_status: str
    source_url: str
    rag_file: str = ""
    attachment_urls: list[str] | None = None
    source_sha256: str = ""
    retrieved_at: str = ""
    extracted_chars: int = 0
    status: str = "discovered"
    note: str | None = None


def client() -> httpx.Client:
    value = getattr(_thread_state, "client", None)
    if value is None:
        value = httpx.Client(
            follow_redirects=True,
            timeout=httpx.Timeout(60.0, connect=20.0),
            headers={"User-Agent": USER_AGENT},
        )
        _thread_state.client = value
    return value


def fetch(url: str, params: dict[str, str] | None = None, attempts: int = 4):
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = client().get(url, params=params)
            if response.status_code == 429 or response.status_code >= 500:
                retry_after = response.headers.get("Retry-After")
                delay = float(retry_after) if retry_after and retry_after.isdigit() else attempt * 1.5
                time.sleep(min(delay, 20.0))
                response.raise_for_status()
            response.raise_for_status()
            return response
        except Exception as exc:  # noqa: BLE001 - retained in manifest
            last_error = exc
            if attempt < attempts:
                time.sleep(min(attempt * 1.5, 10.0))
    raise RuntimeError(f"Gagal mengambil {url}: {last_error}") from last_error


def clean_text(value: str) -> str:
    value = fix_text(value or "").replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug[:100] or "peraturan"


def stable_filename(record: RegulationRecord) -> str:
    digest = hashlib.sha256(record.source_url.encode("utf-8")).hexdigest()[:8]
    stem = slugify(f"{record.number}-{record.title}")
    return f"{stem}-{digest}.md"


def field_text(row: BeautifulSoup, selector: str) -> str:
    node = row.select_one(selector)
    return clean_text(node.get_text(" ", strip=True)) if node else ""


def parse_catalog_page(html: str, page_url: str) -> tuple[list[RegulationRecord], int | None]:
    soup = BeautifulSoup(html, "html.parser")
    records: list[RegulationRecord] = []
    for row in soup.select(".peraturan-content.views-row"):
        number = field_text(row, ".views-field-field-nomor-dokumen")
        title = field_text(row, ".views-field-title")
        document_type = field_text(row, ".views-field-field-jenis-dokumen")
        status = field_text(row, ".views-field-field-status-peraturan")
        date_node = row.select_one(".views-field-field-tanggal-peraturan time")
        regulation_date = ""
        if date_node:
            regulation_date = clean_text(date_node.get("datetime", ""))[:10]
        if not regulation_date:
            regulation_date = field_text(row, ".views-field-field-tanggal-peraturan")
        link = row.select_one(".views-field-view-node a[href]")
        if not link or not link.get("href"):
            link = row.select_one("a[href]")
        if not link or not link.get("href"):
            continue
        source_url = urljoin(page_url, link["href"])
        if not number or not title or "/id/peraturan/" not in source_url:
            continue
        records.append(
            RegulationRecord(
                title=title,
                number=number,
                document_type=document_type,
                regulation_date=regulation_date,
                validity_status=status,
                source_url=source_url,
                attachment_urls=[],
            )
        )

    max_page: int | None = None
    for link in soup.find_all("a", href=True):
        match = re.search(r"(?:[?&])page=(\d+)", link["href"])
        if match:
            candidate = int(match.group(1))
            max_page = candidate if max_page is None else max(max_page, candidate)
    return records, max_page


def discover_catalog(
    max_pages: int | None,
    workers: int,
) -> tuple[list[RegulationRecord], int]:
    first_params = dict(CATALOG_PARAMS)
    first_params["page"] = "0"
    first_response = fetch(CATALOG_URL, first_params)
    first_records, discovered_last_page = parse_catalog_page(
        first_response.text, str(first_response.url)
    )
    if max_pages is not None:
        last_page = max(0, max_pages - 1)
    else:
        last_page = discovered_last_page or 0
    pages = list(range(1, last_page + 1))
    print(
        f"Katalog: halaman 0-{last_page} ({last_page + 1} halaman), "
        f"halaman pertama {len(first_records)} peraturan.",
        flush=True,
    )

    def load_page(page: int) -> tuple[int, list[RegulationRecord], str | None]:
        params = dict(CATALOG_PARAMS)
        params["page"] = str(page)
        try:
            response = fetch(CATALOG_URL, params)
            records, _ = parse_catalog_page(response.text, str(response.url))
            return page, records, None
        except Exception as exc:  # noqa: BLE001 - surfaced to operator
            return page, [], str(exc)

    discovered = list(first_records)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [pool.submit(load_page, page) for page in pages]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            page, records, error = future.result()
            if error:
                print(f"[CATALOG {page}] ERROR {error}", flush=True)
                continue
            discovered.extend(records)
            if index % 25 == 0 or index == len(futures):
                print(
                    f"[CATALOG] {index}/{len(futures)} halaman selesai; "
                    f"{len(discovered)} record ditemukan.",
                    flush=True,
                )

    unique: dict[str, RegulationRecord] = {}
    for record in discovered:
        unique[record.source_url] = record
    return sorted(unique.values(), key=lambda item: item.source_url), last_page + 1


def clean_markdown(value: str) -> str:
    value = fix_text(value).replace("\xa0", " ")
    output: list[str] = []
    blank_pending = False
    for raw_line in value.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            blank_pending = True
            continue
        # markdownify emits empty table separators for the Drupal layout.
        if re.fullmatch(r"[|:;\-\s]+", line):
            continue
        if blank_pending and output:
            output.append("")
        output.append(line)
        blank_pending = False
    return re.sub(r"\n{3,}", "\n\n", "\n".join(output)).strip()


def extract_detail(record: RegulationRecord, html: str, response_url: str) -> tuple[str, list[str], int]:
    soup = BeautifulSoup(html, "html.parser")
    node = soup.select_one(".node__content") or soup.select_one(".field--name-body")
    if node is None:
        node = soup.body or soup
    for element in node.select(
        "script, style, form, nav, header, footer, aside, .breadcrumb, .social-sharing"
    ):
        element.decompose()
    attachment_urls = sorted(
        {
            urljoin(response_url, anchor["href"])
            for anchor in node.find_all("a", href=True)
            if ".pdf" in anchor["href"].lower()
        }
    )
    markdown = clean_markdown(markdownify(str(node), heading_style="ATX", bullets="-"))
    lines = [
        f"# {record.number} — {record.title}",
        "",
        "## Metadata Peraturan",
        "",
        f"- Jenis dokumen: {record.document_type or 'Tidak tercantum'}",
        f"- Nomor: {record.number}",
        f"- Tanggal peraturan: {record.regulation_date or 'Tidak tercantum'}",
        f"- Status katalog DJP: {record.validity_status or 'Tidak tercantum'}",
        f"- URL detail resmi: {record.source_url}",
    ]
    if attachment_urls:
        lines.append("- Lampiran resmi:")
        lines.extend(f"  - {url}" for url in attachment_urls)
    lines.extend(["", "## Teks Peraturan", "", markdown, ""])
    return "\n".join(lines), attachment_urls, len(markdown)


def yaml_value(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_document(record: RegulationRecord, body: str) -> str:
    attachment_urls = record.attachment_urls or []
    front_matter = [
        "---",
        f"title: {yaml_value(record.title)}",
        f"source_url: {yaml_value(record.source_url)}",
        f"publisher: {yaml_value(PUBLISHER)}",
        f"published_at: {yaml_value(record.regulation_date)}",
        f"retrieved_at: {yaml_value(record.retrieved_at)}",
        'source_type: "official_regulation"',
        f"document_number: {yaml_value(record.number)}",
        f"document_type: {yaml_value(record.document_type)}",
        f"validity_status: {yaml_value(record.validity_status)}",
        f"extraction_status: {yaml_value(record.status)}",
        f"extracted_chars: {record.extracted_chars}",
        f"document_hash: {yaml_value('sha256:' + record.source_sha256)}",
        f"attachment_count: {len(attachment_urls)}",
        "---",
        "",
    ]
    return "\n".join(front_matter) + body.rstrip() + "\n"


def download_detail(
    record: RegulationRecord,
    project_root: Path,
) -> tuple[RegulationRecord, str | None, str | None]:
    try:
        response = fetch(record.source_url)
        record.source_sha256 = hashlib.sha256(response.content).hexdigest()
        record.retrieved_at = date.today().isoformat()
        body, attachments, chars = extract_detail(record, response.text, str(response.url))
        record.attachment_urls = attachments
        record.extracted_chars = chars
        record.status = "ok" if chars >= 150 else "warning"
        record.note = None if chars >= 150 else "Hasil ekstraksi sangat pendek."
        filename = stable_filename(record)
        output_path = project_root / "knowledge" / "regulations" / filename
        record.rag_file = str(output_path.relative_to(project_root))
        return record, render_document(record, body), None
    except Exception as exc:  # noqa: BLE001 - retained in manifest
        record.status = "error"
        record.note = str(exc)
        return record, None, str(exc)


def load_manifest(path: Path) -> dict:
    if not path.exists():
        return {"records": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"records": []}


def load_catalog_snapshot(path: Path) -> tuple[list[RegulationRecord], int] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = [RegulationRecord(**item) for item in payload.get("records", [])]
        pages = int(payload.get("catalog_pages_scanned") or 0)
        if records and pages:
            return sorted(records, key=lambda item: item.source_url), pages
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return None
    return None


def save_catalog_snapshot(
    path: Path,
    records: list[RegulationRecord],
    pages: int,
) -> None:
    payload = {
        "generated_at": date.today().isoformat(),
        "publisher": PUBLISHER,
        "catalog_url": CATALOG_URL,
        "catalog_pages_scanned": pages,
        "records_count": len(records),
        "records": [asdict(record) for record in records],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    try:
        os.replace(temporary, path)
    except PermissionError:
        temporary.unlink(missing_ok=True)


def save_manifest(path: Path, records: list[RegulationRecord], pages: int) -> None:
    payload = {
        "generated_at": date.today().isoformat(),
        "publisher": PUBLISHER,
        "catalog_url": CATALOG_URL,
        "catalog_pages_scanned": pages,
        "records_count": len(records),
        "records": [asdict(record) for record in records],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write-and-replace avoids intermittent Windows Errno 22/AV races when the
    # multi-thousand-record manifest is being inspected while the crawler runs.
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    temporary.write_text(
        serialized,
        encoding="utf-8",
    )
    for attempt in range(1, 11):
        try:
            os.replace(temporary, path)
            return
        except PermissionError:
            if attempt == 10:
                print(
                    f"[MANIFEST] file terkunci, batch tetap dilanjutkan: {path}",
                    flush=True,
                )
                temporary.unlink(missing_ok=True)
                return
            time.sleep(attempt * 0.5)


def sync(
    project_root: Path,
    max_pages: int | None,
    workers: int,
    refresh: bool,
    refresh_catalog: bool,
) -> list[RegulationRecord]:
    knowledge_dir = project_root / "knowledge"
    rag_dir = knowledge_dir / "regulations"
    manifest_path = knowledge_dir / "_meta" / "regulations-manifest.json"
    catalog_path = knowledge_dir / "_meta" / "regulations-catalog.json"
    previous = load_manifest(manifest_path)
    previous_by_url = {
        item.get("source_url"): RegulationRecord(**item)
        for item in previous.get("records", [])
        if item.get("source_url")
    }

    cached_catalog = None if refresh_catalog or max_pages is not None else load_catalog_snapshot(catalog_path)
    if cached_catalog is not None:
        records, pages_scanned = cached_catalog
        print(
            f"Katalog cache: {len(records)} record dari {pages_scanned} halaman; "
            f"gunakan --refresh-catalog untuk menemukan perubahan terbaru.",
            flush=True,
        )
    else:
        records, pages_scanned = discover_catalog(max_pages=max_pages, workers=workers)
        if max_pages is None:
            save_catalog_snapshot(catalog_path, records, pages_scanned)

    merged: dict[str, RegulationRecord] = dict(previous_by_url)
    pending: list[RegulationRecord] = []
    for record in records:
        old = previous_by_url.get(record.source_url)
        if old and old.rag_file and (project_root / old.rag_file).exists() and not refresh:
            old.title = record.title
            old.number = record.number
            old.document_type = record.document_type
            old.regulation_date = record.regulation_date
            old.validity_status = record.validity_status
            merged[record.source_url] = old
            continue

        pending.append(record)

    print(
        f"Detail: {len(merged)} sudah tersimpan, {len(pending)} perlu diambil "
        f"dengan {workers} worker.",
        flush=True,
    )
    rag_dir.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [pool.submit(download_detail, record, project_root) for record in pending]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            record, rendered, error = future.result()
            if rendered is not None:
                output_path = project_root / record.rag_file
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(rendered, encoding="utf-8")
                if index % 25 == 0 or index == len(pending):
                    print(
                        f"[DETAIL] {index}/{len(pending)} selesai; "
                        f"terakhir {record.number} ({record.status}, "
                        f"{record.extracted_chars:,} chars)",
                        flush=True,
                    )
            else:
                print(f"[DETAIL] ERROR {record.source_url}: {error}", flush=True)
            merged[record.source_url] = record
            if len(merged) % 25 == 0:
                save_manifest(
                    manifest_path,
                    sorted(merged.values(), key=lambda item: item.source_url),
                    pages_scanned,
                )

    final_records = sorted(merged.values(), key=lambda item: item.source_url)
    save_manifest(manifest_path, final_records, pages_scanned)
    return final_records


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sinkronisasi katalog peraturan resmi DJP untuk knowledge base RAG."
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Batasi jumlah halaman katalog untuk uji/resume; default semua halaman.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Jumlah koneksi paralel saat menemukan halaman katalog.",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Ambil ulang halaman detail yang sudah tersimpan.",
    )
    parser.add_argument(
        "--refresh-catalog",
        action="store_true",
        help="Ambil ulang seluruh katalog; default memakai snapshot katalog bila tersedia.",
    )
    args = parser.parse_args()
    if args.max_pages is not None and args.max_pages < 1:
        parser.error("--max-pages harus >= 1")
    if args.workers < 1 or args.workers > 24:
        parser.error("--workers harus berada di antara 1 dan 24")

    records = sync(
        args.project_root.resolve(),
        max_pages=args.max_pages,
        workers=args.workers,
        refresh=args.refresh,
        refresh_catalog=args.refresh_catalog,
    )
    counts: dict[str, int] = {}
    for record in records:
        counts[record.status] = counts.get(record.status, 0) + 1
    print(
        f"Selesai: {len(records)} regulasi tercatat; "
        f"status={counts}; "
        f"manifest=knowledge/_meta/regulations-manifest.json",
        flush=True,
    )
    if counts.get("error"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
