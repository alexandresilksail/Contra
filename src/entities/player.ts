import {
  DEATH_TIME,
  GRAVITY,
  HURT_TIME,
  INVULN_TIME,
  JUMP_CUT,
  JUMP_VELOCITY,
  LADDER_SPEED,
  LAND_TIME,
  MAX_FALL,
  PAL,
  PLAYER_ACCEL,
  PLAYER_AIR_ACCEL,
  PLAYER_FRICTION,
  SHOOT_ANIM_TIME,
} from '../config/constants';
import {
  animFrame,
  animTag,
  resolveMoveState,
  type AnimTag,
  type MoveState,
} from './playerState';
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
  /** Lifecycle state (scene / respawn / HUD depend on these values). */
  state: PlayerState = 'alive';
  stateT = 0;
  /** Locomotion pose, resolved from real physics every fixed step. */
  moveState: MoveState = 'idle';
  animT = 0;
  frame = 0;
  /** >0 while the "firing" pose is held (combines with any locomotion pose). */
  shootT = 0;
  /** >0 during hit-stun / knockback. */
  hurtT = 0;
  /** >0 just after touching down. */
  landT = 0;
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
    this.moveState = 'idle';
    this.animT = 0;
    this.frame = 0;
    this.shootT = 0;
    this.hurtT = 0;
    this.landT = 0;
    this.hurtFlash = 0;
    this.aimAngle = 0;
  }

  /** Rendered animation tag, e.g. RUN or SHOOT_JUMP. Used by tests + HUD. */
  get anim(): AnimTag {
    return animTag(this.moveState, this.shootT > 0 && this.state === 'alive');
  }

  /** How many frames the active art set actually has for a pose. */
  private frameCount(s: MoveState): number {
    const a = this.art;
    switch (s) {
      case 'run':
        return Math.max(1, a.run.length);
      case 'climb':
        return Math.max(1, a.climb.length);
      case 'dead':
        return Math.max(1, a.dead.length);
      default:
        return 1;
    }
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
    // non-fatal: hit-stun pose + knockback before control returns
    this.hurtT = HURT_TIME;
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
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.shootT > 0) this.shootT -= dt;
    if (this.landT > 0) this.landT -= dt;

    if (this.state === 'dying') {
      this.vy += GRAVITY * dt;
      this.vy = Math.min(this.vy, MAX_FALL);
      moveAndCollide(this as any, w.level, dt, { oneWay: false });
      this.moveState = 'dead';
      this.animT += dt;
      this.frame = animFrame(this.moveState, this.animT, this.frameCount(this.moveState));
      if (this.stateT >= DEATH_TIME) this.state = 'dead';
      return;
    }
    if (this.state === 'dead' || this.state === 'victory') {
      this.moveState = this.state === 'victory' ? 'victory' : 'dead';
      this.animT += dt;
      this.frame = animFrame(this.moveState, this.animT, this.frameCount(this.moveState));
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
    if (r2.grounded && !this.wasGrounded) {
      w.audio.sfx('land');
      this.landT = LAND_TIME;
    }
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
    /* --- drowning: Stage-1 water is lethal on contact, like the original --- */
    if (level.deadlyWater &&
        (level.waterAt(cx, this.y + this.h * 0.5) || level.waterAt(cx, this.y + this.h - 2))) {
      this.kill(w, 'water');
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

    /* --- animation state machine -------------------------------------
     * The pose is derived from REAL physics every step, and the cycle only
     * restarts when the pose actually changes (so a run always begins on its
     * first stride instead of resuming a stale frame counter).
     * ------------------------------------------------------------------ */
    // TS narrows this.state to 'alive' after the early returns above; keep the
    // full union so the resolver stays honest if a new lifecycle state appears.
    const life = this.state as PlayerState;
    const next = resolveMoveState({
      dying: life === 'dying',
      dead: life === 'dead',
      victory: life === 'victory',
      hurtT: this.hurtT,
      onLadder: this.onLadder,
      onGround: this.onGround,
      crouching: this.crouching,
      vy: this.vy,
      vx: this.vx,
    });
    if (next !== this.moveState) {
      this.moveState = next;
      this.animT = 0;
      this.frame = 0;
    }
    this.animT += dt;
    this.frame = animFrame(this.moveState, this.animT, this.frameCount(this.moveState));
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
    // hold the armed pose briefly; it combines with run/jump/crouch/climb
    this.shootT = SHOOT_ANIM_TIME;
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
    // Recoil: full kick in the air (that is what makes air control matter);
    // on the ground the commando braces, so it stays a nudge and does not flip
    // the pose from IDLE to RUN on its own.
    const recoilScale = this.onGround ? 0.3 : 1;
    this.vx -= Math.cos(base) * def.recoil * this.def.recoil * recoilScale;
    if (!this.onGround && def.recoil > 60) this.vy -= Math.sin(base) * def.recoil * 0.4;
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
    // firing COMBINES with locomotion (as in the original); it never replaces it
    const armed = this.state === 'alive' && this.shootT > 0;
    let set: { right: HTMLCanvasElement[]; left: HTMLCanvasElement[] };
    switch (this.moveState) {
      case 'dead':
        set = a.dead[Math.min(this.frame, a.dead.length - 1)] ?? a.dead[0];
        break;
      case 'victory':
        set = a.victory;
        break;
      case 'hurt':
        set = a.hurt;
        break;
      case 'climb': {
        const c = armed ? a.shoot.climb : a.climb;
        set = c[Math.min(this.frame, c.length - 1)] ?? c[0];
        break;
      }
      case 'crouch':
        set = armed ? a.shoot.crouch : a.crouch;
        break;
      case 'jump':
        set = armed ? a.shoot.jump : a.jump;
        break;
      case 'fall':
        set = armed ? a.shoot.fall : a.fall;
        break;
      case 'run': {
        const r = armed ? a.shoot.run : a.run;
        set = r[Math.min(this.frame, r.length - 1)] ?? r[0];
        break;
      }
      default:
        set = armed ? a.shoot.idle : a.idle;
    }
    const dir = this.facing > 0 ? set.right : set.left;
    const spr = dir[0] ?? set.right[0];
    const px = Math.round(this.x + this.w / 2 - spr.width / 2 - camX);
    const py = Math.round(this.y + this.h - spr.height - camY);

    if (this.hurtFlash > 0 && Math.floor(this.hurtFlash * 40) % 2 === 0) {
      ctx.globalAlpha = 0.6;
    }
    ctx.drawImage(spr, px, py);

    // Arm + gun rotated to the live aim angle, anchored at the shoulder so the
    // weapon stays attached to the hand in all 8 directions. Skipped for
    // sprite-pack bodies: the sheet art already holds the rifle.
    if (this.state === 'alive' && !this.art.packActive) {
      const gi = Math.round(((-this.aimAngle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      const gun = a.gun[(gi + 8) % 8];
      const o = this.def.opts;
      const sx = Math.round(this.x + this.w / 2 + (this.facing > 0 ? 1 : -1) - camX);
      const sy = Math.round(this.y + (this.crouching ? this.h * 0.5 : this.h * 0.42) - camY);
      ctx.strokeStyle = o.skin;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(this.aimAngle) * 5, sy + Math.sin(this.aimAngle) * 5);
      ctx.stroke();
      ctx.drawImage(
        gun,
        Math.round(sx + Math.cos(this.aimAngle) * 6 - gun.width / 2),
        Math.round(sy + Math.sin(this.aimAngle) * 6 - gun.height / 2),
      );
    }
    if (this.state === 'alive' && this.muzzle > 0) {
      const sx = this.x + this.w / 2 - camX;
      const sy = this.y + (this.crouching ? this.h * 0.5 : this.h * 0.42) - camY;
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
      // Explosive ordnance detonates on impact (this is what lets the player
      // blow a hole in a Stage-1 bridge deck); plain rounds just spark out.
      if (b.explode > 0) w.explode(b.x, b.y, b.explode, b.dmg);
      else w.particles.burst(b.x, b.y, 3, [PAL.yellow, PAL.grey], 40, 0.15);
      b.dead = true;
    }
  }
  w.pbullets.sweep((b) => b.dead);
}
