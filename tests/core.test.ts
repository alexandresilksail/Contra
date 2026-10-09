import { describe, expect, it } from 'vitest';
import { clamp, makeRng, rngFrom, hash32, aabb } from '../src/core/math';
import { Pool } from '../src/core/pool';
import { Save } from '../src/core/save';
import { DEFAULT_KEYS } from '../src/core/input';

describe('math helpers', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('aabb overlaps correctly', () => {
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('rng is deterministic and in range', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(makeRng(43)()).not.toBe(makeRng(42)());
  });

  it('rng helpers respect bounds', () => {
    const r = rngFrom(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
  });

  it('hash32 is stable', () => {
    expect(hash32(1)).toBe(hash32(1));
    expect(hash32(1)).not.toBe(hash32(2));
  });
});

describe('object pool', () => {
  it('recycles objects instead of allocating', () => {
    let created = 0;
    const pool = new Pool<{ v: number }>(
      () => {
        created++;
        return { v: 0 };
      },
      (o) => {
        o.v = 1;
      },
      2,
    );
    expect(created).toBe(2);
    const a = pool.spawn();
    expect(a.v).toBe(1);
    pool.sweep(() => true);
    expect(pool.count).toBe(0);
    const b = pool.spawn();
    expect(created).toBe(2); // reused from free list
    expect(b).toBe(a);
  });

  it('keeps alive objects during sweep', () => {
    const pool = new Pool<{ dead: boolean }>(
      () => ({ dead: false }),
      (o) => {
        o.dead = false;
      },
    );
    pool.spawn();
    const second = pool.spawn();
    second.dead = false;
    pool.spawn().dead = true;
    pool.sweep((o) => o.dead);
    expect(pool.count).toBe(2);
  });
});

describe('save data', () => {
  it('round-trips through the store', () => {
    const data = Save.load();
    data.highScore = 12345;
    data.maxStageUnlocked = 4;
    Save.save(data);
    const back = Save.load();
    expect(back.highScore).toBe(12345);
    expect(back.maxStageUnlocked).toBe(4);
    Save.reset();
  });

  it('sanitizes corrupted values', () => {
    const data = Save.load();
    data.maxStageUnlocked = 99;
    data.highScore = -5;
    Save.save({ ...data, maxStageUnlocked: 99, highScore: -5 } as never);
    const back = Save.load();
    expect(back.maxStageUnlocked).toBeLessThanOrEqual(8);
    expect(back.highScore).toBeGreaterThanOrEqual(0);
    Save.reset();
  });

  it('exposes default key bindings for both players', () => {
    expect(DEFAULT_KEYS[0].shoot).toContain('KeyJ');
    expect(DEFAULT_KEYS[1].shoot).toContain('Digit0');
    expect(DEFAULT_KEYS[0].jump).toContain('KeyW');
    expect(DEFAULT_KEYS[1].jump).toContain('Digit1');
  });
});
