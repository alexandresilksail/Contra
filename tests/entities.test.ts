import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, ENEMY_KINDS, initEnemy, makeEnemyPool, updateEnemy, damageEnemy } from '../src/entities/enemy';
import { BOSS_DEFS, Boss, damageBoss, updateBoss } from '../src/entities/boss';
import { ENEMY_ART, buildEnemyArt, buildBossArt, CHAR_DEFS } from '../src/gfx/sprites';
import { WEAPONS, WEAPON_ORDER, weaponDef } from '../src/weapons/weapons';
import { Level } from '../src/level/level';
import { stageDef } from '../src/level/stages';
import { Particles } from '../src/systems/particles';
import { Camera } from '../src/systems/camera';
import { makeBulletPool } from '../src/entities/bullet';
import { audio } from '../src/audio/audio';
import type { DebugFlags, WorldCtx } from '../src/core/world';
import type { Player } from '../src/entities/player';

const debug: DebugFlags = { on: false, invincible: false, infiniteAmmo: false, hitbox: false, fps: false };

function makeWorld(): WorldCtx {
  const level = new Level(stageDef(1));
  const pool = makeEnemyPool();
  const w: WorldCtx = {
    level,
    cam: new Camera(),
    particles: new Particles(),
    pbullets: makeBulletPool(10),
    ebullets: makeBulletPool(10),
    players: [],
    enemies: pool.active,
    audio,
    debug,
    time: 0,
    shake: () => {},
    addScore: () => {},
    nearestPlayer: () => null,
    spawnPickup: () => {},
    spawnEnemy: (kind, x, y, facing) => {
      const e = pool.spawn();
      initEnemy(e, kind, x, y, facing);
      return e;
    },
    boss: null,
    bossActive: false,
  };
  return w;
}

describe('enemy roster', () => {
  it('defines at least 15 distinct enemy types', () => {
    expect(ENEMY_KINDS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ENEMY_KINDS).size).toBe(ENEMY_KINDS.length);
  });

  it('gives every enemy unique stats and an AI routine', () => {
    const ais = new Set<string>();
    for (const k of ENEMY_KINDS) {
      const d = ENEMY_DEFS[k];
      expect(d.hp).toBeGreaterThan(0);
      expect(d.score).toBeGreaterThan(0);
      expect(d.w).toBeGreaterThan(0);
      expect(d.ai.length).toBeGreaterThan(0);
      ais.add(d.ai);
    }
    expect(ais.size).toBe(ENEMY_KINDS.length); // every enemy behaves differently
  });

  it('can bake sprite frames for every enemy', () => {
    for (const k of ENEMY_KINDS) {
      const art = buildEnemyArt(k);
      expect(art.length).toBeGreaterThan(0);
      expect(art[0].right.length).toBeGreaterThan(0);
    }
    expect(Object.keys(ENEMY_ART).length).toBeGreaterThanOrEqual(15);
  });

  it('moves ground enemies toward a target and keeps them on the map', () => {
    const w = makeWorld();
    const pool = makeEnemyPool();
    w.enemies = pool.active;
    const enemy = pool.spawn();
    initEnemy(enemy, 'grunt', 400, 300, -1);
    const fakePlayer = { x: 200, y: 300, w: 12, h: 22, alive: true } as unknown as Player;
    w.nearestPlayer = () => fakePlayer;
    const startX = enemy.x;
    for (let i = 0; i < 30; i++) updateEnemy(enemy, 1 / 60, w);
    expect(enemy.x).toBeLessThan(startX);
    expect(enemy.x).toBeGreaterThanOrEqual(0);
  });

  it('damages and kills enemies, awarding score on death', () => {
    const w = makeWorld();
    let score = 0;
    w.addScore = (n) => {
      score += n;
    };
    const pool = makeEnemyPool();
    const e = pool.spawn();
    initEnemy(e, 'grunt', 300, 300, -1);
    e.spawnGrace = 0;
    damageEnemy(e, 5, w, 200, false);
    expect(e.hp).toBe(ENEMY_DEFS.grunt.hp - 5);
    damageEnemy(e, 999, w, 200, false);
    expect(e.state).toBe('death');
    expect(score).toBe(ENEMY_DEFS.grunt.score);
  });

  it('blocks frontal shots on shield enemies but not from behind', () => {
    const w = makeWorld();
    const pool = makeEnemyPool();
    const e = pool.spawn();
    initEnemy(e, 'shield', 300, 300, -1); // facing left
    e.spawnGrace = 0;
    const hp = e.hp;
    damageEnemy(e, 10, w, 400, false); // from the right = behind
    expect(e.hp).toBe(hp - 10);
    const hp2 = e.hp;
    damageEnemy(e, 10, w, 200, false); // from the left = shield side
    expect(e.hp).toBe(hp2);
    damageEnemy(e, 10, w, 200, true); // explosive ignores the shield
    expect(e.hp).toBeLessThan(hp2);
  });
});

describe('boss roster', () => {
  it('defines 8 bosses with 3 phases each', () => {
    const ids = Object.keys(BOSS_DEFS);
    expect(ids.length).toBe(8);
    for (const id of ids) {
      const b = BOSS_DEFS[id];
      expect(b.phases.length).toBe(3);
      b.phases.forEach((p) => expect(p.length).toBeGreaterThan(0));
      expect(b.hp).toBeGreaterThan(0);
      expect(b.w).toBeGreaterThan(20);
    }
  });

  it('bakes boss artwork', () => {
    for (const id of Object.keys(BOSS_DEFS)) {
      const art = buildBossArt(id);
      expect(art.body.length).toBeGreaterThan(0);
      expect(art.weak.width).toBeGreaterThan(0);
    }
  });

  it('enters, fights and dies through the phase machine', () => {
    const w = makeWorld();
    const def = BOSS_DEFS.commander;
    const boss = new Boss(def, 3000, 100);
    boss.arenaLeft = 3000;
    boss.arenaRight = 3800;
    expect(boss.state).toBe('entry');
    for (let i = 0; i < 120; i++) updateBoss(boss, 1 / 60, w, []);
    expect(boss.state).toBe('fight');

    boss.invuln = 0;
    damageBoss(boss, 50, w, boss.x + boss.w / 2, boss.y + boss.h / 2, false);
    expect(boss.hp).toBeLessThan(def.hp);
    // crossing 66% starts phase 2
    updateBoss(boss, 1 / 60, w, []);
    expect(boss.phase).toBe(1);
    boss.invuln = 0;
    damageBoss(boss, 1000, w, boss.x, boss.y, false);
    expect(boss.state).toBe('dying');
    for (let i = 0; i < 200; i++) updateBoss(boss, 1 / 60, w, []);
    expect(boss.state).toBe('dead');
  });

  it('doubles damage on the weak point', () => {
    const w = makeWorld();
    const boss = new Boss(BOSS_DEFS.frostcore, 3000, 100);
    boss.arenaLeft = 3000;
    boss.arenaRight = 3800;
    boss.state = 'fight';
    boss.invuln = 0;
    boss.weakX = 0;
    boss.weakY = 0;
    const hp = boss.hp;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;
    damageBoss(boss, 10, w, cx, cy, false);
    const weakDamage = hp - boss.hp;
    boss.invuln = 0;
    const hp2 = boss.hp;
    damageBoss(boss, 10, w, boss.x - 50, boss.y - 50, false);
    const normalDamage = hp2 - boss.hp;
    expect(weakDamage).toBeGreaterThan(normalDamage * 2);
  });
});

describe('weapons', () => {
  it('provides at least 6 different weapons', () => {
    expect(WEAPON_ORDER.length).toBeGreaterThanOrEqual(6);
    const names = new Set(WEAPON_ORDER.map((w) => weaponDef(w).name));
    expect(names.size).toBe(WEAPON_ORDER.length);
  });

  it('gives each weapon distinct behaviour', () => {
    const seen = new Set<string>();
    for (const id of WEAPON_ORDER) {
      const d = weaponDef(id);
      expect(d.damage).toBeGreaterThan(0);
      expect(d.interval).toBeGreaterThan(0);
      expect(d.speed).toBeGreaterThan(0);
      expect(d.letter.length).toBe(1);
      seen.add(`${d.count}-${d.pierce}-${d.explode}-${d.homing}-${d.laser}-${d.interval}-${d.speed}-${d.damage}`);
    }
    expect(seen.size).toBe(WEAPON_ORDER.length);
    expect(WEAPONS.pierce.pierce).toBeGreaterThan(0);
    expect(WEAPONS.blast.explode).toBeGreaterThan(0);
    expect(WEAPONS.spread.count).toBeGreaterThan(1);
    expect(WEAPONS.laser.laser).toBe(true);
    expect(WEAPONS.homing.homing).toBe(true);
    expect(WEAPONS.rifle.ammo).toBe(-1); // infinite
  });
});

describe('characters', () => {
  it('offers two playable characters with different stats', () => {
    expect(CHAR_DEFS.length).toBe(2);
    const [a, b] = CHAR_DEFS;
    expect(a.speed).toBeGreaterThan(b.speed);
    expect(b.damage).toBeGreaterThan(a.damage);
    expect(b.recoil).toBeLessThan(a.recoil);
  });
});
