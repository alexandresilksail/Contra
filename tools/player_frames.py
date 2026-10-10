"""Measure every player-pose cell on players.png.

For each cell we report the tight bounding box of the *sprite* pixels (i.e.
after chroma-keying the panel background), which tells us:
  - the real frame size / crop (transparent margins)
  - whether the frame is a raised-arm / aiming pose (content extends high
    and/or wide = a rifle sticking out)
  - vertical order (head row) so we can compare poses consistently
"""
from PIL import Image

IMG = "public/sprites/players.png"
im = Image.open(IMG).convert("RGBA")
W, H = im.size
px = im.load()

# panel background shades used on the character sheet
KEYS = [(0, 47, 87), (28, 102, 145), (157, 28, 72), (82, 14, 0)]
DIST2 = 70 * 70


def is_key(c):
    r, g, b, a = c
    if a == 0:
        return True
    for kr, kg, kb in KEYS:
        dr, dg, db = r - kr, g - kg, b - kb
        if dr * dr + dg * dg + db * db < DIST2:
            return True
    return False


def measure(cell):
    x, y, w, h = cell
    minx, miny, maxx, maxy = w, h, -1, -1
    n = 0
    # column profile -> where the rifle/arm sticks out horizontally
    coltop = {}
    for j in range(h):
        for i in range(w):
            if not is_key(px[x + i, y + j]):
                n += 1
                if i < minx: minx = i
                if i > maxx: maxx = i
                if j < miny: miny = j
                if j > maxy: maxy = j
                if j not in coltop or i < coltop[j]:
                    coltop[j] = i
    if n == 0:
        return None
    return {
        "n": n,
        "bbox": (minx, miny, maxx - minx + 1, maxy - miny + 1),
        "top": miny,
        "bottom": maxy,
        "left": minx,
        "right": maxx,
        "rows": maxy - miny + 1,
    }


RAZOR_CYCLE = [
    (25, 24, 19, 48), (90, 25, 20, 46), (154, 24, 19, 48), (220, 24, 18, 48),
    (285, 25, 20, 46), (349, 24, 20, 48), (415, 24, 25, 48), (480, 25, 25, 46),
    (544, 24, 26, 48), (610, 25, 25, 47), (675, 26, 25, 45), (739, 25, 26, 47),
]
RAZOR_OTHER = {
    "jump": (25, 203, 18, 48),
    "fall": (220, 204, 18, 47),
    "crouch": (919, 42, 40, 16),
    "climb0": (804, 8, 18, 64),
    "climb1": (869, 9, 18, 63),
    "dead0": (413, 203, 19, 64),
    "dead1": (478, 204, 19, 64),
}

print("sheet", im.size)
print("\n--- razor walk/shoot cycle (12 cells) ---")
print(f"{'i':>2} {'cell':>18} {'px':>5} {'bbox(x,y,w,h)':>18} {'top':>4} {'h':>3} {'left':>4} {'right':>5}")
for i, c in enumerate(RAZOR_CYCLE):
    m = measure(c)
    if not m:
        print(f"{i:>2} {str(c):>18}  EMPTY")
        continue
    print(f"{i:>2} {str(c):>18} {m['n']:>5} {str(m['bbox']):>18} "
          f"{m['top']:>4} {m['rows']:>3} {m['left']:>4} {m['right']:>5}")

print("\n--- razor special poses ---")
for k, c in RAZOR_OTHER.items():
    m = measure(c)
    if not m:
        print(f"{k:>8} {str(c):>18}  EMPTY")
        continue
    print(f"{k:>8} {str(c):>18} {m['n']:>5} {str(m['bbox']):>18} "
          f"{m['top']:>4} {m['rows']:>3} {m['left']:>4} {m['right']:>5}")
