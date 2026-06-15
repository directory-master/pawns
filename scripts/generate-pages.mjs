// generate-pages.mjs — the static SEO generator for GA.Pawns.
//
// Writes REAL crawlable HTML at clean URLs (the files ARE the site): the home
// page, /directory/, every /<city>/, /county/<name>/, /zip/<code>/, /area/<slug>/,
// the better /<city>/<area>/ combos, plus the /search/ /saved/ /visited/ app
// shells, 404.html, sitemap.xml, sw.js, and js/data/city-centroids.js.
//
// Card markup mirrors js/components/card.js so static and client-rendered cards
// match. Never hand-edit the generated files — edit this generator or the data.

import { writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PAWNS, CITIES, COUNTIES, ZIPS, AREAS, TOTAL,
  inCity, inCounty, inZip, inArea, top, byRank, groupByEntity, kebab, distanceMi,
} from '../js/lib/store.js';
import { CATEGORIES, GROUPS } from '../js/data/categories.js';
import { iconHTML, iconSprite } from '../js/lib/icons.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const V = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const ORIGIN = 'https://paws.artivicolab.com';
const SITE = 'Georgia Pawn Shop Directory';
const ALT = 'Pawns';
const YEAR = new Date().getFullYear();
const OG_IMAGE = `${ORIGIN}/bg-pawns.jpg`;
const KIND = { shop: 'Pawn & Loan', buyer: 'Buyer' };
const CAT_ICON = {
  'pawn-shops': 'tag', 'car-title-pawn': 'car', 'gun-firearm-pawn': 'crosshair',
  'gold-coin-buyers': 'coin', 'jewelry-watch-consignment': 'gem',
  'estate-antique-buyers': 'home',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const initialsOf = (name) => {
  const w = (name || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
};
const telHref = (p) => { const d = String(p || '').replace(/[^\d+]/g, ''); return d.length >= 7 ? 'tel:' + d : null; };
const mapsHref = (l) => l.lat != null ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.name)}`;
const prettyHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; } };
const hoursClean = (h) => String(h || '').replace(/\s*·\s*/g, ', ').trim();
const fmtReviews = (n) => n ? `${Number(n).toLocaleString()} review${n === 1 ? '' : 's'}` : '';
const fmtMi = (mi) => (mi == null || !isFinite(mi)) ? '' : (mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`);
const sitemap = [];

// ─── the card (mirrors js/components/card.js) ────────────────────────────────
// `compact` renders the short tile used in horizontal rails: poster + name +
// category + rating only, tappable to open the detail sheet. The full vertical
// grid card (default) carries address, hours, actions, and the claim CTA.
function cardHTML(l, rank = null, compact = false, alwaysRank = false, opts = {}) {
  const tel = telHref(l.phone);
  const geoAttr = ` data-lat="${l.lat ?? ''}" data-lng="${l.lng ?? ''}"`;
  const posterInner = l.image
    ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy" decoding="async">`
    : `<span class="poster-fallback">${esc(initialsOf(l.name))}</span>`;
  const ratingLine = l.rating
    ? `<div class="field rating">★ ${l.rating.toFixed(1)}${l.reviews ? ` <span class="rev">· ${esc(fmtReviews(l.reviews))}</span>` : ''}</div>`
    : `<div class="field rating"><span class="new">New</span></div>`;
  const posterBlock = `<div class="poster">${rank != null && (alwaysRank || rank <= 3) ? `<span class="rank-badge">No. ${rank}</span>` : ''}<span class="poster-label">${esc(l.type)}</span>${posterInner}</div>`;
  const saveBtn = `<button class="lc-save" data-save-id="${esc(l.id)}" aria-pressed="false" aria-label="Save ${esc(l.name)}" title="Save">${iconHTML('bookmark', { size: 18 })}</button>`;
  if (compact) {
    return `<article class="product tile" data-listing-id="${esc(l.id)}" data-entity="${esc(l.entity)}" data-rating="${l.rating || 0}" data-reviews="${l.reviews || 0}"${geoAttr}>`
      + saveBtn + posterBlock
      + `<div class="tile-body"><span class="kind-tag">${esc(KIND[l.entity] || 'Pawn & Loan')}</span>`
      + `<h3>${esc(l.name)}</h3>${ratingLine}`
      + `<div class="field">${esc(l.cityName)}, GA</div></div></article>`;
  }
  const offer = l.tier === 'premium'
    ? `<a class="btn-pill offer" href="mailto:artivicolab@gmail.com?subject=${encodeURIComponent('Offer inquiry: ' + l.name)}">${iconHTML('sparkles', { size: 14 })}Make an offer</a>` : '';
  const claim = l.tier === 'free'
    ? `<div class="claim"><button type="button" data-claim-id="${esc(l.id)}">Own this shop? Claim and upgrade</button></div>` : '';
  return `<article class="product" data-listing-id="${esc(l.id)}" data-entity="${esc(l.entity)}" data-rating="${l.rating || 0}" data-reviews="${l.reviews || 0}"${geoAttr}>`
    + saveBtn + posterBlock
    + `<span class="kind-tag">${esc(KIND[l.entity] || 'Pawn & Loan')}</span>`
    + `<h3>${esc(l.name)}</h3>`
    + ratingLine
    + `<div class="field">${esc(l.address || `${l.cityName}, GA`)}</div>`
    + (opts.dist != null ? `<div class="field dist">${iconHTML('navigation', { size: 14 })}${fmtMi(opts.dist)}${opts.distFrom ? ` from ${esc(opts.distFrom)}` : ' away'}</div>` : '')
    + `<div class="field card-dist" data-dist hidden></div>`
    + (l.hoursText ? `<div class="field"><b>Hours </b>${esc(hoursClean(l.hoursText))}</div>` : '')
    + `<div class="product-actions">`
    + (tel ? `<a class="btn-pill" href="${tel}">${iconHTML('phone', { size: 15 })}Call</a>` : '')
    + `<a class="btn-pill secondary" href="${esc(mapsHref(l))}" target="_blank" rel="noopener">${iconHTML('navigation', { size: 15 })}Directions</a>`
    + (l.website ? `<a class="btn-pill secondary" href="${esc(l.website)}" target="_blank" rel="noopener nofollow">${iconHTML('globe', { size: 15 })}Website</a>` : '')
    + offer
    + `</div>`
    + claim
    + `</article>`;
}

// Leaderboard row for the "ranked by reviews" list — distinct from the image
// rails: a rank number, square thumbnail, name + meta, and the review count.
function rankRowHTML(l, rank) {
  const thumb = l.image
    ? `<img class="rank-thumb" src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy" decoding="async">`
    : `<span class="rank-thumb rank-thumb--ph">${esc(initialsOf(l.name))}</span>`;
  const meta = [esc(l.type), `${esc(l.cityName)}, GA`].join(' · ')
    + (l.rating ? ` · <span class="star">★ ${l.rating.toFixed(1)}</span>` : '');
  return `<div class="rank-row" data-listing-id="${esc(l.id)}">`
    + `<span class="rank-num">${rank}</span>${thumb}`
    + `<div class="rank-info"><div class="rank-name">${esc(l.name)}</div><div class="rank-meta">${meta}</div></div>`
    + `<div class="rank-reviews"><strong>${(l.reviews || 0).toLocaleString()}</strong><span>review${l.reviews === 1 ? '' : 's'}</span></div>`
    + `</div>`;
}

function promoCardHTML(tier) {
  const s = tier === 'premium'
    ? { tag: 'Premium', price: '$20', blurb: 'Top of the page across your city and category, with a "Make an offer" button on your listing.' }
    : { tag: 'Standard', price: '$10', blurb: 'Listed above the free results in your city, with your photo, hours, and website up top.' };
  return `<article class="product promo"><span class="promo-tag">${iconHTML('sparkles', { size: 13, fill: true })}${s.tag.toUpperCase()}</span>`
    + `<div class="promo-price">${s.price}<span class="per">/mo</span></div><h3>Your shop here</h3><p>${esc(s.blurb)}</p>`
    + `<button class="btn-pill${tier === 'premium' ? ' offer' : ''}" data-slot="${tier}">Claim this spot</button></article>`;
}

// Reusable paid/featured row — its OWN section with a 4-up grid, filled left-to-
// right with that tier's real paid listings from `pool`, every still-open slot
// showing a "Claim this spot" card. With no paid shops yet, that's four claim
// cards. Used on the home page and on every city/county/zip/area listing page.
function paidRowHTML(pool, tier, label) {
  const cards = top(pool.filter(l => l.tier === tier), 4).map(l => cardHTML(l));
  while (cards.length < 4) cards.push(promoCardHTML(tier));
  return `<section class="section"><div class="section-head"><h2>${esc(label)}</h2></div><div class="list-grid">${cards.join('')}</div></section>`;
}

// ─── chrome ──────────────────────────────────────────────────────────────────
function headerHTML({ subnav = true, search = true } = {}) {
  const catOpts = CATEGORIES.map(c => `<option value="${esc(c.slug)}">${esc(c.type)}</option>`).join('');
  const navLinks = ['<a href="/directory/">All</a>', ...AREAS.map(a => `<a href="/area/${esc(a.slug)}/">${esc(a.name)}</a>`)].join('');
  // Saved + Near me live in the bottom tab bar only — no duplicate header actions.
  // The home page carries search in its hero, so its header drops the search form
  // (no double search bar) and the subnav (the Vault chips replace it) — leaving a
  // minimal brand + "Buy · Sell · Loan" tag, per the v8 design.
  const right = search
    ? `<form class="search" action="/search/" method="get" role="search">`
      + `<select name="cat" aria-label="Category"><option value="">All</option>${catOpts}</select>`
      + `<input name="q" type="search" placeholder="Search pawn shops, gold buyers, cities" aria-label="Search">`
      + `<button type="submit" aria-label="Search">${iconHTML('search', { size: 18 })}</button></form>`
    : `<span class="topbar-tag">Buy · Sell · Loan</span>`;
  // On the minimal home header the right-side "Buy · Sell · Loan" tag already
  // positions the brand, so the wordmark drops its subtitle to avoid two taglines.
  const brandSub = search ? `<span>Georgia directory</span>` : '';
  return `<header class="topbar${search ? '' : ' topbar--minimal'}"><div class="topbar-inner">`
    + `<a class="brand" href="/"><span class="logo">${iconHTML('gem', { size: 17 })}</span><span class="brand-text"><strong>${ALT}</strong>${brandSub}</span></a>`
    + right
    + `</div>`
    + (subnav ? `<nav class="subnav"><div class="subnav-inner">${navLinks}</div></nav>` : '')
    + `</header>`;
}

// "Shops by city" grid — the home's browse-by-city section, reused on listing pages.
function cityGridSection() {
  const card = (c, feature) => `<a class="category-card${feature ? ' category-card--feature' : ''}" href="/${esc(c.slug)}/">`
    + `<div class="cc-head"><span class="cc-ico">${iconHTML('mapPin', { size: 18 })}</span><h3>${esc(c.name)}</h3></div>`
    + `<div class="cc-count"><strong data-count="${c.count}">${c.count}</strong> listing${c.count === 1 ? '' : 's'}</div>`
    + `<span class="cc-link">Browse city</span></a>`;
  const cards = CITIES.slice(0, 12).map((c, i) => card(c, i === 0)).join('');
  return `<section class="section"><div class="shell">${vHead('Browse', 'Shops by city', 'All cities', '/directory/')}<div class="grid">${cards}</div></div></section>`;
}

// Collapsible A–Z pill groups for long link lists (directory cities/counties/zips,
// and the "<category> by city" / "Cities in <county>" lists). Keeps long lists from
// becoming a wall of chips. `arr` items: { name, slug?, count? }.
function azSection(title, arr, hrefFn) {
  const groups = {};
  for (const x of arr) { const k = (String(x.name).trim()[0] || '#').toUpperCase(); (groups[k] ||= []).push(x); }
  const blocks = Object.keys(groups).sort().map(L =>
    `<details class="az-group"><summary class="az-summary"><span class="az-letter">${esc(L)}</span><span class="az-count">${groups[L].length}</span></summary>`
    + `<div class="chips chips--wrap">${groups[L].map(x => `<a class="chip" href="${hrefFn(x)}">${esc(x.name)}${x.count ? ` (${x.count})` : ''}</a>`).join('')}</div></details>`).join('');
  return `<section class="section"><div class="shell"><div class="section-head"><h2>${esc(title)}</h2></div><div class="az">${blocks}</div></div></section>`;
}

// The Vault category chips row (home + listing pages). `active` is an area slug to
// highlight, or null to highlight "All".
function vchipsHTML(active = null) {
  const chips = [`<a class="vchip${active ? '' : ' is-active'}" href="/directory/">All</a>`,
    ...AREAS.map(a => `<a class="vchip${a.slug === active ? ' is-active' : ''}" href="/area/${esc(a.slug)}/">${esc(a.name)}</a>`)].join('');
  return `<nav class="vchips" aria-label="Categories"><div class="vchips-inner">${chips}</div></nav>`;
}

// Home-style ivory hero used on the home and listing pages: eyebrow + serif title
// + sub + search + a small stat strip. `crumbs` (optional) renders above it.
function vHeroHTML({ eyebrow, title, sub, stats = [], crumbs = null, pageClass = '' }) {
  const statHTML = stats.map(([n, l]) => `<div class="vhstat"><strong>${esc(String(n))}</strong><span>${esc(l)}</span></div>`).join('<span class="vhstat-sep"></span>');
  return `<section class="vhero ${pageClass}"><div class="vhero-inner">`
    + (crumbs ? crumbsHTML(crumbs) : '')
    + `<div class="vhero-eyebrow">${esc(eyebrow)}</div>`
    + `<h1 class="vhero-title">${title}</h1>`
    + (sub ? `<p class="vhero-sub">${esc(sub)}</p>` : '')
    + `<form class="vhero-search" action="/search/" method="get" role="search"><span class="vhs-ico">${iconHTML('search', { size: 18 })}</span>`
    + `<input name="q" type="search" placeholder="Search pawn shops, gold buyers, cities" aria-label="Search"><button type="submit">Search</button></form>`
    + (statHTML ? `<div class="vhero-stats">${statHTML}</div>` : '')
    + `</div></section>`;
}

function footerHTML() {
  const cityLinks = CITIES.slice(0, 8).map(c => `<a href="/${esc(c.slug)}/">${esc(c.name)}</a>`).join('');
  const areaLinks = AREAS.map(a => `<a href="/area/${esc(a.slug)}/">${esc(a.name)}</a>`).join('');
  const countyLinks = COUNTIES.slice(0, 8).map(c => `<a href="/county/${esc(c.slug)}/">${esc(c.name)} County</a>`).join('');
  return `<footer class="footer"><div class="footer-inner"><div class="footer-cols">`
    + `<div><h4>Categories</h4>${areaLinks}</div>`
    + `<div><h4>Top cities</h4>${cityLinks}</div>`
    + `<div><h4>Counties</h4>${countyLinks}</div>`
    + `<div><h4>Directory</h4><a href="/directory/">Browse all</a><a href="/search/">Search</a><a href="/saved/">Saved</a><a href="/visited/">Visited</a></div>`
    + `</div><div class="footer-bar">${SITE}. A directory of public listings, not a vetting, appraisal, or lending service. A claimed listing is owner claimed only. Listing photos via Bing Maps. Made by <a href="https://artivicolab.com" target="_blank" rel="noopener">Artivicolab</a>.</div></div></footer>`;
}

function bottomTabsHTML(active) {
  const tabs = [
    ['Home', '/', 'home'], ['Browse', '/directory/', 'grid'], ['Search', '/search/', 'search'],
    ['Saved', '/saved/', 'heart'], ['Near me', '/directory/', 'mapPin'],
  ];
  return `<nav class="bottom-tabs"><div class="bottom-tabs-inner">${tabs.map(([n, href, ico]) => {
    const attrs = (n === active ? ' class="active"' : '') + (n === 'Near me' ? ' data-near-me' : '');
    const badge = n === 'Saved' ? `<span class="tab-badge" data-saved-count hidden></span>` : '';
    // "Near me" relabels to "Near <city>" once a location is pinned, and gets a
    // ✕ chip to clear that location from any page (see static.js).
    const label = n === 'Near me' ? `<span data-near-label>${n}</span>` : n;
    const nearClear = n === 'Near me' ? `<span class="tab-clear" data-near-clear role="button" aria-label="Clear my location" title="Clear my location" hidden>×</span>` : '';
    return `<a href="${href}"${attrs}><span class="ico">${iconHTML(ico, { size: 22 })}${badge}${nearClear}</span>${label}</a>`;
  }).join('')}</div></nav>`;
}

function crumbsHTML(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">` + items.map((it, i) => {
    const last = i === items.length - 1;
    const node = last ? `<span aria-current="page">${esc(it.name)}</span>` : `<a href="${esc(it.href)}">${esc(it.name)}</a>`;
    return node + (last ? '' : ' <span>›</span> ');
  }).join('') + `</nav>`;
}

function segmentedHTML(list) {
  const g = groupByEntity(list);
  if (!g.shop.length || !g.buyer.length) return '';
  return `<div class="section-head"><div class="segmented" role="tablist">`
    + `<button class="segment is-active" data-filter="all" role="tab" aria-selected="true">All</button>`
    + `<button class="segment" data-filter="shop" role="tab" aria-selected="false">Shops</button>`
    + `<button class="segment" data-filter="buyer" role="tab" aria-selected="false">Buyers</button>`
    + `</div></div>`;
}

// Google Analytics 4 — loaded first in <head> on every page. GA4 auto-collects
// page_view (incl. SPA-style history changes); custom UI actions are sent from
// js/static.js via window.gtag. Keep the ID in one place.
const GA_ID = 'G-0BKYFKP8K5';
// Consent Mode v2: analytics + ads storage default to DENIED, so GA4 sets no
// cookies / collects no identifiers until the visitor accepts (GDPR/EEA). The
// stored choice is restored inline (before config) so a returning consenter
// isn't downgraded on first paint. The banner that flips it lives in <body>.
const GTAG = `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>`
  + `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}`
  + `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`
  + `try{if(localStorage.getItem('gap.consent')==='granted')gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}catch(e){}`
  + `gtag('js',new Date());gtag('config','${GA_ID}');</script>`;
// One-time GDPR consent banner (revealed by static.js only when no choice is stored).
const CONSENT_BANNER = `<div class="consent" data-consent hidden role="dialog" aria-label="Cookie consent" aria-live="polite">`
  + `<p class="consent-text">We use cookies and Google Analytics to see how visitors use this site. Analytics stays off until you accept.</p>`
  + `<div class="consent-actions"><button type="button" class="consent-btn consent-decline" data-consent-decline>Decline</button>`
  + `<button type="button" class="consent-btn consent-accept" data-consent-accept>Accept</button></div></div>`;
const NOSCRIPT = `<noscript><div class="noscript-banner">This site works best with JavaScript on for search, save, and near me.</div></noscript>`;
const HEAD_PWA = `<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#0e3b30"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Pawns">`;
// Playfair Display — the Vault display serif: a high-contrast luxury face with
// genuinely heavy weights (up to 900) so headings read bold, not thin. Preconnect
// + a non-blocking print-onload swap so first paint never waits on the font.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,700&display=swap';
const HEAD_FONTS = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
  + `<link rel="stylesheet" href="${FONT_HREF}" media="print" onload="this.media='all'">`
  + `<noscript><link rel="stylesheet" href="${FONT_HREF}"></noscript>`;

// ─── full document ───────────────────────────────────────────────────────────
function page({ urlPath, title, desc, canonical, jsonld = [], body, index = true, active = 'Home', priority = 0.5, includeStatic = true, mapPage = false, bodyClass = '' }) {
  const url = canonical || (ORIGIN + urlPath);
  // home + listing pages carry the minimal Vault chrome (no header search/subnav;
  // search + category chips live in the hero instead).
  const minimalChrome = String(bodyClass).split(/\s+/).some(c => c === 'home' || c === 'listing');
  if (index) sitemap.push({ url, priority });
  const ld = jsonld.length ? jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('') : '';
  const mapCss = mapPage ? `<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">` : '';
  const mapJs = mapPage ? `<script defer src="/vendor/leaflet/leaflet.js"></script><script defer src="/js/map.js?v=${V}"></script>` : '';
  const scripts = (includeStatic ? `<script type="module" src="/js/static.js?v=${V}"></script>` : '') + mapJs;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${GTAG}${mapCss}`
    + `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
    + `<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">`
    + `<link rel="canonical" href="${esc(url)}">`
    + (index ? '' : '<meta name="robots" content="noindex, follow">')
    + `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(SITE)}">`
    + `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">`
    + `<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${OG_IMAGE}">`
    + `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${OG_IMAGE}">`
    + HEAD_PWA + HEAD_FONTS + `<link rel="stylesheet" href="/css/style.css?v=${V}">${ld}</head>`
    + `<body class="static${bodyClass ? ' ' + bodyClass : ''}">${iconSprite()}${NOSCRIPT}${headerHTML({ subnav: !minimalChrome, search: !minimalChrome })}${body}${footerHTML()}${bottomTabsHTML(active)}${CONSENT_BANNER}${scripts}</body></html>`;
}

// JSON-LD helpers
function listingLD(l) {
  const o = { '@type': 'LocalBusiness', name: l.name, address: { '@type': 'PostalAddress', streetAddress: l.address, addressRegion: 'GA', addressCountry: 'US' } };
  if (l.lat != null) o.geo = { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng };
  if (l.phone) o.telephone = l.phone;
  if (l.website) o.url = l.website;
  if (l.image) o.image = l.image;
  // Only emit aggregateRating when backed by a real review count — never fabricate
  // a count, per Google's review-snippet structured-data guidelines.
  if (l.rating && l.reviews) o.aggregateRating = { '@type': 'AggregateRating', ratingValue: l.rating, reviewCount: l.reviews };
  return o;
}
const breadcrumbLD = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: ORIGIN + it.href })) });
const itemListLD = (list) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((l, i) => ({ '@type': 'ListItem', position: i + 1, item: listingLD(l) })) });

// ─── listing page (city / county / zip / area) ───────────────────────────────
function listingPage({ urlPath, title, desc, eyebrow, h1, sub, intro, crumbs, listings, index = true, priority = 0.6, active = 'Browse', extraSections = '', nearby = null, activeArea = null }) {
  const ranked = top(listings, 999);
  const topList = ranked.slice(0, 10);
  const rest = ranked.slice(10);
  // map: listings with coordinates, plus a center (their centroid) for the page
  const geo = listings.filter(l => l.lat != null && l.lng != null);
  const center = geo.length
    ? { lat: +(geo.reduce((s, l) => s + l.lat, 0) / geo.length).toFixed(4), lng: +(geo.reduce((s, l) => s + l.lng, 0) / geo.length).toFixed(4) }
    : { lat: 32.9, lng: -83.5 };
  const mapData = geo.map(l => ({ name: l.name, lat: l.lat, lng: l.lng, type: l.type, entity: l.entity, city: l.cityName, rating: l.rating || 0, reviews: l.reviews || 0, website: l.website || null }));
  const mapSection = geo.length ? `<section class="section map-band"><div class="shell">`
    + `<div class="section-head"><h2>On the map</h2><button class="map-locate" type="button" data-map-locate>Show my location</button></div>`
    + `<div id="pawn-map" class="pawn-map" data-lat="${center.lat}" data-lng="${center.lng}" data-zoom="11"></div>`
    + `<script type="application/json" id="map-data">${JSON.stringify(mapData)}</script>`
    + `</div></section>` : '';
  // Thin pages (city/county/zip with < 10) get the closest listings from elsewhere
  // pushed in — measured from the page's geographic center — so the page never
  // feels empty. Shown in a clearly separate "Nearby" section, not counted as local.
  let nearbyList = [];
  if (nearby && listings.length < 10) {
    const have = new Set(listings.map(l => l.id));
    nearbyList = PAWNS
      .filter(l => !have.has(l.id) && l.lat != null && l.lng != null)
      .map(l => ({ l, d: distanceMi(center.lat, center.lng, l.lat, l.lng) }))
      .filter(x => isFinite(x.d))
      .sort((a, b) => a.d - b.d)
      .slice(0, 10 - listings.length);
  }
  const nearbySection = nearbyList.length
    ? `<section class="section nearby-fill"><div class="shell"><div class="section-head"><h2>Nearby listings</h2></div>`
      + `<p class="area-intro">The ${nearbyList.length} closest pawn shops and valuables buyers just outside ${esc(nearby)}.</p>`
      + `<div class="vcard-grid">${nearbyList.map(({ l }) => vaultCardHTML(l)).join('')}</div></div></section>`
    : '';
  const catCount = new Set(listings.map(l => l.type)).size;
  const heroStats = [
    [listings.length.toLocaleString(), `listing${listings.length === 1 ? '' : 's'}`],
    [catCount, catCount === 1 ? 'category' : 'categories'],
  ];
  const body = vHeroHTML({ eyebrow, title: esc(h1), sub, stats: heroStats, crumbs, pageClass: 'vhero--page' })
    + vchipsHTML(activeArea)
    + `<main>`
    + (intro ? `<p class="area-intro visually-hidden">${esc(intro)}</p>` : '')
    + featuredHTML(listings)
    + mapSection
    + `<section class="section"><div class="shell">`
    + segmentedHTML(listings)
    + `<div class="vcard-grid" data-more-list>`
    + topList.map((l) => vaultCardHTML(l)).join('')
    + rest.map((l) => vaultCardHTML(l)).join('')
    + `</div><button class="more-btn" data-more-btn>Show more</button></div></section>`
    + nearbySection
    + extraSections
    + cityGridSection()
    + `</main>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: ORIGIN + urlPath },
    breadcrumbLD(crumbs),
    itemListLD(topList),
  ];
  emit(urlPath, page({ urlPath, title, desc, jsonld, body, index, priority, active, mapPage: geo.length > 0, bodyClass: 'listing' }));
}

// ─── writers ─────────────────────────────────────────────────────────────────
const written = new Set();
function emit(urlPath, html) {
  const rel = urlPath === '/' ? 'index.html' : join(urlPath.replace(/^\/|\/$/g, ''), 'index.html');
  const full = join(ROOT, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, html);
  written.add(urlPath === '/' ? '' : urlPath.replace(/^\/|\/$/g, ''));
}

// ─── Vault home atoms ────────────────────────────────────────────────────────
const vStar = (size = 12) => iconHTML('star', { size, fill: true });
// the "like" (save/bookmark) control — wired by static.js via data-save-id
const vSave = (l, size = 16) => `<button class="lc-save" data-save-id="${esc(l.id)}" aria-pressed="false" aria-label="Save ${esc(l.name)}" title="Save">${iconHTML('bookmark', { size })}</button>`;
// The scrape carries the same business more than once (multiple sources/locations);
// drop repeats by name so a "Top 10" never shows the same shop twice.
const dedupeByName = (arr) => { const seen = new Set(); return arr.filter(l => { const k = (l.name || '').trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
const byReviews = (slug, n = 10) => dedupeByName(inArea(slug)
  .filter(l => l.reviews)
  .sort((a, b) => (b.reviews || 0) - (a.reviews || 0) || byRank(a, b))).slice(0, n);

// Near you — a horizontal rail of the prettier distance-forward cards, defaulting
// to the city with the most listings. The pin button geolocates (→ nearest city),
// and static.js swaps each card's city pill for a real "X mi" once located.
function nearYouHTML() {
  const city = CITIES[0];
  if (!city) return '';
  const list = top(inCity(city.slug), 8);
  if (list.length < 4) return '';
  const cards = list.map(l => {
    const poster = l.image
      ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy" decoding="async">`
      : `<span class="nearcard-ph">${esc(initialsOf(l.name))}</span>`;
    return `<a class="nearcard" href="#" data-listing-id="${esc(l.id)}" data-lat="${l.lat ?? ''}" data-lng="${l.lng ?? ''}">`
      + `<div class="nearcard-poster">${poster}<span class="near-badge">${iconHTML('mapPin', { size: 10 })}<span data-near-dist>${esc(l.cityName)}</span></span></div>`
      + `<div class="nearcard-body"><div class="nearcard-name">${esc(l.name)}</div>`
      + `<div class="nearcard-cat">${esc(l.type)}</div>`
      + `<div class="nearcard-meta"><span class="near-rate">${vStar(10)} ${l.rating ? l.rating.toFixed(1) : 'New'}</span>`
      + (l.reviews ? `<span class="near-rev">${l.reviews.toLocaleString()} reviews</span>` : '') + `</div></div></a>`;
  }).join('');
  const cta = `<a class="near-cta" href="/${esc(city.slug)}/"><span class="near-cta-ico">${iconHTML('chevron', { size: 16 })}</span>`
    + `<span class="near-cta-t">More in ${esc(city.name)}</span><span class="near-cta-n">${city.count} dealers →</span></a>`;
  return `<section class="section"><div class="shell"><div class="vhead"><div class="vhead-text">`
    + `<div class="vhead-kicker">Near you</div><h2>Around <span class="vhead-em">${esc(city.name)}</span></h2></div>`
    + `<button class="near-clear" type="button" data-near-clear hidden>Clear</button>`
    + `<button class="near-locate" type="button" data-near-locate aria-label="Use my location to show shops near you">${iconHTML('mapPin', { size: 18 })}</button></div>`
    + `<div class="nearrail">${cards}${cta}</div></div></section>`;
}

// A Vault section header: gold kicker + serif title + optional gold-rule action.
function vHead(kicker, title, action, href) {
  const right = action ? `<a class="vhead-action" href="${href}">${esc(action)}</a>` : '';
  return `<div class="vhead"><div class="vhead-text"><div class="vhead-kicker">${esc(kicker)}</div><h2>${title}</h2></div>${right}</div>`;
}

// The Vault listing card (v8 mockup design): full-width 16:9 photo with the role
// tag, save, and the name + rating overlaid on it, then a body with category·city,
// address, a gold hairline, and one ink "Call" + ghosted Directions / Details.
// Tapping the card (anywhere but a link) opens the detail sheet via static.js.
function vaultCardHTML(l) {
  const tel = telHref(l.phone);
  const role = KIND[l.entity] || 'Pawn & Loan';
  const poster = l.image
    ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy" decoding="async">`
    : `<span class="vc-ph">${esc(initialsOf(l.name))}</span>`;
  const rating = l.rating
    ? `<span class="vc-rate">${vStar(11)} ${l.rating.toFixed(1)}</span>${l.reviews ? `<span class="vc-rev">${esc(fmtReviews(l.reviews))}</span>` : ''}`
    : `<span class="vc-rate">New</span>`;
  return `<article class="vcard" data-listing-id="${esc(l.id)}" data-entity="${esc(l.entity)}" data-rating="${l.rating || 0}" data-reviews="${l.reviews || 0}" data-lat="${l.lat ?? ''}" data-lng="${l.lng ?? ''}">`
    + `<div class="vcard-cover">${poster}<span class="vcard-grad"></span>`
    + `<span class="vcard-role">${esc(role)}</span>`
    + `<button class="lc-save" data-save-id="${esc(l.id)}" aria-pressed="false" aria-label="Save ${esc(l.name)}" title="Save">${iconHTML('bookmark', { size: 18 })}</button>`
    + `<span class="vcard-watermark" data-dist hidden></span>`
    + `<div class="vcard-cap"><div class="vcard-cap-row">${rating}</div>`
    + `<div class="vcard-name">${esc(l.name)}</div></div></div>`
    + `<div class="vcard-body">`
    + `<div class="vcard-meta">${esc(l.type)} · ${esc(l.cityName)}, GA</div>`
    + `<div class="vcard-addr">${iconHTML('mapPin', { size: 12 })}<span>${esc(l.address || `${l.cityName}, GA`)}</span></div>`
    + `<div class="vcard-rule"></div>`
    + `<div class="vcard-actions">`
    + (tel ? `<a class="vcard-call" href="${tel}">${iconHTML('phone', { size: 14 })} Call</a>` : `<span class="vcard-call vcard-call--off">${iconHTML('phone', { size: 14 })} Call</span>`)
    + `<a class="vcard-ghost" href="${esc(mapsHref(l))}" target="_blank" rel="noopener">Directions</a>`
    + `<button class="vcard-ghost" type="button" data-details-id="${esc(l.id)}">Details</button>`
    + `</div></div></article>`;
}

// Featured spotlight — the hero promo. Renders the top paid PREMIUM shop big, then
// a 3-up rail of the next paid shops, every still-open slot a "claim" card. With no
// paid shops yet (the common case today) the whole block is the dealer pitch: one
// vacant hero + three open slots, mirroring the v8 vacant state.
function featuredHTML(source = PAWNS) {
  const pool = top(source.filter(l => l.tier === 'premium'), 4);
  const hero = pool[0]
    ? `<a class="fhero" href="#" data-listing-id="${esc(pool[0].id)}">`
      + `<div class="fhero-cover">${pool[0].image ? `<img src="${esc(pool[0].image)}" alt="${esc(pool[0].name)}" loading="lazy" decoding="async">` : ''}<span class="fhero-grad"></span>`
      + `<span class="fhero-rate">${vStar(12)} ${pool[0].rating ? pool[0].rating.toFixed(1) : 'New'}</span>`
      + `<span class="fhero-trust">${iconHTML('check', { size: 12 })} Featured dealer</span>`
      + `<span class="fhero-cap"><span class="fhero-cat">${esc(pool[0].type)} · ${esc(pool[0].cityName)}</span><span class="fhero-name">${esc(pool[0].name)}</span></span></div></a>`
    : `<div class="fhero fhero--vacant">`
      + `<div class="fhero-cover fhero-cover--ghost"><span class="ghost-gem">${iconHTML('gem', { size: 22 })}</span><span class="ghost-label">Your shop here</span></div>`
      + `<div class="fhero-ticker">${vStar(12)} Shoppers compare ratings and reviews here first</div>`
      + `<div class="fhero-body"><p class="fhero-pitch">Be the first dealer shoppers see when they search to buy, sell or pawn.</p>`
      + `<div class="fhero-price"><span class="fp-tag">Featured</span><s>$179</s><strong>$29<small>/mo</small></strong></div>`
      + `<button class="vbtn vbtn--garnet" data-slot="premium">Claim this spot →</button></div></div>`;
  const railItems = [0, 1, 2].map(i => {
    const l = pool[i + 1];
    if (!l) return `<button class="fmini fmini--claim" data-slot="premium"><span class="fmini-gem">${iconHTML('gem', { size: 13 })}</span><span class="fmini-claim-t">Open slot<small>$29/mo</small></span></button>`;
    return `<a class="fmini" href="#" data-listing-id="${esc(l.id)}"><span class="fmini-img">${l.image ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy">` : ''}</span><span class="fmini-name">${esc(l.name)}</span><span class="fmini-rate">${vStar(9)} ${l.rating ? l.rating.toFixed(1) : 'New'}</span></a>`;
  }).join('');
  return `<section class="section"><div class="shell">`
    + vHead('Featured', 'Featured shops', 'See all', '/directory/')
    + `<div class="featured"><div class="featured-hero">${hero}</div><div class="featured-rail">${railItems}</div></div></div></section>`;
}

// Directory market snapshot — same velvet exchange band, now showing the live
// dealer counts for our biggest categories instead of indicative metal prices.
// Honest numbers (real listing counts), so the "Live" dot is earned.
const SPOT_LABEL = {
  'jewelry-watch-consignment': 'Jewelry & Watches', 'estate-antique-buyers': 'Antique Buyers',
  'pawn-shops': 'Pawn Shops', 'car-title-pawn': 'Title Pawn',
  'gun-firearm-pawn': 'Firearm Pawn', 'gold-coin-buyers': 'Gold & Coin',
};
function spotBarHTML() {
  const top3 = [...AREAS].sort((a, b) => b.count - a.count).slice(0, 3);
  return `<div class="shell"><section class="spotbar"><div class="spot-head">`
    + `<span class="spot-dot"></span><span class="spot-title">Market snapshot</span><span class="spot-tag">Live</span>`
    + `<span class="spot-note">${TOTAL.toLocaleString()} licensed dealers across ${CITIES.length} Georgia cities</span></div>`
    + `<div class="spot-rows">${top3.map(a => `<div class="spot-cell"><div class="spot-metal">${esc(SPOT_LABEL[a.slug] || a.name)}</div><div class="spot-price">${a.count.toLocaleString()}<span>dealers</span></div></div>`).join('')}</div>`
    + `</section></div>`;
}

// THE PAYOUT BOARD — pawn shops, velvet exchange board. Bar = review volume share
// (each row vs. the most-reviewed in the list); rank is by review volume, honest.
function payoutBoardHTML(list) {
  const max = Math.max(1, ...list.map(l => l.reviews || 0));
  const rows = list.map((l, i) => {
    const pct = Math.round(((l.reviews || 0) / max) * 100);
    const thumb = l.image ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy">` : `<span class="bd-ph">${esc(initialsOf(l.name))}</span>`;
    return `<div class="board-row${i === 0 ? ' is-top' : ''}" data-listing-id="${esc(l.id)}">`
      + `<span class="board-rank">${String(i + 1).padStart(2, '0')}</span>`
      + `<span class="board-thumb">${thumb}${vSave(l, 14)}</span>`
      + `<div class="board-main"><div class="board-name">${esc(l.name)}</div>`
      + `<div class="board-meter"><div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div><span class="meter-val">${(l.reviews || 0).toLocaleString()}</span></div></div>`
      + `<div class="board-rating"><span class="bd-r">${vStar(13)} ${l.rating ? l.rating.toFixed(1) : '—'}</span><span class="bd-l">rating</span></div></div>`;
  }).join('');
  return `<div class="shell"><div class="board"><div class="board-head">`
    + `<span class="board-live"><span class="board-live-dot"></span>REVIEW BOARD · PAWN</span>`
    + `<span class="board-headnote">ranked by review volume</span></div>${rows}</div></div>`;
}

// THE SHOWCASE — jewelers, a glass display carousel of tall velvet cards.
function showcaseHTML(list) {
  const cards = list.map((l, i) => `<article class="show-card${i === 0 ? ' is-top' : ''}" data-listing-id="${esc(l.id)}">`
    + `<div class="show-window">${l.image ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy">` : `<span class="show-ph">${esc(initialsOf(l.name))}</span>`}`
    + `<span class="show-rank">${i + 1}</span><span class="show-pedestal"></span>${vSave(l, 16)}</div>`
    + `<div class="show-body"><h3>${esc(l.name)}</h3><div class="show-spec">${esc(l.cityName)}, GA</div>`
    + `<div class="show-foot"><span class="show-rate">${vStar(11)} ${l.rating ? l.rating.toFixed(1) : 'New'}</span><span class="show-rev">${(l.reviews || 0).toLocaleString()} reviews</span></div></div></article>`).join('');
  return `<div class="shell"><div class="showcase">${cards}</div></div>`;
}

// THE CATALOG — estate & antique buyers, an auction-house lot list on aged paper.
function catalogHTML(list) {
  const lots = list.map((l, i) => `<div class="cat-lot${i === 0 ? ' is-top' : ''}" data-listing-id="${esc(l.id)}" data-lat="${l.lat ?? ''}" data-lng="${l.lng ?? ''}">`
    + `<div class="cat-num"><span>LOT</span><strong>${String(i + 1).padStart(2, '0')}</strong></div>`
    + `<div class="cat-plate">${l.image ? `<img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy">` : `<span class="cat-ph">${esc(initialsOf(l.name))}</span>`}${vSave(l, 14)}</div>`
    + `<div class="cat-info"><div class="cat-name">${esc(l.name)}</div><div class="cat-era">${esc(l.type)} · ${esc(l.cityName)}</div>`
    + `<div class="cat-meta"><span class="cat-rate">${vStar(13)} ${l.rating ? l.rating.toFixed(1) : '—'} <span class="cat-rev">(${(l.reviews || 0).toLocaleString()})</span></span></div></div>`
    + `<span class="cat-dist" data-dist hidden></span></div>`).join('');
  return `<div class="shell"><div class="catalog"><div class="catalog-mast">`
    + `<div class="cat-kicker">Georgia Vault · Lot Catalog</div><div class="cat-mast-title">Most-reviewed estate &amp; antique buyers</div></div>`
    + `${lots}</div></div>`;
}

// HOME
function buildHome() {
  const topRated = dedupeByName(top(PAWNS, 40)).slice(0, 12);
  const topReviewed = byReviews('pawn-shops', 10);
  const topJewelry = byReviews('jewelry-watch-consignment', 10);
  const topAntique = byReviews('estate-antique-buyers', 10);
  // "Up & coming": 5-star shops with a credible but modest review count (rising).
  const upcoming = dedupeByName(PAWNS.filter(l => l.rating >= 5 && (l.reviews || 0) >= 4)
    .sort((a, b) => (a.reviews || 0) - (b.reviews || 0) || byRank(a, b))).slice(0, 5);
  const reviewSum = PAWNS.reduce((s, l) => s + (l.reviews || 0), 0);
  const ccard = (href, ico, name, count, link, feature = false) => `<a class="category-card${feature ? ' category-card--feature' : ''}" href="${href}">`
    + `<div class="cc-head"><span class="cc-ico">${iconHTML(ico, { size: 18 })}</span><h3>${esc(name)}</h3></div>`
    + `<div class="cc-count"><strong data-count="${count}">${count}</strong> listing${count === 1 ? '' : 's'}</div>`
    + `<span class="cc-link">${link}</span></a>`;
  const catCards = AREAS.map(a => ccard(`/area/${esc(a.slug)}/`, CAT_ICON[a.slug] || 'tag', a.name, a.count, 'View category')).join('');
  const stats = [[TOTAL.toLocaleString(), 'licensed listings'], [CITIES.length, 'Georgia cities'], [reviewSum.toLocaleString() + '+', 'verified reviews']];
  const chips = ['<a class="vchip is-active" href="/directory/">All</a>',
    ...AREAS.map(a => `<a class="vchip" href="/area/${esc(a.slug)}/">${esc(a.name)}</a>`)].join('');

  const body = `<section class="vhero"><div class="vhero-inner">`
    + `<div class="vhero-eyebrow">Georgia pawn · jewelry · antiques directory</div>`
    + `<h1 class="vhero-title">Know what it's worth.<br><em>Find who pays fair.</em></h1>`
    + `<p class="vhero-sub">Compare licensed Georgia dealers by rating, reviews and specialty — and find who pays fair before you sell.</p>`
    + `<form class="vhero-search" action="/search/" method="get" role="search">`
    + `<span class="vhs-ico">${iconHTML('search', { size: 18 })}</span>`
    + `<input name="q" type="search" placeholder="Try “sell gold near me” or “Rolex buyer”" aria-label="Search listings">`
    + `<button type="submit">Search</button></form>`
    + `<div class="vhero-stats">${stats.map(([n, l]) => `<div class="vhstat"><strong>${n}</strong><span>${l}</span></div>`).join('<span class="vhstat-sep"></span>')}</div>`
    + `</div></section>`
    + `<nav class="vchips" aria-label="Categories"><div class="vchips-inner">${chips}</div></nav>`
    + spotBarHTML()
    + `<main>`
    + nearYouHTML()
    + featuredHTML()
    + `<section class="section"><div class="shell">${vHead('Top rated', 'Highest rated in Georgia', 'See all', '/directory/')}<div class="rail rail--vcards">${topRated.map(l => vaultCardHTML(l)).join('')}</div></div></section>`
    + `<section class="section"><div class="shell">${vHead('Categories', 'What you can buy &amp; sell', 'Show all', '/directory/')}<div class="grid">${catCards}</div></div></section>`
    + `<section class="section"><div class="shell">${vHead('Up & coming', 'Up-and-coming 5-star shops', 'See all', '/directory/')}<div class="rail rail--vcards">${upcoming.map(l => vaultCardHTML(l)).join('')}</div>`
    + `<div class="claim-strip"><button type="button" data-slot="standard">Own one of these shops? <span>Claim &amp; upgrade</span></button></div></div></section>`
    + (topReviewed.length ? `<section class="section"><div class="shell">${vHead('Top 10 · Pawn shops', 'The review board')}</div>${payoutBoardHTML(topReviewed)}</section>` : '')
    + (topJewelry.length ? `<section class="section"><div class="shell">${vHead('Top 10 · Jewelers', 'The showcase')}</div>${showcaseHTML(topJewelry)}</section>` : '')
    + (topAntique.length ? `<section class="section"><div class="shell">${vHead('Top 10 · Antique buyers', 'Most trusted buyers')}</div>${catalogHTML(topAntique)}</section>` : '')
    + cityGridSection()
    + `<section class="dealer-cta"><div class="shell"><div class="dealer-panel">`
    + `<div class="dealer-kicker">For dealers</div>`
    + `<h2>Sellers are comparing offers right now.</h2>`
    + `<p>List your shop free, or feature it atop your category with your photo, hours and website up top.</p>`
    + `<div class="dealer-actions"><a class="vbtn vbtn--gold" href="mailto:artivicolab@gmail.com?subject=${encodeURIComponent('List my shop on Georgia Pawns')}">List for free</a>`
    + `<a class="vbtn vbtn--ghost-light" href="mailto:artivicolab@gmail.com?subject=${encodeURIComponent('Featured placement inquiry')}">See Featured</a></div>`
    + `</div></div></section>`
    + `</main>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, alternateName: ALT, url: ORIGIN + '/', potentialAction: { '@type': 'SearchAction', target: `${ORIGIN}/search/?q={query}`, 'query-input': 'required name=query' } },
    { '@context': 'https://schema.org', '@type': 'Organization', name: SITE, alternateName: ALT, url: ORIGIN + '/', logo: OG_IMAGE },
  ];
  emit('/', page({ urlPath: '/', title: `${SITE} | Pawn Shops, Title Pawns, Gold and Coin Buyers (${YEAR})`, desc: `Find and compare ${TOTAL} pawn shops, car title pawns, gun and firearm pawns, and gold, coin, and jewelry buyers across Georgia.`, jsonld, body, active: 'Home', priority: 1.0, bodyClass: 'home' }));
}

// DIRECTORY HUB
function buildDirectory() {
  const section = (title, arr, hrefFn) => `<section class="section"><div class="shell"><div class="section-head"><h2>${esc(title)}</h2></div><div class="chips chips--wrap">${arr.map(x => `<a class="chip" href="${hrefFn(x)}">${esc(x.name)}${x.count ? ` (${x.count})` : ''}</a>`).join('')}</div></div></section>`;
  const body = vHeroHTML({
    eyebrow: 'Browse', title: 'The Georgia pawn directory',
    sub: 'Every city, county, category, and zip we cover.',
    stats: [[TOTAL.toLocaleString(), 'listings'], [CITIES.length, 'cities'], [COUNTIES.length, 'counties']],
    crumbs: [{ name: 'Home', href: '/' }, { name: 'Directory', href: '/directory/' }], pageClass: 'vhero--page',
  })
    + vchipsHTML()
    + `<main>`
    + section('Categories', AREAS, x => `/area/${x.slug}/`)
    + azSection('Cities', CITIES, x => `/${x.slug}/`)
    + azSection('Counties', COUNTIES.map(c => ({ ...c, name: c.name + ' County' })), x => `/county/${x.slug}/`)
    + azSection('Zip codes', ZIPS, x => `/zip/${x.slug}/`)
    + `</main>`;
  emit('/directory/', page({ urlPath: '/directory/', title: `Browse the ${SITE} | Cities, Counties, Categories`, desc: `Browse every Georgia pawn shop and valuables buyer by city, county, category, and zip code.`, body, active: 'Browse', priority: 0.8, bodyClass: 'listing',
    jsonld: [breadcrumbLD([{ name: 'Home', href: '/' }, { name: 'Directory', href: '/directory/' }])] }));
}

// CITIES
function buildCities() {
  for (const c of CITIES) {
    const listings = inCity(c.slug);
    const county = c.county ? `${c.county} County` : 'Georgia';
    const extra = c.countySlug ? `<section class="section"><div class="shell"><div class="section-head"><h2>Nearby</h2></div><div class="chips chips--wrap"><a class="chip" href="/county/${esc(c.countySlug)}/">All of ${esc(c.county)} County</a></div></div></section>` : '';
    listingPage({
      urlPath: `/${c.slug}/`,
      title: `Top Pawn Shops in ${c.name}, GA (${YEAR}) | ${ALT}`,
      desc: `Find and compare ${listings.length} pawn shops and valuables buyers in ${c.name}, Georgia. Ratings, hours, phone, and directions.`,
      eyebrow: `${county}`, h1: `Pawn shops in ${c.name}, GA`,
      sub: `Compare ${listings.length} pawn shops, title pawns, and gold and jewelry buyers in ${c.name}.`,
      intro: `${c.name} has ${listings.length} pawn and valuables business${listings.length === 1 ? '' : 'es'} in our directory, from full service pawn shops to car title pawns and gold, coin, and jewelry buyers. Each listing below shows ratings, hours, and a direct line to call or get directions.`,
      crumbs: [{ name: 'Home', href: '/' }, { name: c.name, href: `/${c.slug}/` }],
      listings, extraSections: extra, priority: 0.7, nearby: `${c.name}, GA`,
    });
  }
}

// COUNTIES
function buildCounties() {
  for (const c of COUNTIES) {
    const listings = inCounty(c.slug);
    const cities = [...new Set(listings.map(l => l.cityName))].sort();
    const extra = azSection(`Cities in ${c.name} County`, cities.map(name => ({ name, slug: kebab(name) })), x => `/${x.slug}/`);
    listingPage({
      urlPath: `/county/${c.slug}/`,
      title: `Pawn Shops in ${c.name} County, GA (${YEAR}) | ${ALT}`,
      desc: `Find and compare ${listings.length} pawn shops and valuables buyers across ${c.name} County, Georgia.`,
      eyebrow: 'Georgia county', h1: `Pawn shops in ${c.name} County, GA`,
      sub: `${listings.length} pawn shops and buyers across ${cities.length} ${c.name} County ${cities.length === 1 ? 'city' : 'cities'}.`,
      intro: `${c.name} County has ${listings.length} pawn and valuables business${listings.length === 1 ? '' : 'es'} across ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}. Browse the top rated below or jump straight to a city.`,
      crumbs: [{ name: 'Home', href: '/' }, { name: 'Counties', href: '/directory/' }, { name: c.name + ' County', href: `/county/${c.slug}/` }],
      listings, extraSections: extra, priority: 0.6, nearby: `${c.name} County`,
    });
  }
}

// ZIPS
function buildZips() {
  for (const z of ZIPS) {
    const listings = inZip(z.slug);
    const indexable = listings.length >= 3;
    listingPage({
      urlPath: `/zip/${z.slug}/`,
      title: `Pawn Shops in ${z.slug}, ${z.city} GA (${YEAR}) | ${ALT}`,
      desc: `Pawn shops and valuables buyers in the ${z.slug} zip code, ${z.city}, Georgia.`,
      eyebrow: `${z.city}, GA`, h1: `Pawn shops in ${z.slug}`,
      sub: `${listings.length} listing${listings.length === 1 ? '' : 's'} in the ${z.slug} zip code.`,
      intro: `Pawn shops and valuables buyers in the ${z.slug} zip code around ${z.city}, Georgia.`,
      crumbs: [{ name: 'Home', href: '/' }, { name: z.city, href: `/${z.citySlug}/` }, { name: z.slug, href: `/zip/${z.slug}/` }],
      listings, index: indexable, priority: 0.4, nearby: `the ${z.slug} area`,
    });
  }
}

// AREAS (categories) + city×area combos
function buildAreas() {
  for (const a of AREAS) {
    const listings = inArea(a.slug);
    const cities = [...new Set(listings.map(l => l.cityName))].sort();
    const extra = azSection(`${a.name} by city`, cities.map(name => ({ name, slug: kebab(name) })), x => `/${x.slug}/`);
    listingPage({
      urlPath: `/area/${a.slug}/`,
      title: `Top ${a.name}s in Georgia (${YEAR}) | ${ALT}`,
      desc: `Find and compare ${listings.length} ${a.name.toLowerCase()} businesses across Georgia. Ratings, hours, phone, and directions.`,
      eyebrow: 'Category', h1: `${a.name}s in Georgia`,
      sub: `Compare ${listings.length} ${a.name.toLowerCase()} businesses across ${cities.length} Georgia cities.`,
      intro: `Georgia has ${listings.length} ${a.name.toLowerCase()} business${listings.length === 1 ? '' : 'es'} in our directory. Browse the top rated statewide, then narrow to your city.`,
      crumbs: [{ name: 'Home', href: '/' }, { name: a.name, href: `/area/${a.slug}/` }],
      listings, extraSections: extra, priority: 0.7, active: 'Browse', activeArea: a.slug,
    });
    // city×area combos with >= 3 listings get their own indexable page
    for (const c of CITIES) {
      const combo = listings.filter(l => l.city === c.slug);
      if (combo.length < 3) continue;
      listingPage({
        urlPath: `/${c.slug}/${a.slug}/`,
        title: `${a.name}s in ${c.name}, GA (${YEAR}) | ${ALT}`,
        desc: `Compare ${combo.length} ${a.name.toLowerCase()} businesses in ${c.name}, Georgia.`,
        eyebrow: `${c.name}, GA`, h1: `${a.name}s in ${c.name}, GA`,
        sub: `${combo.length} ${a.name.toLowerCase()} businesses in ${c.name}.`,
        intro: `${c.name} has ${combo.length} ${a.name.toLowerCase()} business${combo.length === 1 ? '' : 'es'} in our directory.`,
        crumbs: [{ name: 'Home', href: '/' }, { name: c.name, href: `/${c.slug}/` }, { name: a.name, href: `/${c.slug}/${a.slug}/` }],
        listings: combo, priority: 0.5, active: 'Browse', activeArea: a.slug,
      });
    }
  }
}

// APP SHELLS (search / saved / visited) — rendered client-side by collections.js
function appShell(urlPath, title, desc, h1, sub, mode, active) {
  const body = vHeroHTML({ eyebrow: mode, title: esc(h1), sub, crumbs: [{ name: 'Home', href: '/' }, { name: h1, href: urlPath }], pageClass: 'vhero--page' })
    + vchipsHTML()
    + `<main class="shell"><section class="section"><div class="vcard-grid" data-collection="${mode}"><div class="empty">Loading…</div></div></section></main>`;
  emit(urlPath, page({ urlPath, title, desc, body, index: false, active, includeStatic: false, bodyClass: 'listing' })
    .replace('</body>', `<script type="module" src="/js/collections.js?v=${V}"></script><script type="module" src="/js/static.js?v=${V}"></script></body>`));
}

// ─── run ─────────────────────────────────────────────────────────────────────
function pruneOrphans() {
  const RESERVED = new Set(['css', 'js', 'data', 'scripts', 'vendor', 'node_modules', '.git', '.github', '.vscode', '.claude', 'assets']);
  const HUBS = new Set(['county', 'zip', 'area', 'directory', 'search', 'saved', 'visited']);
  for (const e of readdirSync(ROOT, { withFileTypes: true })) {
    if (!e.isDirectory() || RESERVED.has(e.name) || e.name.startsWith('.')) continue;
    const slug = e.name;
    if (HUBS.has(slug)) continue;
    // city dir: keep if it's a known city; else remove
    if (!CITIES.find(c => c.slug === slug)) {
      rmSync(join(ROOT, slug), { recursive: true, force: true });
    }
  }
  // prune stale /area/<slug>/ dirs (e.g. a category we removed) so their pages
  // don't linger and keep returning 200 after the category is gone.
  const areaDir = join(ROOT, 'area');
  for (const e of readdirSync(areaDir, { withFileTypes: true })) {
    if (e.isDirectory() && !AREAS.find(a => a.slug === e.name)) {
      rmSync(join(areaDir, e.name), { recursive: true, force: true });
    }
  }
}

function writeCityCentroids() {
  const byCity = {};
  for (const l of PAWNS) {
    if (l.lat == null) continue;
    (byCity[l.city] ??= { name: l.cityName, lat: 0, lng: 0, n: 0 });
    byCity[l.city].lat += l.lat; byCity[l.city].lng += l.lng; byCity[l.city].n++;
  }
  const out = {};
  for (const [slug, v] of Object.entries(byCity)) out[slug] = { name: v.name, lat: +(v.lat / v.n).toFixed(5), lng: +(v.lng / v.n).toFixed(5) };
  writeFileSync(join(ROOT, 'js/data/city-centroids.js'),
    '// AUTO-GENERATED by scripts/generate-pages.mjs — do not edit by hand.\n' +
    'export const CENTROIDS = ' + JSON.stringify(out, null, 2) + ';\n');
}

function writeSitemap() {
  const urls = sitemap.filter(Boolean).map(s => `<url><loc>${esc(s.url)}</loc><priority>${s.priority.toFixed(1)}</priority></url>`).join('');
  writeFileSync(join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
}

function writeSW() {
  const V = JSON.parse(readPkg()).version;
  writeFileSync(join(ROOT, 'sw.js'), `// AUTO-GENERATED by scripts/generate-pages.mjs\nconst CACHE = 'gap-${V}';\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', (e) => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));\nself.addEventListener('fetch', (e) => { const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; e.respondWith((async () => { const cache = await caches.open(CACHE); const cached = await cache.match(req); const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached); return cached || network; })()); });\n`);
}
const readPkg = () => readFileSync(join(ROOT, 'package.json'), 'utf8');

function write404() {
  const body = `<main class="static-wrap"><h1 class="static-h1">Page not found</h1><p class="static-sub">That page does not exist. Browse the directory instead.</p><p style="margin-top:18px"><a class="btn-pill" href="/directory/">Browse all Georgia pawn shops</a></p></main>`;
  writeFileSync(join(ROOT, '404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">${GTAG}<meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | ${esc(SITE)}</title><meta name="robots" content="noindex">${HEAD_PWA}<link rel="stylesheet" href="/css/style.css?v=${V}"></head><body class="static">${iconSprite()}${NOSCRIPT}${headerHTML()}${body}${footerHTML()}${bottomTabsHTML()}${CONSENT_BANNER}<script type="module" src="/js/static.js?v=${V}"></script></body></html>`);
}

// build everything
buildHome();
buildDirectory();
buildCities();
buildCounties();
buildZips();
buildAreas();
appShell('/search/', `Search the ${SITE}`, `Search pawn shops, title pawns, and gold and jewelry buyers across Georgia.`, 'Search', 'Type a shop, city, or category.', 'search', 'Search');
appShell('/saved/', `Saved listings | ${ALT}`, `Your saved Georgia pawn shops and buyers.`, 'Saved', 'Listings you saved, kept on this device.', 'saved', 'Saved');
appShell('/visited/', `Visited listings | ${ALT}`, `Listings you recently opened.`, 'Visited', 'Shops you recently called, opened, or got directions to.', 'visited', 'Visited');
writeCityCentroids();
writeSitemap();
writeSW();
write404();
pruneOrphans();

const pageCount = sitemap.filter(Boolean).length;
console.log(`Generated ${written.size}+ page folders, sitemap with ${pageCount} indexable URLs.`);
console.log(`  cities ${CITIES.length}, counties ${COUNTIES.length}, zips ${ZIPS.length}, areas ${AREAS.length}`);
