import { Pool } from '../core/pool';
import { PAL } from '../config/constants';
import type { WeaponDef } from '../weapons/weapons';

export class Bullet {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  w = 6;
  h = 3;
  dmg = 10;
  pierce = 0;
  life = 0;
  maxLife = 2.2;
  friendly = true;
  weapon = 'rifle';
  explode = 0;
  homing = false;
  laser = false;
  color = PAL.yellow;
  gravity = 0;
  target: { x: number; y: number; alive: boolean } | null = null;
  hitIds: number[] = [];
  angle = 0;
  dead = false;
  trail = 0;
  ownerIndex = 0;

  reset(): void {
    this.active = true;
    this.dead = false;
    this.life = 0;
    this.hitIds.length = 0;
    this.target = null;
    this.gravity = 0;
    this.trail = 0;
    this.angle = 0;
  }

  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

export function makeBulletPool(prealloc = 220): Pool<Bullet> {
  return new Pool<Bullet>(
    () => new Bullet(),
    (b) => b.reset(),
    prealloc,
  );
}

export function spawnBullet(
  pool: Pool<Bullet>,
  x: number,
  y: number,
  angle: number,
  def: WeaponDef,
  friendly: boolean,
  ownerIndex = 0,
  damageScale = 1,
): Bullet {
  const b = pool.spawn();
  b.x = x;
  b.y = y;
  b.angle = angle;
  b.vx = Math.cos(angle) * def.speed;
  b.vy = Math.sin(angle) * def.speed;
  b.w = def.size[0];
  b.h = def.size[1];
  b.dmg = def.damage * damageScale;
  b.pierce = def.pierce;
  b.explode = def.explode;
  b.homing = def.homing;
  b.laser = def.laser;
  b.color = def.color;
  b.weapon = def.id;
  b.friendly = friendly;
  b.ownerIndex = ownerIndex;
  b.maxLife = def.laser ? 0.55 : 2.2;
  b.gravity = def.id === 'blast' ? 260 : 0;
  return b;
}

export function updateBullet(b: Bullet, dt: number): void {
  if (b.homing && b.target && b.target.alive) {
    const desired = Math.atan2(b.target.y - b.y, b.target.x - b.x);
    let diff = desired - b.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    b.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
    const sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(b.angle) * sp;
    b.vy = Math.sin(b.angle) * sp;
  }
  if (b.gravity) b.vy += b.gravity * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life += dt;
  if (b.life >= b.maxLife) b.dead = true;
}

export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, camX: number, camY: number): void {
  const x = Math.round(b.x - camX);
  const y = Math.round(b.y - camY);
  if (b.laser) {
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y + 1, b.w - 4, 1);
    return;
  }
  if (b.homing) {
    ctx.fillStyle = PAL.steelDark;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x + 1, y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(x + b.w - 2, y + 1, 2, 1);
    return;
  }
  ctx.fillStyle = b.color;
  ctx.fillRect(x, y, b.w, b.h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, y, Math.max(1, b.w - 2), 1);
}
