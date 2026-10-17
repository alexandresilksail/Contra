import { describe, expect, it } from 'vitest';
import { GameScene } from '../src/scenes/game';
import type { GameHost } from '../src/scenes/types';
import { defaultSave } from '../src/core/save';
import { audio } from '../src/audio/audio';
import { ENEMY_DEFS } from '../src/entities/enemy';
import { STAGE_COUNT } from '../src/level/stages';

/** Controllable fake input implementing the small surface the scene reads. */
class FakeInput {
  heldState: Record<string, boolean> = {};
  pressedState: Record<string, boolean> = {};
  rawState: Record<string, boolean> = {};
  held(_i: number, action: string): boolean {
    return !!this.heldState[action];
  }
  pressed(_i: number, action: string): boolean {
    return !!this.pressedState[action];
  }
  rawPressed(code: string): boolean {
    return !!this.rawState[code];
  }
  update(): void {}
  postUpdate(): void {}
  clearEdges(): void {
    this.pressedState = {};
    this.rawState = {};
  }
}

function makeCtx(): CanvasRenderingContext2D {
  return (globalThis as any).document.createElement('canvas').getContext('2d');
}

function makeHost(input: FakeInput): { host: GameHost; log: string[] } {
  const log: string[] = [];
  const host: GameHost = {
    save: defaultSave(),
    input: input as any,
    audio,
    persist() {},
    startGame() {},
    goto(s) {
      log.push(String(s));
    },
    requestFullscreen() {},
    lastStart: null,
    canContinue() {
      return false;
    },
    continueUsed: 0,
  };
  return { host, log };
}

const FIXED = 1 / 60;

describe('integration: every stage boots, spawns enemies and a boss, renders', () => {
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    it(`stage ${stage} runs enemy + boss simulation without throwing`, () => {
      const input = new FakeInput();
      const { host } = makeHost(input);
      const scene = new GameScene(host);
      scene.start({ stage, chars: ['razor', 'titan'], twoPlayer: true, continueUsed: 0 });

      // invincible so players never die, and fire continuously
      input.rawState['F2'] = true;
      input.heldState.right = true;
      input.heldState.shoot = true;

      const ctx = makeCtx();

      // spawn a variety of enemies across the screen
      const kinds = Object.keys(ENEMY_DEFS);
      for (let i = 0; i < kinds.length; i++) {
        scene.spawnEnemy(kinds[i], 80 + (i % 10) * 50, 50 + Math.floor(i / 10) * 40, -1);
      }
      let sawEnemies = 0;

      // spawn the stage's boss directly via the debug-on + boss trigger path
      input.rawState['F1'] = true; // enable debug so F5 works
      input.rawState['F5'] = true; // boss-test teleport -> triggers boss

      for (let f = 0; f < 300; f++) {
        scene.update(FIXED);
        scene.draw(ctx);
        sawEnemies = Math.max(sawEnemies, scene.enemyPool.count);
        input.clearEdges(); // F1/F5/F2 edges only on frame 0; held states persist
      }

      expect(sawEnemies).toBeGreaterThan(0); // enemies were spawned & simulated
      expect(scene.boss).not.toBeNull(); // the stage boss was created
    });
  }
});

describe('integration: full boss kill and stage clear', () => {
  it('reaches the boss, defeats it, and clears stage 1', () => {
    const input = new FakeInput();
    const { host, log } = makeHost(input);
    const scene = new GameScene(host);
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });

    const ctx = makeCtx();
    // frame 0: debug on + invincible + teleport to boss arena + fire straight up
    input.rawState['F1'] = true;
    input.rawState['F2'] = true;
    input.rawState['F5'] = true;
    input.heldState.up = true; // aim straight up into the floating boss
    input.heldState.shoot = true;

    let bossTriggered = false;
    let bossDefeated = false;
    let cleared = false;
    for (let f = 0; f < 5000; f++) {
      scene.update(FIXED);
      scene.draw(ctx);
      if (scene.boss) bossTriggered = true;
      // keep the player pinned beneath the boss so vertical shots land on its body
      if (scene.boss) {
        const p = scene.players[0];
        p.x = scene.boss.x + scene.boss.w / 2 - p.w / 2;
      }
      if (scene.boss && scene.boss.state === 'dead') bossDefeated = true;
      if (scene.phase === 'clear') cleared = true;
      input.clearEdges(); // edges only on frame 0
      if (log.includes('stageclear') || cleared) break;
    }

    expect(bossTriggered).toBe(true);
    expect(bossDefeated).toBe(true);
    expect(cleared || log.includes('stageclear')).toBe(true);
  });

  it('debug skip stage (F4) advances straight to stage clear', () => {
    const input = new FakeInput();
    const { host, log } = makeHost(input);
    const scene = new GameScene(host);
    scene.start({ stage: 1, chars: ['titan', 'razor'], twoPlayer: true, continueUsed: 0 });

    const ctx = makeCtx();
    input.rawState['F1'] = true; // enable debug so F4 works
    input.rawState['F4'] = true; // skip stage before boss
    scene.update(FIXED);
    input.clearEdges();
    let cleared = false;
    for (let f = 0; f < 400; f++) {
      scene.update(FIXED);
      scene.draw(ctx);
      if (scene.phase === 'clear') cleared = true;
      if (log.includes('stageclear')) break;
    }
    expect(cleared || log.includes('stageclear')).toBe(true);
  });
});
