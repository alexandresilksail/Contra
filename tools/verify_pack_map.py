import pathlib
"""Verify pack.ts PACK_MAP bill cells by cropping and composing a contact sheet."""
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites"
SRC="str(SHEET / "players.png")"
im=Image.open(SRC).convert("RGBA")
# cells from pack.ts PACK_MAP.razor
cells=[("cycle0",25,24,19,48),("cycle1",90,25,20,46),("cycle2",154,24,19,48),("cycle5",349,24,20,48),
       ("jump",25,203,18,48),("crouch",919,42,40,16),("climb0",804,8,18,64),("dead0",413,203,19,64)]
out=Image.new("RGBA",(4*130+20,2*270+20),(30,30,34,255))
i=0
for name,cx,cy,cw,ch in cells:
    c=im.crop((cx,cy,cx+cw,cy+ch)).resize((cw*4,ch*4),Image.NEAREST)
    col=i%4; row=i//4
    out.paste(c,(10+col*130,10+row*270),c)
    i+=1
out.save("pack_map_preview.png")
print("saved")
