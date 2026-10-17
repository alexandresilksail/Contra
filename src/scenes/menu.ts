import { PAL, VIEW_H, VIEW_W } from '../config/constants';
import { drawText, measureText } from '../gfx/font';
import { buildLogo, buildPlayerArt, CHAR_DEFS, type CharId } from '../gfx/sprites';
import { packTitleLogo } from '../gfx/pack';
import { audio } from '../audio/audio';
import { DEFAULT_KEYS, keyLabel } from '../core/input';
import { STAGES } from '../level/stages';
import type { Action } from '../core/input';
import type { GameHost, StartOptions } from './types';

const logo = buildLogo();

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border = PAL.steelDark): void {
  ctx.fillStyle = 'rgba(6,9,18,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function cursor(ctx: CanvasRenderingContext2D, x: number, y: number, color = PAL.yellow): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 1, 3, 3);
  ctx.fillRect(x + 1, y + 2, 1, 1);
}

/* ------------------------------------------------------------------ */
/* title                                                               */
/* ------------------------------------------------------------------ */

const MENU_ITEMS = ['START GAME', 'OPTIONS', 'KEY CONFIG', 'HOW TO PLAY'];

export class TitleScreen {
  index = 0;
  t = 0;
  constructor(private host: GameHost) {}

  update(dt: number): void {
    this.t += dt;
    const inp = this.host.input;
    if (inp.pressed(0, 'up')) {
      this.index = (this.index + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'down')) {
      this.index = (this.index + 1) % MENU_ITEMS.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'start') || inp.pressed(0, 'shoot')) {
      audio.sfx('menuSelect');
      switch (this.index) {
        case 0:
          this.host.goto('charselect');
          break;
        case 1:
          this.host.goto('options');
          break;
        case 2:
          this.host.goto('keys');
          break;
        case 3:
          this.help = !this.help;
          break;
      }
    }
    if (inp.rawPressed('F11') || (inp.rawHeld('AltLeft') && inp.rawPressed('Enter'))) this.host.requestFullscreen();
  }
  help = false;

  draw(ctx: CanvasRenderingContext2D): void {
    const packLogo = packTitleLogo();
    if (packLogo) {
      ctx.drawImage(packLogo, Math.round((VIEW_W - packLogo.width) / 2), 30);
    } else {
      ctx.drawImage(logo.big, Math.round((VIEW_W - logo.big.width) / 2), 34);
      drawText(ctx, 'ORIGINAL RUN AND GUN ACTION', VIEW_W / 2, 82, {
        color: PAL.cyan,
        align: 'center',
        scale: 1,
      });
      drawText(ctx, 'ALL ART / MUSIC / CODE ORIGINAL', VIEW_W / 2, 92, {
        color: PAL.grey,
        align: 'center',
        scale: 1,
      });
    }

    panel(ctx, 200, 118, 240, MENU_ITEMS.length * 14 + 14, PAL.blueDark);
    MENU_ITEMS.forEach((m, i) => {
      const y = 128 + i * 14;
      drawText(ctx, m, 236, y, { color: i === this.index ? PAL.yellow : PAL.white, scale: 1 });
      if (i === this.index) cursor(ctx, 222, y + 1);
    });

    drawText(ctx, `HI-SCORE ${String(this.host.save.highScore).padStart(7, '0')}`, VIEW_W / 2, 232, {
      color: PAL.orange,
      align: 'center',
      scale: 1,
    });
    drawText(
      ctx,
      this.t % 1 < 0.6 ? 'PRESS ENTER' : '',
      VIEW_W / 2,
      258,
      { color: PAL.white, align: 'center', scale: 1 },
    );
    drawText(ctx, 'ENTER START   W/S SELECT   F11 FULLSCREEN', VIEW_W / 2, VIEW_H - 24, {
      color: PAL.grey,
      align: 'center',
      scale: 1,
    });

    if (this.help) {
      panel(ctx, 60, 60, VIEW_W - 120, 200, PAL.greenDark);
      const lines = [
        'HOW TO PLAY',
        '',
        'MOVE ....... A / D      JUMP ....... W OR K',
        'CROUCH ..... S          SHOOT ...... J',
        'AIM ........ HOLD W/S WHILE SHOOTING (8 WAY)',
        'PAUSE ...... ESC        DEBUG ...... F1',
        '',
        'P2: ARROWS MOVE   NUM0 SHOOT   NUM1 JUMP',
        '',
        'SHOOT CRATES FOR WEAPONS. HIT BOSS WEAK POINTS.',
        'PRESS ENTER TO CLOSE',
      ];
      lines.forEach((l, i) =>
        drawText(ctx, l, VIEW_W / 2, 70 + i * 14, {
          color: i === 0 ? PAL.yellow : PAL.white,
          align: 'center',
          scale: 1,
        }),
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* character select                                                    */
/* ------------------------------------------------------------------ */

export class CharSelect {
  pick: [number, number] = [0, 0];
  stage = 0; // 0 = P1 choosing, 1 = P2 choosing
  t = 0;

  constructor(private host: GameHost) {}

  update(dt: number): void {
    this.t += dt;
    const inp = this.host.input;
    const two = this.host.save.settings.players === 2;
    const cur = this.stage;
    if (inp.pressed(0, 'left')) {
      this.pick[cur] = (this.pick[cur] + CHAR_DEFS.length - 1) % CHAR_DEFS.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'right')) {
      this.pick[cur] = (this.pick[cur] + 1) % CHAR_DEFS.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'start') || inp.pressed(0, 'shoot')) {
      audio.sfx('menuSelect');
      if (two && this.stage === 0) {
        this.stage = 1;
      } else {
        const opt: StartOptions = {
          // single-stage project: always Stage 1
          stage: 1,
          chars: [CHAR_DEFS[this.pick[0]].id, CHAR_DEFS[this.pick[1]].id] as [CharId, CharId],
          twoPlayer: two,
        };
        this.host.startGame(opt);
      }
    }
    if (inp.pressed(0, 'pause')) this.host.goto('menu');
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'SELECT SOLDIER', VIEW_W / 2, 16, { color: PAL.yellow, align: 'center', scale: 2 });
    const two = this.host.save.settings.players === 2;
    drawText(ctx, two ? `PLAYER ${this.stage + 1}  (2P MODE)` : '1P MODE', VIEW_W / 2, 40, {
      color: PAL.cyan,
      align: 'center',
      scale: 1,
    });

    for (let i = 0; i < CHAR_DEFS.length; i++) {
      const def = CHAR_DEFS[i];
      const x = 90 + i * 240;
      const sel = this.pick[this.stage] === i;
      panel(ctx, x - 12, 66, 200, 200, sel ? PAL.yellow : PAL.steelDark);
      const portrait = buildPortrait(i);
      ctx.drawImage(portrait, x + 60, 86);
      drawText(ctx, def.name, x + 88, 150, { color: sel ? PAL.yellow : PAL.white, align: 'center', scale: 2 });
      drawText(ctx, def.subtitle, x + 88, 172, { color: PAL.cyan, align: 'center', scale: 1 });
      def.desc.forEach((d, k) => drawText(ctx, d, x + 88, 188 + k * 11, { color: PAL.grey, align: 'center', scale: 1 }));
      if (this.stage === 1 && this.pick[0] === i) drawText(ctx, 'P1', x + 14, 74, { color: PAL.yellow, scale: 1 });
      if (this.pick[1] === i && two) drawText(ctx, 'P2', x + 14, 74, { color: PAL.cyan, scale: 1 });
    }

    drawText(ctx, 'ENTER CONFIRM    ESC BACK', VIEW_W / 2, VIEW_H - 20, {
      color: PAL.grey,
      align: 'center',
      scale: 1,
    });
  }
}

const portraitCache = new Map<number, HTMLCanvasElement>();
function buildPortrait(i: number): HTMLCanvasElement {
  let p = portraitCache.get(i);
  if (!p) {
    p = buildPlayerArt(i).portrait;
    portraitCache.set(i, p);
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* options                                                             */
/* ------------------------------------------------------------------ */

export class OptionsScreen {
  index = 0;
  rows = ['MUSIC VOLUME', 'SFX VOLUME', 'MASTER VOLUME', 'MUTE', 'PLAYERS', 'SCREEN SHAKE', 'SHOW FPS', 'RESET SAVE DATA', 'BACK'];
  constructor(private host: GameHost) {}

  update(): void {
    const inp = this.host.input;
    const s = this.host.save.settings;
    const change = (d: number) => {
      switch (this.index) {
        case 0:
          s.musicVolume = Math.max(0, Math.min(1, Math.round((s.musicVolume + d * 0.1) * 10) / 10));
          audio.setMusicVolume(s.musicVolume);
          break;
        case 1:
          s.sfxVolume = Math.max(0, Math.min(1, Math.round((s.sfxVolume + d * 0.1) * 10) / 10));
          audio.setSfxVolume(s.sfxVolume);
          break;
        case 2:
          s.masterVolume = Math.max(0, Math.min(1, Math.round((s.masterVolume + d * 0.1) * 10) / 10));
          audio.setMasterVolume(s.masterVolume);
          break;
        case 3:
          s.muted = !s.muted;
          audio.setMuted(s.muted);
          break;
        case 4:
          s.players = s.players === 1 ? 2 : 1;
          break;
        case 5:
          s.screenShake = !s.screenShake;
          break;
        case 6:
          s.showFps = !s.showFps;
          break;
      }
      audio.sfx('menuMove');
      this.host.persist();
    };
    if (inp.pressed(0, 'up')) {
      this.index = (this.index + this.rows.length - 1) % this.rows.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'down')) {
      this.index = (this.index + 1) % this.rows.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'left')) change(-1);
    if (inp.pressed(0, 'right')) change(1);
    if (inp.pressed(0, 'start') || inp.pressed(0, 'shoot')) {
      audio.sfx('menuSelect');
      if (this.index === 7) {
        const fresh = this.host.save;
        fresh.highScore = 0;
        fresh.maxStageUnlocked = 1;
        this.host.persist();
      } else if (this.index === 8) {
        this.host.goto('menu');
      } else change(1);
    }
    if (inp.pressed(0, 'pause')) this.host.goto('menu');
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.host.save.settings;
    drawText(ctx, 'OPTIONS', VIEW_W / 2, 30, { color: PAL.yellow, align: 'center', scale: 2 });
    panel(ctx, 150, 70, 340, this.rows.length * 20 + 20);
    const values = [
      bar(s.musicVolume),
      bar(s.sfxVolume),
      bar(s.masterVolume),
      s.muted ? 'MUTED' : 'ON',
      s.players === 2 ? '2 PLAYERS' : '1 PLAYER',
      s.screenShake ? 'ON' : 'OFF',
      s.showFps ? 'ON' : 'OFF',
      'ENTER TO RESET',
      '',
    ];
    this.rows.forEach((r, i) => {
      const y = 82 + i * 20;
      drawText(ctx, r, 170, y, { color: i === this.index ? PAL.yellow : PAL.white, scale: 1 });
      drawText(ctx, values[i], 470, y, { color: i === this.index ? PAL.cyan : PAL.grey, align: 'right', scale: 1 });
      if (i === this.index) cursor(ctx, 158, y + 1);
    });
    drawText(ctx, 'LEFT/RIGHT CHANGE    ENTER CONFIRM    ESC BACK', VIEW_W / 2, VIEW_H - 20, {
      color: PAL.grey,
      align: 'center',
      scale: 1,
    });
  }
}

const bar = (v: number) => '[' + '#'.repeat(Math.round(v * 10)).padEnd(10, '.') + ']';

/* ------------------------------------------------------------------ */
/* key config                                                          */
/* ------------------------------------------------------------------ */

const KEY_ROWS: { action: Action; label: string }[] = [
  { action: 'left', label: 'MOVE LEFT' },
  { action: 'right', label: 'MOVE RIGHT' },
  { action: 'up', label: 'UP / AIM UP' },
  { action: 'down', label: 'DOWN / CROUCH' },
  { action: 'jump', label: 'JUMP' },
  { action: 'shoot', label: 'SHOOT' },
  { action: 'pause', label: 'PAUSE' },
];

export class KeysScreen {
  index = 0;
  player: 0 | 1 = 0;
  capturing = false;
  constructor(private host: GameHost) {}

  update(): void {
    const inp = this.host.input;
    if (this.capturing) return;
    if (inp.pressed(0, 'up')) {
      this.index = (this.index + KEY_ROWS.length) % KEY_ROWS.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'down')) {
      this.index = (this.index + 1) % KEY_ROWS.length;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'left') || inp.pressed(0, 'right')) {
      this.player = this.player === 0 ? 1 : 0;
      audio.sfx('menuMove');
    }
    if (inp.pressed(0, 'start') || inp.pressed(0, 'shoot')) {
      const a = KEY_ROWS[this.index].action;
      this.capturing = true;
      inp.startCapture(this.player, a, () => {
        this.capturing = false;
        this.host.persist();
      });
      audio.sfx('menuSelect');
    }
    if (inp.rawPressed('KeyR')) {
      this.host.save.keys = structuredClone(DEFAULT_KEYS);
      inp.bindings = this.host.save.keys;
      this.host.persist();
      audio.sfx('pickup');
    }
    if (inp.pressed(0, 'pause')) this.host.goto('menu');
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'KEY CONFIG', VIEW_W / 2, 24, { color: PAL.yellow, align: 'center', scale: 2 });
    drawText(ctx, `EDITING: PLAYER ${this.player + 1}   (LEFT/RIGHT SWITCH)`, VIEW_W / 2, 48, {
      color: PAL.cyan,
      align: 'center',
      scale: 1,
    });
    panel(ctx, 130, 66, 380, KEY_ROWS.length * 20 + 16);
    KEY_ROWS.forEach((r, i) => {
      const y = 76 + i * 20;
      const keys = this.host.save.keys[this.player][r.action];
      const label = keys.map(keyLabel).join(' / ');
      drawText(ctx, r.label, 148, y, { color: i === this.index ? PAL.yellow : PAL.white, scale: 1 });
      drawText(ctx, label, 492, y, { color: i === this.index ? PAL.cyan : PAL.grey, align: 'right', scale: 1 });
      if (i === this.index) cursor(ctx, 136, y + 1);
    });
    if (this.capturing) {
      panel(ctx, 180, 150, 280, 60, PAL.red);
      drawText(ctx, 'PRESS A NEW KEY', VIEW_W / 2, 166, { color: PAL.yellow, align: 'center', scale: 2 });
      drawText(ctx, 'ESC CANCELS', VIEW_W / 2, 190, { color: PAL.white, align: 'center', scale: 1 });
    }
    drawText(ctx, 'ENTER REBIND    R RESET DEFAULTS    ESC BACK', VIEW_W / 2, VIEW_H - 20, {
      color: PAL.grey,
      align: 'center',
      scale: 1,
    });
  }
}

/* ------------------------------------------------------------------ */
/* stage clear / game over / ending                                    */
/* ------------------------------------------------------------------ */

export class StageClearScreen {
  t = 0;
  constructor(private host: GameHost) {}
  update(dt: number): void {
    this.t += dt;
    const inp = this.host.input;
    // single-stage project: clearing Stage 1 ends the run (arcade-style
    // "mission complete" fanfare, then the ending screen)
    if (this.t > 0.6 && (inp.pressed(0, 'start') || inp.pressed(0, 'shoot'))) {
      audio.sfx('victory');
      this.host.goto('ending');
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'STAGE CLEAR', VIEW_W / 2, 70, { color: PAL.yellow, shadow: PAL.black, align: 'center', scale: 4 });
    drawText(ctx, `${STAGES[0].name}  ${STAGES[0].subtitle}`, VIEW_W / 2, 116, {
      color: PAL.white,
      align: 'center',
      scale: 1,
    });
    panel(ctx, 200, 150, 240, 80);
    drawText(ctx, 'MISSION COMPLETE', VIEW_W / 2, 168, { color: PAL.cyan, align: 'center', scale: 1 });
    if (this.t % 1 < 0.6) drawText(ctx, 'PRESS ENTER', VIEW_W / 2, 200, { color: PAL.orange, align: 'center', scale: 1 });
    drawText(ctx, `HI ${this.host.save.highScore}`, VIEW_W / 2, 250, { color: PAL.grey, align: 'center', scale: 1 });
  }
}

export class GameOverScreen {
  t = 0;
  constructor(private host: GameHost) {}
  update(dt: number): void {
    this.t += dt;
    const inp = this.host.input;
    const left = Math.ceil(10 - this.t);
    if (this.host.canContinue() && (inp.pressed(0, 'start') || inp.pressed(0, 'shoot'))) {
      if (this.host.lastStart) {
        this.host.continueUsed++;
        audio.sfx('menuSelect');
        this.host.startGame({ ...this.host.lastStart, continueUsed: this.host.continueUsed });
        return;
      }
    }
    if (left <= 0 || inp.pressed(0, 'pause')) this.host.goto('menu');
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'GAME OVER', VIEW_W / 2, 80, { color: PAL.red, shadow: PAL.black, align: 'center', scale: 4 });
    const left = Math.ceil(10 - this.t);
    if (this.host.canContinue()) {
      drawText(ctx, `CONTINUE?  ${left}`, VIEW_W / 2, 150, { color: PAL.yellow, align: 'center', scale: 2 });
      drawText(ctx, `CREDITS LEFT ${3 - this.host.continueUsed}`, VIEW_W / 2, 180, {
        color: PAL.cyan,
        align: 'center',
        scale: 1,
      });
      drawText(ctx, 'PRESS ENTER TO CONTINUE', VIEW_W / 2, 200, { color: PAL.white, align: 'center', scale: 1 });
    } else {
      drawText(ctx, 'NO CREDITS LEFT', VIEW_W / 2, 160, { color: PAL.grey, align: 'center', scale: 2 });
      drawText(ctx, 'RETURNING TO TITLE...', VIEW_W / 2, 190, { color: PAL.white, align: 'center', scale: 1 });
    }
  }
}

export class EndingScreen {
  t = 0;
  constructor(private host: GameHost) {}
  update(dt: number): void {
    this.t += dt;
    const inp = this.host.input;
    if (this.t > 2 && (inp.pressed(0, 'start') || inp.pressed(0, 'shoot') || inp.pressed(0, 'pause'))) {
      this.host.goto('menu');
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const lines = [
      'THE ENEMY STRONGHOLD IS DESTROYED.',
      '',
      'THE WAR IS OVER - FOR NOW.',
      '',
      'THANK YOU FOR PLAYING IRON STORM.',
      '',
      'ART - MUSIC - CODE: 100% ORIGINAL',
      'BUILT WITH HTML5 CANVAS + TYPESCRIPT',
    ];
    const top = Math.min(120, 40 + this.t * 40);
    lines.forEach((l, i) =>
      drawText(ctx, l, VIEW_W / 2, top + i * 18, {
        color: i === 4 ? PAL.yellow : PAL.white,
        align: 'center',
        scale: 1,
      }),
    );
    drawText(ctx, `FINAL SCORE ${this.host.save.highScore}`, VIEW_W / 2, VIEW_H - 40, {
      color: PAL.orange,
      align: 'center',
      scale: 1,
    });
    if (this.t > 2 && this.t % 1 < 0.6)
      drawText(ctx, 'PRESS ENTER', VIEW_W / 2, VIEW_H - 24, { color: PAL.grey, align: 'center', scale: 1 });
  }
}

export { measureText };
