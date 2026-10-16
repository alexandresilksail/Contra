#!/usr/bin/env node
/**
 * validate-assets — integrity checks over a scan (+ optional unity refs and
 * runtime manifests).
 *
 * Checks:
 *   E1 zero-byte / unreadable files
 *   E2 image with null/zero dimensions
 *   E3 dimension anomalies (> 8192 px)
 *   E4 duplicate content (same SHA-256 at different paths)
 *   E5 unresolved Unity GUID references
 *   E6 runtime manifest entries whose file is missing on disk
 *   E7 manifest entries that are neither publishable nor explicitly local-only
 *
 * Usage:
 *   node tools/assets/validate-assets.mjs --scan <scan.json> [--refs <refs.json>] \
 *        [--manifest <manifest.json> --manifest-root <dir>] [--out report.json]
 *
 * Exit code 1 when errors are found. Idempotent.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { scan: null, refs: null, manifest: null, manifestRoot: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--scan') args.scan = argv[++i];
    else if (argv[i] === '--refs') args.refs = argv[++i];
    else if (argv[i] === '--manifest') args.manifest = argv[++i];
    else if (argv[i] === '--manifest-root') args.manifestRoot = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (!args.scan) throw new Error('--scan is required');
  return args;
}

const args = parseArgs(process.argv);
const scan = JSON.parse(readFileSync(path.resolve(args.scan), 'utf8'));
const errors = [];
const warnings = [];

for (const f of scan.files) {
  const id = `${f.repo}:${f.relPath}`;
  if (f.bytes === 0) errors.push({ code: 'E1', id, detail: 'zero-byte file' });
  if (f.category.startsWith('image/') && f.format !== 'SVG') {
    if (f.width === null || f.height === null) {
      errors.push({ code: 'E2', id, detail: `undecodable image (${f.format})` });
    } else if (f.width === 0 || f.height === 0) {
      errors.push({ code: 'E2', id, detail: 'zero dimension' });
    } else if (f.width > 8192 || f.height > 8192) {
      warnings.push({ code: 'E3', id, detail: `unusual dimension ${f.width}x${f.height}` });
    }
  }
}

const byHash = new Map();
for (const f of scan.files) {
  if (!f.sha256) continue;
  if (!byHash.has(f.sha256)) byHash.set(f.sha256, []);
  byHash.get(f.sha256).push(`${f.repo}:${f.relPath}`);
}
for (const [hash, paths] of byHash) {
  if (paths.length > 1) warnings.push({ code: 'E4', hash: hash.slice(0, 12), detail: paths.join(' | ') });
}

if (args.refs) {
  const refs = JSON.parse(readFileSync(path.resolve(args.refs), 'utf8'));
  for (const m of refs.missing || []) {
    errors.push({ code: 'E5', id: `${m.from} -> ${m.guid}`, detail: m.isScriptRef ? 'missing script reference' : 'missing asset reference' });
  }
}

if (args.manifest) {
  const manifest = JSON.parse(readFileSync(path.resolve(args.manifest), 'utf8'));
  const root = args.manifestRoot ? path.resolve(args.manifestRoot) : path.dirname(path.resolve(args.manifest));
  const checkEntry = (id, e) => {
    const file = path.resolve(root, e.file);
    if (!existsSync(file)) {
      errors.push({ code: 'E6', id, detail: `manifest file missing: ${e.file}` });
      return;
    }
    if (e.publishable !== true && e.license !== 'LICENSE_VERIFIED' && e.license !== 'APPROVED_FOR_PROJECT') {
      warnings.push({ code: 'E7', id, detail: `not publishable (license=${e.license}, status=${e.status})` });
    }
  };
  for (const [id, e] of Object.entries(manifest.shared || {})) checkEntry(id, e);
  for (const [lvl, def] of Object.entries(manifest.levels || {})) {
    for (const [id, e] of Object.entries(def.assets || {})) checkEntry(`${lvl}/${id}`, e);
  }
}

const report = { generatedBy: 'tools/assets/validate-assets.mjs', generatedAt: new Date().toISOString(), errors, warnings };
const out = args.out ? path.resolve(args.out) : path.resolve('tools/assets/out/validation.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
process.stderr.write(`validate-assets: ${errors.length} errors, ${warnings.length} warnings -> ${out}\n`);
for (const e of errors.slice(0, 30)) process.stderr.write(`  ERROR ${e.code} ${e.id} — ${e.detail}\n`);
if (errors.length) process.exit(1);
