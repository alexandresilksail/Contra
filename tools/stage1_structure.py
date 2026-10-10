"""Structural probe for the Stage-1 map image: is it a continuous level strip
or a tile atlas? Reports per-row / per-column ink so a grid pitch can be seen.
"""
import pathlib
from collections import Counter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
im = Image.open(ROOT / "public" / "sprites" / "stage1bg.png").convert("RGB")
W, H = im.size
px = im.load()
print(f"image {W} x {H}")

print("\n-- per-row: dominant colour + non-black count (0=empty row) --")
for y in range(H):
    c = Counter()
    nb = 0
    for x in range(0, W, 3):
        p = px[x, y]
        c[p] += 1
        if p != (0, 0, 0):
            nb += 1
    dom, n = c.most_common(1)[0]
    tot = len(range(0, W, 3))
    bar = "#" * int(30 * nb / tot)
    if y < 40 or y % 8 == 0 or y > H - 12:
        print(f"  y{y:>3}  nonBlack={nb:>4}/{tot}  dom={str(dom):>18} x{n:<5} {bar}")
