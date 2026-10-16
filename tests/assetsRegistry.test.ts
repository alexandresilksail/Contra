import { describe, expect, it, vi } from 'vitest';
import {
  AssetLicenseError,
  AssetNotFoundError,
  AssetRegistry,
  resolveUrl,
  type AssetLoaderHooks,
  type LevelManifest,
  type TopManifest,
} from '../src/assets/registry';

const topManifest: TopManifest = {
  schemaVersion: 1,
  licensePolicy: { publishRequires: ['LICENSE_VERIFIED', 'APPROVED_FOR_PROJECT'] },
  shared: {
    'player.sheet': {
      file: '../sprites/players.png',
      kind: 'spritesheet',
      license: 'THIRD_PARTY_RESTRICTED',
      status: 'integrated-local',
      publishable: false,
    },
    'ui.icon': {
      file: '../sprites/icon.png',
      kind: 'image',
      license: 'APPROVED_FOR_PROJECT',
      status: 'integrated',
      publishable: true,
    },
  },
  levelIndex: {
    'level-01': { title: 'JUNGLE', coverage: 'AVAILABLE_AND_VERIFIED', manifest: './levels/level-01/manifest.json' },
    'level-02': { title: 'BASE', coverage: 'PARTIAL', manifest: './levels/level-02/manifest.json' },
  },
};

const level1: LevelManifest = {
  schemaVersion: 1,
  level: 'level-01',
  title: 'JUNGLE',
  coverage: 'AVAILABLE_AND_VERIFIED',
  assets: {
    'background.panorama': {
      file: '../../../sprites/stage1bg.png',
      kind: 'image',
      license: 'THIRD_PARTY_RESTRICTED',
      status: 'integrated-local',
      publishable: false,
    },
  },
  sharedRefs: {
    'player.sheet': { manifest: '../../../manifest.json', id: 'player.sheet' },
  },
  gaps: [],
};

const level2: LevelManifest = {
  schemaVersion: 1,
  level: 'level-02',
  title: 'BASE',
  coverage: 'PARTIAL',
  assets: {},
  sharedRefs: { 'player.sheet': { manifest: '../../../manifest.json', id: 'player.sheet' } },
  gaps: ['L02-BG-MAP'],
};

function makeHooks(overrides: Partial<AssetLoaderHooks> = {}) {
  const fetchJson = vi.fn(async (url: string) => {
    if (url.endsWith('assets/manifest.json')) return topManifest;
    if (url.endsWith('level-01/manifest.json')) return level1;
    if (url.endsWith('level-02/manifest.json')) return level2;
    throw new Error(`unexpected fetch: ${url}`);
  });
  const loadImage = vi.fn(async (url: string) => ({ url }) as unknown);
  return { fetchJson, loadImage, ...overrides } as AssetLoaderHooks & { fetchJson: typeof fetchJson; loadImage: typeof loadImage };
}

describe('resolveUrl', () => {
  it('resolves relative paths against the manifest URL', () => {
    expect(resolveUrl('../sprites/a.png', 'assets/manifest.json')).toBe('sprites/a.png');
    expect(resolveUrl('../../../sprites/a.png', 'assets/levels/level-01/manifest.json')).toBe('sprites/a.png');
    expect(resolveUrl('./levels/l/manifest.json', 'assets/manifest.json')).toBe('assets/levels/l/manifest.json');
  });

  it('passes absolute and remote paths through', () => {
    expect(resolveUrl('/sprites/a.png', 'assets/manifest.json')).toBe('/sprites/a.png');
    expect(resolveUrl('https://cdn.example/a.png', 'assets/manifest.json')).toBe('https://cdn.example/a.png');
    expect(resolveUrl('a.png', 'https://cdn.example/assets/manifest.json')).toBe('https://cdn.example/assets/a.png');
  });
});

describe('AssetRegistry', () => {
  it('loads the top manifest and level manifests', async () => {
    const hooks = makeHooks();
    const reg = new AssetRegistry(hooks);
    const top = await reg.load('assets/manifest.json');
    expect(top.shared['player.sheet'].license).toBe('THIRD_PARTY_RESTRICTED');
    const l1 = await reg.loadLevel('level-01');
    expect(l1.coverage).toBe('AVAILABLE_AND_VERIFIED');
    // second load is cached (no extra fetch)
    await reg.loadLevel('level-01');
    expect(hooks.fetchJson).toHaveBeenCalledTimes(2);
  });

  it('resolves level-local and shared-referenced assets to fetchable URLs', async () => {
    const reg = new AssetRegistry(makeHooks());
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    const local = reg.resolve('level-01', 'background.panorama');
    expect(local.url).toBe('sprites/stage1bg.png');
    const shared = reg.resolve('level-01', 'player.sheet');
    expect(shared.url).toBe('sprites/players.png');
  });

  it('throws AssetNotFoundError for unknown assets and levels', async () => {
    const reg = new AssetRegistry(makeHooks());
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    expect(() => reg.resolve('level-01', 'nope')).toThrow(AssetNotFoundError);
    expect(() => reg.getShared('nope')).toThrow(AssetNotFoundError);
    await expect(reg.loadLevel('level-99')).rejects.toThrow(AssetNotFoundError);
  });

  it('caches images and reports progress', async () => {
    const onProgress = vi.fn();
    const hooks = makeHooks();
    const reg = new AssetRegistry(hooks, { onProgress });
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    const a = await reg.getImage('background.panorama', 'level-01');
    const b = await reg.getImage('background.panorama', 'level-01');
    expect(a).toBe(b);
    expect(hooks.loadImage).toHaveBeenCalledTimes(1);
    expect(reg.loadedCount).toBe(1);
    expect(onProgress).toHaveBeenCalledWith(1, 1, 'background.panorama');
  });

  it('refuses non-publishable assets in publish mode', async () => {
    const reg = new AssetRegistry(makeHooks(), { publishMode: true });
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    await expect(reg.getImage('background.panorama', 'level-01')).rejects.toThrow(AssetLicenseError);
    await expect(reg.getImage('ui.icon')).resolves.toEqual({ url: 'sprites/icon.png' });
  });

  it('reports load failures loudly (no silent placeholder)', async () => {
    const hooks = makeHooks({
      loadImage: vi.fn(async () => { throw new Error('404'); }),
    });
    const reg = new AssetRegistry(hooks);
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    await expect(reg.getImage('background.panorama', 'level-01')).rejects.toThrow(/failed to load asset/);
  });

  it('dispose releases caches so levels do not leak into each other', async () => {
    const hooks = makeHooks();
    const reg = new AssetRegistry(hooks);
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    await reg.getImage('background.panorama', 'level-01');
    expect(reg.loadedCount).toBe(1);
    reg.dispose();
    expect(reg.loadedCount).toBe(0);
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-01');
    await reg.getImage('background.panorama', 'level-01');
    expect(hooks.loadImage).toHaveBeenCalledTimes(2);
  });

  it('lists level gaps from the manifest', async () => {
    const reg = new AssetRegistry(makeHooks());
    await reg.load('assets/manifest.json');
    await reg.loadLevel('level-02');
    expect(reg.listLevelGaps('level-02')).toEqual(['L02-BG-MAP']);
  });
});
