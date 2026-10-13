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
await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = false; });
await page.waitForTimeout(600);

// 1) stand the player on bridge 1 (deck at col 50, row 22) and shoot the deck
//    with an explosive round -> the plank blows open
await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  p.place(50 * 16, 22 * 16 - p.h);
  p.invuln = 0;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}bf_1_bridge_intact.png` });
const before = await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  return { deck: sc.level.get(50, 22), river: sc.level.get(50, 23), deadlyWater: sc.level.deadlyWater };
});
console.log('before blast:', JSON.stringify(before));

// detonate on the deck (as an explosive round would)
const after = await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  sc.world.explode(50 * 16 + 8, 22 * 16, 34, 10);
  return { deck: sc.level.get(50, 22), left: sc.level.get(49, 22), right: sc.level.get(51, 22), river: sc.level.get(50, 23) };
});
console.log('after blast :', JSON.stringify(after));
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}bf_2_hole_in_deck.png` });

// 2) walk the player into the hole -> falls into the river -> drowns
const drown = await page.evaluate(async () => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  p.place(50 * 16, 22 * 16 - p.h);
  p.invuln = 0;
  const frames = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  for (let i = 0; i < 90; i++) {
    await frames();
    if (p.state !== 'alive') break;
  }
  return { state: p.state, deathCause: p.deathCause, y: Math.round(p.y), lives: p.lives };
});
console.log('walk into the hole:', JSON.stringify(drown));
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}bf_3_drowned.png` });

// 3) an enemy killed by an explosion ON the bridge falls through the deck
const fall = await page.evaluate(async () => {
  const sc = window.__IRONSTORM__.scene;
  const e = sc.spawnEnemy('grunt', 52 * 16, 22 * 16 - 22);
  if (!e) return { spawned: false };
  e.spawnGrace = 0;
  // lethal explosion right on the enemy (also blows that plank - the demo)
  sc.world.explode(e.x + e.w / 2, e.y + e.h / 2, 40, 999);
  const frames = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  for (let i = 0; i < 40; i++) {
    await frames();
    if (e.dead) break;
  }
  return {
    spawned: true,
    state: e.state,
    y: Math.round(e.y),
    deckY: 22 * 16,
    dead: e.dead,
    plankGone: sc.level.get(52, 22),
  };
});
console.log('enemy death on bridge:', JSON.stringify(fall));
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}bf_4_enemy_fell.png` });

console.log('errors:', errors.length);
for (const e of errors) console.log('  ' + e);
await browser.close();
