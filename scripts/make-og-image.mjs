#!/usr/bin/env node
// Genera public/og-image.png (1200×630) per le anteprime social. Da rilanciare se cambia il numero di strumenti.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = join(ROOT, 'src', 'data', 'tools');
const count = readdirSync(toolsDir).reduce((n, f) => n + JSON.parse(readFileSync(join(toolsDir, f), 'utf8')).length, 0);
const cats = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'categories.json'), 'utf8')).length;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f6f2"/>
  <g stroke="#d9dad2" stroke-width="1">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${80 + i * 104}" y1="0" x2="${80 + i * 104}" y2="630"/>`).join('')}
  </g>
  <g transform="translate(80 80) scale(2)">
    <path d="M2 28V23H6V18H10V13H22V18H26V23H30V28Z" fill="none" stroke="#1d1f1c" stroke-width="2"/>
    <path d="M1 28H31" stroke="#1d1f1c" stroke-width="2"/>
    <circle cx="25" cy="6.5" r="3.2" fill="#3e6b4f"/>
  </g>
  <text x="80" y="214" font-family="IBM Plex Mono, monospace" font-size="24" letter-spacing="3" fill="#555a52">IMHOTEP · STRUMENTI PER IL PROGETTO</text>
  <text font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-weight="600" font-size="72" fill="#1d1f1c">
    <tspan x="80" y="320">Strumenti liberi per chi</tspan>
    <tspan x="80" y="404">progetta il territorio</tspan>
  </text>
  <rect x="80" y="476" width="1040" height="2" fill="#3e6b4f"/>
  <text x="80" y="540" font-family="IBM Plex Mono, monospace" font-size="26" fill="#1d1f1c">${count} risorse gratuite e open source · ${cats} categorie</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(join(ROOT, 'public', 'og-image.png'));
console.log(`public/og-image.png generata (${count} strumenti)`);
