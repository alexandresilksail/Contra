// Bridge fidelity probe (round 3, GENUINE PLAY ONLY).
// No teleport, no place(), no internal spawn/damage calls: the player is
// driven from the normal game entry with real key events only.
//
// Flow verified:
//  1. genuine run from spawn onto bridge 1 (cols 48-55, deck row 22)
//  2. bridge state: plank over river, deadly water, NO solid rock residue
//  3. plain rifle fire (jump + down-aim + fire) punches ONE plank
//  4. the hole is VISIBLE over the uploaded map image (river shows through)
//  5. falling through the hole -> drown: deathCause / animation / lives / respawn
//  6. neighbouring planks, land ground and walls stay intact
//  7. no score from destruction, no phantom collision after respawn
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-10-08-04-37-10/game/tools/';
const TILE = 16;
const BRIDGE = 9, WATER = 5, SOLID = 1, EMPTY = 0;
const TARGET_COL = 51; // middle of bridge 1 (48-55)

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-proxy-server', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__IRONSTORM__, null, { timeout: 15000 });

// ---- normal game entry -----------------------------------------------------
await page.evaluate(() => {
  window.__IRONSTORM__.startGame({ stage: 1, chars: ['razor', 'titan'], twoPlayer: false });
});
// Harness aid, disclosed: invincibility during the RUN only, so the probe
// reaches the bridge deterministically. It is switched OFF before the bridge
// shoot/drown sequence, which must be a genuine lethal interaction.
await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = true; });
await sleep(700);

const snap = () => page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  return {
    x: Math.round(p.x), y: Math.round(p.y), col: Math.floor(p.x / 16),
    alive: p.alive, state: p.state, onGround: p.onGround,
    lives: p.lives, score: p.score, deathCause: p.deathCause ?? null,
    phase: sc.phase,
  };
});

// ---- 1) GENUINE RUN to bridge 1 (hold right, auto-jump, no firing) ---------
await page.keyboard.down('KeyD');
let jumping = false, jumpReleaseAt = 0, maxX = 0, onBridge = false;
const t0 = Date.now(), lastProgress = { x: 0, at: Date.now() };
while (Date.now() - t0 < 60000) {
  const s = await snap();
  maxX = Math.max(maxX, s.x);
  if (s.x > lastProgress.x + 4) { lastProgress.x = s.x; lastProgress.at = Date.now(); }
  if (s.col >= TARGET_COL && s.onGround) { onBridge = true; break; }
  if (Date.now() - lastProgress.at > 6000) { log('  [STALL] genuine run stalled @ x=' + s.x); break; }

  const probe = await page.evaluate(() => {
    const sc = window.__IRONSTORM__.scene;
    const p = sc.players[0];
    const T = 16;
    const BLOCKING = new Set([1, 6, 7]); // SOLID, CRATE, DOOR (BRIDGE is walkable deck)
    const frontX = p.x + p.w + 2;
    const bodyY = p.y + p.h * 0.5;
    const wallAhead = BLOCKING.has(sc.level.get(Math.floor(frontX / T), Math.floor(bodyY / T)));
    const aheadCol = Math.floor((p.x + p.w + T) / T);
    const curCol = Math.floor(p.x / T);
    const gAhead = sc.level.groundRow(aheadCol);
    const gCur = sc.level.groundRow(curCol);
    const pitAhead = gAhead >= 30 || gAhead > gCur + 1;
    return { onGround: p.onGround, wallAhead, pitAhead };
  });
  if (probe.onGround && (probe.wallAhead || probe.pitAhead) && !jumping) {
    await page.keyboard.down('KeyK');
    jumping = true; jumpReleaseAt = Date.now() + 280;
  }
  if (jumping && Date.now() > jumpReleaseAt) { await page.keyboard.up('KeyK'); jumping = false; }
  await sleep(55);
}
await page.keyboard.up('KeyD');
await page.keyboard.up('KeyK');
log(`run: onBridge=${onBridge} maxX=${maxX} (col ${Math.floor(maxX / TILE)})`);

// ---- 2) bridge state BEFORE any shot ---------------------------------------
const pre = await page.evaluate((tc) => {
  const sc = window.__IRONSTORM__.scene;
  const L = sc.level;
  const under = [];
  for (let r = 23; r < 30; r++) under.push(L.get(tc, r));
  const planks = [];
  for (let c = 48; c <= 55; c++) planks.push(L.get(c, 22));
  return {
    deck: L.get(tc, 22), underBridge: under, planks,
    deadlyWater: L.deadlyWater, mapImageActive: sc.mapImageActive,
    river: L.get(tc, 23), groundRow: L.groundRow(tc),
  };
}, TARGET_COL);
log('bridge before:', JSON.stringify(pre));
const s0 = await snap();
log('player before :', JSON.stringify(s0));
await page.screenshot({ path: `${OUT}bf_1_bridge_intact.png` });

// genuine lethality from here on
await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = false; });

// enemy proximity is LOGGED only - no clearing fire, no movement: the punch
// must happen where the player stands, and any interference is reported as-is.
const near0 = await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  const es = (sc.world?.enemies ?? []).filter((e) => !e.dead && e.state !== 'death');
  let best = null;
  for (const e of es) {
    const d = Math.abs(e.x + e.w / 2 - (p.x + p.w / 2));
    if (!best || d < best.d) best = { d: Math.round(d) };
  }
  return best ? best.d : 999;
});
log('nearest enemy at punch time: ' + near0 + 'px');

// ---- 3) PUNCH THE PLANK: jump + down-aim + plain rifle fire -----------------
// Precondition: standing on the bridge deck (cols 48-55).
if (s0.col < 48 || s0.col > 55 || !s0.onGround) {
  log('  [ABORT] not standing on the bridge deck at punch time');
}
await page.keyboard.down('KeyK');           // jump
await sleep(60);
await page.keyboard.down('KeyS');           // aim straight down (airborne)
await page.keyboard.down('KeyJ');           // plain rifle fire
let punched = false, punchCol = -1, abort = '';
const pt0 = Date.now();
while (Date.now() - pt0 < 1500) {
  const r = await page.evaluate(() => {
    const sc = window.__IRONSTORM__.scene;
    const p = sc.players[0];
    const col = Math.floor((p.x + p.w / 2) / 16);
    return { col, deck: sc.level.get(col, 22), alive: p.alive, state: p.state };
  });
  if (r.deck === EMPTY && r.col >= 48 && r.col <= 55) { punched = true; punchCol = r.col; break; }
  if (!r.alive) { abort = 'player died during punch'; break; }
  if (r.col < 48 || r.col > 55) { abort = 'player left the bridge during punch @ col ' + r.col; break; }
  await sleep(40);
}
await page.keyboard.up('KeyJ');
await page.keyboard.up('KeyS');
await sleep(250);
await page.keyboard.up('KeyK');
log(`punch: destroyed=${punched} col=${punchCol}${abort ? ' ABORT=' + abort : ''}`);
await sleep(150);
await page.screenshot({ path: `${OUT}bf_2_hole_in_deck.png` });

// ---- 4) fall through the hole -> drown --------------------------------------
const trans = [];
let drowned = null;
const dt0 = Date.now();
let lastState = '';
while (Date.now() - dt0 < 8000) {
  const s = await snap();
  if (s.state !== lastState) { trans.push(`${s.state}${s.deathCause ? '(' + s.deathCause + ')' : ''}`); lastState = s.state; }
  if (s.state === 'dying' || s.state === 'dead') { drowned = s; if (s.state === 'dead') break; }
  if (s.alive && trans.length > 0 && drowned) break; // respawned
  await sleep(80);
}
log('death transitions:', trans.join(' -> '));
log('at death         :', JSON.stringify(drowned));
await page.screenshot({ path: `${OUT}bf_3_drowned.png` });

// ---- 5) respawn flow ---------------------------------------------------------
let respawned = null;
const rt0 = Date.now();
while (Date.now() - rt0 < 10000) {
  const s = await snap();
  if (s.alive && s.state === 'alive') { respawned = s; break; }
  await sleep(150);
}
log('respawned        :', JSON.stringify(respawned));
await sleep(300);
await page.screenshot({ path: `${OUT}bf_4_respawned.png` });

// ---- 6) collateral + residue checks ------------------------------------------
const post = await page.evaluate((tc) => {
  const sc = window.__IRONSTORM__.scene;
  const L = sc.level;
  const planks = [];
  for (let c = 48; c <= 55; c++) planks.push(L.get(c, 22));
  const under = [];
  for (let r = 23; r < 30; r++) under.push(L.get(tc, r));
  const landGround = [];
  for (const c of [30, 40, 60, 80]) landGround.push(L.groundRow(c));
  const wall = [];
  for (let r = 20; r < 30; r++) wall.push(L.get(210, r));
  return {
    planks, underBridge: under, landGround, wallCol210: wall,
    destroyedKeys: L.destroyed.size, destroyedAs: [...L.destroyedAs.entries()].length,
  };
}, TARGET_COL);
log('bridge after     :', JSON.stringify(post));
log('score: before=' + s0.score + ' after=' + (respawned ? respawned.score : '?'));

// ---- 7) no phantom collision: GENUINE second run across the deck ------------
// After respawn the player is back at the level start; run right again with
// real keys only. Expectation: solid footing across the surviving planks, then
// the persistent hole at the punched column (fall + drown again is CORRECT).
if (respawned && punched) {
  await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = true; });
  await page.keyboard.down('KeyD');
  let j2 = false, jr2 = 0, reached = null;
  const t2 = Date.now(), lp2 = { x: 0, at: Date.now() };
  while (Date.now() - t2 < 40000) {
    const s = await snap();
    if (s.x > lp2.x + 4) { lp2.x = s.x; lp2.at = Date.now(); }
    if (s.col >= 48 && s.onGround) { reached = s; break; }
    if (Date.now() - lp2.at > 6000) { log('  [STALL] second run stalled @ x=' + s.x); break; }
    const probe = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const p = sc.players[0];
      const T = 16;
      const BLOCKING = new Set([1, 6, 7]);
      const frontX = p.x + p.w + 2;
      const bodyY = p.y + p.h * 0.5;
      const wallAhead = BLOCKING.has(sc.level.get(Math.floor(frontX / T), Math.floor(bodyY / T)));
      const aheadCol = Math.floor((p.x + p.w + T) / T);
      const curCol = Math.floor(p.x / T);
      const gAhead = sc.level.groundRow(aheadCol);
      const gCur = sc.level.groundRow(curCol);
      const pitAhead = gAhead >= 30 || gAhead > gCur + 1;
      return { onGround: p.onGround, wallAhead, pitAhead };
    });
    if (probe.onGround && (probe.wallAhead || probe.pitAhead) && !j2) {
      await page.keyboard.down('KeyK'); j2 = true; jr2 = Date.now() + 280;
    }
    if (j2 && Date.now() > jr2) { await page.keyboard.up('KeyK'); j2 = false; }
    await sleep(55);
  }
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyK');
  await sleep(200);
  await page.screenshot({ path: `${OUT}bf_5_hole_visible.png` });
  log('second run reached col 48 on deck:', JSON.stringify(reached));
  // wait (genuinely, no teleport) until no enemy is close, so the walk into
  // the hole is not masked by enemy interference
  const wt0 = Date.now();
  while (Date.now() - wt0 < 12000) {
    const d = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const p = sc.players[0];
      const es = (sc.world?.enemies ?? []).filter((e) => !e.dead && e.state !== 'death');
      let best = 999;
      for (const e of es) best = Math.min(best, Math.abs(e.x + e.w / 2 - (p.x + p.w / 2)));
      return Math.round(best);
    });
    if (d > 160) break;
    await sleep(300);
  }
  // walk east into the persistent hole (invincible OFF: must be lethal)
  await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = false; });
  await page.keyboard.down('KeyD');
  let fell = null, fallCol = -1, fallY = -1, wasGround = true;
  const ft0 = Date.now();
  while (Date.now() - ft0 < 6000) {
    const s = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const p = sc.players[0];
      return { col: Math.floor((p.x + p.w / 2) / 16), y: Math.round(p.y), onGround: p.onGround, alive: p.alive, state: p.state, deathCause: p.deathCause ?? null };
    });
    if (wasGround && !s.onGround && s.alive) { fallCol = s.col; fallY = s.y; wasGround = false; }
    if (!s.alive || s.state === 'dying' || s.state === 'dead') { fell = s; break; }
    await sleep(50);
  }
  await page.keyboard.up('KeyD');
  log('left the deck at col ' + fallCol + ' (y=' + fallY + ')');
  log('walking into the hole again  :', JSON.stringify(fell));
  await page.screenshot({ path: `${OUT}bf_6_hole_again.png` });
}

log('console/page errors:', errors.length);
for (const e of errors) log('  ' + e);
await browser.close();
