#!/usr/bin/env node
/**
 * convert-assets — lossless-ish format conversion / normalisation for the
 * asset pipeline (e.g. PNG -> WebP for size, optional NEAREST downscale for
 * pixel art). Delegates pixel work to lib/imgtool.py (Pillow).
 *
 * Usage:
 *   node tools/assets/convert-assets.mjs --scan <scan.json> --out <dir> \
 *        [--category image/spritesheet] [--format webp|png] [--max-side N] [--limit N]
 *
 * Idempotent: output filename is derived from source hash; a sidecar
 * .convert-cache.json records source sha -> output file so re-runs skip work.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY = process.env.ASSET_PYTHON ||
  'C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe';

function parseArgs(argv) {
  const args = { scan: null, out: null, category: null, format: 'webp', maxSide: 0, limit: 0, root: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--scan') args.scan = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--category') args.category = argv[++i];
    else if (argv[i] === '--format') args.format = argv[++i];
    else if (argv[i] === '--max-side') args.maxSide = Number(argv[++i]);
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    else if (argv[i] === '--root') args.root = argv[++i];
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (!args.scan || !args.out) throw new Error('--scan and --out are required');
  return args;
}

const args = parseArgs(process.argv);
const scan = JSON.parse(readFileSync(path.resolve(args.scan), 'utf8'));
const outRoot = path.resolve(args.out);
mkdirSync(outRoot, { recursive: true });

const cacheFile = path.join(outRoot, '.convert-cache.json');
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};

let candidates = scan.files.filter((f) => f.category.startsWith('image/'));
if (args.category) candidates = candidates.filter((f) => f.category === args.category);
if (args.limit) candidates = candidates.slice(0, args.limit);

const results = [];
for (const f of candidates) {
  if (!f.width || !f.height) continue; // not a decodable raster image
  const key = `${f.repo}:${f.relPath}`;
  const rootEntry = scan.roots.find((r) => r.repo === f.repo);
  const src = path.join(rootEntry.root, f.relPath);
  if (!existsSync(src)) continue;
  const cacheKey = `${f.sha256}:${args.format}:${args.maxSide}`;
  if (cache[key] && cache[key].key === cacheKey && existsSync(path.join(outRoot, cache[key].out))) {
    results.push({ ...f, out: cache[key].out, cached: true });
    continue;
  }
  const base = path.basename(f.relPath).replace(/\.[^.]+$/, '');
  const out = `${f.repo}__${base}.${args.format}`;
  const outPath = path.join(outRoot, out);
  try {
    execFileSync(PY, [
      path.join(HERE, 'lib', 'imgtool.py'), 'convert',
      '--src', src, '--out', outPath,
      ...(args.format ? ['--format', args.format] : []),
      ...(args.maxSide ? ['--max-side', String(args.maxSide)] : []),
      '--resample', 'nearest',
    ], { stdio: 'pipe' });
    cache[key] = { key: cacheKey, out };
    results.push({ ...f, out, cached: false });
  } catch (err) {
    results.push({ ...f, out: null, error: String(err).slice(0, 200) });
  }
}

writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
writeFileSync(path.join(outRoot, 'convert-report.json'), JSON.stringify({ results }, null, 2));
const ok = results.filter((r) => r.out).length;
process.stderr.write(`convert-assets: ${ok}/${results.length} converted -> ${outRoot}\n`);
