"""Asset manifest scanner.

Reads every file in public/sprites/ and reports, without guessing:

  * file format / size / colour mode / whether it really has transparency
  * what the border / background colour is (the colour key used by pack.ts)
  * connected components of "content" pixels -> candidate sprite frames
  * 16x16 tile-grid statistics (unique vs repeated tiles) for map sheets

No image is modified. Output is plain text so it can be pasted into
docs/asset-manifest.md.

Run:  python tools/asset_scan.py
"""
import pathlib
from collections import Counter, deque
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPR = ROOT / "public" / "sprites"


def load(p):
    im = Image.open(p)
    info = {"name": p.name, "size": im.size, "mode": im.mode}
    return im.convert("RGBA"), info


def alpha_report(im):
    a = im.getchannel("A")
    ex = a.getextrema()
    hist = a.histogram()
    opaque = sum(hist[250:])
    clear = sum(hist[:5])
    total = im.size[0] * im.size[1]
    return {
        "alpha_min": ex[0], "alpha_max": ex[1],
        "frac_opaque": opaque / total, "frac_clear": clear / total,
    }


def dominant_border(im):
    """Most common colour among the 1px border pixels."""
    W, H = im.size
    px = im.convert("RGB").load()
    c = Counter()
    for x in range(W):
        c[px[x, 0]] += 1
        c[px[x, H - 1]] += 1
    for y in range(H):
        c[px[0, y]] += 1
        c[px[W - 1, y]] += 1
    return c.most_common(3)


def components(im, bg):
    """4-connected components of pixels that differ from bg by > tol."""
    W, H = im.size
    px = im.load()

    def is_bg(c):
        r, g, b, a = c
        if a < 8:
            return True
        return (abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])) <= 24

    seen = bytearray(W * H)
    comps = []
    for y in range(H):
        row = y * W
        for x in range(W):
            i = row + x
            if seen[i] or is_bg(px[x, y]):
                continue
            q = deque([(x, y)])
            seen[i] = 1
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while q:
                cx, cy = q.popleft()
                n += 1
                if cx < x0: x0 = cx
                if cx > x1: x1 = cx
                if cy < y0: y0 = cy
                if cy > y1: y1 = cy
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not seen[j] and not is_bg(px[nx, ny]):
                            seen[j] = 1
                            q.append((nx, ny))
            comps.append({"bbox": (x0, y0, x1 + 1, y1 + 1), "px": n})
    comps.sort(key=lambda c: (c["bbox"][1], c["bbox"][0]))
    return comps


def tile_stats(im, s=16):
    W, H = im.size
    px = im.convert("RGB").load()
    c = Counter()
    for ty in range(0, H - s + 1, s):
        for tx in range(0, W - s + 1, s):
            key = []
            for y in range(ty, ty + s, 2):
                for x in range(tx, tx + s, 2):
                    key.append(px[x, y])
            c[tuple(key)] += 1
    tot = sum(c.values())
    return {"tiles": tot, "unique": len(c), "repeated": tot - len(c),
            "top": c.most_common(4)}


def main():
    for p in sorted(SPR.glob("*.png")):
        im, info = load(p)
        W, H = im.size
        print("=" * 78)
        print(f"{info['name']}  {W}x{H}  mode={info['mode']}")
        a = alpha_report(im)
        print(f"  alpha {a['alpha_min']}..{a['alpha_max']}  opaque={a['frac_opaque']:.1%}"
              f"  clear={a['frac_clear']:.1%}")
        print(f"  border colours: {dominant_border(im)}")
        bg = dominant_border(im)[0][0]
        comps = components(im, bg)
        comps = [c for c in comps if c["px"] >= 12]
        print(f"  content components (>=12px): {len(comps)}")
        for i, c in enumerate(comps[:60]):
            x0, y0, x1, y1 = c["bbox"]
            print(f"    #{i:02d} bbox=({x0},{y0})-({x1},{y1}) "
                  f"{x1-x0}x{y1-y0} px={c['px']}")
        if len(comps) > 60:
            print(f"    ... {len(comps)-60} more")
        if W % 16 == 0 and H % 16 == 0:
            t = tile_stats(im)
            print(f"  16px grid: {t['tiles']} tiles, {t['unique']} unique, "
                  f"{t['repeated']} repeated")


if __name__ == "__main__":
    main()
