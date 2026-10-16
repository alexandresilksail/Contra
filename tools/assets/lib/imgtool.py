#!/usr/bin/env python
"""Pixel-level helpers for tools/assets/ (crop sprite frames, convert, contact sheets).

Uses Pillow. NOTE: Unity sprite rects use a BOTTOM-LEFT origin; PIL boxes are
TOP-LEFT, so y is flipped here.

Subcommands:
  crop    --src atlas.png --frames frames.json --outdir DIR --manifest manifest.json
  convert --src IN --out OUT [--format png|webp|bmp] [--max-side N] [--resample nearest|lanczos]
  contact --out sheet.png --cell N --inputs a.png b.png ...   (or --manifest extraction.json)
"""
import argparse
import json
import os
import sys

from PIL import Image


def cmd_crop(args):
    src = Image.open(args.src)
    src = src.convert("RGBA")
    w_img, h_img = src.size
    with open(args.frames, encoding="utf-8") as fh:
        frames = json.load(fh)
    os.makedirs(args.outdir, exist_ok=True)
    written = []
    for f in frames:
        x, y = float(f["x"]), float(f["y"])
        fw, fh = float(f["width"]), float(f["height"])
        # Unity bottom-left origin -> PIL top-left origin
        box = (int(round(x)), int(round(h_img - y - fh)), int(round(x + fw)), int(round(h_img - y)))
        box = (max(0, box[0]), max(0, box[1]), min(w_img, box[2]), min(h_img, box[3]))
        frame = src.crop(box)
        name = f.get("name") or "frame_%d" % len(written)
        safe = "".join(c if (c.isalnum() or c in "-_.") else "_" for c in name)
        out = os.path.join(args.outdir, safe + ".png")
        frame.save(out)
        written.append({"name": name, "file": out, "box": list(box), "size": list(frame.size)})
    with open(args.manifest, "w", encoding="utf-8") as fh:
        json.dump(written, fh, indent=2)
    print("cropped %d frames -> %s" % (len(written), args.outdir))


def cmd_convert(args):
    img = Image.open(args.src)
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA") if has_alpha else img.convert("RGB")
    if args.max_side and max(img.size) > args.max_side:
        resample = Image.NEAREST if args.resample == "nearest" else Image.LANCZOS
        img.thumbnail((args.max_side, args.max_side), resample)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    fmt = (args.format or os.path.splitext(args.out)[1].lstrip(".")).upper()
    if fmt == "JPG":
        fmt = "JPEG"
    save_kwargs = {"lossless": True} if fmt == "WEBP" else {}
    img.save(args.out, fmt, **save_kwargs)
    print("converted %s -> %s (%s %dx%d)" % (args.src, args.out, fmt, img.size[0], img.size[1]))


def cmd_contact(args):
    inputs = []
    if args.manifest:
        with open(args.manifest, encoding="utf-8") as fh:
            entries = json.load(fh)
        inputs = [e["file"] for e in entries]
    inputs.extend(args.inputs or [])
    inputs = [p for p in inputs if os.path.exists(p)]
    if not inputs:
        print("no inputs for contact sheet", file=sys.stderr)
        sys.exit(2)
    imgs = [Image.open(p).convert("RGBA") for p in inputs]
    cell = args.cell or max(max(i.size) for i in imgs)
    cols = args.cols or min(10, len(imgs))
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (24, 24, 28, 255))
    # checkerboard so transparent pixels are visible
    cb = 8
    for yy in range(0, sheet.size[1], cb):
        for xx in range(0, sheet.size[0], cb):
            if (xx // cb + yy // cb) % 2 == 0:
                sheet.paste((40, 40, 46, 255), (xx, yy, xx + cb, yy + cb))
    for idx, im in enumerate(imgs):
        cx, cy = (idx % cols) * cell, (idx // cols) * cell
        sheet.alpha_composite(im, (cx + (cell - im.size[0]) // 2, cy + (cell - im.size[1]) // 2))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    sheet.save(args.out)
    print("contact sheet %s (%d frames, cell %d)" % (args.out, len(imgs), cell))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("crop")
    p.add_argument("--src", required=True)
    p.add_argument("--frames", required=True)
    p.add_argument("--outdir", required=True)
    p.add_argument("--manifest", required=True)
    p.set_defaults(fn=cmd_crop)

    p = sub.add_parser("convert")
    p.add_argument("--src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--format", default=None)
    p.add_argument("--max-side", type=int, default=0)
    p.add_argument("--resample", default="nearest", choices=["nearest", "lanczos"])
    p.set_defaults(fn=cmd_convert)

    p = sub.add_parser("contact")
    p.add_argument("--out", required=True)
    p.add_argument("--cell", type=int, default=0)
    p.add_argument("--cols", type=int, default=0)
    p.add_argument("--manifest", default=None)
    p.add_argument("--inputs", nargs="*", default=[])
    p.set_defaults(fn=cmd_contact)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
