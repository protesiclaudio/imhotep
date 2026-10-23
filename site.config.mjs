// Configurazione del sito: è l'unico file da modificare prima del deploy.
// SITE_URL e BASE_PATH si possono anche passare come variabili d'ambiente.
export const siteConfig = {
  // URL pubblico del sito, senza slash finale (serve per sitemap e Open Graph).
  siteUrl: process.env.SITE_URL ?? 'https://example.github.io',
  // Sottocartella di pubblicazione: '/' per Netlify, Vercel o dominio proprio,
  // '/nome-repo' per GitHub Pages di progetto.
  base: process.env.BASE_PATH ?? '/',
  // Repository GitHub usato dalla pagina "Proponi uno strumento" (utente/nome-repo).
  githubRepo: 'UTENTE/atlante-strumenti',
};
