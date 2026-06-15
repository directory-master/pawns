// card.js — the listing card. This IS the product: a tappable Prime-style tile
// that links out to the shop's site / Google Maps / phone. Tier-gates the paid
// features. The markup mirrors scripts/generate-pages.mjs `cardHTML` exactly so
// statically-generated cards and client-rendered ones (search/saved/visited) are
// pixel-identical.
//
//   Free      → photo, name, category, city, rating, shop/buyer tag, call +
//               directions + website, and a "Claim and upgrade" CTA.
//   Standard  → pinned above free, "Claimed" eligibility.
//   Premium   → pinned to top, a "Make an offer" CTA.

import { h } from '../lib/dom.js?v=0.9.10';
import { icon } from '../lib/icons.js?v=0.9.10';
import { isSaved, toggleSave, markVisited } from '../lib/saved.js?v=0.9.10';
import { puffFrom } from '../lib/confetti.js?v=0.9.10';
import { initials, telHref, mapsHref, fmtRating, fmtReviews, parseHours, prettyHost } from '../lib/format.js?v=0.9.10';
import { track } from '../lib/analytics.js?v=0.9.10';

const CLAIM_TO = 'artivicolab@gmail.com'; // never rendered as visible text
const KIND = { shop: 'Pawn & Loan', buyer: 'Buyer' };

const haptic = (saved) => { try { navigator.vibrate?.(saved ? [12, 28, 22] : 18); } catch { /* */ } };

function saveButton(l) {
  return h('button', {
    class: 'lc-save' + (isSaved(l.id) ? ' is-saved' : ''),
    'data-save-id': l.id, 'aria-pressed': String(isSaved(l.id)),
    'aria-label': 'Save ' + l.name, title: 'Save',
    onclick: (e) => { e.stopPropagation(); e.preventDefault(); const s = toggleSave(l.id); haptic(s); e.currentTarget.classList.toggle('is-saved', s); e.currentTarget.setAttribute('aria-pressed', String(s)); if (s) puffFrom(e.currentTarget, e); },
  }, icon('bookmark', { size: 18 }));
}

function poster(l, rank) {
  const kids = [
    rank != null && rank <= 3 ? h('span', { class: 'rank-badge' }, 'No. ' + rank) : null,
    l.type ? h('span', { class: 'poster-label' }, l.type) : null,
  ];
  if (l.image) {
    const img = h('img', { src: l.image, alt: l.name, loading: 'lazy', decoding: 'async',
      onerror: () => { img.replaceWith(h('span', { class: 'poster-fallback' }, initials(l.name))); } });
    return h('div', { class: 'poster' }, ...kids, img);
  }
  return h('div', { class: 'poster' }, ...kids, h('span', { class: 'poster-fallback' }, initials(l.name)));
}

function ratingLine(l) {
  if (!l.rating) return h('div', { class: 'field rating' }, h('span', { class: 'new' }, 'New'));
  return h('div', { class: 'field rating' }, '★ ' + fmtRating(l.rating),
    l.reviews ? h('span', { class: 'rev' }, ' · ' + fmtReviews(l.reviews)) : null);
}

export function renderCard(l, { rank = null, compact = false } = {}) {
  // compact tile — used in horizontal rails (mirrors the generator's compact card)
  if (compact) {
    return h('article', {
      class: 'product tile', dataset: { listingId: l.id, entity: l.entity, rating: l.rating || 0, reviews: l.reviews || 0 },
      onclick: () => openDetail(l),
    },
      saveButton(l),
      poster(l, rank),
      h('div', { class: 'tile-body' },
        h('span', { class: 'kind-tag' }, KIND[l.entity] || 'Pawn & Loan'),
        h('h3', {}, l.name),
        ratingLine(l),
        h('div', { class: 'field' }, `${l.cityName}, GA`)),
    );
  }
  // full Vault listing card — mirrors generate-pages.mjs `vaultCardHTML`
  const tel = telHref(l.phone);
  const visit = () => { try { markVisited(l.id); } catch { /* */ } };
  const cover = h('div', { class: 'vcard-cover' },
    coverMedia(l),
    h('span', { class: 'vcard-grad' }),
    h('span', { class: 'vcard-role' }, KIND[l.entity] || 'Pawn & Loan'),
    saveButton(l),
    h('span', { class: 'vcard-watermark', 'data-dist': '', hidden: true }),
    h('div', { class: 'vcard-cap' },
      h('div', { class: 'vcard-cap-row' },
        l.rating
          ? [h('span', { class: 'vc-rate' }, icon('star', { size: 11, fill: true }), ' ' + fmtRating(l.rating)),
            l.reviews ? h('span', { class: 'vc-rev' }, fmtReviews(l.reviews)) : null]
          : h('span', { class: 'vc-rate' }, 'New')),
      h('div', { class: 'vcard-name' }, l.name)),
  );
  const body = h('div', { class: 'vcard-body' },
    h('div', { class: 'vcard-meta' }, `${l.type} · ${l.cityName}, GA`),
    h('div', { class: 'vcard-addr' }, icon('mapPin', { size: 12 }), h('span', {}, l.address || `${l.cityName}, GA`)),
    h('div', { class: 'vcard-rule' }),
    h('div', { class: 'vcard-actions' },
      tel ? h('a', { class: 'vcard-call', href: tel, onclick: (e) => { e.stopPropagation(); visit(); } }, icon('phone', { size: 14 }), ' Call')
        : h('span', { class: 'vcard-call vcard-call--off' }, icon('phone', { size: 14 }), ' Call'),
      h('a', { class: 'vcard-ghost', href: mapsHref(l), target: '_blank', rel: 'noopener', onclick: (e) => { e.stopPropagation(); visit(); } }, 'Directions'),
      h('button', { class: 'vcard-ghost', type: 'button', onclick: (e) => { e.stopPropagation(); openDetail(l); } }, 'Details')),
  );
  return h('article', {
    class: 'vcard', dataset: { listingId: l.id, entity: l.entity, rating: l.rating || 0, reviews: l.reviews || 0, lat: l.lat ?? '', lng: l.lng ?? '' },
    onclick: () => openDetail(l),
  }, cover, body);
}

// the cover image (or initials fallback) used by the full Vault card
function coverMedia(l) {
  if (!l.image) return h('span', { class: 'vc-ph' }, initials(l.name));
  const img = h('img', { src: l.image, alt: l.name, loading: 'lazy', decoding: 'async',
    onerror: () => { img.replaceWith(h('span', { class: 'vc-ph' }, initials(l.name))); } });
  return img;
}

// Paid-slot promo card. Honest: we never tag a scraped shop as paying; this slot
// fills with a real listing once a shop buys it.
const SLOT = {
  premium: { tag: 'Premium', price: '$20', blurb: 'Top of the page across your city and category, with a "Make an offer" button on your listing.' },
  standard: { tag: 'Standard', price: '$10', blurb: 'Listed above the free results in your city, with your photo, hours, and website up top.' },
};
export function promoCard(tier) {
  const s = SLOT[tier];
  return h('article', { class: 'product promo' },
    h('span', { class: 'promo-tag' }, icon('sparkles', { size: 13, fill: true }), s.tag.toUpperCase()),
    h('div', { class: 'promo-price' }, s.price, h('span', { class: 'per' }, '/mo')),
    h('h3', {}, 'Your shop here'),
    h('p', {}, s.blurb),
    h('button', { class: 'btn-pill' + (tier === 'premium' ? ' offer' : ''), onclick: () => openSlot(tier) }, 'Claim this spot'),
  );
}
function offerMailto(l) {
  return `mailto:${CLAIM_TO}?subject=${encodeURIComponent('Offer inquiry: ' + l.name)}&body=${encodeURIComponent(`I'd like to make an offer at ${l.name} (${l.address || l.cityName + ', GA'}).`)}`;
}
function openSlot(tier) {
  const s = SLOT[tier];
  track('select_promotion', { tier, price: s.price });
  window.location.href = `mailto:${CLAIM_TO}?subject=${encodeURIComponent(`${s.tag} listing (${s.price}/mo)`)}&body=${encodeURIComponent(`I'd like the ${s.tag.toLowerCase()} placement (${s.price}/mo).\n\nShop name:\nCity:\nWebsite:\nBest phone:`)}`;
}

// Lightweight claim modal → mailto (address never shown as text).
export function openClaim(l) {
  document.querySelector('.modal-backdrop')?.remove();
  track('claim_listing', { item_id: l.id, item_name: l.name });
  const close = () => backdrop.remove();
  const mailto = `mailto:${CLAIM_TO}?subject=${encodeURIComponent('Claim listing: ' + l.name)}&body=${encodeURIComponent(`I want to claim and upgrade:\n\n${l.name}\n${l.address || l.cityName + ', GA'}\n\nName:\nRole:\nBest phone:`)}`;
  const backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'grip' }),
      h('h2', {}, 'Claim this listing'),
      h('p', {}, `Is ${l.name} your shop? Claim it to add your photo, hours, website, a "Make an offer" button, and pin it to the top of `, h('strong', {}, `${l.cityName}, GA`), ' results.'),
      h('a', { class: 'btn-pill', href: mailto }, 'Start claim'),
      h('button', { class: 'ghost', onclick: close }, 'Not now'),
    ),
  );
  document.body.append(backdrop);
}

// Distance in miles between two lat/lng points (haversine).
function milesAway(aLat, aLng, bLat, bLng) {
  if (aLat == null || bLat == null) return null;
  const R = 3958.8, rad = (d) => d * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Detail sheet — the Prime-style expand. Surfaces everything we hold: an embedded
// map + directions, every contact action, per-source ratings, and distance.
export function openDetail(l) {
  document.querySelector('.sheet-backdrop')?.remove();
  try { markVisited(l.id); } catch { /* */ }
  track('view_listing', { item_id: l.id, item_name: l.name, item_category: l.type, city: l.cityName });
  const close = () => backdrop.remove();
  const tel = telHref(l.phone);
  const dest = l.lat != null ? `${l.lat},${l.lng}` : encodeURIComponent(l.address || l.name);
  const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

  // distance from the visitor, when we know their location (set by the map/list locate)
  let distStr = null;
  try {
    const u = JSON.parse(localStorage.getItem('gap:location') || 'null');
    const mi = u && isFinite(u.lat) ? milesAway(u.lat, u.lng, l.lat, l.lng) : null;
    if (mi != null && isFinite(mi)) distStr = (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + ' mi from you';
  } catch { /* */ }

  // meta line under the name: rating · reviews · category · distance
  const sep = () => h('span', { class: 'meta-dot' }, '·');
  const metaParts = [];
  if (l.rating) metaParts.push(h('span', { class: 'meta-rate' }, icon('star', { size: 14, fill: true }), fmtRating(l.rating)));
  if (l.reviews) metaParts.push(h('span', {}, fmtReviews(l.reviews)));
  if (l.type) metaParts.push(h('span', {}, l.type));
  if (distStr) metaParts.push(h('span', {}, distStr));
  const metaLine = metaParts.flatMap((m, i) => (i ? [sep(), m] : [m]));

  // icon fact rows
  const facts = [];
  if (l.address) facts.push(['mapPin', l.address]);
  const hrs = parseHours(l.hoursText); if (hrs) facts.push(['clock', hrs]);
  if (l.phone) facts.push(['phone', l.phone]);
  if (l.website) facts.push(['globe', prettyHost(l.website)]);

  // per-source rating chips (Google / Yelp / Bing …)
  const chips = (l.ratings || []).filter((r) => r && r.rating).map((r) => h('span', { class: 'rate-chip' },
    h('b', {}, r.source || 'Rating'), `★ ${fmtRating(r.rating)}`, r.reviews ? h('span', { class: 'rc-n' }, `(${fmtReviews(r.reviews)})`) : null));

  const mapSrc = (l.lat != null && l.lng != null) ? `https://www.google.com/maps?q=${l.lat},${l.lng}&z=15&output=embed` : null;
  // banner: the photo if we have one, otherwise the map
  const media = l.image
    ? h('div', { class: 'sheet-media' }, h('img', { src: l.image, alt: l.name, loading: 'lazy', referrerpolicy: 'no-referrer' }), l.type ? h('span', { class: 'sheet-cat' }, l.type) : null, h('span', { class: 'sheet-credit' }, 'Photo via Bing Maps'))
    : (mapSrc ? h('iframe', { class: 'sheet-media sheet-media--map', loading: 'lazy', title: `Map of ${l.name}`, src: mapSrc }) : null);

  const backdrop = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } },
    h('section', { class: 'sheet sheet--detail', role: 'dialog', 'aria-modal': 'true' },
      h('button', { class: 'sheet-close', 'aria-label': 'Close', onclick: close }, '×'),
      h('div', { class: 'sheet-save' }, saveButton(l)),
      media,
      h('div', { class: 'sheet-body' },
        h('h2', { class: 'sheet-name' }, l.name,
          l.verified ? h('span', { class: 'verified-badge' }, icon('check', { size: 12 }), 'Claimed') : null),
        metaLine.length ? h('div', { class: 'sheet-meta' }, ...metaLine) : null,
        h('div', { class: 'sheet-cta' },
          tel && h('a', { class: 'cta cta--primary', href: tel, onclick: () => markVisited(l.id) }, icon('phone', { size: 16 }), 'Call'),
          h('a', { class: 'cta', href: dirHref, target: '_blank', rel: 'noopener', onclick: () => markVisited(l.id) }, icon('navigation', { size: 16 }), 'Directions'),
          l.website && h('a', { class: 'cta', href: l.website, target: '_blank', rel: 'noopener nofollow', onclick: () => markVisited(l.id) }, icon('globe', { size: 16 }), 'Website'),
          l.email && h('a', { class: 'cta', href: `mailto:${l.email}`, onclick: () => markVisited(l.id) }, 'Email'),
          l.tier === 'premium' && h('a', { class: 'cta cta--offer', href: offerMailto(l) }, icon('sparkles', { size: 15 }), 'Make an offer')),
        facts.length ? h('div', { class: 'sheet-facts' },
          ...facts.map(([ic, v]) => h('div', { class: 'fact' }, h('span', { class: 'fact-ico' }, icon(ic, { size: 17 })), h('span', {}, v)))) : null,
        chips.length ? h('div', { class: 'rate-chips' }, ...chips) : null,
        (l.image && mapSrc) ? h('iframe', { class: 'sheet-map', loading: 'lazy', title: `Map of ${l.name}`, src: mapSrc }) : null,
        l.tier === 'free' ? h('button', { class: 'sheet-claim', onclick: (e) => { e.stopPropagation(); openClaim(l); } }, 'Own this shop? Claim & upgrade') : null,
      )));
  document.body.append(backdrop);
}
