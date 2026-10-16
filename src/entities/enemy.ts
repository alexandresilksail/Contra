import { GRAVITY, MAX_FALL, PAL, VIEW_H } from '../config/constants';
import type { WorldCtx } from '../core/world';
import { buildEnemyArt, type SpriteSet } from '../gfx/sprites';
import { ledgeAhead, moveAndCollide, onGround as probeGround, wallAhead } from '../systems/collision';
import { Pool } from '../core/pool';
import { spawnBullet } from './bullet';
import type { Bullet } from './bullet';
import type { WeaponId } from '../weapons/weapons';
import type { Player } from './player';

export interface EnemyDef {
  kind: string;
  name: string;
  w: number;
  h: number;
  hp: number;
  speed: number;
  score: number;
  flying?: boolean;
  noGravity?: boolean;
  ai: string;
  drop?: WeaponId;
  dropChance?: number;
  desc: string;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: { kind: 'grunt', name: 'INFANTRY', w: 12, h: 22, hp: 12, speed: 56, score: 100, ai: 'grunt', desc: 'WALKS / FIRES' },
  runner: { kind: 'runner', name: 'SKIRMISHER', w: 11, h: 21, hp: 8, speed: 138, score: 130, ai: 'runner', desc: 'CHARGES FAST' },
  heavy: { kind: 'heavy', name: 'HEAVY TROOPER', w: 18, h: 24, hp: 42, speed: 34, score: 320, ai: 'heavy', drop: 'spread', dropChance: 0.35, desc: 'ARMOURED / 3-SHOT' },
  sniper: { kind: 'sniper', name: 'MARKSMAN', w: 12, h: 22, hp: 14, speed: 42, score: 260, ai: 'sniper', drop: 'pierce', dropChance: 0.4, desc: 'AIMED PIERCING SHOT' },
  shield: { kind: 'shield', name: 'BULWARK', w: 16, h: 23, hp: 34, speed: 48, score: 280, ai: 'shield', drop: 'rapid', dropChance: 0.35, desc: 'FRONT SHIELD / FLANK IT' },
  bomber: { kind: 'bomber', name: 'SUICIDE BOMBER', w: 12, h: 20, hp: 10, speed: 118, score: 170, ai: 'bomber', desc: 'DETONATES ON CONTACT' },
  jumper: { kind: 'jumper', name: 'HOPPER', w: 11, h: 20, hp: 12, speed: 74, score: 150, ai: 'jumper', desc: 'LEAPS AT YOU' },
  flame: { kind: 'flame', name: 'FLAME TROOPER', w: 16, h: 22, hp: 28, speed: 58, score: 240, ai: 'flame', drop: 'blast', dropChance: 0.4, desc: 'SHORT RANGE FLAME' },
  turret: { kind: 'turret', name: 'AUTO TURRET', w: 18, h: 16, hp: 24, speed: 0, score: 220, ai: 'turret', noGravity: true, desc: 'STATIC / BURST FIRE' },
  flyer: { kind: 'flyer', name: 'GUNSHIP DRONE', w: 22, h: 14, hp: 16, speed: 66, score: 190, flying: true, ai: 'flyer', drop: 'rapid', dropChance: 0.25, desc: 'HOVERS / DROPS BOMBS' },
  spider: { kind: 'spider', name: 'CRAWLER', w: 20, h: 13, hp: 14, speed: 96, score: 170, ai: 'spider', desc: 'FAST / SPITS ACID' },
  mech: { kind: 'mech', name: 'WALKER MK-II', w: 26, h: 28, hp: 95, speed: 40, score: 900, ai: 'mech', drop: 'laser', dropChance: 0.6, desc: 'MINI BOSS / CANNON' },
  roller: { kind: 'roller', name: 'ROLLER MINE', w: 16, h: 16, hp: 18, speed: 158, score: 180, ai: 'roller', desc: 'ROLLS ALONG GROUND' },
  drone: { kind: 'drone', name: 'LASER DRONE', w: 18, h: 18, hp: 20, speed: 62, score: 250, flying: true, ai: 'drone', drop: 'homing', dropChance: 0.35, desc: 'HOVERS / LASER BURST' },
  worm: { kind: 'worm', name: 'CAVERN LARVA', w: 22, h: 14, hp: 26, speed: 62, score: 200, ai: 'worm', desc: 'BURROWS / BITES' },
};

export const ENEMY_KINDS = Object.keys(ENEMY_DEFS);

const artCache = new Map<string, SpriteSet[]>();
function artFor(kind: string): SpriteSet[] {
  let a = artCache.get(kind);
  if (!a) {
    a = buildEnemyArt(kind, ENEMY_DEFS[kind]?.h ?? 22);
    artCache.set(kind, a);
  }
  return a;
}

export type EnemyState = 'spawn' | 'patrol' | 'chase' | 'attack' | 'hurt' | 'death';

export class Enemy {
  kind: string;
  def: EnemyDef;
  x = 0;
  y = 0;
  w = 12;
  h = 22;
  vx = 0;
  vy = 0;
  hp = 10;
  maxHp = 10;
  facing: 1 | -1 = -1;
  state: EnemyState = 'spawn';
  stateT = 0;
  animT = 0;
  frame = 0;
  onGround = false;
  dead = false;
  hurtFlash = 0;
  aiT = 0;
  shootCd = 1;
  burst = 0;
  homeX = 0;
  homeY = 0;
  angle = 0; // turret barrel angle
  phase = Math.random() * Math.PI * 2;
  spawnGrace = 0.35; // cannot be damaged while dropping in
  contactCd = 0;
  uid = 0;

  constructor(kind: string, x: number, y: number) {
    this.kind = kind;
    this.def = ENEMY_DEFS[kind] ?? ENEMY_DEFS.grunt;
    this.w = this.def.w;
    this.h = this.def.h;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
  }

  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  get flying(): boolean {
    return !!this.def.flying;
  }
}

/* ------------------------------------------------------------------ */
/* spawning                                                            */
/* ------------------------------------------------------------------ */

export function makeEnemyPool(prealloc = 40): Pool<Enemy> {
  return new Pool<Enemy>(
    () => new Enemy('grunt', 0, 0),
    () => {},
    prealloc,
  );
}

let uidCounter = 1;

export function initEnemy(e: Enemy, kind: string, x: number, y: number, facing: 1 | -1 = -1): Enemy {
  e.uid = uidCounter++;
  e.kind = kind;
  e.def = ENEMY_DEFS[kind] ?? ENEMY_DEFS.grunt;
  e.w = e.def.w;
  e.h = e.def.h;
  e.hp = e.def.hp;
  e.maxHp = e.def.hp;
  e.x = x;
  e.y = y;
  e.homeX = x;
  e.homeY = y;
  e.vx = 0;
  e.vy = 0;
  e.facing = facing;
  e.state = 'spawn';
  e.stateT = 0;
  e.animT = 0;
  e.frame = 0;
  e.dead = false;
  e.hurtFlash = 0;
  e.aiT = 0;
  e.shootCd = 0.6 + Math.random() * 0.8;
  e.burst = 0;
  e.spawnGrace = 0.35;
  e.contactCd = 0;
  e.angle = 0;
  e.phase = Math.random() * Math.PI * 2;
  return e;
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

function enemyShot(
  w: WorldCtx,
  x: number,
  y: number,
  angle: number,
  speed: number,
  opt: { dmg?: number; size?: [number, number]; color?: string; gravity?: number; pierce?: number; sfx?: string } = {},
): Bullet {
  const b = w.ebullets.spawn();
  b.x = x;
  b.y = y;
  b.angle = angle;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.w = opt.size?.[0] ?? 6;
  b.h = opt.size?.[1] ?? 3;
  b.dmg = opt.dmg ?? 1;
  b.pierce = opt.pierce ?? 0;
  b.color = opt.color ?? PAL.red;
  b.gravity = opt.gravity ?? 0;
  b.friendly = false;
  b.maxLife = 3.2;
  b.weapon = 'enemy';
  b.laser = false;
  b.homing = false;
  b.explode = 0;
  b.hitIds.length = 0;
  if (opt.sfx) w.audio.sfx(opt.sfx);
  return b;
}

function aimAt(e: Enemy, p: Player): number {
  return Math.atan2(p.y + p.h / 2 - (e.y + e.h * 0.4), p.x + p.w / 2 - (e.x + e.w / 2));
}

export function updateEnemy(e: Enemy, dt: number, w: WorldCtx): void {
  e.stateT += dt;
  e.animT += dt;
  if (e.hurtFlash > 0) e.hurtFlash -= dt;
  if (e.spawnGrace > 0) e.spawnGrace -= dt;
  if (e.contactCd > 0) e.contactCd -= dt;

  if (e.state === 'death') {
    e.vy += GRAVITY * dt;
    // Dying enemies fall THROUGH bridge decks and drop below the screen,
    // exactly like the original ("enemies on bridges ... fall below the
    // screen" - ripper note on the Stage-1 map sheet). Normal ground still
    // catches them.
    if (!e.flying) moveAndCollide(e as any, w.level, dt, { oneWay: true, passDecks: true });
    e.y += (e.flying ? 90 : 0) * dt;
    // Gone once past the bottom edge of the view (the original drops bodies
    // out of sight); on solid ground they simply lie there for the death
    // flip animation and expire on the timer.
    if (e.y > w.cam.y + VIEW_H + 8) e.dead = true;
    else if (e.stateT > 0.5) e.dead = true;
    return;
  }

  const target = w.nearestPlayer(e.x, e.y);
  const level = w.level;
  const ai = e.def.ai;

  /* ---------------- ground physics ---------------- */
  if (!e.flying && !e.def.noGravity) {
    e.vy += GRAVITY * dt;
    e.vy = Math.min(e.vy, MAX_FALL);
  }

  const canSeeTarget = !!target && Math.abs((target.x + target.w / 2) - (e.x + e.w / 2)) < 340;

  switch (ai) {
    case 'grunt': {
      if (target && canSeeTarget && e.state !== 'attack') {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        e.shootCd -= dt;
        if (e.shootCd <= 0 && Math.random() < 0.6) {
          e.shootCd = 1.3 + Math.random() * 0.9;
          const a = aimAt(e, target);
          enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, a, 230, { color: PAL.orange, sfx: 'shoot' });
          e.state = 'attack';
          e.stateT = 0;
        }
      } else {
        patrol(e, dt, level);
      }
      if (e.state === 'attack' && e.stateT > 0.25) e.state = 'chase';
      break;
    }

    case 'runner': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed * (canSeeTarget ? 1.35 : 1);
        e.state = 'chase';
      } else patrol(e, dt, level);
      if (e.onGround && wallAhead(e as any, level, e.facing) && e.onGround) e.vy = -240;
      break;
    }

    case 'heavy': {
      if (target && canSeeTarget) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed * 0.6;
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = 1.6 + Math.random() * 0.6;
          const a = aimAt(e, target);
          for (let i = -1; i <= 1; i++)
            enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.42, a + i * 0.22, 210, { color: PAL.magenta, size: [5, 4], sfx: 'spread' });
          e.state = 'attack';
          e.stateT = 0;
        }
      } else {
        e.vx = 0;
      }
      if (e.state === 'attack' && e.stateT > 0.4) e.state = 'chase';
      break;
    }

    case 'sniper': {
      if (target && canSeeTarget) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = 0;
        e.aiT += dt;
        if (e.state !== 'attack') {
          e.state = 'attack';
          e.aiT = 0;
        }
        if (e.aiT > 0.75) {
          e.aiT = 0;
          const a = aimAt(e, target);
          enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, a, 520, { color: PAL.cyan, size: [8, 2], pierce: 2, sfx: 'pierce' });
        }
      } else {
        patrol(e, dt, level);
      }
      break;
    }

    case 'shield': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        e.shootCd -= dt;
        if (e.shootCd <= 0 && canSeeTarget) {
          e.shootCd = 1.9;
          const a = aimAt(e, target);
          enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, a, 250, { color: PAL.steel });
        }
      } else patrol(e, dt, level);
      break;
    }

    case 'bomber': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        const d = Math.hypot(target.x - e.x, target.y - e.y);
        if (d < 26) explodeEnemy(e, w, true);
      } else patrol(e, dt, level);
      break;
    }

    case 'jumper': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        e.aiT += dt;
        if (e.onGround && e.aiT > 0.9) {
          e.aiT = 0;
          e.vy = -300;
          e.vx *= 1.25;
        }
      } else patrol(e, dt, level);
      break;
    }

    case 'flame': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed * (canSeeTarget ? 1 : 0.6);
        e.shootCd -= dt;
        if (e.shootCd <= 0 && canSeeTarget) {
          e.shootCd = 0.16;
          const a = aimAt(e, target);
          for (let i = -1; i <= 1; i++) {
            const b = enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, a + i * 0.28, 190, {
              color: PAL.orange,
              size: [4, 4],
            });
            b.maxLife = 0.28;
            b.gravity = -40;
          }
          w.particles.spawn(e.x + e.w / 2 + Math.cos(a) * 10, e.y + e.h * 0.4 + Math.sin(a) * 10, 0, -20, 0.2, PAL.orange, 3);
        }
      } else patrol(e, dt, level);
      break;
    }

    case 'turret': {
      e.vx = 0;
      e.vy = 0;
      if (target) {
        const a = aimAt(e, target);
        e.angle = a;
        e.facing = Math.cos(a) < 0 ? -1 : 1;
        e.shootCd -= dt;
        if (e.shootCd <= 0 && Math.abs(target.x - e.x) < 300) {
          e.shootCd = 1.9;
          e.burst = 3;
          e.aiT = 0;
        }
        if (e.burst > 0) {
          e.aiT -= dt;
          if (e.aiT <= 0) {
            e.aiT = 0.16;
            e.burst--;
            enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, e.angle, 260, { color: PAL.yellow, sfx: 'shoot' });
          }
        }
      }
      break;
    }

    case 'flyer': {
      const tx = target ? target.x + target.w / 2 : e.homeX;
      e.facing = tx < e.x ? -1 : 1;
      e.vx = e.facing * e.def.speed;
      e.phase += dt * 3;
      e.vy = Math.sin(e.phase) * 34;
      e.shootCd -= dt;
      if (e.shootCd <= 0 && target && Math.abs(target.x - e.x) < 120) {
        e.shootCd = 1.5 + Math.random();
        enemyShot(w, e.x + e.w / 2, e.y + e.h, Math.PI / 2, 120, { color: PAL.yellow, size: [5, 5], gravity: 420, sfx: 'blast' });
      }
      break;
    }

    case 'spider': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        e.shootCd -= dt;
        if (e.shootCd <= 0 && canSeeTarget) {
          e.shootCd = 1.4 + Math.random() * 0.8;
          const a = aimAt(e, target);
          enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, a, 200, { color: PAL.green, size: [4, 4], gravity: 220 });
        }
      } else patrol(e, dt, level);
      break;
    }

    case 'mech': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        e.shootCd -= dt;
        e.aiT += dt;
        if (e.shootCd <= 0 && canSeeTarget) {
          e.shootCd = 2.1;
          const a = aimAt(e, target);
          for (let i = -1; i <= 1; i++)
            enemyShot(w, e.x + e.w / 2 + e.facing * 8, e.y + e.h * 0.36, a + i * 0.14, 300, {
              color: PAL.orange,
              size: [7, 4],
              sfx: 'blast',
            });
        }
        if (e.aiT > 3.4) {
          e.aiT = 0;
          e.vy = -260; // stomp
        }
      } else patrol(e, dt, level);
      break;
    }

    case 'roller': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
      } else e.vx = e.facing * e.def.speed * 0.5;
      if (e.onGround && (wallAhead(e as any, level, e.facing) || ledgeAhead(e as any, level, e.facing))) {
        e.facing = (-e.facing as 1 | -1);
        e.vx = e.facing * e.def.speed;
      }
      break;
    }

    case 'drone': {
      const tx = target ? target.x + target.w / 2 : e.homeX + 40;
      const ty = target ? target.y - 40 : e.homeY;
      e.facing = tx < e.x ? -1 : 1;
      e.vx += Math.sign(tx - e.x) * 120 * dt;
      e.vx = Math.max(-e.def.speed, Math.min(e.def.speed, e.vx));
      e.vy += Math.sign(ty - e.y) * 110 * dt;
      e.vy = Math.max(-e.def.speed, Math.min(e.def.speed, e.vy));
      e.shootCd -= dt;
      if (e.shootCd <= 0 && target && Math.abs(target.x - e.x) < 260) {
        e.shootCd = 2.2;
        e.burst = 3;
        e.aiT = 0;
        e.angle = aimAt(e, target);
      }
      if (e.burst > 0) {
        e.aiT -= dt;
        if (e.aiT <= 0) {
          e.aiT = 0.13;
          e.burst--;
          enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.5, e.angle, 420, { color: PAL.cyan, size: [9, 2], sfx: 'laser' });
        }
      }
      break;
    }

    case 'worm': {
      if (target) {
        e.facing = target.x + target.w / 2 < e.x ? -1 : 1;
        e.vx = e.facing * e.def.speed;
        e.shootCd -= dt;
        const d = Math.hypot(target.x - e.x, target.y - e.y);
        if (d < 30 && e.shootCd <= 0) {
          e.shootCd = 1.1;
          const a = aimAt(e, target);
          enemyShot(w, e.x + e.w / 2, e.y + e.h * 0.4, a, 260, { color: PAL.purple, size: [5, 4] });
        }
      } else patrol(e, dt, level);
      break;
    }

    default:
      patrol(e, dt, level);
  }

  /* ---------------- integrate ---------------- */
  if (e.flying || e.def.noGravity) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.y = Math.max(8, Math.min(level.pixelH - e.h - 4, e.y));
  } else {
    const body = { x: e.x, y: e.y, w: e.w, h: e.h, vx: e.vx, vy: e.vy };
    const r = moveAndCollide(body, level, dt, { oneWay: true });
    e.x = body.x;
    e.y = body.y;
    e.vx = body.vx;
    e.vy = body.vy;
    e.onGround = r.grounded;
    if (e.y > level.pixelH + 60) {
      e.dead = true;
      return;
    }
  }
  e.x = Math.max(0, Math.min(level.pixelW - e.w, e.x));

  /* ---------------- animation frames ---------------- */
  const moving = Math.abs(e.vx) > 8;
  if (e.def.kind === 'turret') {
    e.frame = 0;
  } else if (moving || e.flying || e.def.noGravity) {
    const n = Math.max(1, artFor(e.kind).length);
    e.frame = Math.floor(e.animT * (e.def.speed > 100 ? 14 : 8)) % n;
  } else {
    e.frame = 0;
  }
}

function patrol(e: Enemy, dt: number, level: any): void {
  void dt;
  if (e.def.speed === 0) {
    e.vx = 0;
    return;
  }
  e.state = 'patrol';
  e.vx = e.facing * e.def.speed * 0.5;
  if (e.onGround) {
    if (wallAhead(e as any, level, e.facing)) e.facing = -e.facing as 1 | -1;
    if (ledgeAhead(e as any, level, e.facing) && Math.random() < 0.06) e.facing = -e.facing as 1 | -1;
  }
}

/* ------------------------------------------------------------------ */
/* damage / death                                                      */
/* ------------------------------------------------------------------ */

export function damageEnemy(e: Enemy, dmg: number, w: WorldCtx, fromX: number, explosive = false): boolean {
  if (e.dead || e.state === 'death' || e.spawnGrace > 0) return false;
  // shield blocks frontal shots (unless explosive)
  if (e.def.ai === 'shield' && !explosive) {
    const fromFront = fromX > e.x ? 1 : -1;
    if (fromFront === e.facing) {
      w.particles.burst(e.x + e.w / 2 + e.facing * 8, e.y + e.h * 0.4, 4, [PAL.white, PAL.steel], 80, 0.2);
      w.audio.sfx('enemyHit');
      return false;
    }
  }
  e.hp -= dmg;
  e.hurtFlash = 0.12;
  w.audio.sfx('enemyHit');
  w.particles.burst(e.x + e.w / 2, e.y + e.h * 0.45, 3, [PAL.white, PAL.yellow], 60, 0.18);
  if (e.hp <= 0) {
    killEnemy(e, w, false);
    return true;
  }
  return false;
}

export function killEnemy(e: Enemy, w: WorldCtx, silentScore = false): void {
  if (e.state === 'death') return;
  e.state = 'death';
  e.stateT = 0;
  e.hp = 0;
  e.vy = -120;
  e.vx = -e.facing * 40;
  w.particles.explosion(e.x + e.w / 2, e.y + e.h / 2, e.w > 20 ? 22 : 12);
  w.audio.sfx(e.w > 20 ? 'explosion' : 'explosionSmall');
  w.shake(e.w > 20 ? 3 : 1.2, 0.2);
  if (!silentScore) w.addScore(e.def.score, 0);
  const drop = e.def.drop;
  if (drop && Math.random() < (e.def.dropChance ?? 0.3)) w.spawnPickup(e.x + e.w / 2 - 8, e.y, 'weapon', drop);
  else if (Math.random() < 0.06) w.spawnPickup(e.x + e.w / 2 - 8, e.y, 'life');
}

export function explodeEnemy(e: Enemy, w: WorldCtx, byContact: boolean): void {
  if (e.state === 'death') return;
  w.particles.explosion(e.x + e.w / 2, e.y + e.h / 2, 26);
  w.audio.sfx('explosion');
  w.shake(3.5, 0.25);
  if (byContact) w.addScore(e.def.score, 0);
  killEnemy(e, w, true);
}

/* ------------------------------------------------------------------ */
/* drawing                                                             */
/* ------------------------------------------------------------------ */

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, camY: number, debug = false): void {
  const sets = artFor(e.kind);
  const set = sets[Math.min(sets.length - 1, e.frame)] ?? sets[0];
  const dir = e.facing > 0 ? set.right : set.left;
  const spr = dir[0];
  const px = Math.round(e.x + e.w / 2 - spr.width / 2 - camX);
  const py = Math.round(e.y + e.h - spr.height - camY);

  ctx.save();
  if (e.state === 'death') {
    ctx.translate(px + spr.width / 2, py + spr.height);
    ctx.scale(1, -1);
    ctx.globalAlpha = Math.max(0, 1 - e.stateT / 0.5);
    ctx.drawImage(spr, -spr.width / 2, 0);
    ctx.restore();
    return;
  }
  ctx.drawImage(spr, px, py);
  if (e.hurtFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = PAL.white;
    ctx.fillRect(px, py, spr.width, spr.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // telegraph: sniper laser sight
  if (e.def.ai === 'sniper' && e.state === 'attack') {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PAL.red;
    const sx = e.x + e.w / 2 - camX;
    const sy = e.y + e.h * 0.4 - camY;
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(Math.cos(e.facing > 0 ? 0 : Math.PI) * 60), 1);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (debug) {
    ctx.strokeStyle = '#ff4466';
    ctx.strokeRect(Math.round(e.x - camX) + 0.5, Math.round(e.y - camY) + 0.5, e.w, e.h);
    if (e.def.ai === 'shield') {
      ctx.strokeStyle = '#66ccff';
      ctx.strokeRect(Math.round(e.x + e.w / 2 + e.facing * 6 - camX) + 0.5, Math.round(e.y - camY) + 0.5, 4, e.h);
    }
  }
}

export function updateEnemyBullets(w: WorldCtx, dt: number): void {
  for (const b of w.ebullets.active) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.gravity) b.vy += b.gravity * dt;
    b.life += dt;
    if (b.life >= b.maxLife) b.dead = true;
    else if (w.level.solidAt(b.x, b.y)) {
      b.dead = true;
      w.particles.burst(b.x, b.y, 2, [PAL.red, PAL.grey], 40, 0.12);
    }
  }
  w.ebullets.sweep((b) => b.dead);
}

export function spawnBulletForEnemy(w: WorldCtx, kind: string, x: number, y: number, angle: number): Bullet {
  const b = spawnBullet(w.ebullets, x, y, angle, {
    id: 'rifle',
    name: '',
    short: '',
    letter: '',
    color: PAL.red,
    damage: 1,
    interval: 0,
    count: 1,
    spread: 0,
    speed: 240,
    pierce: 0,
    explode: 0,
    homing: false,
    laser: false,
    size: [6, 3],
    ammo: -1,
    sfx: 'shoot',
    recoil: 0,
    desc: '',
  } as any, false, 0);
  b.weapon = kind;
  return b;
}

export { probeGround };
