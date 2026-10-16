#!/usr/bin/env node
/**
 * generate-contact-sheets — build internal-review contact sheets from an
 * extraction manifest (NOT a substitute for the source files).
 *
 * Usage:
 *   node tools/assets/generate-contact-sheets.mjs --extraction <dir-with-extraction-manifest.json> \
 *        --out <dir> [--cell 96] [--cols 10]
 *
 * Idempotent (deterministic output per input).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY = process.env.ASSET_PYTHON ||
  'C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe';

function parseArgs(argv) {
  const args = { extraction: null, out: null, cell: 96, cols: 10 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--extraction') args.extraction = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--cell') args.cell = Number(argv[++i]);
    else if (argv[i] === '--cols') args.cols = Number(argv[++i]);
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (!args.extraction || !args.out) throw new Error('--extraction and --out are required');
  return args;
}

const args = parseArgs(process.argv);
const extractionDir = path.resolve(args.extraction);
const manifest = JSON.parse(readFileSync(path.join(extractionDir, 'extraction-manifest.json'), 'utf8'));
mkdirSync(path.resolve(args.out), { recursive: true });

for (const atlas of manifest.atlases) {
  if (atlas.status !== 'EXTRACTED') continue;
  const framesJson = path.join(extractionDir, atlas.outDir, 'frames.json');
  if (!existsSync(framesJson)) continue;
  const sheet = path.resolve(args.out, `contact_${atlas.outDir.replace(/[\\/]/g, '_')}.png`);
  try {
    execFileSync(PY, [
      path.join(HERE, 'lib', 'imgtool.py'), 'contact',
      '--out', sheet, '--manifest', framesJson,
      '--cell', String(args.cell), '--cols', String(args.cols),
    ], { stdio: 'pipe' });
  } catch (err) {
    process.stderr.write(`contact sheet failed for ${atlas.path}: ${err}\n`);
  }
}
process.stderr.write(`generate-contact-sheets: done -> ${path.resolve(args.out)}\n`);
