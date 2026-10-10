import {
  DEATH_TIME,
  GRAVITY,
  INVULN_TIME,
  JUMP_CUT,
  JUMP_VELOCITY,
  LADDER_SPEED,
  MAX_FALL,
  PAL,
  PLAYER_ACCEL,
  PLAYER_AIR_ACCEL,
  PLAYER_FRICTION,
} from '../config/constants';
import { clamp } from '../core/math';
import type { InputState, WorldCtx } from '../core/world';
import type { Enemy } from './enemy';
import { moveAndCollide } from '../systems/collision';
import { spawnBullet, updateBullet } from './bullet';
import { weaponDef, type WeaponId } from '../weapons/weapons';
import { buildPlayerArt, CHAR_DEFS, type PlayerArt, type CharId } from '../gfx/sprites';
import { TILE } from '../config/constants';

export type PlayerState = 'alive' | 'dying' | 'dead' | 'victory';

/** Contra-paced run speed (NES run ≈ 7.5 tiles/s at 16px tiles). */
const BASE_SPEED = 122;

export class Player {
  index: 0 | 1;
  charId: CharId;
  art: PlayerArt;
  x = 0;
  y = 0;
  w = 12;
  h = 22;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  onGround = false;
  onLadder = false;
  crouching = false;
  grounded = false;
  state: PlayerState = 'alive';
  stateT = 0;
  animT = 0;
  frame = 0;
  lives = 3;
  hp = 3;
  maxHp = 3;
  score = 0;
  invuln = 0;
  hurtFlash = 0;
  fireCd = 0;
  coyote = 0;
  jumpBuf = 0;
  aimAngle = 0;
  muzzle = 0;
  weapon: WeaponId = 'rifle';
  ammo: Record<string, number> = {};
  kills = 0;
  deathCause = '';
  active = true;
  private wasGrounded = false;

  constructor(index: 0 | 1, charId: CharId) {
    this.index = index;
    this.charId = charId;
    this.art = buildPlayerArt(CHAR_DEFS.findIndex((c) => c.id === charId));
    this.h = CHAR_DEFS.find((c) => c.id === charId)!.opts.h - 2;
    this.w = 12;
    this.resetWeapon();
  }

  get def() {
    return CHAR_DEFS.find((c) => c.id === this.charId)!;
  }

  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  get alive(): boolean {
    return this.state === 'alive';
  }

  resetWeapon(): void {
    this.weapon = 'rifle';
    this.ammo = {};
  }

  giveWeapon(id: WeaponId): void {
    const def = weaponDef(id);
    this.weapon = id;
    if (def.ammo > 0) this.ammo[id] = def.ammo;
  }

  ammoLeft(): number {
    const def = weaponDef(this.weapon);
    if (def.ammo < 0) return Infinity;
    return this.ammo[this.weapon] ?? 0;
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'alive';
    this.stateT = 0;
    this.invuln = INVULN_TIME;
    this.onLadder = false;
    this.hp = this.maxHp;
  }

  /** Returns true when the hit was fatal. */
  hurt(w: WorldCtx, amount = 1, fromX?: number): boolean {
    if (this.state !== 'alive') return false;
    if (w.debug.invincible) return false;
    if (this.invuln > 0) return false;
    this.hp -= amount;
    this.hurtFlash = 0.35;
    if (fromX !== undefined) {
      this.vx = fromX < this.x ? 90 : -90;
      this.vy = Math.min(this.vy, -110);
    }
    if (this.hp <= 0) {
      this.kill(w, 'hit');
      return true;
    }
    this.invuln = 0.9;
    w.audio.sfx('hurt');
    w.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 6, [PAL.red, PAL.white], 90, 0.3);
    w.shake(2, 0.15);
    return false;
  }

  /* ------------------------------------------------------------------ */

  update(dt: number, input: InputState, w: WorldCtx): void {
    this.stateT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;

    if (this.state === 'dying') {
      this.vy += GRAVITY * dt;
      this.vy = Math.min(this.vy, MAX_FALL);
      moveAndCollide(this as any, w.level, dt, { oneWay: false });
      if (this.stateT >= DEATH_TIME) this.state = 'dead';
      return;
    }
    if (this.state === 'dead' || this.state === 'victory') {
      this.animT += dt;
      return;
    }

    const level = w.level;
    const speed = BASE_SPEED * this.def.speed;

    /* --- ladder --- */
    const cx = this.x + this.w / 2;
    const ladderHere = level.ladderAt(cx, this.y + this.h / 2);
    if (ladderHere && (input.up || input.down)) {
      this.onLadder = true;
    }
    if (this.onLadder) {
      const stillLadder = level.ladderAt(cx, this.y + this.h / 2) || level.ladderAt(cx, this.y + 2);
      if (!stillLadder || (!input.up && !input.down && this.grounded)) this.onLadder = false;
    }

    /* --- horizontal --- */
    const wantLeft = input.left && !this.crouching;
    const wantRight = input.right && !this.crouching;
    const accel = this.onGround ? PLAYER_ACCEL : PLAYER_AIR_ACCEL;
    if (this.onLadder) {
      this.vx = 0;
    } else if (wantLeft && !wantRight) {
      this.vx = Math.max(this.vx - accel * dt, -speed);
      this.facing = -1;
    } else if (wantRight && !wantLeft) {
      this.vx = Math.min(this.vx + accel * dt, speed);
      this.facing = 1;
    } else {
      const f = (this.onGround ? PLAYER_FRICTION : PLAYER_AIR_ACCEL * 0.5) * dt;
      this.vx = this.vx > 0 ? Math.max(0, this.vx - f) : Math.min(0, this.vx + f);
    }

    /* --- crouch --- */
    const canStand = !level.solidAt(this.x + 1, this.y - 8) && !level.solidAt(this.x + this.w - 1, this.y - 8);
    this.crouching = input.down && this.onGround && !this.onLadder;

    /* --- jump --- */
    if (input.jumpPressed) this.jumpBuf = 0.1;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.onGround || this.onLadder) this.coyote = 0.09;
    else if (this.coyote > 0) this.coyote -= dt;

    if (this.jumpBuf > 0 && (this.onGround || this.onLadder || this.coyote > 0) && !this.crouching) {
      this.vy = -JUMP_VELOCITY * this.def.jump;
      this.onGround = false;
      this.onLadder = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      w.audio.sfx('jump');
      w.particles.burst(cx, this.y + this.h, 4, [PAL.grey, PAL.white], 40, 0.22);
    }
    if (!input.jumpHeld && this.vy < 0) this.vy *= JUMP_CUT;

    /* --- gravity / ladder climb --- */
    if (this.onLadder) {
      this.vy = 0;
      const dir = input.up ? -1 : input.down ? 1 : 0;
      this.y += dir * LADDER_SPEED * dt;
      if (!level.ladderAt(cx, this.y + this.h / 2)) this.onLadder = false;
    } else {
      this.vy += GRAVITY * dt;
      this.vy = Math.min(this.vy, MAX_FALL);
    }

    /* --- move --- */
    const body = { x: this.x, y: this.y, w: this.w, h: this.h, vx: this.vx, vy: this.vy };
    const r2 = moveAndCollide(body, level, dt, {
      oneWay: !this.onLadder,
      dropThrough: input.down && input.jumpHeld,
    });
    this.x = body.x;
    this.y = body.y;
    this.vx = body.vx;
    this.vy = body.vy;
    this.onGround = r2.grounded;
    this.grounded = r2.grounded;
    if (r2.grounded && !this.wasGrounded) w.audio.sfx('land');
    this.wasGrounded = r2.grounded;
    this.x = clamp(this.x, 0, level.pixelW - this.w);

    /* --- falling out of the world --- */
    if (this.y > level.pixelH + 40) {
      this.kill(w, 'pit');
      return;
    }
    if (level.hazardAt(cx, this.y + this.h - 2)) {
      this.kill(w, 'spike');
      return;
    }

    /* --- aim --- */
    let ax = 0;
    let ay = 0;
    if (input.up) ay = -1;
    else if (input.down && !this.onGround) ay = 1;
    let horiz = 0;
    if (input.left && !input.right) horiz = -1;
    else if (input.right && !input.left) horiz = 1;
    if (ay !== 0) {
      ax = horiz; // keep straight up/down as 90° when no horizontal input
    } else {
      ax = horiz || this.facing;
    }
    if (this.crouching && this.onGround) {
      ay = 0;
      ax = horiz || this.facing;
    }
    if (ay !== 0 && ax !== 0) {
      this.aimAngle = Math.atan2(ay, ax); // 45-degree diagonals
    } else if (ay !== 0) {
      this.aimAngle = ay < 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      this.aimAngle = ax < 0 ? Math.PI : 0;
    }

    /* --- shoot --- */
    if (input.shootHeld && this.fireCd <= 0) this.fire(w);

    /* --- animation --- */
    this.animT += dt;
    const moving = Math.abs(this.vx) > 12;
    if (moving) this.frame = Math.floor(this.animT * 11) % 4;
    else this.frame = 0;
    void canStand;

    /* --- auto pickups handled by scene --- */
  }

  fire(w: WorldCtx): void {
    const def = weaponDef(this.weapon);
    if (!w.debug.infiniteAmmo && def.ammo > 0) {
      const left = this.ammo[this.weapon] ?? 0;
      if (left <= 0) {
        this.weapon = 'rifle';
        return;
      }
      this.ammo[this.weapon] = left - 1;
    }
    this.fireCd = def.interval;
    this.muzzle = 0.06;
    const dmgScale = this.def.damage;
    const ox = this.x + this.w / 2;
    const oy = this.y + (this.crouching ? this.h - 5 : this.h * 0.42);
    const spread = def.spread;
    const base = this.aimAngle;
    for (let i = 0; i < def.count; i++) {
      const off = (i - (def.count - 1) / 2) * spread;
      const b = spawnBullet(w.pbullets, ox - 3, oy - 1, base + off, def, true, this.index, dmgScale);
      if (def.homing) {
        let best: Enemy | null = null;
        let bd = Infinity;
        for (const e of w.enemies) {
          if (e.dead) continue;
          const dx = e.x - ox;
          const dy = e.y - oy;
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (best) b.target = { x: best.x, y: best.y, alive: true };
      }
    }
    w.audio.sfx(def.sfx);
    w.particles.spawn(
      ox + Math.cos(base) * 8,
      oy + Math.sin(base) * 8,
      Math.cos(base) * 60,
      Math.sin(base) * 60,
      0.1,
      PAL.yellow,
      2,
    );
    // recoil
    this.vx -= Math.cos(base) * def.recoil * this.def.recoil;
    if (this.onGround === false && def.recoil > 60) this.vy -= Math.sin(base) * def.recoil * 0.4;
  }

  kill(w: WorldCtx, cause = 'hit'): void {
    if (this.state !== 'alive') return;
    if (w.debug.invincible) return;
    if (this.invuln > 0) return;
    this.state = 'dying';
    this.stateT = 0;
    this.deathCause = cause;
    this.vy = -150;
    this.vx = -this.facing * 60;
    this.weapon = 'rifle';
    w.audio.sfx('death');
    w.particles.explosion(this.x + this.w / 2, this.y + this.h / 2, 16);
    w.shake(4, 0.3);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, debug = false): void {
    if (!this.active) return;
    if (this.invuln > 0 && this.state === 'alive' && Math.floor(this.invuln * 20) % 2 === 0) return;
    const a = this.art;
    let set: { right: HTMLCanvasElement[]; left: HTMLCanvasElement[] };
    if (this.state === 'dying' || this.state === 'dead') {
      set = a.dead[Math.min(1, Math.floor(this.stateT * 6))];
    } else if (this.state === 'victory') {
      set = a.victory;
    } else if (this.crouching) {
      set = a.crouch;
    } else if (this.onLadder) {
      set = a.climb[Math.floor(this.animT * 6) % 2];
    } else if (!this.onGround) {
      set = this.vy < 0 ? a.jump : a.fall;
    } else if (Math.abs(this.vx) > 12) {
      set = a.run[this.frame];
    } else {
      set = a.idle;
    }
    const dir = this.facing > 0 ? set.right : set.left;
    const spr = dir[0];
    const px = Math.round(this.x + this.w / 2 - spr.width / 2 - camX);
    const py = Math.round(this.y + this.h - spr.height - camY);

    if (this.hurtFlash > 0 && Math.floor(this.hurtFlash * 40) % 2 === 0) {
      ctx.globalAlpha = 0.6;
    }
    ctx.drawImage(spr, px, py);

    // arm + gun rotated to the aim direction (8 baked directions).
    // skipped for sprite-pack bodies: the sheet art already holds the rifle.
    if (this.state === 'alive' && !this.art.packActive) {
      const gi = Math.round(((-this.aimAngle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      const gun = a.gun[(gi + 8) % 8];
      const sx = this.x + this.w / 2 + (this.facing > 0 ? 1 : -1) - camX;
      const sy = this.y + (this.crouching ? this.h - 6 : this.h * 0.4) - camY;
      ctx.drawImage(gun, Math.round(sx - gun.width / 2), Math.round(sy - gun.height / 2));
    }
    if (this.state === 'alive' && this.muzzle > 0) {
      const sx = this.x + this.w / 2 - camX;
      const sy = this.y + (this.crouching ? this.h - 6 : this.h * 0.4) - camY;
      ctx.fillStyle = PAL.yellow;
      const mx = sx + Math.cos(this.aimAngle) * 10;
      const my = sy + Math.sin(this.aimAngle) * 10;
      ctx.fillRect(Math.round(mx - 2), Math.round(my - 2), 4, 4);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(Math.round(mx - 1), Math.round(my - 1), 2, 2);
    }
    ctx.globalAlpha = 1;

    if (debug) {
      ctx.strokeStyle = '#00ff88';
      ctx.strokeRect(Math.round(this.x - camX) + 0.5, Math.round(this.y - camY) + 0.5, this.w, this.h);
    }
  }
}

export function updatePlayerBullets(w: WorldCtx, dt: number): void {
  for (const b of w.pbullets.active) {
    updateBullet(b, dt);
    if (b.dead) continue;
    if (w.level.solidAt(b.x, b.y)) {
      b.dead = true;
      w.particles.burst(b.x, b.y, 3, [PAL.yellow, PAL.grey], 40, 0.15);
    }
  }
  w.pbullets.sweep((b) => b.dead);
}
