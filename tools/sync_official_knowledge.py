from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from ftfy import fix_text
from markdownify import markdownify
from pypdf import PdfReader


INDEX_URL = "https://www.pajak.go.id/coretaxpedia/buku-panduan-coretax-djp"
CORETAXPEDIA_URL = "https://www.pajak.go.id/coretaxpedia/"
CORETAX_HUB_URL = "https://www.pajak.go.id/coretax/"
RINGKAS_ARTICLE_URL = (
    "https://www.pajak.go.id/id/baca-sinopsis-dan-unduh-buku-panduan-ringkas-coretax-djp"
)
INDEX_URLS = [INDEX_URL, CORETAXPEDIA_URL, CORETAX_HUB_URL, RINGKAS_ARTICLE_URL]
EXTRA_PDF_LINKS = [
    (
        "Panduan Aktivasi Akun Coretax 2025",
        "https://www.pajak.go.id/sites/default/files/2025-09/"
        "Panduan%20Aktivasi%20Akun%20Coretax%202025.pdf",
    ),
    (
        "Panduan Kode Otorisasi Akun Coretax 2025",
        "https://www.pajak.go.id/sites/default/files/2025-09/"
        "Panduan%20Kode%20Otorisasi%20Akun%20Coretax%202025.pdf",
    ),
    (
        "Leaflet Panduan Memperoleh Kode Otorisasi DJP 2025",
        "https://www.pajak.go.id/sites/default/files/2025-12/"
        "Leaflet%20Panduan%20Memperoleh%20KODJP%20v202512_0.pdf",
    ),
]
PUBLISHER = "Direktorat Jenderal Pajak, Kementerian Keuangan RI"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 Chrome/136.0 Safari/537.36"
)


@dataclass
class SourceRecord:
    title: str
    source_url: str
    source_type: str
    source_file: str
    rag_file: str
    sha256: str
    bytes: int
    pages: int | None = None
    extracted_chars: int = 0
    empty_pages: int | None = None
    status: str = "ok"
    note: str | None = None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", unquote(value))
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug[:100] or "dokumen"


def clean_title(value: str, url: str) -> str:
    title = re.sub(r"\s+", " ", value).strip()
    if title:
        return title
    filename = Path(unquote(urlparse(url).path)).stem
    return re.sub(r"[_-]+", " ", filename).strip()


def stable_name(title: str, url: str, suffix: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:8]
    return f"{slugify(title)}-{digest}{suffix}"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def fetch(client: httpx.Client, url: str, attempts: int = 3) -> httpx.Response:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = client.get(url)
            response.raise_for_status()
            return response
        except Exception as exc:  # noqa: BLE001 - recorded in the manifest
            last_error = exc
            if attempt < attempts:
                time.sleep(attempt * 1.5)
    raise RuntimeError(f"Gagal mengunduh {url}: {last_error}") from last_error


def collect_links(html: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    soup = BeautifulSoup(html, "html.parser")
    pdf_links: dict[str, str] = {}
    faq_links: dict[str, str] = {}

    for anchor in soup.find_all("a", href=True):
        href = urljoin(INDEX_URL, anchor["href"])
        title = clean_title(anchor.get_text(" ", strip=True), href)
        parsed = urlparse(href)
        host = parsed.netloc.lower()
        if host not in {"pajak.go.id", "www.pajak.go.id", "stats.pajak.go.id"}:
            continue

        if parsed.path.lower().endswith(".pdf"):
            pdf_links[href] = title
            continue

        normalized_path = parsed.path.rstrip("/")
        if "/coretaxpedia/" not in normalized_path:
            continue
        if normalized_path.endswith("/buku-panduan-coretax-djp"):
            continue
        if normalized_path.endswith("/templat-impor-data-ke-coretax-djp"):
            continue
        faq_links[href] = title

    for element in soup.select("[data-slug]"):
        slug = str(element.get("data-slug") or "").strip()
        if not slug:
            continue
        title = clean_title(element.get_text(" ", strip=True), slug)
        url = urljoin(CORETAXPEDIA_URL, slug)
        faq_links[url] = title

    pdfs = sorted(((title, url) for url, title in pdf_links.items()), key=str)
    faqs = sorted(((title, url) for url, title in faq_links.items()), key=str)
    return pdfs, faqs


def extract_pdf(
    content: bytes,
    title: str,
    source_url: str,
    output_path: Path,
) -> tuple[int, int, int]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".source.pdf")
    temp_path.write_bytes(content)
    try:
        reader = PdfReader(temp_path)
        pages: list[str] = []
        empty_pages = 0
        for index, page in enumerate(reader.pages, start=1):
            text = fix_text(page.extract_text() or "").strip()
            if not text:
                empty_pages += 1
                text = "[Halaman tidak memiliki teks yang dapat diekstrak.]"
            pages.append(f"## Halaman {index}\n\n{text}")

        front_matter = (
            "---\n"
            f'title: "{title.replace(chr(34), chr(39))}"\n'
            f'source_url: "{source_url}"\n'
            f'publisher: "{PUBLISHER}"\n'
            f'accessed_at: "{date.today().isoformat()}"\n'
            'source_type: "official_pdf"\n'
            "---\n\n"
        )
        body = f"# {title}\n\n" + "\n\n".join(pages) + "\n"
        output_path.write_text(front_matter + body, encoding="utf-8")
        return len(reader.pages), len(body), empty_pages
    finally:
        temp_path.unlink(missing_ok=True)


def select_article(soup: BeautifulSoup):
    selectors = [
        "#faq-content",
        "article",
        ".node__content",
        ".field--name-body",
        "main",
    ]
    for selector in selectors:
        node = soup.select_one(selector)
        if node is not None:
            return node
    return soup.body or soup


def extract_html(
    html: str,
    title: str,
    source_url: str,
    output_path: Path,
) -> int:
    soup = BeautifulSoup(html, "html.parser")
    article = select_article(soup)
    for element in article.select(
        "script, style, form, nav, header, footer, aside, .breadcrumb, .social-sharing"
    ):
        element.decompose()

    page_heading = article.find(["h1", "h2"])
    if page_heading and page_heading.get_text(" ", strip=True):
        title = page_heading.get_text(" ", strip=True)

    converted = fix_text(
        markdownify(str(article), heading_style="ATX", bullets="-")
    )
    converted = re.sub(r"\n{3,}", "\n\n", converted).strip()
    for marker in (
        "\nDilihat sebanyak:",
        "\n###### Apakah informasi ini membantu?",
        "\n##### Berikan Masukan",
    ):
        if marker in converted:
            converted = converted.split(marker, 1)[0].rstrip()
    front_matter = (
        "---\n"
        f'title: "{title.replace(chr(34), chr(39))}"\n'
        f'source_url: "{source_url}"\n'
        f'publisher: "{PUBLISHER}"\n'
        f'accessed_at: "{date.today().isoformat()}"\n'
        'source_type: "official_html"\n'
        "---\n\n"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(front_matter + converted + "\n", encoding="utf-8")
    return len(converted)


def write_manifest(
    output_path: Path,
    records: list[SourceRecord],
    pdf_count: int,
    faq_count: int,
) -> None:
    payload = {
        "generated_at": date.today().isoformat(),
        "publisher": PUBLISHER,
        "index_urls": INDEX_URLS,
        "discovered_pdf_links": pdf_count,
        "discovered_faq_links": faq_count,
        "records": [asdict(record) for record in records],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_existing_records(project_root: Path, manifest_path: Path) -> dict[str, SourceRecord]:
    if not manifest_path.exists():
        return {}
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    records: dict[str, SourceRecord] = {}
    for item in payload.get("records", []):
        try:
            record = SourceRecord(**item)
        except TypeError:
            continue
        source_exists = bool(record.source_file) and (
            project_root / record.source_file
        ).exists()
        rag_exists = bool(record.rag_file) and (project_root / record.rag_file).exists()
        if record.status == "ok" and source_exists and rag_exists:
            records[record.source_url] = record
    return records


def sync(project_root: Path, include_faq: bool) -> list[SourceRecord]:
    knowledge_dir = project_root / "knowledge"
    pdf_source_dir = knowledge_dir / "source_files" / "pdfs"
    pdf_rag_dir = knowledge_dir / "manuals"
    faq_rag_dir = knowledge_dir / "coretaxpedia"
    manifest_path = knowledge_dir / "_meta" / "source-manifest.json"

    records_by_url = load_existing_records(project_root, manifest_path)
    with httpx.Client(
        follow_redirects=True,
        timeout=httpx.Timeout(90.0, connect=30.0),
        headers={"User-Agent": USER_AGENT},
    ) as client:
        discovered_pdfs: dict[str, str] = {url: title for title, url in EXTRA_PDF_LINKS}
        discovered_faqs: dict[str, str] = {}
        for index_url in INDEX_URLS:
            index_response = fetch(client, index_url)
            index_pdfs, index_faqs = collect_links(index_response.text)
            discovered_pdfs.update({url: title for title, url in index_pdfs})
            discovered_faqs.update({url: title for title, url in index_faqs})

        pdf_links = sorted(
            ((title, url) for url, title in discovered_pdfs.items()), key=str
        )
        faq_links = sorted(
            ((title, url) for url, title in discovered_faqs.items()), key=str
        )
        print(f"Ditemukan {len(pdf_links)} PDF dan {len(faq_links)} halaman FAQ resmi.")

        for index, (title, url) in enumerate(pdf_links, start=1):
            print(f"[PDF {index}/{len(pdf_links)}] {title}", flush=True)
            existing = records_by_url.get(url)
            if existing:
                print("  -> sudah tersedia, dilewati", flush=True)
                continue
            try:
                response = fetch(client, url)
                content = response.content
                if not content.startswith(b"%PDF"):
                    raise ValueError("Respons bukan file PDF.")
                filename = stable_name(title, str(response.url), ".pdf")
                source_path = pdf_source_dir / filename
                rag_path = pdf_rag_dir / Path(filename).with_suffix(".md")
                source_path.parent.mkdir(parents=True, exist_ok=True)
                source_path.write_bytes(content)
                pages, chars, empty_pages = extract_pdf(
                    content,
                    title,
                    str(response.url),
                    rag_path,
                )
                record = SourceRecord(
                        title=title,
                        source_url=str(response.url),
                        source_type="official_pdf",
                        source_file=str(source_path.relative_to(project_root)),
                        rag_file=str(rag_path.relative_to(project_root)),
                        sha256=sha256_bytes(content),
                        bytes=len(content),
                        pages=pages,
                        extracted_chars=chars,
                        empty_pages=empty_pages,
                    )
                records_by_url[record.source_url] = record
            except Exception as exc:  # noqa: BLE001 - recorded for audit
                record = SourceRecord(
                        title=title,
                        source_url=url,
                        source_type="official_pdf",
                        source_file="",
                        rag_file="",
                        sha256="",
                        bytes=0,
                        status="error",
                        note=str(exc),
                    )
                records_by_url[url] = record

        if include_faq:
            for index, (title, url) in enumerate(faq_links, start=1):
                print(f"[FAQ {index}/{len(faq_links)}] {title}", flush=True)
                existing = records_by_url.get(url)
                if existing:
                    print("  -> sudah tersedia, dilewati", flush=True)
                    continue
                try:
                    response = fetch(client, url)
                    html = response.text
                    filename = stable_name(title, str(response.url), ".html")
                    rag_path = faq_rag_dir / Path(filename).with_suffix(".md")
                    chars = extract_html(html, title, str(response.url), rag_path)
                    status = "ok" if chars >= 150 else "warning"
                    note = None if chars >= 150 else "Hasil ekstraksi sangat pendek."
                    record = SourceRecord(
                            title=title,
                            source_url=str(response.url),
                            source_type="official_html",
                            source_file="",
                            rag_file=str(rag_path.relative_to(project_root)),
                            sha256=sha256_bytes(response.content),
                            bytes=len(response.content),
                            extracted_chars=chars,
                            status=status,
                            note=note,
                        )
                    records_by_url[record.source_url] = record
                except Exception as exc:  # noqa: BLE001 - recorded for audit
                    record = SourceRecord(
                            title=title,
                            source_url=url,
                            source_type="official_html",
                            source_file="",
                            rag_file="",
                            sha256="",
                            bytes=0,
                            status="error",
                            note=str(exc),
                        )
                    records_by_url[url] = record

        records = sorted(records_by_url.values(), key=lambda record: record.source_url)
        write_manifest(manifest_path, records, len(pdf_links), len(faq_links))

    return records


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sinkronisasi dokumen resmi Coretax DJP untuk knowledge base RAG."
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--skip-faq",
        action="store_true",
        help="Hanya unduh buku panduan PDF, tanpa halaman FAQ Coretaxpedia.",
    )
    args = parser.parse_args()

    records = sync(args.project_root.resolve(), include_faq=not args.skip_faq)
    ok = sum(record.status == "ok" for record in records)
    warnings = sum(record.status == "warning" for record in records)
    errors = sum(record.status == "error" for record in records)
    print(f"Selesai: {ok} berhasil, {warnings} peringatan, {errors} gagal.")
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
