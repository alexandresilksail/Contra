"""Render each pickup capsule cell as ASCII so we can read the letter on it.
Each cell is 24x32 (PICKUP_CELLS in pack.ts). We downsample to ~24x16 and
mark non-transparent (sprite) pixels with '#' to reveal the glyph shape.
"""
from PIL import Image
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites"
PATH = str(SHEET / "pickups.png")
img = Image.open(PATH).convert("RGBA")
W,H = img.size
print("pickups size", W, H, file=sys.stderr)
px = img.load()
cells = [(0,0),(25,0),(50,0),(75,0),(100,0)]
CW,CH = 24,32
for ci,(cx,cy) in enumerate(cells):
    print(f"\n--- CELL {ci} at ({cx},{cy}) ---")
    # downsample to grid 24 wide x 16 tall
    gw, gh = 24, 16
    for gy in range(gh):
        line=""
        for gx in range(gw):
            # sample block
            x0 = cx + int(gx*CW/gw); x1 = cx + int((gx+1)*CW/gw)
            y0 = cy + int(gy*CH/gh); y1 = cy + int((gy+1)*CH/gh)
            cnt=0; tot=0; bright=0
            for yy in range(y0,max(y0+1,y1)):
                for xx in range(x0,max(x0+1,x1)):
                    if xx>=W or yy>=H: continue
                    r,g,b,a = px[xx,yy]
                    tot+=1
                    if a>40:
                        cnt+=1
                        # brightness of non-bg
                        if r+g+b>200: bright+=1
            frac = cnt/max(1,tot)
            if frac>0.35:
                line += "#" if bright>0 else "+"
            else:
                line += " "
        print(line)
