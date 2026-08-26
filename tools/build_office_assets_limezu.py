"""Cut the office sprites the dashboard actually uses out of the LimeZu sheets.

The Modern Interiors licence permits editing the pack and using it in any
project, commercial or not, but forbids passing the pack itself on to anyone
else. So this script is the only thing that ever sees the full sheets: it takes
them from a directory outside the repository, slices out the handful of tiles
this office draws, and writes those -- and only those -- into
``public/static/assets/office``. The sheets themselves are never committed.

Which tiles to cut is not guesswork. The reference project ships its floor as a
Tiled map, so every desk, monitor and stool in it is a recorded tile id; those
ids are transcribed below rather than eyeballed off a contact sheet.

Usage:

    python tools/build_office_assets_limezu.py <dir-with-limezu-sheets>

Expects ``office-tileset.png`` and ``a5-office-floors-walls.png`` in that
directory. Credit to https://limezu.itch.io/ is required by the licence and is
written into the asset catalogue and ATTRIBUTION.md.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

TILE = 16
COLUMNS = 16

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "public" / "static" / "assets" / "office"

CREDIT = "https://limezu.itch.io/moderninteriors"


def box(first_tile: int, tiles_wide: int, tiles_tall: int) -> tuple[int, int, int, int]:
    """Pixel box for a run of tiles, addressed the way a Tiled map addresses them."""
    left = (first_tile % COLUMNS) * TILE
    top = (first_tile // COLUMNS) * TILE
    return left, top, left + tiles_wide * TILE, top + tiles_tall * TILE


# Tile ids read straight out of the reference map's layers.
DESK = box(1, 3, 2)  # 48x32, keyboard and mouse already drawn on the surface
STOOL = box(288, 1, 2)  # 16x32, the seat that stands under each desk
PC_OFF = box(364, 2, 2)  # 32x32, dark screen
PC_ON = box(366, 2, 2)  # 32x32, lit screen
# Three 2x2 floor blocks, each tiling seamlessly. The zones used to be painted
# with recoloured carpet, which is what kept the working area dark; giving each
# one its own floor keeps them readable and lets the pack's own colour through.
FLOOR_BLOCKS = {
    "floor": box(266, 2, 2),  # blue-grey with grout, the walkways
    "ai": box(270, 2, 2),  # sage, the block the reference office is floored with
    "staff": box(268, 2, 2),  # warm cream, so the escalation zone still reads apart
}


def cut(sheet: Image.Image, region: tuple[int, int, int, int]) -> Image.Image:
    return sheet.crop(region).convert("RGBA")


def screen_frames(off: Image.Image, on: Image.Image, count: int) -> list[Image.Image]:
    """Animate the lit screen by rolling whatever differs from the dark one.

    The pack has exactly two monitor states, and the renderer wants three "busy"
    frames. Rather than invent pixels, find the region that is actually screen --
    the pixels where the lit and dark sprites disagree -- and scroll it. Editing
    the art like this is what the licence permits; inventing a third monitor is
    not something the pack owes us.
    """
    off_px, on_px = off.load(), on.load()
    screen = [
        (x, y)
        for y in range(on.height)
        for x in range(on.width)
        if off_px[x, y] != on_px[x, y]
    ]
    if not screen:
        raise SystemExit("monitor sprites are identical -- wrong tile ids?")

    top = min(y for _, y in screen)
    bottom = max(y for _, y in screen)
    span = bottom - top + 1

    frames = []
    for step in range(count):
        frame = on.copy()
        pixels = frame.load()
        for x, y in screen:
            source_y = top + (y - top + step) % span
            pixels[x, y] = on_px[x, source_y]
        frames.append(frame)
    return frames


def write(image: Image.Image, relative: str) -> None:
    target = ASSETS / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target)
    print(f"  {relative:44} {image.width}x{image.height}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    office = Image.open(source / "office-tileset.png").convert("RGBA")
    floors = Image.open(source / "a5-office-floors-walls.png").convert("RGBA")

    print("Memotong sprite dari sheet LimeZu:")
    write(cut(office, DESK), "furniture/DESK/DESK_FRONT.png")
    write(cut(office, STOOL), "furniture/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png")

    off = cut(office, PC_OFF)
    on = cut(office, PC_ON)
    write(off, "furniture/PC/PC_FRONT_OFF.png")
    for index, frame in enumerate(screen_frames(off, on, 3), start=1):
        write(frame, f"furniture/PC/PC_FRONT_ON_{index}.png")

    tiles: dict[str, list[str]] = {}
    for name, region in FLOOR_BLOCKS.items():
        block = cut(floors, region)
        tiles[name] = []
        for row in range(2):
            for column in range(2):
                piece = block.crop(
                    (column * TILE, row * TILE, column * TILE + TILE, row * TILE + TILE)
                )
                filename = f"{name}_{row * 2 + column}.png"
                write(piece, f"floors/{filename}")
                tiles[name].append(filename)

    catalogue_path = ASSETS / "catalog.json"
    catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))

    catalogue["floors"] = tiles["floor"]
    catalogue["floorZones"] = {"ai": tiles["ai"], "staff": tiles["staff"]}
    # The four tiles are one 2x2 block, so they have to be laid down by position.
    # Picking them by hash, which is what a set of interchangeable variants wants,
    # shreds the pattern into noise.
    catalogue["floorPattern"] = [2, 2]
    catalogue["floorsTinted"] = False

    assets = catalogue["assets"]
    for name in ("PC_FRONT_OFF", "PC_FRONT_ON_1", "PC_FRONT_ON_2", "PC_FRONT_ON_3"):
        assets[name]["w"] = 32
        assets[name]["fw"] = 2

    catalogue["limezu"] = {
        "pack": "Modern Interiors - RPG Tileset [16X16] by LimeZu",
        "credit": CREDIT,
        "note": (
            "Only the tiles this office draws are vendored, cut by "
            "tools/build_office_assets_limezu.py. The pack is not redistributed."
        ),
        "covers": ["floors", "DESK_FRONT", "WOODEN_CHAIR_FRONT", "PC_FRONT_*"],
    }

    # Sprite filenames never change, so a browser holding a day-old copy of
    # DESK_FRONT.png would keep drawing the old desk however many times the file
    # is rewritten. Stamp the catalogue with a digest of the artwork and let the
    # loader hang it off every sprite URL.
    digest = hashlib.sha1()
    for path in sorted(ASSETS.rglob("*.png")):
        digest.update(path.relative_to(ASSETS).as_posix().encode())
        digest.update(path.read_bytes())
    catalogue["version"] = digest.hexdigest()[:12]

    catalogue_path.write_text(json.dumps(catalogue, indent=2) + "\n", encoding="utf-8")
    print(f"\ncatalog.json diperbarui: floors={catalogue['floors']}, PC 32x32")
    print(f"versi aset: {catalogue['version']}")


if __name__ == "__main__":
    main()
