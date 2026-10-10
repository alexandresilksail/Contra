import { PAL, TILE } from '../config/constants';
import type { WorldCtx } from '../core/world';
import { buildBossArt, type BossArt } from '../gfx/sprites';
import { packBossWall, packReady } from '../gfx/pack';
import type { Player } from './player';

export type Atk =
  | { t: 'spread'; n: number; arc: number; speed: number; dur: number; iv: number }
  | { t: 'aimed'; n: number; arc: number; speed: number; dur: number; iv: number }
  | { t: 'ring'; n: number; speed: number; dur: number; iv: number }
  | { t: 'rain'; n: number; speed: number; dur: number; iv: number }
  | { t: 'wall'; n: number; speed: number; dur: number; iv: number }
  | { t: 'bombs'; n: number; speed: number; dur: number; iv: number }
  | { t: 'laser'; n: number; speed: number; dur: number; iv: number }
  | { t: 'summon'; kind: string; n: number; dur: number; iv: number }
  | { t: 'charge'; speed: number; dur: number; iv: number };

export interface BossDef {
  id: string;
  name: string;
  hp: number;
  w: number;
  h: number;
  move: 'walk' | 'hover' | 'bob' | 'static';
  speed: number;
  weak: [number, number]; // weak point offset (relative to centre)
  phases: Atk[][];
  minions: string[];
}

const A = {
  aimed: (n: number, arc: number, speed: number, dur: number, iv: number): Atk => ({ t: 'aimed', n, arc, speed, dur, iv }),
  spread: (n: number, arc: number, speed: number, dur: number, iv: number): Atk => ({ t: 'spread', n, arc, speed, dur, iv }),
  ring: (n: number, speed: number, dur: number, iv: number): Atk => ({ t: 'ring', n, speed, dur, iv }),
  rain: (n: number, speed: number, dur: number, iv: number): Atk => ({ t: 'rain', n, speed, dur, iv }),
  wall: (n: number, speed: number, dur: number, iv: number): Atk => ({ t: 'wall', n, speed, dur, iv }),
  bombs: (n: number, speed: number, dur: number, iv: number): Atk => ({ t: 'bombs', n, speed, dur, iv }),
  laser: (n: number, speed: number, dur: number, iv: number): Atk => ({ t: 'laser', n, speed, dur, iv }),
  summon: (kind: string, n: number, dur: number, iv: number): Atk => ({ t: 'summon', kind, n, dur, iv }),
  charge: (speed: number, dur: number, iv: number): Atk => ({ t: 'charge', speed, dur, iv }),
};

export const BOSS_DEFS: Record<string, BossDef> = {
  commander: {
    id: 'commander',
    name: 'DEFENSE WALL',
    hp: 100,
    // matches the wall sprite (223x192 sheet at 0.55 scale -> ~123x106)
    w: 122,
    h: 105,
    move: 'static',
    speed: 0,
    // glowing core on the sheet maps here relative to the box centre
    weak: [-34, 10],
    minions: ['grunt', 'runner'],
    phases: [
      [A.aimed(3, 0.2, 250, 2.6, 0.7), A.spread(5, 0.9, 230, 2.4, 0.55)],
      [A.spread(5, 0.9, 230, 2.4, 0.55), A.aimed(3, 0.14, 280, 2.0, 0.6), A.summon('grunt', 2, 1.0, 1.0)],
      [A.spread(7, 1.2, 250, 2.6, 0.42), A.ring(14, 200, 2.0, 0.6), A.aimed(4, 0.18, 290, 1.8, 0.5), A.summon('heavy', 1, 0.8, 0.8)],
    ],
  },
  guardian: {
    id: 'guardian',
    name: 'FOREST GUARDIAN',
    hp: 130,
    w: 74,
    h: 68,
    move: 'walk',
    speed: 52,
    weak: [0, -18],
    minions: ['spider', 'jumper'],
    phases: [
      [A.summon('spider', 2, 1.2, 1.2), A.bombs(3, 170, 2.4, 0.5)],
      [A.spread(5, 1.0, 240, 2.4, 0.5), A.charge(200, 1.8, 1.8), A.bombs(4, 190, 2.0, 0.4)],
      [A.ring(16, 210, 2.2, 0.5), A.bombs(5, 210, 2.2, 0.34), A.summon('jumper', 2, 1.0, 1.0), A.charge(240, 1.6, 1.6)],
    ],
  },
  crawler: {
    id: 'crawler',
    name: 'FOUNDRY CRAWLER',
    hp: 160,
    w: 86,
    h: 52,
    move: 'walk',
    speed: 58,
    weak: [-30, -12],
    minions: ['roller', 'grunt'],
    phases: [
      [A.wall(6, 210, 2.4, 0.9), A.aimed(3, 0.16, 280, 2.0, 0.6)],
      [A.laser(4, 380, 2.2, 0.25), A.wall(7, 230, 2.4, 0.7)],
      [A.ring(18, 230, 2.2, 0.45), A.wall(8, 250, 2.6, 0.6), A.laser(5, 420, 2.0, 0.2)],
    ],
  },
  worm: {
    id: 'worm',
    name: 'CAVERN MAW',
    hp: 190,
    w: 80,
    h: 58,
    move: 'walk',
    speed: 62,
    weak: [24, -16],
    minions: ['worm', 'spider'],
    phases: [
      [A.bombs(4, 180, 2.4, 0.45), A.aimed(3, 0.18, 300, 2.2, 0.55)],
      [A.rain(6, 200, 2.6, 0.35), A.spread(5, 0.9, 250, 2.2, 0.5)],
      [A.ring(20, 240, 2.2, 0.4), A.rain(8, 230, 2.4, 0.3), A.bombs(5, 210, 2.0, 0.35)],
    ],
  },
  gunship: {
    id: 'gunship',
    name: 'SKY GUNSHIP',
    hp: 220,
    w: 94,
    h: 44,
    move: 'hover',
    speed: 74,
    weak: [0, 8],
    minions: ['flyer', 'drone'],
    phases: [
      [A.rain(5, 210, 2.4, 0.4), A.aimed(3, 0.16, 300, 2.2, 0.5)],
      [A.bombs(4, 200, 2.4, 0.4), A.spread(5, 1.0, 260, 2.2, 0.45)],
      [A.rain(8, 240, 2.6, 0.3), A.ring(18, 250, 2.2, 0.42), A.laser(4, 420, 1.8, 0.22)],
    ],
  },
  frostcore: {
    id: 'frostcore',
    name: 'FROST CORE',
    hp: 250,
    w: 70,
    h: 70,
    move: 'bob',
    speed: 40,
    weak: [0, -6],
    minions: ['drone', 'heavy'],
    phases: [
      [A.ring(14, 220, 2.4, 0.55), A.aimed(3, 0.2, 280, 2.0, 0.6)],
      [A.ring(18, 240, 2.4, 0.45), A.wall(7, 240, 2.4, 0.6)],
      [A.ring(22, 260, 2.4, 0.35), A.laser(5, 440, 2.0, 0.2), A.summon('drone', 2, 1.0, 1.0)],
    ],
  },
  hivemind: {
    id: 'hivemind',
    name: 'HIVE MIND',
    hp: 280,
    w: 82,
    h: 74,
    move: 'hover',
    speed: 56,
    weak: [-14, -20],
    minions: ['spider', 'worm', 'bomber'],
    phases: [
      [A.summon('spider', 2, 1.2, 1.2), A.aimed(4, 0.2, 290, 2.2, 0.5)],
      [A.summon('worm', 2, 1.2, 1.2), A.ring(16, 240, 2.4, 0.45)],
      [A.summon('bomber', 3, 1.2, 1.2), A.ring(20, 260, 2.4, 0.36), A.rain(8, 240, 2.4, 0.3)],
    ],
  },
  doomcore: {
    id: 'doomcore',
    name: 'DOOM CORE',
    hp: 340,
    w: 102,
    h: 86,
    move: 'static',
    speed: 30,
    weak: [0, -26],
    minions: ['heavy', 'mech'],
    phases: [
      [A.wall(7, 230, 2.4, 0.8), A.aimed(4, 0.18, 320, 2.2, 0.45), A.laser(4, 400, 1.8, 0.24)],
      [A.ring(22, 250, 2.4, 0.36), A.wall(8, 250, 2.4, 0.55), A.bombs(5, 220, 2.2, 0.34)],
      [A.ring(26, 270, 2.6, 0.3), A.laser(6, 460, 2.2, 0.18), A.rain(10, 250, 2.6, 0.26), A.summon('heavy', 2, 1.0, 1.0)],
    ],
  },
};

export type BossState = 'entry' | 'fight' | 'dying' | 'dead';

export class Boss {
  def: BossDef;
  art: BossArt;
  x = 0;
  y = 0;
  hp: number;
  maxHp: number;
  phase = 0;
  state: BossState = 'entry';
  stateT = 0;
  atk = 0;
  atkT = 0;
  fireT = 0;
  pauseT = 0;
  hurtFlash = 0;
  invuln = 0;
  facing: 1 | -1 = -1;
  frame = 0;
  animT = 0;
  bobT = 0;
  weakT = 0;
  weakX = 0;
  weakY = 0;
  arenaLeft = 0;
  arenaRight = 0;
  chargeDir = 0;
  chargeT = 0;
  name: string;

  constructor(def: BossDef, x: number, y: number) {
    this.def = def;
    this.name = def.name;
    this.art = buildBossArt(def.id);
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.x = x;
    this.y = y;
  }

  get w(): number {
    return this.def.w;
  }
  get h(): number {
    return this.def.h;
  }
  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  get alive(): boolean {
    return this.state === 'entry' || this.state === 'fight';
  }
  hpRatio(): number {
    return Math.max(0, this.hp / this.maxHp);
  }
  weakBox(): { x: number; y: number; w: number; h: number } {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    return { x: cx + this.weakX - 7, y: cy + this.weakY - 7, w: 14, h: 14 };
  }
}

export function updateBoss(b: Boss, dt: number, w: WorldCtx, players: Player[]): void {
  b.stateT += dt;
  b.animT += dt;
  if (b.hurtFlash > 0) b.hurtFlash -= dt;
  if (b.invuln > 0) b.invuln -= dt;
  b.frame = Math.floor(b.animT * 3) % 3;

  const target = players.find((p) => p.alive) ?? null;

  if (b.state === 'entry') {
    const targetY = b.arenaRight ? b.y : b.y;
    void targetY;
    b.y += 60 * dt;
    if (b.stateT > 1.6) {
      b.state = 'fight';
      b.stateT = 0;
      b.invuln = 0.4;
      w.audio.sfx('alarm');
    }
    return;
  }

  if (b.state === 'dying') {
    if (Math.floor(b.stateT * 6) !== Math.floor((b.stateT - dt) * 6)) {
      const rx = b.x + Math.random() * b.w;
      const ry = b.y + Math.random() * b.h;
      w.particles.explosion(rx, ry, 22);
      w.audio.sfx('explosion');
      w.shake(5, 0.3);
    }
    if (b.stateT > 2.4) b.state = 'dead';
    return;
  }
  if (b.state === 'dead') return;

  /* ---- phase transition ---- */
  const ratio = b.hpRatio();
  const wantPhase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
  if (wantPhase > b.phase) {
    b.phase = wantPhase;
    b.atk = 0;
    b.atkT = 0;
    b.fireT = 0;
    b.pauseT = 0.9;
    b.invuln = 0.6;
    w.audio.sfx('alarm');
    w.particles.burst(b.x + b.w / 2, b.y + b.h / 2, 26, [PAL.white, PAL.yellow, PAL.orange], 150, 0.6);
    w.shake(4, 0.35);
    w.audio.setIntensity(1 + b.phase * 0.09);
  }

  /* ---- weak point drift ---- */
  b.weakT += dt;
  const wx = b.def.weak[0] + Math.sin(b.weakT * 1.4) * 12;
  const wy = b.def.weak[1] + Math.cos(b.weakT * 1.1) * 8;
  b.weakX = wx;
  b.weakY = wy;

  /* ---- movement ---- */
  if (target) b.facing = target.x + target.w / 2 < b.x + b.w / 2 ? -1 : 1;
  switch (b.def.move) {
    case 'walk': {
      const dir = target ? Math.sign(target.x + target.w / 2 - (b.x + b.w / 2)) || 1 : -1;
      b.x += dir * b.def.speed * dt;
      break;
    }
    case 'hover': {
      const tx = target ? target.x + target.w / 2 : b.x + b.w / 2;
      b.x += Math.sign(tx - (b.x + b.w / 2)) * b.def.speed * dt;
      b.bobT += dt;
      b.y += Math.sin(b.bobT * 2.2) * 26 * dt;
      break;
    }
    case 'bob': {
      b.bobT += dt;
      const cx = (b.arenaLeft + b.arenaRight) / 2 - b.w / 2;
      b.x += (cx + Math.sin(b.bobT * 0.8) * 90 - b.x) * dt * 0.9;
      b.y += Math.sin(b.bobT * 1.7) * 30 * dt;
      break;
    }
    default: {
      b.bobT += dt;
      const cx = (b.arenaLeft + b.arenaRight) / 2 - b.w / 2;
      b.x += (cx - b.x) * dt * 0.7;
      break;
    }
  }

  /* ---- charge attack override ---- */
  if (b.chargeT > 0) {
    b.chargeT -= dt;
    b.x += b.chargeDir * 260 * dt;
  }

  b.x = Math.max(b.arenaLeft + 4, Math.min(b.arenaRight - b.w - 4, b.x));
  b.y = Math.max(20, Math.min(430, b.y));

  /* ---- attack script ---- */
  const script = b.def.phases[Math.min(2, b.phase)];
  if (b.pauseT > 0) {
    b.pauseT -= dt;
    return;
  }
  const atk = script[b.atk % script.length];
  b.atkT += dt;
  b.fireT -= dt;
  if (b.fireT <= 0) {
    b.fireT = atk.iv;
    execAttack(b, atk, w, target);
  }
  if (b.atkT >= atk.dur) {
    b.atkT = 0;
    b.atk = (b.atk + 1) % script.length;
    b.pauseT = 0.45;
    b.fireT = 0.2;
  }
}

function shoot(w: WorldCtx, x: number, y: number, angle: number, speed: number, color = PAL.red, size: [number, number] = [6, 3]): void {
  const b = w.ebullets.spawn();
  b.x = x;
  b.y = y;
  b.angle = angle;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.w = size[0];
  b.h = size[1];
  b.dmg = 1;
  b.pierce = 0;
  b.color = color;
  b.friendly = false;
  b.maxLife = 4;
  b.laser = false;
  b.homing = false;
  b.explode = 0;
  b.gravity = 0;
  b.hitIds.length = 0;
}

function execAttack(b: Boss, atk: Atk, w: WorldCtx, target: Player | null): void {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h * 0.45;
  switch (atk.t) {
    case 'aimed': {
      if (!target) return;
      const base = Math.atan2(target.y + target.h / 2 - cy, target.x + target.w / 2 - cx);
      for (let i = 0; i < atk.n; i++) {
        const off = (i - (atk.n - 1) / 2) * atk.arc;
        shoot(w, cx, cy, base + off, atk.speed, PAL.orange, [7, 4]);
      }
      w.audio.sfx('shoot');
      break;
    }
    case 'spread': {
      const base = b.facing > 0 ? 0.15 : Math.PI - 0.15;
      for (let i = 0; i < atk.n; i++) {
        const a = base - (atk.arc / 2) + (atk.arc / Math.max(1, atk.n - 1)) * i;
        shoot(w, cx, cy, a, atk.speed, PAL.yellow, [6, 4]);
      }
      w.audio.sfx('spread');
      break;
    }
    case 'ring': {
      const off = b.animT * 0.7;
      for (let i = 0; i < atk.n; i++) {
        const a = off + (i / atk.n) * Math.PI * 2;
        shoot(w, cx, cy, a, atk.speed, PAL.magenta, [5, 5]);
      }
      w.audio.sfx('blast');
      break;
    }
    case 'rain': {
      for (let i = 0; i < atk.n; i++) {
        const px = b.arenaLeft + Math.random() * (b.arenaRight - b.arenaLeft);
        shoot(w, px, b.y - 10, Math.PI / 2 + (Math.random() - 0.5) * 0.2, atk.speed, PAL.cyan, [5, 6]);
      }
      w.audio.sfx('shoot');
      break;
    }
    case 'wall': {
      const gap = Math.floor(Math.random() * atk.n);
      for (let i = 0; i < atk.n; i++) {
        if (i === gap) continue;
        const px = b.arenaLeft + 24 + i * ((b.arenaRight - b.arenaLeft - 48) / (atk.n - 1));
        shoot(w, px, b.y - 8, Math.PI / 2, atk.speed, PAL.red, [6, 8]);
      }
      w.audio.sfx('pierce');
      break;
    }
    case 'bombs': {
      for (let i = 0; i < atk.n; i++) {
        const px = cx + (Math.random() - 0.5) * b.w;
        const bl = w.ebullets.spawn();
        bl.x = px;
        bl.y = cy;
        bl.vx = (Math.random() - 0.5) * 90;
        bl.vy = 60;
        bl.gravity = 420;
        bl.w = 6;
        bl.h = 6;
        bl.color = PAL.yellow;
        bl.friendly = false;
        bl.maxLife = 3;
        bl.dmg = 1;
        bl.hitIds.length = 0;
      }
      w.audio.sfx('blast');
      break;
    }
    case 'laser': {
      if (!target) return;
      const a = Math.atan2(target.y + target.h / 2 - cy, target.x + target.w / 2 - cx);
      for (let i = 0; i < atk.n; i++) {
        const bl = w.ebullets.spawn();
        bl.x = cx;
        bl.y = cy;
        bl.vx = Math.cos(a) * (atk.speed + i * 60);
        bl.vy = Math.sin(a) * (atk.speed + i * 60);
        bl.w = 12;
        bl.h = 3;
        bl.color = PAL.magenta;
        bl.laser = true;
        bl.friendly = false;
        bl.maxLife = 1.4;
        bl.dmg = 1;
        bl.hitIds.length = 0;
      }
      w.audio.sfx('laser');
      break;
    }
    case 'summon': {
      for (let i = 0; i < atk.n; i++) {
        const px = b.arenaLeft + 30 + Math.random() * (b.arenaRight - b.arenaLeft - 60);
        w.spawnEnemy(atk.kind, px, b.y + b.h - 10, -1);
      }
      w.audio.sfx('alarm');
      break;
    }
    case 'charge': {
      b.chargeDir = b.facing;
      b.chargeT = 0.55;
      w.audio.sfx('door');
      w.shake(3, 0.2);
      break;
    }
  }
}

export function damageBoss(b: Boss, dmg: number, w: WorldCtx, x: number, y: number, explosive: boolean): boolean {
  if (b.state !== 'fight' || b.invuln > 0) return false;
  const wb = b.weakBox();
  const weak = x >= wb.x && x <= wb.x + wb.w && y >= wb.y && y <= wb.y + wb.h;
  const final = weak ? dmg * 2.2 : dmg * (explosive ? 1 : 0.8);
  b.hp -= final;
  b.hurtFlash = 0.1;
  w.audio.sfx(weak ? 'bossHit' : 'enemyHit');
  w.particles.burst(x, y, weak ? 6 : 2, weak ? [PAL.white, PAL.yellow] : [PAL.grey, PAL.white], 90, 0.2);
  if (b.hp <= 0) {
    b.hp = 0;
    b.state = 'dying';
    b.stateT = 0;
    w.audio.sfx('bossDie');
    w.audio.stopTrack();
    w.shake(8, 0.7);
    return true;
  }
  return false;
}

export function drawBoss(ctx: CanvasRenderingContext2D, b: Boss, camX: number, camY: number, debug = false): void {
  // stage-1 defense wall uses the sprite-pack art when available
  const wall = b.def.id === 'commander' && packReady() ? packBossWall() : null;
  const px = Math.round(b.x - camX);
  const py = Math.round(b.y - camY);
  const spr = wall ? wall.sprite : b.art.body[b.frame % b.art.body.length];
  ctx.drawImage(spr, px, py, b.w, b.h);
  if (b.hurtFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = PAL.white;
    ctx.fillRect(px, py, b.w, b.h);
    ctx.restore();
  }
  // weak point
  if (b.state === 'fight' && b.invuln <= 0) {
    const wb = b.weakBox();
    const t = (Math.sin(b.weakT * 9) + 1) / 2;
    ctx.globalAlpha = 0.65 + t * 0.35;
    ctx.drawImage(b.art.weak, Math.round(wb.x - camX), Math.round(wb.y - camY));
    ctx.globalAlpha = 1;
  }
  if (debug) {
    ctx.strokeStyle = '#ff2222';
    ctx.strokeRect(px + 0.5, py + 0.5, b.w, b.h);
    const wb = b.weakBox();
    ctx.strokeStyle = '#ffff00';
    ctx.strokeRect(Math.round(wb.x - camX) + 0.5, Math.round(wb.y - camY) + 0.5, wb.w, wb.h);
  }
}

export function bossArenaBounds(levelPixelW: number, bossStartTiles: number): [number, number] {
  return [bossStartTiles * TILE, levelPixelW];
}
