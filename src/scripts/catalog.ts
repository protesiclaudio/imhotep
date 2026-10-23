import Fuse from 'fuse.js';
import { getFavorites, initFavoriteButtons, onFavoritesChange } from './favorites';

type Item = {
  id: string;
  n: string;
  d: string;
  c: string;
  cn: string;
  t: string[];
  l: string;
  p: string[];
  f: string[];
  it: 0 | 1;
  a: string;
};

type Facet = 'cat' | 'lic' | 'pf' | 'fmt' | 'it';
const FACETS: Facet[] = ['cat', 'lic', 'pf', 'fmt', 'it'];
type Sort = 'relevance' | 'az' | 'recent';

type State = {
  q: string;
  sort: Sort | null;
  view: 'grid' | 'list';
  sel: Record<Facet, Set<string>>;
};

const VIEW_KEY = 'atlante:view';

function matchesFacet(item: Item, facet: Facet, values: Set<string>) {
  if (values.size === 0) return true;
  switch (facet) {
    case 'cat':
      return values.has(item.c);
    case 'lic':
      return values.has(item.l);
    case 'pf':
      return item.p.some((p) => values.has(p));
    case 'fmt':
      return item.f.some((f) => values.has(f));
    case 'it':
      return item.it === 1;
  }
}

export function initCatalog(root: HTMLElement) {
  const mode = root.dataset.mode as 'all' | 'category' | 'favorites';
  const lang = root.dataset.lang ?? 'it';
  const items: Item[] = JSON.parse(root.querySelector('[data-catalog-index]')!.textContent!);
  const i18n = JSON.parse(root.querySelector('[data-catalog-i18n]')!.textContent!);
  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const cards = new Map(
    [...grid.querySelectorAll<HTMLElement>('.tool-card')].map((el) => [el.dataset.id!, el]),
  );
  // Descrizione e categoria sono già nelle card: le leggiamo da lì invece di duplicarle nel JSON.
  for (const item of items) {
    const el = cards.get(item.id);
    item.d = el?.querySelector('.tc-desc')?.textContent ?? '';
    item.cn = el?.querySelector('.tc-cat')?.textContent ?? '';
  }
  const qInput = root.querySelector<HTMLInputElement>('[data-q]')!;
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-sort]')!;
  const relevanceOpt = sortSelect.querySelector<HTMLOptionElement>('[data-relevance]')!;
  const countEl = root.querySelector<HTMLElement>('[data-count]')!;
  const emptyEl = root.querySelector<HTMLElement>('[data-empty]')!;
  const filtersEl = root.querySelector<HTMLElement>('[data-filters]')!;
  const filtersToggle = root.querySelector<HTMLButtonElement>('[data-filters-toggle]');
  const activeCountEl = root.querySelector<HTMLElement>('[data-active-count]');
  const viewBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const collator = new Intl.Collator(lang, { sensitivity: 'base' });

  const fuse = new Fuse(items, {
    keys: [
      { name: 'n', weight: 3 },
      { name: 't', weight: 2 },
      { name: 'f', weight: 1.2 },
      { name: 'd', weight: 1 },
      { name: 'cn', weight: 0.6 },
    ],
    threshold: 0.34,
    ignoreLocation: true,
    ignoreDiacritics: true,
    minMatchCharLength: 2,
  });

  // ---- Stato iniziale dall'URL ----
  const params = new URLSearchParams(location.search);
  let savedView: string | null = null;
  try {
    savedView = localStorage.getItem(VIEW_KEY);
  } catch {}
  const state: State = {
    q: params.get('q') ?? '',
    sort: (['relevance', 'az', 'recent'].includes(params.get('sort') ?? '') ? params.get('sort') : null) as Sort | null,
    view: (params.get('view') ?? savedView) === 'list' ? 'list' : 'grid',
    sel: Object.fromEntries(
      FACETS.map((f) => [f, new Set((params.get(f) ?? '').split(',').filter(Boolean))]),
    ) as State['sel'],
  };
  if (mode === 'category') state.sel.cat.clear();

  // Sincronizza i controlli con lo stato
  qInput.value = state.q;
  filtersEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.checked = state.sel[cb.name as Facet]?.has(cb.value) ?? false;
  });

  function effectiveSort(): Sort {
    if (state.sort === 'relevance' && !state.q) return 'az';
    return state.sort ?? (state.q ? 'relevance' : 'az');
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    for (const f of FACETS) if (state.sel[f].size) p.set(f, [...state.sel[f]].join(','));
    if (state.sort && state.sort !== (state.q ? 'relevance' : 'az')) p.set('sort', state.sort);
    if (state.view === 'list') p.set('view', 'list');
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function render() {
    // 1. Insieme di partenza: tutti, oppure i preferiti
    let pool = items;
    if (mode === 'favorites') {
      const favs = getFavorites();
      pool = items.filter((i) => favs.has(i.id));
    }

    // 2. Ricerca testuale (ordina per pertinenza)
    let ranked: Item[];
    if (state.q.trim().length >= 2) {
      const ids = new Set(pool.map((i) => i.id));
      ranked = fuse
        .search(state.q.trim())
        .map((r) => r.item)
        .filter((i) => ids.has(i.id));
    } else {
      ranked = pool;
    }

    // 3. Filtri e conteggi per faccetta (ogni conteggio ignora la propria faccetta)
    const visible = ranked.filter((i) => FACETS.every((f) => matchesFacet(i, f, state.sel[f])));
    root.querySelectorAll<HTMLElement>('[data-facet-count]').forEach((el) => {
      const [facet, value] = el.dataset.facetCount!.split(':') as [Facet, string];
      const n = ranked.filter(
        (i) => FACETS.every((f) => f === facet || matchesFacet(i, f, state.sel[f])) && matchesFacet(i, facet, new Set([value])),
      ).length;
      el.textContent = String(n);
    });

    // 4. Ordinamento
    const sort = effectiveSort();
    let ordered = visible;
    if (sort === 'az') ordered = [...visible].sort((a, b) => collator.compare(a.n, b.n));
    if (sort === 'recent') ordered = [...visible].sort((a, b) => b.a.localeCompare(a.a) || collator.compare(a.n, b.n));

    // 5. Aggiorna il DOM
    const show = new Set(ordered.map((i) => i.id));
    for (const [id, el] of cards) el.hidden = !show.has(id);
    grid.append(...ordered.map((i) => cards.get(i.id)!).filter(Boolean));
    grid.hidden = ordered.length === 0;
    emptyEl.hidden = ordered.length > 0;
    countEl.textContent = ordered.length === 1 ? i18n.one : i18n.count.replace('{n}', String(ordered.length));

    // Controlli
    relevanceOpt.disabled = !state.q;
    sortSelect.value = sort;
    grid.classList.toggle('is-list', state.view === 'list');
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const active = FACETS.reduce((n, f) => n + state.sel[f].size, 0);
    if (activeCountEl) {
      activeCountEl.textContent = active ? `(${active})` : '';
      activeCountEl.hidden = !active;
    }
    root.classList.add('is-ready');
  }

  // ---- Eventi ----
  let urlTimer: number | undefined;
  qInput.addEventListener('input', () => {
    state.q = qInput.value;
    render();
    clearTimeout(urlTimer);
    urlTimer = window.setTimeout(writeUrl, 250);
  });
  qInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && qInput.value) {
      e.stopPropagation();
      qInput.value = '';
      state.q = '';
      render();
      writeUrl();
    }
  });

  filtersEl.addEventListener('change', (e) => {
    const cb = e.target as HTMLInputElement;
    if (cb.type !== 'checkbox') return;
    const set = state.sel[cb.name as Facet];
    if (cb.checked) set.add(cb.value);
    else set.delete(cb.value);
    render();
    writeUrl();
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    FACETS.forEach((f) => state.sel[f].clear());
    filtersEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
    render();
    writeUrl();
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value as Sort;
    render();
    writeUrl();
  });

  viewBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view === 'list' ? 'list' : 'grid';
      try {
        localStorage.setItem(VIEW_KEY, state.view);
      } catch {}
      render();
      writeUrl();
    }),
  );

  filtersToggle?.addEventListener('click', () => {
    const open = filtersToggle.getAttribute('aria-expanded') !== 'true';
    filtersToggle.setAttribute('aria-expanded', String(open));
    filtersEl.classList.toggle('is-open', open);
  });

  // Scorciatoia "/" per la ricerca
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    e.preventDefault();
    qInput.focus();
    qInput.select();
  });

  initFavoriteButtons(grid);
  if (mode === 'favorites') onFavoritesChange(render);
  render();
}
