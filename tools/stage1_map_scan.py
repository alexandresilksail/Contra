"""Image-assisted terrain extraction for the whole Stage-1 map image.

The map image (public/sprites/stage1bg.png) is the ORIGINAL REFERENCE and is
never modified. This script only READS it and reports a terrain profile so
collision data can be authored to match the picture:

  * sky / background colour bands
  * per-column "solid top" (first row that stops looking like sky)
  * per-column "solid bottom" (last non-ground-level row)
  * a coarse ASCII silhouette so the layout can be eyeballed

Coordinates reported are IMAGE pixels, origin top-left.
"""
import pathlib
from collections import Counter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "sprites" / "stage1bg.png"

im = Image.open(IMG).convert("RGB")
W, H = im.size
px = im.load()
print(f"image {W} x {H}")

# --- dominant colours overall and in the top band (sky) ---
def band_colors(x0, x1, y0, y1, n=8):
    c = Counter()
    for y in range(y0, y1, max(1, (y1 - y0) // 40)):
        for x in range(x0, x1, max(1, (x1 - x0) // 400)):
            c[px[x, y]] += 1
    return c.most_common(n)

print("\ntop band (y 0..30):", band_colors(0, W, 0, 30))
print("mid band (y 120..160):", band_colors(0, W, 120, 160))
print("bottom band (y %d..%d):" % (H - 30, H), band_colors(0, W, H - 30, H))

# --- sky reference: most common colour in the top rows ---
sky = band_colors(0, W, 0, 20, 1)[0][0]
print("\nsky reference colour:", sky)


def is_sky(c, tol=42):
    r, g, b = c
    return abs(r - sky[0]) <= tol and abs(g - sky[1]) <= tol and abs(b - sky[2]) <= tol


# --- per-column solid top: first row (scanning down) that is not sky ---
print("\nper-column solid top (image px), sampled every 24px:")
prof = []
for x in range(0, W, 24):
    top = H
    for y in range(0, H):
        if not is_sky(px[x, y]):
            top = y
            break
    prof.append((x, top))

line = []
for i in range(0, len(prof), 16):
    chunk = [t for _, t in prof[i:i + 16]]
    line.append(f"x{prof[i][0]:<5} top={min(chunk):>3}/{max(chunk):<3}")
for i in range(0, len(line), 4):
    print("   " + "  ".join(line[i:i + 4]))

# --- coarse ASCII silhouette (16px cells, 8px rows) ---
print("\nASCII silhouette (each col = 48px, each row = 8px, '#' = solid):")
CW, CH = 48, 8
cols = W // CW
rows = H // CH
for r in range(rows):
    y = r * CH + CH // 2
    s = ""
    for c in range(cols):
        x = c * CW + CW // 2
        s += "." if is_sky(px[x, y]) else "#"
    print(f"  y{y:>3} {s}")
