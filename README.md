# Atlante degli strumenti

Catalogo verificato di strumenti, siti e dati **gratuiti o open source** per chi progetta architettura, città e paesaggio: studenti, architetti, urbanisti, paesaggisti e ingegneri.

- **409 risorse** in 18 categorie, tutte con link verificato e licenza controllata (157 open source, 205 gratuite, 47 freemium)
- **52 risorse italiane**: geoportali regionali, catasto, ISTAT, ISPRA, INGV, normativa, prezzari
- Ricerca istantanea tollerante agli errori (scorciatoia <kbd>/</kbd>), filtri combinabili, preferiti, italiano e inglese, tema chiaro e scuro
- Sito statico senza backend, senza cookie e senza servizi esterni

## Indice

- [Avvio in locale](#avvio-in-locale)
- [Aggiungere o modificare uno strumento](#aggiungere-o-modificare-uno-strumento)
- [Criteri di inclusione](#criteri-di-inclusione)
- [Script di manutenzione](#script-di-manutenzione)
- [Pubblicazione](#pubblicazione)
- [Struttura del progetto](#struttura-del-progetto)
- [Scelte tecniche](#scelte-tecniche)

## Avvio in locale

Serve [Node.js](https://nodejs.org) 22.23 o superiore (consigliato Node 24 LTS, usato per sviluppare il progetto).

```bash
npm install
npm run dev
```

Il sito è su <http://localhost:4321>. Per provare la versione di produzione:

```bash
npm run build
npm run preview
```

`npm run build` genera la cartella `dist/` e **si ferma con un errore** se una voce del catalogo non rispetta lo schema (campo mancante, licenza scritta male, categoria inesistente…).

## Aggiungere o modificare uno strumento

Tutti i dati sono in `src/data/tools/`, **un file JSON per categoria** (es. `gis.json`). Non serve toccare l'interfaccia.

1. Apri il file della categoria giusta e aggiungi un oggetto all'array:

   ```json
   {
     "id": "cadmapper",
     "name": "CADMapper",
     "url": "https://cadmapper.com",
     "description_it": "Genera file CAD del contesto urbano da dati OSM e pubblici. Gratis fino a 1 km².",
     "description_en": "Generates CAD context files from OSM and public data. Free up to 1 km².",
     "category": "mappe-contesto",
     "tags": ["CAD", "OSM", "3D"],
     "license": "freemium",
     "platform": ["web"],
     "formats": ["DXF", "3DM", "SKP"],
     "region": "globale",
     "verified": "2026-10-23",
     "added": "2026-10-23"
   }
   ```

2. Controlla link e build:

   ```bash
   npm run check-links -- --only mappe-contesto
   npm run build
   ```

3. Facoltativo: scarica la favicon del nuovo strumento con `npm run fetch-favicons` (scarica solo quelle mancanti).

### I campi

| Campo | Obbligatorio | Valori |
|---|---|---|
| `id` | sì | univoco, solo minuscole, numeri e trattini |
| `name` | sì | nome ufficiale |
| `url` | sì | pagina ufficiale dello strumento |
| `source` | no | repository del codice (consigliato per gli open source) |
| `description_it`, `description_en` | sì | 10–220 caratteri; indica i limiti del piano gratuito se ce ne sono |
| `category` | sì | uno degli `id` di `src/data/categories.json` |
| `tags` | no | parole chiave libere; usa `Italia` per le risorse italiane e `registrazione` se serve un account |
| `license` | sì | `open-source`, `gratuito` oppure `freemium` |
| `platform` | sì | uno o più tra `web`, `desktop`, `mobile`, `plugin`, `libreria` |
| `formats` | no | formati di output, in maiuscolo (`DXF`, `IFC`, `GeoTIFF`…) |
| `region` | no | `globale` (predefinito), `europa`, `italia`… Con `italia` serve anche il tag `Italia` |
| `verified` | sì | data dell'ultima verifica, `AAAA-MM-GG` |
| `added` | sì | data di inserimento, `AAAA-MM-GG` (ordina la sezione "Aggiunti di recente") |

Le **categorie** (nome IT/EN, descrizione, icona [Lucide](https://lucide.dev)) sono in `src/data/categories.json`. Per aggiungerne una crea anche il file `src/data/tools/<id>.json` e importa la nuova icona in `src/components/Icon.astro`.

### Proposte dagli utenti

La pagina "Proponi uno strumento" apre una issue precompilata su GitHub usando il modulo `.github/ISSUE_TEMPLATE/nuovo-strumento.yml`. Imposta il tuo repository in `site.config.mjs` (`githubRepo: 'utente/nome-repo'`).

## Criteri di inclusione

- **Utile al progetto**: serve in una fase reale del lavoro (analisi, disegno, modellazione, verifica, comunicazione, ricerca).
- **Davvero gratuito**: si usa senza pagare in modo continuativo. Le sole prove a tempo sono escluse.
- **Accessibile a tutti**: sono escluse le licenze gratuite riservate agli studenti e i visualizzatori gratuiti di software a pagamento.
- **Attivo e verificato**: il sito è stato aperto e controllato; i siti morti, irraggiungibili o protetti da CAPTCHA restano fuori.
- **Nessuna invenzione**: se non si riesce a verificare esistenza o licenza, la risorsa non entra.

Significato delle licenze:

- **open-source**: codice pubblico con licenza libera;
- **gratuito**: uso libero e senza costi, anche se non open source (servizi pubblici, dati aperti, freeware; alcuni gratuiti sotto una soglia di fatturato, indicata nella descrizione);
- **freemium**: piano gratuito reale e utilizzabile, con limiti descritti nella scheda.

Le risorse valutate e scartate, con il motivo, sono in [`docs/scartati.md`](docs/scartati.md).

## Script di manutenzione

| Comando | Cosa fa |
|---|---|
| `npm run check-links` | Controlla tutti gli URL (`url` e `source`) e salva il report in `reports/links-AAAA-MM-GG.json`. Esce con errore se c'è almeno un link **ROTTO**. |
| `npm run check-links -- --only gis` | Controlla una sola categoria |
| `npm run check-links -- --input file.json` | Controlla un file di candidati (array di oggetti con `id` e `url`) |
| `npm run fetch-favicons` | Scarica le favicon mancanti in `public/favicons/` (PNG 64×64). `-- --force` le riscarica tutte |
| `npm run og-image` | Rigenera l'immagine per le anteprime social con il numero aggiornato di strumenti |
| `npx astro check` | Controllo dei tipi |

Esiti di `check-links`:

- **OK**: risposta 2xx;
- **REDIRECT**: la pagina risponde ma da un altro dominio, da controllare;
- **BLOCCATO**: il sito rifiuta i programmi automatici (Cloudflare, 403, certificati incompleti): va aperto a mano nel browser;
- **ROTTO**: 404, errori del server, dominio inesistente, timeout.

I siti che bloccano i bot ma sono stati verificati a mano sono elencati in `scripts/link-exceptions.json`.

Conviene lanciare il controllo almeno ogni qualche mese e aggiornare il campo `verified` delle voci ricontrollate.

## Pubblicazione

Il sito è statico: qualsiasi hosting di file va bene. Prima di pubblicare imposta in `site.config.mjs` l'indirizzo del sito e il repository GitHub (servono per sitemap, Open Graph e pagina "Proponi"). `SITE_URL` e `BASE_PATH` si possono passare anche come variabili d'ambiente.

### GitHub Pages

1. Crea un repository su GitHub e carica il progetto:

   ```bash
   git remote add origin https://github.com/UTENTE/atlante-strumenti.git
   git push -u origin main
   ```

2. Su GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Il workflow `.github/workflows/deploy.yml` pubblica il sito a ogni push su `main`, all'indirizzo `https://UTENTE.github.io/atlante-strumenti/`. Imposta da solo `SITE_URL` e `BASE_PATH`; con un dominio personalizzato modifica le due variabili nel workflow (`BASE_PATH: /`).

### Netlify

Collega il repository da [app.netlify.com](https://app.netlify.com): `netlify.toml` contiene già comando di build, cartella `dist` e versione di Node. Aggiorna `SITE_URL` nel file (o nelle variabili del sito) con l'indirizzo definitivo.

### Vercel

Importa il repository da [vercel.com/new](https://vercel.com/new): Astro viene riconosciuto in automatico e `vercel.json` aggiunge le intestazioni di cache. Imposta la variabile d'ambiente `SITE_URL` con l'indirizzo del progetto.

## Struttura del progetto

```
├─ site.config.mjs           URL del sito, percorso base, repository GitHub
├─ astro.config.mjs
├─ src/
│  ├─ content.config.ts      schema di validazione dei dati
│  ├─ data/
│  │  ├─ categories.json     categorie (IT/EN, icona)
│  │  └─ tools/*.json        gli strumenti, un file per categoria
│  ├─ i18n/ui.ts             testi dell'interfaccia e percorsi IT/EN
│  ├─ lib/data.ts            lettura e utilità sui dati
│  ├─ components/            Header, Footer, Catalog, ToolCard, CategoryCard, Icon…
│  ├─ views/                 una vista per pagina, condivisa da IT ed EN
│  ├─ pages/                 rotte: / (IT) e /en/ (EN)
│  ├─ scripts/               ricerca e filtri (catalog.ts), preferiti (favorites.ts)
│  └─ styles/global.css      colori, tipografia, componenti
├─ public/                   favicon, immagine Open Graph, favicon degli strumenti
├─ scripts/                  check-links, fetch-favicons, make-og-image
├─ docs/scartati.md          risorse escluse e motivi
└─ .github/                  workflow di deploy e modulo per le proposte
```

### URL

| Pagina | Italiano | English |
|---|---|---|
| Home | `/` | `/en/` |
| Catalogo | `/strumenti/` | `/en/tools/` |
| Categoria | `/categoria/<id>/` | `/en/category/<id>/` |
| Preferiti | `/preferiti/` | `/en/favorites/` |
| Proponi | `/proponi/` | `/en/submit/` |
| Informazioni | `/informazioni/` | `/en/about/` |

I filtri finiscono nell'indirizzo e si possono condividere, ad esempio `/strumenti/?q=dem&lic=open-source,freemium&pf=web&fmt=DXF&it=1&sort=az&view=list`.

## Scelte tecniche

- **[Astro](https://astro.build)**: ogni pagina e ogni categoria è HTML pre-generato, quindi indicizzabile e condivisibile; le card sono leggibili anche senza JavaScript. Lo schema dei dati viene validato al build.
- **Tailwind CSS 4**, con colori definiti come variabili CSS per il tema chiaro e scuro (un solo accento, verde salvia).
- **Vanilla TypeScript + [Fuse.js](https://www.fusejs.io)** per ricerca e filtri, nessun framework lato client: l'unico JavaScript sostanzioso (~30 KB) si carica solo nelle pagine del catalogo.
- **IBM Plex Sans e Plex Mono** ospitati in locale con Fontsource; icone **Lucide** come SVG al build (sprite per quelle ripetute nelle card).
- Preferiti, tema e vista sono salvati in `localStorage`, con il sito che funziona anche se lo storage è bloccato.

Ultime verifiche: link il 24 ottobre 2026 (`npm run check-links`); Lighthouse e axe il 23 ottobre 2026, con Lighthouse 97–100 in tutte le categorie (mobile e desktop, home e catalogo), nessuna violazione axe WCAG 2.1 AA in tema chiaro e scuro e nessuno scroll orizzontale a 375 px.
