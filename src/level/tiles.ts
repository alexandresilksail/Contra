/** Tile ids and their physical properties. */
export const T = {
  EMPTY: 0,
  SOLID: 1,
  PLATFORM: 2, // one-way: solid only when falling onto it from above
  LADDER: 3,
  SPIKE: 4, // hazard
  WATER: 5, // slow + low damage
  CRATE: 6, // destructible
  DOOR: 7, // boss gate (solid until opened)
  HIDDEN: 8, // destructible wall hiding a bonus
} as const;

export type TileId = (typeof T)[keyof typeof T];

/** Tiles that fully block movement.
 *  HIDDEN is intentionally NOT blocking: weapon pods are shot to reveal a
 *  bonus but never act as a solid wall (matches the original game, where you
 *  run/stroll straight through a pod you choose not to shoot). They remain
 *  destructible by bullets (see isDestructible). */
export function isBlocking(t: number): boolean {
  return t === T.SOLID || t === T.CRATE || t === T.DOOR;
}

/** Tiles that block only when the body is falling and was above them. */
export function isOneWay(t: number): boolean {
  return t === T.PLATFORM;
}

export function isHazard(t: number): boolean {
  return t === T.SPIKE;
}

export function isWater(t: number): boolean {
  return t === T.WATER;
}

export function isLadder(t: number): boolean {
  return t === T.LADDER;
}

export function isDestructible(t: number): boolean {
  return t === T.CRATE || t === T.HIDDEN;
}
