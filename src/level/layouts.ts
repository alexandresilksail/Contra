/**
 * Hand-authored level layouts.
 *
 * Stage 1 reproduces the structure of the classic Contra jungle opening
 * (arcade version) as a sequence of obstacles, authored as *original* tile
 * code (no copyrighted assets are referenced):
 *
 *   1.  Cliff spawn corridor   – flat, clear of obstacles (so the gun works)
 *   2.  Weapon sensor          – a destructible wall that hides a bonus
 *   3.  River crossing 1       – at-grade bridge with a jumpable gap
 *   4.  Wall-turret ledge      – a 2-tile raised plateau (jump up to engage)
 *   5.  River crossing 2       – second bridge over the water
 *   6.  Waterfall / snipers    – raised plateau hiding riflemen
 *   7.  Ground-cannon field    – flat ground with crate cover
 *   8.  Rolling jungle         – repeating flat runs, pits and crates
 *   9.  Fortress gate          – boss door + Defense Wall boss
 *
 * Everything is built at tile granularity on a plain Uint8Array, so the
 * Level class can serve chunks straight from it.
 */
import { CHUNK_TILES, GROUND_ROW, LEVEL_ROWS } from '../config/constants';
import { T } from './tiles';
import type { StageDef } from './stages';

class MapBuilder {
  data: Uint8Array;
  constructor(public cols: number) {
    this.data = new Uint8Array(cols * LEVEL_ROWS);
  }

  /** Solid ground from `top` down to the level floor. */
  ground(col: number, top = GROUND_ROW): void {
    for (let row = top; row < LEVEL_ROWS; row++) this.set(col, row, T.SOLID);
  }

  /** Flat ground span [from, to] inclusive (optionally raised). */
  flat(from: number, to: number, top = GROUND_ROW): void {
    for (let c = from; c <= to; c++) this.ground(c, top);
  }

  /** Open pit; filled with water below `GROUND_ROW + 2`. Jumpable when <= 3. */
  pit(from: number, to: number): void {
    for (let c = from; c <= to; c++) {
      for (let row = GROUND_ROW; row < LEVEL_ROWS; row++) this.set(c, row, T.EMPTY);
      for (let row = GROUND_ROW + 2; row < LEVEL_ROWS; row++) this.set(c, row, T.WATER);
    }
  }

  /** Single solid row — a walkway at grade (bridge deck over water, ledge). */
  deck(from: number, to: number, row = GROUND_ROW): void {
    for (let c = from; c <= to; c++) this.set(c, row, T.SOLID);
  }

  /** Wooden crates on top of the ground at a column (destructible cover). */
  crate(col: number, count = 1): void {
    const top = this.surface(col);
    for (let i = 1; i <= count; i++) this.set(col, top - i, T.CRATE);
  }

  /** Destructible wall block (weapon sensor alcove) at a column. */
  sensor(col: number): void {
    const top = this.surface(col);
    this.set(col, top - 1, T.HIDDEN);
    this.set(col, top - 2, T.HIDDEN);
  }

  /** Row of the highest solid/other blocking tile in a column (LEVEL_ROWS if none). */
  surface(col: number): number {
    for (let row = 0; row < LEVEL_ROWS; row++) {
      const t = this.get(col, row);
      if (t !== T.EMPTY && t !== T.WATER) return row;
    }
    return LEVEL_ROWS;
  }

  get(col: number, row: number): number {
    if (col < 0 || col >= this.cols || row < 0 || row >= LEVEL_ROWS) return T.EMPTY;
    return this.data[row * this.cols + col];
  }

  set(col: number, row: number, v: number): void {
    if (col < 0 || col >= this.cols || row < 0 || row >= LEVEL_ROWS) return;
    this.data[row * this.cols + col] = v;
  }
}

/**
 * Stage 1 — "FORTRESS GATE" (faithful jungle opening).
 * Column plan (300 columns, ground surface at row 22):
 *
 *   0-40     flat spawning corridor (deliberately clear of obstacles)
 *   45       weapon sensor (destructible HIDDEN wall hiding a bonus)
 *   41-50    approach
 *   51-67    RIVER 1: deck 51-60, gap 61-62 (2), deck 63-67 over water
 *   68-80    flat; wall-turret plateau 74-80 (2 tiles up, jump to engage)
 *   80-96    RIVER 2: deck 80-89, gap 90-91 (2), deck 92-96 over water
 *   97-110   flat; sniper plateau 104-110 (2 tiles up)
 *   111-140  ground-cannon field, crate cover
 *   141-244  rolling jungle: flat + 2-tile pits + crates
 *   245-299  final approach + boss arena (flat)
 *   252      fortress gate (DOOR, boss door)
 */
export function stage1Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;

  /* 1) Spawn cliff corridor — keep clear so the gun demonstrably fires */
  b.flat(0, 40);

  /* 2) Weapon sensor in the cliff wall (shoot it to reveal a bonus) */
  b.flat(41, 50);
  b.sensor(45);

  /* 3) River crossing 1 — at-grade bridge, one jumpable gap */
  b.pit(51, 67);
  b.deck(51, 60, G);
  b.deck(63, 67, G);

  /* 4) Flat run + wall-turret ledge (2-tile plateau, jump up) */
  b.flat(68, 80);
  b.flat(74, 80, G - 2);

  /* 5) River crossing 2 — second bridge over the water */
  b.pit(80, 96);
  b.deck(80, 89, G);
  b.deck(92, 96, G);

  /* 6) Waterfall / sniper rise (raised plateau hiding riflemen) */
  b.flat(97, 110);
  b.flat(104, 110, G - 2);

  /* 7) Ground-cannon field with crate cover */
  b.flat(111, 140);
  b.crate(115, 1);
  b.crate(125, 2);
  b.crate(135, 1);

  /* 8) Rolling jungle — repeating flat runs, jumpable pits, crate cover */
  for (let base = 141; base < 220; base += 26) {
    b.flat(base, base + 25);
    b.pit(base + 9, base + 10);
    b.pit(base + 18, base + 19);
    b.crate(base + 5, 1);
    b.crate(base + 14, 1);
  }

  /* 9) Final approach + boss arena (flat, clear of pits) */
  b.flat(245, def.tiles - 1);

  /* fortress gate (boss door) */
  const gate = def.bossStart;
  for (let row = G - 6; row < G; row++) b.set(gate, row, T.DOOR);

  return b.data;
}

/** Total cells per chunk (kept in sync with Level's chunk addressing). */
export const CHUNK_CELLS = CHUNK_TILES * LEVEL_ROWS;
