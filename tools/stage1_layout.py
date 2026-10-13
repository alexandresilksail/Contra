"""Derive the Stage-1 level layout from the uploaded map image.

READ-ONLY: never writes pixels. Emits a machine readable description of the
image so the level data in src/level/layouts.ts can be authored to match it.

Reports:
  1. exact content bounding box (ignoring pure-black sky and pure-white margin)
  2. per-row dominant colour  -> where sky / treeline / ground / water sit
  3. per-column ground surface: for every 16px column, the y of the first row
     that looks like solid ground (a run of >= 8 non sky/non foliage rows)
  4. a coarse ASCII map so the layout can be eyeballed as text
"""
import pathlib
from collections import Counter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IM = ROOT / "public" / "sprites" / "stage1bg.png"

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)


def near(c, t, tol=12):
    return abs(c[0] - t[0]) <= tol and abs(c[1] - t[1]) <= tol and abs(c[2] - t[2]) <= tol


def main():
    im = Image.open(IM).convert("RGB")
    W, H = im.size
    px = im.load()
    print(f"image {W}x{H}")

    # --- 1. content bbox -------------------------------------------------
    rows_black = [all(near(px[x, y], BLACK) for x in range(W)) for y in range(H)]
    rows_white = [all(near(px[x, y], WHITE) for x in range(W)) for y in range(H)]
    top = next((y for y in range(H) if not rows_black[y] and not rows_white[y]), 0)
    bot = next((y for y in range(H - 1, -1, -1)
                if not rows_black[y] and not rows_white[y]), H - 1)
    print(f"black-only rows : {[y for y in range(H) if rows_black[y]][:12]} ...")
    print(f"white-only rows : {[y for y in range(H) if rows_white[y]][:4]} "
          f"... {[y for y in range(H) if rows_white[y]][-4:]}")
    print(f"content rows    : {top}..{bot}  (height {bot-top+1})")

    # --- 2. per-row dominant colour --------------------------------------
    print("\nrow  dominant colour            | second")
    for y in range(H):
        c = Counter(px[x, y] for x in range(0, W, 3))
        m = c.most_common(2)
        if y % 4 == 0 or y in (top, bot):
            s1 = f"{str(m[1][0]):22s} {m[1][1]:5d}" if len(m) > 1 else "-"
            print(f"{y:4d} {str(m[0][0]):22s} {m[0][1]:5d} | {s1}")

    # --- 3. per-column ground surface ------------------------------------
    # "ground" = column has a long vertical run of brown/green-grey rock.
    # We detect it generically: first y from the bottom where the colour stays
    # stable for >= 10 rows AND is not black sky / white margin.
    print("\ncolumn ground surface (16px columns, y within content):")
    surf = []
    for cx in range(0, W, 16):
        col = [px[cx + 8 if cx + 8 < W else cx, y] for y in range(H)]
        found = None
        for y in range(top, bot):
            if near(col[y], BLACK) or near(col[y], WHITE):
                continue
            run = 1
            while y + run <= bot and not near(col[y + run], WHITE):
                run += 1
            if run >= 24:
                found = y
                break
        surf.append(found)

    # compress into runs
    runs = []
    for i, v in enumerate(surf):
        if runs and runs[-1][0] == v:
            runs[-1][2] = i
        else:
            runs.append([v, i, i])
    print(f"columns: {len(surf)}")
    for v, a, b in runs:
        print(f"  col {a*16:5d}..{b*16+15:5d} ({b-a+1:3d} cols)  groundTop="
              f"{'none' if v is None else v}")
    return surf


if __name__ == "__main__":
    main()
