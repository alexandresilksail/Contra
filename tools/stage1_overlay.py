"""Visual verify overlay: draw the EXTRACTED collision surfaces on top of the
map image so the two can be compared by eye.

READ-ONLY on public/sprites/. Writes tools/stage1_verify_*.png (gitignored).

  green  top of solid ground / bridge deck / fortress wall
  blue   water surface (wade floor is capped at GROUND_ROW+2)
  amber  pit / crevice floor
  pink   destructible weapon-container sensor tiles
"""
import pathlib
from PIL import Image, ImageDraw
import json

ROOT = pathlib.Path(__file__).resolve().parent.parent
IM = ROOT / "public" / "sprites" / "stage1bg.png"
DATA = ROOT / "tools" / "stage1_layout.json"

TILE = 16
IMG_TO_WORLD = 253
Y_OFFSET = 253                       # world = y_img + 253 -> y_img = world - 253


def img_y(row):
    return row * TILE - Y_OFFSET


def main():
    d = json.loads(DATA.read_text())
    im = Image.open(IM).convert("RGB")
    for idx, (a, b) in enumerate(((0, 71), (72, 143), (144, 215))):
        canvas = im.crop((a * TILE, 8, b * TILE + TILE, 224)).copy()
        dr = ImageDraw.Draw(canvas)

        def hline(c0, c1, row, color, off=(a * TILE)):
            y = img_y(row)
            if y < 0 or y > 216:
                return
            dr.line([(c0 * TILE - off, y), (c1 * TILE + TILE - off, y)],
                    fill=color, width=2)

        for c0, c1, row in d["ground"]:
            if c1 >= a and c0 <= b:
                hline(max(c0, a), min(c1, b), row, (0, 255, 0))
        for c0, c1, row in d["bridges"]:
            if c1 >= a and c0 <= b:
                hline(max(c0, a), min(c1, b), row, (0, 255, 0))
        for c0, c1, row in d["walls"]:
            if c1 >= a and c0 <= b:
                hline(max(c0, a), min(c1, b), row, (0, 255, 0))
        for c0, c1, row in d["water"]:
            if c1 >= a and c0 <= b:
                hline(max(c0, a), min(c1, b), row, (60, 140, 255))
                hline(max(c0, a), min(c1, b), min(row, 24), (255, 220, 0))
        for c0, c1 in d["pits"]:
            if c1 >= a and c0 <= b:
                hline(max(c0, a), min(c1, b), 24, (255, 220, 0))
        for c0, c1, row in d["platforms"]:
            if c1 >= a and c0 <= b:
                hline(max(c0, a), min(c1, b), row, (0, 200, 255))
        for col, r0, r1 in d["sensors"]:
            if a <= col <= b:
                x = col * TILE - a * TILE
                dr.rectangle([x, img_y(r0), x + TILE, img_y(r1 + 1)], outline=(255, 60, 180))
        out = ROOT / f"tools/stage1_verify_{idx}.png"
        canvas.save(out)
        print("wrote", out.name)

if __name__ == "__main__":
    main()
