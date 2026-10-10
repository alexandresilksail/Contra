"""Decide whether the Stage-1 map image is a tile ATLAS (same 16x16 block
repeats many times) or a continuous level STRIP (blocks mostly unique).

Also reports the real content bounding box (skipping the black sky margin and
any white margin).
"""
import pathlib
from collections import Counter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
im = Image.open(ROOT / "public" / "sprites" / "stage1bg.png").convert("RGB")
W, H = im.size
px = im.load()
S = 16

hashes = Counter()
for ty in range(0, H - S + 1, S):
    for tx in range(0, W - S + 1, S):
        key = []
        for y in range(ty, ty + S, 2):
            for x in range(tx, tx + S, 2):
                key.append(px[x, y])
        hashes[tuple(key)] += 1

total = sum(hashes.values())
distinct = len(hashes)
top = hashes.most_common(5)
dupes = sum(n for _, n in hashes.items() if n > 1)
print(f"{S}px aligned blocks: total={total} distinct={distinct} duplicated={dupes}")
print("most repeated blocks:", top)

# content bbox ignoring pure black (sky) and pure white (margin)
minx, miny, maxx, maxy = W, H, -1, -1
for y in range(H):
    for x in range(0, W, 2):
        c = px[x, y]
        if c == (0, 0, 0) or c == (255, 255, 255):
            continue
        if x < minx: minx = x
        if x > maxx: maxx = x
        if y < miny: miny = y
        if y > maxy: maxy = y
print(f"content bbox (excluding pure black + pure white): x {minx}..{maxx}  y {miny}..{maxy}")

# how much of the bottom is pure white?
for y in range(H - 30, H):
    w = sum(1 for x in range(0, W, 4) if px[x, y] == (255, 255, 255))
    tot = len(range(0, W, 4))
    print(f"  y{y}: white {w}/{tot}")
