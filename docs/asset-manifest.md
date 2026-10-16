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

## 4. Open items (all decided with the user, 2026-10-13)

1. **Stages 2–8 have no uploaded art — disposition confirmed.** Only Stage 1
   has map/tile/boss images, so stages 2–8 keep their procedural per-stage
   themes (`buildBackground(theme)` in `src/gfx/sprites.ts`) and hand-authored
   tile maps (`src/level/layouts.ts`). No uploaded asset has been stretched to
   cover them and no substitute art has been invented. If map art for stages
   2–8 is uploaded later, the stage-1 pipeline
   (`tools/stage1_extract.py` → extracted collision → world-locked image)
   applies to them unchanged.
2. **`players.png` pose bands** were confirmed by pixel probes (content
   bounding boxes, widths), not by a manual. Every cell listed above was
   measured; anything that could not be measured is documented as such rather
   than guessed.
3. **`stage1bg.png` object semantics.** The picture is used as the level
   *visual* only; every interactive object (ground, bridge deck, water, pit,
   fortress wall, weapon-container panels, boss gate) lives in
   `src/level/stage1ImageData.ts` as independent tile data on the same world
   grid. No pixel of the image is assumed to be solid.
4. **Boss arena deviation (deliberate, user-decided 2026-10-13).** The boss
   gate moved BEFORE the ravine (`BOSS_START = 100`): the single-screen arena
   `[100, 140)` is levelled to its own modal surface row (21) because the art
   there is rising, jagged jungle ground and a boss fight needs one flat,
   pit-free floor. Everything past the gate — the ravine and the fortress
   wall — is exactly as extracted and never traversed. The old
   "level 176 → end" scheme is gone. See `docs/stage1-map-image.md` §5.
5. **Stage-1 enemy pool restricted to real-sprite infantry (2026-10-14).**
   Stage 1 spawns only the 8 infantry kinds that render from the
   `players.png` red-commando column (`grunt, runner, heavy, sniper, shield,
   bomber, jumper, flame` — `SOLDIER_KINDS` in `src/gfx/sprites.ts`). The
   geometric kinds (`turret`, `flyer`, `mech`) have no uploaded art and are
   excluded from every Stage-1 wave source in `buildWaves()`
   (`src/level/stages.ts`): the per-mile air wave, the mid-boss (heavy
   instead of mech), the final defensive line (shield instead of turret) and
   the per-mile "spot turret" roll (infantry instead of turret for stage 1),
   which previously leaked a procedural turret into Stage 1. Stages 2–8 keep
   their procedural enemies by design (see item 1).
6. **1-tile auto step-up in collision (2026-10-14).** `moveAndCollide()`
   (`src/systems/collision.ts`) treated a lone 1-tile ledge (Stage 1 col
   21→22, ground row 23→22) as a wall and stopped the player dead — a real
   traversal blocker that earlier acceptance runs had masked with a
   teleport watchdog. Fixed with an `autoStepUp()` climb (lift the body one
   tile when the destination is clear) plus a `wallAhead()` exemption so AI
   does not turn around at steps. Verified by a genuine no-teleport browser
   run: the player runs from spawn to the boss gate and clears the stage.
7. **Reference-video version conflict (2026-10-13, reported to the user).**
   The user designated B 站 BV1mGkcBHEMi as the sole Stage-1 reference.
   Metadata (Bilibili web API): 2 parts / 2 h 13 min / 1080p, title
   "难度超高的魂斗罗版本！魂斗罗经典版 Contra Classic Edition
   二周目全关卡通关流程", UP 主 -轻云飘-, published 2026-01-15. Per the
   UP's own description it is a **Unity fan remake (author LEOMEº), 2nd
   loop**, "与红白机版本不一样……敌人则是增加了一些机制" — NOT the FC/NES
   original this project replicates from ripped NES assets. This
   environment **cannot decode video**, so no frame-by-frame analysis was
   or will be claimed; NES-original behaviours that could not be verified
   from the uploaded assets are marked 待确认 instead of guessed.
8. **Stage-1 water + bridge deep restore (2026-10-13).** (a) Water is now
   **lethal on contact** (drowning) in Stage 1 — including the river that
   the extractor previously filled with SOLID rock under both bridge decks
   and the water lip at cols 0-1 (`Level.deadlyWater`, stage-1 only;
   stages 2-8 keep their wadeable notch water). (b) Bridge decks are a new
   destructible tile `T.BRIDGE`: **plain bullets and explosions both blow
   exactly one plank per hit** (a jumpable hole; the original lets normal
   rounds punch through the deck — user ruling 2026-10-16), the river below
   stays WATER, so a careless blast drops you in and you drown. (c) Dying
   enemies fall THROUGH bridge decks and keep falling until they pass the
   camera bottom (`passDecks` in `moveAndCollide()` + a screen-bottom cull in
   the death branch), matching the ripper note printed on `stage1bg.png`
   ("Enemies on bridges and machines fall below the screen"). (d) The boss
   fight now switches to a **distinct original boss-battle composition**
   (`TRACKS[8]`, `StageDef.bossMusic`) instead of merely speeding the stage
   track up by 6 %; Konami's boss BGM cannot be shipped (copyright).
   Regenerated via `tools/stage1_extract.py`.
9. **Destroyed-tile rendering over the map image (2026-10-16).** Because
   Stage 1 paints the uploaded panorama 1:1, a destroyed tile's hole would
   stay invisible (the picture still draws the deck). `Level` now records the
   original tile id (`destroyedAs`/`isDestroyed`) and `drawTiles()` repaints
   destroyed tiles over the image: bridge planks as river art, weapon pods /
   crates as a dark rock cavity.
