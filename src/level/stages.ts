import { TILE } from '../config/constants';
import { rngFrom } from '../core/math';
import { stage1Map } from './layouts';

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
  terrain: number; // 0 = flat, 1 = hilly
  pitChance: number;
  water: number;
  crates: number;
  spikes: number;
  enemyPool: string[];
  flyerPool: string[];
  density: number; // waves per 100 tiles
  bossStart: number;
  bossId: string;
  bossName: string;
  bossHp: number;
  music: number;
  /** forced-scroll section: [startTile, endTile, speedPxPerSec] */
  scroll?: [number, number, number];
  /** hand-authored tile map (returns the full column-major grid); skips procgen */
  layout?: typeof stage1Map;
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: 'STAGE 1',
    subtitle: 'FORTRESS GATE',
    theme: 'base',
    seed: 101,
    tiles: 300,
    terrain: 0.4,
    pitChance: 0.22,
    water: 0.1,
    crates: 1,
    spikes: 0.12,
    enemyPool: ['grunt', 'runner', 'turret'],
    flyerPool: ['flyer'],
    density: 1.5,
    bossStart: 252,
    bossId: 'commander',
    bossName: 'BASE COMMANDER',
    bossHp: 100,
    music: 0,
    layout: stage1Map,
  },
  {
    id: 2,
    name: 'STAGE 2',
    subtitle: 'JUNGLE INFILTRATION',
    theme: 'forest',
    seed: 202,
    tiles: 320,
    terrain: 0.8,
    pitChance: 0.3,
    water: 0.35,
    crates: 0.8,
    spikes: 0.2,
    enemyPool: ['grunt', 'runner', 'jumper', 'sniper', 'spider'],
    flyerPool: ['flyer', 'drone'],
    density: 1.7,
    bossStart: 272,
    bossId: 'guardian',
    bossName: 'FOREST GUARDIAN',
    bossHp: 130,
    music: 1,
  },
  {
    id: 3,
    name: 'STAGE 3',
    subtitle: 'IRON FOUNDRY',
    theme: 'factory',
    seed: 303,
    tiles: 330,
    terrain: 0.5,
    pitChance: 0.26,
    water: 0.15,
    crates: 1.4,
    spikes: 0.3,
    enemyPool: ['grunt', 'heavy', 'turret', 'roller', 'flame'],
    flyerPool: ['drone', 'flyer'],
    density: 1.9,
    bossStart: 282,
    bossId: 'crawler',
    bossName: 'FOUNDRY CRAWLER',
    bossHp: 160,
    music: 2,
  },
  {
    id: 4,
    name: 'STAGE 4',
    subtitle: 'UNDERGROUND CAVERN',
    theme: 'cavern',
    seed: 404,
    tiles: 340,
    terrain: 0.9,
    pitChance: 0.34,
    water: 0.3,
    crates: 0.6,
    spikes: 0.4,
    enemyPool: ['spider', 'worm', 'jumper', 'sniper', 'shield'],
    flyerPool: ['drone'],
    density: 2.0,
    bossStart: 292,
    bossId: 'worm',
    bossName: 'CAVERN MAW',
    bossHp: 190,
    music: 3,
  },
  {
    id: 5,
    name: 'STAGE 5',
    subtitle: 'RUINED CITY',
    theme: 'city',
    seed: 505,
    tiles: 350,
    terrain: 0.6,
    pitChance: 0.28,
    water: 0.12,
    crates: 1.2,
    spikes: 0.3,
    enemyPool: ['grunt', 'heavy', 'sniper', 'shield', 'bomber', 'roller'],
    flyerPool: ['flyer', 'drone'],
    density: 2.1,
    bossStart: 302,
    bossId: 'gunship',
    bossName: 'SKY GUNSHIP',
    bossHp: 220,
    music: 4,
    scroll: [120, 190, 62],
  },
  {
    id: 6,
    name: 'STAGE 6',
    subtitle: 'FROZEN STRONGHOLD',
    theme: 'snow',
    seed: 606,
    tiles: 360,
    terrain: 1,
    pitChance: 0.36,
    water: 0.25,
    crates: 1,
    spikes: 0.45,
    enemyPool: ['heavy', 'shield', 'sniper', 'mech', 'bomber', 'jumper'],
    flyerPool: ['drone', 'flyer'],
    density: 2.2,
    bossStart: 312,
    bossId: 'frostcore',
    bossName: 'FROST CORE',
    bossHp: 250,
    music: 5,
  },
  {
    id: 7,
    name: 'STAGE 7',
    subtitle: 'ALIEN HIVE',
    theme: 'alien',
    seed: 707,
    tiles: 370,
    terrain: 0.7,
    pitChance: 0.32,
    water: 0.2,
    crates: 0.7,
    spikes: 0.4,
    enemyPool: ['spider', 'worm', 'bomber', 'mech', 'shield', 'jumper'],
    flyerPool: ['drone', 'flyer'],
    density: 2.3,
    bossStart: 322,
    bossId: 'hivemind',
    bossName: 'HIVE MIND',
    bossHp: 280,
    music: 6,
  },
  {
    id: 8,
    name: 'STAGE 8',
    subtitle: 'FINAL STRONGHOLD',
    theme: 'finalbase',
    seed: 808,
    tiles: 400,
    terrain: 0.5,
    pitChance: 0.3,
    water: 0.1,
    crates: 1.3,
    spikes: 0.5,
    enemyPool: ['heavy', 'mech', 'shield', 'sniper', 'bomber', 'roller', 'grunt'],
    flyerPool: ['drone', 'flyer'],
    density: 2.5,
    bossStart: 350,
    bossId: 'doomcore',
    bossName: 'DOOM CORE',
    bossHp: 340,
    music: 7,
  },
];

export function stageDef(id: number): StageDef {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, id - 1))];
}

/** Deterministic wave layout for a stage. */
export function buildWaves(def: StageDef): Wave[] {
  const waves: Wave[] = [];
  const rnd = rngFrom(def.seed * 31 + 7);
  const usable = def.bossStart - 24;
  // higher density => waves arrive more often
  const spacing = Math.max(30, Math.round(72 - def.density * 13));
  const midX = Math.floor(usable * 0.52);

  for (let x = 90; x < usable; x += spacing) {
    const t = x / usable; // 0..1 difficulty ramp
    const size = 2 + Math.floor(t * 2.4 + rnd() * 1.6);
    const entries: WaveEntry[] = [];
    const groundCount = Math.max(1, Math.floor(size * 0.7));
    entries.push({ kind: rnd.pick(def.enemyPool), count: groundCount, from: 'right', delay: 0 });
    if (rnd() < 0.45) {
      entries.push({ kind: rnd.pick(def.enemyPool), count: 1 + Math.floor(rnd() * 2), from: 'left', delay: 0.6 });
    }
    if (rnd() < 0.42) {
      entries.push({ kind: rnd.pick(def.flyerPool), count: 1 + Math.floor(rnd() * 2), from: 'air', delay: 0.3 });
    }
    if (rnd() < 0.3) {
      entries.push({ kind: 'turret', count: 1, from: 'spot', delay: 0 });
    }
    waves.push({ x: x * TILE, entries, done: false });
  }

  // scripted mid-boss encounter
  waves.push({
    x: midX * TILE,
    entries: [
      { kind: 'mech', count: 1, from: 'right', delay: 0 },
      { kind: rnd.pick(def.enemyPool), count: 2, from: 'right', delay: 1.2 },
    ],
    done: false,
  });

  // final defensive line in front of the boss gate
  waves.push({
    x: (def.bossStart - 20) * TILE,
    entries: [
      { kind: 'turret', count: 1, from: 'spot', delay: 0 },
      { kind: rnd.pick(def.enemyPool), count: 2, from: 'right', delay: 0.5 },
      { kind: rnd.pick(def.flyerPool), count: 1, from: 'air', delay: 1.0 },
    ],
    done: false,
  });

  waves.sort((a, b) => a.x - b.x);
  return waves;
}
