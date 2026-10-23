import { getCollection } from 'astro:content';
import categoriesJson from '../data/categories.json';
import type { Lang } from '../i18n/ui';

export type Category = (typeof categoriesJson)[number];
export const categories: Category[] = categoriesJson;

export async function getTools() {
  const entries = await getCollection('tools');
  return entries.map((e) => e.data).sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
export type Tool = Awaited<ReturnType<typeof getTools>>[number];

export const isItalian = (t: Tool) => t.region === 'italia' || t.tags.includes('Italia');

export const categoryName = (c: Category, lang: Lang) => (lang === 'it' ? c.name_it : c.name_en);
export const categoryDescription = (c: Category, lang: Lang) => (lang === 'it' ? c.description_it : c.description_en);
export const toolDescription = (t: Tool, lang: Lang) => (lang === 'it' ? t.description_it : t.description_en);

export function categoryById(id: string) {
  const c = categories.find((x) => x.id === id);
  if (!c) throw new Error(`Categoria sconosciuta: ${id}`);
  return c;
}

/** Data dell'ultima verifica più recente del catalogo. */
export const lastVerified = (tools: Tool[]) => tools.reduce((d, t) => (t.verified > d ? t.verified : d), '');

/** Formati presenti in almeno `min` strumenti, ordinati per frequenza. */
export function commonFormats(tools: Tool[], min = 3) {
  const counts = new Map<string, number>();
  for (const t of tools) for (const f of t.formats) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([f]) => f);
}

/** Dati compatti passati al client per ricerca e filtri (descrizione e categoria si leggono dalle card). */
export function clientIndex(tools: Tool[]) {
  return tools.map((t) => ({
    id: t.id,
    n: t.name,
    c: t.category,
    t: t.tags,
    l: t.license,
    p: t.platform,
    f: t.formats,
    it: isItalian(t) ? 1 : 0,
    a: t.added,
  }));
}
