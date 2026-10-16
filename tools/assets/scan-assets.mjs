#!/usr/bin/env node
/**
 * scan-assets — recursively scan one or more asset roots and emit a JSON
 * inventory (path, format, dimensions, size, SHA-256, category).
 *
 * Usage:
 *   node tools/assets/scan-assets.mjs --label myrepo --root <dir> [--root <dir2>] [--out file.json]
 *
 * Read-only with respect to scanned trees. Idempotent: output is overwritten
 * with identical content for identical inputs.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { scanRoot, summarize } from './lib/scan.mjs';

function parseArgs(argv) {
  const args = { roots: [], labels: [], out: null, skip: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.roots.push(argv[++i]);
    else if (a === '--label') args.labels.push(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--skip') args.skip.push(argv[++i]);
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!args.roots.length) throw new Error('at least one --root is required');
  return args;
}

const args = parseArgs(process.argv);
const results = [];
for (let i = 0; i < args.roots.length; i++) {
  const root = path.resolve(args.roots[i]);
  const label = args.labels[i] || path.basename(root);
  process.stderr.write(`scanning ${label} (${root}) ...\n`);
  results.push(await scanRoot(root, label, { skipDirs: args.skip }));
}

const allFiles = results.flatMap((r) => r.files);
const payload = {
  generatedBy: 'tools/assets/scan-assets.mjs',
  generatedAt: new Date().toISOString(),
  roots: results.map((r) => ({ repo: r.repo, root: r.root, fileCount: r.fileCount })),
  summary: summarize(allFiles),
  files: allFiles,
};

const out = args.out
  ? path.resolve(args.out)
  : path.resolve('tools/assets/out/scan.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, 2));
process.stderr.write(`wrote ${out} (${allFiles.length} files, ${payload.summary.bytes} bytes)\n`);
