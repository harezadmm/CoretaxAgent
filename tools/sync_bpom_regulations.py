"""Mirror BPOM's regulations from BPK's public database into the knowledge base.

BPOM's own JDIH cannot be enumerated: its catalog endpoint answers 500, and the
document ids behind /download/detilprod are sparse enough that a sampled crawl
found nothing. The national aggregator renders its results client-side and caps
them. BPK publishes the same regulations as server-rendered HTML with a working
paginated filter, so that is the source of record here.

Filters are numeric ids, not labels — passing the label silently returns the
entire national corpus of ~300k documents instead of failing, so the ids below
are load-bearing.

Usage:
    python tools/sync_bpom_regulations.py --out work/bpom-knowledge [--limit N]
"""
from __future__ import annotations

import argparse
import hashlib
import io
import re
import sys
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import httpx
import pymupdf
from bs4 import BeautifulSoup

BASE = "https://peraturan.bpk.go.id"
# entitas=644 is "Badan Pengawas Obat dan Makanan" and covers every document
# type the agency issues, so it is preferred over the per-jenis filters.
SEARCH = f"{BASE}/Search?entitas=644"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Sec-Fetch-Mode": "navigate",
    "Upgrade-Insecure-Requests": "1",
}

PUBLISHER = "Badan Pengawas Obat dan Makanan Republik Indonesia"
DELAY = 1.0


@dataclass
class Regulation:
    detail_url: str
    title: str
    meta: dict[str, str]
    pdf_url: str | None = None
    text: str = ""


def client() -> httpx.Client:
    return httpx.Client(headers=HEADERS, follow_redirects=True, timeout=httpx.Timeout(90.0, connect=30.0))


def get(session: httpx.Client, url: str, attempts: int = 4) -> httpx.Response | None:
    """BPK stalls under sustained crawling, so back off rather than give up."""
    for attempt in range(attempts):
        try:
            response = session.get(url)
            if response.status_code == 200:
                return response
        except httpx.HTTPError:
            pass
        time.sleep(DELAY * (attempt + 2))
    return None


def last_page(html: str) -> int:
    # Pagination hrefs arrive HTML-escaped, so the separator before p= is ";"
    # from "&amp;" rather than "&". Anchoring on [?&] silently found one page
    # and quietly crawled 4% of the catalogue.
    pages = [int(n) for n in re.findall(r"[?&;]p=(\d+)", html)]
    return max(pages) if pages else 1


def parse_listing(html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, str] = {}
    for link in soup.select('a[href^="/Details/"]'):
        href = link.get("href")
        title = " ".join(link.get_text(" ", strip=True).split())
        if not href or not title or len(title) < 12:
            continue
        found.setdefault(urljoin(BASE, href), title)
    return list(found.items())


def parse_detail(html: str, url: str, fallback_title: str) -> Regulation:
    soup = BeautifulSoup(html, "html.parser")

    # Metadata is a two-column grid of divs, not a table: the label carries
    # .col-lg-3.fw-bold and the value is its next sibling. Reading <td>/<th>
    # instead — as this first did — matched an unrelated table and returned
    # nothing, so every document was written with a default status and no year.
    meta: dict[str, str] = {}
    for label_div in soup.select("div.col-lg-3.fw-bold"):
        label = " ".join(label_div.get_text(" ", strip=True).split())
        value_div = label_div.find_next_sibling("div")
        if not label or value_div is None:
            continue
        value = " ".join(value_div.get_text(" ", strip=True).split())
        if value:
            meta.setdefault(label, value)

    pdf = None
    for link in soup.select('a[href*="/Download/"]'):
        href = link.get("href", "")
        if href.lower().endswith(".pdf"):
            pdf = urljoin(BASE, href)
            break

    return Regulation(
        detail_url=url,
        title=meta.get("Judul") or fallback_title,
        meta=meta,
        pdf_url=pdf,
    )


def pdf_text(blob: bytes) -> str:
    with pymupdf.open(stream=io.BytesIO(blob), filetype="pdf") as doc:
        return "\n".join(page.get_text("text") for page in doc)


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def slugify(value: str, limit: int = 70) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:limit].strip("-") or "peraturan"


def status_of(meta: dict[str, str]) -> str:
    raw = (meta.get("Status") or "").lower()
    if "cabut" in raw or "tidak berlaku" in raw:
        return "repealed"
    if "ubah" in raw:
        return "superseded"
    return "active"


def write_document(out_dir: Path, reg: Regulation) -> Path:
    digest = hashlib.sha1(reg.detail_url.encode("utf-8")).hexdigest()[:8]
    path = out_dir / f"{slugify(reg.title)}-{digest}.md"

    def esc(value: str) -> str:
        return value.replace('"', "'").strip()

    front = [
        "---",
        f'title: "{esc(reg.title)}"',
        f'source_url: "{reg.detail_url}"',
        f'publisher: "{PUBLISHER}"',
        f'accessed_at: "{date.today().isoformat()}"',
        'source_type: "official_regulation"',
        f'status: "{status_of(reg.meta)}"',
        # KnowledgeBase drops any official_regulation whose extraction it cannot
        # vouch for, and it reads that verdict from these two keys. Omitting
        # them scores the document 0 characters and skips it without a word.
        f'extracted_chars: "{len(reg.text)}"',
        f'extraction_status: "{"ok" if len(reg.text) >= 150 else "warning"}"',
    ]
    # "Status" would slugify to "status" and shadow the normalised value above,
    # and the front-matter parser keeps the last key it sees — so BPK's wording
    # is preserved under a distinct name.
    renamed = {"Status": "status_sumber"}
    for key in ("Nomor", "Tahun", "Bentuk Singkat", "Subjek", "Status"):
        if reg.meta.get(key):
            name = renamed.get(key) or slugify(key).replace("-", "_")
            front.append(f'{name}: "{esc(reg.meta[key])}"')
    front.append("---")

    body = [f"## {reg.title}", ""]
    if reg.meta:
        body.append("### Metadata")
        for key in ("Bentuk", "Nomor", "Tahun", "Tempat Penetapan", "Subjek", "Status"):
            if reg.meta.get(key):
                body.append(f"- **{key}:** {reg.meta[key]}")
        body.append("")
    if reg.text:
        body.append("### Isi peraturan")
        body.append("")
        body.append(reg.text)

    path.write_text("\n".join(front) + "\n\n" + "\n".join(body) + "\n", encoding="utf-8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="work/bpom-knowledge")
    parser.add_argument("--limit", type=int, default=0, help="stop after N documents (0 = all)")
    parser.add_argument("--max-pages", type=int, default=0)
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    with client() as session:
        first = get(session, SEARCH)
        if first is None:
            print("Gagal membuka katalog BPK.", file=sys.stderr)
            return 1
        pages = last_page(first.text)
        if args.max_pages:
            pages = min(pages, args.max_pages)
        print(f"katalog: {pages} halaman", flush=True)

        entries: list[tuple[str, str]] = []
        seen: set[str] = set()
        for page in range(1, pages + 1):
            html = first.text if page == 1 else (lambda r: r.text if r else "")(get(session, f"{SEARCH}&p={page}"))
            if not html:
                print(f"  halaman {page}: gagal", flush=True)
                continue
            rows = [row for row in parse_listing(html) if row[0] not in seen]
            seen.update(url for url, _ in rows)
            entries.extend(rows)
            print(f"  halaman {page}: +{len(rows)} (total {len(entries)})", flush=True)
            time.sleep(DELAY)

        if args.limit:
            entries = entries[: args.limit]

        print(f"\nmengunduh {len(entries)} dokumen\n", flush=True)
        written = skipped = failed = 0
        chars = 0
        for index, (url, title) in enumerate(entries, start=1):
            detail = get(session, url)
            if detail is None:
                failed += 1
                print(f"[{index}/{len(entries)}] GAGAL detail {url}", flush=True)
                continue
            reg = parse_detail(detail.text, url, title)

            if reg.pdf_url:
                blob = get(session, reg.pdf_url)
                if blob is not None and blob.content[:4] == b"%PDF":
                    try:
                        reg.text = clean(pdf_text(blob.content))
                    except Exception as error:  # noqa: BLE001 - keep crawling
                        print(f"    pdf tidak terbaca: {error}", flush=True)

            if not reg.text:
                skipped += 1
                print(f"[{index}/{len(entries)}] tanpa teks: {reg.title[:60]}", flush=True)
                time.sleep(DELAY)
                continue

            write_document(out_dir, reg)
            written += 1
            chars += len(reg.text)
            print(f"[{index}/{len(entries)}] {len(reg.text):>7} char  {reg.title[:62]}", flush=True)
            time.sleep(DELAY)

    print(f"\nselesai: {written} ditulis, {skipped} tanpa teks, {failed} gagal")
    if written:
        print(f"total {chars:,} karakter, rata-rata {chars // written:,} char/dokumen")
        print(f"perkiraan chunk (~900 char): {chars // 900:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
