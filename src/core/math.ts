export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const approach = (v: number, target: number, delta: number) =>
  v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const aabb = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const boxCenterX = (b: Box) => b.x + b.w * 0.5;
export const boxCenterY = (b: Box) => b.y + b.h * 0.5;

export function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** deterministic 32-bit hash -> used by the seeded RNG */
export function hash32(x: number): number {
  x |= 0;
  x = (x + 0x7ed55d16 + (x << 12)) | 0;
  x = (x ^ 0xc761c23c ^ (x >>> 19)) | 0;
  x = (x + 0x165667b1 + (x << 5)) | 0;
  x = ((x + 0xd3a2646c) ^ (x << 9)) | 0;
  x = (x + 0xfd7046c5 + (x << 3)) | 0;
  x = (x ^ 0xb55a4f09 ^ (x >>> 16)) | 0;
  return x >>> 0;
}

/** Mulberry32 – small, fast, deterministic PRNG */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  (): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export function rngFrom(seed: number): Rng {
  const base = makeRng(seed);
  const r = (() => base()) as Rng;
  r.int = (min, max) => min + Math.floor(base() * (max - min + 1));
  r.range = (min, max) => min + base() * (max - min);
  r.pick = <T,>(arr: readonly T[]) => arr[Math.floor(base() * arr.length) % arr.length];
  r.chance = (p: number) => base() < p;
  return r;
}
