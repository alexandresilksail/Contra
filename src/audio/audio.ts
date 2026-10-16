/**
 * 100% procedural audio (Web Audio API).
 * No sample files are shipped: every SFX and every music note is synthesised
 * at runtime, so the soundtrack is original by construction.
 *
 * Architecture (incremental on top of the original engine):
 *   AudioContext
 *     └─ master (GainNode)  ← masterVolume / mute
 *          ├─ musicBus (GainNode) ← musicVolume   (step sequencer + drums)
 *          └─ sfxBus   (GainNode) ← sfxVolume     (one-shot VoicePool)
 *
 * VoicePool guarantees for one-shot SFX:
 *   - every node chain is disconnected on `ended` (no graph leaks)
 *   - a hard cap on simultaneous voices (oldest stolen) prevents overlap spam
 *   - a per-SFX minimum interval throttles high-frequency triggers
 * Music scheduler:
 *   - lookahead scheduling, position-preserving pause/resume, tab-away re-anchor
 */

type OscType = OscillatorType;

interface Note {
  step: number; // 16th-step index within the pattern
  deg: number; // scale degree (0 = root, negative allowed), -99 = rest
  len: number; // in 16th steps
}

interface Track {
  bpm: number;
  root: number; // midi note
  scale: number[]; // semitone offsets
  bass: Note[];
  lead: Note[];
  drums: string; // 16 chars per bar: 'k' kick, 's' snare, 'h' hat, '.' rest
  leadWave: OscType;
  bassWave: OscType;
}

const n = (step: number, deg: number, len = 1): Note => ({ step, deg, len });

/** 8 original stage themes + 1 boss theme. Index 8 is the boss battle track. */
export const TRACKS: Track[] = [
  {
    // 1 Military base — driving march
    bpm: 148,
    root: 45,
    scale: [0, 3, 5, 7, 10],
    bass: [n(0, 0, 2), n(2, 0, 1), n(4, 2, 2), n(6, 1, 2), n(8, 0, 2), n(10, -1, 2), n(12, 2, 4)],
    lead: [n(0, 5), n(2, 4), n(3, 5), n(5, 7), n(8, 5), n(10, 4), n(11, 3), n(13, 5), n(14, 7)],
    drums: 'k.hks.hkk.hks.hk',
    leadWave: 'square',
    bassWave: 'triangle',
  },
  {
    // 2 Forest — tense, syncopated
    bpm: 138,
    root: 47,
    scale: [0, 2, 3, 7, 9],
    bass: [n(0, 0, 3), n(3, 0, 1), n(4, 2, 2), n(8, 3, 2), n(10, 1, 2), n(12, 0, 4)],
    lead: [n(0, 4), n(2, 5), n(4, 6), n(6, 5), n(7, 4), n(9, 3), n(12, 5), n(14, 6)],
    drums: 'k..hks.hk..hks.k',
    leadWave: 'square',
    bassWave: 'triangle',
  },
  {
    // 3 Industrial — heavy mechanical
    bpm: 158,
    root: 41,
    scale: [0, 1, 5, 7, 8],
    bass: [n(0, 0, 2), n(2, 0, 2), n(4, 1, 2), n(6, 0, 1), n(8, 2, 2), n(12, 0, 4)],
    lead: [n(0, 3), n(1, 4), n(3, 3), n(5, 6), n(7, 5), n(8, 4), n(11, 6), n(13, 5), n(15, 3)],
    drums: 'kshhkshhkshhkshs',
    leadWave: 'sawtooth',
    bassWave: 'square',
  },
  {
    // 4 Underground — dark, sparse
    bpm: 126,
    root: 38,
    scale: [0, 2, 3, 5, 7, 10],
    bass: [n(0, 0, 4), n(4, -2, 2), n(6, -1, 2), n(8, 0, 4), n(12, 1, 4)],
    lead: [n(0, 4), n(4, 3), n(6, 5), n(8, 6), n(10, 5), n(12, 4), n(14, 3)],
    drums: 'k...s...k..hs..k',
    leadWave: 'triangle',
    bassWave: 'sawtooth',
  },
  {
    // 5 City battlefield — fast, urgent
    bpm: 168,
    root: 49,
    scale: [0, 2, 3, 7, 8],
    bass: [n(0, 0, 1), n(1, 0, 1), n(2, 2, 1), n(4, 0, 2), n(6, 3, 2), n(8, 0, 1), n(10, 2, 2), n(12, 1, 4)],
    lead: [n(0, 5), n(2, 6), n(3, 5), n(5, 4), n(6, 5), n(8, 7), n(10, 6), n(12, 5), n(14, 4)],
    drums: 'k.hks.hkk.hks.hh',
    leadWave: 'square',
    bassWave: 'square',
  },
  {
    // 6 Snow mountains — cold, wide
    bpm: 132,
    root: 50,
    scale: [0, 2, 4, 7, 9],
    bass: [n(0, 0, 4), n(4, 3, 4), n(8, 2, 4), n(12, 4, 4)],
    lead: [n(0, 6), n(3, 5), n(4, 4), n(7, 6), n(8, 7), n(11, 6), n(12, 5), n(15, 4)],
    drums: 'k...h..sk...h.hs',
    leadWave: 'triangle',
    bassWave: 'triangle',
  },
  {
    // 7 Alien facility — weird, dissonant
    bpm: 150,
    root: 44,
    scale: [0, 1, 4, 6, 8, 11],
    bass: [n(0, 0, 2), n(3, 1, 1), n(4, 0, 2), n(8, 3, 2), n(10, 2, 2), n(12, 0, 3)],
    lead: [n(0, 5), n(2, 7), n(4, 6), n(5, 8), n(7, 7), n(9, 5), n(11, 9), n(13, 8), n(15, 6)],
    drums: 'k.h.s.h.k.h.s.hh',
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
  },
  {
    // 8 Final base — relentless finale
    bpm: 176,
    root: 40,
    scale: [0, 1, 3, 5, 7, 8, 10],
    bass: [n(0, 0, 1), n(1, 0, 1), n(2, 1, 1), n(3, 0, 1), n(4, 2, 2), n(6, 1, 2), n(8, 0, 1), n(9, 0, 1), n(10, 3, 2), n(12, 0, 4)],
    lead: [n(0, 6), n(1, 5), n(2, 6), n(4, 8), n(6, 7), n(8, 6), n(9, 5), n(11, 8), n(12, 9), n(14, 8), n(15, 6)],
    drums: 'kshkkshkskhkshsk',
    leadWave: 'square',
    bassWave: 'sawtooth',
  },
  {
    // 9 Boss battle - tense, relentless minor march (ORIGINAL composition:
    //    the original game's boss BGM is copyrighted and cannot be shipped).
    //    Switched in by triggerBoss() for stages that define bossMusic.
    bpm: 164,
    root: 40,
    scale: [0, 2, 3, 5, 7, 8, 10],
    bass: [n(0, 0, 2), n(2, 0, 1), n(3, 0, 1), n(4, 3, 2), n(6, 2, 2), n(8, 0, 2), n(10, 0, 1), n(11, 4, 1), n(12, 3, 2), n(14, 2, 2)],
    lead: [n(0, 4), n(2, 3), n(3, 4), n(4, 2), n(6, 4), n(8, 5), n(10, 4), n(11, 3), n(12, 2, 2), n(14, 4)],
    drums: 'k.hks.hkk.hks.hk',
    leadWave: 'sawtooth',
    bassWave: 'square',
  },
];

export const BOSS_TRACK = TRACKS.length - 1;

/** Human-readable names for tests/docs. Index = TRACKS index. */
export const TRACK_NAMES = [
  'stage1-base', 'stage2-forest', 'stage3-industrial', 'stage4-underground',
  'stage5-city', 'stage6-snow', 'stage7-alien', 'stage8-final', 'boss-battle',
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/* ------------------------------------------------------------------ */
/* VoicePool — one-shot SFX with lifecycle, cap and throttle           */
/* ------------------------------------------------------------------ */

interface Voice {
  /** Force-stop and disconnect immediately. */
  kill(now: number): void;
  readonly endsAt: number;
}

const MAX_VOICES = 28;

/** Minimum seconds between two SFX of the same name (anti-overlap). */
const SFX_MIN_GAP: Record<string, number> = {
  shoot: 0.03,
  laser: 0.05,
  spread: 0.05,
  pierce: 0.05,
  blast: 0.05,
  homing: 0.05,
  explosion: 0.07,
  explosionSmall: 0.05,
  jump: 0.09,
  land: 0.06,
  pickup: 0.1,
  hurt: 0.12,
  enemyHit: 0.03,
  bossHit: 0.05,
  death: 0.2,
  bossDie: 0.3,
  stageClear: 0.3,
  gameOver: 0.3,
  victory: 0.3,
  menuMove: 0.045,
  menuSelect: 0.06,
  alarm: 0.2,
  door: 0.3,
};

class VoicePool {
  private voices = new Set<Voice>();
  private lastAt = new Map<string, number>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly bus: GainNode,
    private readonly noiseBuf: AudioBuffer,
  ) {}

  get activeCount(): number {
    return this.voices.size;
  }

  /** Throttle gate: false when this SFX name fired too recently. */
  gate(name: string, now = this.ctx.currentTime): boolean {
    const gap = SFX_MIN_GAP[name];
    if (gap === undefined) return true;
    const last = this.lastAt.get(name);
    if (last !== undefined && now - last < gap) return false;
    this.lastAt.set(name, now);
    return true;
  }

  private add(v: Voice): void {
    if (this.voices.size >= MAX_VOICES) {
      // steal the oldest voice to keep the graph bounded
      const oldest = this.voices.values().next().value as Voice | undefined;
      if (oldest) {
        this.voices.delete(oldest);
        oldest.kill(this.ctx.currentTime);
      }
    }
    this.voices.add(v);
  }

  private retire(v: Voice): void {
    this.voices.delete(v);
  }

  /** Oscillator one-shot with an attack/decay envelope. */
  tone(
    freq: number,
    dur: number,
    type: OscType = 'square',
    peak = 0.3,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.env(o, t, 0.005, dur, peak);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
    const voice: Voice = {
      endsAt: t + dur + 0.05,
      kill: (now) => {
        try {
          o.stop(now);
        } catch {
          /* already stopped */
        }
        teardown();
      },
    };
    o.onended = () => teardown();
    const teardown = () => {
      try {
        g.disconnect();
        o.disconnect();
      } catch {
        /* already disconnected */
      }
      this.retire(voice);
    };
    this.add(voice);
  }

  /** Filtered-noise one-shot (explosions, hits, drums). */
  noise(dur: number, peak: number, filterHz: number, sweepTo?: number, delay = 0): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    src.connect(f);
    const g = this.env(f, t, 0.004, dur, peak);
    g.connect(this.bus);
    src.start(t);
    src.stop(t + dur + 0.05);
    const voice: Voice = {
      endsAt: t + dur + 0.05,
      kill: (now) => {
        try {
          src.stop(now);
        } catch {
          /* already stopped */
        }
        teardown();
      },
    };
    src.onended = () => teardown();
    const teardown = () => {
      try {
        g.disconnect();
        f.disconnect();
        src.disconnect();
      } catch {
        /* already disconnected */
      }
      this.retire(voice);
    };
    this.add(voice);
  }

  /** Percussive attack/decay envelope on an arbitrary source node. */
  private env(node: AudioNode, t: number, a: number, d: number, peak: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    return g;
  }

  /** Stop everything immediately (level teardown / dispose). */
  killAll(): void {
    const now = this.ctx.currentTime;
    for (const v of [...this.voices]) {
      this.voices.delete(v);
      v.kill(now);
    }
    this.lastAt.clear();
  }
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private pool: VoicePool | null = null;
  musicVol = 0.5;
  sfxVol = 0.7;
  masterVol = 0.9;
  private muted = false;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private track: Track | null = null;
  private trackIndex = -1;
  private intensity = 1; // boss phase -> faster/harder
  private ready = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  init(): void {
    if (this.ready) return;
    const Ctor: typeof AudioContext =
      (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVol;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol * 0.5;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);

    const len = Math.floor(ctx.sampleRate * 0.7);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.pool = new VoicePool(ctx, this.sfxBus, buf);
    this.ready = true;
  }

  resume(): void {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Full teardown: stop music, kill every voice, close the context. */
  dispose(): void {
    this.stopTrack();
    this.pool?.killAll();
    const ctx = this.ctx;
    this.ready = false;
    this.ctx = null;
    this.pool = null;
    if (ctx && ctx.state !== 'closed') void ctx.close();
  }

  /* --------------------------- mixer --------------------------- */

  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.ready) this.musicBus.gain.value = v * 0.5;
  }
  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.ready) this.sfxBus.gain.value = v;
  }
  setMasterVolume(v: number): void {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.ready) this.master.gain.value = this.muted ? 0 : this.masterVol;
  }
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ready) this.master.gain.value = m ? 0 : this.masterVol;
  }
  isMuted(): boolean {
    return this.muted;
  }
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ------------------------------ SFX ------------------------------ */

  sfx(name: string, param = 0): void {
    if (!this.ready || !this.pool) return;
    if (!this.pool.gate(name)) return; // anti-overlap throttle
    const tone = (freq: number, dur: number, type: OscType = 'square', peak = 0.3, slideTo?: number, delay = 0) =>
      this.pool!.tone(freq, dur, type, peak, slideTo, delay);
    const noise = (dur: number, peak: number, filterHz: number, sweepTo?: number, delay = 0) =>
      this.pool!.noise(dur, peak, filterHz, sweepTo, delay);
    switch (name) {
      case 'shoot':
        tone(720 - param * 40, 0.07, 'square', 0.22, 240);
        noise(0.05, 0.08, 2600, 700);
        break;
      case 'laser':
        tone(1500, 0.16, 'sawtooth', 0.16, 420);
        break;
      case 'spread':
        tone(430, 0.1, 'sawtooth', 0.22, 150);
        noise(0.09, 0.12, 1800, 500);
        break;
      case 'pierce':
        tone(1150, 0.09, 'triangle', 0.2, 700);
        break;
      case 'blast':
        tone(330, 0.14, 'square', 0.24, 90);
        noise(0.16, 0.2, 1400, 260);
        break;
      case 'homing':
        tone(900, 0.08, 'sine', 0.18, 1500);
        break;
      case 'explosion':
        noise(0.42, 0.4, 900, 90);
        tone(120, 0.35, 'square', 0.22, 40);
        break;
      case 'explosionSmall':
        noise(0.2, 0.24, 1200, 160);
        break;
      case 'jump':
        tone(300, 0.13, 'square', 0.18, 660);
        break;
      case 'land':
        noise(0.07, 0.12, 700, 200);
        break;
      case 'pickup':
        tone(660, 0.07, 'square', 0.24);
        tone(880, 0.07, 'square', 0.24, undefined, 0.07);
        tone(1320, 0.12, 'square', 0.24, undefined, 0.14);
        break;
      case 'hurt':
        tone(200, 0.18, 'sawtooth', 0.3, 70);
        noise(0.14, 0.18, 900, 200);
        break;
      case 'enemyHit':
        noise(0.05, 0.14, 3000, 800);
        break;
      case 'bossHit':
        tone(180, 0.1, 'square', 0.26, 120);
        noise(0.09, 0.16, 2200, 400);
        break;
      case 'death':
        tone(420, 0.5, 'square', 0.3, 40);
        noise(0.5, 0.3, 800, 60);
        break;
      case 'bossDie':
        for (let i = 0; i < 6; i++) {
          noise(0.5, 0.35, 1200, 80, i * 0.16);
          tone(140 - i * 12, 0.4, 'square', 0.22, 40, i * 0.16);
        }
        break;
      case 'stageClear':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'square', 0.26, undefined, i * 0.13));
        break;
      case 'victory':
        // final fanfare (stage 8 cleared): rising arpeggio into a held major chord
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'square', 0.24, undefined, i * 0.1));
        tone(1046, 0.55, 'square', 0.2, undefined, 0.52);
        tone(1318, 0.55, 'triangle', 0.18, undefined, 0.52);
        tone(1568, 0.65, 'triangle', 0.13, undefined, 0.58);
        noise(0.6, 0.09, 6000, 9500, 0.52);
        break;
      case 'gameOver':
        [392, 349, 294, 220].forEach((f, i) => tone(f, 0.3, 'triangle', 0.28, f * 0.7, i * 0.22));
        break;
      case 'menuMove':
        tone(520, 0.05, 'square', 0.2);
        break;
      case 'menuSelect':
        tone(700, 0.06, 'square', 0.24);
        tone(1050, 0.1, 'square', 0.24, undefined, 0.06);
        break;
      case 'alarm':
        tone(880, 0.16, 'square', 0.2, 620);
        tone(880, 0.16, 'square', 0.2, 620, 0.24);
        break;
      case 'door':
        tone(90, 0.5, 'sawtooth', 0.24, 200);
        noise(0.5, 0.16, 500, 120);
        break;
    }
  }

  /** Simultaneous one-shot voices (tests/diagnostics). */
  get activeVoices(): number {
    return this.pool?.activeCount ?? 0;
  }

  /* ------------------------------ music ------------------------------ */

  playTrack(index: number): void {
    this.init();
    if (!this.ready) return;
    this.track = TRACKS[index % TRACKS.length];
    this.trackIndex = index % TRACKS.length;
    this.step = 0;
    this.intensity = 1;
    this.nextTime = this.ctx!.currentTime + 0.06;
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.schedule(), 25) as unknown as number;
  }

  stopTrack(): void {
    this.track = null;
    this.trackIndex = -1;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Pause music, keeping the pattern position for a later resume. */
  pauseTrack(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // `track`, `step` and `nextTime` are preserved on purpose.
  }

  /** Resume a paused track from its exact pattern position. */
  resumeTrack(): void {
    if (!this.track) return;
    this.init();
    if (!this.ready) return;
    // re-anchor: notes already handed to the hardware (≤120ms ahead) are done
    this.nextTime = this.ctx!.currentTime + 0.05;
    if (this.timer === null) this.timer = setInterval(() => this.schedule(), 25) as unknown as number;
  }

  get playing(): boolean {
    return this.track !== null && this.timer !== null;
  }

  /** Index of the currently playing track (-1 = none). */
  get currentTrack(): number {
    return this.trackIndex;
  }

  /** Current 16th-step position within the pattern (tests/diagnostics). */
  get musicStep(): number {
    return this.step;
  }

  setIntensity(v: number): void {
    this.intensity = v;
  }

  private schedule(): void {
    if (!this.ready || !this.track || !this.ctx) return;
    const t = this.track;
    const stepDur = 60 / t.bpm / 4 / this.intensity;
    // Tab was backgrounded: setInterval throttled, nextTime fell far behind.
    // Re-anchor instead of bursting a catch-up barrage of notes.
    if (this.nextTime < this.ctx.currentTime - 0.25) {
      this.nextTime = this.ctx.currentTime + 0.05;
    }
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, t, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 16;
    }
  }

  private degToMidi(t: Track, deg: number): number {
    const oct = Math.floor(deg / t.scale.length);
    const idx = ((deg % t.scale.length) + t.scale.length) % t.scale.length;
    return t.root + t.scale[idx] + oct * 12;
  }

  private playStep(step: number, time: number, t: Track, stepDur: number): void {
    const ctx = this.ctx!;
    const at = (d: number, fn: (tt: number) => void) => fn(time + d * stepDur);

    const hit = (notes: Note[], wave: OscType, gain: number, oct: number, detune = 0) => {
      for (const nt of notes) {
        if (nt.step === step) {
          const midi = this.degToMidi(t, nt.deg) + oct * 12;
          const dur = nt.len * stepDur * 0.9;
          const o = ctx.createOscillator();
          o.type = wave;
          o.frequency.setValueAtTime(midiToFreq(midi), time);
          o.detune.value = detune;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, time);
          g.gain.linearRampToValueAtTime(gain, time + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
          o.connect(g);
          g.connect(this.musicBus);
          o.start(time);
          o.stop(time + dur + 0.03);
          // music voices are short and bounded by the pattern length; they are
          // collected by the browser once stopped (no pool churn per step)
        }
      }
    };

    hit(t.bass, t.bassWave, 0.28, 0);
    hit(t.lead, t.leadWave, 0.16, 1);
    hit(t.lead, t.leadWave, 0.08, 2, 6);

    const d = t.drums[step] ?? '.';
    if (d === 'k') {
      at(0, (tt) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, tt);
        o.frequency.exponentialRampToValueAtTime(45, tt + 0.11);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, tt);
        g.gain.exponentialRampToValueAtTime(0.001, tt + 0.13);
        o.connect(g);
        g.connect(this.musicBus);
        o.start(tt);
        o.stop(tt + 0.15);
      });
    } else if (d === 's') {
      at(0, (tt) => {
        const s = ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 1600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, tt);
        g.gain.exponentialRampToValueAtTime(0.001, tt + 0.1);
        s.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        s.start(tt);
        s.stop(tt + 0.12);
      });
    } else if (d === 'h') {
      at(0, (tt) => {
        const s = ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, tt);
        g.gain.exponentialRampToValueAtTime(0.001, tt + 0.045);
        s.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        s.start(tt);
        s.stop(tt + 0.06);
      });
    }
  }
}

export const audio = new AudioEngine();
