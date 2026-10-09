import { TILE } from '../config/constants';
import { isBlocking, isOneWay } from '../level/tiles';

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
  opts: { oneWay?: boolean; dropThrough?: boolean } = {},
): MoveResult {
  const res: MoveResult = { hitX: false, hitY: false, grounded: false, ceiling: false };
  const oneWay = opts.oneWay !== false;
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
          if (isBlocking(level.get(tx, ty))) {
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
          const solid = isBlocking(t);
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
  for (let ty = ty0; ty <= ty1; ty++) if (isBlocking(level.get(tx, ty))) return true;
  return false;
}

export function ledgeAhead(b: Body, level: TileQuery, dir: number): boolean {
  const px = dir > 0 ? b.x + b.w + 2 : b.x - 2;
  const ty = Math.floor((b.y + b.h + 2) / TILE);
  const tx = Math.floor(px / TILE);
  const t = level.get(tx, ty);
  return !isBlocking(t) && !isOneWay(t);
}
