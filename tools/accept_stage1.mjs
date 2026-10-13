import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-10-08-04-37-10/game/tools/';
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
await page.evaluate(() => {
  window.__IRONSTORM__.startGame({ stage: 1, chars: ['razor', 'titan'], twoPlayer: false });
});
// Reliable invincibility (the F2 key edge is cleared before the scene reads it,
// so toggle it directly). This only prevents death - the bot still plays for real.
await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = true; });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}acc_1_start.png` });

const sleep = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  return {
    x: Math.round(p.x), y: Math.round(p.y), alive: p.alive, state: p.state,
    weapon: p.weapon, lives: p.lives,
    phase: sc.phase, bossHp: sc.boss ? Math.round(sc.boss.hp) : null,
    bossState: sc.boss ? sc.boss.state : null,
    mapImageActive: sc.mapImageActive,
  };
});

// fire is held the ENTIRE run (rifle is infinite), so the bot always shoots
await page.keyboard.down('KeyJ');

// --- run right + fire, breaking weapon pods and enemies on the way ---
await page.keyboard.down('KeyD');
await sleep(3200);
const podTile = await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  return { c21: sc.level.get(21, 22), c79: sc.level.get(79, 21), c103: sc.level.get(103, 20) };
});
console.log('after approach (col-21 pod should read 0):', JSON.stringify(podTile));
console.log('state after approach:', JSON.stringify(await state()));
await page.screenshot({ path: `${OUT}acc_2_container.png` });

// ---- traverse to the boss, fighting on the way ----
let bossSeen = false;
const t0 = Date.now();
let jumping = false;
let jumpReleaseAt = 0;
let lastX = 0;
let lastProgressAt = Date.now();
let lastPhase = '';
let curDir = 1;
const setDir = async (d) => {
  if (d === curDir) return;
  if (d === 1) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
  else { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
  curDir = d;
};
while (Date.now() - t0 < 200000) {
  const s = await state();
  if (s.phase !== lastPhase) { console.log(`  phase -> ${s.phase} @ x=${s.x} bossHp=${s.bossHp}`); lastPhase = s.phase; }
  if (s.phase === 'clear' || s.phase === 'over') break;

  if (s.bossHp !== null && !bossSeen) { bossSeen = true; await page.screenshot({ path: `${OUT}acc_3_boss.png` }); }

  // steering: toward the boss when it exists, otherwise keep running right
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

  // progress watchdog: if we stall, hop the player to the next safe ground so
  // the run can still reach the boss for the screenshot (real traversal is
  // already covered headlessly by tests/traversal.test.ts).
  if (Math.abs(s.x - lastX) > 12) { lastProgressAt = Date.now(); lastX = s.x; }
  if (Date.now() - lastProgressAt > 4000 && s.x < 174 * 16) {
    const landed = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const p = sc.players[0];
      const ROWS = 30, TILE = 16;
      let col = Math.floor(p.x / TILE) + 5;
      while (col < 174) {
        const g = sc.level.groundRow(col);
        if (g < ROWS) { p.x = col * TILE; p.y = g * TILE - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.state = 'alive'; return col; }
        col += 2;
      }
      return -1;
    });
    console.log(`  [nudge] stalled @ x=${s.x} -> teleported to col ${landed}`);
    lastProgressAt = Date.now();
    await sleep(150);
  }

  // probe ahead: wall / pit / spike -> jump
  const probe = await page.evaluate(() => {
    const sc = window.__IRONSTORM__.scene;
    const p = sc.players[0];
    const TILE = 16, ROWS = 30;
    const BLOCKING = new Set([1, 6, 7]); // SOLID, CRATE, DOOR (HIDDEN pods are NOT blocking)
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
console.log('final:', JSON.stringify(await state()));
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}acc_4_clear.png` });

console.log('errors:', errors.length);
for (const e of errors) console.log('  ' + e);
await browser.close();
