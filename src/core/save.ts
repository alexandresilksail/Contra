import { DEFAULT_KEYS, type BindingMap } from './input';

const KEY = 'ironstorm.save.v1';

export interface Settings {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  masterVolume: number; // 0..1
  muted: boolean;
  screenShake: boolean;
  showFps: boolean;
  players: 1 | 2;
}

export interface SaveData {
  highScore: number;
  /** vestigial since the project ships Stage 1 only; kept so old saves load */
  maxStageUnlocked: number; // always 1
  settings: Settings;
  keys: Record<0 | 1, BindingMap>;
  bestTimeByStage: number[];
}

export const defaultSave = (): SaveData => ({
  highScore: 0,
  maxStageUnlocked: 1,
  settings: {
    musicVolume: 0.5,
    sfxVolume: 0.7,
    masterVolume: 0.9,
    muted: false,
    screenShake: true,
    showFps: false,
    players: 1,
  },
  keys: structuredClone(DEFAULT_KEYS),
  bestTimeByStage: new Array(9).fill(0),
});

function sanitize(raw: any): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw.settings ?? {};
  return {
    highScore: Number.isFinite(raw.highScore) ? Math.max(0, Math.floor(raw.highScore)) : 0,
    maxStageUnlocked: 1, // stage progression removed; old values collapse to 1
    settings: {
      musicVolume: clamp01(s.musicVolume, base.settings.musicVolume),
      sfxVolume: clamp01(s.sfxVolume, base.settings.sfxVolume),
      masterVolume: clamp01(s.masterVolume, base.settings.masterVolume),
      muted: typeof s.muted === 'boolean' ? s.muted : false,
      screenShake: typeof s.screenShake === 'boolean' ? s.screenShake : true,
      showFps: typeof s.showFps === 'boolean' ? s.showFps : false,
      players: s.players === 2 ? 2 : 1,
    },
    keys: {
      0: { ...base.keys[0], ...(raw.keys?.[0] ?? {}) },
      1: { ...base.keys[1], ...(raw.keys?.[1] ?? {}) },
    },
    bestTimeByStage: Array.isArray(raw.bestTimeByStage) ? raw.bestTimeByStage.slice(0, 9) : base.bestTimeByStage,
  };
}

const clamp01 = (v: any, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);

/** localStorage may be unavailable (privacy mode / SSR tests) -> memory fallback */
const memory = new Map<string, string>();
const store = {
  get(k: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : (memory.get(k) ?? null);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  set(k: string, v: string): void {
    memory.set(k, v);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    } catch {
      /* quota / privacy mode: memory fallback already stored */
    }
  },
  del(k: string): void {
    memory.delete(k);
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const Save = {
  load(): SaveData {
    const raw = store.get(KEY);
    if (!raw) return defaultSave();
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      return defaultSave();
    }
  },
  save(data: SaveData): void {
    store.set(KEY, JSON.stringify(data));
  },
  reset(): SaveData {
    store.del(KEY);
    return defaultSave();
  },
};
