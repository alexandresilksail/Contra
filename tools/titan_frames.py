"""Same measurement as player_frames.py but for the RED (right) column."""
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


def measure(cell):
    x, y, w, h = cell
    minx, miny, maxx, maxy, n = w, h, -1, -1, 0
    for j in range(h):
        for i in range(w):
            if not is_key(px[x + i, y + j]):
                n += 1
                minx = min(minx, i); maxx = max(maxx, i)
                miny = min(miny, j); maxy = max(maxy, j)
    if n == 0:
        return None
    return (minx, miny, maxx - minx + 1, maxy - miny + 1), n


TITAN_CYCLE = [
    (1063, 24, 20, 48), (1127, 25, 21, 42), (1195, 24, 16, 48), (1258, 24, 18, 48),
    (1321, 25, 22, 42), (1392, 24, 16, 48), (1453, 24, 26, 48), (1585, 24, 24, 48),
    (1648, 25, 26, 47), (1780, 25, 24, 47),
]
TITAN_OTHER = {
    "jump": (1063, 203, 18, 48),
    "fall": (1258, 204, 18, 47),
    "crouch": (1959, 41, 40, 17),
    "climb0": (1845, 8, 16, 64),
    "climb1": (1910, 9, 16, 63),
    "dead0": (1195, 203, 16, 64),
    "dead1": (1454, 203, 17, 64),
}

print("--- red column cycle (PACK_MAP.titan) ---")
print(f"{'i':>2} {'cell':>20} {'px':>5} {'bbox(x,y,w,h)':>18} {'w':>3} {'right':>5}")
for i, c in enumerate(TITAN_CYCLE):
    m = measure(c)
    if not m:
        print(f"{i:>2} {str(c):>20}  EMPTY")
        continue
    bbox, n = m
    print(f"{i:>2} {str(c):>20} {n:>5} {str(bbox):>18} {bbox[2]:>3} {bbox[0]+bbox[2]-1:>5}")

print("\n--- red column special poses ---")
for k, c in TITAN_OTHER.items():
    m = measure(c)
    if not m:
        print(f"{k:>8} {str(c):>20}  EMPTY")
        continue
    bbox, n = m
    print(f"{k:>8} {str(c):>20} {n:>5} {str(bbox):>18} {bbox[2]:>3} {bbox[0]+bbox[2]-1:>5}")

# is there anything between the last titan cycle cell and the climb cells?
print("\n--- probe gaps on the row band y=24..72 ---")
for x in (1517, 1585, 1712, 1780, 1845):
    m = measure((x, 24, 26, 48))
    print(f"x={x}", m if m else "EMPTY")
