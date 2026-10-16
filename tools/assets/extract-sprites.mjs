#!/usr/bin/env node
/**
 * extract-sprites — cut sprite frames out of Unity texture atlases using the
 * slice metadata parsed by parse-unity-assets.mjs (no Unity Editor needed).
 *
 * Usage:
 *   node tools/assets/extract-sprites.mjs --unity-root <dir> --refs <unity-refs.json> \
 *        --out <dir> [--only <substring>]
 *
 * Writes <out>/<atlas>/<frame>.png plus <out>/extraction-manifest.json.
 * Idempotent: deterministic filenames, identical inputs -> identical outputs.
 * Pixel work is delegated to tools/assets/lib/imgtool.py (Pillow).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY = process.env.ASSET_PYTHON ||
  'C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe';

function parseArgs(argv) {
  const args = { unityRoot: null, refs: null, out: null, only: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--unity-root') args.unityRoot = argv[++i];
    else if (argv[i] === '--refs') args.refs = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--only') args.only = argv[++i];
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (!args.unityRoot || !args.refs || !args.out) throw new Error('--unity-root, --refs and --out are required');
  return args;
}

const args = parseArgs(process.argv);
const unityRoot = path.resolve(args.unityRoot);
const refs = JSON.parse(readFileSync(path.resolve(args.refs), 'utf8'));
const outRoot = path.resolve(args.out);
mkdirSync(outRoot, { recursive: true });

const manifest = { generatedBy: 'tools/assets/extract-sprites.mjs', generatedAt: new Date().toISOString(), atlases: [] };

for (const tex of refs.slicedTextures || []) {
  if (!tex.frames || !tex.frames.length) continue;
  if (args.only && !tex.path.includes(args.only)) continue;
  const src = path.join(unityRoot, tex.path);
  if (!existsSync(src)) {
    manifest.atlases.push({ path: tex.path, status: 'SOURCE_MISSING', frames: [] });
    continue;
  }
  const atlasName = path.basename(tex.path).replace(/\.[^.]+$/, '');
  const outDir = path.join(outRoot, atlasName);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const framesJson = path.join(outRoot, `.frames-${atlasName}.json`);
  writeFileSync(framesJson, JSON.stringify(tex.frames));
  const outManifest = path.join(outDir, 'frames.json');
  execFileSync(PY, [
    path.join(HERE, 'lib', 'imgtool.py'), 'crop',
    '--src', src, '--frames', framesJson, '--outdir', outDir, '--manifest', outManifest,
  ], { stdio: 'inherit' });
  rmSync(framesJson, { force: true });
  manifest.atlases.push({
    path: tex.path,
    status: 'EXTRACTED',
    frameCount: tex.frames.length,
    outDir: path.relative(outRoot, outDir).replace(/\\/g, '/'),
  });
}

writeFileSync(path.join(outRoot, 'extraction-manifest.json'), JSON.stringify(manifest, null, 2));
process.stderr.write(`extract-sprites: ${manifest.atlases.length} atlases -> ${outRoot}\n`);
