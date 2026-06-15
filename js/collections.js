// collections.js — renders /search/, /saved/, /visited/ from localStorage and the
// URL query, reusing the real card component so results match the static pages.

import { mount, h } from './lib/dom.js?v=0.9.10';
import { renderCard } from './components/card.js?v=0.9.10';
import { PAWNS, byIds, top } from './lib/store.js?v=0.9.10';
import { savedIds, visitedIds } from './lib/saved.js?v=0.9.10';
import { CATEGORIES } from './data/categories.js?v=0.9.10';

const SLUG_BY_TYPE = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.type]));

function emptyMsg(text) { return h('div', { class: 'empty' }, text); }

function searchResults() {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').trim().toLowerCase();
  const cat = params.get('cat') || '';
  let list = PAWNS;
  if (cat) list = list.filter((l) => l.typeSlug === cat);
  if (q) {
    list = list.filter((l) => [l.name, l.address, l.type, l.cityName, l.countyName, l.zip]
      .join(' ').toLowerCase().includes(q));
  }
  return { list: top(list, 200), label: q || SLUG_BY_TYPE[cat] || 'all listings', empty: 'No listings match that search. Try a city or a category.' };
}

function render() {
  const container = document.querySelector('[data-collection]');
  if (!container) return;
  const mode = container.dataset.collection;
  let list = [], empty = 'Nothing here yet.';

  if (mode === 'search') { const r = searchResults(); list = r.list; empty = r.empty; }
  else if (mode === 'saved') { list = byIds(savedIds()); empty = 'No saved listings yet. Tap the bookmark on any card to save it.'; }
  else if (mode === 'visited') { list = byIds(visitedIds()); empty = 'No visited listings yet. Call, open, or get directions to a shop and it shows up here.'; }

  if (!list.length) { mount(container, emptyMsg(empty)); return; }
  mount(container, ...list.map((l) => renderCard(l)));
}

render();
window.addEventListener('gap:store', () => { const c = document.querySelector('[data-collection]'); if (c && c.dataset.collection !== 'search') render(); });
window.addEventListener('popstate', render);
