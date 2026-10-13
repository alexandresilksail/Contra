# Asset Manifest — IRON STORM

Every image shipped in `public/sprites/` is an **original uploaded asset**.
Nothing in this list is AI-generated, redrawn, recoloured or replaced; the
renderer only performs the runtime operations that are explicitly allowed
(transparent-margin trimming, sprite-sheet frame extraction, mirroring,
positioning and uniform scaling). All six files are used by the game today.

Scan tool: `tools/asset_scan.py` (read-only, never writes into
`public/sprites/`).

---

## 1. Inventory

| # | File | Format | Size | Transparency | Sprite sheet? | Used by |
|---|------|--------|------|--------------|---------------|---------|
| 1 | `stage1bg.png` | PNG, RGB | 3456 × 245 | none (100 % opaque) | **No — one continuous panorama** | Stage 1 level visual |
| 2 | `players.png` | PNG, palette | 2081 × 1075 | yes (84.1 % opaque, 15.9 % clear) | **Yes** | Player + enemy soldier art |
| 3 | `pickups.png` | PNG, RGB | 124 × 32 | none (100 % opaque) | **Yes** (5 icons) | Weapon pick-up icons |
| 4 | `tiles1.png` | PNG, RGBA | 288 × 64 | none (100 % opaque) | **Yes** (tile atlas) | Stage 1 tile art override |
| 5 | `title.png` | PNG | — | keyed magenta | — | Title logo |
| 6 | `wall1.png` | PNG, palette | 223 × 192 | none (100 % opaque) | **Yes** | Stage 1 boss (Defense Wall) |

Code entry point for all of them: `src/gfx/pack.ts` → `FILES` / `loadPack()`.
Loading is optional by design: when a file is missing the game falls back to
its procedural art instead of failing, but **no uploaded file is ignored when
present**.

---

## 2. Per-asset detail

### 2.1 `stage1bg.png` — the Stage-1 level layout (3456 × 245)

**This is the most important asset: it is the complete Stage-1 level layout,
not a decorative backdrop** (confirmed by the user).

| Band | Rows | Content |
|------|------|---------|
| top margin | 0–7 | pure black, never drawn |
| **level art** | **8–223** | the whole stage: jungle cliffs, river + bridges, ravine, fortress wall |
| watermark | 224–244 | pure white band carrying the ripper's watermark, **never drawn** |

* Rendered **1:1 on both axes, world-locked** (`BgLayer.lock` in
  `src/gfx/bgLayer.ts`), cropped to rows 8–224 (3456 × 216).
* World mapping: `world(y_img) = y_img + 253`. Measured so the art's walkable
  grass line (img y ≈ 99) lands exactly on `GROUND_ROW * TILE = 352`.
* **Verified pixel-exact**: at 5 different camera positions every sampled
  canvas pixel equals the corresponding map-image pixel (100 % match,
  `tools/verify_pixel.mjs`).
* Independent collision data is extracted from the art by
  `tools/stage1_extract.py` → `src/level/stage1ImageData.ts`. See
  `docs/stage1-map-image.md` for the full audit.

### 2.2 `players.png` — character sheet (2081 × 1075)

Two isomorphic halves on the y = 24 band, **12 frames each, 30 px pitch**:

| Column | Character | Frame x positions |
|--------|-----------|-------------------|
| left (x 25…739) | Bill / "razor" (blue) | 25, 90, 154, 220, 285, 349, 415, 480, 544, 610, 675, 739 |
| right (x 1063…1780) | red commando / "titan" | 1063, 1127, 1195, 1258, 1321, 1392, 1453, 1517, 1585, 1648, 1712, 1780 |

* **Frames 0–5** = unarmed ground cycle (content 15–22 px wide).
* **Frames 6–11** = armed ground cycle, rifle extended forward (content
  20–25 px wide; visible as a horizontal bar at chest height).
* Other poses (off-band, verified with the ASCII/pixel probes):
  * jump / fall — y = 203 band, 20 × 48
  * crouch — y ≈ 41–42, 40 × 16
  * climb — y = 8, 16–18 × 64 (2 frames)
  * dead — y = 203, ~19 × 64 (2 frames)
* Slicing: a uniform 26 × 36 window per frame → `trimSprite()` (drops the
  empty margin) → `alignFrames()` (bottom-aligns the whole group so nothing
  floats or jitters) → uniform scale. The right column previously listed only
  10 frames (x = 1517 and x = 1712 were missing); it is 12, mirroring the left.
* **Enemy soldiers reuse the right (red commando) column** — in Contra the
  basic infantry is a palette-swapped player sprite and there is no separate
  enemy sheet, so this is the faithful source (`packEnemyFrames()`).

### 2.3 `pickups.png` — weapon capsules (124 × 32)

Five 24 × 15(+1) icons in a 5 × 2 grid (cells at x = 0, 25, 50, 75, 100;
rows y = 0 and y = 17). Each icon is drawn as the letter/emblem of one of the
5 weapons; the authoritative letter always comes from `weaponDef()` so a
rifle can never display the "M" of another gun.

### 2.4 `tiles1.png` — Stage-1 tile atlas (288 × 64)

| Tile | Cell (x, y, w, h) | Meaning |
|------|-------------------|---------|
| solid top | 0, 0, 16, 16 | grass-mound exposed surface (rounded corners authentic) |
| solid fill ×3 | 14/15/13, 16, 16, 16 | rocky fill variants |
| platform ×2 | 0/1, 0, 16, 6 | thin ledge (top 6 rows of the grass tiles) |
| water ×3 | 3/4/5, 32, 16, 16 | animated water (3 frames) |

Applied as the Stage-1 tile-art override (`packStage1Tiles()`), replacing only
`solid` / `platform` / `water`. Ladder, spike, crate and door have no
equivalent on the sheet and stay procedural.

### 2.5 `title.png` — title logo

Keyed against a magenta backdrop (`[221, 0, 255]`, tight tolerance) and drawn
by the title screen.

### 2.6 `wall1.png` — Defense Wall boss (223 × 192)

Sliced whole and scaled by `WALL_SCALE = 0.55` (`packBossWall()`), replacing
the procedural boss art for Stage 1's "BASE COMMANDER".

---

## 3. Reference map (asset → game object → code)

| Asset | Game object / state | Code |
|-------|---------------------|------|
| `stage1bg.png` | Stage-1 world visual (locked 1:1) | `src/gfx/pack.ts` `packStage1Bg()` → `src/scenes/game.ts` `bg.layers[0]` |
| `stage1bg.png` | Stage-1 collision (extracted) | `tools/stage1_extract.py` → `src/level/stage1ImageData.ts` → `src/level/layouts.ts` `stage1Map()` |
| `players.png` left | Player: idle / run (unarmed 0–5, armed 6–11), jump, fall, crouch, climb, dead | `src/gfx/pack.ts` `PACK_MAP.razor` → `src/gfx/sprites.ts` `buildPlayerArt` |
| `players.png` right | Player 2 / "titan" — same pose set | `PACK_MAP.titan` |
| `players.png` right | Enemy soldier walk cycle (all 12 frames, rifle always) | `packEnemyFrames()` → `src/entities/enemy.ts` |
| `pickups.png` | Weapon pick-up capsule icons (5) | `packPickupIcon()` → `src/entities/pickup.ts` |
| `tiles1.png` | Stage-1 solid / platform / water tile art | `packStage1Tiles()` → `src/scenes/game.ts` `tileArt` |
| `title.png` | Title logo | `src/gfx/pack.ts` title section → title screen |
| `wall1.png` | Stage-1 boss "DEFENSE WALL" | `packBossWall()` → `src/entities/boss.ts` |

---

## 4. Open items (not guessed, not substituted)

1. **Stages 2–8 have no uploaded art.** Only Stage 1 has map/tile/boss images,
   so stages 2–8 keep procedural art and hand-authored tile maps. No uploaded
   asset has been stretched to cover them.
2. **`players.png` pose bands** were confirmed by pixel probes (content
   bounding boxes, widths), not by a manual. Every cell listed above was
   measured; anything that could not be measured is documented as such rather
   than guessed.
3. **`stage1bg.png` object semantics.** The picture is used as the level
   *visual* only; every interactive object (ground, bridge deck, water, pit,
   fortress wall, weapon-container panels, boss gate) lives in
   `src/level/stage1ImageData.ts` as independent tile data on the same world
   grid. No pixel of the image is assumed to be solid.
4. **Boss arena deviation (deliberate, documented).** The art shows a
   bottomless ravine across the last screen. Left as-is the boss cannot be
   defeated (the fighter gets stuck between the chasms — measured), which
   breaks the "stage must be completable" requirement, so
   `tools/stage1_extract.py` levels only the arena (`BOSS_START = 176` →
   level end) to row 23, the widest natural flat run in front of the fortress
   wall. Everything to the left of the gate — ravine included — is exactly as
   extracted. See `docs/stage1-map-image.md`.
