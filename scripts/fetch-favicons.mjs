#!/usr/bin/env node
// Scarica una volta le favicon degli strumenti in public/favicons/<id>.png, così il sito
// non fa richieste esterne durante la navigazione. Tutto (PNG, JPG, ICO, SVG) viene
// convertito in PNG 64×64; le ICO non decodificabili restano .ico solo se piccole.
//
//   npm run fetch-favicons            scarica solo quelle mancanti
//   npm run fetch-favicons -- --force riscarica tutto

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = join(ROOT, 'src', 'data', 'tools');
const OUT = join(ROOT, 'public', 'favicons');
const FORCE = process.argv.includes('--force');
const MAX_BYTES = 200_000;
const CONCURRENCY = 8;
// Pagine ospitate su piattaforme condivise: la favicon sarebbe quella della piattaforma.
const SKIP_HOSTS = ['github.com', 'gitlab.com', 'sourceforge.net'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

mkdirSync(OUT, { recursive: true });
const tools = readdirSync(TOOLS_DIR).flatMap((f) => JSON.parse(readFileSync(join(TOOLS_DIR, f), 'utf8')));
const hasIcon = (id) => existsSync(join(OUT, `${id}.png`));

async function get(url, accept) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, accept } });
  } finally {
    clearTimeout(timer);
  }
}

/** Trova i candidati favicon dichiarati nella pagina, dal più adatto al meno adatto. */
async function candidates(pageUrl) {
  const list = [];
  try {
    const res = await get(pageUrl, 'text/html');
    if (res.ok) {
      const html = (await res.text()).slice(0, 300_000);
      const base = res.url || pageUrl;
      for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
        const rel = tag.match(/rel=["']?([^"'>]+)/i)?.[1]?.toLowerCase() ?? '';
        const href = tag.match(/href=["']?([^"'\s>]+)/i)?.[1];
        if (!href || !/(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) continue;
        const size = Number(tag.match(/sizes=["']?(\d+)/i)?.[1] ?? 0);
        const score = (/\.svg(\?|$)/i.test(href) ? 3 : 0) + (size >= 32 && size <= 192 ? 2 : size > 192 ? 1 : 0) + (rel.includes('apple') ? 1 : 0);
        try {
          list.push({ url: new URL(href.replace(/&amp;/g, '&'), base).href, score });
        } catch {}
      }
    }
  } catch {}
  list.sort((a, b) => b.score - a.score);
  list.push({ url: new URL('/favicon.ico', pageUrl).href, score: -1 });
  return list.map((c) => c.url);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const resize64 = (input) =>
  sharp(input).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();

/** Estrae l'immagine migliore da un file ICO (voci PNG o bitmap a 32 bit). */
async function icoToPng(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const entries = Array.from({ length: buf.readUInt16LE(4) }, (_, i) => {
    const o = 6 + i * 16;
    return { w: buf[o] || 256, size: buf.readUInt32LE(o + 8), offset: buf.readUInt32LE(o + 12) };
  }).sort((a, b) => Math.abs(a.w - 64) - Math.abs(b.w - 64));
  for (const e of entries) {
    const data = buf.subarray(e.offset, e.offset + e.size);
    if (data.subarray(0, 4).equals(PNG_SIG)) return resize64(data);
    // DIB: BITMAPINFOHEADER, altezza doppia (immagine + maschera), righe dal basso
    const w = data.readInt32LE(4);
    const h = data.readInt32LE(8) / 2;
    if (data.readUInt16LE(14) !== 32 || w <= 0 || h <= 0) continue;
    const start = data.readUInt32LE(0);
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = start + ((h - 1 - y) * w + x) * 4;
        const d = (y * w + x) * 4;
        rgba[d] = data[s + 2];
        rgba[d + 1] = data[s + 1];
        rgba[d + 2] = data[s];
        rgba[d + 3] = data[s + 3];
      }
    }
    return resize64(await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer());
  }
  return null;
}

/** Converte qualsiasi favicon in PNG 64×64; restituisce null se non è un'immagine leggibile. */
async function normalize(buf) {
  const head = buf.subarray(0, 200).toString();
  if (/^\s*(<\?xml[\s\S]*?)?<svg/i.test(head) || /<svg/i.test(head)) return resize64(buf);
  if (buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) return icoToPng(buf);
  return resize64(buf);
}

async function save(tool, url) {
  if (url.startsWith('data:')) return false;
  const res = await get(url, 'image/*');
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) return false;
  try {
    const png = await normalize(buf);
    if (png) {
      writeFileSync(join(OUT, `${tool.id}.png`), png);
      return true;
    }
  } catch {}
  return false;
}

// Converte in PNG le favicon salvate da versioni precedenti dello script (.ico, .svg).
if (process.argv.includes('--normalize')) {
  for (const f of readdirSync(OUT).filter((x) => /\.(ico|svg)$/.test(x))) {
    const id = f.replace(/\.(ico|svg)$/, '');
    try {
      const png = await normalize(readFileSync(join(OUT, f)));
      if (png) writeFileSync(join(OUT, `${id}.png`), png);
    } catch {}
    unlinkSync(join(OUT, f));
  }
  console.log('Favicon convertite in PNG.');
  process.exit(0);
}

const queue = tools.filter((t) => FORCE || !hasIcon(t.id));
let ok = 0;
let next = 0;
const failed = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      const tool = queue[next++];
      const host = new URL(tool.url).hostname.replace(/^www\./, '');
      if (SKIP_HOSTS.includes(host)) continue;
      let done = false;
      for (const url of await candidates(tool.url)) {
        try {
          if (await save(tool, url)) {
            done = true;
            break;
          }
        } catch {}
      }
      if (done) ok++;
      else failed.push(tool.id);
    }
  }),
);
console.log(`Favicon salvate: ${ok}/${queue.length}. Senza favicon (useranno il monogramma): ${failed.length}`);
if (failed.length) console.log(failed.join(', '));
