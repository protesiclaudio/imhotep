// Preferiti salvati in localStorage. Ogni accesso è protetto: in navigazione
// privata o con lo storage bloccato il sito continua a funzionare.
const KEY = 'atlante:favorites';
const EVENT = 'atlante:favorites-change';

export function getFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function save(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage non disponibile: i preferiti restano solo per questa pagina */
  }
  document.dispatchEvent(new CustomEvent(EVENT));
}

export function toggleFavorite(id: string) {
  const ids = getFavorites();
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  save(ids);
  return ids.has(id);
}

export function onFavoritesChange(fn: () => void) {
  document.addEventListener(EVENT, fn);
  // Sincronizza anche tra schede diverse.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) fn();
  });
}

/** Collega i pulsanti stella presenti nella pagina. */
export function initFavoriteButtons(root: ParentNode = document) {
  const { favAdd, favRemove } = document.body.dataset;
  const sync = () => {
    const ids = getFavorites();
    root.querySelectorAll<HTMLButtonElement>('[data-fav]').forEach((btn) => {
      const on = ids.has(btn.dataset.fav!);
      if (btn.getAttribute('aria-pressed') === String(on)) return;
      const name = btn.closest('.tool-card')?.querySelector('h3 a, h2 a')?.firstChild?.textContent ?? '';
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', `${on ? favRemove : favAdd}: ${name}`);
    });
  };
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    toggleFavorite(btn.dataset.fav!);
  });
  sync();
  onFavoritesChange(sync);
}
