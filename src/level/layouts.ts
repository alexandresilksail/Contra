/**
 * Stage 1 level layout — "FORTRESS GATE" (the only stage in the project).
 *
 * The collision data is EXTRACTED from the uploaded map image
 * (public/sprites/stage1bg.png) by tools/stage1_extract.py. The image IS the
 * complete level layout and is drawn 1:1, world-locked, by the renderer, so
 * this module is the independent interactive authority on the same 16px grid
 * (see src/level/stage1ImageData.ts).
 *
 * Structure read out of the art (216 columns):
 *   0-1      water at the level lip (lethal on contact in stage 1)
 *   2-47     jungle cliff corridor (spawn; flat and clear so the gun fires)
 *   48-55    RIVER 1 - destructible metal bridge deck (T.BRIDGE) over lethal
 *            WATER: explosions blow one plank at a time, falling in drowns
 *   56-65    jungle island between the two bridges
 *   66-73    RIVER 2 - second destructible bridge deck
 *   74-143   rising jungle ground with weapon-container panels in the rock
 *   100      BOSS GATE (DOOR); the single-screen arena is [100,140], BEFORE
 *            the ravine. That 40-col patch is levelled to row 21 (the art
 *            there is rising/jagged ground; a boss fight needs one flat,
 *            pit-free strip) - the only deliberate deviation from the image.
 *   144-169  ravine - bottomless chasms (kept lethal; never crossed - the boss
 *            is fought first and the level clears)
 *   170-208  jungle ground (natural, row 23)
 *   209-215  fortress wall (natural scenery past the boss gate)
 */
import type { StageDef } from './stages';
import { stage1ImageMap } from './stage1ImageData';

export function stage1Map(def: StageDef): Uint8Array {
  return stage1ImageMap(def.tiles, def.bossStart);
}
