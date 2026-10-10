import { GRAVITY, PAL } from '../config/constants';
import type { WorldCtx } from '../core/world';
import { buildCapsule, buildHeart } from '../gfx/sprites';
import type { WeaponId } from '../weapons/weapons';
import { weaponDef, WEAPON_ORDER } from '../weapons/weapons';
import { packPickupIcon } from '../gfx/pack';
import { moveAndCollide } from '../systems/collision';
import { drawText } from '../gfx/font';

export type PickupKind = 'weapon' | 'life' | 'score';

export class Pickup {
  x = 0;
  y = 0;
  w = 18;
  h = 16;
  vx = 0;
  vy = -60;
  kind: PickupKind = 'weapon';
  weapon: WeaponId = 'rapid';
  animT = 0;
  life = 14;
  dead = false;
  landed = false;

  reset(kind: PickupKind, x: number, y: number, weapon?: WeaponId): void {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.weapon = weapon ?? 'rapid';
    this.vx = 0;
    this.vy = -60;
    this.animT = 0;
    this.life = 14;
    this.dead = false;
    this.landed = false;
  }
}

const capsuleCache = new Map<string, HTMLCanvasElement[]>();
function capsule(weapon: WeaponId): HTMLCanvasElement[] {
  let c = capsuleCache.get(weapon);
  if (!c) {
    c = buildCapsule(weaponDef(weapon).color, weaponDef(weapon).letter);
    capsuleCache.set(weapon, c);
  }
  return c;
}
let heartSprite: HTMLCanvasElement | null = null;
function heart(): HTMLCanvasElement {
  if (!heartSprite) heartSprite = buildHeart();
  return heartSprite;
}

export function updatePickup(p: Pickup, dt: number, w: WorldCtx): void {
  p.animT += dt;
  p.life -= dt;
  if (p.life <= 0) {
    p.dead = true;
    return;
  }
  if (!p.landed) {
    p.vy += GRAVITY * dt;
    const body = { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy };
    const r = moveAndCollide(body, w.level, dt, { oneWay: true });
    p.x = body.x;
    p.y = body.y;
    p.vx = body.vx;
    p.vy = body.vy;
    if (r.grounded) {
      p.landed = true;
      p.vy = 0;
    }
    if (p.y > w.level.pixelH + 40) p.dead = true;
  } else {
    // gentle hover bob so it is easy to spot
    p.y += Math.sin(p.animT * 4) * 12 * dt;
  }
}

export function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup, camX: number, camY: number): void {
  const blink = p.life < 3 && Math.floor(p.life * 8) % 2 === 0;
  if (blink) return;
  const x = Math.round(p.x - camX);
  const y = Math.round(p.y - camY);
  if (p.kind === 'weapon') {
    const wdef = weaponDef(p.weapon);
    // Capsule background: sheet sprite when present, else procedural capsule.
    const icon = packPickupIcon(Math.max(0, WEAPON_ORDER.indexOf(p.weapon)));
    if (icon) {
      ctx.drawImage(icon, Math.round(x + (p.w - icon.width) / 2), Math.round(y + (p.h - icon.height) / 2));
    } else {
      const frames = capsule(p.weapon);
      const spr = frames[Math.floor(p.animT * 8) % frames.length];
      ctx.drawImage(spr, x, y);
    }
    // Authoritative letter overlay (correct for all 7 weapons, independent of
    // the sheet's baked glyph, which only has 5 cells and mismatched letters).
    drawText(ctx, wdef.letter, x + p.w / 2, y + p.h - 7, {
      color: PAL.white,
      shadow: PAL.black,
      align: 'center',
      scale: 1,
    });
  } else if (p.kind === 'life') {
    const spr = heart();
    ctx.drawImage(spr, x + 3, y + 3);
  } else {
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(x + 3, y + 3, 12, 10);
    drawText(ctx, '$', x + p.w / 2, y + 4, { color: PAL.black, align: 'center' });
  }
}
