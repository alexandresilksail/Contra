import { describe, expect, it } from 'vitest';
import { bgOriginX, bgOriginY, bgScrollFactors, bgShiftForCamera } from '../src/gfx/bgLayer';
import type { BgLayer } from '../src/gfx/sprites';
import { GROUND_ROW, TILE } from '../src/config/constants';

/** The Stage-1 map image is 3456x245; the bottom 5 rows are a white border. */
const MAP_IMG_W = 3456;
const MAP_IMG_H = 240;

function layer(o: Partial<BgLayer> & { speed: number }): BgLayer {
  return {
    sprite: { width: o.sprite?.width ?? MAP_IMG_W } as any,
    speed: o.speed,
    repeat: o.repeat ?? true,
    y: o.y ?? 0,
    lock: o.lock,
  };
}

describe('stage map image must stay locked to world coordinates', () => {
  it('a locked layer scrolls 1:1 on both axes', () => {
    const l = layer({ speed: 0.5, lock: true });
    const f = bgScrollFactors(l);
    expect(f.sx).toBe(1);
    expect(f.sy).toBe(1);
    // moving the camera 200 world px must move the picture exactly 200 px
    expect(bgShiftForCamera(l, 200)).toBe(200);
  });

  it('an unlocked layer keeps its parallax factor (unchanged behaviour)', () => {
    const l = layer({ speed: 0.5 });
    const f = bgScrollFactors(l);
    expect(f.sx).toBe(0.5);
    expect(f.sy).toBe(0.125);
    expect(bgShiftForCamera(l, 200)).toBe(100);
  });

  it('locked horizontal origin tracks the camera exactly', () => {
    const l = layer({ speed: 1, lock: true });
    for (const cam of [0, 37, 200, 1500, MAP_IMG_W - 10, MAP_IMG_W + 250]) {
      const base = bgOriginX(l, 0);
      const moved = bgOriginX(l, cam);
      // shift is exact modulo the image width (the strip repeats)
      const delta = ((base - moved) % MAP_IMG_W + MAP_IMG_W) % MAP_IMG_W;
      expect(delta).toBe(cam % MAP_IMG_W);
      expect(moved).toBeLessThanOrEqual(0);
      expect(moved).toBeGreaterThan(-MAP_IMG_W);
    }
  });

  it('locked vertical origin tracks the camera exactly', () => {
    const l = layer({ speed: 1, lock: true, y: 112 });
    expect(bgOriginY(l, 0)).toBe(112);
    expect(bgOriginY(l, 40)).toBe(72);
    expect(bgOriginY(l, 120)).toBe(-8);
  });

  it('the map image bottom edge lands exactly on the ground surface line', () => {
    // worldY chosen by packStage1Bg(): image row 0 goes here, so the strip's
    // bottom edge == the top of the ground row == where the player stands.
    const worldY = GROUND_ROW * TILE - MAP_IMG_H;
    expect(worldY).toBe(112);
    expect(worldY + MAP_IMG_H).toBe(GROUND_ROW * TILE);
    expect(GROUND_ROW * TILE).toBe(352);
  });
});
