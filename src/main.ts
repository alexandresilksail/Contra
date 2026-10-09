import { Game } from './game';
import { VIEW_H, VIEW_W } from './config/constants';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const boot = document.getElementById('boot');

if (!canvas) {
  throw new Error('canvas #game not found');
}

canvas.width = VIEW_W;
canvas.height = VIEW_H;

const game = new Game(canvas);
game.boot();

if (boot) boot.classList.add('hide');

// expose for debugging / automated smoke tests
(window as unknown as Record<string, unknown>).__IRONSTORM__ = game;
