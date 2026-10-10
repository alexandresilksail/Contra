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

  /** One-way platform row (solid only when fallen onto from above). */
  platform(from: number, to: number, row: number): void {
    for (let c = from; c <= to; c++) this.set(c, row, T.PLATFORM);
  }

  /** Vertical ladder (non-blocking climb column). */
  ladder(col: number, topRow: number, bottomRow: number): void {
    for (let r = topRow; r <= bottomRow; r++) this.set(col, r, T.LADDER);
  }

  /** Instant-kill spike on the ground surface. Place on flat ground with a
   *  clear run-up so it can always be jumped. */
  spike(col: number): void {
    const top = this.surface(col);
    if (top < LEVEL_ROWS) this.set(col, top - 1, T.SPIKE);
  }

  /**
   * Shallow 2-tile water notch. The surface dips and a solid floor sits just
   * below the water, so the player can either jump across (2 tiles) or, if
   * they fall in, hop straight back out — it is never a death trap like a
   * bottomless pit would be.
   */
  notch(from: number, to: number): void {
    for (let c = from; c <= to; c++) {
      this.set(c, GROUND_ROW, T.EMPTY);
      this.set(c, GROUND_ROW + 1, T.WATER);
      this.set(c, GROUND_ROW + 2, T.SOLID);
    }
  }

  /** Raised solid plateau the player jumps onto (cover / sniper perch). */
  plateau(from: number, to: number, top: number): void {
    this.flat(from, to, top);
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

/* ------------------------------------------------------------------ */
/* shared helpers for the authored stages 2-8                          */
/* ------------------------------------------------------------------ */

/** A climb shaft: a ladder from the ground up to an overhead one-way platform.
 *  Reachable by climbing; never blocks the ground path. */
function shaft(b: MapBuilder, c: number, top: number, half: number): void {
  b.ladder(c, top, GROUND_ROW - 1);
  b.platform(c - half, c + half, top);
}

/** Flat final approach + boss gate (door at def.bossStart). The arena is kept
 *  dead flat so the boss fight is fair and the "arena flat" check holds. */
function finale(b: MapBuilder, def: StageDef, flatFrom: number): void {
  b.flat(flatFrom, def.tiles - 1);
  const gate = def.bossStart;
  for (let row = GROUND_ROW - 6; row < GROUND_ROW; row++) b.set(gate, row, T.DOOR);
}

/* ------------------------------------------------------------------ */
/* Stage 2 — JUNGLE INFILTRATION (forest)                              */
/* ------------------------------------------------------------------ */
export function stage2Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1); // continuous ground base (no empty columns)
  b.sensor(40); // weapon bonus wall
  // shallow water crossings (jump or wade)
  b.notch(54, 55);
  b.notch(64, 65);
  b.notch(72, 73);
  // climbing towers: platform + ladder (also the source of the Stage-2 test counts)
  for (const c of [86, 110, 134, 158, 182]) shaft(b, c, G - 7, 3);
  // solid cover plateaus (jump onto; 2 tiles tall -> always clearable)
  b.plateau(96, 100, G - 2);
  b.plateau(120, 124, G - 2);
  b.plateau(144, 148, G - 2);
  b.plateau(168, 172, G - 2);
  // jungle pits + crate cover
  for (let base = 196; base < 250; base += 18) {
    b.notch(base + 6, base + 7);
    b.crate(base + 3, 1);
  }
  b.spike(238);
  finale(b, def, 258);
  return b.data;
}

/* ------------------------------------------------------------------ */
/* Stage 3 — IRON FOUNDRY (factory)                                    */
/* ------------------------------------------------------------------ */
export function stage3Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1);
  b.sensor(38);
  // crate maze / bunkers
  b.crate(48, 2);
  b.crate(60, 1);
  b.crate(72, 2);
  b.crate(84, 1);
  // catwalk galleries: high platforms + ladders
  for (const c of [96, 130, 164, 198, 232]) shaft(b, c, G - 8, 4);
  // raised solid catwalks (jump onto)
  b.plateau(108, 112, G - 2);
  b.plateau(142, 146, G - 2);
  b.plateau(176, 180, G - 2);
  b.plateau(210, 214, G - 2);
  // roller conveyor corridor: notches + crates
  for (let base = 248; base < 276; base += 14) {
    b.notch(base + 5, base + 6);
    b.crate(base + 2, 1);
  }
  b.spike(244);
  finale(b, def, 280);
  return b.data;
}

/* ------------------------------------------------------------------ */
/* Stage 4 — UNDERGROUND CAVERN (cavern)                               */
/* ------------------------------------------------------------------ */
export function stage4Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1);
  b.sensor(36);
  // water pits (shallow notches)
  for (const [a, c] of [[48, 49], [62, 63], [76, 77], [90, 91], [104, 105]] as [number, number][]) {
    b.notch(a, c);
  }
  // stalagmite plateaus with overhead platforms + ladders
  for (const c of [120, 156, 192, 228, 264]) shaft(b, c, G - 7, 3);
  b.plateau(134, 138, G - 2);
  b.plateau(170, 174, G - 2);
  b.plateau(206, 210, G - 2);
  b.plateau(242, 246, G - 2);
  // worm field
  for (let base = 274; base < 288; base += 12) {
    b.notch(base + 4, base + 5);
    b.crate(base + 1, 1);
  }
  b.spike(270);
  finale(b, def, 290);
  return b.data;
}

/* ------------------------------------------------------------------ */
/* Stage 5 — RUINED CITY (city, forced-scroll corridor)                */
/* The forced-scroll zone (camera active roughly cols 90-205) is kept   */
/* perfectly flat and featureless so the auto-scroll can never strand   */
/* the player on a pit or wall.                                         */
/* ------------------------------------------------------------------ */
export function stage5Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1);
  b.sensor(30);
  // pre-scroll ruins (cols < 90)
  for (const c of [44, 70]) shaft(b, c, G - 8, 4);
  for (const [a, c] of [[52, 53], [78, 79]] as [number, number][]) b.notch(a, c);
  // FORCED SCROLL ZONE (90-205): deliberately flat, no features carved here
  // post-scroll ruins (cols > 205)
  for (const c of [224, 256, 270]) shaft(b, c, G - 8, 4);
  for (const [a, c] of [[232, 233], [266, 267]] as [number, number][]) b.notch(a, c);
  b.crate(240, 1);
  b.crate(278, 1);
  b.spike(216);
  b.spike(286);
  finale(b, def, 290);
  return b.data;
}

/* ------------------------------------------------------------------ */
/* Stage 6 — FROZEN STRONGHOLD (snow)                                  */
/* ------------------------------------------------------------------ */
export function stage6Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1);
  b.sensor(38);
  // ice pits (shallow notches) + plateau ledges
  for (const [a, c] of [[48, 49], [66, 67], [84, 85], [102, 103]] as [number, number][]) {
    b.notch(a, c);
  }
  for (const c of [110, 150, 190, 230, 270]) shaft(b, c, G - 7, 3);
  b.plateau(122, 126, G - 2);
  b.plateau(162, 166, G - 2);
  b.plateau(202, 206, G - 2);
  b.plateau(242, 246, G - 2);
  // crate + pit field
  for (let base = 282; base < 304; base += 14) {
    b.notch(base + 5, base + 6);
    b.crate(base + 2, 1);
  }
  b.spike(278);
  finale(b, def, 310);
  return b.data;
}

/* ------------------------------------------------------------------ */
/* Stage 7 — ALIEN HIVE (alien)                                        */
/* ------------------------------------------------------------------ */
export function stage7Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1);
  b.sensor(36);
  // organic web platforms + vertical shafts
  for (const c of [50, 86, 122, 158, 194, 230, 266, 300]) shaft(b, c, G - 9, 3);
  // connecting web walkways (one-way, non-blocking)
  for (const r of [G - 5, G - 11]) {
    b.platform(60, 80, r);
    b.platform(132, 152, r);
    b.platform(204, 224, r);
    b.platform(276, 296, r);
  }
  b.notch(96, 97);
  b.notch(168, 169);
  b.notch(240, 241);
  b.crate(110, 1);
  b.crate(180, 1);
  b.crate(250, 1);
  b.spike(290);
  finale(b, def, 320);
  return b.data;
}

/* ------------------------------------------------------------------ */
/* Stage 8 — FINAL STRONGHOLD (finalbase)                              */
/* ------------------------------------------------------------------ */
export function stage8Map(def: StageDef): Uint8Array {
  const b = new MapBuilder(def.tiles);
  const G = GROUND_ROW;
  b.flat(0, def.tiles - 1);
  b.sensor(40);
  // mixed gauntlet: notches + plateaus + shafts
  for (const [a, c] of [
    [52, 53],
    [70, 71],
    [120, 121],
    [170, 171],
    [240, 241],
    [300, 301],
  ] as [number, number][]) {
    b.notch(a, c);
  }
  for (const c of [90, 150, 210, 270, 330]) shaft(b, c, G - 8, 4);
  b.plateau(100, 104, G - 2);
  b.plateau(160, 164, G - 2);
  b.plateau(220, 224, G - 2);
  b.plateau(280, 284, G - 2);
  b.crate(342, 1);
  b.crate(348, 1);
  b.spike(58);
  b.spike(176);
  b.spike(306);
  finale(b, def, 348);
  return b.data;
}

/** Total cells per chunk (kept in sync with Level's chunk addressing). */
export const CHUNK_CELLS = CHUNK_TILES * LEVEL_ROWS;
