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
import { makeCanvas, ctxOf, flipH, type Sprite, type SpriteSet } from './pixel';
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

/* Block A of the character sheet: Bill on the left half, Lance on the right. */
export const PACK_MAP: Record<string, CharMap> = {
  razor: {
    cycle: [
      [25, 24, 19, 48],
      [90, 25, 20, 46],
      [154, 24, 19, 48],
      [220, 24, 18, 48],
      [285, 25, 20, 46],
      [349, 24, 20, 48],
      [415, 24, 25, 48],
      [480, 25, 25, 46],
      [544, 24, 26, 48],
      [610, 25, 25, 47],
      [675, 26, 25, 45],
      [739, 25, 26, 47],
    ],
    jump: [25, 203, 18, 48],
    fall: [220, 204, 18, 47],
    crouch: [919, 42, 40, 16],
    climb: [
      [804, 8, 18, 64],
      [869, 9, 18, 63],
    ],
    dead: [
      [413, 203, 19, 64],
      [478, 204, 19, 64],
    ],
  },
  titan: {
    cycle: [
      [1063, 24, 20, 48],
      [1127, 25, 21, 42],
      [1195, 24, 16, 48],
      [1258, 24, 18, 48],
      [1321, 25, 22, 42],
      [1392, 24, 16, 48],
      [1453, 24, 26, 48],
      [1585, 24, 24, 48],
      [1648, 25, 26, 47],
      [1780, 25, 24, 47],
    ],
    jump: [1063, 203, 18, 48],
    fall: [1258, 204, 18, 47],
    crouch: [1959, 41, 40, 17],
    climb: [
      [1845, 8, 16, 64],
      [1910, 9, 16, 63],
    ],
    dead: [
      [1195, 203, 16, 64],
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

function slice(img: HTMLImageElement, cell: Cell, scale: number, flip = false): Sprite {
  const [sx, sy, sw, sh] = cell;
  // 1) cut at source resolution and key out the panel background first,
  //    so downscale blending never smears panel color into sprite edges
  const raw = makeCanvas(sw, sh);
  const rg = ctxOf(raw);
  rg.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  chromaKey(raw, keysFor(img));
  // 2) scale to target size
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const c = makeCanvas(w, h);
  const g = ctxOf(c);
  g.imageSmoothingEnabled = true; // sheets are upscaled rips; soften on the way down
  g.drawImage(raw, 0, 0, sw, sh, 0, 0, w, h);
  return flip ? flipH(c) : c;
}

function mkSet(frames: Sprite[]): SpriteSet {
  return { right: frames, left: frames.map((f) => flipH(f)) };
}

function cellSet(img: HTMLImageElement, cells: Cell[], scale: number): SpriteSet {
  return mkSet(cells.map((c) => slice(img, c, scale)));
}

/* ------------------------------------------------------------------ */
/* public art builders (return null -> caller keeps procedural art)    */
/* ------------------------------------------------------------------ */

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
  portrait: Sprite;
}

/** Body poses for a character id; null when the pack is unavailable. */
export function packPlayerArt(charId: string): PackBodyArt | null {
  const img = images.players;
  const map = PACK_MAP[charId];
  if (!img || !map) return null;

  const S = PLAYER_SCALE;
  const frames = map.cycle.map((c) => slice(img, c, S));
  const idle = mkSet([frames[0] ?? frames[0]]);
  // spread the cycle so the run animation reads as movement
  const runIdx = [1, 3, 5, 7].map((i) => Math.min(i, frames.length - 1));
  const run = runIdx.map((i) => mkSet([frames[i]]));

  return {
    idle,
    run,
    jump: cellSet(img, [map.jump], S),
    fall: cellSet(img, [map.fall], S),
    crouch: cellSet(img, [map.crouch], S),
    climb: map.climb.map((c) => cellSet(img, [c], S)),
    hurt: idle,
    dead: map.dead.map((c) => cellSet(img, [c], S)),
    victory: mkSet([frames[0]]),
    portrait: slice(img, map.cycle[0], PLAYER_SCALE * 3),
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
