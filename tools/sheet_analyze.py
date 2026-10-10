import pathlib
"""Sprite-sheet frame analysis: background keying + connected components.

Outputs per-quadrant sprite bounding boxes for players.png so frames can be
sliced precisely instead of eyeballed. Original tool code (ours).
"""
import sys, json
from PIL import Image

IMG = "str(SHEET / "players.png")"
im = Image.open(IMG).convert("RGBA")
W, H = im.size
px = im.load()

# ---- 1) find dominant background color per region (sample corners/edges) ----
from collections import Counter
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites"

def dominant(region):
    x0, y0, x1, y1 = region
    c = Counter()
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            c[px[x, y]] += 1
    return c.most_common(3)

quads = {
    "bill":   (0, 0, W // 2, H // 2),
    "enemy":  (W // 2, 0, W, H // 2),
    "lance":  (0, H // 2, W // 2, H),
    "force":  (W // 2, H // 2, W, H),
}
print("size", W, H)
for name, q in quads.items():
    print(name, "dominant:", [(f"#{r:02x}{g:02x}{b:02x}", a) for (r, g, b, a), _ in [(k, v) for k, v in dominant(q)]])
