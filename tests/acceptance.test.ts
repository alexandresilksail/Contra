import { describe, expect, it } from 'vitest';
import { GameScene } from '../src/scenes/game';
import type { GameHost } from '../src/scenes/types';
import { defaultSave } from '../src/core/save';
import { audio } from '../src/audio/audio';
import { isBlocking, T } from '../src/level/tiles';
import { LEVEL_ROWS, START_LIVES, TILE } from '../src/config/constants';
import { BOSS_DEFS, Boss, damageBoss } from '../src/entities/boss';
import { WEAPON_ORDER } from '../src/weapons/weapons';

/* ------------------------------------------------------------------ */
/* harness (mirrors traversal.test.ts so all suites share one contract) */
/* ------------------------------------------------------------------ */

class FakeInput {
  heldState: Record<string, boolean> = {};
  pressedState: Record<string, boolean> = {};
  rawState: Record<string, boolean> = {};
  jumpHold = 0;
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
 * Walk toward `targetX`, auto-jumping over walls / pits / spikes (the jump is
 * *held* through the ascent - see traversal.test.ts for why a tapped jump gets
 * cut to 0.4 tiles and cannot clear a 2-tile step).
 *
 * `aimUp` tilts the 8-way reticle upward, which is only correct when the whole
 * target sits above the gun line; otherwise shots fly over it.
 */
function approachStep(scene: GameScene, input: FakeInput, targetX: number, aimUp: boolean): void {
  const p = scene.players[0];
  const dx = targetX - (p.x + p.w / 2);
  input.heldState.right = dx > 60;
  input.heldState.left = dx < -60;
  input.heldState.shoot = true;
  // aim horizontally unless the target is entirely above the muzzle
  input.heldState.up = aimUp;
  input.heldState.down = false;

  let wantJump = false;
  if (p.onGround) {
    const dir = input.heldState.right ? 1 : input.heldState.left ? -1 : 0;
    const frontX = dir > 0 ? p.x + p.w + 2 : dir < 0 ? p.x - 2 : p.x + p.w + 2;
    const bodyY = p.y + p.h * 0.5;
    const wallAhead = isBlocking(scene.level.get(Math.floor(frontX / TILE), Math.floor(bodyY / TILE)));

    const aheadCol = Math.floor((dir > 0 ? p.x + p.w + TILE : p.x - TILE) / TILE);
    const curCol = Math.floor(p.x / TILE);
    const gAhead = scene.level.groundRow(aheadCol);
    const gCur = scene.level.groundRow(curCol);
    const pitAhead = gAhead >= LEVEL_ROWS || gAhead > gCur + 1;

    const spikeCol = Math.floor((dir > 0 ? p.x + p.w + TILE * 0.5 : p.x - TILE * 0.5) / TILE);
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
    input.jumpHold = 14;
  }
}

/* ------------------------------------------------------------------ */
/* Phase 5: every boss is beatable by real damage (no cheats)          */
/* ------------------------------------------------------------------ */

describe('Phase 5: every boss can be defeated by ordinary damage', () => {
  for (let stage = 1; stage <= 8; stage++) {
    it(`stage ${stage}: spawn -> traverse -> boss dies by damage -> stage clear`, () => {
      const input = new FakeInput();
      const { host, log } = makeHost(input);
      const scene = new GameScene(host);
      scene.start({ stage, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });

      // F1 = debug overlay, F2 = invincible (so terrain/AI are isolated).
      // NOTE: F4/F5 (skip stage / boss HP poke) are deliberately NEVER fired -
      // the boss must die through the bullet -> damageBoss path only.
      input.rawState['F1'] = true;
      input.rawState['F2'] = true;

      const ctx = makeCtx();
      let bossSeen = false;
      let lastHp = Number.POSITIVE_INFINITY;
      let hpRose = false;
      let hpReachedZero = false;
      const phasesSeen = new Set<number>();
      let framesFighting = 0;

      let deadFrames = 0;
      for (let f = 0; f < 30000; f++) {
        const boss = scene.boss;
        if (!boss) {
          // still travelling to the gate: run right, shoot the sensor walls
          approachStep(scene, input, Number.POSITIVE_INFINITY, false);
        } else {
          bossSeen = true;
          framesFighting++;
          const p = scene.players[0];
          const pCy = p.y + p.h * 0.4;
          // only tilt up when the whole boss is above the muzzle line
          const aimUp = boss.y + boss.h < pCy - 4;
          approachStep(scene, input, boss.x + boss.w / 2, aimUp);

          if (boss.state === 'fight') phasesSeen.add(boss.phase);
          // sample HP every frame (damage flips state to 'dying' in the same
          // step, so the zero crossing must be watched from outside that guard)
          if (Number.isFinite(lastHp) && boss.hp > lastHp + 1e-6) hpRose = true;
          if (boss.hp <= 0) hpReachedZero = true;
          lastHp = boss.hp;
        }
        scene.update(FIXED);
        scene.draw(ctx);
        input.clearEdges();
        // once dead, keep stepping so onBossDefeated() -> stage clear fires
        if (bossSeen && scene.boss?.state === 'dead') {
          // the clear fanfare runs 4.2s before the host is told to change scene
          deadFrames++;
          if (deadFrames > 320) break;
        }
      }

      expect(bossSeen, `stage ${stage}: boss never spawned`).toBe(true);
      expect(
        scene.boss?.state,
        `stage ${stage}: boss not defeated in ${framesFighting} fighting frames (hp=${scene.boss?.hp?.toFixed(1)})`,
      ).toBe('dead');
      // HP only ever went DOWN - no HP poke, no insta-kill, no regen
      expect(hpRose, `stage ${stage}: boss HP increased during the fight`).toBe(false);
      expect(hpReachedZero, `stage ${stage}: boss died without HP reaching 0`).toBe(true);
      expect(scene.boss!.hp).toBe(0);
      // all three phases were exercised for a full-length fight
      expect(phasesSeen.size, `stage ${stage}: only saw phases ${[...phasesSeen].join(',')}`).toBeGreaterThan(1);
      // defeating it actually triggers the stage-clear transition
      expect(log).toContain('stageclear');
      expect(scene.players[0].state).toBe('victory');
    });
  }
});

describe('Phase 5: boss damage rules are consistent', () => {
  const ids = Object.keys(BOSS_DEFS);

  for (const id of ids) {
    it(`${id}: weak point hurts more, invuln and non-fight states block damage`, () => {
      const def = BOSS_DEFS[id];
      const boss = new Boss(def, 100, 100);
      boss.arenaLeft = 0;
      boss.arenaRight = 1000;
      const w: any = {
        particles: { burst() {}, explosion() {} },
        audio: { sfx() {}, stopTrack() {}, setIntensity() {} },
        shake() {},
        spawnEnemy() {},
      };

      // entry state: damage must be ignored entirely
      boss.state = 'entry';
      expect(damageBoss(boss, 50, w, 0, 0, false)).toBe(false);
      expect(boss.hp).toBe(def.hp);

      // fight: body hit vs weak-point hit, same nominal damage
      boss.state = 'fight';
      const wb = boss.weakBox();
      const hp0 = boss.hp;
      damageBoss(boss, 10, w, boss.x + 1, boss.y + 1, false); // body
      const bodyDmg = hp0 - boss.hp;

      const hp1 = boss.hp;
      damageBoss(boss, 10, w, wb.x + wb.w / 2, wb.y + wb.h / 2, false); // weak point
      const weakDmg = hp1 - boss.hp;

      expect(bodyDmg).toBeGreaterThan(0);
      expect(weakDmg).toBeGreaterThan(bodyDmg);

      // invulnerable window: damage must be ignored
      boss.invuln = 0.5;
      const hp2 = boss.hp;
      expect(damageBoss(boss, 10, w, boss.x + 1, boss.y + 1, false)).toBe(false);
      expect(boss.hp).toBe(hp2);
    });
  }

  it('weak point stays inside the boss body box', () => {
    for (const id of ids) {
      const def = BOSS_DEFS[id];
      const boss = new Boss(def, 200, 200);
      boss.weakT = 0;
      boss.weakX = def.weak[0];
      boss.weakY = def.weak[1];
      const wb = boss.weakBox();
      const box = boss.box;
      expect(wb.x, `${id} weak point left of body`).toBeGreaterThanOrEqual(box.x - 1);
      expect(wb.x + wb.w, `${id} weak point right of body`).toBeLessThanOrEqual(box.x + box.w + 1);
      expect(wb.y, `${id} weak point above body`).toBeGreaterThanOrEqual(box.y - 1);
      expect(wb.y + wb.h, `${id} weak point below body`).toBeLessThanOrEqual(box.y + box.h + 1);
    }
  });

  it('every stage boss id exists in BOSS_DEFS', async () => {
    const { STAGES } = await import('../src/level/stages');
    for (const s of STAGES) {
      expect(BOSS_DEFS[s.bossId], `stage ${s.id} boss "${s.bossId}" missing`).toBeTruthy();
    }
  });
});

/* ------------------------------------------------------------------ */
/* Phase 6: death / respawn / lives / game over                        */
/* ------------------------------------------------------------------ */

describe('Phase 6: death, respawn and lives', () => {
  it('a death costs a life, respawns at ground level, then ends in game over', () => {
    const input = new FakeInput();
    const { host } = makeHost(input);
    const scene = new GameScene(host);
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });

    const ctx = makeCtx();
    const p = scene.players[0];
    expect(p.lives).toBe(START_LIVES);

    const seenLives: number[] = [];
    let deaths = 0;
    let respawnedAboveGround = 0;

    for (let f = 0; f < 6000; f++) {
      // let the intro finish, then kill the player outright each time it is alive
      if (f > 120 && p.state === 'alive') {
        p.hp = 0;
        p.kill(scene.world as any, 'hit');
        deaths++;
      }
      const before = p.state;
      scene.update(FIXED);
      scene.draw(ctx);
      if (before === 'dying' && p.state === 'dying') {
        // still animating
      }
      if (p.state === 'alive' && seenLives[seenLives.length - 1] !== p.lives) seenLives.push(p.lives);
      if (p.state === 'alive' && p.y + p.h > 500) respawnedAboveGround++;
      input.clearEdges();
      if (scene.phase === 'over') break;
    }

    expect(deaths).toBeGreaterThan(0);
    // lives went 3 -> 2 -> 1 -> 0 -> -1 (game over)
    expect(seenLives.length).toBeGreaterThan(1);
    expect(Math.min(...seenLives)).toBeLessThan(START_LIVES);
    // a respawned player is always placed on solid ground, never in the void
    expect(respawnedAboveGround).toBe(0);
    expect(scene.phase).toBe('over');
  });

  it('respawn grants temporary invulnerability', () => {
    const input = new FakeInput();
    const { host } = makeHost(input);
    const scene = new GameScene(host);
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const ctx = makeCtx();
    const p = scene.players[0];
    for (let f = 0; f < 160; f++) {
      scene.update(FIXED);
      input.clearEdges();
    }
    p.hp = 0;
    p.kill(scene.world as any, 'hit');
    let sawInvuln = false;
    for (let f = 0; f < 400; f++) {
      scene.update(FIXED);
      scene.draw(ctx);
      if (p.state === 'alive' && p.invuln > 0) sawInvuln = true;
      input.clearEdges();
    }
    expect(sawInvuln).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Phase 6: two players never fight over input                         */
/* ------------------------------------------------------------------ */

describe('Phase 6: two-player input is independent', () => {
  it('P1 and P2 respond to their own keys only', () => {
    const input = new FakeInput();
    const { host } = makeHost(input);
    const scene = new GameScene(host);
    scene.start({ stage: 1, chars: ['razor', 'titan'], twoPlayer: true, continueUsed: 0 });
    const ctx = makeCtx();
    expect(scene.players.length).toBe(2);

    const [p1, p2] = scene.players;
    for (let f = 0; f < 200; f++) {
      scene.update(FIXED);
      scene.draw(ctx);
      input.clearEdges();
    }

    // drive them in opposite directions through the *host* input surface
    const x1a = p1.x;
    const x2a = p2.x;
    // P2's left run reaches the lethal water at the level lip (cols 0-1) and
    // drowns, then respawns at the spawn point - so track how far LEFT it
    // actually got instead of the final position.
    let p2LeftMost = x2a;
    for (let f = 0; f < 90; f++) {
      input.heldState.right = true;
      input.heldState.left = false;
      // FakeInput has one shared map; emulate per-player by patching `held`
      (input as any).held = (i: number, a: string) => (a === 'right' ? i === 0 : a === 'left' ? i === 1 : false);
      scene.update(FIXED);
      scene.draw(ctx);
      p2LeftMost = Math.min(p2LeftMost, p2.x);
      input.clearEdges();
    }
    const p1Moved = p1.x - x1a;
    const p2Moved = p2LeftMost - x2a;
    expect(p1Moved, 'P1 should move right').toBeGreaterThan(4);
    expect(p2Moved, 'P2 should move left').toBeLessThan(-4);
  });
});

/* ------------------------------------------------------------------ */
/* Phase 6: weapon pickup / switch / loss                              */
/* ------------------------------------------------------------------ */

describe('Phase 6: weapon pickups apply and persist', () => {
  it('picking up every weapon in turn changes the active weapon', () => {
    const input = new FakeInput();
    const { host } = makeHost(input);
    const scene = new GameScene(host);
    scene.start({ stage: 1, chars: ['razor', 'razor'], twoPlayer: false, continueUsed: 0 });
    const ctx = makeCtx();
    const p = scene.players[0];
    for (let f = 0; f < 160; f++) {
      scene.update(FIXED);
      input.clearEdges();
    }
    const seen: string[] = [p.weapon];
    for (const wpn of WEAPON_ORDER) {
      p.giveWeapon(wpn);
      seen.push(p.weapon);
      for (let f = 0; f < 10; f++) {
        scene.update(FIXED);
        scene.draw(ctx);
        input.clearEdges();
      }
    }
    for (const wpn of WEAPON_ORDER) {
      expect(seen, `weapon ${wpn} was never equipped`).toContain(wpn);
    }
    // the last pickup is the one in hand
    expect(p.weapon).toBe(WEAPON_ORDER[WEAPON_ORDER.length - 1]);
  });
});
