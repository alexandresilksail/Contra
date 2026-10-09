import { PAL, VIEW_W } from '../config/constants';
import { drawText, measureText } from '../gfx/font';
import { buildHeart } from '../gfx/sprites';
import type { Player } from '../entities/player';
import type { Boss } from '../entities/boss';
import { weaponDef } from '../weapons/weapons';

let heart: HTMLCanvasElement | null = null;
const getHeart = (): HTMLCanvasElement => (heart ??= buildHeart());

export function drawHud(
  ctx: CanvasRenderingContext2D,
  players: Player[],
  opt: {
    highScore: number;
    stageName: string;
    boss: Boss | null;
    showStageT: number;
    time: number;
  },
): void {
  // top strip
  ctx.fillStyle = 'rgba(4,6,12,0.72)';
  ctx.fillRect(0, 0, VIEW_W, 22);
  ctx.fillStyle = PAL.steelDark;
  ctx.fillRect(0, 22, VIEW_W, 1);

  drawText(ctx, '1P', 4, 3, { color: PAL.yellow, scale: 1 });
  drawPlayerInfo(ctx, players[0], 20, 2);

  if (players[1] && players[1].active) {
    drawText(ctx, '2P', VIEW_W - 116, 3, { color: PAL.cyan, scale: 1 });
    drawPlayerInfo(ctx, players[1], VIEW_W - 100, 2, true);
  }

  drawText(ctx, 'HI ' + pad(opt.highScore, 7), VIEW_W / 2, 3, {
    color: PAL.grey,
    align: 'center',
    scale: 1,
  });

  if (opt.showStageT > 0) {
    const a = Math.min(1, opt.showStageT);
    ctx.globalAlpha = a;
    drawText(ctx, opt.stageName, VIEW_W / 2, 34, {
      color: PAL.white,
      shadow: PAL.black,
      align: 'center',
      scale: 2,
    });
    ctx.globalAlpha = 1;
  }

  if (opt.boss && opt.boss.state === 'fight') drawBossBar(ctx, opt.boss);
}

function drawPlayerInfo(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, right = false): void {
  if (!p) return;
  drawText(ctx, pad(p.score, 7), x, y, { color: PAL.white, scale: 1 });

  // hearts
  const h = getHeart();
  for (let i = 0; i < 3; i++) {
    const hx = x + i * 13;
    if (i < p.hp) ctx.drawImage(h, hx, y + 10);
    else {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(h, hx, y + 10);
      ctx.globalAlpha = 1;
    }
  }

  // lives
  drawText(ctx, 'x' + Math.max(0, p.lives), x + (right ? 0 : 42), y + 11, { color: PAL.orange, scale: 1 });

  // weapon + ammo
  const def = weaponDef(p.weapon);
  const wx = right ? x - 4 : x + 56;
  ctx.fillStyle = def.color;
  ctx.fillRect(wx, y + 9, 20, 11);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(wx + 1, y + 10, 18, 9);
  drawText(ctx, def.letter, wx + 10, y + 11, { color: def.color, align: 'center', scale: 1 });
  const ammo = p.ammoLeft();
  const txt = ammo === Infinity ? '--' : String(Math.min(99, ammo));
  drawText(ctx, txt, wx + 24, y + 11, { color: ammo === 0 ? PAL.red : PAL.white, scale: 1 });
}

function drawBossBar(ctx: CanvasRenderingContext2D, b: Boss): void {
  const w = 260;
  const x = (VIEW_W - w) / 2;
  const y = 26;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(x - 2, y - 2, w + 4, 12);
  ctx.fillStyle = PAL.redDark;
  ctx.fillRect(x, y, w, 8);
  const ratio = b.hpRatio();
  ctx.fillStyle = ratio > 0.66 ? PAL.green : ratio > 0.33 ? PAL.yellow : PAL.red;
  ctx.fillRect(x, y, Math.round(w * ratio), 8);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x, y, Math.round(w * ratio), 2);
  drawText(ctx, b.name, VIEW_W / 2, y + 10, { color: PAL.white, shadow: PAL.black, align: 'center', scale: 1 });
  drawText(ctx, 'PH' + (b.phase + 1), x + w + 6, y - 1, { color: PAL.orange, scale: 1 });
}

export function pad(n: number, len: number): string {
  const s = String(Math.max(0, Math.floor(n)));
  return s.length >= len ? s.slice(-len) : '0'.repeat(len - s.length) + s;
}

export function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  y: number,
  color = PAL.yellow,
): void {
  const w = Math.max(measureText(title, 3, 1), measureText(subtitle, 1, 1)) + 24;
  ctx.fillStyle = 'rgba(6,8,16,0.85)';
  ctx.fillRect((VIEW_W - w) / 2, y - 6, w, 40);
  ctx.fillStyle = color;
  ctx.fillRect((VIEW_W - w) / 2, y - 6, w, 1);
  ctx.fillRect((VIEW_W - w) / 2, y + 33, w, 1);
  drawText(ctx, title, VIEW_W / 2, y, { color, shadow: PAL.black, align: 'center', scale: 3 });
  drawText(ctx, subtitle, VIEW_W / 2, y + 26, { color: PAL.white, align: 'center', scale: 1 });
}
