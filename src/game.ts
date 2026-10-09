import { FIXED_DT, MAX_FRAME_TIME, PAL, VIEW_H, VIEW_W } from './config/constants';
import { Input } from './core/input';
import { Save, type SaveData } from './core/save';
import { audio as audioEngine, type AudioEngine } from './audio/audio';
import { drawText } from './gfx/font';
import { GameScene } from './scenes/game';
import {
  CharSelect,
  EndingScreen,
  GameOverScreen,
  KeysScreen,
  OptionsScreen,
  StageClearScreen,
  StageSelect,
  TitleScreen,
} from './scenes/menu';
import type { AppState, GameHost, StartOptions } from './scenes/types';

export class Game implements GameHost {
  ctx: CanvasRenderingContext2D;
  input = new Input();
  audio: AudioEngine = audioEngine;
  save: SaveData;
  state: AppState = 'menu';
  paused = false;
  pauseIndex = 0;
  lastStart: StartOptions | null = null;
  continueUsed = 0;
  scene: GameScene;
  title: TitleScreen;
  charSel: CharSelect;
  stageSel: StageSelect;
  options: OptionsScreen;
  keys: KeysScreen;
  stageClear: StageClearScreen;
  gameOver: GameOverScreen;
  ending: EndingScreen;
  private acc = 0;
  private last = 0;
  private raf = 0;
  scale = 2;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    this.save = Save.load();
    this.input = new Input(this.save.keys);
    this.scene = new GameScene(this);
    this.title = new TitleScreen(this);
    this.charSel = new CharSelect(this);
    this.stageSel = new StageSelect(this);
    this.options = new OptionsScreen(this);
    this.keys = new KeysScreen(this);
    this.stageClear = new StageClearScreen(this);
    this.gameOver = new GameOverScreen(this);
    this.ending = new EndingScreen(this);

    this.audio.setMusicVolume(this.save.settings.musicVolume);
    this.audio.setSfxVolume(this.save.settings.sfxVolume);
  }

  boot(): void {
    this.input.attach(window);
    this.canvas.focus();
    const unlock = () => {
      this.audio.resume();
      this.audio.init();
      this.audio.setMusicVolume(this.save.settings.musicVolume);
      this.audio.setSfxVolume(this.save.settings.sfxVolume);
    };
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => this.resize());
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.input.detach(window);
  }

  private frame = (ts: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > MAX_FRAME_TIME) dt = MAX_FRAME_TIME;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= FIXED_DT && guard++ < 5) {
      this.acc -= FIXED_DT;
      this.input.update();
      this.update(FIXED_DT);
      this.input.postUpdate();
    }
    this.draw();
  };

  private update(dt: number): void {
    if (this.state === 'playing') {
      if (this.input.pressed(0, 'pause')) {
        this.paused = !this.paused;
        this.pauseIndex = 0;
        this.audio.sfx('menuSelect');
        if (this.paused) this.audio.stopTrack();
        else if (this.scene.def) this.audio.playTrack(this.scene.def.music);
      }
      if (this.paused) {
        if (this.input.pressed(0, 'up')) this.pauseIndex = (this.pauseIndex + 2) % 3;
        if (this.input.pressed(0, 'down')) this.pauseIndex = (this.pauseIndex + 1) % 3;
        if (this.input.pressed(0, 'start') || this.input.pressed(0, 'shoot')) {
          if (this.pauseIndex === 0) {
            this.paused = false;
            this.audio.playTrack(this.scene.def.music);
          } else if (this.pauseIndex === 1) {
            this.paused = false;
            this.startGame(this.lastStart!);
          } else {
            this.paused = false;
            this.goto('menu');
          }
        }
        return;
      }
      this.scene.update(dt);
      return;
    }

    switch (this.state) {
      case 'menu':
        this.title.update(dt);
        break;
      case 'charselect':
        this.charSel.update(dt);
        break;
      case 'stageselect':
        this.stageSel.update();
        break;
      case 'options':
        this.options.update();
        break;
      case 'keys':
        this.keys.update();
        break;
      case 'stageclear':
        this.stageClear.update(dt);
        break;
      case 'gameover':
        this.gameOver.update(dt);
        break;
      case 'ending':
        this.ending.update(dt);
        break;
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    switch (this.state) {
      case 'menu':
        this.title.draw(ctx);
        break;
      case 'charselect':
        this.charSel.draw(ctx);
        break;
      case 'stageselect':
        this.stageSel.draw(ctx);
        break;
      case 'options':
        this.options.draw(ctx);
        break;
      case 'keys':
        this.keys.draw(ctx);
        break;
      case 'stageclear':
        this.stageClear.draw(ctx);
        break;
      case 'gameover':
        this.gameOver.draw(ctx);
        break;
      case 'ending':
        this.ending.draw(ctx);
        break;
      case 'playing':
        this.scene.draw(ctx);
        if (this.paused) this.drawPause(ctx);
        break;
    }

    if (this.save.settings.showFps && this.state === 'playing') {
      drawText(ctx, `${this.scene.fps.toFixed(0)} FPS`, VIEW_W - 50, VIEW_H - 12, { color: PAL.green, scale: 1 });
    }
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4,6,12,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const items = ['RESUME', 'RESTART STAGE', 'QUIT TO TITLE'];
    drawText(ctx, 'PAUSED', VIEW_W / 2, 110, { color: PAL.yellow, shadow: PAL.black, align: 'center', scale: 3 });
    items.forEach((m, i) => {
      drawText(ctx, m, VIEW_W / 2, 170 + i * 20, {
        color: i === this.pauseIndex ? PAL.yellow : PAL.white,
        shadow: PAL.black,
        align: 'center',
        scale: 1,
      });
    });
    drawText(ctx, 'ESC RESUME', VIEW_W / 2, VIEW_H - 40, { color: PAL.grey, align: 'center', scale: 1 });
  }

  /* -------------------------- host interface -------------------------- */

  goto(state: AppState): void {
    this.state = state;
    if (state !== 'playing') this.paused = false;
  }

  startGame(opt: StartOptions): void {
    this.lastStart = opt;
    this.continueUsed = opt.continueUsed ?? 0;
    this.scene.debug.fps = this.save.settings.showFps;
    this.scene.start(opt);
    this.goto('playing');
  }

  persist(): void {
    Save.save(this.save);
  }

  canContinue(): boolean {
    return this.continueUsed < 3 && !!this.lastStart;
  }

  requestFullscreen(): void {
    const el = document.documentElement;
    if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => void 0);
    else void document.exitFullscreen?.().catch(() => void 0);
    setTimeout(() => this.resize(), 120);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let s = Math.min(w / VIEW_W, h / VIEW_H);
    s = s >= 1 ? Math.floor(s * 2) / 2 : s; // half-step integer-ish scaling keeps pixels crisp
    if (s <= 0) s = 1;
    this.scale = s;
    this.canvas.style.width = `${Math.round(VIEW_W * s)}px`;
    this.canvas.style.height = `${Math.round(VIEW_H * s)}px`;
  }
}
