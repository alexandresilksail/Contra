/**
 * Stage-1 collision data, EXTRACTED from the uploaded map image
 * (public/sprites/stage1bg.png) by tools/stage1_extract.py.
 *
 * DO NOT EDIT BY HAND - re-run the tool instead.
 *
 * The image is the visual authority and is drawn 1:1 by the renderer (see
 * `BgLayer.lock` in src/gfx/bgLayer.ts); this module is the independent
 * interactive-collision authority on the 16px tile grid. Mapping:
 *   world(y_img) = y_img + 253,  tileRow = round(world / 16)
 * so the walkable grass line of the art (img y~99) sits exactly on
 * GROUND_ROW*TILE = 352 and the two can never drift apart.
 *
 * Structures per 16px column:
 *   S1_GROUND_RUNS  [from, to, surfaceRow] rock/grass mass -> SOLID down
 *   S1_BRIDGE_RUNS  [from, to, deckRow]     metal bridge deck -> BRIDGE
 *                                           (destructible by explosions);
 *                                           the river below it is WATER
 *   S1_WALL_RUNS    [from, to, topRow]      fortress wall -> SOLID mass
 *   S1_WATER_RUNS   [from, to, floorRow]    water body -> wade data; lethal in
 *                                           stage 1 via Level.deadlyWater
 *   S1_PIT_RUNS     [from, to]              bottomless chasm -> lethal fall
 *   S1_SENSORS      [col, rowTop, rowBottom] weapon containers -> HIDDEN
 */
import { GROUND_ROW, LEVEL_ROWS } from '../config/constants';
import { T } from './tiles';

export const S1_IMG_TO_WORLD = 253;

// [colFrom, colTo, surfaceRow]
export const S1_GROUND_RUNS: number[][] = [
  [2, 17, 22],
  [18, 21, 23],
  [22, 47, 22],
  [56, 65, 22],
  [74, 84, 22],
  [85, 139, 21],
  [140, 143, 23],
  [146, 151, 23],
  [154, 162, 25],
  [163, 163, 23],
  [164, 167, 21],
  [170, 176, 23],
  [177, 183, 25],
  [186, 189, 27],
  [192, 194, 24],
  [195, 204, 23],
  [205, 205, 25],
  [206, 207, 26],
  [208, 208, 27],
];
// [colFrom, colTo, deckRow]
export const S1_BRIDGE_RUNS: number[][] = [
  [48, 55, 22],
  [66, 73, 22],
];
// [colFrom, colTo, topRow]
export const S1_WALL_RUNS: number[][] = [
  [209, 215, 19],
];
// [colFrom, colTo, floorRow]
export const S1_WATER_RUNS: number[][] = [
  [0, 1, 25],
];
// [colFrom, colTo]
export const S1_PIT_RUNS: number[][] = [
  [144, 145],
  [152, 153],
  [168, 169],
  [184, 185],
  [190, 191],
];
// [col, rowTop, rowBottom] destructible weapon containers
export const S1_SENSORS: number[][] = [
  [21, 22, 22],
  [79, 21, 21],
  [99, 20, 20],
];

/** Deepest wade floor, so a player who falls in can always jump back out. */
export const S1_WADE_CAP = 25;

/** Walkable surface (top solid) row of a column, from the extracted ground runs. */
function surfaceRow(col: number): number {
  for (const [a, b, row] of S1_GROUND_RUNS) if (col >= a && col <= b) return row;
  return GROUND_ROW;
}

/** Build the Stage-1 tile map from the layout extracted out of the map image. */
export function stage1ImageMap(tiles: number, bossStart: number): Uint8Array {
  const data = new Uint8Array(tiles * LEVEL_ROWS);
  const set = (c: number, r: number, v: number) => {
    if (c >= 0 && c < tiles && r >= 0 && r < LEVEL_ROWS) data[r * tiles + c] = v;
  };

  // 1) water bodies (wade floor, capped) - drawn first so ground overwrites
  for (const [a, b] of S1_WATER_RUNS) {
    for (let c = a; c <= b; c++) {
      for (let r = 0; r < S1_WADE_CAP; r++) set(c, r, T.EMPTY);
      for (let r = S1_WADE_CAP; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
      for (let r = Math.max(0, GROUND_ROW - 2); r < S1_WADE_CAP; r++) set(c, r, T.WATER);
    }
  }

  // 2) bottomless chasms stay EMPTY: the player dies past the level floor,
  //    exactly like the original game.
  for (const [a, b] of S1_PIT_RUNS) {
    for (let c = a; c <= b; c++) {
      for (let r = 0; r < LEVEL_ROWS; r++) set(c, r, T.EMPTY);
    }
  }

  // 3) ground masses + bridge decks. A bridge is ONE deck row of destructible
  //    BRIDGE tiles with the river (WATER) below it: explosions blow the deck
  //    open and whatever falls in drowns (Level.deadlyWater), like the original.
  for (const [a, b, row] of S1_GROUND_RUNS) {
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }
  for (const [a, b, row] of S1_BRIDGE_RUNS) {
    for (let c = a; c <= b; c++) {
      set(c, row, T.BRIDGE);
      for (let r = row + 1; r < LEVEL_ROWS; r++) set(c, r, T.WATER);
    }
  }

  // 4) fortress wall (boss arena back wall)
  for (const [a, b, row] of S1_WALL_RUNS) {
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }

  // 5) weapon-container sensor walls (destructible, may drop a pickup)
  for (const [c, r0, r1] of S1_SENSORS) {
    for (let r = r0; r <= r1; r++) set(c, r, T.HIDDEN);
  }

  // 6) boss gate at the arena entrance. The door stands ON the arena surface
  //    (rows surface-6 .. surface-1) rather than at a fixed row: openBossDoor()
  //    blanks the door tiles, so a door that also covered the floor row would
  //    erase walkable ground and drop that column by one tile.
  const doorRow = surfaceRow(bossStart);
  for (let r = doorRow - 6; r < doorRow; r++) set(bossStart, r, T.DOOR);

  return data;
}
