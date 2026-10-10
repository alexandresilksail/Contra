/**
 * Player locomotion / animation state machine.
 *
 * Two orthogonal layers, matching the NES original:
 *
 *  1. `MoveState` - mutually exclusive locomotion pose, derived from REAL
 *     physics every fixed step (grounded, vy, ladder, crouch, |vx|, hurt).
 *     Animation is driven by this state, never by a fixed frame loop.
 *
 *  2. firing overlay - `shootT > 0` after each shot. In Contra the commando
 *     keeps his rifle raised while running, jumping and proning, so shooting
 *     COMBINES with locomotion instead of replacing it (AnimTag.SHOOT_RUN ...).
 *
 * `Player.state` (alive/dying/dead/victory) stays the *lifecycle* state and is
 * intentionally separate so scene/respawn/HUD code is unaffected.
 */

/** Locomotion pose. Drives which art set and which frame rate is used. */
export type MoveState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'crouch'
  | 'climb'
  | 'hurt'
  | 'dead'
  | 'victory';

/** Human-readable tag used by tests / the debug overlay. */
export type AnimTag =
  | 'IDLE'
  | 'RUN'
  | 'JUMP'
  | 'FALL'
  | 'CROUCH'
  | 'CLIMB'
  | 'HURT'
  | 'DEAD'
  | 'VICTORY'
  | 'SHOOT_IDLE'
  | 'SHOOT_RUN'
  | 'SHOOT_JUMP'
  | 'SHOOT_FALL'
  | 'SHOOT_CROUCH'
  | 'SHOOT_CLIMB';

/** Playback speed (frames per second) per locomotion state. */
export const ANIM_FPS: Record<MoveState, number> = {
  // standing still: slow 2-frame breathing so the pose is not frozen
  idle: 2,
  // ground run: the sheet cycle is 6 frames; ~12fps reads as a NES run
  run: 12,
  jump: 1,
  fall: 1,
  crouch: 1,
  // ladder: alternate the two climb poses
  climb: 8,
  hurt: 1,
  // tumble for ~0.5s, then the corpse frame for the rest of DEATH_TIME
  dead: 2,
  victory: 4,
};

/** How many frames each state's art set contributes to the cycle. */
export const ANIM_FRAMES: Record<MoveState, number> = {
  idle: 2,
  run: 6,
  jump: 1,
  fall: 1,
  crouch: 1,
  climb: 2,
  hurt: 1,
  dead: 2,
  victory: 1,
};

/**
 * Combine locomotion + firing into the tag that actually gets rendered.
 * Firing never overrides locomotion - it only selects the armed variant.
 */
export function animTag(move: MoveState, shooting: boolean): AnimTag {
  if (!shooting) return move.toUpperCase() as AnimTag;
  switch (move) {
    case 'idle':
      return 'SHOOT_IDLE';
    case 'run':
      return 'SHOOT_RUN';
    case 'jump':
      return 'SHOOT_JUMP';
    case 'fall':
      return 'SHOOT_FALL';
    case 'crouch':
      return 'SHOOT_CROUCH';
    case 'climb':
      return 'SHOOT_CLIMB';
    default:
      // hurt / dead / victory have no armed variant
      return move.toUpperCase() as AnimTag;
  }
}

/**
 * Resolve the locomotion pose from physics. Pure - no side effects, so it can
 * be unit-tested and reused by both update() and the acceptance harness.
 */
export function resolveMoveState(s: {
  dying: boolean;
  dead: boolean;
  victory: boolean;
  hurtT: number;
  onLadder: boolean;
  onGround: boolean;
  crouching: boolean;
  vy: number;
  vx: number;
}): MoveState {
  if (s.dead || s.dying) return 'dead';
  if (s.victory) return 'victory';
  if (s.hurtT > 0) return 'hurt';
  if (s.onLadder) return 'climb';
  if (!s.onGround) return s.vy < 0 ? 'jump' : 'fall';
  if (s.crouching) return 'crouch';
  if (Math.abs(s.vx) > 12) return 'run';
  return 'idle';
}

/**
 * Advance a state's animation clock and clamp the frame into its cycle.
 * `maxFrames` lets the caller clamp to the number of frames the active art
 * set actually has (procedural art has 4 run frames, the sheet has 6).
 */
export function animFrame(state: MoveState, animT: number, maxFrames?: number): number {
  let n = ANIM_FRAMES[state] ?? 1;
  if (maxFrames && maxFrames > 0) n = Math.min(n, maxFrames);
  n = Math.max(1, Math.floor(n));
  return Math.floor(animT * (ANIM_FPS[state] ?? 1)) % n;
}
