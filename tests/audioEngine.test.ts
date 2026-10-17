/**
 * AudioEngine unit tests with a hand-rolled Web Audio mock.
 *
 * The mock mirrors the real API surface the engine touches (gain/oscillator/
 * buffer-source/biquad nodes, AudioParam automation, `onended`) and exposes a
 * manually advanced clock, so scheduling, throttling, voice-cap and
 * pause/resume behaviour are all deterministically testable in jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine, TRACKS, TRACK_NAMES, BOSS_TRACK } from '../src/audio/audio';

/* ----------------------------- mock ----------------------------- */

let NOW = 0;

class MockParam {
  value = 0;
  calls: Array<{ fn: string; v: number; t: number }> = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push({ fn: 'setValueAtTime', v, t });
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push({ fn: 'linearRampToValueAtTime', v, t });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push({ fn: 'exponentialRampToValueAtTime', v, t });
    return this;
  }
}

class MockNode {
  outputs: MockNode[] = [];
  disconnected = false;
  connect(dst: any) {
    this.outputs.push(dst);
    return dst;
  }
  disconnect() {
    this.disconnected = true;
    this.outputs = [];
  }
}

class MockGain extends MockNode {
  gain = new MockParam();
}

class MockOsc extends MockNode {
  type = 'sine';
  frequency = new MockParam();
  detune = { value: 0 };
  onended: (() => void) | null = null;
  startT = -1;
  stopT = -1;
  start(t: number) {
    this.startT = t;
  }
  stop(t: number) {
    this.stopT = t;
  }
  /** the browser fires this asynchronously when the stop time passes */
  fireEnded() {
    this.onended?.();
  }
}

class MockBufSrc extends MockNode {
  buffer: any = null;
  onended: (() => void) | null = null;
  startT = -1;
  stopT = -1;
  start(t: number) {
    this.startT = t;
  }
  stop(t: number) {
    this.stopT = t;
  }
  fireEnded() {
    this.onended?.();
  }
}

class MockBiquad extends MockNode {
  type = 'lowpass';
  frequency = new MockParam();
}

class MockBuffer {
  constructor(
    readonly length: number,
    readonly sampleRate: number,
  ) {}
  getChannelData() {
    return new Float32Array(this.length);
  }
}

class MockAC {
  static last: MockAC | null = null;
  state = 'running';
  sampleRate = 44100;
  destination = new MockNode();
  oscs: MockOsc[] = [];
  bufs: MockBufSrc[] = [];
  gains: MockGain[] = [];
  biquads: MockBiquad[] = [];
  closed = false;
  constructor() {
    MockAC.last = this;
  }
  get currentTime() {
    return NOW;
  }
  createGain() {
    const g = new MockGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new MockOsc();
    this.oscs.push(o);
    return o;
  }
  createBufferSource() {
    const b = new MockBufSrc();
    this.bufs.push(b);
    return b;
  }
  createBiquadFilter() {
    const f = new MockBiquad();
    this.biquads.push(f);
    return f;
  }
  createBuffer(_ch: number, len: number, sr: number) {
    return new MockBuffer(len, sr);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    this.closed = true;
    return Promise.resolve();
  }
}

/** Advance mock clock AND fake timers together (scheduler reads both). */
function tick(ms: number) {
  NOW += ms / 1000;
  vi.advanceTimersByTime(ms);
}

/** Fire ended for every source whose stop time has passed. */
function flushEnded() {
  for (const o of MockAC.last?.oscs ?? []) if (o.stopT >= 0 && o.stopT <= NOW) o.fireEnded();
  for (const b of MockAC.last?.bufs ?? []) if (b.stopT >= 0 && b.stopT <= NOW) b.fireEnded();
}

/** Every source created so far. */
function allSources(): Array<MockOsc | MockBufSrc> {
  return [...(MockAC.last?.oscs ?? []), ...(MockAC.last?.bufs ?? [])];
}

/* ----------------------------- tests ----------------------------- */

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    NOW = 0;
    MockAC.last = null;
    (globalThis as any).AudioContext = MockAC;
    vi.useFakeTimers();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
    delete (globalThis as any).AudioContext;
  });

  describe('graph + mixer', () => {
    it('init builds master/music/sfx buses wired to destination', () => {
      engine.init();
      const ctx = MockAC.last!;
      expect(ctx).not.toBeNull();
      expect(ctx.gains.length).toBe(3); // master + musicBus + sfxBus
      const [master, music, sfx] = ctx.gains;
      expect(master.outputs).toContain(ctx.destination);
      expect(music.outputs).toContain(master);
      expect(sfx.outputs).toContain(master);
      expect(master.gain.value).toBeCloseTo(0.9); // default master volume
    });

    it('master volume and mute drive the master gain', () => {
      engine.init();
      const master = MockAC.last!.gains[0];
      engine.setMasterVolume(0.4);
      expect(master.gain.value).toBeCloseTo(0.4);
      engine.setMuted(true);
      expect(master.gain.value).toBe(0);
      expect(engine.isMuted()).toBe(true);
      engine.setMuted(false);
      expect(master.gain.value).toBeCloseTo(0.4);
      engine.toggleMute();
      expect(engine.isMuted()).toBe(true);
    });

    it('music/sfx volumes drive their buses', () => {
      engine.init();
      const [, music, sfx] = MockAC.last!.gains;
      engine.setMusicVolume(0.5);
      engine.setSfxVolume(0.7);
      expect(music.gain.value).toBeCloseTo(0.25); // music bus is musicVol * 0.5
      expect(sfx.gain.value).toBeCloseTo(0.7);
    });

    it('volume setters before init are remembered and applied on init', () => {
      engine.setMasterVolume(0.3);
      engine.setMusicVolume(0.2);
      engine.setSfxVolume(0.6);
      engine.setMuted(true);
      engine.init();
      const [master, music, sfx] = MockAC.last!.gains;
      expect(master.gain.value).toBe(0); // muted wins
      expect(music.gain.value).toBeCloseTo(0.1);
      expect(sfx.gain.value).toBeCloseTo(0.6);
    });
  });

  describe('SFX voice lifecycle', () => {
    it('creates oscillator+noise voices for shoot', () => {
      engine.init();
      engine.sfx('shoot');
      expect(engine.activeVoices).toBe(2); // tone + noise
      expect(MockAC.last!.oscs.length).toBe(1);
      expect(MockAC.last!.bufs.length).toBe(1);
    });

    it('disconnects every node once voices end (no graph leak)', () => {
      engine.init();
      engine.sfx('explosion');
      expect(engine.activeVoices).toBe(2);
      NOW += 2; // let every stop time pass
      flushEnded();
      expect(engine.activeVoices).toBe(0);
      for (const g of MockAC.last!.gains.slice(3)) expect(g.disconnected).toBe(true);
      for (const o of MockAC.last!.oscs) expect(o.disconnected).toBe(true);
      for (const b of MockAC.last!.bufs) expect(b.disconnected).toBe(true);
    });

    it('throttles high-frequency repeats of the same sfx', () => {
      engine.init();
      engine.sfx('shoot');
      engine.sfx('shoot');
      engine.sfx('shoot');
      expect(engine.activeVoices).toBe(2); // only the first got through
      tick(40); // past the 30ms shoot gap
      engine.sfx('shoot');
      expect(engine.activeVoices).toBe(4);
    });

    it('caps simultaneous voices by stealing the oldest', () => {
      engine.init();
      for (let i = 0; i < 20; i++) {
        tick(40); // clear the throttle each round
        engine.sfx('shoot'); // 2 voices per call
      }
      expect(engine.activeVoices).toBe(28); // exactly at the cap
      expect(MockAC.last!.oscs.length).toBe(20); // one tone per shoot
      expect(MockAC.last!.bufs.length).toBe(20); // one noise per shoot
      // 40 voices total, cap 28 -> the 12 oldest were force-stopped AND
      // disconnected immediately (no lingering nodes in the graph)
      const disconnected =
        MockAC.last!.oscs.filter((o) => o.disconnected).length +
        MockAC.last!.bufs.filter((b) => b.disconnected).length;
      expect(disconnected).toBe(12);
    });

    it('mute silences the master bus but voices still run', () => {
      engine.init();
      engine.setMuted(true);
      engine.sfx('shoot');
      expect(engine.activeVoices).toBe(2);
      expect(MockAC.last!.gains[0].gain.value).toBe(0);
    });
  });

  describe('required SFX coverage', () => {
    const REQUIRED = [
      'shoot', // 射击
      'jump', // 跳跃
      'hurt', // 受伤
      'enemyHit', // 敌人受击
      'explosion', // 敌人死亡/爆炸
      'pickup', // 武器拾取
      'bossHit', // Boss 战
      'bossDie',
      'stageClear', // 通关
      'gameOver', // 失败
      'victory', // 胜利（最终 fanfare）
    ];

    it.each(REQUIRED)('%s synthesises at least one voice', (name) => {
      engine.init();
      const before = allSources().length;
      engine.sfx(name);
      expect(allSources().length).toBeGreaterThan(before);
    });

    it('every documented sfx name is implemented (no silent fallthrough)', () => {
      engine.init();
      const NAMES = [
        'shoot', 'laser', 'spread', 'pierce', 'blast', 'homing', 'explosion', 'explosionSmall',
        'jump', 'land', 'pickup', 'hurt', 'enemyHit', 'bossHit', 'death', 'bossDie',
        'stageClear', 'victory', 'gameOver', 'menuMove', 'menuSelect', 'alarm', 'door',
      ];
      for (const name of NAMES) {
        tick(500); // clear all throttle gaps
        const before = allSources().length;
        engine.sfx(name);
        expect(allSources().length, `sfx "${name}" produced no audio`).toBeGreaterThan(before);
      }
    });

    it('victory fanfare is longer than the stage-clear jingle', () => {
      engine.init();
      engine.sfx('stageClear');
      const clearLen = Math.max(...MockAC.last!.oscs.map((o) => o.stopT));
      NOW = 0;
      engine.sfx('victory');
      const victoryLen = Math.max(...MockAC.last!.oscs.map((o) => o.stopT));
      expect(victoryLen).toBeGreaterThan(clearLen);
    });
  });

  describe('music scheduler', () => {
    it('ships the stage-1 theme + 1 boss theme, all original data', () => {
      expect(TRACKS.length).toBe(2);
      expect(TRACK_NAMES.length).toBe(2);
      expect(BOSS_TRACK).toBe(1);
      for (const t of TRACKS) {
        expect(t.bpm).toBeGreaterThan(60);
        expect(t.scale.length).toBeGreaterThan(2);
        expect(t.lead.length).toBeGreaterThan(0);
        expect(t.bass.length).toBeGreaterThan(0);
        expect(t.drums.length).toBe(16);
      }
    });

    it('playTrack schedules notes and advances the pattern', () => {
      engine.init();
      engine.playTrack(0);
      expect(engine.currentTrack).toBe(0);
      expect(engine.playing).toBe(true);
      const before = MockAC.last!.oscs.length;
      tick(1000);
      expect(engine.musicStep).toBeGreaterThan(0);
      expect(MockAC.last!.oscs.length).toBeGreaterThan(before);
    });

    it('boss intensity speeds the sequencer up', () => {
      engine.init();
      engine.playTrack(BOSS_TRACK);
      engine.setIntensity(1.9); // late boss phase
      tick(1000);
      const fast = engine.musicStep;
      engine.stopTrack();
      engine.playTrack(BOSS_TRACK);
      engine.setIntensity(1);
      tick(1000);
      expect(fast).toBeGreaterThan(engine.musicStep);
    });

    it('pause keeps position; resume continues from it', () => {
      engine.init();
      engine.playTrack(BOSS_TRACK);
      tick(700);
      const paused = engine.musicStep;
      expect(paused).toBeGreaterThan(0);
      engine.pauseTrack();
      expect(engine.playing).toBe(false);
      tick(700); // no scheduling while paused
      expect(engine.musicStep).toBe(paused);
      engine.resumeTrack();
      expect(engine.playing).toBe(true);
      expect(engine.currentTrack).toBe(BOSS_TRACK);
      tick(300);
      expect(engine.musicStep).not.toBe(paused);
    });

    it('stopTrack clears the track; playTrack restarts the pattern', () => {
      engine.init();
      engine.playTrack(1);
      tick(200);
      const stopped = engine.musicStep;
      engine.stopTrack();
      expect(engine.playing).toBe(false);
      expect(engine.currentTrack).toBe(-1);
      tick(500); // no scheduling after stop
      expect(engine.musicStep).toBe(stopped);
      engine.playTrack(1);
      expect(engine.musicStep).toBe(0); // fresh track starts at step 0
      expect(engine.playing).toBe(true);
    });

    it('re-anchors after a backgrounded tab instead of bursting notes', () => {
      engine.init();
      engine.playTrack(0);
      tick(200);
      // simulate a throttled background tab: clock jumped 10s, timers fire once
      NOW += 10;
      vi.advanceTimersByTime(25);
      const afterBurst = MockAC.last!.oscs.length;
      tick(50);
      // only a couple of steps may be scheduled per wake-up, never 10s worth
      expect(MockAC.last!.oscs.length - afterBurst).toBeLessThan(20);
    });

    it('playTrack(boss) then pause/resume keeps the boss theme', () => {
      engine.init();
      engine.playTrack(BOSS_TRACK);
      tick(300);
      engine.pauseTrack();
      tick(300);
      engine.resumeTrack();
      expect(engine.currentTrack).toBe(BOSS_TRACK);
    });
  });

  describe('dispose', () => {
    it('stops music, kills voices and closes the context', () => {
      engine.init();
      engine.playTrack(0);
      engine.sfx('explosion');
      tick(100);
      engine.dispose();
      expect(engine.playing).toBe(false);
      expect(engine.activeVoices).toBe(0);
      expect(MockAC.last!.closed).toBe(true);
    });
  });
});
