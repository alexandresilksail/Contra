import pathlib
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites"
SRC="str(SHEET / "players.png")"
im=Image.open(SRC).convert("RGBA")
# enemy row1 frame0 + row2 frame0, 5x zoom
crops=[("enemy_r1_f0",1063,24,20,34),("enemy_r2_f0",1063,89,20,34),("enemy_r1_f3",1258,24,17,34)]
out=Image.new("RGBA",(300,200),(40,40,40,255))
x=5
for name,cx,cy,cw,ch in crops:
    c=im.crop((cx,cy,cx+cw,cy+ch)).resize((cw*5,ch*5),Image.NEAREST)
    out.paste(c,(x,10),c)
    x+=c.width+12
out.save("enemy_frames_preview.png")
print("saved")
