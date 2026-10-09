import type { SaveData } from '../core/save';
import type { Input } from '../core/input';
import type { AudioEngine } from '../audio/audio';
import type { CharId } from '../gfx/sprites';

export type AppState =
  | 'menu'
  | 'charselect'
  | 'stageselect'
  | 'options'
  | 'keys'
  | 'playing'
  | 'stageclear'
  | 'gameover'
  | 'ending';

export interface StartOptions {
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
