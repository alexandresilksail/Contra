import type { SaveData } from '../core/save';
import type { Input } from '../core/input';
import type { AudioEngine } from '../audio/audio';
import type { CharId } from '../gfx/sprites';

export type AppState =
  | 'menu'
  | 'charselect'
  | 'options'
  | 'keys'
  | 'playing'
  | 'stageclear'
  | 'gameover'
  | 'ending';

export interface StartOptions {
  /** stage id; the project ships Stage 1 only (kept for save/continue compat) */
  stage: number;
  chars: [CharId, CharId];
  twoPlayer: boolean;
  continueUsed?: number;
}

export interface GameHost {
  save: SaveData;
  input: Input;
  audio: AudioEngine;
  persist(): void;
  startGame(opt: StartOptions): void;
  goto(state: AppState): void;
  requestFullscreen(): void;
  lastStart: StartOptions | null;
  canContinue(): boolean;
  continueUsed: number;
}
