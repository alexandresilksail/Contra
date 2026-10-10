"""Colour-classified ASCII render of the Stage-1 map image (read-only).

Legend: '.' black/sky   'g' green foliage   'o' olive/dark green   'k' khaki
        'b' blue (water)  'W' white         'r' grey/rock          '?' other
"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
im = Image.open(ROOT / "public" / "sprites" / "stage1bg.png").convert("RGB")
W, H = im.size
px = im.load()


def cls(c):
    r, g, b = c
    if r < 24 and g < 24 and b < 24:
        return '.'
    if r > 230 and g > 230 and b > 230:
        return 'W'
    if b > 120 and b > r + 60:
        return 'b'
    if r > 120 and g > 120 and 40 <= r - g <= 60 and b < 60:
        return 'k'
    if g > 150 and r < 120:
        return 'g'
    if 40 <= g <= 160 and r < 120 and b < 60:
        return 'o'
    if abs(r - g) < 30 and abs(g - b) < 30 and r > 90:
        return 'r'
    return '?'


CW, CH = 32, 6
print(f"image {W}x{H}   cell={CW}x{CH}   ({W//CW} cols x {H//CH} rows)")
print("    " + "".join(str((c // 10) % 10) if c % 10 == 0 else " " for c in range(W // CW)))
for r in range(H // CH):
    y = r * CH + CH // 2
    row = "".join(cls(px[min(W - 1, c * CW + CW // 2), y]) for c in range(W // CW))
    print(f"y{y:>3} {row}")
