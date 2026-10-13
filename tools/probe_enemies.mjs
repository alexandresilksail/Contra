import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5173/';
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
await page.evaluate(() => { window.__IRONSTORM__.scene.debug.invincible = true; });
await page.waitForTimeout(600);

const enemyInfo = () => page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const kinds = {};
  for (const e of sc.enemyPool.active) {
    if (e.dead) continue;
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  }
  return { count: sc.enemyPool.active.length, kinds, x: Math.round(sc.players[0].x) };
});

await page.keyboard.down('KeyJ');
await page.keyboard.down('KeyD');

const sleep = (ms) => page.waitForTimeout(ms);
for (const t of [2800, 5200, 7200]) {
  await sleep(t === 2800 ? 2800 : 2400);
  const info = await enemyInfo();
  console.log(`t≈${t}ms enemies:`, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}probe_enemy_${t}.png` });
}

const finalState = await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const SOLDIER = new Set(['grunt','runner','heavy','sniper','shield','bomber','jumper','flame']);
  const geo = {};
  for (const e of sc.enemyPool.active) {
    if (e.dead) continue;
    const cat = SOLDIER.has(e.kind) ? 'SOLDIER(real-sprite)' : 'GEOMETRIC(procedural)';
    geo[cat] = (geo[cat]||0)+1;
  }
  return { geo, mapImageActive: sc.mapImageActive, phase: sc.phase };
});
console.log('SUMMARY:', JSON.stringify(finalState));
console.log('errors:', errors.length);
for (const e of errors) console.log('  ' + e);
await browser.close();
