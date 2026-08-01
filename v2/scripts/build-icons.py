#!/usr/bin/env python3
"""
Build the browser and search-result icons from the brand mark.
=============================================================================
Run this rather than hand-exporting, so the icons can be rebuilt identically
when the mark changes.

    python3 scripts/build-icons.py

Reads   brand/icon-source.png  (the 4096px transparent master)
Writes  app/favicon.ico        16 + 32 + 48, what Google reads
        app/icon.png           192px, a multiple of 48 as Google requires
        app/apple-icon.png     180px, full-bleed for iOS

Two decisions are baked in here, both from looking at the mark at actual tab
size rather than at full resolution:

TRIM AND RECENTRE. The master is 55% x 69% ink on a 4096 canvas, and it is
off-centre (1071px of padding left against 760px right). Scaled straight down,
almost half the favicon's width is empty. Cropping to the ink bounding box and
re-padding evenly makes the mark visibly larger at 16 and 32px.

PAPER TILE. The mark's body is deep navy. On a dark browser tab (#202124 in
Chrome) that body merges into the background and only the gold buildings and
path survive, which at 16px reads as a smudge. A paper tile behind it holds up
on light and dark alike, and costs nothing in search results because Google
composites favicons onto white regardless.

The iOS icon is deliberately different: full-bleed, square, no alpha. iOS
applies its own squircle mask, so supplying pre-rounded corners with
transparency outside them makes iOS fill those corners black.
"""

import pathlib
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "brand" / "icon-source.png"

PAPER = (255, 255, 255, 255)
TILE_PAD = 0.13      # margin around the mark, as a fraction of its long edge
CORNER = 0.18        # tile corner radius, as a fraction of the tile side
APPLE_PAD = 0.17     # iOS crops slightly under its mask, so sit further in


def trimmed_mark(path: pathlib.Path) -> Image.Image:
    """The mark cropped to its ink, with the transparent margin discarded."""
    img = Image.open(path).convert("RGBA")
    box = img.getbbox()
    if box is None:
        sys.exit(f"{path} is fully transparent.")
    return img.crop(box)


def tile(mark: Image.Image, pad: float, radius: float) -> Image.Image:
    """Centre the mark on a square paper tile. radius=0 gives a full-bleed
    square with no alpha, which is what iOS wants."""
    side = int(max(mark.size) * (1 + 2 * pad))

    # Draw the rounded rect at 4x and downsample: PIL has no antialiased
    # primitives, so this is how the corners come out clean.
    scale = 4
    mask = Image.new("L", (side * scale, side * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, side * scale - 1, side * scale - 1],
        radius=int(side * scale * radius),
        fill=255,
    )

    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(Image.new("RGBA", (side, side), PAPER), (0, 0),
                 mask.resize((side, side), Image.LANCZOS))
    canvas.alpha_composite(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    return canvas


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"Missing {SOURCE.relative_to(ROOT)}")

    mark = trimmed_mark(SOURCE)
    print(f"mark trimmed to {mark.width}x{mark.height}")

    rounded = tile(mark, TILE_PAD, CORNER)
    square = tile(mark, APPLE_PAD, 0.0)

    # Google wants a square favicon whose size is a multiple of 48.
    rounded.resize((192, 192), Image.LANCZOS).save(ROOT / "app" / "icon.png")

    # No alpha: iOS composites its own mask and a transparent PNG goes black.
    square.resize((180, 180), Image.LANCZOS).convert("RGB").save(
        ROOT / "app" / "apple-icon.png")

    # 48 is the size Google reads; 16 and 32 keep older browsers sharp instead
    # of letting them downscale the 48 themselves.
    rounded.resize((48, 48), Image.LANCZOS).save(
        ROOT / "app" / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    for name in ("app/icon.png", "app/apple-icon.png", "app/favicon.ico"):
        p = ROOT / name
        print(f"  {name:24} {p.stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
