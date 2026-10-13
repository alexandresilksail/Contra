/**
 * 100% procedural audio (Web Audio API).
 * No sample files are shipped: every SFX and every music note is synthesised
 * at runtime, so the soundtrack is original by construction.
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

/** 8 original themes — one per stage. */
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

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  musicVol = 0.5;
  sfxVol = 0.7;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private track: Track | null = null;
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
    this.master.gain.value = 0.9;
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
    this.ready = true;
  }

  resume(): void {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.ready) this.musicBus.gain.value = v * 0.5;
  }
  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.ready) this.sfxBus.gain.value = v;
  }

  /* ------------------------------ SFX ------------------------------ */

  private env(node: AudioNode, t: number, a: number, d: number, peak: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    return g;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscType = 'square',
    peak = 0.3,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.env(o, t, 0.005, dur, peak);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, peak: number, filterHz: number, sweepTo?: number, delay = 0): void {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    src.connect(f);
    const g = this.env(f, t, 0.004, dur, peak);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  sfx(name: string, param = 0): void {
    if (!this.ready) return;
    switch (name) {
      case 'shoot':
        this.tone(720 - param * 40, 0.07, 'square', 0.22, 240);
        this.noise(0.05, 0.08, 2600, 700);
        break;
      case 'laser':
        this.tone(1500, 0.16, 'sawtooth', 0.16, 420);
        break;
      case 'spread':
        this.tone(430, 0.1, 'sawtooth', 0.22, 150);
        this.noise(0.09, 0.12, 1800, 500);
        break;
      case 'pierce':
        this.tone(1150, 0.09, 'triangle', 0.2, 700);
        break;
      case 'blast':
        this.tone(330, 0.14, 'square', 0.24, 90);
        this.noise(0.16, 0.2, 1400, 260);
        break;
      case 'homing':
        this.tone(900, 0.08, 'sine', 0.18, 1500);
        break;
      case 'explosion':
        this.noise(0.42, 0.4, 900, 90);
        this.tone(120, 0.35, 'square', 0.22, 40);
        break;
      case 'explosionSmall':
        this.noise(0.2, 0.24, 1200, 160);
        break;
      case 'jump':
        this.tone(300, 0.13, 'square', 0.18, 660);
        break;
      case 'land':
        this.noise(0.07, 0.12, 700, 200);
        break;
      case 'pickup':
        this.tone(660, 0.07, 'square', 0.24);
        this.tone(880, 0.07, 'square', 0.24, undefined, 0.07);
        this.tone(1320, 0.12, 'square', 0.24, undefined, 0.14);
        break;
      case 'hurt':
        this.tone(200, 0.18, 'sawtooth', 0.3, 70);
        this.noise(0.14, 0.18, 900, 200);
        break;
      case 'enemyHit':
        this.noise(0.05, 0.14, 3000, 800);
        break;
      case 'bossHit':
        this.tone(180, 0.1, 'square', 0.26, 120);
        this.noise(0.09, 0.16, 2200, 400);
        break;
      case 'death':
        this.tone(420, 0.5, 'square', 0.3, 40);
        this.noise(0.5, 0.3, 800, 60);
        break;
      case 'bossDie':
        for (let i = 0; i < 6; i++) {
          this.noise(0.5, 0.35, 1200, 80, i * 0.16);
          this.tone(140 - i * 12, 0.4, 'square', 0.22, 40, i * 0.16);
        }
        break;
      case 'stageClear':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.26, undefined, i * 0.13));
        break;
      case 'gameOver':
        [392, 349, 294, 220].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.28, f * 0.7, i * 0.22));
        break;
      case 'menuMove':
        this.tone(520, 0.05, 'square', 0.2);
        break;
      case 'menuSelect':
        this.tone(700, 0.06, 'square', 0.24);
        this.tone(1050, 0.1, 'square', 0.24, undefined, 0.06);
        break;
      case 'alarm':
        this.tone(880, 0.16, 'square', 0.2, 620);
        this.tone(880, 0.16, 'square', 0.2, 620, 0.24);
        break;
      case 'door':
        this.tone(90, 0.5, 'sawtooth', 0.24, 200);
        this.noise(0.5, 0.16, 500, 120);
        break;
    }
  }

  /* ------------------------------ music ------------------------------ */

  playTrack(index: number): void {
    this.init();
    if (!this.ready) return;
    this.track = TRACKS[index % TRACKS.length];
    this.step = 0;
    this.intensity = 1;
    this.nextTime = this.ctx!.currentTime + 0.06;
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.schedule(), 25) as unknown as number;
  }

  stopTrack(): void {
    this.track = null;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setIntensity(v: number): void {
    this.intensity = v;
  }

  private schedule(): void {
    if (!this.ready || !this.track || !this.ctx) return;
    const t = this.track;
    const stepDur = 60 / t.bpm / 4 / this.intensity;
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
