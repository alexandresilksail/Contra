import { Pool } from '../core/pool';
import { PAL } from '../config/constants';

export class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 0.5;
  size = 2;
  color = PAL.white;
  gravity = 0;
  shrink = false;
  dead = false;
  reset(): void {
    this.dead = false;
    this.life = 0;
    this.gravity = 0;
    this.shrink = false;
    this.size = 2;
  }
}

export class Particles {
  pool = new Pool<Particle>(
    () => new Particle(),
    (p) => p.reset(),
    260,
  );

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    size = 2,
    gravity = 0,
    shrink = false,
  ): void {
    const p = this.pool.spawn();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = 0;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.gravity = gravity;
    p.shrink = shrink;
  }

  burst(x: number, y: number, count: number, colors: string[], speed = 90, life = 0.4, gravity = 0): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.spawn(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.8),
        colors[(Math.random() * colors.length) | 0],
        1 + ((Math.random() * 2) | 0),
        gravity,
        true,
      );
    }
  }

  explosion(x: number, y: number, radius: number): void {
    const n = Math.min(46, 10 + Math.round(radius * 0.9));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (radius * 2.2) * (0.3 + Math.random());
      this.spawn(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - 40,
        0.28 + Math.random() * 0.5,
        [PAL.yellow, PAL.orange, PAL.red, PAL.white][(Math.random() * 4) | 0],
        2 + ((Math.random() * 3) | 0),
        220,
        true,
      );
    }
  }

  update(dt: number): void {
    for (const p of this.pool.active) {
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.dead = true;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.pool.sweep((p) => p.dead);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.pool.active) {
      const t = p.life / p.maxLife;
      const s = p.shrink ? Math.max(1, Math.round(p.size * (1 - t))) : p.size;
      ctx.fillStyle = t > 0.7 ? PAL.greyDark : p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), s, s);
    }
  }

  clear(): void {
    this.pool.clear();
  }
}
