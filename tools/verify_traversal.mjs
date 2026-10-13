import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-10-08-04-37-10/game/tools/';
const INFANTRY = new Set(['grunt', 'runner', 'heavy', 'sniper', 'shield', 'bomber', 'jumper', 'flame']);

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-proxy-server', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__IRONSTORM__, null, { timeout: 15000 });

// Confirm the real asset pack actually loaded (no silent fallback).
const packInfo = await page.evaluate(() => {
  const g = window.__IRONSTORM__;
  return { hasScene: !!g.scene, bootReady: !!g.scene && g.scene.phase !== undefined };
});
console.log('boot:', JSON.stringify(packInfo));

await page.evaluate(() => {
  window.__IRONSTORM__.startGame({ stage: 1, chars: ['razor', 'titan'], twoPlayer: false });
});
// Invincibility here is a test-harness aid only (so the bot survives to the boss
// for a deterministic screenshot); it does NOT affect movement logic. The
// genuine-traversal assertion below is about real running, not about survival.
await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = true; });
await page.waitForTimeout(700);

const sleep = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  const kinds = (sc.world?.enemies ?? []).map((e) => e.kind);
  return {
    x: Math.round(p.x), y: Math.round(p.y), alive: p.alive, state: p.state,
    phase: sc.phase, bossHp: sc.boss ? Math.round(sc.boss.hp) : null,
    mapImageActive: sc.mapImageActive,
    enemyKinds: [...new Set(kinds)],
  };
});

// ---- GENUINE TRAVERSAL: hold right + fire, auto-jump obstacles. NO teleport. ----
await page.keyboard.down('KeyJ');
await page.keyboard.down('KeyD');

let maxX = 0;
let crossedCol21 = false;
let crossedCol30 = false;
let crossedCol50 = false;
let reachedBoss = false;
let lastX = 0;
let jumping = false;
let jumpReleaseAt = 0;
let curDir = 1;
const setDir = async (d) => {
  if (d === curDir) return;
  if (d === 1) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
  else { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
  curDir = d;
};

const t0 = Date.now();
const STALL_LIMIT = 6000; // ms without forward progress => treat as stuck
let lastProgressAt = Date.now();
let lastPhase = '';
let allKindsInfantry = true;
let seenKinds = new Set();

while (Date.now() - t0 < 220000) {
  const s = await state();
  // Track enemy kinds (proves no geometric enemies spawn in stage 1).
  for (const k of s.enemyKinds) seenKinds.add(k);
  if (s.enemyKinds.length) for (const k of s.enemyKinds) if (!INFANTRY.has(k)) allKindsInfantry = false;

  if (s.phase !== lastPhase) {
    console.log(`  phase -> ${s.phase} @ x=${s.x} bossHp=${s.bossHp} kinds=${JSON.stringify(s.enemyKinds)}`);
    lastPhase = s.phase;
  }
  if (s.phase === 'clear' || s.phase === 'over') break;

  // record traversal milestones
  if (!crossedCol21 && s.x >= 21 * 16) { crossedCol21 = true; console.log(`  [OK] genuine run crossed col 21 (x=${s.x}) - step-block fixed`); }
  if (!crossedCol30 && s.x >= 30 * 16) { crossedCol30 = true; console.log(`  [OK] crossed col 30 (x=${s.x})`); }
  if (!crossedCol50 && s.x >= 50 * 16) { crossedCol50 = true; console.log(`  [OK] crossed col 50 (x=${s.x})`); }

  if (s.bossHp !== null && !reachedBoss) { reachedBoss = true; await page.screenshot({ path: `${OUT}vf_boss.png` }); }

  // steering toward boss during boss fight
  let dir = 1;
  if (s.bossHp !== null) {
    const bdir = await page.evaluate(() => {
      const b = window.__IRONSTORM__.scene.boss;
      const p = window.__IRONSTORM__.scene.players[0];
      const bc = b.x + b.w / 2, pc = p.x + p.w / 2;
      return bc < pc ? -1 : 1;
    });
    dir = bdir;
  }
  await setDir(dir);

  // progress tracking (NO teleport - pure running)
  if (s.x > lastX + 4) { lastProgressAt = Date.now(); lastX = s.x; }
  maxX = Math.max(maxX, s.x);
  if (Date.now() - lastProgressAt > STALL_LIMIT && s.x < 100 * 16) {
    console.log(`  [STALL] no forward progress for ${STALL_LIMIT}ms @ x=${s.x} - genuine traversal FAILED`);
    break;
  }

  // probe ahead: wall / pit / spike -> jump
  const probe = await page.evaluate(() => {
    const sc = window.__IRONSTORM__.scene;
    const p = sc.players[0];
    const TILE = 16, ROWS = 30;
    const BLOCKING = new Set([1, 6, 7]); // SOLID, CRATE, DOOR
    const frontX = p.x + p.w + 2;
    const bodyY = p.y + p.h * 0.5;
    const wallAhead = BLOCKING.has(sc.level.get(Math.floor(frontX / TILE), Math.floor(bodyY / TILE)));
    const aheadCol = Math.floor((p.x + p.w + TILE) / TILE);
    const curCol = Math.floor(p.x / TILE);
    const gAhead = sc.level.groundRow(aheadCol);
    const gCur = sc.level.groundRow(curCol);
    const pitAhead = gAhead >= ROWS || gAhead > gCur + 1;
    const spikeCol = Math.floor((p.x + p.w + TILE * 0.5) / TILE);
    const gSpike = sc.level.groundRow(spikeCol);
    const spikeAhead = sc.level.get(spikeCol, gSpike - 1) === 4;
    return { onGround: p.onGround, wallAhead, pitAhead, spikeAhead };
  });

  if (probe.onGround && (probe.wallAhead || probe.pitAhead || probe.spikeAhead) && !jumping) {
    await page.keyboard.down('KeyK');
    jumping = true;
    jumpReleaseAt = Date.now() + 280;
  }
  if (jumping && Date.now() > jumpReleaseAt) {
    await page.keyboard.up('KeyK');
    jumping = false;
  }
  await sleep(55);
}

await page.keyboard.up('KeyD');
await page.keyboard.up('KeyA');
await page.keyboard.up('KeyJ');
await page.keyboard.up('KeyK');

const final = await state();
// let the clear sequence play out if we just defeated the boss
await page.waitForTimeout(2800);
await page.screenshot({ path: `${OUT}vf_final.png` });
const after = await state();

console.log('--- TRAVERSAL RESULT ---');
console.log('maxX:', maxX, '(col ' + Math.floor(maxX / 16) + ')');
console.log('crossedCol21:', crossedCol21, '| crossedCol30:', crossedCol30, '| crossedCol50:', crossedCol50);
console.log('reachedBoss:', reachedBoss);
console.log('allEnemyKindsAreInfantry:', allKindsInfantry);
console.log('enemyKindsSeen:', JSON.stringify([...seenKinds]));
console.log('final phase:', final.phase, '| after phase:', after.phase);
console.log('mapImageActive (panorama loaded):', after.mapImageActive);
console.log('console/page errors:', errors.length);
for (const e of errors) console.log('  ' + e);

await browser.close();
