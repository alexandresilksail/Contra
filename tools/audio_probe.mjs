/**
 * audio_probe.mjs — real-browser verification of the original Chiptune audio
 * system and the vendor asset loading path. Runs against the Vite dev server.
 *
 * Verifies (all in a real Chrome with a real AudioContext):
 *   A01  audio unlocks on a real user gesture (ctx.state === 'running')
 *   A02  stage start plays that stage's theme (currentTrack) and advances
 *   A03  holding fire synthesises SFX voices; they retire to zero afterwards
 *   A04  Escape pauses music keeping position; unpause resumes from it
 *   A05  boss track switch (playTrack(BOSS_TRACK))
 *   A06  stage switch swaps the theme
 *   A07  master volume + mute from persisted settings
 *   A08  vendor (Open Gunner) asset decodes through the runtime registry
 *   A09  zero console/page errors
 *
 * Usage: node tools/audio_probe.mjs   (dev server must be running)
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-10-08-04-37-10/game/tools/';
const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
};

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-proxy-server', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__IRONSTORM__, null, { timeout: 15000 });

// ---- A01: real user gesture unlocks the AudioContext ----
await page.keyboard.press('Enter'); // menu select = also the unlock gesture
await sleep(400);
const a01 = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  return { hasCtx: !!a.ctx, state: a.ctx ? a.ctx.state : 'none', master: a.ctx ? a.master?.gain?.value : null };
});
record('A01 audio unlock', a01.hasCtx && a01.state === 'running', JSON.stringify(a01));

// ---- A02: stage 1 start plays theme 0 and the pattern advances ----
await page.evaluate(() => window.__IRONSTORM__.startGame({ stage: 1, chars: ['razor', 'titan'], twoPlayer: false }));
await sleep(900);
const a02 = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  return { track: a.currentTrack, playing: a.playing, step: a.musicStep };
});
record('A02 stage1 theme', a02.track === 0 && a02.playing && a02.step >= 0, JSON.stringify(a02));
await sleep(600);
const a02b = await page.evaluate(() => window.__IRONSTORM__.audio.musicStep);
record('A02 pattern advances', a02b !== a02.step, `step ${a02.step} -> ${a02b}`);

// ---- A03: firing synthesises voices, then they retire ----
await page.keyboard.down('KeyJ');
await sleep(450);
const during = await page.evaluate(() => window.__IRONSTORM__.audio.activeVoices);
await page.keyboard.up('KeyJ');
await sleep(900);
const after = await page.evaluate(() => window.__IRONSTORM__.audio.activeVoices);
record('A03 sfx voices', during > 0 && after === 0, `during=${during} after=${after}`);
await page.screenshot({ path: `${OUT}aud_1_stage1.png` });

// ---- A04: pause keeps position, resume continues ----
await page.keyboard.press('Escape');
await sleep(250);
const paused = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  return { playing: a.playing, step: a.musicStep, track: a.currentTrack };
});
await sleep(600);
const stillPaused = await page.evaluate(() => window.__IRONSTORM__.audio.musicStep);
await page.keyboard.press('Escape');
await sleep(450);
const resumed = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  return { playing: a.playing, step: a.musicStep, track: a.currentTrack };
});
record(
  'A04 pause/resume',
  !paused.playing && stillPaused === paused.step && resumed.playing && resumed.step !== paused.step && resumed.track === 0,
  JSON.stringify({ paused, stillPaused, resumed }),
);

// ---- A05: boss track switch ----
const a05 = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  a.playTrack(8);
  return { track: a.currentTrack, playing: a.playing };
});
record('A05 boss track', a05.track === 8 && a05.playing, JSON.stringify(a05));

// ---- A06: stage switch swaps the theme ----
await page.evaluate(() => window.__IRONSTORM__.startGame({ stage: 3, chars: ['razor', 'titan'], twoPlayer: false }));
await sleep(700);
const a06 = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  return { track: a.currentTrack, playing: a.playing };
});
record('A06 stage3 theme', a06.track === 2 && a06.playing, JSON.stringify(a06));
await page.screenshot({ path: `${OUT}aud_2_stage3.png` });

// ---- A07: persisted master volume + mute ----
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('ironstorm.save.v1') || '{}');
  raw.settings = { ...(raw.settings || {}), masterVolume: 0.3, muted: true, musicVolume: 0.5, sfxVolume: 0.7 };
  localStorage.setItem('ironstorm.save.v1', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__IRONSTORM__, null, { timeout: 15000 });
await page.keyboard.press('Enter'); // unlock gesture re-applies settings
await sleep(500);
const a07 = await page.evaluate(() => {
  const a = window.__IRONSTORM__.audio;
  return { muted: a.isMuted(), master: a.ctx ? a.master.gain.value : null };
});
record('A07 master/mute', a07.muted === true && a07.master === 0, JSON.stringify(a07));
// restore defaults for the rest of the run
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('ironstorm.save.v1') || '{}');
  raw.settings = { ...(raw.settings || {}), masterVolume: 0.9, muted: false };
  localStorage.setItem('ironstorm.save.v1', JSON.stringify(raw));
  window.__IRONSTORM__.audio.setMasterVolume(0.9);
  window.__IRONSTORM__.audio.setMuted(false);
});

// ---- A08: vendor asset decodes through the runtime registry ----
const a08 = await page.evaluate(async () => {
  const mod = await import('/src/assets/registry.ts');
  const reg = new mod.AssetRegistry(
    {
      fetchJson: async (url) => (await fetch(url)).json(),
      loadImage: (url) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => rej(new Error('image load failed: ' + url));
          i.src = url;
        }),
    },
    { publishMode: true },
  );
  await reg.load('assets/manifest.json');
  const img = await reg.getImage('vendor.openGunner.hero');
  const manifest = await (await fetch('assets/manifest.json')).json();
  const entry = manifest.shared['vendor.openGunner.hero'];
  return {
    w: img.naturalWidth,
    h: img.naturalHeight,
    publishable: entry.publishable,
    license: entry.license,
    vendorCount: Object.keys(manifest.shared).filter((k) => k.startsWith('vendor.')).length,
  };
});
record(
  'A08 vendor asset decode',
  a08.w === 1026 && a08.h === 1280 && a08.publishable === true && a08.license === 'LICENSE_VERIFIED' && a08.vendorCount === 12,
  JSON.stringify(a08),
);

// ---- A09: error tally ----
record('A09 zero console errors', errors.length === 0, errors.length ? errors.slice(0, 5).join(' | ') : 'none');

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\naudio_probe: ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
