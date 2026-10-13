"""Extract the Stage-1 level layout from the uploaded map image.

READ-ONLY: never modifies any file in public/sprites/.

The map image (public/sprites/stage1bg.png, 3456x245) IS the complete Stage-1
layout, as confirmed with the user:

  rows   0..7    black margin
  rows   8..223  the level art itself (216 rows)   <- the whole level
  rows 224..244  white margin carrying the ripper watermark (never drawn)

World mapping (shared with src/config/constants.ts BG1_*):
  world(y_img) = y_img + 253        -> the walkable grass line (img y~99) lands
                                      exactly on GROUND_ROW*TILE = 352
  tileRow      = round(world / 16)

Outputs:
  - src/level/stage1ImageData.ts   generated collision data module
  - tools/stage1_layout.json       the same data as JSON (for review)
  - stdout                          run-length summary + ASCII map

Structures detected per 16px column:
  ground   rock/grass mass            -> SOLID from its surface row down
  bridge   metal deck over water      -> SOLID deck at row 22
  water    water body, no deck        -> wade, floor capped so you can hop out
  pit      bottomless black chasm     -> EMPTY (falling in is lethal, as in the
                                         original: the player dies past pixelH)
  wall     dark-blue fortress mass    -> SOLID (the boss arena back wall)
  sensor   white weapon container     -> destructible HIDDEN tiles
"""
import json
import pathlib
from collections import Counter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IM = ROOT / "public" / "sprites" / "stage1bg.png"
OUT_TS = ROOT / "src" / "level" / "stage1ImageData.ts"
OUT_JSON = ROOT / "tools" / "stage1_layout.json"

W_IMG = 3456
Y0, Y1 = 8, 224          # content band; the watermark below Y1 is never used
COLS = W_IMG // 16       # 216 columns == the image width
TILE = 16
IMG_TO_WORLD = 253       # world = y_img + 253  (measured: grass line -> row 22)
GROUND_ROW = 22
LEVEL_ROWS = 30
WADE_CAP = GROUND_ROW + 3   # deepest wade floor (always jump-out-able)

# The boss gate sits BEFORE the ravine (pits at cols 144-169). The arena is
# the single screen [BOSS_START, BOSS_START + ARENA_COLS) (40 cols == one
# VIEW_W/TILE screen); the camera locks there, so the ravine (144+) and the
# fortress wall (209-215) stay exactly as extracted from the art and are never
# traversed.
# The arena ground inside that window IS levelled, to the window's own modal
# surface row: the art there is rising, jagged jungle ground (rows 21-24) and a
# boss fight needs one flat, pit-free floor. This is the ONLY deliberate
# deviation from the image, and it is confined to the arena.
BOSS_START = 100
ARENA_COLS = 40          # one screen: VIEW_W(640) / TILE(16)


def close(c, t, tol=14):
    return abs(c[0] - t[0]) <= tol and abs(c[1] - t[1]) <= tol and abs(c[2] - t[2]) <= tol


BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
WATER_BRIGHT = [(0, 86, 255), (0, 161, 255)]
WATER_DARK = (0, 0, 179)
ROCK_BRIGHT = [(126, 126, 0), (208, 190, 0)]
ROCK_DARK = (68, 80, 0)
GREEN = [(0, 144, 0), (144, 213, 0)]
METAL = (179, 179, 179)


def classify(c):
    if close(c, BLACK, 10):
        return '.'
    if close(c, WHITE, 10):
        return 'w'
    if any(close(c, w, 30) for w in WATER_BRIGHT):
        return '~'
    if close(c, WATER_DARK, 25):
        return 'b'                 # dark blue: fortress wall body
    if any(close(c, r, 12) for r in ROCK_BRIGHT):
        return 'R'
    if close(c, ROCK_DARK, 12):
        return 'r'
    if any(close(c, g, 30) for g in GREEN):
        return 'g'
    if close(c, METAL, 40):
        return 'M'
    return '?'


def tile_row(y_img):
    return round((y_img + IMG_TO_WORLD) / TILE)


def row_to_img_y(row):
    """img y that maps to `row` (kept off the .5 tile boundary)."""
    return row * TILE - IMG_TO_WORLD + 2


def main():
    im = Image.open(IM).convert("RGB")
    px = im.load()
    grid = [[classify(px[x, y]) for x in range(W_IMG)] for y in range(Y1)]
    SKY = set('.w')

    # ---------------- per-column features ----------------
    # 4 samples across each 16px column; a column keeps the median vote so a
    # single grass tuft can never move the whole column.
    # "solid for a walkable surface" = rock / grass / metal / fortress blue.
    # Water and white are NOT solid here: the water surface would otherwise be
    # mistaken for ground, and the white bridge structure for a rock mass.
    MASS = set('RrgMb?')

    def surf_y(x):
        """Topmost img row whose 20-row window below is >=85% solid mass."""
        for y in range(Y0, Y1 - 20):
            if sum(1 for k in range(y, y + 20) if grid[k][x] in MASS) >= 17:
                return y
        return None

    raw = []          # (surf_y, n_water, n_metal, n_blue)
    for cx in range(COLS):
        s, w, m, b = [], 0, 0, 0
        for dx in (2, 6, 10, 14):
            x = cx * TILE + dx
            v = surf_y(x)
            if v is not None:
                s.append(v)
            col = [grid[y][x] for y in range(Y0, Y1)]
            w += sum(1 for ch in col if ch == '~')
            m += sum(1 for ch in col if ch == 'M')
            b += sum(1 for ch in col if ch == 'b')
        s.sort()
        raw.append((s[len(s) // 2] if s else None, w, m, b))

    # fortress wall: the contiguous dark-blue run anchored at the right edge
    wall_cols = []
    for cx in range(COLS - 1, -1, -1):
        if raw[cx][3] >= 20:
            wall_cols.append(cx)
        else:
            break
    wall_cols.reverse()
    wall_top = None
    if wall_cols:
        tops = []
        for cx in wall_cols:
            x = cx * TILE + 8
            tops.append(next(y for y in range(Y0, Y1) if grid[y][x] == 'b'))
        tops.sort()
        wall_top = tops[len(tops) // 2]

    kind = [''] * COLS
    surf = [None] * COLS
    for cx, (s, w, m, b) in enumerate(raw):
        if cx in wall_cols:
            kind[cx] = 'wall'
            surf[cx] = wall_top
        elif s is not None:
            # a rock/grass mass: solid from its surface down. Water or metal
            # *inside* the mass is art (cliff base, embedded containers), never
            # a separate structure.
            kind[cx] = 'ground'
            surf[cx] = s
        elif m >= 6 and w >= 20:
            # no rock, but a metal deck standing over water -> bridge
            kind[cx] = 'bridge'
            surf[cx] = GROUND_ROW * TILE - IMG_TO_WORLD      # deck == row 22
        elif w >= 10:
            kind[cx] = 'water'
            surf[cx] = None
        else:
            kind[cx] = 'pit'
            surf[cx] = None

    # ---------------- de-jitter ----------------
    # The rock texture alternates bright/dark rows, so the raw surface wobbles
    # by ~8px (one tile row) column by column. Averaging the PIXEL surface over
    # a +/-2 column window removes that without touching the real steps, which
    # are always 32px (two rows) or more.
    def smooth_px():
        out = list(surf)
        for i in range(COLS):
            if surf[i] is None or kind[i] not in ('ground', 'bridge'):
                continue
            win = [surf[j] for j in range(max(0, i - 2), min(COLS, i + 3))
                   if surf[j] is not None and kind[j] == kind[i]]
            if len(win) >= 3:
                out[i] = sum(win) / len(win)
        surf[:] = out

    for _ in range(2):
        smooth_px()

    # A residual single-column step that disagrees with a clear majority of its
    # neighbours is still tuft noise; a real step is several columns wide.
    def snap():
        for i in range(COLS):
            if surf[i] is None or kind[i] not in ('ground', 'bridge'):
                continue
            rows = [tile_row(surf[j]) for j in range(max(0, i - 3), min(COLS, i + 4))
                    if surf[j] is not None and kind[j] == kind[i]]
            if len(rows) < 5:
                continue
            mode, n = Counter(rows).most_common(1)[0]
            if n >= 3 and abs(tile_row(surf[i]) - mode) == 1:
                surf[i] = row_to_img_y(mode)

    for _ in range(3):
        snap()

    # ---------------- weapon containers -> sensor walls ----------------
    boxes = []
    seen = [[False] * W_IMG for _ in range(Y1)]
    for y in range(Y0 + 40, Y1 - 8):          # skip the high white mountain peaks
        for x in range(0, W_IMG - 8):
            if seen[y][x] or grid[y][x] not in 'Mw':
                continue
            stack = [(x, y)]
            seen[y][x] = True
            minx = maxx = x
            miny = maxy = y
            n = 0
            ok = True
            while stack:
                cxx, cyy = stack.pop()
                n += 1
                minx = min(minx, cxx); maxx = max(maxx, cxx)
                miny = min(miny, cyy); maxy = max(maxy, cyy)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cxx + dx, cyy + dy
                    if 0 <= nx < W_IMG and Y0 <= ny < Y1 and not seen[ny][nx] \
                            and grid[ny][nx] in 'Mw':
                        seen[ny][nx] = True
                        stack.append((nx, ny))
                if n > 6000:
                    ok = False
                    break
            bw, bh = maxx - minx + 1, maxy - miny + 1
            if ok and miny >= Y0 + 40 and 20 <= bw <= 40 \
                    and 24 <= bh <= 40 and n > 200:
                boxes.append((minx, miny, bw, bh))

    # The panels sit INSIDE the rock mass in the art, a few rows below the
    # walking surface. Buried like that they are unreachable (a bullet stops on
    # the solid tile above them), so each panel is raised to the single row
    # directly above the surface: that is the player's waist height, so it can
    # be shot horizontally, and being one tile it is also jumpable. The visual
    # stays a white panel on the terrain; only its interactive row moves.
    sensors = []
    for (bx, by, bw, bh) in boxes:
        col = min(COLS - 1, round((bx + bw / 2) / TILE))
        if kind[col] != 'ground' or surf[col] is None:
            continue
        grow = tile_row(surf[col])
        r0 = grow - 1
        r1 = grow - 1
        if r0 < 1:
            continue
        # A panel right in front of a chasm makes a runner jump at the wrong
        # moment and drop in, so panels are not placed within 2 columns of a
        # pit. (Measured: with the col-143 panel the traversal bot fell into
        # the 144-145 chasm.)
        if any(kind[c] == 'pit' for c in range(col + 1, min(COLS, col + 3))):
            continue
        sensors.append([col, r0, r1])

    # ---------------- boss arena: one flat fighting floor ----------------
    # The boss descends onto the ground and the camera locks to a single screen,
    # so the 40-column arena window needs ONE continuous, pit-free floor. The
    # art there is rising, jagged jungle ground, so the window is levelled to
    # its own modal surface row (21). Confined to the arena: the ravine (144+)
    # and the fortress wall (209+) keep their extracted values.
    win = [c for c in range(BOSS_START, min(COLS, BOSS_START + ARENA_COLS))]
    modal_row = Counter(
        tile_row(surf[c]) for c in win if surf[c] is not None
    ).most_common(1)[0][0]
    for c in win:
        kind[c] = 'ground'
        surf[c] = row_to_img_y(modal_row)

    # ---------------- boss gate placement ----------------
    # The boss gate (DOOR) is emitted by stage1ImageMap at def.bossStart.
    # Weapon containers (and their source boxes) are kept only up to the gate
    # so none sit inside the boss arena.
    boxes = [b for b in boxes if round((b[0] + b[2] / 2) / TILE) < BOSS_START]
    sensors = [sn for sn in sensors if sn[0] < BOSS_START]

    # ---------------- run-length encoding ----------------
    def rle(pred):
        out = []
        for cx in range(COLS):
            v = pred(cx)
            if v is None:
                continue
            if out and out[-1][1] == cx - 1 and out[-1][2] == v:
                out[-1][1] = cx
            else:
                out.append([cx, cx, v])
        return out

    ground_runs = rle(lambda cx: tile_row(surf[cx]) if kind[cx] == 'ground' else None)
    bridge_runs = rle(lambda cx: tile_row(surf[cx]) if kind[cx] == 'bridge' else None)
    wall_runs = rle(lambda cx: tile_row(surf[cx]) if kind[cx] == 'wall' else None)
    water_runs = rle(lambda cx: WADE_CAP if kind[cx] == 'water' else None)
    pit_runs = []
    for cx in range(COLS):
        if kind[cx] == 'pit':
            if pit_runs and pit_runs[-1][1] == cx - 1:
                pit_runs[-1][1] = cx
            else:
                pit_runs.append([cx, cx])

    print("ground runs  [colFrom, colTo, surfaceRow]:")
    for r in ground_runs:
        print(f"  {r}")
    print("bridge runs:", bridge_runs)
    print("wall runs  :", wall_runs)
    print("water runs :", water_runs)
    print("pit runs   :", pit_runs)
    print("sensors    :", sensors)
    print("boxes      :", boxes)

    # ---------------- ASCII overview ----------------
    cells = [['.'] * COLS for _ in range(LEVEL_ROWS)]
    for a, b, row in ground_runs:
        for cx in range(a, b + 1):
            for r in range(row, LEVEL_ROWS):
                cells[r][cx] = 'G'
    for a, b, row in bridge_runs:
        for cx in range(a, b + 1):
            for r in range(row, LEVEL_ROWS):
                cells[r][cx] = 'M'
    for a, b, row in wall_runs:
        for cx in range(a, b + 1):
            for r in range(row, LEVEL_ROWS):
                cells[r][cx] = 'W'
    for a, b, row in ground_runs:
        for cx in range(a, b + 1):
            for r in range(row, LEVEL_ROWS):
                if cells[r][cx] != 'W':
                    cells[r][cx] = 'G'
    for a, b in pit_runs:
        for cx in range(a, b + 1):
            for r in range(LEVEL_ROWS):
                cells[r][cx] = ' '
    for a, b, _floor in water_runs:
        for cx in range(a, b + 1):
            for r in range(WADE_CAP, LEVEL_ROWS):
                if cells[r][cx] == '.':
                    cells[r][cx] = '~'
    for col, r0, r1 in sensors:
        for r in range(r0, r1 + 1):
            if 0 <= r < LEVEL_ROWS:
                cells[r][col] = 'H'
    print("\nASCII map (row 0 = world y 0, 1 char = 1 tile = 16px):")
    print("     " + "".join(str((i // 10) % 10) for i in range(COLS)))
    for r in range(14, LEVEL_ROWS):
        print(f"  {r:2d} " + "".join(cells[r]))

    # ---------------- emit TS ----------------
    def arr(name, rows, comment):
        lines = [f"// {comment}", f"export const {name}: number[][] = ["]
        for r in rows:
            lines.append(f"  {json.dumps(r)},")
        lines.append("];")
        return "\n".join(lines)

    ts = f"""/**
 * Stage-1 collision data, EXTRACTED from the uploaded map image
 * (public/sprites/stage1bg.png) by tools/stage1_extract.py.
 *
 * DO NOT EDIT BY HAND - re-run the tool instead.
 *
 * The image is the visual authority and is drawn 1:1 by the renderer (see
 * `BgLayer.lock` in src/gfx/bgLayer.ts); this module is the independent
 * interactive-collision authority on the 16px tile grid. Mapping:
 *   world(y_img) = y_img + {IMG_TO_WORLD},  tileRow = round(world / 16)
 * so the walkable grass line of the art (img y~99) sits exactly on
 * GROUND_ROW*TILE = 352 and the two can never drift apart.
 *
 * Structures per 16px column:
 *   S1_GROUND_RUNS  [from, to, surfaceRow] rock/grass mass -> SOLID down
 *   S1_BRIDGE_RUNS  [from, to, deckRow]     metal bridge deck -> SOLID
 *   S1_WALL_RUNS    [from, to, topRow]      fortress wall -> SOLID mass
 *   S1_WATER_RUNS   [from, to, floorRow]    water body -> wade, capped floor
 *   S1_PIT_RUNS     [from, to]              bottomless chasm -> lethal fall
 *   S1_SENSORS      [col, rowTop, rowBottom] weapon containers -> HIDDEN
 */
import {{ GROUND_ROW, LEVEL_ROWS }} from '../config/constants';
import {{ T }} from './tiles';

export const S1_IMG_TO_WORLD = {IMG_TO_WORLD};

{arr('S1_GROUND_RUNS', ground_runs, '[colFrom, colTo, surfaceRow]')}
{arr('S1_BRIDGE_RUNS', bridge_runs, '[colFrom, colTo, deckRow]')}
{arr('S1_WALL_RUNS', wall_runs, '[colFrom, colTo, topRow]')}
{arr('S1_WATER_RUNS', water_runs, '[colFrom, colTo, floorRow]')}
{arr('S1_PIT_RUNS', pit_runs, '[colFrom, colTo]')}
{arr('S1_SENSORS', sensors, '[col, rowTop, rowBottom] destructible weapon containers')}

/** Deepest wade floor, so a player who falls in can always jump back out. */
export const S1_WADE_CAP = {WADE_CAP};

/** Walkable surface (top solid) row of a column, from the extracted ground runs. */
function surfaceRow(col: number): number {{
  for (const [a, b, row] of S1_GROUND_RUNS) if (col >= a && col <= b) return row;
  return GROUND_ROW;
}}

/** Build the Stage-1 tile map from the layout extracted out of the map image. */
export function stage1ImageMap(tiles: number, bossStart: number): Uint8Array {{
  const data = new Uint8Array(tiles * LEVEL_ROWS);
  const set = (c: number, r: number, v: number) => {{
    if (c >= 0 && c < tiles && r >= 0 && r < LEVEL_ROWS) data[r * tiles + c] = v;
  }};

  // 1) water bodies (wade floor, capped) - drawn first so ground overwrites
  for (const [a, b] of S1_WATER_RUNS) {{
    for (let c = a; c <= b; c++) {{
      for (let r = 0; r < S1_WADE_CAP; r++) set(c, r, T.EMPTY);
      for (let r = S1_WADE_CAP; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
      for (let r = Math.max(0, GROUND_ROW - 2); r < S1_WADE_CAP; r++) set(c, r, T.WATER);
    }}
  }}

  // 2) bottomless chasms stay EMPTY: the player dies past the level floor,
  //    exactly like the original game.
  for (const [a, b] of S1_PIT_RUNS) {{
    for (let c = a; c <= b; c++) {{
      for (let r = 0; r < LEVEL_ROWS; r++) set(c, r, T.EMPTY);
    }}
  }}

  // 3) ground masses + bridge decks
  for (const [a, b, row] of S1_GROUND_RUNS) {{
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }}
  for (const [a, b, row] of S1_BRIDGE_RUNS) {{
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }}

  // 4) fortress wall (boss arena back wall)
  for (const [a, b, row] of S1_WALL_RUNS) {{
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }}

  // 5) weapon-container sensor walls (destructible, may drop a pickup)
  for (const [c, r0, r1] of S1_SENSORS) {{
    for (let r = r0; r <= r1; r++) set(c, r, T.HIDDEN);
  }}

  // 6) boss gate at the arena entrance. The door stands ON the arena surface
  //    (rows surface-6 .. surface-1) rather than at a fixed row: openBossDoor()
  //    blanks the door tiles, so a door that also covered the floor row would
  //    erase walkable ground and drop that column by one tile.
  const doorRow = surfaceRow(bossStart);
  for (let r = doorRow - 6; r < doorRow; r++) set(bossStart, r, T.DOOR);

  return data;
}}
"""
    OUT_TS.write_text(ts, encoding="utf-8")
    (ROOT / "tools" / "stage1_layout.json").write_text(json.dumps({
        "imgToWorld": IMG_TO_WORLD,
        "ground": ground_runs, "bridges": bridge_runs, "walls": wall_runs,
        "water": water_runs, "pits": pit_runs, "sensors": sensors, "boxes": boxes,
    }, indent=1))
    print(f"\nwrote {OUT_TS.relative_to(ROOT)} and tools/stage1_layout.json")


if __name__ == "__main__":
    main()
