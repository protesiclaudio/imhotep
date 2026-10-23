import { defineCollection, z } from 'astro:content';
import { readdirSync, readFileSync } from 'node:fs';
import categories from './data/categories.json';

const TOOLS_DIR = new URL('./data/tools/', import.meta.url);
const categoryIds = categories.map((c) => c.id) as [string, ...string[]];
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data in formato AAAA-MM-GG');

// Ogni file in src/data/tools/ è un array JSON di strumenti della stessa categoria.
const tools = defineCollection({
  loader: async () =>
    readdirSync(TOOLS_DIR)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(new URL(f, TOOLS_DIR), 'utf8'))),
  schema: z
    .object({
      id: z.string().regex(/^[a-z0-9-]+$/, 'id: solo minuscole, numeri e trattini'),
      name: z.string().min(1),
      url: z.url(),
      // Repository del codice sorgente (facoltativo, consigliato per gli open source).
      source: z.url().optional(),
      description_it: z.string().min(10).max(220),
      description_en: z.string().min(10).max(220),
      category: z.enum(categoryIds),
      tags: z.array(z.string()).default([]),
      license: z.enum(['open-source', 'gratuito', 'freemium']),
      platform: z.array(z.enum(['web', 'desktop', 'mobile', 'plugin', 'libreria'])).min(1),
      formats: z.array(z.string()).default([]),
      region: z.string().default('globale'),
      verified: isoDate,
      added: isoDate,
    })
    .refine((t) => t.region !== 'italia' || t.tags.includes('Italia'), {
      message: 'Le risorse con region "italia" devono avere il tag "Italia"',
    }),
});

export const collections = { tools };
