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

function slice(img: HTMLImageElement, cell: Cell, scale: number, flip = false): Sprite {
  const [sx, sy, sw, sh] = cell;
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const c = makeCanvas(w, h);
  const g = ctxOf(c);
  g.imageSmoothingEnabled = true; // sheets are upscaled rips; soften on the way down
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
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
