import { Game } from './game';
import { VIEW_H, VIEW_W } from './config/constants';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const boot = document.getElementById('boot');

if (!canvas) {
  throw new Error('canvas #game not found');
}

canvas.width = VIEW_W;
canvas.height = VIEW_H;

import { loadPack } from './gfx/pack';

const game = new Game(canvas);

// Load the optional local sprite pack first (falls back to procedural art if absent).
loadPack().then(() => {
  game.boot();
  if (boot) boot.classList.add('hide');
});

// expose for debugging / automated smoke tests
(window as unknown as Record<string, unknown>).__IRONSTORM__ = game;
