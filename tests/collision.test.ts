import { describe, expect, it } from 'vitest';
import { moveAndCollide, onGround, wallAhead, ledgeAhead, type Body } from '../src/systems/collision';
import { T } from '../src/level/tiles';

/** Tiny in-memory tile map: rows 0..rows-1, cols 0..cols-1 */
function makeMap(cols: number, rows: number, fill: (c: number, r: number) => number) {
  const data: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) data.push(fill(c, r));
  return {
    get(tx: number, ty: number) {
      if (tx < 0 || tx >= cols) return T.SOLID;
      if (ty < 0 || ty >= rows) return T.EMPTY;
      return data[ty * cols + tx];
    },
  };
}

const body = (x: number, y: number, vx = 0, vy = 0): Body => ({ x, y, w: 12, h: 22, vx, vy });

describe('tile collision', () => {
  it('lands on solid ground without tunnelling', () => {
    // ground occupies row 10 (y = 160)
    const map = makeMap(20, 20, (_c, r) => (r >= 10 ? T.SOLID : T.EMPTY));
    const b = body(40, 40, 0, 900);
    for (let i = 0; i < 30; i++) {
      const r = moveAndCollide(b, map, 1 / 60, { oneWay: true });
      if (r.grounded) break;
    }
    expect(b.y).toBeLessThan(160);
    expect(b.y + b.h).toBeLessThanOrEqual(160);
    expect(onGround(b, map)).toBe(true);
  });

  it('stops against a wall', () => {
    const map = makeMap(20, 20, (c, r) => (c >= 8 || r >= 10 ? T.SOLID : T.EMPTY));
    const b = body(80, 100, 400, 0);
    for (let i = 0; i < 40; i++) moveAndCollide(b, map, 1 / 60, { oneWay: true });
    expect(b.x + b.w).toBeLessThanOrEqual(8 * 16);
    expect(wallAhead(b, map, 1)).toBe(true);
  });

  it('passes through one-way platforms from below but lands from above', () => {
    const map = makeMap(20, 20, (c, r) => (r === 6 && c > 2 && c < 12 ? T.PLATFORM : r >= 12 ? T.SOLID : T.EMPTY));
    const rising = body(80, 140, 0, -400);
    moveAndCollide(rising, map, 1 / 60, { oneWay: true });
    expect(rising.y).toBeLessThan(140); // moved up through the platform

    const falling = body(80, 60, 0, 400);
    let landed = false;
    for (let i = 0; i < 30; i++) {
      const r = moveAndCollide(falling, map, 1 / 60, { oneWay: true });
      if (r.grounded) {
        landed = true;
        break;
      }
    }
    expect(landed).toBe(true);
    expect(falling.y + falling.h).toBeLessThanOrEqual(6 * 16);
  });

  it('ignores one-way platforms when dropThrough is requested', () => {
    const map = makeMap(20, 20, (c, r) => (r === 6 && c > 2 && c < 12 ? T.PLATFORM : r >= 12 ? T.SOLID : T.EMPTY));
    const b = body(80, 60, 0, 400);
    for (let i = 0; i < 30; i++) moveAndCollide(b, map, 1 / 60, { oneWay: true, dropThrough: true });
    expect(b.y + b.h).toBeGreaterThan(6 * 16);
  });

  it('detects ledges', () => {
    const map = makeMap(20, 20, (c, r) => (c < 10 && r >= 10 ? T.SOLID : T.EMPTY));
    // standing on the last ground column: the next step is a hole
    const b = body(150, 10 * 16 - 22, 0, 0);
    expect(ledgeAhead(b, map, 1)).toBe(true);
    const b2 = body(64, 10 * 16 - 22, 0, 0);
    expect(ledgeAhead(b2, map, 1)).toBe(false);
  });

  it('never allows a body to end inside a solid tile', () => {
    const map = makeMap(20, 20, (c, r) => (r >= 10 || c === 0 || c === 19 ? T.SOLID : T.EMPTY));
    const b = body(60, 60, 500, 900);
    for (let i = 0; i < 60; i++) moveAndCollide(b, map, 1 / 60, { oneWay: true });
    const tx = Math.floor((b.x + b.w / 2) / 16);
    const ty = Math.floor((b.y + b.h / 2) / 16);
    expect(map.get(tx, ty)).not.toBe(T.SOLID);
  });
});
