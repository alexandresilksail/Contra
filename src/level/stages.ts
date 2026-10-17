import { TILE } from '../config/constants';
import { rngFrom } from '../core/math';
import { stage1Map } from './layouts';

/**
 * Stage 1 only. The project is a faithful replica of the original Contra
 * (NES/FC version - see docs/stage1-reference-baseline.md) opening stage;
 * stages 2-8 were dropped on purpose (git history keeps them, tag
 * backup/pre-stage1-pivot-5244009 marks the pre-pivot tree).
 */
export interface WaveEntry {
  kind: string;
  count: number;
  from: 'right' | 'left' | 'air' | 'spot' | 'ground';
  yOffset?: number;
  delay?: number;
}

export interface Wave {
  x: number; // world x that triggers the wave
  entries: WaveEntry[];
  done: boolean;
}

export interface StageDef {
  id: number;
  name: string;
  subtitle: string;
  theme: string;
  seed: number;
  tiles: number;
  enemyPool: string[];
  density: number; // waves per 100 tiles
  bossStart: number;
  bossId: string;
  bossName: string;
  bossHp: number;
  music: number;
  /** distinct boss-battle track index; falls back to `music` when unset */
  bossMusic?: number;
  /** water is lethal on contact (drowning) instead of wadeable */
  deadlyWater?: boolean;
  /** hand-authored tile map (returns the full column-major grid) */
  layout?: typeof stage1Map;
}

export const STAGE_COUNT = 1;

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: 'STAGE 1',
    subtitle: 'FORTRESS GATE',
    theme: 'base',
    seed: 101,
    // 216 columns == the exact width of the uploaded map image (3456px / 16),
    // which is the level layout itself and is drawn 1:1 by the renderer.
    tiles: 216,
    // Stage 1 only uses enemy kinds that have an uploaded sprite sheet (the
    // red-commando column of players.png). turret/flyer/mech have no uploaded
    // art, so they fall back to procedural geometry - which the spec forbids -
    // hence they are excluded here. See docs/asset-manifest.md.
    enemyPool: ['grunt', 'runner', 'heavy', 'sniper', 'shield', 'bomber', 'jumper', 'flame'],
    density: 1.5,
    // Boss gate sits BEFORE the ravine (pits at cols 144-169). The arena is the
    // single screen [100, 139]; the camera locks there, so the ravine and the
    // fortress wall (209-215) are natural scenery the player never crosses.
    bossStart: 100,
    bossId: 'commander',
    bossName: 'BASE COMMANDER',
    bossHp: 100,
    music: 0,
    // Stage 1 deep restoration: a distinct boss-battle theme (original
    // composition - Konami's boss BGM cannot be used) instead of just
    // speeding up the stage track, and lethal water (drowning) like the
    // original, including the river under the two bridges.
    bossMusic: 1, // BOSS_TRACK
    deadlyWater: true,
    layout: stage1Map,
  },
];

export function stageDef(id: number): StageDef {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, id - 1))];
}

/** Deterministic wave layout for the stage. */
export function buildWaves(def: StageDef): Wave[] {
  const waves: Wave[] = [];
  const rnd = rngFrom(def.seed * 31 + 7);
  // usable playable span before the boss gate; clamped so short stages still
  // get a few waves (the loop below scales to the stage length)
  const usable = Math.max(60, def.bossStart - 24);
  // higher density => waves arrive more often. Stage 1's gate sits early
  // (before the ravine), so spacing is tight enough to still deliver a full
  // set of encounters.
  const spacing = Math.min(
    Math.max(28, Math.round(72 - def.density * 13)),
    Math.max(20, Math.round(usable * 0.28)),
  );
  // A wave fires once it passes cam.x + VIEW_W*0.75, so the first one has to
  // sit beyond that or the whole opening wave is dumped on the spawn point
  // (enemies spawn on top of the players and shove them around).
  const startX = Math.max(34, Math.min(90, Math.round(usable * 0.32)));
  const midX = Math.floor(usable * 0.52);

  for (let x = startX; x < usable; x += spacing) {
    const t = x / usable; // 0..1 difficulty ramp
    const size = 2 + Math.floor(t * 2.4 + rnd() * 1.6);
    const entries: WaveEntry[] = [];
    const groundCount = Math.max(1, Math.floor(size * 0.7));
    entries.push({ kind: rnd.pick(def.enemyPool), count: groundCount, from: 'right', delay: 0 });
    if (rnd() < 0.45) {
      entries.push({ kind: rnd.pick(def.enemyPool), count: 1 + Math.floor(rnd() * 2), from: 'left', delay: 0.6 });
    }
    if (rnd() < 0.3) {
      // spot spawns only use kinds that have an uploaded sprite (the
      // red-commando column of players.png); geometric turret is excluded.
      // See docs/asset-manifest.md.
      entries.push({ kind: rnd.pick(def.enemyPool), count: 1, from: 'spot', delay: 0 });
    }
    waves.push({ x: x * TILE, entries, done: false });
  }

  // scripted mid-boss encounter (a heavy soldier)
  waves.push({
    x: midX * TILE,
    entries: [
      { kind: 'heavy', count: 1, from: 'right', delay: 0 },
      { kind: rnd.pick(def.enemyPool), count: 2, from: 'right', delay: 1.2 },
    ],
    done: false,
  });

  // final defensive line in front of the boss gate (soldiers only - no
  // uploaded turret/flyer art, so no geometric enemies spawn)
  waves.push({
    x: (def.bossStart - 20) * TILE,
    entries: [
      { kind: 'shield', count: 1, from: 'spot', delay: 0 },
      { kind: rnd.pick(def.enemyPool), count: 2, from: 'right', delay: 0.5 },
    ],
    done: false,
  });

  waves.sort((a, b) => a.x - b.x);
  return waves;
}
