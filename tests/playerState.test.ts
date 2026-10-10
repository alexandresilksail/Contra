import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/player';
import { Level } from '../src/level/level';
import { stageDef } from '../src/level/stages';
import { T } from '../src/level/tiles';
import { Particles } from '../src/systems/particles';
import { Camera } from '../src/systems/camera';
import { makeBulletPool } from '../src/entities/bullet';
import { makeEnemyPool } from '../src/entities/enemy';
import { audio } from '../src/audio/audio';
import { HURT_TIME, SHOOT_ANIM_TIME } from '../src/config/constants';
import { animFrame, animTag, resolveMoveState, ANIM_FRAMES } from '../src/entities/playerState';
import type { DebugFlags, InputState, WorldCtx } from '../src/core/world';

const debug: DebugFlags = { on: false, invincible: false, infiniteAmmo: false, hitbox: false, fps: false };

const noInput: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpPressed: false,
  shootHeld: false,
};

function makeWorld(level: Level): WorldCtx {
  return {
    level,
    cam: new Camera(),
    particles: new Particles(),
    pbullets: makeBulletPool(40),
    ebullets: makeBulletPool(40),
    players: [],
    enemies: makeEnemyPool().active,
    audio,
    debug,
    time: 0,
    shake: () => {},
    addScore: () => {},
    nearestPlayer: () => null,
    spawnPickup: () => {},
    spawnEnemy: () => null,
    boss: null,
    bossActive: false,
  };
}

function flatStageDef() {
  return {
    ...stageDef(1),
    seed: 999,
    terrain: 0,
    pitChance: 0,
    water: 0,
    crates: 0,
    spikes: 0,
  };
}

function groundedPlayer(): { p: Player; w: WorldCtx; level: Level } {
  const level = new Level(flatStageDef());
  const p = new Player(0, 'razor');
  const x = 64;
  const row = level.groundRow(Math.floor(x / 16));
  p.place(x, row * 16 - p.h);
  const w = makeWorld(level);
  w.players = [p];
  for (let i = 0; i < 10; i++) p.update(1 / 60, noInput, w);
  return { p, w, level };
}

/**
 * A player standing on the ground at the foot of a ladder shaft, which is how
 * the authored maps place them (the shaft runs from `row-6` to `row-1`).
 */
function ladderPlayer(col = 8): { p: Player; w: WorldCtx; level: Level } {
  const level = new Level(flatStageDef());
  const row = level.groundRow(col);
  for (let r = row - 6; r < row; r++) level.set(col, r, T.LADDER);
  const p = new Player(0, 'razor');
  p.place(col * 16 + 2, row * 16 - p.h);
  const w = makeWorld(level);
  w.players = [p];
  for (let i = 0; i < 6; i++) p.update(1 / 60, noInput, w);
  return { p, w, level };
}

const step = (p: Player, w: WorldCtx, input: Partial<InputState>, n = 1) => {
  for (let i = 0; i < n; i++) p.update(1 / 60, { ...noInput, ...input }, w);
};

/* ------------------------------------------------------------------ */
/* pure state-machine helpers                                          */
/* ------------------------------------------------------------------ */

describe('Phase 3: player state machine (pure helpers)', () => {
  it('resolves every locomotion pose from physics', () => {
    const base = {
      dying: false, dead: false, victory: false, hurtT: 0,
      onLadder: false, onGround: true, crouching: false, vy: 0, vx: 0,
    };
    expect(resolveMoveState(base)).toBe('idle');
    expect(resolveMoveState({ ...base, vx: 60 })).toBe('run');
    expect(resolveMoveState({ ...base, vx: -60 })).toBe('run');
    expect(resolveMoveState({ ...base, vy: -100, onGround: false })).toBe('jump');
    expect(resolveMoveState({ ...base, vy: 100, onGround: false })).toBe('fall');
    expect(resolveMoveState({ ...base, crouching: true })).toBe('crouch');
    expect(resolveMoveState({ ...base, onLadder: true })).toBe('climb');
    expect(resolveMoveState({ ...base, hurtT: 0.1 })).toBe('hurt');
    expect(resolveMoveState({ ...base, dying: true })).toBe('dead');
    expect(resolveMoveState({ ...base, victory: true })).toBe('victory');
  });

  it('hurt/dead outrank locomotion so they can never be masked', () => {
    expect(resolveMoveState({
      dying: false, dead: false, victory: false, hurtT: 0.2,
      onLadder: true, onGround: true, crouching: true, vy: -200, vx: 80,
    })).toBe('hurt');
  });

  it('firing combines with locomotion instead of replacing it', () => {
    expect(animTag('idle', true)).toBe('SHOOT_IDLE');
    expect(animTag('run', true)).toBe('SHOOT_RUN');
    expect(animTag('jump', true)).toBe('SHOOT_JUMP');
    expect(animTag('fall', true)).toBe('SHOOT_FALL');
    expect(animTag('crouch', true)).toBe('SHOOT_CROUCH');
    expect(animTag('climb', true)).toBe('SHOOT_CLIMB');
    // hurt / dead have no armed variant
    expect(animTag('hurt', true)).toBe('HURT');
    expect(animTag('dead', true)).toBe('DEAD');
    expect(animTag('run', false)).toBe('RUN');
  });

  it('never returns a frame index outside the available art', () => {
    for (let t = 0; t < 5; t += 0.01) {
      for (const st of Object.keys(ANIM_FRAMES) as (keyof typeof ANIM_FRAMES)[]) {
        const f = animFrame(st, t, 4);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(4);
      }
    }
    // unlimited: still inside the configured cycle length
    expect(animFrame('run', 100)).toBeLessThan(ANIM_FRAMES.run);
  });
});

/* ------------------------------------------------------------------ */
/* live state transitions                                              */
/* ------------------------------------------------------------------ */

describe('Phase 3: live pose transitions', () => {
  it('idles on spawn', () => {
    const { p } = groundedPlayer();
    expect(p.moveState).toBe('idle');
    expect(p.anim).toBe('IDLE');
  });

  it('enters RUN while moving and returns to IDLE when stopped', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { right: true }, 20);
    expect(p.moveState).toBe('run');
    expect(p.anim).toBe('RUN');
    step(p, w, {}, 40);
    expect(p.moveState).toBe('idle');
  });

  it('cycles through multiple run frames (not a frozen pose)', () => {
    const { p, w } = groundedPlayer();
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      step(p, w, { right: true });
      seen.add(p.frame);
    }
    expect(seen.size).toBeGreaterThan(1);
    // and the cycle must stay inside the art set
    expect(Math.max(...seen)).toBeLessThan(p.art.run.length);
  });

  it('restarts the cycle when the pose changes', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { right: true }, 20);
    expect(p.frame).toBeGreaterThanOrEqual(0);
    // leaving the ground resets the clock
    step(p, w, { right: true, jumpPressed: true, jumpHeld: true });
    expect(p.moveState).toBe('jump');
    expect(p.animT).toBeLessThan(0.05);
  });

  it('distinguishes JUMP (rising) from FALL (descending)', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { jumpPressed: true, jumpHeld: true });
    expect(p.moveState).toBe('jump');
    let sawFall = false;
    for (let i = 0; i < 60; i++) {
      step(p, w, { jumpHeld: true });
      if (p.moveState === 'fall') sawFall = true;
    }
    expect(sawFall).toBe(true);
    step(p, w, {}, 60);
    expect(p.moveState).toBe('idle');
  });

  it('enters CROUCH only on the ground', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { down: true }, 5);
    expect(p.moveState).toBe('crouch');
    step(p, w, {});
    expect(p.moveState).toBe('idle');
  });

  it('enters CLIMB on a ladder', () => {
    const { p, w } = ladderPlayer();
    step(p, w, { up: true }, 4);
    expect(p.onLadder).toBe(true);
    expect(p.moveState).toBe('climb');
    expect(p.anim).toBe('CLIMB');
  });

  it('hangs on the ladder when no vertical input is given (original behaviour)', () => {
    const { p, w } = ladderPlayer();
    step(p, w, { up: true }, 6);
    const y = p.y;
    step(p, w, {}, 20);
    expect(p.onLadder).toBe(true);
    // hanging must not slide: the soldier holds position
    expect(Math.abs(p.y - y)).toBeLessThan(2);
    expect(p.moveState).toBe('climb');
  });

  it('leaves the ladder when jumping off it', () => {
    const { p, w } = ladderPlayer();
    step(p, w, { up: true }, 6);
    expect(p.onLadder).toBe(true);
    step(p, w, { jumpPressed: true, jumpHeld: true });
    expect(p.onLadder).toBe(false);
    expect(p.vy).toBeLessThan(0);
  });

  it('leaves the ladder when climbing back down to the ground', () => {
    const { p, w } = ladderPlayer();
    step(p, w, { up: true }, 10);
    expect(p.onLadder).toBe(true);
    step(p, w, { down: true }, 60);
    expect(p.onLadder).toBe(false);
  });

  it('enters HURT on a non-fatal hit and recovers', () => {
    const { p, w } = groundedPlayer();
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    step(p, w, {});
    expect(p.moveState).toBe('hurt');
    expect(p.anim).toBe('HURT');
    step(p, w, {}, Math.ceil(HURT_TIME * 60) + 2);
    expect(p.hurtT).toBeLessThanOrEqual(0);
    expect(p.moveState).toBe('idle');
  });

  it('enters DEAD when hp runs out and stays dead', () => {
    const { p, w } = groundedPlayer();
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    step(p, w, {});
    expect(p.moveState).toBe('dead');
    expect(p.anim).toBe('DEAD');
    step(p, w, {}, 120);
    expect(p.state).toBe('dead');
    expect(p.moveState).toBe('dead');
  });
});

/* ------------------------------------------------------------------ */
/* shooting combined with locomotion (NES behaviour)                   */
/* ------------------------------------------------------------------ */

describe('Phase 3: shooting combines with movement', () => {
  it('SHOOT_RUN - fires while running without stopping the run cycle', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { right: true }, 20);
    const x0 = p.x;
    step(p, w, { right: true, shootHeld: true });
    expect(p.anim).toBe('SHOOT_RUN');
    expect(w.pbullets.count).toBeGreaterThan(0);
    // still moving: firing did not interrupt locomotion
    expect(p.x).toBeGreaterThan(x0);
  });

  it('SHOOT_IDLE - fires while standing', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { shootHeld: true });
    expect(p.anim).toBe('SHOOT_IDLE');
  });

  it('SHOOT_JUMP then SHOOT_FALL - fires while airborne', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { jumpPressed: true, jumpHeld: true, shootHeld: true });
    expect(p.anim).toBe('SHOOT_JUMP');
    for (let i = 0; i < 30; i++) {
      step(p, w, { jumpHeld: true, shootHeld: true });
      if (p.moveState === 'fall') break;
    }
    expect(p.anim).toBe('SHOOT_FALL');
  });

  it('SHOOT_CROUCH - fires while prone', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { down: true, shootHeld: true });
    expect(p.moveState).toBe('crouch');
    expect(p.anim).toBe('SHOOT_CROUCH');
  });

  it('SHOOT_CLIMB - fires while on a ladder', () => {
    const { p, w } = ladderPlayer();
    step(p, w, { up: true, shootHeld: true }, 3);
    expect(p.moveState).toBe('climb');
    expect(p.anim).toBe('SHOOT_CLIMB');
  });

  it('returns to the unarmed pose once the shot anim expires', () => {
    const { p, w } = groundedPlayer();
    step(p, w, { right: true }, 20);
    step(p, w, { right: true, shootHeld: true });
    expect(p.anim).toBe('SHOOT_RUN');
    step(p, w, { right: true }, Math.ceil(SHOOT_ANIM_TIME * 60) + 2);
    expect(p.anim).toBe('RUN');
  });

  it('a dead player never shows an armed pose', () => {
    const { p, w } = groundedPlayer();
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    step(p, w, { shootHeld: true });
    expect(p.anim).toBe('DEAD');
  });
});

/* ------------------------------------------------------------------ */
/* rendering every pose must not throw                                 */
/* ------------------------------------------------------------------ */

describe('Phase 3: every pose renders', () => {
  it('draws all locomotion poses without throwing', () => {
    const { p, w } = groundedPlayer();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
    const poses: Partial<InputState>[] = [
      {},
      { right: true },
      { left: true },
      { down: true },
      { up: true },
      { right: true, shootHeld: true },
      { jumpPressed: true, jumpHeld: true },
      { down: true, shootHeld: true },
    ];
    for (const input of poses) {
      step(p, w, input, 6);
      expect(() => p.draw(ctx, 0, 0, true)).not.toThrow();
    }
    // hurt + dead too
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    step(p, w, {});
    expect(() => p.draw(ctx, 0, 0, true)).not.toThrow();
    p.invuln = 0;
    p.hurt(w, 5, p.x - 20);
    step(p, w, {}, 3);
    expect(() => p.draw(ctx, 0, 0, true)).not.toThrow();
    p.state = 'victory';
    step(p, w, {}, 3);
    expect(() => p.draw(ctx, 0, 0, true)).not.toThrow();
  });

  it('both characters build art for every pose', () => {
    for (const id of ['razor', 'titan'] as const) {
      const p = new Player(0, id);
      expect(p.art.run.length).toBeGreaterThan(0);
      expect(p.art.shoot.run.length).toBeGreaterThan(0);
      expect(p.art.dead.length).toBeGreaterThan(0);
      expect(p.art.climb.length).toBeGreaterThan(0);
      for (const set of [p.art.idle, p.art.jump, p.art.fall, p.art.crouch, p.art.hurt, p.art.victory]) {
        expect(set.right.length).toBeGreaterThan(0);
        expect(set.left.length).toBe(set.right.length);
      }
      expect(p.art.shoot.idle.right.length).toBeGreaterThan(0);
      expect(p.art.shoot.crouch.right.length).toBeGreaterThan(0);
      expect(p.art.shoot.jump.right.length).toBeGreaterThan(0);
      expect(p.art.shoot.fall.right.length).toBeGreaterThan(0);
      expect(p.art.shoot.climb.length).toBe(p.art.climb.length);
    }
  });
});
