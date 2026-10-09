import { PAL } from '../config/constants';

export type WeaponId = 'rifle' | 'rapid' | 'spread' | 'pierce' | 'blast' | 'laser' | 'homing';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  short: string;
  letter: string;
  color: string;
  damage: number;
  interval: number; // seconds between shots
  count: number; // bullets per shot
  spread: number; // radians between bullets
  speed: number; // px/s
  pierce: number; // enemies pierced (0 = stop on first)
  explode: number; // explosion radius, 0 = none
  homing: boolean;
  laser: boolean;
  size: [number, number];
  ammo: number; // -1 = infinite
  sfx: string;
  recoil: number; // pushes player back (px/s)
  desc: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle: {
    id: 'rifle',
    name: 'ASSAULT RIFLE',
    short: 'RIFLE',
    letter: 'R',
    color: PAL.yellow,
    damage: 12,
    interval: 0.17,
    count: 1,
    spread: 0,
    speed: 460,
    pierce: 0,
    explode: 0,
    homing: false,
    laser: false,
    size: [6, 3],
    ammo: -1,
    sfx: 'shoot',
    recoil: 30,
    desc: 'BASIC / INFINITE',
  },
  rapid: {
    id: 'rapid',
    name: 'RAPID FIRE',
    short: 'RAPID',
    letter: 'M',
    color: PAL.cyan,
    damage: 9,
    interval: 0.075,
    count: 1,
    spread: 0.02,
    speed: 520,
    pierce: 0,
    explode: 0,
    homing: false,
    laser: false,
    size: [5, 3],
    ammo: 90,
    sfx: 'shoot',
    recoil: 22,
    desc: 'VERY FAST RATE',
  },
  spread: {
    id: 'spread',
    name: 'SPREAD SHOT',
    short: 'SPREAD',
    letter: 'S',
    color: PAL.orange,
    damage: 10,
    interval: 0.34,
    count: 5,
    spread: 0.19,
    speed: 430,
    pierce: 0,
    explode: 0,
    homing: false,
    laser: false,
    size: [4, 4],
    ammo: 40,
    sfx: 'spread',
    recoil: 90,
    desc: '5-WAY FAN',
  },
  pierce: {
    id: 'pierce',
    name: 'PIERCE ROUND',
    short: 'PIERCE',
    letter: 'P',
    color: PAL.white,
    damage: 16,
    interval: 0.26,
    count: 1,
    spread: 0,
    speed: 620,
    pierce: 4,
    explode: 0,
    homing: false,
    laser: false,
    size: [9, 3],
    ammo: 45,
    sfx: 'pierce',
    recoil: 55,
    desc: 'PASSES THROUGH',
  },
  blast: {
    id: 'blast',
    name: 'BLAST CANNON',
    short: 'BLAST',
    letter: 'B',
    color: PAL.red,
    damage: 20,
    interval: 0.5,
    count: 1,
    spread: 0,
    speed: 330,
    pierce: 0,
    explode: 34,
    homing: false,
    laser: false,
    size: [7, 7],
    ammo: 28,
    sfx: 'blast',
    recoil: 120,
    desc: 'AREA EXPLOSION',
  },
  laser: {
    id: 'laser',
    name: 'LASER LANCE',
    short: 'LASER',
    letter: 'L',
    color: PAL.magenta,
    damage: 11,
    interval: 0.1,
    count: 1,
    spread: 0,
    speed: 900,
    pierce: 99,
    explode: 0,
    homing: false,
    laser: true,
    size: [14, 3],
    ammo: 60,
    sfx: 'laser',
    recoil: 10,
    desc: 'FULL PENETRATION',
  },
  homing: {
    id: 'homing',
    name: 'SEEKER MISSILE',
    short: 'SEEKER',
    letter: 'H',
    color: PAL.green,
    damage: 18,
    interval: 0.3,
    count: 2,
    spread: 0.35,
    speed: 300,
    pierce: 0,
    explode: 20,
    homing: true,
    laser: false,
    size: [6, 5],
    ammo: 35,
    sfx: 'homing',
    recoil: 40,
    desc: 'TRACKS TARGETS',
  },
};

export const WEAPON_ORDER: WeaponId[] = ['rifle', 'rapid', 'spread', 'pierce', 'blast', 'laser', 'homing'];

export function weaponDef(id: WeaponId): WeaponDef {
  return WEAPONS[id] ?? WEAPONS.rifle;
}
