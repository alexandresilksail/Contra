import { CHUNK_TILES, LEVEL_ROWS, TILE } from '../config/constants';
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
  /** pre-built authored map (stage layouts); served instead of procgen chunks */
  private authored: Uint8Array | null = null;
  private authoredViews = new Map<number, Uint8Array>();
  doorOpen = false;
  /** Stage 1 water is lethal on contact (drowning), like the original game. */
  deadlyWater = false;
  /** destructible tiles that were destroyed (key = ty * tilesX + tx) */
  destroyed = new Set<number>();
  /** what each destroyed tile used to be (key -> original tile id). The
   *  Stage-1 renderer needs this: the uploaded map image still shows the
   *  bridge plank / weapon pod at that spot, so the hole must be painted
   *  over the picture or the destruction stays invisible. */
  destroyedAs = new Map<number, number>();

  constructor(public def: StageDef) {
    this.tilesX = def.tiles;
    this.pixelW = def.tiles * TILE;
    this.pixelH = LEVEL_ROWS * TILE;
    this.chunkCount = Math.ceil(def.tiles / CHUNK_TILES);
    this.deadlyWater = def.deadlyWater === true;
    if (def.layout) {
      // authored maps arrive row-major (stride = tilesX); convert to the
      // chunk layout Level.get() expects: 16-col blocks, row stride CHUNK_TILES
      const src = def.layout(def);
      const full = new Uint8Array(this.chunkCount * CHUNK_TILES * LEVEL_ROWS);
      for (let col = 0; col < def.tiles; col++) {
        const chunk = Math.floor(col / CHUNK_TILES);
        const lx = col - chunk * CHUNK_TILES;
        for (let row = 0; row < LEVEL_ROWS; row++) {
          full[chunk * CHUNK_TILES * LEVEL_ROWS + row * CHUNK_TILES + lx] = src[row * def.tiles + col];
        }
      }
      this.authored = full;
    }
  }

  /* ------------------------------ chunks ------------------------------ */

  chunk(cx: number): Uint8Array {
    if (this.authored) {
      let view = this.authoredViews.get(cx);
      if (!view) {
        if (cx < 0 || cx >= this.chunkCount) return new Uint8Array(CHUNK_TILES * LEVEL_ROWS);
        const start = cx * CHUNK_TILES * LEVEL_ROWS;
        view = this.authored.subarray(start, start + CHUNK_TILES * LEVEL_ROWS);
        this.authoredViews.set(cx, view);
      }
      return view;
    }
    // no authored map for this def: empty chunk (the shipped Stage 1 always
    // carries an image-extracted layout; the procedural generator that used
    // to live here was stages 2-8 machinery and has been removed)
    return new Uint8Array(CHUNK_TILES * LEVEL_ROWS);
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

  destroyTile(tx: number, ty: number): boolean {
    const t = this.get(tx, ty);
    if (!isDestructible(t)) return false;
    const k = this.key(tx, ty);
    this.destroyed.add(k);
    this.destroyedAs.set(k, t);
    this.set(tx, ty, T.EMPTY);
    return true;
  }

  /** was this tile destroyed at runtime? */
  isDestroyed(tx: number, ty: number): boolean {
    return this.destroyed.has(this.key(tx, ty));
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
/* boss gate                                                            */
/* ------------------------------------------------------------------ */

export function openBossDoor(level: Level): void {
  const tx = level.def.bossStart;
  for (let r = 0; r < level.rows; r++) if (level.get(tx, r) === T.DOOR) level.set(tx, r, T.EMPTY);
  level.doorOpen = true;
}
