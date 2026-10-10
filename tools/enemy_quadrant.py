import pathlib
"""Re-analyze players.png: locate every sprite frame by detecting the opaque
panel backgrounds, then compute a tight bounding box of the actual sprite
(discarding the keyed-out panel color). Group frames by row-band and classify
the band by its panel color so we can tell enemy (red) from player (blue).
"""
from PIL import Image
import json, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites"

PATH = "str(SHEET / "players.png")"
img = Image.open(PATH).convert("RGB")
W, H = img.size
px = img.load()
print("size", W, H, file=sys.stderr)

KEYS = [
    ("bill_blue",   [(0,47,87),(28,102,145)]),
    ("enemy_red",   [(157,28,72),(82,14,0)]),
    ("force_green", [(0,48,0)]),
    ("black",       [(0,0,0)]),
]
DIST2 = 70*70

def is_bg(r,g,b):
    for _, cols in KEYS:
        for (kr,kg,kb) in cols:
            dr,dg,db = r-kr, g-kg, b-kb
            if dr*dr+dg*dg+db*db < DIST2:
                return True
    return False

# Build mask of sprite pixels (non-bg)
mask = [[False]*W for _ in range(H)]
for y in range(H):
    for x in range(W):
        r,g,b = px[x,y]
        mask[y][x] = not is_bg(r,g,b)

# For each pixel, also record nearest key color class (for panel classification)
def bg_class(r,g,b):
    best=None; bestd=1e18
    for name, cols in KEYS:
        for (kr,kg,kb) in cols:
            dr,dg,db = r-kr, g-kg, b-kb
            d=dr*dr+dg*dg+db*db
            if d<bestd:
                bestd=d; best=name
    return best, bestd

# Find horizontal bands (runs of rows that contain >=1 sprite pixel)
row_has = [any(mask[y]) for y in range(H)]
bands=[]
y=0
while y<H:
    if row_has[y]:
        y0=y
        while y<H and row_has[y]: y+=1
        bands.append((y0,y))  # inclusive y0, exclusive y
    else:
        y+=1

frames=[]
for (y0,y1) in bands:
    # within this band, find blobs separated by bg columns
    # find column runs that contain sprite pixels in this band
    x=0
    while x<W:
        if any(mask[y][x] for y in range(y0,y1)):
            x0=x
            while x<W and any(mask[y][x] for y in range(y0,y1)): x+=1
            # tight bbox within [y0,y1) x [x0,x)
            minx,miny,maxx,maxy=W,H,-1,-1
            cnt=0
            panel_colors={}
            for yy in range(y0,y1):
                for xx in range(x0,x):
                    r,g,b=px[xx,yy]
                    if mask[yy][xx]:
                        cnt+=1
                        if xx<minx:minx=xx
                        if xx>maxx:maxx=xx
                        if yy<miny:miny=yy
                        if yy>maxy:maxy=yy
                    else:
                        # sample panel color (background of this region)
                        cls,d=bg_class(r,g,b)
                        if cls not in panel_colors:
                            panel_colors[cls]=0
                        panel_colors[cls]+=1
            # dominant panel class
            dom=max(panel_colors.items(), key=lambda kv:kv[1])[0] if panel_colors else "?"
            frames.append({
                "band":(y0,y1),
                "cell":[minx,miny,maxx-minx+1,maxy-miny+1],
                "panel":dom,
                "pixels":cnt,
            })
        else:
            x+=1

# Group frames by band, print
out=[]
cur=None
for f in frames:
    if f["band"]!=cur:
        cur=f["band"]
        out.append(("BAND", cur, f["panel"]))
    out.append(("F", f["cell"], f["panel"], f["pixels"]))

for item in out:
    if item[0]=="BAND":
        print(f"\n=== BAND y[{item[1][0]},{item[1][1]}) panel={item[2]} ===")
    else:
        print(f"  cell={item[1]} panel={item[2]} px={item[3]}")

# Save compact JSON for later use
with open("frames.json","w") as fh:
    json.dump(frames, fh)
print("\nTOTAL FRAMES:", len(frames), file=sys.stderr)
