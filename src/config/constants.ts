/**
 * Global tuning constants.
 * Internal render resolution is 640x360 (classic 16:9 low-res pixel buffer).
 * It is integer-scaled to the window (1280x720 = 2x by default).
 */

export const VIEW_W = 640;
export const VIEW_H = 360;

export const TILE = 16;
export const CHUNK_TILES = 16; // chunk width in tiles -> 256px
export const LEVEL_ROWS = 30; // level height in tiles -> 480px
export const GROUND_ROW = 22; // top row of the solid ground band

export const FPS = 60;
export const FIXED_DT = 1 / FPS;
export const MAX_FRAME_TIME = 0.25;

/* ---------------- physics ---------------- */
export const GRAVITY = 1500; // px/s^2
export const MAX_FALL = 460;
export const JUMP_VELOCITY = 390; // initial upward speed (~51px => ~3.2 tiles)
export const JUMP_CUT = 0.42; // velocity multiplier when jump released early
export const COYOTE_TIME = 0.09;
export const JUMP_BUFFER = 0.1;
export const LADDER_SPEED = 78;

export const PLAYER_ACCEL = 900;
export const PLAYER_FRICTION = 1150;
export const PLAYER_AIR_ACCEL = 620;

/* ---------------- combat ---------------- */
export const INVULN_TIME = 1.6; // seconds after respawn
export const HIT_FLASH = 0.12;
/** Non-fatal hit: knockback + hurt pose before control returns. */
export const HURT_TIME = 0.26;
/** How long the "firing" pose is held after a shot (muzzle + recoil pose). */
export const SHOOT_ANIM_TIME = 0.16;
/** Landing recovery (crouch-out of the jump pose). */
export const LAND_TIME = 0.1;
export const DEATH_TIME = 1.1;
export const RESPAWN_DELAY = 0.85;
export const START_LIVES = 3;
export const MAX_LIVES = 9;
export const CONTINUE_LIMIT = 3;

export const SCORE_EXTRA_LIFE = 60000;

/* ---------------- camera ---------------- */
export const CAM_DEADZONE_W = 120;
export const CAM_DEADZONE_H = 70;
export const CAM_LERP = 9;

/* ---------------- palette (shared pixel-art colours) ---------------- */
export const PAL: Record<string, string> = {
  black: '#0b0c14',
  outline: '#08080f',
  white: '#f4f6ff',
  skin: '#e8b088',
  skinDark: '#b8785a',
  red: '#e03c28',
  redDark: '#8f1d14',
  orange: '#ff8c1a',
  yellow: '#ffd44a',
  green: '#3fbf5a',
  greenDark: '#1f6b34',
  blue: '#3f7fe0',
  blueDark: '#22406f',
  cyan: '#4fd6e8',
  purple: '#8a4fd6',
  magenta: '#e0409a',
  grey: '#8a90a3',
  greyDark: '#4a5064',
  steel: '#b6bdcc',
  steelDark: '#6b7385',
  brown: '#8a5a2b',
  brownDark: '#4e3117',
  sand: '#d8b878',
  ice: '#cfe9ff',
};
