/** Tiny helpers for building pixel-art canvases at runtime (no image files). */

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  return c;
}

export function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Draw horizontal run-length pixel data: rows of char codes mapped to colours. */
export function drawPixels(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Record<string, string>,
  ox = 0,
  oy = 0,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let runStart = -1;
    let runChar = '.';
    for (let x = 0; x <= row.length; x++) {
      const ch = x < row.length ? row[x] : '.';
      if (ch !== runChar) {
        if (runStart >= 0 && runChar !== '.') {
          const col = palette[runChar];
          if (col) {
            ctx.fillStyle = col;
            ctx.fillRect(ox + runStart, oy + y, x - runStart, 1);
          }
        }
        runStart = x;
        runChar = ch;
      }
    }
  }
}

/** Mirror a canvas horizontally (for left-facing frames). */
export function flipH(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const c = ctxOf(out);
  c.translate(src.width, 0);
  c.scale(-1, 1);
  c.drawImage(src, 0, 0);
  return out;
}

/** Tint a canvas with a solid colour using 'source-atop' (silhouette FX). */
export function tint(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const c = ctxOf(out);
  c.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = color;
  c.fillRect(0, 0, src.width, src.height);
  return out;
}

/** Nearest-neighbour scale of a single canvas (keeps pixel art crisp). */
export function scaleSprite(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const out = makeCanvas(w, h);
  const c = ctxOf(out);
  c.imageSmoothingEnabled = false;
  c.drawImage(src, 0, 0, src.width, src.height, 0, 0, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  return out;
}

/** Scale every frame of a SpriteSet to a target size (preserving its flip pairs). */
export function scaleSet(set: SpriteSet, w: number, h: number): SpriteSet {
  return {
    right: set.right.map((s) => scaleSprite(s, w, h)),
    left: set.left.map((s) => scaleSprite(s, w, h)),
  };
}

/**
 * Scale a SpriteSet so its height == targetH and its width keeps the source
 * aspect ratio. Used to fit ripped sheet frames onto entity hitboxes.
 */
export function fitSetHeight(set: SpriteSet, targetH: number): SpriteSet {
  const src = set.right[0];
  if (!src || src.height <= 0) return set;
  const w = Math.max(1, Math.round((src.width * targetH) / src.height));
  return scaleSet(set, w, targetH);
}

export type Sprite = HTMLCanvasElement;
export type SpriteSet = { right: Sprite[]; left: Sprite[] };

export function makeSpriteSet(frames: Sprite[]): SpriteSet {
  return { right: frames, left: frames.map(flipH) };
}
