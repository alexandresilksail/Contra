"""ASCII silhouettes of the razor cycle so pose meaning can be read directly."""
from PIL import Image

IMG = "public/sprites/players.png"
im = Image.open(IMG).convert("RGBA")
px = im.load()

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


CELLS = [
    (25, 24, 19, 48), (90, 25, 20, 46), (154, 24, 19, 48), (220, 24, 18, 48),
    (285, 25, 20, 46), (349, 24, 20, 48), (415, 24, 25, 48), (480, 25, 25, 46),
    (544, 24, 26, 48), (610, 25, 25, 47), (675, 26, 25, 45), (739, 25, 26, 47),
]

# quantised luminance buckets -> characters
CHARS = " .:-=+*#%@"


def render(cell, cols=26, rows=18):
    x, y, w, h = cell
    out = []
    for ry in range(rows):
        line = []
        for rx in range(cols):
            # sample the centre of the block
            sx = x + int((rx + 0.5) * w / cols)
            sy = y + int((ry + 0.5) * h / rows)
            c = px[sx, sy]
            if is_key(c):
                line.append(" ")
            else:
                r, g, b, _ = c
                lum = (r * 299 + g * 587 + b * 114) // 1000
                line.append(CHARS[min(9, lum * 10 // 256)])
        out.append("".join(line))
    return out


# print side by side in 2 rows of 6
for group in range(2):
    frames = [render(CELLS[group * 6 + i]) for i in range(6)]
    print(f"\n=== frames {group*6}..{group*6+5} ===")
    print(" | ".join(f"{group*6+i:^26}" for i in range(6)))
    for r in range(18):
        print(" | ".join(f[r] for f in frames))
