import pathlib
"""Connected-component frame extraction for a keyed sprite-sheet quadrant."""
import sys, json
from collections import deque
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites"

IMG = "str(SHEET / "players.png")"
BGS = {(0,47,87),(28,102,145),(157,28,72),(82,14,0)}
TOL = 40
im = Image.open(IMG).convert("RGBA")
W,H = im.size
px = im.load()

def isbg(x,y):
    r,g,b,a = px[x,y]
    if a < 40: return True
    for br,bgc,bc in BGS:
        if abs(r-br)+abs(g-bgc)+abs(b-bc) < TOL: return True
    return False

def region(x0,y0,x1,y1,label):
    """BFS components of non-bg pixels inside region; merge nearby boxes."""
    boxes=[]
    seen=set()
    step=1
    for y in range(y0,y1,2):
        for x in range(x0,x1,2):
            if (x,y) in seen or isbg(x,y): continue
            # BFS
            q=deque([(x,y)]); seen.add((x,y))
            minx=maxx=x; miny=maxy=y; n=0
            while q:
                cx,cy=q.popleft(); n+=1
                if cx<minx:minx=cx
                if cx>maxx:maxx=cx
                if cy<miny:miny=cy
                if cy>maxy:maxy=cy
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                    nx,ny=cx+dx,cy+dy
                    if x0<=nx<x1 and y0<=ny<y1 and (nx,ny) not in seen and not isbg(nx,ny):
                        seen.add((nx,ny)); q.append((nx,ny))
            if n>=24:  # ignore specks
                boxes.append([minx,miny,maxx-minx+1,maxy-miny+1,n])
    # merge overlapping/adjacent boxes (within 6px)
    merged=True
    while merged:
        merged=False
        out=[]
        while boxes:
            b=boxes.pop()
            for i,o in enumerate(out):
                if not (b[0]+b[2]+6<o[0] or o[0]+o[2]+6<b[0] or b[1]+b[3]+6<o[1] or o[1]+o[3]+6<b[1]):
                    nx0=min(b[0],o[0]); ny0=min(b[1],o[1])
                    nx1=max(b[0]+b[2],o[0]+o[2]); ny1=max(b[1]+b[3],o[1]+o[3])
                    out[i]=[nx0,ny0,nx1-nx0,ny1-ny0,b[4]+o[4]]
                    merged=True
                    break
            else:
                out.append(b)
        boxes=out
    boxes.sort(key=lambda b:(b[1]//40,b[0]))
    print(f"--- {label}: {len(boxes)} sprites ---")
    for b in boxes:
        print(f"x={b[0]:5d} y={b[1]:4d} w={b[2]:3d} h={b[3]:3d} px={b[4]}")
    return boxes

quad = sys.argv[1] if len(sys.argv)>1 else "enemy"
if quad=="enemy": region(1041,0,2081,537,"ENEMY quadrant")
elif quad=="bill": region(0,0,1040,537,"BILL quadrant")
elif quad=="lance": region(0,538,1040,1075,"LANCE quadrant")
