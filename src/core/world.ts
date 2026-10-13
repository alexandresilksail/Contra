import type { Level } from '../level/level';
import type { Camera } from '../systems/camera';
import type { Particles } from '../systems/particles';
import type { Pool } from './pool';
import type { Bullet } from '../entities/bullet';
import type { Player } from '../entities/player';
import type { Enemy } from '../entities/enemy';
import type { Boss } from '../entities/boss';
import type { AudioEngine } from '../audio/audio';

export interface DebugFlags {
  on: boolean;
  invincible: boolean;
  infiniteAmmo: boolean;
  hitbox: boolean;
  fps: boolean;
}

/** Shared context handed to entities so they can spawn FX, bullets, score... */
export interface WorldCtx {
  level: Level;
  cam: Camera;
  particles: Particles;
  pbullets: Pool<Bullet>;
  ebullets: Pool<Bullet>;
  players: Player[];
  enemies: Enemy[];
  audio: AudioEngine;
  debug: DebugFlags;
  time: number;
  shake(mag: number, t?: number): void;
  addScore(n: number, playerIndex: number): void;
  nearestPlayer(x: number, y: number): Player | null;
  spawnPickup(x: number, y: number, kind: string, weapon?: string): void;
  spawnEnemy(kind: string, x: number, y: number, facing?: 1 | -1): Enemy | null;
  /** explosion at a world point: damages entities and destroys breakable tiles */
  explode(x: number, y: number, radius: number, dmg: number): void;
  boss: Boss | null;
  bossActive: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  shootHeld: boolean;
}
