import type { BgLayer } from './sprites';

/**
 * Scroll factors for a background layer.
 *
 * A `lock`ed layer IS the stage map image. It must move exactly as fast as the
 * tilemap that carries collision, i.e. 1:1 on BOTH axes, so the picture of the
 * ground and the ground you can stand on never separate. Unlocked layers are
 * decorative parallax and deliberately move slower.
 */
export function bgScrollFactors(l: BgLayer): { sx: number; sy: number } {
  return l.lock ? { sx: 1, sy: 1 } : { sx: l.speed, sy: l.speed * 0.25 };
}

/** Horizontal screen offset of the layer's first copy, for a camera at camX. */
export function bgOriginX(l: BgLayer, camX: number): number {
  const { sx } = bgScrollFactors(l);
  const w = Math.max(1, l.sprite.width);
  let ox = -((camX * sx) % w);
  if (ox > 0) ox -= w;
  return ox;
}

/** Vertical screen offset of the layer, for a camera at camY. */
export function bgOriginY(l: BgLayer, camY: number): number {
  const { sy } = bgScrollFactors(l);
  return Math.round(l.y - camY * sy);
}

/**
 * How many screen pixels the layer moves when the camera moves `d` world
 * pixels to the right. For a world-locked layer this must equal `d`.
 */
export function bgShiftForCamera(l: BgLayer, d: number): number {
  const { sx } = bgScrollFactors(l);
  return d * sx;
}
