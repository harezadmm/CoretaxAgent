"""Vendor the pixel-art office assets used by the Virtual Office dashboard view.

Sprites come from https://github.com/pixel-agents-hq/pixel-agents (MIT). They are
committed into ``app/static/assets/office/`` so the dashboard has no build step and
no runtime dependency on GitHub; this script exists to make that copy reproducible
and to regenerate ``catalog.json``.

The catalog collapses the upstream per-furniture ``manifest.json`` files into a
single document so the browser fetches one file instead of twenty-five. Upstream
manifests nest rotation inside state inside animation; the catalog flattens that
into a flat ``assets`` map plus a ``groups`` index, which is all the renderer and
the layout editor actually need.

Usage::

    python tools/sync_office_assets.py            # refresh everything
    python tools/sync_office_assets.py --catalog  # rebuild catalog.json only
"""

from __future__ import annotations

import argparse
import base64
import json
import struct
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO = "pixel-agents-hq/pixel-agents"
UPSTREAM_PREFIX = "webview-ui/public/assets/"
DEST = Path(__file__).resolve().parent.parent / "app" / "static" / "assets" / "office"

# Upstream ships pet sprites too; the office view has no pets, so they are skipped.
SKIP_DIRS = ("pets/",)


def _api(url: str) -> Any:
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def list_upstream_assets() -> list[str]:
    tree = _api(f"https://api.github.com/repos/{REPO}/git/trees/HEAD?recursive=1")
    paths = []
    for entry in tree["tree"]:
        path = entry.get("path", "")
        if entry.get("type") != "blob" or not path.startswith(UPSTREAM_PREFIX):
            continue
        relative = path[len(UPSTREAM_PREFIX):]
        # Match on the path *after* the prefix so that "carpets/" is not mistaken
        # for "pets/" -- the substring is genuinely there.
        if any(relative.startswith(skip) for skip in SKIP_DIRS):
            continue
        if relative == "default-layout-1.json":
            continue  # upstream's own office layout; this project ships its own
        paths.append(relative)
    return sorted(paths)


def download(relative: str) -> bytes:
    url = f"https://api.github.com/repos/{REPO}/contents/{UPSTREAM_PREFIX}{relative}"
    payload = _api(url)
    return base64.b64decode(payload["content"])


def png_size(data: bytes) -> tuple[int, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def sync_files() -> list[str]:
    relatives = list_upstream_assets()
    for relative in relatives:
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        data = download(relative)
        if relative.endswith(".png"):
            png_size(data)  # raises if the download is truncated or rate-limited HTML
        target.write_bytes(data)
        print(f"  {relative}")
    return relatives


def _flatten(node: dict[str, Any], group_dir: str, inherited: dict[str, Any]) -> list[dict[str, Any]]:
    """Walk an upstream manifest tree, returning one record per leaf sprite."""
    context = dict(inherited)
    for key in ("orientation", "state", "frame"):
        if key in node:
            context[key] = node[key]

    if node.get("type") == "group":
        out: list[dict[str, Any]] = []
        for member in node.get("members", []):
            out.extend(_flatten(member, group_dir, context))
        return out

    asset_id = node["id"]
    return [
        {
            "id": asset_id,
            "file": f"furniture/{group_dir}/{node.get('file', asset_id + '.png')}",
            "w": node["width"],
            "h": node["height"],
            "fw": node.get("footprintW", 1),
            "fh": node.get("footprintH", 1),
            "orientation": context.get("orientation"),
            "state": context.get("state"),
            "frame": context.get("frame"),
        }
    ]


def build_catalog() -> dict[str, Any]:
    groups: dict[str, Any] = {}
    assets: dict[str, Any] = {}

    for manifest_path in sorted((DEST / "furniture").glob("*/manifest.json")):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        group_dir = manifest_path.parent.name
        records = _flatten(manifest, group_dir, {})
        for record in records:
            assets[record["id"]] = {
                key: value for key, value in record.items() if key != "id" and value is not None
            }
        variants = [record["id"] for record in records]
        groups[manifest["id"]] = {
            "name": manifest.get("name", manifest["id"]),
            "category": manifest.get("category", "misc"),
            "onWall": bool(manifest.get("canPlaceOnWalls")),
            "onSurface": bool(manifest.get("canPlaceOnSurfaces")),
            "variants": variants,
            "default": variants[0] if variants else None,
        }

    floors = sorted(p.name for p in (DEST / "floors").glob("floor_*.png"))
    carpets = sorted(p.name for p in (DEST / "carpets").glob("carpet_*.png"))
    walls = sorted(p.name for p in (DEST / "walls").glob("wall_*.png"))
    characters = sorted(p.name for p in (DEST / "characters").glob("char_*.png"))

    return {
        "source": f"https://github.com/{REPO}",
        "license": "MIT",
        "tileSize": 16,
        "character": {
            "files": characters,
            "frameW": 16,
            "frameH": 32,
            "framesPerRow": 7,
            "rows": ["down", "up", "right"],
            # Frame indices within a direction row, mirroring upstream's mapping.
            "walk": [0, 1, 2, 1],
            "typing": [3, 4],
            "reading": [5, 6],
        },
        "floors": floors,
        "carpets": carpets,
        "walls": walls,
        "groups": groups,
        "assets": assets,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        action="store_true",
        help="rebuild catalog.json from the already-vendored manifests, skipping downloads",
    )
    args = parser.parse_args()

    if not args.catalog:
        print(f"Downloading office sprites from {REPO} ...")
        try:
            relatives = sync_files()
        except urllib.error.HTTPError as error:  # pragma: no cover - network path
            print(f"GitHub API error: {error}", file=sys.stderr)
            return 1
        print(f"Synced {len(relatives)} files into {DEST}")

    catalog = build_catalog()
    (DEST / "catalog.json").write_text(
        json.dumps(catalog, indent=2, sort_keys=False) + "\n", encoding="utf-8"
    )
    print(
        f"catalog.json: {len(catalog['groups'])} furniture groups, "
        f"{len(catalog['assets'])} sprites, {len(catalog['floors'])} floors, "
        f"{len(catalog['carpets'])} carpets, "
        f"{len(catalog['character']['files'])} characters"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
