import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/player';
import { Level } from '../src/level/level';
import { stageDef } from '../src/level/stages';
import { Particles } from '../src/systems/particles';
import { Camera } from '../src/systems/camera';
import { makeBulletPool } from '../src/entities/bullet';
import { makeEnemyPool } from '../src/entities/enemy';
import { audio } from '../src/audio/audio';
import { WEAPONS } from '../src/weapons/weapons';
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
    pbullets: makeBulletPool(20),
    ebullets: makeBulletPool(20),
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
    explode: () => {},
    boss: null,
    bossActive: false,
  };
}

/** Flat test stage: no pits, spikes or props so movement tests are stable. */
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
  let row = level.groundRow(Math.floor(x / 16));
  for (let i = 0; i < 6 && row >= level.rows; i++) row = level.groundRow(Math.floor(x / 16) + i);
  p.place(x, row * 16 - p.h);
  const w = makeWorld(level);
  w.players = [p];
  // let gravity settle the player on the ground
  for (let i = 0; i < 10; i++) p.update(1 / 60, noInput, w);
  return { p, w, level };
}

describe('player movement', () => {
  it('accelerates right and stops with friction', () => {
    const { p, w } = groundedPlayer();
    const x0 = p.x;
    for (let i = 0; i < 30; i++) p.update(1 / 60, { ...noInput, right: true }, w);
    expect(p.x).toBeGreaterThan(x0 + 20);
    expect(p.facing).toBe(1);
    const moving = p.x;
    for (let i = 0; i < 40; i++) p.update(1 / 60, noInput, w);
    expect(Math.abs(p.vx)).toBeLessThan(1);
    expect(p.x).toBeGreaterThan(moving);
  });

  it('accelerates left and flips facing', () => {
    const { p, w } = groundedPlayer();
    const x0 = p.x;
    for (let i = 0; i < 30; i++) p.update(1 / 60, { ...noInput, left: true }, w);
    expect(p.x).toBeLessThan(x0);
    expect(p.facing).toBe(-1);
  });

  it('is faster with character A than character B', () => {
    const level = new Level(flatStageDef());
    const w = makeWorld(level);
    const a = new Player(0, 'razor');
    const b = new Player(1, 'titan');
    a.place(64, level.groundRow(4) * 16 - a.h);
    b.place(64, level.groundRow(4) * 16 - b.h);
    for (let i = 0; i < 60; i++) {
      a.update(1 / 60, { ...noInput, right: true }, w);
      b.update(1 / 60, { ...noInput, right: true }, w);
    }
    expect(a.x).toBeGreaterThan(b.x);
  });
});

describe('player jump', () => {
  it('leaves the ground, rises and lands again', () => {
    const { p, w } = groundedPlayer();
    const groundY = p.y;
    expect(p.onGround).toBe(true);
    p.update(1 / 60, { ...noInput, jumpPressed: true, jumpHeld: true }, w);
    expect(p.vy).toBeLessThan(0);
    let peak = p.y;
    for (let i = 0; i < 20; i++) {
      p.update(1 / 60, { ...noInput, jumpHeld: true }, w);
      peak = Math.min(peak, p.y);
    }
    expect(peak).toBeLessThan(groundY - 20);
    for (let i = 0; i < 90; i++) p.update(1 / 60, noInput, w);
    expect(p.onGround).toBe(true);
    expect(Math.abs(p.y - groundY)).toBeLessThan(2);
  });

  it('jumps lower when the button is released early', () => {
    const level = new Level(flatStageDef());
    const w = makeWorld(level);
    const full = new Player(0, 'razor');
    const short = new Player(1, 'razor');
    full.place(64, level.groundRow(4) * 16 - full.h);
    short.place(64, level.groundRow(4) * 16 - short.h);
    for (let i = 0; i < 5; i++) {
      full.update(1 / 60, noInput, w);
      short.update(1 / 60, noInput, w);
    }
    let fullPeak = full.y;
    let shortPeak = short.y;
    for (let i = 0; i < 40; i++) {
      full.update(1 / 60, { ...noInput, jumpPressed: i === 0, jumpHeld: true }, w);
      short.update(1 / 60, { ...noInput, jumpPressed: i === 0, jumpHeld: i < 4 }, w);
      fullPeak = Math.min(fullPeak, full.y);
      shortPeak = Math.min(shortPeak, short.y);
    }
    expect(shortPeak).toBeGreaterThan(fullPeak); // short jump does not reach as high
  });

  it('cannot jump while crouching in a tunnel', () => {
    const { p, w } = groundedPlayer();
    p.update(1 / 60, { ...noInput, down: true, jumpPressed: true, jumpHeld: true }, w);
    expect(p.vy).toBeGreaterThanOrEqual(0);
  });
});

describe('player weapons', () => {
  it('fires bullets in the facing direction', () => {
    const { p, w } = groundedPlayer();
    p.fireCd = 0;
    p.update(1 / 60, { ...noInput, right: true, shootHeld: true }, w);
    expect(w.pbullets.count).toBeGreaterThan(0);
    const b = w.pbullets.active[0];
    expect(b.vx).toBeGreaterThan(0);
    expect(b.friendly).toBe(true);
  });

  it('respects fire rate and consumes ammo', () => {
    const { p, w } = groundedPlayer();
    p.giveWeapon('rapid');
    expect(p.weapon).toBe('rapid');
    const ammo = p.ammoLeft();
    p.update(1 / 60, { ...noInput, shootHeld: true }, w);
    expect(p.ammoLeft()).toBe(ammo - 1);
    const count = w.pbullets.count;
    p.update(1 / 60, { ...noInput, shootHeld: true }, w);
    expect(w.pbullets.count).toBe(count); // still cooling down
  });

  it('falls back to the rifle when ammo runs out', () => {
    const { p, w } = groundedPlayer();
    p.giveWeapon('spread');
    p.ammo.spread = 0;
    p.fireCd = 0;
    p.update(1 / 60, { ...noInput, shootHeld: true }, w);
    expect(p.weapon).toBe('rifle');
  });

  it('spawns one bullet per fan with the spread gun', () => {
    const { p, w } = groundedPlayer();
    p.giveWeapon('spread');
    p.fireCd = 0;
    p.update(1 / 60, { ...noInput, shootHeld: true }, w);
    expect(w.pbullets.count).toBe(WEAPONS.spread.count);
  });

  it('never runs out of ammo with infinite ammo debug', () => {
    const { p, w } = groundedPlayer();
    w.debug.infiniteAmmo = true;
    p.giveWeapon('blast');
    const before = p.ammoLeft();
    for (let i = 0; i < 5; i++) {
      p.fireCd = 0;
      p.update(1 / 60, { ...noInput, shootHeld: true }, w);
    }
    expect(p.ammoLeft()).toBe(before);
    w.debug.infiniteAmmo = false;
  });

  it('aims in 8 directions', () => {
    const { p, w } = groundedPlayer();
    const dirs = new Set<number>();
    const combos: Partial<InputState>[] = [
      { right: true }, // 0
      { left: true }, // 180
      { up: true }, // -90
      { up: true, right: true }, // -45
      { up: true, left: true }, // -135
      { down: true, right: true }, // 45
      { down: true, left: true }, // 135
      { down: true }, // 90
    ];
    for (const c of combos) {
      // place the player at a fixed point safely inside the level (airborne),
      // so down/up aiming works without drifting above the level ceiling.
      p.y = 140;
      p.vy = 0;
      p.update(1 / 60, { ...noInput, ...c }, w);
      dirs.add(Math.round((p.aimAngle * 180) / Math.PI / 45) * 45);
    }
    expect(dirs.size).toBe(8);
    expect([...dirs].sort((a, b) => a - b)).toEqual([-135, -90, -45, 0, 45, 90, 135, 180]);
  });
});

describe('player damage', () => {
  it('loses hp then dies, and loses a life', () => {
    const { p, w } = groundedPlayer();
    expect(p.hp).toBe(3);
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    expect(p.hp).toBe(2);
    p.invuln = 0;
    p.hurt(w, 1, p.x - 20);
    p.invuln = 0;
    const dead = p.hurt(w, 1, p.x - 20);
    expect(dead).toBe(true);
    expect(p.state).toBe('dying');
  });

  it('is immune while invulnerable', () => {
    const { p, w } = groundedPlayer();
    p.invuln = 1;
    const blocked = p.hurt(w, 1, p.x - 20);
    expect(blocked).toBe(false);
    expect(p.hp).toBe(3);
  });

  it('survives everything with the invincible debug flag', () => {
    const { p, w } = groundedPlayer();
    w.debug.invincible = true;
    p.invuln = 0;
    p.hurt(w, 99, p.x - 20);
    expect(p.state).toBe('alive');
    p.kill(w, 'test');
    expect(p.state).toBe('alive');
    w.debug.invincible = false;
  });

  it('respawns with full hp', () => {
    const { p } = groundedPlayer();
    p.hp = 1;
    p.place(100, 100);
    expect(p.hp).toBe(p.maxHp);
    expect(p.invuln).toBeGreaterThan(0);
  });
});
