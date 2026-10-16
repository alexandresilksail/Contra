#!/usr/bin/env node
/**
 * build-asset-manifest — turn tools/assets/asset-map.json into the runtime
 * manifests under public/assets/ (top-level + per-level), verifying every
 * referenced file against a scan of the real asset tree.
 *
 * Usage:
 *   node tools/assets/build-asset-manifest.mjs [--map tools/assets/asset-map.json] \
 *        [--scan tools/assets/out/scan-current.json] [--out public/assets]
 *
 * The scan must be taken with --root public so relPaths look like
 * "sprites/players.png". Idempotent: identical inputs -> identical outputs.
 * Binary files are never copied; manifests reference them by a path relative
 * to the manifest's own location. Fails loudly when a referenced file is
 * missing from the scan.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { map: 'tools/assets/asset-map.json', scan: 'tools/assets/out/scan-current.json', out: 'public/assets' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--map') args.map = argv[++i];
    else if (argv[i] === '--scan') args.scan = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  return args;
}

const args = parseArgs(process.argv);
const map = JSON.parse(readFileSync(path.resolve(args.map), 'utf8'));
const scan = JSON.parse(readFileSync(path.resolve(args.scan), 'utf8'));
const outRoot = path.resolve(args.out);
const projectRoot = process.cwd();

const scanByRel = new Map();
for (const f of scan.files) scanByRel.set(f.relPath, f);

/** Resolve an asset-map `file` (relative to public/assets/) to a repo-relative
 *  path like "sprites/players.png", verify it exists in the scan, and return
 *  the entry plus a manifest-location-relative path. */
function resolveEntry(fileRef, fromDir) {
  const repoRel = path.normalize(path.join('public/assets', fileRef)).replace(/\\/g, '/').replace(/^public\//, '');
  const entry = scanByRel.get(repoRel);
  if (!entry) {
    throw new Error(`asset-map references ${fileRef} -> ${repoRel} which is NOT in the scan (file missing?)`);
  }
  const relFromManifest = path.relative(fromDir, path.join(projectRoot, 'public', repoRel)).replace(/\\/g, '/');
  return {
    file: relFromManifest,
    bytes: entry.bytes,
    sha256: entry.sha256,
    width: entry.width,
    height: entry.height,
    format: entry.format,
    hasAlpha: entry.hasAlpha,
  };
}

const generatedAt = new Date().toISOString();

// ---- top-level manifest (lives at public/assets/) ----
const shared = {};
for (const [id, e] of Object.entries(map.shared || {})) {
  shared[id] = { ...e, ...resolveEntry(e.file, path.join(projectRoot, 'public/assets')) };
}

const levels = {};
for (const [levelId, def] of Object.entries(map.levels || {})) {
  const levelDir = path.join(projectRoot, 'public/assets/levels', levelId);
  const assets = {};
  for (const [id, e] of Object.entries(def.assets || {})) {
    assets[id] = { ...e, ...resolveEntry(e.file, levelDir) };
  }
  const reuses = (def.reuses || []).map((rid) => {
    if (!shared[rid]) throw new Error(`level ${levelId} reuses unknown shared asset ${rid}`);
    return rid;
  });
  levels[levelId] = {
    title: def.title,
    originalStage: def.originalStage,
    coverage: def.coverage,
    assets,
    reuses,
    gaps: def.gaps || [],
    notes: def.notes || '',
  };
}

mkdirSync(outRoot, { recursive: true });
writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({
  schemaVersion: map.schemaVersion,
  generatedBy: 'tools/assets/build-asset-manifest.mjs',
  generatedAt,
  licensePolicy: map.licensePolicy,
  shared,
  levelIndex: Object.fromEntries(Object.entries(levels).map(([id, l]) => [
    id,
    { title: l.title, coverage: l.coverage, manifest: `./levels/${id}/manifest.json` },
  ])),
}, null, 2) + '\n');

// ---- per-level manifests ----
for (const [levelId, l] of Object.entries(levels)) {
  const dir = path.join(outRoot, 'levels', levelId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schemaVersion: map.schemaVersion,
    generatedBy: 'tools/assets/build-asset-manifest.mjs',
    generatedAt,
    level: levelId,
    title: l.title,
    originalStage: l.originalStage,
    coverage: l.coverage,
    notes: l.notes,
    assets: l.assets,
    sharedRefs: Object.fromEntries(l.reuses.map((rid) => [rid, { manifest: '../../../manifest.json', id: rid }])),
    gaps: l.gaps,
  }, null, 2) + '\n');
}

const nShared = Object.keys(shared).length;
const nLevelAssets = Object.values(levels).reduce((a, l) => a + Object.keys(l.assets).length, 0);
process.stderr.write(`build-asset-manifest: ${nShared} shared + ${nLevelAssets} level assets -> ${outRoot}\n`);
