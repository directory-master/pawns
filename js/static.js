// static.js — progressive enhancement layered on every generated page.
// Wires the save buttons, Saved count, claim sheet, "Make an offer" slots,
// near me, the All/Shops/Buyers filter with pagination, and tap to expand a
// card into the detail sheet. The pages work without it; this just makes them
// interactive. Operates on existing DOM — no re-rendering of static content.

import { h } from './lib/dom.js?v=0.9.12';
import { icon } from './lib/icons.js?v=0.9.12';
import { savedIds, savedCount, isSaved, toggleSave } from './lib/saved.js?v=0.9.12';
import { byId, distanceMi, nearest } from './lib/store.js?v=0.9.12';
import { openClaim, openDetail, renderCard } from './components/card.js?v=0.9.12';
import { puffFrom } from './lib/confetti.js?v=0.9.12';
import { CENTROIDS } from './data/city-centroids.js?v=0.9.12';

const CLAIM_TO = 'artivicolab@gmail.com';
const haptic = (s) => { try { navigator.vibrate?.(s ? [12, 28, 22] : 18); } catch { /* */ } };

// ── shared "Near you" rail builders (home + the injected listing rail, so both
//    render the identical pretty distance card) ───────────────────────────────
const nearInitials = (name) => { const w = (name || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean); return (w.length ? (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]) : '?').toUpperCase(); };
const nearMiTxt = (mi) => (mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`);
function nearCardEl(l, mi) {
  return h('a', { class: 'nearcard', href: '#', dataset: { listingId: l.id, lat: l.lat ?? '', lng: l.lng ?? '' } },
    h('div', { class: 'nearcard-poster' },
      l.image ? h('img', { src: l.image, alt: l.name, loading: 'lazy', decoding: 'async' }) : h('span', { class: 'nearcard-ph' }, nearInitials(l.name)),
      h('span', { class: 'near-badge' }, icon('mapPin', { size: 10 }), h('span', { dataset: { nearDist: '' } }, isFinite(mi) ? nearMiTxt(mi) : (l.cityName || '')))),
    h('div', { class: 'nearcard-body' },
      h('div', { class: 'nearcard-name' }, l.name),
      h('div', { class: 'nearcard-cat' }, l.type),
      h('div', { class: 'nearcard-meta' },
        h('span', { class: 'near-rate' }, icon('star', { size: 10, fill: true }), ` ${l.rating ? l.rating.toFixed(1) : 'New'}`),
        l.reviews ? h('span', { class: 'near-rev' }, `${l.reviews.toLocaleString()} reviews`) : null)));
}
const nearCtaEl = (slug, name) => h('a', { class: 'near-cta', href: `/${slug}/` },
  h('span', { class: 'near-cta-ico' }, icon('chevron', { size: 16 })),
  h('span', { class: 'near-cta-t' }, `More in ${name}`),
  h('span', { class: 'near-cta-n' }, 'See all →'));

// ── Saved buttons + count ────────────────────────────────────────────────────
function syncSaves() {
  document.querySelectorAll('.lc-save[data-save-id]').forEach((b) => {
    const on = isSaved(b.dataset.saveId);
    b.classList.toggle('is-saved', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-saved-count]').forEach((el) => { const n = savedCount(); el.textContent = n > 99 ? '99+' : String(n); el.hidden = n === 0; });
}
syncSaves();
window.addEventListener('gap:store', syncSaves);
window.addEventListener('storage', syncSaves);

// ── Slot (paid placement) mailto ─────────────────────────────────────────────
function openSlot(tier) {
  const s = tier === 'premium' ? { t: 'Premium', p: '$20' } : { t: 'Standard', p: '$10' };
  window.location.href = `mailto:${CLAIM_TO}?subject=${encodeURIComponent(`${s.t} listing (${s.p}/mo)`)}&body=${encodeURIComponent(`I'd like the ${s.t.toLowerCase()} placement (${s.p}/mo).\n\nShop name:\nCity:\nWebsite:\nBest phone:`)}`;
}

// ── Material touch ripple ────────────────────────────────────────────────────
// Spawn an expanding circle from the press point on bounded, tappable controls.
const RIPPLE_SEL = '.cta, .btn-pill, .chip, .segment, .more-btn, .category-card, .rank-row, .map-locate, .buy-btn, .watch-btn';
document.addEventListener('pointerdown', (e) => {
  const host = e.target.closest(RIPPLE_SEL);
  if (!host || e.button != null && e.button !== 0) return;
  host.classList.add('ripple-host');
  const r = host.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 1.1;
  const span = document.createElement('span');
  span.className = 'ripple';
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${e.clientX - r.left - size / 2}px`;
  span.style.top = `${e.clientY - r.top - size / 2}px`;
  span.addEventListener('animationend', () => span.remove());
  host.appendChild(span);
}, { passive: true });

// ── Delegated clicks ─────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const save = e.target.closest('.lc-save[data-save-id]');
  if (save) {
    e.preventDefault(); e.stopPropagation();
    const s = toggleSave(save.dataset.saveId); haptic(s);
    save.classList.toggle('is-saved', s); save.setAttribute('aria-pressed', String(s));
    document.querySelectorAll('[data-saved-count]').forEach((el) => { const n = savedCount(); el.textContent = n > 99 ? '99+' : String(n); el.hidden = n === 0; });
    if (s) puffFrom(save, e);
    return;
  }
  const claim = e.target.closest('[data-claim-id]');
  if (claim) { e.preventDefault(); const l = byId(claim.dataset.claimId); if (l) openClaim(l); return; }

  const slot = e.target.closest('[data-slot]');
  if (slot) { e.preventDefault(); openSlot(slot.dataset.slot); return; }

  // the keyboard-accessible "Details" button → detail sheet
  const det = e.target.closest('[data-details-id]');
  if (det) { e.preventDefault(); const l = byId(det.dataset.detailsId); if (l) openDetail(l); return; }

  // placeholder listing anchors (nearcards, featured tiles use href="#") → detail
  // sheet. These are <a> so the card-body branch below skips them; handle here.
  const lnk = e.target.closest('a[data-listing-id]');
  if (lnk && lnk.getAttribute('href') === '#') { e.preventDefault(); const l = byId(lnk.dataset.listingId); if (l) openDetail(l); return; }

  // tap a card body or leaderboard row (not a link/button) → detail sheet
  const card = e.target.closest('[data-listing-id]');
  if (card && !e.target.closest('a, button')) {
    const l = byId(card.dataset.listingId);
    if (l) openDetail(l);
  }
});

// close any open sheet/modal on Escape
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelector('.sheet-backdrop, .modal-backdrop')?.remove(); });

// ── visitor location: one shared store + pinned-city resolution ──────────────
const LOC_KEY = 'gap:location';
function getLoc() { try { const s = JSON.parse(localStorage.getItem(LOC_KEY) || 'null'); return (s && isFinite(s.lat)) ? s : null; } catch { return null; } }
function setLoc(lat, lng) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify({ lat, lng, ts: Date.now() })); } catch { /* */ }
  window.dispatchEvent(new CustomEvent('gap:userloc', { detail: { lat, lng } }));
}
// Clearing reloads so every located surface (rails, distances, label) resets cleanly.
function clearLoc() { try { localStorage.removeItem(LOC_KEY); } catch { /* */ } window.location.reload(); }

// ── Near me → nearest covered city ───────────────────────────────────────────
function nearestCity(lat, lng) {
  let best = null, bestD = Infinity;
  for (const [slug, c] of Object.entries(CENTROIDS)) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = slug; }
  }
  return best;
}
// the city the visitor is pinned to (slug + display name), or null
function pinnedCity() {
  const s = getLoc(); if (!s) return null;
  const slug = nearestCity(s.lat, s.lng); if (!slug) return null;
  return { slug, name: (CENTROIDS[slug] && CENTROIDS[slug].name) || slug };
}

document.querySelectorAll('[data-near-me]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // tapped the ✕ chip → clear location (handled here so it beats navigation)
    if (e.target.closest('[data-near-clear]')) { e.stopPropagation(); clearLoc(); return; }
    // already pinned → take them straight back to their city (no re-geolocate)
    const pin = pinnedCity();
    if (pin) { window.location.href = `/${pin.slug}/`; return; }
    if (!navigator.geolocation) { window.location.href = '/directory/'; return; }
    btn.classList.add('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(5), lng = +pos.coords.longitude.toFixed(5);
        setLoc(lat, lng);
        const slug = nearestCity(lat, lng); window.location.href = slug ? `/${slug}/` : '/directory/';
      },
      () => { btn.classList.remove('locating'); window.location.href = '/directory/'; },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  });
});

// Near me tab: jumps (CSS) until located, then turns green, stops jumping, and
// relabels to "Near <city>".
(() => {
  const tabs = document.querySelectorAll('[data-near-me]');
  if (!tabs.length) return;
  const sync = () => {
    const pin = pinnedCity();
    tabs.forEach((t) => {
      t.classList.toggle('located', !!pin);
      const label = t.querySelector('[data-near-label]');
      if (label) label.textContent = pin ? `Near ${pin.name}` : 'Near me';
    });
  };
  sync();
  window.addEventListener('gap:userloc', sync);
  window.addEventListener('storage', sync);
})();

// ── Clear pinned location — wired for any "Clear" control in a Near-you header ─
(() => {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-near-clear]'); if (!b) return;
    e.preventDefault(); clearLoc();
  });
  const sync = () => { const on = !!getLoc(); document.querySelectorAll('[data-near-clear]').forEach((b) => { b.hidden = !on; }); };
  sync();
  window.addEventListener('gap:userloc', sync);
  window.addEventListener('storage', sync);
})();

// ── Distance watermark on the Vault listing cards ────────────────────────────
// Once the visitor's location is pinned (saved or just located), each .vcard shows
// how far the shop is as a serif watermark in the lower-right of its photo.
(() => {
  const cards = [...document.querySelectorAll('.vcard[data-lat], .cat-lot[data-lat]')].filter((c) => c.dataset.lat !== '' && c.dataset.lat != null);
  if (!cards.length) return;
  const fmt = (mi) => (mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`);
  const annotate = (lat, lng) => {
    cards.forEach((c) => {
      const cl = parseFloat(c.dataset.lat), cn = parseFloat(c.dataset.lng);
      const slot = c.querySelector('[data-dist]');
      if (Number.isNaN(cl) || Number.isNaN(cn) || !slot) return;
      slot.textContent = fmt(distanceMi(lat, lng, cl, cn));
      slot.hidden = false;
      c.classList.add('has-dist');
    });
  };
  try { const s = JSON.parse(localStorage.getItem('gap:location') || 'null'); if (s && isFinite(s.lat)) annotate(s.lat, s.lng); } catch { /* */ }
  window.addEventListener('gap:userloc', (e) => annotate(e.detail.lat, e.detail.lng));
})();

// ── Distance from the user on listing cards ──────────────────────────────────
// Cards carry data-lat/data-lng. When we know the visitor's location (from the
// map's "Show my location", a prior visit in localStorage, or a list-only button
// we inject here) every card gets an "X mi away" line filled into its [data-dist].
(() => {
  const cards = [...document.querySelectorAll('.product[data-lat]')].filter((c) => c.dataset.lat !== '' && c.dataset.lat != null);
  if (!cards.length) return;
  const fmt = (mi) => (mi < 10 ? `${mi.toFixed(1)} mi away` : `${Math.round(mi)} mi away`);
  const annotate = (lat, lng) => {
    cards.forEach((c) => {
      const cl = parseFloat(c.dataset.lat), cn = parseFloat(c.dataset.lng);
      if (Number.isNaN(cl) || Number.isNaN(cn)) return;
      const slot = c.querySelector('[data-dist]');
      if (!slot) return;
      slot.textContent = fmt(distanceMi(lat, lng, cl, cn));
      slot.hidden = false;
    });
  };
  try { const s = JSON.parse(localStorage.getItem('gap:location') || 'null'); if (s && isFinite(s.lat)) annotate(s.lat, s.lng); } catch { /* */ }
  window.addEventListener('gap:userloc', (e) => annotate(e.detail.lat, e.detail.lng));

  // pages without the map's locate button get their own trigger above the list
  if (!document.querySelector('[data-map-locate]') && navigator.geolocation) {
    const sec = document.querySelector('[data-more-list]')?.closest('.section');
    if (sec) {
      const btn = document.createElement('button');
      btn.className = 'map-locate'; btn.type = 'button'; btn.textContent = 'Show distance from me';
      btn.addEventListener('click', () => {
        btn.disabled = true; btn.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = +pos.coords.latitude.toFixed(5), lng = +pos.coords.longitude.toFixed(5);
            try { localStorage.setItem('gap:location', JSON.stringify({ lat, lng, ts: Date.now() })); } catch { /* */ }
            annotate(lat, lng); btn.textContent = 'Distances shown';
          },
          () => { btn.disabled = false; btn.textContent = 'Show distance from me'; },
          { enableHighAccuracy: false, timeout: 9000, maximumAge: 120000 },
        );
      });
      sec.insertBefore(btn, sec.firstChild);
    }
  }
})();

// ── Home "Near you" → rebuild the rail around the visitor's pinned city ──────
// Ships static for the busiest city; once we know the visitor's location (saved,
// or from the section's locate pin) it swaps in their nearest shops, real
// distances, the city name in the heading, and a "More in <city>" link.
(() => {
  const rail = document.querySelector('.nearrail');
  const cityEl = document.querySelector('.vhead-em');
  if (!rail || !cityEl) return;

  const build = (lat, lng) => {
    if (!isFinite(lat)) return;
    const near = nearest(lat, lng, 8).filter((l) => l.lat != null);
    if (near.length < 4) return;
    const city = near[0];
    cityEl.textContent = city.cityName;
    rail.replaceChildren(
      ...near.map((l) => nearCardEl(l, distanceMi(lat, lng, l.lat, l.lng))),
      nearCtaEl(city.city, city.cityName),
    );
  };

  try { const s = JSON.parse(localStorage.getItem('gap:location') || 'null'); if (s && isFinite(s.lat)) build(s.lat, s.lng); } catch { /* */ }
  window.addEventListener('gap:userloc', (e) => build(e.detail.lat, e.detail.lng));

  // the section's pin: geolocate, remember it, and refresh in place (no redirect)
  document.querySelectorAll('[data-near-locate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = +pos.coords.latitude.toFixed(5), lng = +pos.coords.longitude.toFixed(5);
          setLoc(lat, lng);
          btn.disabled = false;
        },
        () => { btn.disabled = false; },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    });
  });
})();

// ── Near you (listing pages) → the SAME pretty "Around <city>" rail as home ──
// Injected when we know the visitor's location and they aren't already on their
// nearest city's page. Uses the shared nearcard builders so it matches home.
(() => {
  if (document.body.classList.contains('home')) return; // home renders its own
  const main = document.querySelector('main');
  if (!main) return;
  let sec = null;
  const build = (lat, lng) => {
    if (!isFinite(lat)) return;
    const slug = nearestCity(lat, lng);
    if (slug && location.pathname.replace(/\/+$/, '') === '/' + slug) return; // already on their city
    const near = nearest(lat, lng, 8).filter((l) => l.lat != null);
    if (near.length < 4) return;
    const city = near[0];
    const fresh = h('section', { class: 'section' },
      h('div', { class: 'shell' },
        h('div', { class: 'vhead' },
          h('div', { class: 'vhead-text' },
            h('div', { class: 'vhead-kicker' }, 'Near you'),
            h('h2', {}, 'Around ', h('span', { class: 'vhead-em' }, city.cityName))),
          h('button', { class: 'near-clear', type: 'button', dataset: { nearClear: '' } }, 'Clear')),
        h('div', { class: 'nearrail' },
          ...near.map((l) => nearCardEl(l, distanceMi(lat, lng, l.lat, l.lng))),
          nearCtaEl(city.city, city.cityName))));
    if (sec) sec.replaceWith(fresh); else main.prepend(fresh);
    sec = fresh;
  };
  try { const s = JSON.parse(localStorage.getItem('gap:location') || 'null'); if (s && isFinite(s.lat)) build(s.lat, s.lng); } catch { /* */ }
  window.addEventListener('gap:userloc', (e) => build(e.detail.lat, e.detail.lng));
})();

// ── Filter (All / Shops / Buyers) + pagination ───────────────────────────────
// Show the first 20, then reveal 20 more per tap of the button (never dump all).
const STEP = 20;
(() => {
  const list = document.querySelector('[data-more-list]');
  if (!list) return;
  const moreBtn = document.querySelector('[data-more-btn]');
  const segments = [...document.querySelectorAll('.segment[data-filter]')];
  const cards = [...list.querySelectorAll('.vcard[data-listing-id], .product[data-listing-id]')];
  let filter = 'all';
  let shown = STEP;

  const apply = () => {
    let n = 0;
    cards.forEach((card) => {
      const match = filter === 'all' || card.dataset.entity === filter;
      if (!match) { card.style.display = 'none'; return; }
      n++;
      card.style.display = n <= shown ? '' : 'none';
    });
    if (moreBtn) {
      const left = n - shown;
      moreBtn.style.display = left > 0 ? '' : 'none';
      moreBtn.textContent = `Show ${Math.min(STEP, left)} more`;
    }
    segments.forEach((s) => { const on = s.dataset.filter === filter; s.classList.toggle('is-active', on); s.setAttribute('aria-selected', String(on)); });
  };
  segments.forEach((s) => s.addEventListener('click', () => { filter = s.dataset.filter; shown = STEP; apply(); }));
  moreBtn?.addEventListener('click', () => { shown += STEP; apply(); });
  apply();
})();

// ── Count-up the stat numbers when the row scrolls into view ─────────────────
(() => {
  const nums = [...document.querySelectorAll('[data-count]')];
  if (!nums.length) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const run = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    if (reduce || target <= 0) { el.textContent = target.toLocaleString(); return; }
    const dur = 900, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => { if (e.isIntersecting) { run(e.target); obs.unobserve(e.target); } });
  }, { threshold: 0.4 });
  nums.forEach((n) => io.observe(n));
})();

// ── Prefill the header search from ?q / ?cat ─────────────────────────────────
(() => {
  const params = new URLSearchParams(location.search);
  const q = params.get('q'); const cat = params.get('cat');
  const input = document.querySelector('.search input[name="q"]');
  const sel = document.querySelector('.search select[name="cat"]');
  if (q && input) input.value = q;
  if (cat && sel) sel.value = cat;
})();
