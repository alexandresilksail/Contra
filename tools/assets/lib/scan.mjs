#!/usr/bin/env node
/**
 * Shared library for the asset pipeline in tools/assets/.
 * Pure Node.js, zero dependencies. Never writes into scanned source trees.
 */
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const IMAGE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tga', '.psd', '.svg', '.tif', '.tiff',
]);
export const AUDIO_EXT = new Set([
  '.wav', '.mp3', '.ogg', '.flac', '.aiff', '.aif', '.m4a', '.xm', '.it', '.mod', '.s3m',
]);
export const UNITY_EXT = new Set([
  '.unity', '.prefab', '.asset', '.controller', '.anim', '.overridecontroller',
  '.spriteatlas', '.mat', '.meta', '.asmdef', '.shadergraph', '.physicsmaterial',
]);

export async function walk(dir) {
  const { readdir } = await import('node:fs/promises');
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '__pycache__') continue;
      out.push(...(await walk(p)));
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

export async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const s = createReadStream(file);
    s.on('data', (c) => hash.update(c));
    s.on('error', reject);
    s.on('end', resolve);
  });
  return hash.digest('hex');
}

/** Read just enough bytes to identify an image and its dimensions. */
export function sniffImage(buf, ext) {
  const e = ext.toLowerCase();
  try {
    if (e === '.png') {
      if (buf.length < 33 || buf.toString('binary', 1, 4) !== 'PNG') return null;
      const colorType = buf[25];
      return {
        format: 'PNG',
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        hasAlpha: colorType === 4 || colorType === 6,
        bitDepth: buf[24],
      };
    }
    if (e === '.gif') {
      if (buf.length < 10 || buf.toString('binary', 0, 3) !== 'GIF') return null;
      return { format: 'GIF', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), hasAlpha: true };
    }
    if (e === '.bmp') {
      if (buf.length < 26 || buf.toString('binary', 0, 2) !== 'BM') return null;
      return { format: 'BMP', width: buf.readInt32LE(18), height: buf.readInt32LE(22), hasAlpha: false };
    }
    if (e === '.jpg' || e === '.jpeg') {
      if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { format: 'JPEG', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), hasAlpha: false };
        }
        const len = buf.readUInt16BE(i + 2);
        i += 2 + len;
      }
      return { format: 'JPEG', width: null, height: null, hasAlpha: false };
    }
    if (e === '.webp') {
      if (buf.length < 30 || buf.toString('binary', 0, 4) !== 'RIFF' || buf.toString('binary', 8, 12) !== 'WEBP') return null;
      const fmt = buf.toString('binary', 12, 16);
      if (fmt === 'VP8 ') return { format: 'WEBP', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, hasAlpha: false };
      if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { format: 'WEBP', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, hasAlpha: true };
      }
      if (fmt === 'VP8X') return { format: 'WEBP', width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1, hasAlpha: (buf[20] & 0x10) !== 0 };
      return { format: 'WEBP', width: null, height: null, hasAlpha: null };
    }
    if (e === '.tga') {
      if (buf.length < 18) return null;
      return { format: 'TGA', width: buf.readUInt16LE(12), height: buf.readUInt16LE(14), hasAlpha: (buf[16] === 32) };
    }
    if (e === '.psd') {
      if (buf.length < 22 || buf.toString('binary', 0, 4) !== '8BPS') return null;
      return { format: 'PSD', width: buf.readUInt32BE(18), height: buf.readUInt32BE(14), hasAlpha: true };
    }
    if (e === '.svg') {
      const text = buf.toString('utf8', 0, Math.min(buf.length, 4096));
      const w = /<svg[^>]*?\bwidth="([\d.]+)/.exec(text);
      const h = /<svg[^>]*?\bheight="([\d.]+)/.exec(text);
      const vb = /viewBox="([\d.\s-]+)"/.exec(text);
      return {
        format: 'SVG',
        width: w ? Math.round(parseFloat(w[1])) : vb ? Math.round(parseFloat(vb[1].split(/\s+/)[2])) : null,
        height: h ? Math.round(parseFloat(h[1])) : vb ? Math.round(parseFloat(vb[1].split(/\s+/)[3])) : null,
        hasAlpha: true,
      };
    }
    if (e === '.tif' || e === '.tiff') {
      const le = buf.toString('binary', 0, 2) === 'II';
      const w = le ? buf.readUInt32LE(18) : buf.readUInt32BE(18);
      const h = le ? buf.readUInt32LE(22) : buf.readUInt32BE(22);
      return { format: 'TIFF', width: w, height: h, hasAlpha: null };
    }
  } catch {
    return null;
  }
  return null;
}

export function categorize(relPath, ext) {
  const p = relPath.replace(/\\/g, '/').toLowerCase();
  const e = ext.toLowerCase();
  if (AUDIO_EXT.has(e)) {
    if (/bgm|music|soundtrack|\/music\b/.test(p)) return 'audio/music';
    return 'audio/sfx';
  }
  if (IMAGE_EXT.has(e)) {
    if (/sprite|atlas|sheet|frames?|anim/.test(p)) return 'image/spritesheet';
    if (/tile/.test(p)) return 'image/tileset';
    if (/background|backdrop|bg|parallax|sky|jungle|forest/.test(p)) return 'image/background';
    if (/boss|enemy|soldier|turret|fly|flying/.test(p)) return 'image/enemy';
    if (/player|bill|character|hero/.test(p)) return 'image/player';
    if (/ui|hud|icon|font|title|logo/.test(p)) return 'image/ui';
    if (/bullet|ammo|weapon|gun|powerup|pickup/.test(p)) return 'image/weapon';
    if (/effect|fx|boom|explo|particle/.test(p)) return 'image/effect';
    return 'image/other';
  }
  if (e === '.unity') return 'unity/scene';
  if (e === '.prefab') return 'unity/prefab';
  if (e === '.controller' || e === '.anim' || e === '.overridecontroller') return 'unity/animation';
  if (e === '.asset') return 'unity/scriptableobject';
  if (e === '.mat') return 'unity/material';
  if (e === '.spriteatlas') return 'unity/spriteatlas';
  if (e === '.meta') return 'unity/meta';
  if (e === '.cs') return 'code/csharp';
  if (e === '.ttf' || e === '.otf' || e === '.fnt') return 'font';
  if (e === '.json' || e === '.yaml' || e === '.yml' || e === '.txt' || e === '.md') return 'doc/config';
  if (e === '.dll' || e === '.so' || e === '.a') return 'binary/plugin';
  return 'other';
}

/**
 * Scan one root directory. Returns { root, repo, files: [...] }.
 * `repo` is a short label used in the inventory.
 */
export async function scanRoot(root, repo, { skipDirs = [] } = {}) {
  const files = await walk(root);
  const out = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (skipDirs.some((d) => rel === d || rel.startsWith(d + '/'))) continue;
    const ext = path.extname(abs);
    let st;
    try { st = await stat(abs); } catch { continue; }
    const entry = {
      repo,
      relPath: rel,
      bytes: st.size,
      ext: ext.toLowerCase(),
      category: categorize(rel, ext),
      sha256: null,
      format: null,
      width: null,
      height: null,
      hasAlpha: null,
    };
    if (IMAGE_EXT.has(ext.toLowerCase())) {
      const info = await readImageInfo(abs, ext);
      Object.assign(entry, info);
    }
    entry.sha256 = await sha256File(abs);
    out.push(entry);
  }
  return { repo, root, fileCount: out.length, files: out };
}

export async function readImageInfo(abs, ext) {
  const { open } = await import('node:fs/promises');
  const fh = await open(abs, 'r');
  try {
    // JPEG SOF markers can sit behind large EXIF/ICC segments — read a big window
    const need = ext.toLowerCase() === '.psd' ? 64 : ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg' ? 1 << 20 : 4096;
    const buf = Buffer.alloc(need);
    await fh.read(buf, 0, need, 0);
    const info = sniffImage(buf, ext);
    if (!info) return { format: ext.replace('.', '').toUpperCase(), width: null, height: null, hasAlpha: null };
    return { format: info.format, width: info.width, height: info.height, hasAlpha: info.hasAlpha };
  } catch {
    return { format: ext.replace('.', '').toUpperCase(), width: null, height: null, hasAlpha: null };
  } finally {
    await fh.close();
  }
}

export function summarize(files) {
  const byCategory = {};
  const byFormat = {};
  let bytes = 0;
  for (const f of files) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    const fmt = f.format || f.ext.replace('.', '') || 'none';
    byFormat[fmt] = (byFormat[fmt] || 0) + 1;
    bytes += f.bytes;
  }
  return { fileCount: files.length, bytes, byCategory, byFormat };
}
