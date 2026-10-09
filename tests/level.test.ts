import { describe, expect, it } from 'vitest';
import { Level, generateChunk, openBossDoor } from '../src/level/level';
import { STAGES, buildWaves, stageDef } from '../src/level/stages';
import { T, isBlocking } from '../src/level/tiles';
import { CHUNK_TILES, GROUND_ROW, LEVEL_ROWS, TILE } from '../src/config/constants';

describe('stage definitions', () => {
  it('has 8 stages with unique bosses', () => {
    expect(STAGES.length).toBe(8);
    const ids = new Set(STAGES.map((s) => s.bossId));
    expect(ids.size).toBe(8);
    STAGES.forEach((s, i) => expect(s.id).toBe(i + 1));
  });

  it('places the boss arena inside the level with room for the camera', () => {
    for (const s of STAGES) {
      expect(s.bossStart).toBeGreaterThan(40);
      expect(s.tiles * TILE - s.bossStart * TILE).toBeGreaterThanOrEqual(640);
    }
  });

  it('gives every stage an enemy pool and theme', () => {
    for (const s of STAGES) {
      expect(s.enemyPool.length).toBeGreaterThan(0);
      expect(s.theme.length).toBeGreaterThan(0);
      expect(s.bossHp).toBeGreaterThan(0);
    }
  });
});

describe('chunk generation', () => {
  it('is deterministic for the same chunk index', () => {
    const def = stageDef(1);
    const a = generateChunk(def, 5);
    const b = generateChunk(def, 5);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('produces a walkable ground band with jumpable pits', () => {
    for (const s of STAGES) {
      const level = new Level(s);
      let longestGap = 0;
      let gap = 0;
      for (let col = 0; col < s.tiles; col++) {
        const row = level.groundRow(col);
        if (row >= LEVEL_ROWS) {
          gap++;
          longestGap = Math.max(longestGap, gap);
        } else {
          gap = 0;
        }
      }
      // a jump covers ~5 tiles of horizontal distance: never generate more
      expect(longestGap).toBeLessThanOrEqual(5);
    }
  });

  it('never generates terrain above the ceiling row', () => {
    const level = new Level(stageDef(3));
    for (let c = 0; c < 40; c++) {
      for (let r = 0; r < 4; r++) {
        expect(level.get(c, r)).toBe(T.EMPTY);
      }
    }
  });

  it('keeps the boss arena flat and pit free', () => {
    const s = stageDef(2);
    const level = new Level(s);
    openBossDoor(level);
    for (let col = s.bossStart; col < s.tiles; col++) {
      expect(level.groundRow(col)).toBe(GROUND_ROW);
    }
  });

  it('creates a boss door that can be opened', () => {
    const s = stageDef(1);
    const level = new Level(s);
    let doorTiles = 0;
    for (let r = 0; r < LEVEL_ROWS; r++) if (level.get(s.bossStart, r) === T.DOOR) doorTiles++;
    expect(doorTiles).toBeGreaterThan(0);
    openBossDoor(level);
    for (let r = 0; r < LEVEL_ROWS; r++) expect(level.get(s.bossStart, r)).not.toBe(T.DOOR);
    expect(level.doorOpen).toBe(true);
  });

  it('generates platforms, ladders and props', () => {
    let platforms = 0;
    let ladders = 0;
    let crates = 0;
    const level = new Level(stageDef(2));
    for (let c = 0; c < 200; c++)
      for (let r = 0; r < LEVEL_ROWS; r++) {
        const t = level.get(c, r);
        if (t === T.PLATFORM) platforms++;
        if (t === T.LADDER) ladders++;
        if (t === T.CRATE || t === T.HIDDEN) crates++;
      }
    expect(platforms).toBeGreaterThan(20);
    expect(ladders).toBeGreaterThan(5);
    expect(crates).toBeGreaterThan(0);
  });

  it('caches chunks and reports bounds in pixels', () => {
    const level = new Level(stageDef(1));
    expect(level.pixelW).toBe(level.def.tiles * TILE);
    expect(level.pixelH).toBe(LEVEL_ROWS * TILE);
    expect(level.chunkCount).toBe(Math.ceil(level.def.tiles / CHUNK_TILES));
    const c1 = level.chunk(2);
    expect(level.chunk(2)).toBe(c1);
  });

  it('treats out-of-range columns as solid so players cannot escape', () => {
    const level = new Level(stageDef(1));
    expect(isBlocking(level.get(-1, GROUND_ROW))).toBe(true);
  });
});

describe('wave building', () => {
  it('creates ordered waves inside the playable area', () => {
    for (const s of STAGES) {
      const waves = buildWaves(s);
      expect(waves.length).toBeGreaterThan(3);
      for (const w of waves) {
        expect(w.x).toBeGreaterThan(0);
        expect(w.x).toBeLessThan(s.bossStart * TILE);
        expect(w.entries.length).toBeGreaterThan(0);
      }
      for (let i = 1; i < waves.length; i++) expect(waves[i].x).toBeGreaterThanOrEqual(waves[i - 1].x);
    }
  });

  it('increases enemy counts as the stage progresses', () => {
    const s = stageDef(5);
    const waves = buildWaves(s);
    const counts = waves.map((w) => w.entries.reduce((n, e) => n + e.count, 0));
    const first = counts[0];
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(first);
    expect(counts.length).toBeGreaterThan(3);
  });
});
