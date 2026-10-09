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

export type Sprite = HTMLCanvasElement;
export type SpriteSet = { right: Sprite[]; left: Sprite[] };

export function makeSpriteSet(frames: Sprite[]): SpriteSet {
  return { right: frames, left: frames.map(flipH) };
}
