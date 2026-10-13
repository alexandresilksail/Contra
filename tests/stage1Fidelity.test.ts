import { describe, expect, it, vi } from 'vitest';
import { GameScene } from '../src/scenes/game';
import type { GameHost } from '../src/scenes/types';
import { defaultSave } from '../src/core/save';
import { audio } from '../src/audio/audio';
import { Level } from '../src/level/level';
import { stageDef } from '../src/level/stages';
import { T, isBlocking, isDestructible } from '../src/level/tiles';
import { GROUND_ROW, LEVEL_ROWS } from '../src/config/constants';
import { damageEnemy } from '../src/entities/enemy';

/* ------------------------------------------------------------------ */
/* harness (same shape as tests/traversal.test.ts)                     */
/* ------------------------------------------------------------------ */

class FakeInput {
  heldState: Record<string, boolean> = {};
  pressedState: Record<string, boolean> = {};
  rawState: Record<string, boolean> = {};
  jumpHold = 0;
  held(_i: number, action: string): boolean { return !!this.heldState[action]; }
  pressed(_i: number, action: string): boolean { return !!this.pressedState[action]; }
  rawPressed(code: string): boolean { return !!this.rawState[code]; }
  update(): void {}
  postUpdate(): void {}
  clearEdges(): void { this.pressedState = {}; this.rawState = {}; }
}

function makeHost(input: FakeInput): GameHost {
  return {
    save: defaultSave(),
    input: input as any,
    audio,
    persist() {},
    startGame() {},
    goto() {},
    requestFullscreen() {},
    lastStart: null,
    canContinue() { return false; },
    continueUsed: 0,
  } as unknown as GameHost;
}

function makeCtx(): CanvasRenderingContext2D {
  return (globalThis as any).document.createElement('canvas').getContext('2d');
}

const FIXED = 1 / 60;

/* ------------------------------------------------------------------ */
/* extracted Stage-1 layout facts used below                           */
/*   bridge 1: cols 48-55, deck row 22   bridge 2: cols 66-73, deck row 22
 *   the river (WATER) fills the rows below each deck                    */
/* ------------------------------------------------------------------ */

describe('Stage 1 fidelity: lethal water (Player 下落)', () => {
  it('marks stage 1 water lethal and stages 2-8 wadeable', () => {
    expect(new Level(stageDef(1)).deadlyWater).toBe(true);
    for (let s = 2; s <= 8; s++) expect(new Level(stageDef(s)).deadlyWater).toBe(false);
  });

  it('the river under each bridge is WATER below a BRIDGE deck', () => {
    const level = new Level(stageDef(1));
    for (const col of [48, 50, 55, 66, 70, 73]) {
      expect(level.get(col, GROUND_ROW), `deck at col ${col}`).toBe(T.BRIDGE);
      expect(level.get(col, GROUND_ROW + 1), `river at col ${col}`).toBe(T.WATER);
      expect(level.get(col, LEVEL_ROWS - 1), `river floor at col ${col}`).toBe(T.WATER);
    }
    // the walking ground on both sides is untouched
    expect(level.get(47, GROUND_ROW)).toBe(T.SOLID);
    expect(level.get(56, GROUND_ROW)).toBe(T.SOLID);
    expect(level.get(74, GROUND_ROW)).toBe(T.SOLID);
  });

  it('a player who falls in the river drowns on contact', () => {
    const input = new FakeInput();
    const scene = new GameScene(makeHost(input));
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const p = scene.players[0];
    // drop the player into the river under bridge 1 (col 50)
    p.place(50 * 16, 25 * 16);
    p.invuln = 0; // skip the spawn-invulnerability window (place() resets it)
    expect(scene.level.waterAt(p.x + p.w / 2, p.y + p.h / 2)).toBe(true);
    scene.update(FIXED);
    expect(p.state).toBe('dying');
    expect(p.deathCause).toBe('water');
  });

  it('walking on the bridge deck does not drown', () => {
    const input = new FakeInput();
    const scene = new GameScene(makeHost(input));
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const p = scene.players[0];
    p.place(50 * 16, GROUND_ROW * 16 - p.h); // standing on the deck
    for (let f = 0; f < 30; f++) scene.update(FIXED);
    expect(p.state).toBe('alive');
  });
});

describe('Stage 1 fidelity: bridge destruction (桥梁爆炸)', () => {
  it('BRIDGE blocks movement but is destructible', () => {
    expect(isBlocking(T.BRIDGE)).toBe(true);
    expect(isDestructible(T.BRIDGE)).toBe(true);
    // plain SOLID ground is NOT destructible
    expect(isDestructible(T.SOLID)).toBe(false);
  });

  it('an explosion opens exactly ONE plank hole in the deck', () => {
    const input = new FakeInput();
    const scene = new GameScene(makeHost(input));
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const level = scene.level;
    expect(level.get(50, GROUND_ROW)).toBe(T.BRIDGE);
    // detonate on the deck at col 50
    scene.world.explode(50 * 16 + 8, GROUND_ROW * 16, 34, 10);
    expect(level.get(50, GROUND_ROW), 'the hit plank is gone').toBe(T.EMPTY);
    expect(level.get(49, GROUND_ROW), 'left plank survives').toBe(T.BRIDGE);
    expect(level.get(51, GROUND_ROW), 'right plank survives').toBe(T.BRIDGE);
    // the river below is still there (a fall-in drowns)
    expect(level.get(50, GROUND_ROW + 1)).toBe(T.WATER);
  });

  it('a hole in the deck is a 1-tile pit the player can jump', () => {
    const input = new FakeInput();
    const scene = new GameScene(makeHost(input));
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const level = scene.level;
    level.destroyTile(50, GROUND_ROW);
    // groundRow() must report the destroyed column as a gap so AI/bots jump it
    expect(level.groundRow(50)).toBe(LEVEL_ROWS);
    expect(level.groundRow(49)).toBe(GROUND_ROW);
  });

  it('dying enemies fall THROUGH the bridge deck (ripper note on the map sheet)', () => {
    const input = new FakeInput();
    const scene = new GameScene(makeHost(input));
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const e = scene.spawnEnemy('grunt', 50 * 16, GROUND_ROW * 16 - 22)!;
    expect(e).toBeTruthy();
    expect(scene.level.get(50, GROUND_ROW)).toBe(T.BRIDGE);
    e.spawnGrace = 0; // skip the drop-in protection
    damageEnemy(e, 999, scene.world, e.x); // lethal
    expect(e.state).toBe('death');
    for (let f = 0; f < 40; f++) scene.update(FIXED);
    // it dropped below the deck instead of lying on it
    expect(e.y).toBeGreaterThan(GROUND_ROW * 16 + 8);
  });
});

describe('Stage 1 fidelity: distinct boss music (音乐)', () => {
  it('stage 1 defines a boss track and switches to it at the boss gate', () => {
    const spy = vi.spyOn(audio, 'playTrack').mockImplementation(() => {});
    try {
      const input = new FakeInput();
      const scene = new GameScene(makeHost(input));
      scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
      expect(scene.def.bossMusic).toBe(8); // the original boss-battle theme
      expect(scene.def.music).toBe(0);
      // walk into the boss gate trigger zone
      scene.players[0].place(1500, 300);
      for (let f = 0; f < 5 && !scene.boss; f++) scene.update(FIXED);
      expect(scene.boss).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(8); // boss track, not the stage track
    } finally {
      spy.mockRestore();
    }
  });
});
