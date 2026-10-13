import { describe, expect, it } from 'vitest';
import { GameScene } from '../src/scenes/game';
import type { GameHost } from '../src/scenes/types';
import { defaultSave } from '../src/core/save';
import { audio } from '../src/audio/audio';
import { isBlocking, T } from '../src/level/tiles';
import { GROUND_ROW, LEVEL_ROWS, TILE } from '../src/config/constants';
import { openBossDoor } from '../src/level/level';

/** Controllable fake input implementing the small surface the scene reads. */
class FakeInput {
  heldState: Record<string, boolean> = {};
  pressedState: Record<string, boolean> = {};
  rawState: Record<string, boolean> = {};
  jumpHold = 0; // frames left to *hold* jump so the jump-cut doesn't shrink it
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

/**
 * A simple "run right, jump when blocked" bot. Holding right + a full-height
 * auto-jump (held for the ascent) is enough to clear the 2-tile plateaus,
 * 2-tile water notches and 1-tile spikes the authored maps use. Invincibility
 * (F2) isolates *terrain* completability from enemy damage: if the bot reaches
 * the boss gate, every column between spawn and the arena is traversable.
 */
function botStep(scene: GameScene, input: FakeInput): void {
  const p = scene.players[0];
  input.heldState.right = true;

  // Do NOT fire while standing on - or approaching - a Stage-1 bridge deck:
  // explosive rounds detonate on the deck and blow holes in the bot's own path
  // (faithful to the game - a careless player drowns in the river - but this
  // bot is here to prove the TERRAIN is completable, not to bomb bridges).
  const feetCol = Math.floor((p.x + p.w / 2) / TILE);
  const onBridge = scene.level.get(feetCol, Math.floor((p.y + p.h + 2) / TILE)) === T.BRIDGE;
  let bridgeNear = onBridge;
  if (!bridgeNear) {
    for (let c = feetCol + 1; c <= feetCol + 6 && c < scene.level.tilesX; c++) {
      if (scene.level.get(c, GROUND_ROW) === T.BRIDGE) { bridgeNear = true; break; }
    }
  }
  input.heldState.shoot = !bridgeNear;

  let wantJump = false;
  if (p.onGround) {
    const frontX = p.x + p.w + 2;
    const bodyY = p.y + p.h * 0.5;
    const wallTile = scene.level.get(Math.floor(frontX / TILE), Math.floor(bodyY / TILE));
    const wallAhead = isBlocking(wallTile);

    const aheadCol = Math.floor((p.x + p.w + TILE) / TILE);
    const curCol = Math.floor(p.x / TILE);
    const gAhead = scene.level.groundRow(aheadCol);
    const gCur = scene.level.groundRow(curCol);
    const pitAhead = gAhead >= LEVEL_ROWS || gAhead > gCur + 1;

    const spikeCol = Math.floor((p.x + p.w + TILE * 0.5) / TILE);
    const gSpike = scene.level.groundRow(spikeCol);
    const spikeAhead = scene.level.get(spikeCol, gSpike - 1) === T.SPIKE;

    if (wallAhead || pitAhead || spikeAhead) wantJump = true;
  }

  if (input.jumpHold > 0) {
    input.heldState.jump = true;
    input.jumpHold--;
  }
  if (wantJump) {
    input.pressedState.jump = true;
    input.heldState.jump = true;
    input.jumpHold = 14; // hold through the ~0.26s ascent for full height
  }
}

describe('Phase 4: every authored stage is traversable spawn -> boss gate', () => {
  for (let stage = 1; stage <= 8; stage++) {
    it(`stage ${stage} bot reaches the boss gate`, () => {
      const input = new FakeInput();
      const { host } = makeHost(input);
      const scene = new GameScene(host);
      scene.start({ stage, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });

      // frame 0: enable debug + invincibility so terrain traversal is isolated
      input.rawState['F1'] = true;
      input.rawState['F2'] = true;

      const ctx = makeCtx();
      let maxX = 0;
      let bossTriggered = false;
      const arenaX = scene.level.bossArenaX();

      for (let f = 0; f < 8000; f++) {
        botStep(scene, input);
        scene.update(FIXED);
        scene.draw(ctx);
        if (scene.players[0]) maxX = Math.max(maxX, scene.players[0].x);
        if (scene.boss) bossTriggered = true;
        input.clearEdges();
        if (bossTriggered) break;
      }

      expect(bossTriggered, `stage ${stage}: bot never reached the boss gate (maxX=${maxX.toFixed(0)}, arenaX=${arenaX})`).toBe(true);
      // sanity: it actually travelled a meaningful distance, not stuck at spawn
      expect(maxX).toBeGreaterThan(arenaX * 0.4);
    });
  }
});

describe('Phase 4: boss arenas are flat across all stages', () => {
  for (let stage = 1; stage <= 8; stage++) {
    it(`stage ${stage} arena floor is level and gap-free (gate open)`, () => {
      const input = new FakeInput();
      const { host } = makeHost(input);
      const scene = new GameScene(host);
      scene.start({ stage, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
      openBossDoor(scene.level); // remove the gate so only terrain is measured
      const s = scene.level.def;
      // The boss descends onto the ground and the camera locks to ONE screen
      // (bossStart .. bossStart + VIEW_W/TILE columns), so only that window is
      // the fight floor: one continuous strip with no pits. Stage 1's arena is
      // a 40-column patch levelled to row 21 (the art there is rising jungle
      // ground; a boss fight needs one flat strip), while the ravine and the
      // fortress wall sit well outside it. This checks exactly the 40-col
      // window the camera shows.
      const arenaEnd = Math.min(s.tiles, s.bossStart + 40);
      const counts = new Map<number, number>();
      for (let col = s.bossStart; col < arenaEnd; col++) {
        const r = scene.level.groundRow(col);
        counts.set(r, (counts.get(r) ?? 0) + 1);
      }
      const [floor, cover] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const width = arenaEnd - s.bossStart;
      expect(cover, `stage ${stage}: floor row ${floor} only covers ${cover}/${width}`)
        .toBeGreaterThanOrEqual(Math.floor(width * 0.7));
      // the floor is a real walkable row inside the level
      expect(floor).toBeGreaterThan(0);
      expect(floor).toBeLessThan(LEVEL_ROWS);
      // and nothing below it is ever a hole
      for (let col = s.bossStart; col < arenaEnd; col++) {
        for (let r = floor; r < LEVEL_ROWS; r++) {
          const t = scene.level.get(col, r);
          expect(t === T.EMPTY || t === T.WATER,
            `stage ${stage}: arena hole at col ${col} row ${r}`).toBe(false);
        }
      }
    });
  }
});
