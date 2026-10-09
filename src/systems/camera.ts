import { CAM_DEADZONE_H, CAM_DEADZONE_W, VIEW_H, VIEW_W } from '../config/constants';
import { clamp } from '../core/math';

export interface FollowTarget {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
}

export class Camera {
  x = 0;
  y = 0;
  shakeT = 0;
  shakeMag = 0;
  shakeEnabled = true;
  /** locked arena: [left, right] world x */
  lock: [number, number] | null = null;
  forced = false;
  forcedSpeed = 0;
  boundsW = 0;
  boundsH = 0;

  setBounds(w: number, h: number): void {
    this.boundsW = Math.max(VIEW_W, w);
    this.boundsH = Math.max(VIEW_H, h);
  }

  shake(mag: number, time = 0.25): void {
    if (!this.shakeEnabled) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, time);
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.lock = null;
    this.forced = false;
    this.shakeT = 0;
  }

  update(dt: number, targets: FollowTarget[]): void {
    const live = targets.filter((t) => t.alive);
    let desiredX = this.x + VIEW_W / 2;
    let desiredY = this.y + VIEW_H / 2;

    if (live.length) {
      let minX = Infinity;
      let maxX = -Infinity;
      let sumY = 0;
      for (const t of live) {
        const cx = t.x + t.w / 2;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        sumY += t.y + t.h / 2;
      }
      desiredX = (minX + maxX) / 2;
      desiredY = sumY / live.length;
    }

    if (this.forced) {
      this.x += this.forcedSpeed * dt;
    } else {
      // dead-zone follow
      const cx = this.x + VIEW_W / 2;
      const cy = this.y + VIEW_H / 2;
      const dx = desiredX - cx;
      const dy = desiredY - cy;
      let nx = this.x;
      let ny = this.y;
      if (dx > CAM_DEADZONE_W / 2) nx += dx - CAM_DEADZONE_W / 2;
      else if (dx < -CAM_DEADZONE_W / 2) nx += dx + CAM_DEADZONE_W / 2;
      if (dy > CAM_DEADZONE_H / 2) ny += dy - CAM_DEADZONE_H / 2;
      else if (dy < -CAM_DEADZONE_H / 2) ny += dy + CAM_DEADZONE_H / 2;
      this.x = nx;
      this.y = ny;
    }

    // arena / level clamp
    const minX = this.lock ? this.lock[0] : 0;
    const maxX = this.lock ? this.lock[1] : this.boundsW - VIEW_W;
    this.x = clamp(this.x, minX, Math.max(minX, maxX));
    this.y = clamp(this.y, 0, Math.max(0, this.boundsH - VIEW_H));

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) {
        this.shakeT = 0;
        this.shakeMag = 0;
      }
    }
  }

  get offsetX(): number {
    let x = Math.round(this.x);
    if (this.shakeT > 0) x += Math.round((Math.random() * 2 - 1) * this.shakeMag);
    return x;
  }
  get offsetY(): number {
    let y = Math.round(this.y);
    if (this.shakeT > 0) y += Math.round((Math.random() * 2 - 1) * this.shakeMag * 0.6);
    return y;
  }
}
