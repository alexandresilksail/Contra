#!/usr/bin/env node
/**
 * parse-unity-assets — resolve a Unity project's GUID web.
 *
 * For every *.meta file: read its `guid:` (the asset's own GUID).
 * For every .unity / .prefab / .asset / .anim / .controller file: collect all
 * referenced GUIDs (m_Script, m_PrefabAsset, texture refs, ...).
 * Report references whose GUID cannot be resolved to a local asset, excluding
 * Unity built-in resources (all-zero GUIDs with a single non-zero nibble).
 *
 * Also extracts TextureImporter sprite-slice metadata (spriteRect /
 * internalIDToNameTable) so extract-sprites can cut atlas frames without the
 * Unity Editor.
 *
 * Usage:
 *   node tools/assets/parse-unity-assets.mjs --root <unity-project> [--out refs.json]
 *
 * Read-only. Idempotent.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { walk } from './lib/scan.mjs';

const BUILTIN_GUID = /^0{16}[0-9a-f]0{15}$|^0{32}$/;

function parseArgs(argv) {
  const args = { root: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root') args.root = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (!args.root) throw new Error('--root is required');
  return args;
}

const args = parseArgs(process.argv);
const root = path.resolve(args.root);
const files = await walk(root);

/** guid -> asset path (relative to root, without .meta) */
const guidMap = new Map();
/** asset path (no .meta) -> its own guid */
const selfGuid = new Map();
/** texture asset -> sprite slice info */
const slices = new Map();

const guidRe = /^guid:\s*([0-9a-f]{32})\s*$/m;

for (const abs of files) {
  if (!abs.toLowerCase().endsWith('.meta')) continue;
  const assetPath = path.relative(root, abs).replace(/\\/g, '/').replace(/\.meta$/, '');
  let text;
  try { text = readFileSync(abs, 'utf8'); } catch { continue; }
  const m = guidRe.exec(text);
  if (!m) continue;
  guidMap.set(m[1], assetPath);
  selfGuid.set(assetPath, m[1]);

  // TextureImporter sprite slicing (Unity 2020+ `spriteSheet: sprites:` list)
  if (/^TextureImporter:/m.test(text)) {
    const spriteMode = /spriteMode:\s*(\d+)/.exec(text);
    const info = { guid: m[1], spriteMode: spriteMode ? Number(spriteMode[1]) : null, frames: [] };
    const sheetRe = /spriteSheet:\s*\n\s*serializedVersion:[^\n]*\n\s*sprites:\s*\n([\s\S]*?)(?=\n\s*spritePackingTag:)/;
    const sheet = sheetRe.exec(text);
    if (sheet) {
      const entryRe = /-\s*serializedVersion:[^\n]*\n\s*name:\s*(.+?)\s*\n\s*rect:\s*\n\s*serializedVersion:[^\n]*\n\s*x:\s*([\d.-]+)\s*\n\s*y:\s*([\d.-]+)\s*\n\s*width:\s*([\d.]+)\s*\n\s*height:\s*([\d.]+)/g;
      let em;
      while ((em = entryRe.exec(sheet[1]))) {
        info.frames.push({
          name: em[1].trim(),
          x: Number(em[2]),
          y: Number(em[3]),
          width: Number(em[4]),
          height: Number(em[5]),
        });
      }
    }
    if (info.frames.length || info.spriteMode !== null) slices.set(assetPath, info);
  }
}

/** guid references inside scene/prefab/asset files */
const REF_FILE_EXT = /\.(unity|prefab|asset|anim|controller|overridecontroller|spriteatlas)$/i;
const references = [];
const guidAllRe = /guid:\s*([0-9a-f]{32})/g;
const scriptGuidRe = /m_Script:\s*\{[^}]*guid:\s*([0-9a-f]{32})/g;

for (const abs of files) {
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  if (!REF_FILE_EXT.test(rel)) continue;
  if (rel.endsWith('.meta')) continue;
  let text;
  try { text = readFileSync(abs, 'utf8'); } catch { continue; }
  const seen = new Map();
  let m;
  while ((m = guidAllRe.exec(text))) {
    const g = m[1];
    if (BUILTIN_GUID.test(g)) continue;
    seen.set(g, (seen.get(g) || 0) + 1);
  }
  const scripts = new Set();
  while ((m = scriptGuidRe.exec(text))) scripts.add(m[1]);
  for (const [g, count] of seen) {
    references.push({
      from: rel,
      guid: g,
      count,
      isScriptRef: scripts.has(g),
      resolved: guidMap.has(g) ? guidMap.get(g) : null,
    });
  }
}

const missing = references.filter((r) => !r.resolved);
const payload = {
  generatedBy: 'tools/assets/parse-unity-assets.mjs',
  generatedAt: new Date().toISOString(),
  root,
  stats: {
    metaFiles: selfGuid.size,
    refFiles: new Set(references.map((r) => r.from)).size,
    references: references.length,
    missingReferences: missing.length,
    slicedTextures: slices.size,
  },
  missing,
  slicedTextures: [...slices.entries()].map(([p, info]) => ({ path: p, ...info })),
  guidMap: Object.fromEntries(guidMap),
};

const out = args.out ? path.resolve(args.out) : path.resolve('tools/assets/out/unity-refs.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, 2));
process.stderr.write(
  `wrote ${out}: ${payload.stats.metaFiles} meta, ${payload.stats.references} refs, ` +
  `${payload.stats.missingReferences} missing, ${payload.stats.slicedTextures} sliced textures\n`
);
for (const m of missing.slice(0, 20)) {
  process.stderr.write(`  MISSING ${m.guid} <- ${m.from}${m.isScriptRef ? ' (script)' : ''}\n`);
}
