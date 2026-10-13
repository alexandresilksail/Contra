import { describe, expect, it } from 'vitest';
import { bgOriginX, bgOriginY, bgScrollFactors, bgShiftForCamera } from '../src/gfx/bgLayer';
import type { BgLayer } from '../src/gfx/sprites';
import { GROUND_ROW, TILE } from '../src/config/constants';
import {
  S1_BRIDGE_RUNS,
  S1_GROUND_RUNS,
  S1_IMG_TO_WORLD,
  S1_PIT_RUNS,
  S1_WALL_RUNS,
} from '../src/level/stage1ImageData';

/**
 * Geometry of the uploaded Stage-1 map image (public/sprites/stage1bg.png).
 * The level art itself is rows 8..223; rows 0..7 are a black margin and rows
 * 224..244 carry the ripper watermark. Only the content band is ever drawn.
 */
const MAP_IMG_W = 3456;
const MAP_IMG_Y0 = 8;
const MAP_IMG_Y1 = 224;
/** world y of image row 0; measured so the walkable grass line (img y~99) sits
 *  exactly on GROUND_ROW*TILE (see tools/stage1_extract.py). */
const MAP_IMG_TO_WORLD = 253;
/** world y the renderer places the (cropped) strip at. */
const MAP_WORLD_Y = MAP_IMG_TO_WORLD + MAP_IMG_Y0;

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
    const l = layer({ speed: 1, lock: true, y: MAP_WORLD_Y });
    expect(bgOriginY(l, 0)).toBe(MAP_WORLD_Y);
    expect(bgOriginY(l, 40)).toBe(MAP_WORLD_Y - 40);
    expect(bgOriginY(l, 120)).toBe(MAP_WORLD_Y - 120);
  });

  it('the walkable grass line of the art lands on the ground row', () => {
    // packStage1Bg() crops rows 8..224 and places that strip at MAP_WORLD_Y, so
    // image row y is drawn at world y + MAP_IMG_TO_WORLD. The measured grass
    // line (img y ~= 99) must therefore map onto GROUND_ROW*TILE.
    const GRASS_IMG_Y = 99;
    expect(GRASS_IMG_Y + MAP_IMG_TO_WORLD).toBe(GROUND_ROW * TILE);
    expect(GROUND_ROW * TILE).toBe(352);
    // the strip covers world rows 16..29 - never the watermark band
    expect(MAP_IMG_Y1 + MAP_IMG_TO_WORLD).toBeLessThanOrEqual(30 * TILE);
    expect(MAP_IMG_Y0 + MAP_IMG_TO_WORLD).toBeGreaterThan(15 * TILE);
  });

  it('every extracted ground surface row is a real tile row', () => {
    for (const [from, to, row] of S1_GROUND_RUNS) {
      expect(row).toBeGreaterThan(0);
      expect(row).toBeLessThan(30);
      expect(to).toBeGreaterThanOrEqual(from);
      // the image is 216 columns wide; no run may run past it
      expect(to).toBeLessThan(216);
    }
    // the spawn corridor is present
    const spawn = S1_GROUND_RUNS.find(([f, t]) => f <= 2 && t >= 2);
    expect(spawn).toBeDefined();
    // the two river bridges from the art are decks at grade
    expect(S1_BRIDGE_RUNS.length).toBe(2);
    for (const [from, , row] of S1_BRIDGE_RUNS) {
      expect([48, 66]).toContain(from);
      expect(row).toBe(GROUND_ROW);
    }
    // the fortress wall closes the right end of the level
    expect(S1_WALL_RUNS.length).toBe(1);
    expect(S1_WALL_RUNS[0][1]).toBe(215);
    // the ravine chasms are kept as lethal pits, and ALL of them sit to the
    // RIGHT of the boss arena [bossStart(100), bossStart+40) = [100, 139], so
    // the fight happens on natural jungle and the player never crosses them
    expect(S1_PIT_RUNS.length).toBeGreaterThan(0);
    for (const [from, to] of S1_PIT_RUNS) expect(from).toBeGreaterThanOrEqual(140);
  });
});
