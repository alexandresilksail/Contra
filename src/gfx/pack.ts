/**
 * Optional sprite-pack layer.
 *
 * The game ships with 100% procedural pixel art, so it runs with zero external
 * files. This module adds an *optional* override: if image files are present in
 * `public/sprites/` they are sliced and used instead of the generated art; if
 * they are missing (or fail to load) the game silently falls back to procedural
 * art. Nothing here is required to build or run the project.
 *
 * NOTE: the repo intentionally ships NO image files. Drop your own legally
 * obtained sheets into `public/sprites/` (that folder is git-ignored) to enable.
 */
import { makeCanvas, ctxOf, flipH, scaleSprite, type Sprite, type SpriteSet } from './pixel';
import { VIEW_H, VIEW_W } from '../config/constants';

/* ------------------------------------------------------------------ */
/* manifest - all coordinates are in SOURCE SHEET pixels               */
/* ------------------------------------------------------------------ */

/** The character sheet is a 2x upscale; slice back down to 1x. */
const PLAYER_SCALE = 0.5;
/** Weapon capsule icons are drawn at half size to match the 16px pickup box. */
const PICKUP_SCALE = 0.5;

type Cell = [number, number, number, number]; // x, y, w, h on the sheet

/**
 * Pose layout for one character. Frames were measured from the sheet, so if a
 * pose looks wrong at runtime just swap the numbers here - no code changes.
 */
interface CharMap {
  /** ordered animation frames (used for idle + run cycle) */
  cycle: Cell[];
  /** airborne poses */
  jump: Cell;
  fall: Cell;
  /** prone / crawling */
  crouch: Cell;
  /** tall vertical poses (ladder / climbing) */
  climb: Cell[];
  /** defeat poses */
  dead: Cell[];
}

/**
 * Block A of the character sheet: Bill (blue panel) on the left half, the red
 * commando (Lance / enemy soldiers) on the right half.
 *
 * Both halves use the SAME 12-frame layout on the y=24 band. Measured with
 * tools/player_frames.py + tools/titan_frames.py (uniform 30px-wide probe):
 *
 *   frames 0..5  -> content 15..22px wide  : unarmed ground cycle (run)
 *   frames 6..11 -> content 20..25px wide  : armed ground cycle (run + rifle
 *                  extended forward, visible as a horizontal bar at chest
 *                  height in tools/player_ascii.py)
 *
 * Cells are a uniform window (w=26, h=36) - wide/tall enough for every frame
 * and short enough not to bleed into the next pose band. Empty margins are
 * removed by trimSprite() and the group is then bottom-aligned by
 * alignFrames(), so this only needs to be *approximately* right.
 *
 * NOTE: the red column previously listed only 10 frames (x=1517 and x=1712
 * were missing); it is 12, mirroring the blue column.
 */
const CYCLE_X = {
  razor: [25, 90, 154, 220, 285, 349, 415, 480, 544, 610, 675, 739],
  titan: [1063, 1127, 1195, 1258, 1321, 1392, 1453, 1517, 1585, 1648, 1712, 1780],
} as const;

/** Indices of the unarmed run cycle / armed run cycle inside the 12 frames. */
export const RUN_FRAME_IDX = [0, 1, 2, 3, 4, 5];
export const SHOOT_FRAME_IDX = [6, 7, 8, 9, 10, 11];
/** Most compact unarmed frame - used as the standing / idle pose. */
export const IDLE_FRAME_IDX = 2;

const cycleCells = (col: keyof typeof CYCLE_X): Cell[] =>
  CYCLE_X[col].map((x) => [x, 24, 26, 36] as Cell);

export const PACK_MAP: Record<string, CharMap> = {
  razor: {
    cycle: cycleCells('razor'),
    jump: [25, 203, 20, 48],
    fall: [220, 203, 20, 48],
    crouch: [919, 42, 40, 16],
    climb: [
      [804, 8, 18, 64],
      [869, 8, 18, 64],
    ],
    dead: [
      [413, 203, 19, 64],
      [478, 203, 19, 64],
    ],
  },
  titan: {
    cycle: cycleCells('titan'),
    jump: [1063, 203, 20, 48],
    fall: [1258, 203, 20, 48],
    crouch: [1959, 41, 40, 17],
    climb: [
      [1845, 8, 16, 64],
      [1910, 8, 16, 64],
    ],
    dead: [
      [1195, 203, 17, 64],
      [1454, 203, 17, 64],
    ],
  },
};

/** Five capsule icons laid out left->right on the pickup sheet. */
const PICKUP_CELLS: Cell[] = [
  [0, 0, 24, 32],
  [25, 0, 24, 32],
  [50, 0, 24, 32],
  [75, 0, 24, 32],
  [100, 0, 24, 32],
];

const FILES = {
  players: 'players.png',
  pickups: 'pickups.png',
  title: 'title.png',
  stage1bg: 'stage1bg.png',
  tiles1: 'tiles1.png',
  wall1: 'wall1.png',
} as const;

/* ------------------------------------------------------------------ */
/* loading                                                             */
/* ------------------------------------------------------------------ */

const images: Partial<Record<keyof typeof FILES, HTMLImageElement>> = {};
let ready = false;
let attempted = false;

function url(name: string): string {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  return `${base}sprites/${name}`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Attempts to load the optional sprite pack. Safe to call when absent. */
export async function loadPack(): Promise<boolean> {
  if (attempted) return ready;
  attempted = true;
  const entries = Object.entries(FILES) as [keyof typeof FILES, string][];
  await Promise.all(
    entries.map(async ([key, file]) => {
      const img = await loadImage(url(file));
      if (img) images[key] = img;
    }),
  );
  ready = !!images.players || !!images.pickups;
  return ready;
}

export function packReady(): boolean {
  return ready;
}

export function packHasPlayers(): boolean {
  return !!images.players;
}

/* ------------------------------------------------------------------ */
/* slicing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rip sheets draw each sprite on an opaque panel. These are the panel shades
 * per sheet; slice() keys them out so sprites get real alpha. All shades are
 * chosen well clear of sprite colors (nearest sprite color is 80+ away,
 * title/tiles use tight tolerances since they sit right on black/magenta).
 */
interface KeySpec {
  colors: [number, number, number][];
  dist: number;
}
const KEY_COLORS: Record<string, KeySpec> = {
  players: {
    colors: [
      [0, 47, 87],
      [28, 102, 145],
      [157, 28, 72],
      [82, 14, 0],
    ],
    dist: 70,
  },
  pickups: { colors: [[0, 91, 91]], dist: 70 },
  title: {
    colors: [
      [221, 0, 255], // magenta backdrop
      [0, 0, 0], // black panel behind the logo
    ],
    dist: 40,
  },
  tiles1: { colors: [[0, 0, 0]], dist: 30 },
  wall1: {
    colors: [
      [0, 48, 0], // green backdrop
      [0, 0, 0], // black shadow panels
    ],
    dist: 40,
  },
};

function keysFor(img: HTMLImageElement): KeySpec | null {
  for (const key of Object.keys(images) as (keyof typeof FILES)[]) {
    if (images[key] === img) return KEY_COLORS[key] ?? null;
  }
  return null;
}

function chromaKey(canvas: HTMLCanvasElement, spec: KeySpec | null): void {
  if (!spec || !spec.colors.length) return;
  const g = ctxOf(canvas);
  const w = canvas.width;
  const h = canvas.height;
  if (typeof g.getImageData !== 'function') return; // stub ctx (tests)
  const lim = spec.dist * spec.dist;
  const data = g.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const gr = d[i + 1];
    const b = d[i + 2];
    for (let k = 0; k < spec.colors.length; k++) {
      const dr = r - spec.colors[k][0];
      const dg = gr - spec.colors[k][1];
      const db = b - spec.colors[k][2];
      if (dr * dr + dg * dg + db * db < lim) {
        d[i + 3] = 0;
        break;
      }
    }
  }
  g.putImageData(data, 0, 0);
}

function slice(img: HTMLImageElement, cell: Cell, scale: number, flip = false, trim = false): Sprite {
  const [sx, sy, sw, sh] = cell;
  // 1) cut at source resolution and key out the panel background first,
  //    so downscale blending never smears panel color into sprite edges
  const raw = makeCanvas(sw, sh);
  const rg = ctxOf(raw);
  rg.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  chromaKey(raw, keysFor(img));
  // 2) drop the empty margin around the sprite (at source resolution, so the
  //    scale factor below stays exact and pixels stay crisp)
  const src = trim ? trimSprite(raw) : raw;
  const ssw = src.width;
  const ssh = src.height;
  // 3) scale to target size
  const w = Math.max(1, Math.round(ssw * scale));
  const h = Math.max(1, Math.round(ssh * scale));
  const c = makeCanvas(w, h);
  const g = ctxOf(c);
  g.imageSmoothingEnabled = true; // sheets are upscaled rips; soften on the way down
  g.drawImage(src, 0, 0, ssw, ssh, 0, 0, w, h);
  return flip ? flipH(c) : c;
}

/* ------------------------------------------------------------------ */
/* frame normalisation                                                 */
/* ------------------------------------------------------------------ */

/** Tight alpha bounding box, or null when the frame is empty / unsupported. */
function alphaBox(src: Sprite): { x: number; y: number; w: number; h: number } | null {
  const g = ctxOf(src);
  if (typeof g.getImageData !== 'function') return null; // stub ctx (tests)
  const d = g.getImageData(0, 0, src.width, src.height).data;
  let minx = src.width;
  let miny = src.height;
  let maxx = -1;
  let maxy = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (d[(y * src.width + x) * 4 + 3] <= 8) continue;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
  }
  if (maxx < 0) return null;
  return { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}

/** Crop a sprite to its opaque pixels (keeps pixel edges, no resampling). */
function trimSprite(src: Sprite): Sprite {
  const b = alphaBox(src);
  if (!b) return src;
  if (b.x === 0 && b.y === 0 && b.w === src.width && b.h === src.height) return src;
  const out = makeCanvas(b.w, b.h);
  ctxOf(out).drawImage(src, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  return out;
}

/**
 * Put every frame of a group on a common canvas with the content
 * left- and bottom-aligned. Without this, rimmed frames of differing sizes
 * make the character jitter sideways and float above the ground.
 */
function alignFrames(frames: Sprite[]): Sprite[] {
  let mw = 1;
  let mh = 1;
  for (const f of frames) {
    mw = Math.max(mw, f.width);
    mh = Math.max(mh, f.height);
  }
  return frames.map((f) => {
    if (f.width === mw && f.height === mh) return f;
    const c = makeCanvas(mw, mh);
    ctxOf(c).drawImage(f, 0, mh - f.height);
    return c;
  });
}

/** Uniformly rescale a group (keeps relative pose sizes, e.g. prone stays short). */
function scaleFrames(frames: Sprite[], k: number): Sprite[] {
  if (Math.abs(k - 1) < 0.001) return frames;
  return frames.map((f) => scaleSprite(f, f.width * k, f.height * k));
}

function mkSet(frames: Sprite[]): SpriteSet {
  return { right: frames, left: frames.map((f) => flipH(f)) };
}

function cellSet(img: HTMLImageElement, cells: Cell[], scale: number): SpriteSet {
  return mkSet(cells.map((c) => slice(img, c, scale)));
}

/** Slice a pose group: trim -> bottom-align -> uniform scale. */
function groupSet(
  img: HTMLImageElement,
  cells: Cell[],
  scale: number,
  k = 1,
): Sprite[] {
  const frames = alignFrames(cells.map((c) => slice(img, c, scale, false, true)));
  return scaleFrames(frames, k);
}

/* ------------------------------------------------------------------ */
/* public art builders (return null -> caller keeps procedural art)    */
/* ------------------------------------------------------------------ */

export interface PackShootArt {
  idle: SpriteSet;
  run: SpriteSet[];
  jump: SpriteSet;
  fall: SpriteSet;
  crouch: SpriteSet;
  climb: SpriteSet[];
}

export interface PackBodyArt {
  idle: SpriteSet;
  run: SpriteSet[];
  jump: SpriteSet;
  fall: SpriteSet;
  crouch: SpriteSet;
  climb: SpriteSet[];
  hurt: SpriteSet;
  dead: SpriteSet[];
  victory: SpriteSet;
  /** rifle-raised variants (sheet frames 6..11) */
  shoot: PackShootArt;
  portrait: Sprite;
}

/**
 * Body poses for a character id; null when the pack is unavailable.
 *
 * `targetH` is the entity hitbox height: the standing cycle is scaled so the
 * drawn sprite matches it, and every other pose is scaled by the SAME factor
 * (so prone/climb keep their correct relative size).
 */
export function packPlayerArt(charId: string, targetH = 22): PackBodyArt | null {
  const img = images.players;
  const map = PACK_MAP[charId];
  if (!img || !map || !map.cycle.length) return null;

  const S = PLAYER_SCALE;
  // all 12 ground frames share one alignment/normalisation pass so the
  // unarmed and armed cycles have identical feet placement and body offset
  const cyc = alignFrames(map.cycle.map((c) => slice(img, c, S, false, true)));
  const standH = cyc[0]?.height ?? 0;
  const k = standH > 0 ? targetH / standH : 1;
  const cycF = scaleFrames(cyc, k);

  const run = RUN_FRAME_IDX.map((i) => mkSet([cycF[Math.min(i, cycF.length - 1)]]));
  const shootRun = SHOOT_FRAME_IDX.map((i) => mkSet([cycF[Math.min(i, cycF.length - 1)]]));
  const idleFrame = cycF[Math.min(IDLE_FRAME_IDX, cycF.length - 1)];

  const jumpF = groupSet(img, [map.jump], S, k);
  const fallF = groupSet(img, [map.fall], S, k);
  const crouchF = groupSet(img, [map.crouch], S, k);
  const climbF = groupSet(img, map.climb, S, k);
  const deadF = groupSet(img, map.dead, S, k);

  return {
    idle: mkSet([idleFrame]),
    run,
    jump: mkSet([jumpF[0]]),
    fall: mkSet([fallF[0]]),
    crouch: mkSet([crouchF[0]]),
    climb: climbF.map((f) => mkSet([f])),
    hurt: mkSet([idleFrame]),
    dead: deadF.map((f) => mkSet([f])),
    victory: mkSet([cycF[0]]),
    shoot: {
      idle: mkSet([shootRun[0].right[0]]),
      run: shootRun,
      jump: mkSet([jumpF[0]]),
      fall: mkSet([fallF[0]]),
      crouch: mkSet([crouchF[0]]),
      climb: climbF.map((f) => mkSet([f])),
    },
    portrait: slice(img, map.cycle[IDLE_FRAME_IDX], PLAYER_SCALE * 3, false, true),
  };
}

/** Capsule icon for a weapon pick-up; null when unavailable. */
export function packPickupIcon(index: number): Sprite | null {
  const img = images.pickups;
  if (!img || !PICKUP_CELLS.length) return null;
  const cell = PICKUP_CELLS[((index % PICKUP_CELLS.length) + PICKUP_CELLS.length) % PICKUP_CELLS.length];
  return slice(img, cell, PICKUP_SCALE);
}

/* ------------------------------------------------------------------ */
/* enemy soldiers                                                       */
/* ------------------------------------------------------------------ */

/**
 * The character sheet's RIGHT column is the red-commando palette. In Contra
 * the basic enemy infantry is a red commando that shares the player sprite
 * data with a different palette, so this column is the faithful source for
 * enemy soldiers (there is no separate enemy sheet).
 *
 * Same 12-frame ground band as the player column (see CYCLE_X) - enemies
 * carry their rifle at all times, so the whole 12-frame cycle is used.
 */
const ENEMY_CYCLE_X: readonly number[] = CYCLE_X.titan;

/** Enemy soldier walk cycle, normalised; null when the pack is absent. */
export function packEnemyFrames(targetH = 22): SpriteSet[] | null {
  const img = images.players;
  if (!img) return null;
  const S = PLAYER_SCALE;
  const cells = ENEMY_CYCLE_X.map((x) => [x, 24, 26, 36] as Cell);
  // one alignment pass for the whole cycle so soldiers never jitter or float
  const frames = alignFrames(cells.map((c) => slice(img, c, S, false, true)));
  const h = frames[0]?.height ?? 0;
  const scaled = scaleFrames(frames, h > 0 ? targetH / h : 1);
  return scaled.map((f) => mkSet([f]));
}

/* ------------------------------------------------------------------ */
/* title logo                                                          */
/* ------------------------------------------------------------------ */

/**
 * The metallic CONTRA wordmark from the title-screens sheet (the "American
 * logo" block; the KONAMI mark above it is deliberately NOT included).
 * Measured on the sheet: x 30..227, y 494..575 (~198x82, draws 1:1).
 */
const TITLE_LOGO: Cell = [30, 494, 198, 82];

/** Title logo override; null keeps the procedural logo. */
export function packTitleLogo(): Sprite | null {
  const img = images.title;
  if (!img) return null;
  return slice(img, TITLE_LOGO, 1);
}

/* ------------------------------------------------------------------ */
/* stage 1 boss - defense wall                                          */
/* ------------------------------------------------------------------ */

/**
 * The full fortress-wall sheet (223x192). Drawn for the stage-1 boss,
 * scaled into the boss hitbox; the glowing core sits at ~(50,115) on the
 * sheet, which maps to the weak-point offset [-34, +10] at 0.55 scale.
 */
const WALL_SCALE = 0.55;

/** Stage-1 defense wall override; null keeps the procedural boss art. */
export function packBossWall(): { sprite: Sprite; scale: number } | null {
  const img = images.wall1;
  if (!img) return null;
  return { sprite: slice(img, [0, 0, img.width, img.height], WALL_SCALE), scale: WALL_SCALE };
}

/* ------------------------------------------------------------------ */
/* stage 1 background                                                  */
/* ------------------------------------------------------------------ */

/** The Stage-1 panorama is 3456x245; the last 5 rows are a white border. */
const BG1_H = 240;

/**
 * Stage 1 scrolling background. Returns the panorama strip plus a `sky`
 * canvas filled with the strip's top-row dominant color so the area above
 * the strip blends seamlessly. Null keeps the procedural background.
 */
export function packStage1Bg(): { sky: Sprite; sprite: Sprite } | null {
  const img = images.stage1bg;
  if (!img) return null;
  const sprite = slice(img, [0, 0, img.width, BG1_H], 1);
  // dominant color of the top rows -> seamless sky fill above the strip
  let top = '#04070f';
  const g = ctxOf(sprite);
  if (typeof g.getImageData === 'function' && sprite.width > 0) {
    const data = g.getImageData(0, 0, sprite.width, 2).data;
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = -1;
    let bestN = 0;
    for (const [key, n] of counts) {
      if (n > bestN) {
        bestN = n;
        best = key;
      }
    }
    if (best >= 0) {
      top = '#' + best.toString(16).padStart(6, '0');
    }
  }
  const sky = makeCanvas(VIEW_W, VIEW_H);
  const sg = ctxOf(sky);
  sg.fillStyle = top;
  sg.fillRect(0, 0, VIEW_W, VIEW_H);
  return { sky, sprite };
}

/* ------------------------------------------------------------------ */
/* stage 1 tiles                                                       */
/* ------------------------------------------------------------------ */

/** 16px cells on the Stage-1 tileset (18x4 grid), measured on the sheet. */
const T1 = {
  /** grass-mound top (exposed ground surface; rounded corners are authentic) */
  solidTop: [0, 0, 16, 16] as Cell,
  /** rocky fill variants (composited over a dark base to hide keyed holes) */
  solidFill: [
    [14, 16, 16, 16],
    [15, 16, 16, 16],
    [13, 16, 16, 16],
  ] as Cell[],
  /** thin ledge = top 6 rows of the grass tiles */
  platform: [
    [0, 0, 16, 6],
    [1, 0, 16, 6],
  ] as Cell[],
  /** animated water (3 frames) */
  water: [
    [3, 32, 16, 16],
    [4, 32, 16, 16],
    [5, 32, 16, 16],
  ] as Cell[],
};

/** Dark base under rocky fill tiles so keyed holes never show sky. */
const FILL_BASE = '#20260a';

/**
 * Stage-1 tile overrides (solid / platform / water only; ladder, spike,
 * crate and door have no equivalents on the sheet and stay procedural).
 */
export function packStage1Tiles(): {
  solid: Sprite[];
  platform: Sprite[];
  water: Sprite[];
} | null {
  const img = images.tiles1;
  if (!img) return null;

  const solid: Sprite[] = [slice(img, T1.solidTop, 1)];
  for (const cell of T1.solidFill) {
    const c = makeCanvas(16, 16);
    const g = ctxOf(c);
    g.fillStyle = FILL_BASE;
    g.fillRect(0, 0, 16, 16);
    g.drawImage(slice(img, cell, 1), 0, 0);
    solid.push(c);
  }

  const platform: Sprite[] = T1.platform.map((cell) => {
    const c = makeCanvas(16, 16);
    ctxOf(c).drawImage(img, cell[0], cell[1], cell[2], cell[3], 0, 0, cell[2], cell[3]);
    return c;
  });

  const water: Sprite[] = T1.water.map((cell) => slice(img, cell, 1));
  return { solid, platform, water };
}
