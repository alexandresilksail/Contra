import { TILE } from '../config/constants';
import { T, isBlocking, isOneWay } from '../level/tiles';

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

export interface TileQuery {
  get(tx: number, ty: number): number;
}

export interface MoveResult {
  hitX: boolean;
  hitY: boolean;
  grounded: boolean;
  ceiling: boolean;
}

/**
 * Axis-separated AABB vs tilemap sweep. Stable, no tunnelling at our speeds
 * (movement is integrated in <=8px sub-steps).
 */
export function moveAndCollide(
  b: Body,
  level: TileQuery,
  dt: number,
  opts: { oneWay?: boolean; dropThrough?: boolean; passDecks?: boolean } = {},
): MoveResult {
  const res: MoveResult = { hitX: false, hitY: false, grounded: false, ceiling: false };
  const oneWay = opts.oneWay !== false;
  // Dying bodies fall THROUGH bridge decks (the original's "enemies on bridges
  // fall below the screen") while still landing on normal ground.
  const blocks = (t: number): boolean =>
    isBlocking(t) && !(opts.passDecks && t === T.BRIDGE);
  const steps = Math.max(1, Math.ceil((Math.abs(b.vx) + Math.abs(b.vy)) * dt / 6));
  const sx = (b.vx * dt) / steps;
  const sy = (b.vy * dt) / steps;

  for (let s = 0; s < steps; s++) {
    /* ---- X ---- */
    if (sx !== 0) {
      b.x += sx;
      const tx0 = Math.floor(b.x / TILE);
      const tx1 = Math.floor((b.x + b.w - 1) / TILE);
      const ty0 = Math.floor(b.y / TILE);
      const ty1 = Math.floor((b.y + b.h - 1) / TILE);
      let hit = false;
      for (let ty = ty0; ty <= ty1 && !hit; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (blocks(level.get(tx, ty))) {
            // Auto step-up: a lone 1-tile ledge (with headroom above) is
            // walkable, like the original - the player/ennemy runs up it
            // instead of being stopped dead by a 1px-tall wall. A taller wall
            // (no headroom) is still a hard stop.
            const above = ty - 1 >= 0 ? level.get(tx, ty - 1) : -1;
            if (!isBlocking(above) && autoStepUp(b, level, blocks)) {
              hit = true; // resolved by climbing, not a wall hit
              break;
            }
            if (sx > 0) b.x = tx * TILE - b.w;
            else b.x = (tx + 1) * TILE;
            b.vx = 0;
            res.hitX = true;
            hit = true;
            break;
          }
        }
      }
    }

    /* ---- Y ---- */
    if (sy !== 0) {
      const prevBottom = b.y + b.h;
      b.y += sy;
      const tx0 = Math.floor(b.x / TILE);
      const tx1 = Math.floor((b.x + b.w - 1) / TILE);
      const ty0 = Math.floor(b.y / TILE);
      // When moving down, include the boundary tile at the feet so that a body
      // resting flush on a tile (bottom exactly on the boundary) is detected as
      // grounded every frame instead of jittering 1px and losing `grounded`.
      const ty1 = sy > 0 ? Math.floor((b.y + b.h) / TILE) : Math.floor((b.y + b.h - 1) / TILE);
      let hit = false;
      for (let ty = ty0; ty <= ty1 && !hit; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = level.get(tx, ty);
          const solid = blocks(t);
          const platform =
            oneWay && isOneWay(t) && sy > 0 && prevBottom <= ty * TILE + 2 && !opts.dropThrough;
          if (solid || platform) {
            if (sy > 0) {
              b.y = ty * TILE - b.h;
              b.vy = 0;
              res.grounded = true;
            } else {
              b.y = (ty + 1) * TILE;
              b.vy = 0;
              res.ceiling = true;
            }
            res.hitY = true;
            hit = true;
            break;
          }
        }
      }
    }
  }
  return res;
}

/**
 * Lift the body by exactly one tile (TILE) if the destination AABB is clear of
 * any blocking tile. Used to climb a single 1-tile ledge during horizontal
 * motion. Returns true (and mutates b.y) when the climb succeeded.
 */
function autoStepUp(b: Body, level: TileQuery, blocks: (t: number) => boolean = isBlocking): boolean {
  const ny = b.y - TILE;
  if (ny < 0) return false;
  const tx0 = Math.floor(b.x / TILE);
  const tx1 = Math.floor((b.x + b.w - 1) / TILE);
  const ty0 = Math.floor(ny / TILE);
  const ty1 = Math.floor((ny + b.h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (blocks(level.get(tx, ty))) return false;
    }
  }
  b.y = ny;
  return true;
}

/** Ground probe used for AI/ledge detection. */
export function onGround(b: Body, level: TileQuery): boolean {
  const y = b.y + b.h + 1;
  const tx0 = Math.floor(b.x / TILE);
  const tx1 = Math.floor((b.x + b.w - 1) / TILE);
  const ty = Math.floor(y / TILE);
  for (let tx = tx0; tx <= tx1; tx++) {
    const t = level.get(tx, ty);
    if (isBlocking(t) || isOneWay(t)) return true;
  }
  return false;
}

export function wallAhead(b: Body, level: TileQuery, dir: number): boolean {
  const px = dir > 0 ? b.x + b.w + 1 : b.x - 1;
  const ty0 = Math.floor((b.y + 2) / TILE);
  const ty1 = Math.floor((b.y + b.h - 2) / TILE);
  const tx = Math.floor(px / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (isBlocking(level.get(tx, ty))) {
      // a lone 1-tile ledge is climbable (see moveAndCollide), so it is not a
      // wall for steering purposes - only a taller obstacle turns the mover.
      const above = ty - 1 >= 0 ? level.get(tx, ty - 1) : -1;
      if (!isBlocking(above)) return false;
      return true;
    }
  }
  return false;
}

export function ledgeAhead(b: Body, level: TileQuery, dir: number): boolean {
  const px = dir > 0 ? b.x + b.w + 2 : b.x - 2;
  const ty = Math.floor((b.y + b.h + 2) / TILE);
  const tx = Math.floor(px / TILE);
  const t = level.get(tx, ty);
  return !isBlocking(t) && !isOneWay(t);
}
