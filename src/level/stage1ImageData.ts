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
 *   S1_BRIDGE_RUNS  [from, to, deckRow]     metal bridge deck -> SOLID
 *   S1_WALL_RUNS    [from, to, topRow]      fortress wall -> SOLID mass
 *   S1_WATER_RUNS   [from, to, floorRow]    water body -> wade, capped floor
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
  [85, 116, 21],
  [117, 127, 22],
  [128, 138, 21],
  [139, 143, 23],
  [146, 151, 23],
  [154, 162, 25],
  [163, 163, 23],
  [164, 167, 21],
  [170, 208, 23],
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
];
// [col, rowTop, rowBottom] destructible weapon containers
export const S1_SENSORS: number[][] = [
  [103, 20, 20],
  [115, 20, 20],
  [21, 22, 22],
  [79, 21, 21],
  [99, 20, 20],
];

/** Deepest wade floor, so a player who falls in can always jump back out. */
export const S1_WADE_CAP = 25;

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

  // 3) ground masses + bridge decks
  for (const [a, b, row] of S1_GROUND_RUNS) {
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }
  for (const [a, b, row] of S1_BRIDGE_RUNS) {
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }

  // 4) fortress wall (boss arena back wall)
  for (const [a, b, row] of S1_WALL_RUNS) {
    for (let c = a; c <= b; c++) for (let r = row; r < LEVEL_ROWS; r++) set(c, r, T.SOLID);
  }

  // 5) weapon-container sensor walls (destructible, may drop a pickup)
  for (const [c, r0, r1] of S1_SENSORS) {
    for (let r = r0; r <= r1; r++) set(c, r, T.HIDDEN);
  }

  // 6) boss gate in front of the fortress wall art
  for (let r = GROUND_ROW - 6; r < GROUND_ROW; r++) set(bossStart, r, T.DOOR);

  return data;
}
