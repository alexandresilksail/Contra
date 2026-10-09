/**
 * Minimal DOM stub so canvas-based modules (sprite baking, drawing helpers)
 * can be imported in the node test environment.
 */

class FakeGradient {
  addColorStop(): void {}
}

class FakeCtx {
  fillStyle: string = '#000';
  strokeStyle: string = '#000';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  imageSmoothingEnabled = false;
  font = '';
  fillRect(): void {}
  strokeRect(): void {}
  clearRect(): void {}
  fillText(): void {}
  drawImage(): void {}
  save(): void {}
  restore(): void {}
  translate(): void {}
  scale(): void {}
  rotate(): void {}
  beginPath(): void {}
  closePath(): void {}
  arc(): void {}
  fill(): void {}
  stroke(): void {}
  moveTo(): void {}
  lineTo(): void {}
  createLinearGradient(): FakeGradient {
    return new FakeGradient();
  }
  createRadialGradient(): FakeGradient {
    return new FakeGradient();
  }
  getImageData(x: number, y: number, w: number, h: number) {
    return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h };
  }
  putImageData(): void {}
}

class FakeCanvas {
  width = 1;
  height = 1;
  private ctx = new FakeCtx();
  getContext(): FakeCtx {
    return this.ctx;
  }
  toDataURL(): string {
    return 'data:,';
  }
}

const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return new FakeCanvas();
    return {};
  },
  getElementById: () => null,
  addEventListener: () => {},
};
g.HTMLCanvasElement = FakeCanvas;

export {};
