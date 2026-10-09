import { CHUNK_TILES, GROUND_ROW, LEVEL_ROWS, TILE } from '../config/constants';
import { rngFrom, type Rng } from '../core/math';
import { T, isBlocking, isDestructible, isHazard, isLadder, isOneWay, isWater } from './tiles';
import type { StageDef } from './stages';

/**
 * Tile map stored in lazily generated chunks (16 tiles wide).
 * Generation is *column based* and seeded, so any chunk can be produced
 * independently -> true chunk loading, deterministic and test-friendly.
 */
export class Level {
  readonly tilesX: number;
  readonly rows = LEVEL_ROWS;
  readonly pixelW: number;
  readonly pixelH: number;
  readonly chunkCount: number;
  private chunks = new Map<number, Uint8Array>();
  doorOpen = false;
  /** destructible tiles that were destroyed (key = ty * tilesX + tx) */
  destroyed = new Set<number>();

  constructor(public def: StageDef) {
    this.tilesX = def.tiles;
    this.pixelW = def.tiles * TILE;
    this.pixelH = LEVEL_ROWS * TILE;
    this.chunkCount = Math.ceil(def.tiles / CHUNK_TILES);
  }

  /* ------------------------------ chunks ------------------------------ */

  chunk(cx: number): Uint8Array {
    if (cx < 0 || cx >= this.chunkCount) {
      // outside the map: return a solid block so nothing can escape sideways
      const empty = new Uint8Array(CHUNK_TILES * LEVEL_ROWS);
      return empty;
    }
    let c = this.chunks.get(cx);
    if (!c) {
      c = generateChunk(this.def, cx);
      this.chunks.set(cx, c);
    }
    return c;
  }

  /** Ensure a range of chunks exists (used to pre-roll the visible region). */
  ensureRange(fromChunk: number, toChunk: number): void {
    for (let i = fromChunk; i <= toChunk; i++) this.chunk(i);
  }

  get(tx: number, ty: number): number {
    if (ty < 0 || ty >= this.rows) return T.SOLID;
    // level edges behave like walls: nothing can walk out of the map
    if (tx < 0 || tx >= this.tilesX) return T.SOLID;
    const cx = Math.floor(tx / CHUNK_TILES);
    const lx = tx - cx * CHUNK_TILES;
    return this.chunk(cx)[ty * CHUNK_TILES + lx];
  }

  set(tx: number, ty: number, v: number): void {
    if (ty < 0 || ty >= this.rows || tx < 0 || tx >= this.tilesX) return;
    const cx = Math.floor(tx / CHUNK_TILES);
    const lx = tx - cx * CHUNK_TILES;
    this.chunk(cx)[ty * CHUNK_TILES + lx] = v;
  }

  key(tx: number, ty: number): number {
    return ty * this.tilesX + tx;
  }

  destroyTile(tx: number, ty: number): void {
    const t = this.get(tx, ty);
    if (!isDestructible(t)) return;
    this.destroyed.add(this.key(tx, ty));
    this.set(tx, ty, T.EMPTY);
  }

  /* ------------------------------ queries ------------------------------ */

  tileAtPx(px: number, py: number): number {
    return this.get(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  solidAt(px: number, py: number): boolean {
    return isBlocking(this.tileAtPx(px, py));
  }
  oneWayAt(px: number, py: number): boolean {
    return isOneWay(this.tileAtPx(px, py));
  }
  ladderAt(px: number, py: number): boolean {
    return isLadder(this.tileAtPx(px, py));
  }
  hazardAt(px: number, py: number): boolean {
    return isHazard(this.tileAtPx(px, py));
  }
  waterAt(px: number, py: number): boolean {
    return isWater(this.tileAtPx(px, py));
  }

  /** Column -> row of the first solid tile from the top (ground surface). */
  groundRow(col: number): number {
    for (let row = 0; row < this.rows; row++) if (isBlocking(this.get(col, row))) return row;
    return this.rows;
  }

  /** Free Y (px, top of body) to place an entity of height h on the ground. */
  groundY(px: number, h: number): number {
    const row = this.groundRow(Math.floor(px / TILE));
    return row * TILE - h;
  }

  bossArenaX(): number {
    return this.def.bossStart * TILE;
  }
}

/* ------------------------------------------------------------------ */
/* chunk generation                                                     */
/* ------------------------------------------------------------------ */

function groundProfile(def: StageDef, col: number, rnd: Rng): number {
  // gentle rolling terrain; flat inside the boss arena
  const base = GROUND_ROW;
  if (col >= def.bossStart - 2) return base;
  const wave = Math.sin(col * 0.06) * 1.2 + Math.sin(col * 0.017 + def.seed) * 1.6;
  const noise = rnd() < 0.08 ? -1 : 0;
  return Math.max(base - 3, Math.min(base + 3, Math.round(base + wave * def.terrain + noise)));
}

export function generateChunk(def: StageDef, cx: number): Uint8Array {
  const c = new Uint8Array(CHUNK_TILES * LEVEL_ROWS);
  const startCol = cx * CHUNK_TILES;
  const rnd = rngFrom(def.seed * 7919 + cx * 104729 + 13);
  const put = (lx: number, ty: number, v: number) => {
    if (lx < 0 || lx >= CHUNK_TILES || ty < 0 || ty >= LEVEL_ROWS) return;
    c[ty * CHUNK_TILES + lx] = v;
  };

  const inBoss = startCol >= def.bossStart - 2;
  const inFinale = startCol >= def.tiles - 8;

  /* --- ground band + pits --- */
  const pitCols: number[] = [];
  if (!inBoss && !inFinale && startCol > 12) {
    const pitChance = def.pitChance;
    for (let i = 0; i < CHUNK_TILES; i++) {
      const col = startCol + i;
      // deterministic pit start: only at columns divisible by 9, checked per chunk
      if (col % 9 === 0 && rnd() < pitChance) {
        const width = 2 + Math.floor(rnd() * 2); // 2..3 tiles -> always jumpable
        for (let k = 0; k < width; k++) pitCols.push(i + k);
        i += width + 3; // leave solid ground between pits
      }
    }
  }
  const pitSet = new Set(pitCols);

  for (let i = 0; i < CHUNK_TILES; i++) {
    const col = startCol + i;
    if (pitSet.has(i)) {
      if (rnd() < def.water) {
        for (let row = GROUND_ROW + 2; row < LEVEL_ROWS; row++) put(i, row, T.WATER);
      }
      continue; // hole
    }
    const top = groundProfile(def, col, rnd);
    for (let row = top; row < LEVEL_ROWS; row++) put(i, row, T.SOLID);
  }

  /* --- platforms, ladders, props --- */
  if (!inBoss) {
    const clusters = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < clusters; k++) {
      const len = 3 + Math.floor(rnd() * 5);
      const sx = Math.floor(rnd() * (CHUNK_TILES - len - 1));
      const row = 13 + Math.floor(rnd() * 6);
      for (let i = 0; i < len; i++) put(sx + i, row, T.PLATFORM);
      // ladder up to the platform (sometimes two stacked platforms + ladder)
      if (rnd() < 0.75) {
        const lx = sx + Math.floor(rnd() * len);
        const ground = groundProfile(def, startCol + lx, rngFrom(def.seed + startCol + lx));
        for (let r = row + 1; r <= Math.min(ground - 1, row + 12); r++) put(lx, r, T.LADDER);
      }
      if (rnd() < 0.35) {
        const row2 = row - 4 - Math.floor(rnd() * 2);
        for (let i = 0; i < Math.max(2, len - 2); i++) put(sx + 1 + i, row2, T.PLATFORM);
      }
    }

    // crates / breakable walls
    const crateCount = Math.floor(rnd() * 3 * def.crates);
    for (let k = 0; k < crateCount; k++) {
      const lx = Math.floor(rnd() * (CHUNK_TILES - 2));
      const col = startCol + lx;
      const top = groundProfile(def, col, rngFrom(def.seed + col));
      put(lx, top - 1, T.CRATE);
      if (rnd() < 0.5) put(lx, top - 2, T.CRATE);
    }

    // hidden bonus alcove behind a breakable wall
    if (rnd() < 0.18) {
      const lx = 2 + Math.floor(rnd() * (CHUNK_TILES - 6));
      const col = startCol + lx;
      const top = groundProfile(def, col, rngFrom(def.seed + col));
      for (let row = top - 3; row < top; row++) put(lx, row, T.HIDDEN);
      put(lx + 1, top - 1, T.CRATE);
    }

    // spike traps on flat ground
    if (rnd() < def.spikes) {
      const lx = Math.floor(rnd() * (CHUNK_TILES - 3));
      const col = startCol + lx;
      const top = groundProfile(def, col, rngFrom(def.seed + col));
      put(lx, top - 1, T.SPIKE);
      if (rnd() < 0.4) put(lx + 1, top - 1, T.SPIKE);
    }
  }

  /* --- boss gate --- */
  if (def.bossStart - startCol >= 0 && def.bossStart - startCol < CHUNK_TILES) {
    const lx = def.bossStart - startCol;
    const ground = groundProfile(def, def.bossStart, rngFrom(def.seed + def.bossStart));
    for (let row = ground - 6; row < ground; row++) put(lx, row, T.DOOR);
  }

  /* --- invisible ceiling guard: nothing spawns above row 1 --- */
  return c;
}

export function openBossDoor(level: Level): void {
  const tx = level.def.bossStart;
  for (let r = 0; r < level.rows; r++) if (level.get(tx, r) === T.DOOR) level.set(tx, r, T.EMPTY);
  level.doorOpen = true;
}
