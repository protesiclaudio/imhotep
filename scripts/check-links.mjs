#!/usr/bin/env node
// Controlla tutti gli URL del catalogo (campi "url" e "source") e segnala quelli rotti.
//
//   npm run check-links                     tutto il catalogo
//   npm run check-links -- --input file.json   un file specifico (array di strumenti)
//   npm run check-links -- --only gis       una sola categoria
//
// Esito: OK (2xx), REDIRECT (dominio cambiato), BLOCCATO (403/429/503 tipici dei
// sistemi anti-bot: da verificare a mano nel browser), ROTTO (404, 5xx, DNS, timeout).
// Il report completo viene salvato in reports/links-AAAA-MM-GG.json.
// Il comando termina con codice 1 se c'è almeno un link ROTTO.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = join(ROOT, 'src', 'data', 'tools');
const TIMEOUT_MS = 25_000;
const CONCURRENCY = 8;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadTools() {
  const input = argValue('--input');
  if (input) return JSON.parse(readFileSync(input, 'utf8'));
  const only = argValue('--only');
  return readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.json') && (!only || f === `${only}.json`))
    .flatMap((f) => JSON.parse(readFileSync(join(TOOLS_DIR, f), 'utf8')));
}

const hostOf = (u) => new URL(u).hostname.replace(/^www\./, '');
const exceptions = JSON.parse(readFileSync(join(ROOT, 'scripts', 'link-exceptions.json'), 'utf8')).hosts;
const isException = (u) => Object.keys(exceptions).some((h) => hostOf(u) === h.replace(/^www\./, ''));

async function check(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'it,en;q=0.8' },
    });
    const body = res.headers.get('content-type')?.includes('html') ? (await res.text()).slice(0, 200_000) : '';
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ') ?? '';
    const finalUrl = res.url || url;
    let status;
    if (res.ok) status = hostOf(finalUrl) === hostOf(url) ? 'OK' : isException(url) ? 'BLOCCATO' : 'REDIRECT';
    else if ([401, 403, 405, 429, 503].includes(res.status) || isException(url)) status = 'BLOCCATO';
    else status = 'ROTTO';
    return { status, code: res.status, finalUrl, title };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : (err.cause?.code ?? err.message);
    // Catene di certificati incomplete: i browser le completano da soli, Node no.
    const tls = /CERT|SIGNATURE|TLS|SSL/i.test(reason);
    const status = tls || isException(url) ? 'BLOCCATO' : 'ROTTO';
    return { status, code: 0, finalUrl: url, title: '', error: reason };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const tools = loadTools();
  const jobs = tools.flatMap((t) => [
    { id: t.id, field: 'url', url: t.url },
    ...(t.source ? [{ id: t.id, field: 'source', url: t.source }] : []),
  ]);
  console.log(`Controllo ${jobs.length} URL di ${tools.length} strumenti…\n`);

  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const r = { ...job, ...(await check(job.url)) };
        results.push(r);
        const extra = r.status === 'REDIRECT' ? ` → ${r.finalUrl}` : r.error ? ` (${r.error})` : '';
        console.log(`${r.status.padEnd(9)} ${String(r.code).padEnd(4)} ${r.id} [${r.field}] ${r.url}${extra}  «${r.title.slice(0, 70)}»`);
      }
    }),
  );

  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nOK ${count('OK')} · REDIRECT ${count('REDIRECT')} · BLOCCATO ${count('BLOCCATO')} · ROTTO ${count('ROTTO')}`);
  for (const r of results.filter((x) => x.status === 'ROTTO')) {
    console.log(`  ✗ ${r.id} [${r.field}] ${r.url} — ${r.error ?? `HTTP ${r.code}`}`);
  }

  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  const out = join(ROOT, 'reports', `links-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${out}`);
  if (count('ROTTO') > 0) process.exitCode = 1;
}

main();
