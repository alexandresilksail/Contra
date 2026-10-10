/**
 * ALL artwork in this game is generated procedurally at boot time:
 * characters, enemies, bosses, tiles, backgrounds and pickups are drawn with
 * 1px rect operations onto offscreen canvases. No external image files exist.
 */
import { PAL } from '../config/constants';
import { makeCanvas, ctxOf, flipH, type Sprite, type SpriteSet } from './pixel';
import { packPlayerArt, packEnemyFrames } from './pack';
import { makeRng } from '../core/math';

/** Humanoid "commando" enemies that reuse the authentic red-soldier sheet. */
const SOLDIER_KINDS = new Set<string>([
  'grunt', 'runner', 'heavy', 'sniper', 'shield', 'bomber', 'jumper', 'flame',
]);

export type { Sprite, SpriteSet };

type Ctx = CanvasRenderingContext2D;
const r = (g: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/* ------------------------------------------------------------------ */
/* humanoid builder                                                     */
/* ------------------------------------------------------------------ */

export interface HumanOpts {
  w: number;
  h: number;
  skin: string;
  armor: string;
  armorDark: string;
  cloth: string;
  helmet: string;
  accent: string;
  gun?: string;
  bulk?: number;
  helmetStyle?: 'cap' | 'horns' | 'dome' | 'visor' | 'none' | 'band';
  legs?: 'boots' | 'thin' | 'claw' | 'wheel';
}

export type Pose =
  | 'idle'
  | 'run0' | 'run1' | 'run2' | 'run3' | 'run4' | 'run5'
  | 'jump' | 'fall' | 'crouch' | 'climb0' | 'climb1'
  | 'hurt' | 'dead0' | 'dead1' | 'victory';

export interface HumanDrawOpts {
  /**
   * Skip the baked-in rifle. Used for player bodies: the weapon is drawn at
   * runtime rotated to the live aim angle, so it stays attached to the hand
   * in all 8 directions instead of always pointing right.
   */
  noGun?: boolean;
}

export function drawHumanoid(o: HumanOpts, pose: Pose, opts?: HumanDrawOpts): Sprite {
  const W = o.w;
  const H = o.h;
  const c = makeCanvas(W, H);
  const g = ctxOf(c);
  const cx = Math.floor(W / 2);
  const bulk = o.bulk ?? 0;
  const out = PAL.outline;
  const ground = H - 1;

  if (pose === 'dead0' || pose === 'dead1') {
    // lying on the ground
    const y = ground - 5;
    r(g, cx - 7, y, 14, 5, o.armor);
    r(g, cx - 7, y + 4, 14, 1, o.armorDark);
    r(g, cx + 5, y - 2, 4, 4, o.skin);
    r(g, cx + 5, y - 3, 4, 1, o.helmet);
    r(g, cx - 9, y + 1, 3, 3, o.armorDark);
    r(g, cx - 6, y - 1, 3, 2, o.cloth);
    for (let i = 0; i < 3; i++) r(g, cx - 4 + i * 4, y + 5, 3, 1, out);
    return c;
  }

  const crouch = pose === 'crouch';
  const climb = pose === 'climb0' || pose === 'climb1';
  const jump = pose === 'jump';
  const fall = pose === 'fall';
  const hurt = pose === 'hurt';

  const bodyH = crouch ? 11 : 15; // head+torso
  const legH = crouch ? 5 : 7;
  const baseY = ground - (crouch ? 1 : 0);
  const feetY = baseY - legH + 1; // top of legs
  const torsoTop = feetY - (bodyH - 6); // head height 6
  const headY = torsoTop;

  const bob = pose === 'run1' || pose === 'run3' ? 1 : 0;
  const yy = (v: number) => v + (hurt ? 1 : 0) + bob;

  /* --- legs --- */
  const legW = 3 + (bulk > 0 ? 1 : 0);
  const drawLegs = (lx: number, ly: number, spread: number, lift: number) => {
    r(g, lx, ly, legW, legH - lift, o.cloth);
    r(g, lx, ly + legH - lift - 2, legW, 2, o.armorDark);
    if (o.legs === 'thin') r(g, lx + 1, ly, 1, legH - lift, o.armorDark);
    if (spread) r(g, lx + spread, ly + legH - 2, legW, 2, out);
  };

  if (climb) {
    const up = pose === 'climb1';
    drawLegs(cx - 4, yy(feetY), 0, up ? 2 : 0);
    drawLegs(cx + 1, yy(feetY), 0, up ? 0 : 2);
  } else if (jump) {
    drawLegs(cx - 4, yy(feetY), 1, 2);
    drawLegs(cx + 1, yy(feetY) + 2, -1, 0);
  } else if (fall) {
    drawLegs(cx - 5, yy(feetY), -2, 0);
    drawLegs(cx + 3, yy(feetY), 2, 1);
  } else if (crouch) {
    drawLegs(cx - 4, yy(feetY) + 1, 0, 1);
    drawLegs(cx + 1, yy(feetY) + 1, 0, 1);
  } else {
    switch (pose) {
      case 'run0':
        drawLegs(cx - 4, yy(feetY), 2, 0);
        drawLegs(cx + 1, yy(feetY), -2, 1);
        break;
      case 'run1':
        drawLegs(cx - 3, yy(feetY), 0, 2);
        drawLegs(cx, yy(feetY), 0, 0);
        break;
      case 'run2':
        drawLegs(cx - 4, yy(feetY), -2, 1);
        drawLegs(cx + 1, yy(feetY), 2, 0);
        break;
      case 'run3':
        drawLegs(cx - 3, yy(feetY), 0, 0);
        drawLegs(cx, yy(feetY), 0, 2);
        break;
      case 'run4':
        drawLegs(cx - 5, yy(feetY), 2, 1);
        drawLegs(cx + 2, yy(feetY), -2, 0);
        break;
      case 'run5':
        drawLegs(cx - 2, yy(feetY), 0, 1);
        drawLegs(cx - 1, yy(feetY), 0, 0);
        break;
      default:
        drawLegs(cx - 4 + (bulk > 1 ? -1 : 0), yy(feetY), 0, 0);
        drawLegs(cx + 1 + (bulk > 1 ? 1 : 0), yy(feetY), 0, 0);
    }
  }

  /* --- torso --- */
  const tw = 8 + bulk * 2;
  const tx = cx - tw / 2;
  const torsoY = yy(torsoTop + 6);
  const torsoH = crouch ? 5 : 8;
  r(g, tx, torsoY, tw, torsoH, o.armor);
  r(g, tx, torsoY + torsoH - 1, tw, 1, o.armorDark);
  r(g, tx + 1, torsoY + 1, tw - 2, Math.max(1, torsoH - 3), o.cloth);
  r(g, tx + 1, torsoY + Math.max(1, torsoH - 4), tw - 2, 1, o.accent);
  if (bulk > 0) {
    r(g, tx - 1, torsoY + 1, 1, torsoH - 2, o.armorDark);
    r(g, tx + tw, torsoY + 1, 1, torsoH - 2, o.armorDark);
  }

  /* --- head --- */
  const hy = yy(headY) + (crouch ? 1 : 0);
  r(g, cx - 3, hy + 1, 6, 5, o.skin);
  r(g, cx - 3, hy + 5, 6, 1, PAL.skinDark);
  r(g, cx + 1, hy + 2, 1, 1, out); // eye
  switch (o.helmetStyle) {
    case 'cap':
      r(g, cx - 4, hy, 8, 2, o.helmet);
      r(g, cx - 4, hy + 2, 1, 1, o.helmet);
      break;
    case 'dome':
      r(g, cx - 4, hy - 1, 8, 3, o.helmet);
      r(g, cx - 3, hy + 2, 6, 1, PAL.black);
      break;
    case 'visor':
      r(g, cx - 4, hy, 8, 2, o.helmet);
      r(g, cx - 3, hy + 1, 6, 2, o.accent);
      r(g, cx + 1, hy + 1, 3, 2, PAL.black);
      break;
    case 'band':
      r(g, cx - 4, hy + 1, 8, 2, o.helmet);
      r(g, cx + 3, hy + 2, 3, 1, o.helmet);
      break;
    case 'horns':
      r(g, cx - 4, hy, 8, 2, o.helmet);
      r(g, cx - 5, hy - 1, 2, 2, o.helmet);
      r(g, cx + 3, hy - 1, 2, 2, o.helmet);
      break;
    default:
      break;
  }

  /* --- arms --- */
  const armY = torsoY + 1;
  if (climb) {
    const up = pose === 'climb1';
    r(g, cx - 5, armY - (up ? 3 : 0), 2, 5, o.skin);
    r(g, cx + 3, armY - (up ? 0 : 3), 2, 5, o.skin);
  } else if (jump || fall) {
    r(g, cx - 6, armY - 2, 2, 4, o.skin);
    r(g, cx + 4, armY + (fall ? 2 : 0), 2, 4, o.skin);
  } else if (hurt) {
    r(g, cx - 6, armY - 1, 2, 4, o.skin);
    r(g, cx + 4, armY - 1, 2, 4, o.skin);
  } else {
    r(g, cx - 5 - bulk, armY + (crouch ? 1 : 0), 2, 4, o.skin);
    r(g, cx - 5 - bulk, armY + 3 + (crouch ? 1 : 0), 2, 1, PAL.skinDark);
  }

  /* --- weapon (right hand, pointing +x) --- */
  if (o.gun && !opts?.noGun) {
    const gy = armY + (crouch ? 2 : 1);
    r(g, cx + 2, gy, 7, 2, o.gun);
    r(g, cx + 7, gy - 1, 2, 1, o.gun);
    r(g, cx + 1, gy + 2, 3, 1, o.armorDark);
  }

  /* --- victory pose --- */
  if (pose === 'victory') {
    r(g, cx - 6, torsoY - 6, 2, 6, o.skin);
    r(g, cx + 4, torsoY - 6, 2, 6, o.skin);
  }

  return c;
}

/* ------------------------------------------------------------------ */
/* player characters                                                    */
/* ------------------------------------------------------------------ */

/**
 * Armed variants of every locomotion pose. In the original the commando keeps
 * his rifle raised while running / jumping / proning, so firing COMBINES with
 * locomotion instead of interrupting it.
 */
export interface ShootArt {
  idle: SpriteSet;
  run: SpriteSet[];
  jump: SpriteSet;
  fall: SpriteSet;
  crouch: SpriteSet;
  climb: SpriteSet[];
}

export interface PlayerArt {
  idle: SpriteSet;
  run: SpriteSet[];
  jump: SpriteSet;
  fall: SpriteSet;
  crouch: SpriteSet;
  climb: SpriteSet[];
  hurt: SpriteSet;
  dead: SpriteSet[];
  victory: SpriteSet;
  /** rifle-raised variants, selected while `shootT > 0` */
  shoot: ShootArt;
  gun: Sprite[]; // 8 aim directions
  portrait: Sprite;
  /** true when the body poses come from the sprite pack (guns are baked in) */
  packActive?: boolean;
}

const mkSet = (frames: Sprite[]): SpriteSet => ({ right: frames, left: frames.map(flipH) });

function bakeGun(color: string, len: number): Sprite[] {
  const out: Sprite[] = [];
  const base = makeCanvas(len + 4, 8);
  {
    const g = ctxOf(base);
    r(g, 0, 3, len, 3, color);
    r(g, len - 2, 1, 3, 2, PAL.steelDark);
    r(g, 0, 5, 3, 2, PAL.black);
    r(g, len, 2, 3, 4, PAL.steel);
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const size = 16;
    const cv = makeCanvas(size, size);
    const g = ctxOf(cv);
    g.imageSmoothingEnabled = false;
    g.translate(size / 2, size / 2);
    g.rotate(ang);
    g.drawImage(base, -2, -4);
    out.push(cv);
  }
  return out;
}

function bakePortrait(o: HumanOpts, scale: number): Sprite {
  const body = drawHumanoid(o, 'idle');
  const cv = makeCanvas(body.width * scale, body.height * scale);
  const g = ctxOf(cv);
  g.imageSmoothingEnabled = false;
  g.drawImage(body, 0, 0, body.width * scale, body.height * scale);
  return cv;
}

export const CHAR_DEFS = [
  {
    id: 'razor' as const,
    name: 'RAZOR',
    subtitle: 'FAST / STABLE',
    desc: ['HIGH SPEED', 'NORMAL JUMP', 'STEADY FIRE'],
    speed: 1.06,
    jump: 1.0,
    damage: 1.0,
    recoil: 1.0,
    opts: {
      w: 16,
      h: 24,
      skin: PAL.skin,
      armor: PAL.blue,
      armorDark: PAL.blueDark,
      cloth: '#2b3a52',
      helmet: PAL.cyan,
      accent: PAL.yellow,
      gun: PAL.steel,
      helmetStyle: 'band' as const,
      legs: 'boots' as const,
    },
  },
  {
    id: 'titan' as const,
    name: 'TITAN',
    subtitle: 'POWER / RECOIL-LESS',
    desc: ['NORMAL SPEED', 'HEAVY FIREPOWER', 'LOW RECOIL'],
    speed: 0.88,
    jump: 1.06,
    damage: 1.35,
    recoil: 0.55,
    opts: {
      w: 18,
      h: 25,
      skin: PAL.skinDark,
      armor: PAL.red,
      armorDark: PAL.redDark,
      cloth: '#4a2630',
      helmet: PAL.orange,
      accent: PAL.white,
      gun: PAL.steelDark,
      bulk: 1,
      helmetStyle: 'visor' as const,
      legs: 'boots' as const,
    },
  },
];

export type CharId = (typeof CHAR_DEFS)[number]['id'];

export function buildPlayerArt(defIndex: number): PlayerArt {
  const o = CHAR_DEFS[defIndex].opts as HumanOpts;
  // 6-frame ground cycle, matching the 6-frame run cycle measured on the
  // character sheet (see docs/assets-inventory.md).
  const runPoses: Pose[] = ['run0', 'run1', 'run2', 'run3', 'run4', 'run5'];
  // bodies carry no baked rifle: the runtime aim overlay owns the weapon so it
  // points where the player is actually aiming.
  const body = (p: Pose) => drawHumanoid(o, p, { noGun: true });
  const base: PlayerArt = {
    idle: mkSet([body('idle')]),
    run: runPoses.map((p) => mkSet([body(p)])),
    jump: mkSet([body('jump')]),
    fall: mkSet([body('fall')]),
    crouch: mkSet([body('crouch')]),
    climb: [mkSet([body('climb0')]), mkSet([body('climb1')])],
    hurt: mkSet([body('hurt')]),
    dead: [mkSet([body('dead0')]), mkSet([body('dead1')])],
    victory: mkSet([body('victory')]),
    // procedural armed poses reuse the locomotion bodies; the raised rifle is
    // drawn on top, rotated to the live aim angle.
    shoot: {
      idle: mkSet([body('idle')]),
      run: runPoses.map((p) => mkSet([body(p)])),
      jump: mkSet([body('jump')]),
      fall: mkSet([body('fall')]),
      crouch: mkSet([body('crouch')]),
      climb: [mkSet([body('climb0')]), mkSet([body('climb1')])],
    },
    gun: bakeGun(o.gun ?? PAL.steel, 11),
    portrait: bakePortrait(o, 3),
  };
  // optional sprite-pack override (bodies + armed variants; gun stays procedural)
  const pack = packPlayerArt(CHAR_DEFS[defIndex].id, o.h - 2);
  return pack ? { ...base, ...pack, packActive: true } : base;
}

/* ------------------------------------------------------------------ */
/* enemies                                                             */
/* ------------------------------------------------------------------ */

export interface EnemyArt {
  frames: SpriteSet[]; // per animation state
  corpse: Sprite;
}

/** Draw a non-humanoid enemy silhouette from a compact spec. */
function drawCreature(
  w: number,
  h: number,
  draw: (g: Ctx, w: number, h: number, t: number) => void,
  t = 0,
): Sprite {
  const c = makeCanvas(w, h);
  const g = ctxOf(c);
  draw(g, w, h, t);
  return c;
}

function soldierSet(o: HumanOpts, walkFrames = 4): SpriteSet[] {
  const poses: Pose[] = ['idle', 'run0', 'run1', 'run2', 'run3'];
  return poses.slice(0, 1 + walkFrames).map((p) => mkSet([drawHumanoid(o, p)]));
}

function turretSet(color: string): SpriteSet[] {
  const mk = (angle: number) =>
    drawCreature(20, 18, (g, w, h) => {
      r(g, 1, 10, 18, 7, PAL.steelDark);
      r(g, 1, 10, 18, 2, color);
      r(g, 3, 16, 14, 1, PAL.black);
      r(g, 6, 4, 8, 7, color);
      r(g, 7, 5, 6, 3, PAL.steel);
      r(g, 8, 6, 3, 1, PAL.red);
      const gx = 10;
      const gy = 8;
      const rad = (angle * Math.PI) / 180;
      for (let i = 0; i < 9; i++) {
        const px = Math.round(gx + Math.cos(rad) * i);
        const py = Math.round(gy + Math.sin(rad) * i);
        r(g, px, py, 2, 2, PAL.steel);
        r(g, px, py + 1, 2, 1, PAL.black);
      }
    });
  return [0, -30, -60, -90].map((a) => mkSet([mk(a)]));
}

function flyerSet(body: string, accent: string): SpriteSet[] {
  const mk = (t: number) =>
    drawCreature(24, 18, (g, w, h) => {
      r(g, 6, 8, 12, 6, body);
      r(g, 7, 9, 10, 3, accent);
      r(g, 15, 10, 3, 2, PAL.yellow);
      r(g, 4, 12, 4, 3, PAL.steelDark);
      r(g, 16, 12, 4, 3, PAL.steelDark);
      const spin = t % 2;
      r(g, 1, 5 + spin, 22, 2, PAL.steel);
      r(g, 2, 4, 3, 3, PAL.steelDark);
      r(g, 19, 4, 3, 3, PAL.steelDark);
      r(g, 8, 14, 8, 2, PAL.black);
      r(g, 9, 16, 2, 2, PAL.red);
      r(g, 13, 16, 2, 2, PAL.red);
    });
  return [mkSet([mk(0)]), mkSet([mk(1)])];
}

function spiderSet(body: string): SpriteSet[] {
  const mk = (t: number) =>
    drawCreature(22, 16, (g) => {
      const lift = t % 2;
      r(g, 7, 5, 8, 6, body);
      r(g, 8, 6, 6, 4, PAL.black);
      r(g, 9, 7, 2, 2, PAL.red);
      r(g, 13, 7, 2, 2, PAL.red);
      for (let i = 0; i < 4; i++) {
        const lx = 2 + i * 5;
        const up = (i + lift) % 2 === 0;
        r(g, lx, up ? 4 : 10, 2, 5, PAL.black);
        r(g, lx - 1, up ? 9 : 14, 4, 2, PAL.black);
      }
      r(g, 5, 11, 12, 1, PAL.black);
    });
  return [mkSet([mk(0)]), mkSet([mk(1)])];
}

function mechSet(armor: string, accent: string): SpriteSet[] {
  const mk = (t: number) =>
    drawCreature(28, 30, (g) => {
      const step = t % 2;
      r(g, 4, 6, 20, 12, armor);
      r(g, 5, 7, 18, 6, accent);
      r(g, 8, 9, 5, 3, PAL.black);
      r(g, 16, 9, 5, 3, PAL.black);
      r(g, 11, 10, 2, 1, PAL.red);
      r(g, 17, 10, 2, 1, PAL.red);
      r(g, 22, 8, 6, 3, PAL.steelDark); // cannon
      r(g, 26, 9, 2, 1, PAL.yellow);
      r(g, 3, 18, 22, 3, armor);
      r(g, 5 + step, 21, 4, 8, PAL.steelDark);
      r(g, 19 - step, 21, 4, 8, PAL.steelDark);
      r(g, 4 + step, 28, 6, 2, PAL.black);
      r(g, 18 - step, 28, 6, 2, PAL.black);
    });
  return [mkSet([mk(0)]), mkSet([mk(1)])];
}

function rollerSet(color: string): SpriteSet[] {
  const mk = (t: number) =>
    drawCreature(18, 18, (g) => {
      const spin = (t % 4) * 2;
      r(g, 1, 4, 16, 12, color);
      r(g, 2, 5, 14, 4, PAL.steel);
      r(g, 6, 6, 3, 2, PAL.red);
      r(g, 0, 14, 18, 4, PAL.black);
      r(g, 1 + (spin % 4), 16, 3, 2, PAL.steelDark);
      r(g, 6 + ((spin + 2) % 4), 16, 3, 2, PAL.steelDark);
      r(g, 11 + ((spin + 1) % 4), 16, 3, 2, PAL.steelDark);
      r(g, 8, 2, 2, 2, PAL.yellow);
    });
  return [0, 1, 2, 3].map((i) => mkSet([mk(i)]));
}

function droneSet(color: string): SpriteSet[] {
  const mk = (t: number) =>
    drawCreature(20, 20, (g) => {
      r(g, 2, 6, 16, 8, color);
      r(g, 3, 7, 14, 6, PAL.steelDark);
      r(g, 6, 8, 8, 4, PAL.black);
      r(g, 8, 9, 4, 2, t % 2 ? PAL.red : PAL.yellow);
      r(g, 0, 8, 3, 4, PAL.steel);
      r(g, 17, 8, 3, 4, PAL.steel);
      r(g, 4, 14, 3, 3, PAL.steelDark);
      r(g, 13, 14, 3, 3, PAL.steelDark);
      r(g, 9, 2, 2, 4, PAL.cyan);
    });
  return [mkSet([mk(0)]), mkSet([mk(1)])];
}

function wormSet(color: string): SpriteSet[] {
  const mk = (t: number) =>
    drawCreature(24, 16, (g) => {
      const w = t % 2;
      for (let i = 0; i < 4; i++) {
        const sx = 3 + i * 5;
        const sy = 6 + (i % 2 === 0 ? 0 : 1) + (w && i % 2 ? -1 : 0);
        r(g, sx, sy, 6, 7, color);
        r(g, sx + 1, sy + 1, 4, 3, PAL.black);
      }
      r(g, 20, 5, 5, 9, color);
      r(g, 22, 7, 2, 2, PAL.red);
      r(g, 21, 10, 4, 2, PAL.white);
    });
  return [mkSet([mk(0)]), mkSet([mk(1)])];
}

export const ENEMY_ART: Record<string, () => SpriteSet[]> = {
  grunt: () =>
    soldierSet({
      w: 16, h: 24, skin: PAL.skin, armor: '#6f7a4a', armorDark: '#3d4526',
      cloth: '#39402a', helmet: '#8d9a5c', accent: PAL.yellow, gun: PAL.steelDark,
      helmetStyle: 'cap', legs: 'boots',
    }),
  runner: () =>
    soldierSet({
      w: 15, h: 23, skin: PAL.skin, armor: '#a8622c', armorDark: '#5c3316',
      cloth: '#7a4520', helmet: PAL.orange, accent: PAL.white, helmetStyle: 'band', legs: 'thin',
    }),
  heavy: () =>
    soldierSet({
      w: 20, h: 26, skin: PAL.skinDark, armor: '#7a4a8a', armorDark: '#3f2450',
      cloth: '#2c1a38', helmet: '#9a62ad', accent: PAL.magenta, gun: PAL.steel, bulk: 2,
      helmetStyle: 'dome', legs: 'boots',
    }),
  sniper: () =>
    soldierSet({
      w: 16, h: 24, skin: PAL.skin, armor: '#3f6b5a', armorDark: '#1f3a30',
      cloth: '#2a4a3f', helmet: '#4f8a72', accent: PAL.cyan, gun: PAL.black,
      helmetStyle: 'visor', legs: 'boots',
    }),
  shield: () =>
    soldierSet({
      w: 18, h: 25, skin: PAL.skin, armor: '#4a5a7a', armorDark: '#25304a',
      cloth: '#2a3550', helmet: '#6a7ea8', accent: PAL.steel, gun: PAL.steelDark, bulk: 1,
      helmetStyle: 'dome', legs: 'boots',
    }),
  bomber: () =>
    soldierSet({
      w: 16, h: 22, skin: PAL.skinDark, armor: '#b03a3a', armorDark: '#5e1a1a',
      cloth: '#7a2424', helmet: PAL.yellow, accent: PAL.white, helmetStyle: 'horns', legs: 'thin',
    }),
  jumper: () =>
    soldierSet({
      w: 15, h: 22, skin: PAL.skin, armor: '#2f7a7a', armorDark: '#174040',
      cloth: '#1f5a5a', helmet: PAL.cyan, accent: PAL.white, helmetStyle: 'band', legs: 'claw',
    }),
  flame: () =>
    soldierSet({
      w: 18, h: 24, skin: PAL.skin, armor: '#8a5a2b', armorDark: '#4e3117',
      cloth: '#5e3a1c', helmet: PAL.orange, accent: PAL.red, gun: PAL.brownDark, bulk: 1,
      helmetStyle: 'dome', legs: 'boots',
    }),
  turret: () => turretSet('#6a7080'),
  flyer: () => flyerSet('#5a6a8a', PAL.cyan),
  spider: () => spiderSet('#5a3a2a'),
  mech: () => mechSet('#6a6a7a', '#8a8a9a'),
  roller: () => rollerSet('#8a4a2a'),
  drone: () => droneSet('#4a7a8a'),
  worm: () => wormSet('#7a5a8a'),
};

export function buildEnemyArt(kind: string, targetH = 22): SpriteSet[] {
  // Authentic commando enemies: reuse the red-soldier sheet, normalised to the
  // entity hitbox height so they line up with collision/foot placement.
  if (SOLDIER_KINDS.has(kind)) {
    const pack = packEnemyFrames(targetH);
    if (pack) return pack;
  }
  const build = ENEMY_ART[kind] ?? ENEMY_ART.grunt;
  return build();
}

/* ------------------------------------------------------------------ */
/* bosses                                                              */
/* ------------------------------------------------------------------ */

export interface BossArt {
  body: Sprite[];
  weak: Sprite;
}

function bossFrame(
  w: number,
  h: number,
  draw: (g: Ctx, w: number, h: number, t: number) => void,
  t = 0,
): Sprite {
  return drawCreature(w, h, draw, t);
}

export function buildBossArt(id: string): BossArt {
  const frames: Sprite[] = [];
  switch (id) {
    case 'commander': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(72, 64, (g, w, h) => {
            const s = t;
            r(g, 4, 20, 64, 34, PAL.steelDark);
            r(g, 6, 22, 60, 12, '#7a5a2b');
            r(g, 6, 36, 60, 8, PAL.brownDark);
            r(g, 10, 12 + s, 24, 12, '#8f6a33');
            r(g, 14, 15 + s, 7, 5, PAL.black);
            r(g, 22, 15 + s, 7, 5, PAL.black);
            r(g, 15, 16 + s, 4, 2, PAL.red);
            r(g, 23, 16 + s, 4, 2, PAL.red);
            r(g, 40, 6 + s, 8, 26, PAL.steel); // cannon
            r(g, 38, 3 + s, 12, 5, PAL.steel);
            r(g, 43, 30, 4, 4, s === 1 ? PAL.yellow : PAL.orange);
            r(g, 54, 24, 12, 12, PAL.steelDark);
            r(g, 56, 26, 8, 6, PAL.red);
            r(g, 6, 54, 60, 8, PAL.black);
            for (let i = 0; i < 6; i++) r(g, 8 + i * 11, 56, 6, 5, PAL.steelDark);
          }),
        );
      break;
    }
    case 'guardian': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(76, 72, (g, w, h) => {
            const s = t;
            r(g, 14, 26 + s, 48, 34, '#3f6b34');
            r(g, 18, 30 + s, 40, 20, '#4f8a42');
            r(g, 22, 34 + s, 32, 10, '#2f5228');
            r(g, 20, 8 + s, 36, 22, '#5f8a3a');
            r(g, 24, 12 + s, 8, 6, PAL.yellow);
            r(g, 44, 12 + s, 8, 6, PAL.yellow);
            r(g, 26, 14 + s, 4, 3, PAL.black);
            r(g, 46, 14 + s, 4, 3, PAL.black);
            r(g, 30, 22 + s, 16, 4, PAL.white);
            for (let i = 0; i < 5; i++) r(g, 28 + i * 4, 26 + s, 2, 3, PAL.white);
            r(g, 6, 30 + s, 12, 6, '#6f4a2b');
            r(g, 58, 30 + s, 12, 6, '#6f4a2b');
            r(g, 2, 34 + s, 8, 18, '#6f4a2b');
            r(g, 66, 34 + s, 8, 18, '#6f4a2b');
            r(g, 18, 60, 12, 10, '#2f5228');
            r(g, 46, 60, 12, 10, '#2f5228');
          }),
        );
      break;
    }
    case 'crawler': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(88, 56, (g) => {
            const s = t;
            r(g, 8, 14, 72, 30, '#6a6a4a');
            r(g, 12, 18, 64, 12, '#8a8a5a');
            r(g, 12, 32, 64, 8, '#4a4a2a');
            r(g, 16, 8 + s, 20, 10, '#5a5a3a');
            r(g, 20, 10 + s, 12, 5, PAL.black);
            r(g, 22, 11 + s, 3, 3, PAL.red);
            r(g, 30, 11 + s, 3, 3, PAL.red);
            r(g, 48, 6 + s, 10, 20, PAL.steelDark); // drill
            for (let i = 0; i < 5; i++) r(g, 47, 8 + s + i * 4, 12, 2, PAL.steel);
            r(g, 66, 20, 14, 14, PAL.steelDark);
            r(g, 68, 22, 10, 6, PAL.orange);
            r(g, 4, 44, 80, 8, PAL.black);
            for (let i = 0; i < 8; i++) {
              const off = (i + s) % 2;
              r(g, 6 + i * 10, 46 + off, 8, 6, PAL.steelDark);
            }
          }),
        );
      break;
    }
    case 'worm': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(80, 64, (g) => {
            const s = t;
            for (let i = 0; i < 5; i++) {
              const sx = 6 + i * 14;
              const sy = 18 + Math.sin((i + s) * 1.2) * 5;
              r(g, sx, sy, 16, 22, '#7a3a5a');
              r(g, sx + 2, sy + 2, 12, 10, '#9a4a7a');
              r(g, sx + 4, sy + 14, 8, 4, '#4a1a30');
            }
            r(g, 62, 10 + s * 2, 18, 26, '#8a4a6a');
            r(g, 66, 14 + s * 2, 5, 5, PAL.yellow);
            r(g, 74, 14 + s * 2, 5, 5, PAL.yellow);
            r(g, 67, 15 + s * 2, 3, 3, PAL.black);
            r(g, 75, 15 + s * 2, 3, 3, PAL.black);
            r(g, 64, 28 + s * 2, 12, 5, PAL.white);
          }),
        );
      break;
    }
    case 'gunship': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(96, 48, (g) => {
            const s = t;
            r(g, 10, 14, 76, 20, '#4a5a6a');
            r(g, 14, 16, 68, 8, '#6a7a8a');
            r(g, 20, 24, 56, 6, '#2a3a4a');
            r(g, 30, 8 + s, 36, 8, '#5a6a7a');
            r(g, 36, 10 + s, 8, 4, PAL.cyan);
            r(g, 52, 10 + s, 8, 4, PAL.cyan);
            r(g, 6, 30, 12, 8, PAL.steelDark);
            r(g, 78, 30, 12, 8, PAL.steelDark);
            r(g, 14, 34, 10, 5, PAL.red);
            r(g, 72, 34, 10, 5, PAL.red);
            const spin = s * 2;
            r(g, 2, 4, 92, 2, PAL.steel);
            for (let i = 0; i < 8; i++) r(g, 4 + i * 11 + spin, 2, 3, 2, PAL.steelDark);
            r(g, 44, 38, 8, 6, PAL.yellow);
          }),
        );
      break;
    }
    case 'frostcore': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(72, 72, (g) => {
            const s = t;
            r(g, 12, 12, 48, 48, '#7fa8c8');
            r(g, 16, 16, 40, 40, PAL.ice);
            r(g, 20, 20, 32, 32, '#a8d0e8');
            r(g, 28, 26 + s, 16, 10, PAL.black);
            r(g, 30, 28 + s, 5, 5, s === 1 ? PAL.red : PAL.cyan);
            r(g, 38, 28 + s, 5, 5, s === 1 ? PAL.red : PAL.cyan);
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + s * 0.4;
              const px = 36 + Math.cos(a) * 34;
              const py = 36 + Math.sin(a) * 34;
              r(g, px - 3, py - 3, 7, 7, PAL.ice);
              r(g, px - 1, py - 1, 3, 3, PAL.cyan);
            }
            r(g, 24, 60, 24, 10, '#5a7f9f');
          }),
        );
      break;
    }
    case 'hivemind': {
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(84, 76, (g) => {
            const s = t;
            r(g, 18, 16 + s, 48, 44, '#5a3a7a');
            r(g, 22, 20 + s, 40, 30, '#7a4a9a');
            r(g, 26, 24 + s, 32, 18, '#3a1a5a');
            for (let i = 0; i < 7; i++) {
              const on = (i + s) % 3 !== 0;
              r(g, 26 + i * 5, 28 + s, 3, 3, on ? PAL.green : PAL.black);
            }
            r(g, 32, 36 + s, 20, 10, '#2a0a4a');
            for (let i = 0; i < 5; i++) r(g, 34 + i * 4, 40 + s, 2, 4, PAL.white);
            for (let i = 0; i < 6; i++) {
              const dir = i < 3 ? -1 : 1;
              const yy = 20 + s + (i % 3) * 14;
              r(g, dir < 0 ? 6 : 70, yy, 14, 6, '#6a3a8a');
              r(g, dir < 0 ? 0 : 76, yy + 1, 8, 4, '#8a5aaa');
              r(g, dir < 0 ? 1 : 78, yy + 1, 3, 2, PAL.green);
            }
            r(g, 30, 60 + s, 24, 12, '#4a2a6a');
          }),
        );
      break;
    }
    default: {
      // 'doomcore'
      for (let t = 0; t < 3; t++)
        frames.push(
          bossFrame(104, 88, (g) => {
            const s = t;
            r(g, 8, 20, 88, 56, '#3a3a4a');
            r(g, 12, 24, 80, 20, '#5a3a3a');
            r(g, 12, 48, 80, 20, '#2a2a3a');
            r(g, 24, 4 + s, 56, 20, '#4a4a5a');
            r(g, 30, 8 + s, 12, 10, PAL.black);
            r(g, 62, 8 + s, 12, 10, PAL.black);
            r(g, 32, 10 + s, 8, 5, s === 2 ? PAL.white : PAL.red);
            r(g, 64, 10 + s, 8, 5, s === 2 ? PAL.white : PAL.red);
            r(g, 40, 32, 24, 16, PAL.black);
            r(g, 44, 36, 16, 8, s === 1 ? PAL.yellow : PAL.magenta);
            r(g, 0, 34, 10, 24, PAL.steelDark);
            r(g, 94, 34, 10, 24, PAL.steelDark);
            r(g, 2, 40, 6, 12, PAL.red);
            r(g, 96, 40, 6, 12, PAL.red);
            r(g, 16, 76, 72, 10, PAL.black);
            for (let i = 0; i < 6; i++) r(g, 18 + i * 12, 78, 8, 6, PAL.steelDark);
            r(g, 46, 88 - 6, 12, 6, s === 1 ? PAL.cyan : PAL.orange);
          }),
        );
    }
  }
  const weak = makeCanvas(10, 10);
  {
    const g = ctxOf(weak);
    r(g, 0, 0, 10, 10, PAL.black);
    r(g, 1, 1, 8, 8, PAL.yellow);
    r(g, 3, 3, 4, 4, PAL.white);
    r(g, 2, 4, 6, 2, PAL.orange);
  }
  return { body: frames, weak };
}

/* ------------------------------------------------------------------ */
/* tiles & backgrounds                                                 */
/* ------------------------------------------------------------------ */

export interface ThemeColors {
  sky: [string, string];
  ground: string;
  groundTop: string;
  groundDark: string;
  platform: string;
  platformTop: string;
  bg1: string;
  bg2: string;
  bg3: string;
  hazard: string;
  water: string;
  accent: string;
}

export const THEMES: Record<string, ThemeColors> = {
  base: {
    sky: ['#1a2436', '#3a4a66'],
    ground: '#5a5f4a',
    groundTop: '#7a8a5a',
    groundDark: '#33362a',
    platform: '#6a6a7a',
    platformTop: '#9aa0b0',
    bg1: '#232c3e',
    bg2: '#2c3a52',
    bg3: '#384a66',
    hazard: '#e0a020',
    water: '#2a4a6a',
    accent: PAL.yellow,
  },
  forest: {
    sky: ['#122436', '#3a6a5a'],
    ground: '#4a3a26',
    groundTop: '#5f8a3a',
    groundDark: '#2a1f14',
    platform: '#5a4a2a',
    platformTop: '#6f9a4a',
    bg1: '#1c3326',
    bg2: '#26452f',
    bg3: '#325c3a',
    hazard: '#e0a020',
    water: '#1f5a6a',
    accent: PAL.green,
  },
  factory: {
    sky: ['#241a1a', '#5a3a2a'],
    ground: '#5a5a5a',
    groundTop: '#8a7a6a',
    groundDark: '#2e2e2e',
    platform: '#6a5a4a',
    platformTop: '#a89070',
    bg1: '#332422',
    bg2: '#463028',
    bg3: '#5a3d2e',
    hazard: '#ff6a20',
    water: '#6a3a1a',
    accent: PAL.orange,
  },
  cavern: {
    sky: ['#0a0a14', '#241a34'],
    ground: '#3a3446',
    groundTop: '#5a5068',
    groundDark: '#1e1a28',
    platform: '#4a4258',
    platformTop: '#6f6480',
    bg1: '#15121f',
    bg2: '#221a30',
    bg3: '#33254a',
    hazard: '#b04ae0',
    water: '#2a1a4a',
    accent: PAL.purple,
  },
  city: {
    sky: ['#2a1a3a', '#8a4a3a'],
    ground: '#4a4a52',
    groundTop: '#7a7a86',
    groundDark: '#282830',
    platform: '#5a5460',
    platformTop: '#8a8494',
    bg1: '#3a2440',
    bg2: '#4f2e44',
    bg3: '#68394a',
    hazard: '#ff4020',
    water: '#2a3a5a',
    accent: PAL.red,
  },
  snow: {
    sky: ['#20344a', '#7a9ab8'],
    ground: '#8a95a8',
    groundTop: '#e8f0ff',
    groundDark: '#4a5468',
    platform: '#7a8698',
    platformTop: '#d8e4f4',
    bg1: '#33506e',
    bg2: '#456a8a',
    bg3: '#5a84a8',
    hazard: '#40d0ff',
    water: '#2a5a8a',
    accent: PAL.ice,
  },
  alien: {
    sky: ['#0a1424', '#2a4a7a'],
    ground: '#2a4a4a',
    groundTop: '#4a8a7a',
    groundDark: '#142828',
    platform: '#3a5a5a',
    platformTop: '#5aaaa0',
    bg1: '#101f33',
    bg2: '#183048',
    bg3: '#22425f',
    hazard: '#40ffa0',
    water: '#1a4a6a',
    accent: PAL.cyan,
  },
  finalbase: {
    sky: ['#140810', '#4a1020'],
    ground: '#4a3a3a',
    groundTop: '#7a4a4a',
    groundDark: '#241a1a',
    platform: '#5a4040',
    platformTop: '#9a5a5a',
    bg1: '#2a1018',
    bg2: '#3d1622',
    bg3: '#521f2e',
    hazard: '#ff2a2a',
    water: '#6a1020',
    accent: PAL.magenta,
  },
};

function noiseTiles(color: string, dark: string, seed: number, density = 0.22): Sprite {
  const c = makeCanvas(16, 16);
  const g = ctxOf(c);
  const rnd = makeRng(seed);
  r(g, 0, 0, 16, 16, color);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = rnd();
      if (v < density) r(g, x, y, 1, 1, dark);
      else if (v > 1 - density * 0.4) r(g, x, y, 1, 1, PAL.white);
    }
  return c;
}

export interface TileArt {
  solid: Sprite[];
  platform: Sprite[];
  ladder: Sprite;
  spike: Sprite;
  water: Sprite[];
  crate: Sprite[];
  door: Sprite;
  backwall: Sprite;
}

export function buildTileArt(theme: ThemeColors, seed: number): TileArt {
  const solid: Sprite[] = [];
  for (let i = 0; i < 4; i++) solid.push(noiseTiles(theme.ground, theme.groundDark, seed + i * 31));
  const top = makeCanvas(16, 16);
  {
    const g = ctxOf(top);
    g.drawImage(solid[0], 0, 0);
    r(g, 0, 0, 16, 3, theme.groundTop);
    r(g, 0, 3, 16, 1, theme.groundDark);
    const rnd = makeRng(seed + 7);
    for (let x = 0; x < 16; x++) if (rnd() < 0.3) r(g, x, 3, 1, 2, theme.groundTop);
  }
  solid[0] = top;

  const platform: Sprite[] = [];
  for (let i = 0; i < 2; i++) {
    const c = makeCanvas(16, 6);
    const g = ctxOf(c);
    r(g, 0, 0, 16, 6, theme.platform);
    r(g, 0, 0, 16, 2, theme.platformTop);
    r(g, 0, 5, 16, 1, PAL.black);
    const rnd = makeRng(seed + 100 + i);
    for (let x = 0; x < 16; x += 4) if (rnd() < 0.5) r(g, x, 3, 2, 1, theme.platformTop);
    platform.push(c);
  }

  const ladder = makeCanvas(16, 16);
  {
    const g = ctxOf(ladder);
    r(g, 2, 0, 2, 16, '#8a6a3a');
    r(g, 12, 0, 2, 16, '#8a6a3a');
    for (let y = 1; y < 16; y += 5) r(g, 2, y, 12, 2, '#a88a52');
    r(g, 2, 0, 12, 1, '#5e4522');
  }

  const spike = makeCanvas(16, 16);
  {
    const g = ctxOf(spike);
    r(g, 0, 12, 16, 4, theme.groundDark);
    for (let i = 0; i < 4; i++) {
      const x = i * 4;
      for (let k = 0; k < 4; k++) r(g, x + k, 12 - k * 3, 4 - k, 3, theme.hazard);
    }
  }

  const water: Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const c = makeCanvas(16, 16);
    const g = ctxOf(c);
    r(g, 0, 0, 16, 16, theme.water);
    const rnd = makeRng(seed + 300 + i * 17);
    for (let x = 0; x < 16; x++) {
      const y = 2 + Math.floor(Math.sin((x + i * 4) * 0.7) * 2) + 3;
      if (rnd() < 0.7) r(g, x, y, 2, 1, PAL.white);
    }
    water.push(c);
  }

  const crate: Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const c = makeCanvas(16, 16);
    const g = ctxOf(c);
    r(g, 0, 0, 16, 16, '#8a6a3a');
    r(g, 1, 1, 14, 14, '#a88a52');
    r(g, 1, 1, 14, 2, '#c8a862');
    r(g, 1, 13, 14, 2, '#5e4522');
    r(g, 7, 1, 2, 14, '#5e4522');
    r(g, 1, 7, 14, 2, '#5e4522');
    if (i > 0) {
      // cracked
      r(g, 3, 3, 2, 2, PAL.black);
      r(g, 10, 8, 3, 2, PAL.black);
      if (i === 2) r(g, 5, 10, 4, 3, PAL.black);
    }
    crate.push(c);
  }

  const door = makeCanvas(16, 48);
  {
    const g = ctxOf(door);
    r(g, 0, 0, 16, 48, PAL.steelDark);
    r(g, 1, 1, 14, 46, PAL.steel);
    for (let y = 4; y < 48; y += 8) r(g, 1, y, 14, 2, PAL.black);
    r(g, 4, 20, 8, 8, PAL.red);
    r(g, 5, 21, 6, 6, PAL.yellow);
  }

  const backwall = makeCanvas(16, 16);
  {
    const g = ctxOf(backwall);
    r(g, 0, 0, 16, 16, theme.bg1);
    const rnd = makeRng(seed + 900);
    for (let y = 0; y < 16; y += 4)
      for (let x = 0; x < 16; x += 4) if (rnd() < 0.35) r(g, x, y, 3, 3, theme.bg2);
  }

  return { solid, platform, ladder, spike, water, crate, door, backwall };
}

export interface BgLayer {
  sprite: Sprite;
  speed: number; // parallax factor
  repeat: boolean;
  y: number;
}

export function buildBackground(theme: ThemeColors, seed: number): { sky: Sprite; layers: BgLayer[] } {
  const sky = makeCanvas(640, 360);
  {
    const g = ctxOf(sky);
    const grad = g.createLinearGradient(0, 0, 0, 360);
    grad.addColorStop(0, theme.sky[0]);
    grad.addColorStop(1, theme.sky[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 640, 360);
    const rnd = makeRng(seed + 4242);
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * 640);
      const y = Math.floor(rnd() * 200);
      const b = rnd() < 0.15 ? 2 : 1;
      g.fillStyle = rnd() < 0.3 ? PAL.white : theme.sky[1];
      g.fillRect(x, y, b, b);
    }
  }

  const layers: BgLayer[] = [];

  // far layer: mountains / skyline / structures
  const far = makeCanvas(640, 200);
  {
    const g = ctxOf(far);
    const rnd = makeRng(seed + 11);
    if (seed % 3 === 0) {
      // mountain silhouette
      let x = 0;
      while (x < 640) {
        const w = 60 + Math.floor(rnd() * 90);
        const h = 50 + Math.floor(rnd() * 90);
        for (let i = 0; i < w; i++) {
          const t = i / w;
          const hh = Math.round(h * Math.sin(Math.PI * t));
          r(g, x + i, 200 - hh, 1, hh, theme.bg3);
        }
        r(g, x + Math.floor(w / 2) - 6, 200 - h - 8, 12, 8, PAL.white);
        x += w - 8;
      }
    } else {
      // blocky skyline
      let x = 0;
      while (x < 640) {
        const w = 24 + Math.floor(rnd() * 40);
        const h = 40 + Math.floor(rnd() * 120);
        r(g, x, 200 - h, w, h, theme.bg3);
        for (let wy = 200 - h + 6; wy < 196; wy += 8)
          for (let wx = x + 3; wx < x + w - 4; wx += 6) if (rnd() < 0.5) r(g, wx, wy, 3, 4, theme.accent);
        x += w + 4 + Math.floor(rnd() * 10);
      }
    }
    layers.push({ sprite: far, speed: 0.15, repeat: true, y: 60 });
  }

  // mid layer: trees / pillars / pipes
  const mid = makeCanvas(640, 220);
  {
    const g = ctxOf(mid);
    const rnd = makeRng(seed + 22);
    let x = 0;
    while (x < 640) {
      const kind = Math.floor(rnd() * 3);
      if (kind === 0) {
        const h = 70 + Math.floor(rnd() * 60);
        r(g, x + 8, 220 - h, 6, h, '#4a3320');
        for (let i = 0; i < 3; i++) {
          const cy = 220 - h + 12 + i * 18;
          r(g, x + 1, cy, 20, 8, theme.bg2);
          r(g, x + 3, cy - 6, 16, 8, theme.bg2);
        }
        x += 44;
      } else if (kind === 1) {
        const h = 90 + Math.floor(rnd() * 70);
        r(g, x, 220 - h, 16, h, theme.bg2);
        r(g, x + 3, 220 - h, 10, 6, theme.bg1);
        for (let i = 0; i < h; i += 14) r(g, x, 220 - h + i, 16, 2, theme.bg1);
        x += 34;
      } else {
        const h = 50 + Math.floor(rnd() * 40);
        r(g, x, 220 - h, 4, h, theme.bg2);
        r(g, x + 12, 220 - h + 10, 4, h - 10, theme.bg2);
        r(g, x - 2, 220 - h - 4, 24, 5, theme.bg2);
        x += 40;
      }
      x += Math.floor(rnd() * 24);
    }
    layers.push({ sprite: mid, speed: 0.35, repeat: true, y: 80 });
  }

  // near layer: foreground detail strip
  const near = makeCanvas(640, 120);
  {
    const g = ctxOf(near);
    const rnd = makeRng(seed + 33);
    let x = 0;
    while (x < 640) {
      const w = 18 + Math.floor(rnd() * 30);
      const h = 20 + Math.floor(rnd() * 40);
      r(g, x, 120 - h, w, h, theme.bg1);
      r(g, x + 2, 120 - h + 2, w - 4, 3, theme.bg2);
      if (rnd() < 0.4) r(g, x + w - 6, 120 - h - 6, 3, 8, theme.bg1);
      x += w + 6 + Math.floor(rnd() * 26);
    }
    layers.push({ sprite: near, speed: 0.6, repeat: true, y: 240 });
  }

  return { sky, layers };
}

/* ------------------------------------------------------------------ */
/* pickups & fx                                                        */
/* ------------------------------------------------------------------ */

export function buildCapsule(color: string, letter: string): Sprite[] {
  const frames: Sprite[] = [];
  for (let i = 0; i < 4; i++) {
    const c = makeCanvas(18, 16);
    const g = ctxOf(c);
    const squash = i === 1 || i === 3 ? 1 : 0;
    r(g, 0, 2 + squash, 18, 12 - squash * 2, PAL.steelDark);
    r(g, 1, 3 + squash, 16, 10 - squash * 2, color);
    r(g, 1, 3 + squash, 16, 3, PAL.white);
    r(g, 6, 5 + squash, 6, 6, PAL.black);
    r(g, 7, 6 + squash, 4, 4, PAL.white);
    r(g, 0, 8 + squash, 18, 1, PAL.black);
    // letter dot marker
    r(g, 2, 12, 2, 2, letter === 'S' ? PAL.red : letter === 'H' ? PAL.green : PAL.yellow);
    frames.push(c);
  }
  return frames;
}

export function buildWeaponCrate(color: string): Sprite[] {
  return buildCapsule(color, 'W');
}

export function buildHeart(): Sprite {
  const c = makeCanvas(12, 10);
  const g = ctxOf(c);
  const p = ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'];
  for (let y = 0; y < p.length; y++)
    for (let x = 0; x < p[y].length; x++) if (p[y][x] === '#') r(g, x, y, 1, 1, PAL.red);
  for (let y = 0; y < p.length; y++)
    for (let x = 0; x < p[y].length; x++) if (p[y][x] === '#' && y < 2 && x < 3) r(g, x, y, 1, 1, PAL.white);
  return c;
}

export function buildLogo(): { big: Sprite; small: Sprite } {
  const drawWord = (scale: number): Sprite => {
    const text = 'IRON STORM';
    const w = text.length * 6 * scale;
    const c = makeCanvas(w, 7 * scale + 4);
    const g = ctxOf(c);
    const glyphs: Record<string, string[]> = {
      I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
      R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
      O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
      N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
      ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
      S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
      T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
      M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    };
    let x = 0;
    for (const ch of text) {
      const gl = glyphs[ch] ?? glyphs[' '];
      for (let yy = 0; yy < 7; yy++)
        for (let xx = 0; xx < 5; xx++) {
          if (gl[yy][xx] !== '#') continue;
          const col = yy < 2 ? PAL.yellow : yy < 5 ? PAL.orange : PAL.red;
          r(g, x + xx * scale, 2 + yy * scale, scale, scale, col);
        }
      x += 6 * scale;
    }
    return c;
  };
  return { big: drawWord(4), small: drawWord(2) };
}
