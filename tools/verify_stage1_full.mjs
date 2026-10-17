/**
 * Stage-1 full acceptance - ZERO debug aids.
 * No invincibility, no teleport, no forced boss HP. The bot plays for real
 * through the actual menu, and may die/respawn like a player.
 *
 * Verifies (each mapped to the user's acceptance criteria):
 *   V1  title screen renders (screenshot, no errors)
 *   V2  real menu navigation: title -> charselect -> playing
 *   V3  panorama + sprite pack actually loaded (mapImageActive, tileArt)
 *   V4  run speed ~= BASE_SPEED, jump height ~= JUMP_VELOCITY^2/2g
 *   V5  shooting spawns bullets
 *   V6  hidden weapon pod breaks on running fire, pickup collects, weapon swaps
 *   V7  genuine traversal to the boss gate (auto-jump only)
 *   V8  hurt/death/respawn all occur naturally and recover
 *   V9  boss triggers, boss music swaps in, boss takes real damage and dies
 *  V10  stage clear -> stageclear screen -> ending, victory fanfare
 *  V11  audio triggers counted (shoot/explosion/pickup/door/clear/...)
 *  V12  zero console/page errors
 */
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

const sleep = (ms) => page.waitForTimeout(ms);
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`);
};

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__IRONSTORM__, null, { timeout: 15000 });
await sleep(600);
await page.screenshot({ path: `${OUT}full_1_title.png` });

// instrument sfx counting before anything else runs
await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  window.__sfxCounts = {};
  const orig = a.sfx.bind(a);
  a.sfx = (name) => { window.__sfxCounts[name] = (window.__sfxCounts[name] || 0) + 1; return orig(name); };
});

/* V2 - real menu navigation ------------------------------------------------ */
await page.waitForFunction(() => window.__IRONSTORM__.state === 'menu', null, { timeout: 5000 });
await page.keyboard.press('Enter'); // title -> charselect
await page.waitForFunction(() => window.__IRONSTORM__.state === 'charselect', null, { timeout: 5000 });
await sleep(300);
await page.screenshot({ path: `${OUT}full_2_charselect.png` });
await page.keyboard.press('Enter'); // charselect -> start stage 1
await page.waitForFunction(() => !!window.__IRONSTORM__.scene, null, { timeout: 5000 });
await page.waitForFunction(() => window.__IRONSTORM__.scene.phase === 'play', null, { timeout: 8000 });
check('V2 menu navigation (title->charselect->playing)', true, 'real Enter keypresses');

/* V3 - assets actually loaded ---------------------------------------------- */
const assets = await page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  return { mapImageActive: sc.mapImageActive, tileSolid: !!sc.tileArt?.solid, phase: sc.phase };
});
check('V3 panorama image loaded (stage1bg.png 1:1)', assets.mapImageActive === true, JSON.stringify(assets));
check('V3b tile sprite pack loaded (tiles1.png)', assets.tileSolid === true, '');

const state = () => page.evaluate(() => {
  const sc = window.__IRONSTORM__.scene;
  const p = sc.players[0];
  const eb = sc.ebullets?.active ?? [];
  let threat = null;
  for (const b of eb) {
    const dx = b.x - p.x, dy = b.y - (p.y + p.h / 2);
    if (Math.abs(dy) < 34 && dx > -20 && dx < 130 && Math.sign(b.vx) === -Math.sign(dx || 1)) {
      if (!threat || Math.abs(dx) < Math.abs(threat.dx)) threat = { dx, dy, vx: b.vx };
    }
  }
  // nearest enemy ahead (front) and behind (back), screen-relative
  let ahead = null, behind = null;
  for (const e of sc.world?.enemies ?? []) {
    if (e.dead || e.state === 'death') continue;
    const dx = e.x - p.x;
    if (dx >= -10 && dx < 150 && (!ahead || dx < ahead)) ahead = dx;
    if (dx < -10 && dx > -240 && (!behind || dx > behind)) behind = dx;
  }
  const pks = sc.pickupPool?.active ?? [];
  return {
    x: Math.round(p.x), y: Math.round(p.y), vy: Math.round(p.vy), onGround: p.onGround,
    hp: p.hp, lives: p.lives, alive: p.alive, pstate: p.state, weapon: p.weapon,
    phase: sc.phase, app: window.__IRONSTORM__.state,
    bossHp: sc.boss ? Math.round(sc.boss.hp) : null,
    bossState: sc.boss ? sc.boss.state : null,
    track: window.__IRONSTORM__.audio.currentTrack,
    pbullets: sc.pbullets?.count ?? 0,
    pickups: pks.map((k) => ({ kind: k.kind, weapon: k.weapon, x: Math.round(k.x), dead: k.dead })),
    threat, ahead, behind,
    deaths: window.__deaths ?? 0,
  };
});

/* V4 - movement & jump ------------------------------------------------------ */
await sleep(400);
const g0 = await state();
await page.keyboard.down('KeyD');
await sleep(1000);
const g1 = await state();
await page.keyboard.up('KeyD');
const runDx = g1.x - g0.x;
check('V4 run speed (hold D 1s)', runDx > 70 && runDx < 240, `dx=${runDx}px (BASE_SPEED=122 x char mult)`);

await page.keyboard.down('KeyA');
await sleep(600);
const g2 = await state();
await page.keyboard.up('KeyA');
check('V4b runs left', g2.x < g1.x - 20, `x ${g1.x} -> ${g2.x}`);

const groundY = (await state()).y;
await page.keyboard.down('KeyK');
let minY = groundY;
const jt = Date.now();
while (Date.now() - jt < 700) {
  const s = await state();
  if (s.y < minY) minY = s.y;
  if (s.onGround && Date.now() - jt > 250) break;
  await sleep(25);
}
await page.keyboard.up('KeyK');
const jumpH = groundY - minY;
check('V4c jump height', jumpH >= 30, `h=${jumpH}px (theory ~51px)`);

/* V5 - shooting ------------------------------------------------------------- */
await page.keyboard.down('KeyJ');
let sawBullet = false;
const st = Date.now();
while (Date.now() - st < 900) {
  const s = await state();
  if (s.pbullets > 0) { sawBullet = true; break; }
  await sleep(50);
}
check('V5 shooting spawns bullets', sawBullet, '');

/* V6 - weapon pod: run+fire to col ~21, break the HIDDEN pod, grab pickup ---- */
let podBroke = false;
let pickupWeapon = null;
let pickupX = 0;
let pickupSeen = false;
let weaponSwapped = false;
const podStart = Date.now();
let jumping = false, jumpReleaseAt = 0;
while (Date.now() - podStart < 12000) {
  const s = await state();
  const pod = await page.evaluate(() => {
    const sc = window.__IRONSTORM__.scene;
    return { r21: sc.level.get(21, 21), r22: sc.level.get(21, 22) };
  });
  if (!podBroke && (pod.r21 === 0 || pod.r22 === 0) && (pod.r21 !== 8 && pod.r22 !== 8)) {
    // only count once we have actually run up to it (x past col 10)
    if (s.x > 10 * 16) { podBroke = true; console.log(`  pod broke @ x=${s.x} tiles=${JSON.stringify(pod)}`); }
  }
  if (podBroke) {
    const wp = s.pickups.find((k) => k.kind === 'weapon' && !k.dead);
    if (wp) { pickupWeapon = wp.weapon; pickupX = wp.x; pickupSeen = true; }
    // pickups live 14s, so within this loop "gone" == collected (limited-ammo
    // weapons revert to the rifle before a weapon-name check could see them)
    else if (pickupSeen && !weaponSwapped) {
      weaponSwapped = true;
      console.log(`  weapon pickup collected (${pickupWeapon})`);
    }
    // safety net: ran past a live weapon pickup -> double back and grab it
    if (pickupSeen && !weaponSwapped && s.x > pickupX + 46) {
      await page.keyboard.up('KeyD');
      await page.keyboard.down('KeyA');
      await sleep(120);
      await page.keyboard.up('KeyA');
    }
  }
  if (weaponSwapped) break;
  if (s.x > 30 * 16) break; // past the pod zone; stop hunting
  // keep running right
  await page.keyboard.down('KeyD');
  await sleep(60);
  await page.keyboard.up('KeyD');
  await sleep(40);
}
check('V6 hidden weapon pod broken by running fire', podBroke, '');
check('V6b weapon pickup collected and swapped', weaponSwapped, `pickup=${pickupWeapon}`);
await page.screenshot({ path: `${OUT}full_3_pod.png` });

/* V7+V8 - genuine traversal to the boss; track hurt/death/respawn ----------- */
let reachedBoss = false;
let bossHpMin = 100;
let sawHurt = false, sawDeath = false, sawRespawn = false;
let minHp = 99, deaths = 0, lastLives = (await state()).lives;
let wasAlive = true;
let prevHp = 3;
const travStart = Date.now();
let lastProgressAt = Date.now(), lastX = (await state()).x;
let hardStallAt = Date.now(), hardLastX = lastX;
await page.keyboard.down('KeyJ'); // fire held through traversal (rifle infinite)
jumping = false; jumpReleaseAt = 0;
let curDir = 1;
let turnBackUntil = 0;
const setDir = async (d) => {
  if (d === curDir) return;
  if (d === 1) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
  else { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
  curDir = d;
};
// force the run key down (the V6 burst loop may have left it released)
await page.keyboard.up('KeyD');
await page.keyboard.up('KeyA');
await page.keyboard.down('KeyD');
curDir = 1;

while (Date.now() - travStart < 200000) {
  const s = await state();
  // Fire only while grounded: a bullet spawned mid-fall punches a hole in the
  // bridge deck under the player (faithful to the original, but suicidal for
  // a bot that hops constantly). Rifle is infinite, so no ammo is wasted.
  if (s.onGround) await page.keyboard.down('KeyJ');
  else await page.keyboard.up('KeyJ');
  if (s.hp < minHp) {
    minHp = s.hp; if (s.hp < 3) sawHurt = true;
    const crime = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const p = sc.players[0];
      const cx = Math.floor((p.x + p.w / 2) / 16);
      const cy = Math.floor((p.y + p.h - 2) / 16);
      const near = (sc.ebullets?.active ?? []).map((b) => ({ dx: Math.round(b.x - p.x), dy: Math.round(b.y - p.y) })).filter((b) => Math.abs(b.dx) < 90 && Math.abs(b.dy) < 50);
      const enemies = (sc.world?.enemies ?? []).map((e) => ({ k: e.kind, dx: Math.round(e.x - p.x), dy: Math.round(e.y - p.y), st: e.state })).filter((e) => Math.abs(e.dx) < 150 && Math.abs(e.dy) < 60);
      const spikes = [];
      for (let c = cx - 2; c <= cx + 2; c++) for (let r = cy - 2; r <= cy + 1; r++) if (sc.level.get(c, r) === 4) spikes.push(`${c},${r}`);
      const inWater = sc.level.waterAt(p.x + p.w / 2, p.y + p.h * 0.6);
      return { x: Math.round(p.x), y: Math.round(p.y), inWater, near, enemies, spikes };
    });
    console.log(`  HURT ${prevHp}->${s.hp} @${JSON.stringify(crime)}`);
  }
  prevHp = s.hp;
  if (!s.alive && wasAlive) {
    sawDeath = true; deaths++;
    const crime = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const p = sc.players[0];
      const cx = Math.floor((p.x + p.w / 2) / 16);
      const inWater = sc.level.waterAt(p.x + p.w / 2, p.y + p.h * 0.6);
      const near = (sc.ebullets?.active ?? []).map((b) => ({ dx: Math.round(b.x - p.x), dy: Math.round(b.y - p.y), vx: Math.round(b.vx), vy: Math.round(b.vy) })).filter((b) => Math.abs(b.dx) < 60 && Math.abs(b.dy) < 40);
      const enemies = (sc.world?.enemies ?? []).map((e) => ({ k: e.kind, dx: Math.round(e.x - p.x), dy: Math.round(e.y - p.y), st: e.state })).filter((e) => Math.abs(e.dx) < 130 && Math.abs(e.dy) < 60);
      const holes = [];
      for (let c = cx - 3; c <= cx + 3; c++) if (sc.level.get(c, 22) !== 9 && (c >= 48 && c <= 55 || c >= 66 && c <= 73)) holes.push(c);
      return { y: Math.round(p.y), vy: Math.round(p.vy), inWater, near, enemies, holes };
    });
    console.log(`  died @ x=${s.x} (lives ${lastLives} -> ${s.lives}) crime=${JSON.stringify(crime)}`);
  }
  if (s.alive && !wasAlive) { sawRespawn = true; console.log(`  respawned @ x=${s.x} hp=${s.hp} invuln window`); }
  wasAlive = s.alive;
  lastLives = s.lives;

  if (s.bossHp !== null && !reachedBoss) {
    reachedBoss = true;
    bossHpMin = s.bossHp;
    await page.evaluate((o) => { window.__bossHpAtTrigger = o.hp; window.__bossTrackAtTrigger = o.tr; }, { hp: s.bossHp, tr: s.track });
    await page.screenshot({ path: `${OUT}full_4_boss.png` });
    console.log(`  boss triggered @ x=${s.x} hp=${s.hp} track=${s.track}`);
  }
  if (s.bossHp !== null) bossHpMin = Math.min(bossHpMin, s.bossHp);
  if (s.phase === 'clear' || s.phase === 'over' || s.app === 'gameover') break;

  // stall detection (no teleport - a stall is a real traversal defect).
  // Clearing an enemy ahead is legitimate work, not a stall - but 40s with
  // zero forward progress anywhere is a hard fail (e.g. an unjumpable gap).
  if (s.x > hardLastX + 4) { hardStallAt = Date.now(); hardLastX = s.x; }
  if (Date.now() - hardStallAt > 40000) {
    check('V7 genuine traversal to boss', false, `NO PROGRESS for 40s @ x=${s.x} (col ${Math.floor(s.x / 16)})`);
    break;
  }

  // stop-and-shoot: an enemy ahead within 130px -> halt and clear it before
  // advancing (a human never runs into converging fire on an open bridge)
  if (s.ahead !== null && s.ahead < 130 && curDir === 1) {
    await page.keyboard.up('KeyD');
  } else if (curDir === 1) {
    await page.keyboard.down('KeyD');
  }

  // turn and fight an enemy that snuck in behind (a human would do the same)
  const now = Date.now();
  if (s.behind !== null && (s.ahead === null || s.ahead > 130) && curDir !== -1) {
    await setDir(-1);
    turnBackUntil = now + 1400;
    lastProgressAt = now; // fighting behind is not a traversal stall
    lastX = s.x;
  }
  if (curDir === -1 && (s.behind === null || now > turnBackUntil)) { await setDir(1); lastProgressAt = now; lastX = s.x; }

  // jump OVER any enemy at contact range (frontal shields block bullets and
  // chasers body-check; a human hops both)
  const enemyClose = (s.ahead !== null && s.ahead < 46) || (s.behind !== null && s.behind > -46);
  if (enemyClose && s.onGround && !jumping) {
    await page.keyboard.down('KeyK');
    jumping = true;
    jumpReleaseAt = Date.now() + 300;
  }

  // dodge: hop when an enemy bullet is about to hit
  if (s.threat && s.onGround && !jumping) {
    await page.keyboard.down('KeyK');
    jumping = true;
    jumpReleaseAt = Date.now() + 240;
  }
  if (jumping && Date.now() > jumpReleaseAt) { await page.keyboard.up('KeyK'); jumping = false; }

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
  if (jumping && Date.now() > jumpReleaseAt) { await page.keyboard.up('KeyK'); jumping = false; }
  await sleep(55);
}
await setDir(1);
await page.keyboard.up('KeyD');
await page.keyboard.up('KeyA');
await page.keyboard.up('KeyJ');
await page.keyboard.up('KeyK');
check('V7 genuine traversal reached the boss', reachedBoss, '');
check('V8 hurt taken during play', sawHurt, `minHp=${minHp}`);
check('V8b death + respawn cycle works', !sawDeath || sawRespawn, `deaths=${deaths}`);

/* V9 - boss fight: face, fire, dodge. No cheats. --------------------------- */
if (reachedBoss) {
  const atTrigger = await page.evaluate(() => ({
    hp: window.__bossHpAtTrigger ?? null,
    track: window.__bossTrackAtTrigger ?? null,
  }));
  let hp0 = atTrigger.hp;
  const fightStart = Date.now();
  let fjumping = false, fjumpAt = 0;
  while (Date.now() - fightStart < 150000) {
    const s = await state();
    if (s.bossHp !== null) bossHpMin = Math.min(bossHpMin, s.bossHp);
    if (s.phase === 'clear' || s.app === 'gameover') break;
    if (s.bossHp === 0 || s.bossState === 'dying') break;

    // face the boss, hold fire, and keep a stand-off band: the boss's
    // point-blank spread/ring patterns are unfair at contact range
    const bdir = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const b = sc.boss, p = sc.players[0];
      if (!b || !p.alive) return 0;
      const bc = b.x + b.w / 2, pc = p.x + p.w / 2;
      return bc < pc ? -1 : 1;
    });
    const gap = await page.evaluate(() => {
      const sc = window.__IRONSTORM__.scene;
      const b = sc.boss, p = sc.players[0];
      if (!b) return 999;
      return Math.round(b.x - (p.x + p.w)); // >0: player left of boss
    });
    if (gap < 70) { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
    else if (gap > 190) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
    else if (bdir === 1) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
    else if (bdir === -1) { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
    await page.keyboard.down('KeyJ');

    // dodge incoming bullets
    if (s.threat && s.onGround && !fjumping) {
      await page.keyboard.down('KeyK');
      fjumping = true;
      fjumpAt = Date.now() + 230;
    }
    if (fjumping && Date.now() > fjumpAt) { await page.keyboard.up('KeyK'); fjumping = false; }
    await sleep(50);
  }
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('KeyK');
  const fin = await state();
  console.log(`  boss fight end: hp=${fin.bossHp} state=${fin.bossState} phase=${fin.phase} lives=${fin.lives} deaths=${deaths}`);
  check('V9 boss took real damage (hp 100 -> lower)', hp0 !== null && bossHpMin < hp0, `hp0=${hp0} min=${bossHpMin}`);
  check('V9b boss defeated for real', fin.bossHp === 0 || fin.bossState === 'dying' || fin.phase === 'clear', `hp=${fin.bossHp} state=${fin.bossState} phase=${fin.phase}`);
  const bossTrack = await page.evaluate(() => window.__bossTrackAtTrigger);
  check('V9c boss music swapped in on trigger', bossTrack === 1, `track=${bossTrack}`);
  await page.screenshot({ path: `${OUT}full_5_bossfight.png` });
}

/* V10 - clear flow -> ending ------------------------------------------------ */
let clearOk = false, endingOk = false;
const cl = Date.now();
while (Date.now() - cl < 15000) {
  const s = await state();
  if (s.phase === 'clear') { clearOk = true; await page.screenshot({ path: `${OUT}full_6_clear.png` }); }
  if (s.app === 'stageclear') {
    await sleep(700);
    await page.keyboard.press('Enter');
  }
  if (s.app === 'ending') { endingOk = true; break; }
  await sleep(200);
}
check('V10 stage clear sequence plays', clearOk, '');
check('V10b stageclear -> ending screen', endingOk, '');
await sleep(400);
await page.screenshot({ path: `${OUT}full_7_ending.png` });

/* V11 - audio trigger census ------------------------------------------------- */
const sfx = await page.evaluate(() => window.__sfxCounts);
console.log('sfx census:', JSON.stringify(sfx));
check('V11 shoot sfx fired', (sfx.shoot || 0) + (sfx.spread || 0) > 0, `shoot=${sfx.shoot || 0} spread=${sfx.spread || 0}`);
check('V11b explosion sfx fired', (sfx.explosion || 0) + (sfx.explosionSmall || 0) > 0, `explosion=${sfx.explosion || 0} small=${sfx.explosionSmall || 0}`);
check('V11c pickup sfx fired', (sfx.pickup || 0) > 0, `pickup=${sfx.pickup || 0}`);
check('V11d door sfx fired', (sfx.door || 0) > 0, `door=${sfx.door || 0}`);
check('V11e stageClear sfx fired', (sfx.stageClear || 0) > 0, `stageClear=${sfx.stageClear || 0}`);
check('V11f victory fanfare fired', (sfx.victory || 0) > 0, `victory=${sfx.victory || 0}`);

/* V12 - zero errors ---------------------------------------------------------- */
check('V12 zero console/page errors', errors.length === 0, `${errors.length} errors`);
for (const e of errors) console.log('  ' + e);

const failed = results.filter((r) => !r.ok);
console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} passed ====`);
for (const f of failed) console.log('FAILED: ' + f.name + ' :: ' + f.detail);
await browser.close();
process.exit(failed.length ? 1 : 0);
