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
const ORIGIN = 'https://pawns.artivicolab.com';
const SITE = 'Georgia Pawn Shop Directory';
const ALT = 'Pawns';
// BRAND is the site name we assert to Google (og:site_name + WebSite schema), so
// search shows "Pawns Directory" instead of the bare subdomain or the parent
// domain's "ArtivicoLab". SITE stays the descriptive name used in title text.
const BRAND = 'Pawns Directory';
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
// <title> budget (~60 chars): keep the " | Pawns" suffix only when it still fits.
const SITE_SUFFIX = ` | ${ALT}`;
const mkTitle = (core) => core.length + SITE_SUFFIX.length <= 60 ? core + SITE_SUFFIX : core;
const lc1 = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const para = (...ps) => ps.filter(Boolean).map(t => `<p class="area-intro">${t}</p>`).join('');
const joinList = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
const nf = (n) => Number(n || 0).toLocaleString('en-US');
// Meta description budget (~155 chars): cut at the last full sentence, else word.
const clamp = (t, max = 158) => {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sent = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (sent >= max * 0.5) return cut.slice(0, sent + 1).trim();
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '…';
};
// Cards rendered per page; the rest live on the narrower pages. Keeps every URL
// light instead of a multi megabyte dump (the jewelry page was 2.25 MB).
const CAP = { city: 60, cityArea: 60, county: 60, zip: 40, area: 50 };
const MIN_INDEX = 3;

// Georgia facts per category, shown as visible prose on the statewide pages and
// echoed on city×category pages. Plain facts, no advice, no endorsement.
const AREA_PROSE = {
  'pawn-shops': (n) => para(
    `Georgia pawn shops are regulated under the state pawnbroker law (O.C.G.A. § 44-12-130 and following). A pawn is a loan against an item you leave with the shop: the pawn ticket must state the amount, the charges, the maturity date and the grace period, and you get the item back when you repay. If you do not, the shop keeps it; there is no further debt and no effect on your credit.`,
    `Georgia caps pawn charges at 25 percent of the principal per 30 day period for the first 90 days and 12.5 percent per 30 days after that, which is why the same item can cost very different amounts at different shops. Every shop must record your ID and report transactions to local police, so stolen goods are traceable.`,
    `${nf(n)} pawn shops across Georgia are listed here, ranked by rating and review count from public sources. Compare a few before you pawn or sell; most will quote over the phone.`),
  'car-title-pawn': (n) => para(
    `A Georgia title pawn is a 30 day loan secured by your vehicle's title. You keep driving the car, the lender keeps the title, and the same pawn law applies: charges are capped at 25 percent a month for the first three months and 12.5 percent a month after that. Because the loan renews every 30 days, the cost adds up fast if it is not paid down.`,
    `If you default, the lender can repossess the car, and in Georgia it does not have to return any surplus after selling it. Ask for the total repayment amount in writing, whether partial payments reduce the principal, and how repossession is handled before you sign.`,
    `${nf(n)} title pawn locations are listed here, ranked by rating and reviews.`),
  'gun-firearm-pawn': (n) => para(
    `Pawn shops that take firearms must hold a federal firearms license, and redeeming or buying a gun from one means a NICS background check and an ATF Form 4473, the same as a gun store. Georgia has no waiting period and no state permit requirement for the purchase itself.`,
    `Because the shop is licensed, a pawned gun is logged in its bound book and traced if it turns out to be stolen. Bring the firearm unloaded and cased, and expect the shop to check the serial number before quoting.`,
    `${nf(n)} gun and pawn shops are listed here, ranked by rating and reviews.`),
  'gold-coin-buyers': (n) => para(
    `Gold buyers pay by weight and purity: the karat stamp (10K is 41.7 percent gold, 14K 58.5 percent, 18K 75 percent) times the day's spot price, minus the buyer's margin. Coin dealers price bullion the same way and price collectible coins on condition and rarity. Prices can differ by 20 percent or more between shops on the same day, so get two or three quotes.`,
    `Georgia's precious metals law requires registered dealers to check your ID, record each purchase and hold items before reselling them, so a legitimate buyer will ask for identification. A certified scale in view and a quote in grams or pennyweight at a stated purity are the signs of a straightforward dealer.`,
    `${nf(n)} gold, silver and coin buyers are listed here, ranked by rating and reviews.`),
  'jewelry-watch-consignment': (n) => para(
    `Jewelry and watch buyers work three ways: an outright offer, a consignment where the shop sells the piece and splits the proceeds, or a pawn loan against it. Outright offers are lowest and fastest; consignment usually brings the most but can take months. Luxury watches with box and papers, and diamonds with a GIA report, get materially better offers.`,
    `Ask whether the quote is based on melt value or resale value; designer pieces and signed watches should be priced on resale. Independent appraisals are worth it above a few thousand dollars.`,
    `${nf(n)} jewelry buyers, diamond buyers and consignment shops are listed here, ranked by rating and reviews.`),
  'estate-antique-buyers': (n) => para(
    `Estate buyers purchase whole households or collections, often on site; antique dealers buy selectively; auction houses sell on commission. Georgia auctioneers must be licensed by the Georgia Auctioneers Commission. For a full estate, a buyout is fastest, an estate sale company keeps more value but charges 30 to 40 percent, and an auction suits collectibles with a real market.`,
    `Get any buyout offer itemized for the higher value pieces, and ask how the dealer prices silver, jewelry and coins, which are usually the bulk of the value.`,
    `${nf(n)} estate buyers, antique dealers and auction houses are listed here, ranked by rating and reviews.`),
};
const AREA_FAQ = (a, n, tp) => [
  { q: `How many ${a.name.toLowerCase()} businesses are in Georgia?`, a: `${nf(n)} are listed here, ranked by rating and review volume from public sources.` },
  tp && tp.rating ? { q: `Which ${a.name.toLowerCase()} is top rated in Georgia?`, a: `${tp.name} in ${tp.cityName} is among the highest rated, with ${tp.rating.toFixed(1)} stars${tp.reviews ? ` across ${nf(tp.reviews)} reviews` : ''}.` } : null,
  { q: `Is this directory a lender or an appraiser?`, a: `No. It is a directory of public listings. We do not lend, appraise, vet or endorse any business; a claimed listing is owner claimed only.` },
].filter(Boolean);
function cityProse(c, listings) {
  const types = {};
  for (const l of listings) types[l.type] = (types[l.type] || 0) + 1;
  const mix = Object.entries(types).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([t, k]) => `${t.toLowerCase()}${k > 1 ? 's' : ''} (${k})`);
  const g = groupByEntity(listings);
  const tp = top(listings, 1)[0];
  const avgArr = listings.filter(l => l.rating);
  const avg = avgArr.length ? avgArr.reduce((s, l) => s + l.rating, 0) / avgArr.length : null;
  return para(
    `${c.name} is in ${c.county ? `${c.county} County, ` : ''}Georgia. Pawn shops here operate under the state pawnbroker law, which caps charges at 25 percent a month for the first 90 days, requires a written pawn ticket with a maturity date and grace period, and makes every shop record your ID and report transactions to local police.`,
    `We list ${nf(listings.length)} ${listings.length === 1 ? 'business' : 'businesses'} in ${c.name}: ${nf(g.shop.length)} pawn and loan ${g.shop.length === 1 ? 'shop' : 'shops'} and ${nf(g.buyer.length)} ${g.buyer.length === 1 ? 'buyer' : 'buyers'}${mix.length ? `, mostly ${joinList(mix)}` : ''}.${avg ? ` Together they average ${avg.toFixed(1)} stars from public reviews.` : ''}${tp && tp.rating ? ` ${tp.name} currently holds the top spot with ${tp.rating.toFixed(1)} stars${tp.reviews ? ` across ${nf(tp.reviews)} reviews` : ''}.` : ''}`,
    `Rankings come from published ratings and review counts, not from us. Call ahead for a quote, and use the category chips to narrow to title pawns, gold buyers or jewelry buyers.`);
}
const faqHTML = (faq) => faq.length ? `<div class="faq">${faq.map(f => `<div class="faq-item"><h3 class="faq-q">${esc(f.q)}</h3><p class="faq-a">${esc(f.a)}</p></div>`).join('')}</div>` : '';

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
  return `<div class="section-head"><div class="segmented" role="group" aria-label="Show all, shops, or buyers">`
    + `<button class="segment is-active" data-filter="all" aria-pressed="true">All</button>`
    + `<button class="segment" data-filter="shop" aria-pressed="false">Shops</button>`
    + `<button class="segment" data-filter="buyer" aria-pressed="false">Buyers</button>`
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
const HEAD_PWA = `<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#0e3b30">`
  + `<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">`
  + `<link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png">`
  + `<meta name="msapplication-config" content="/browserconfig.xml">`
  + `<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Pawns">`;
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
  desc = clamp(desc);
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
    + `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(BRAND)}">`
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
function listingPage({ urlPath, title, desc, eyebrow, h1, sub, intro, crumbs, listings, index = true, priority = 0.6, active = 'Browse', extraSections = '', nearby = null, activeArea = null, cap = null, capNote = '', about = null, faq = [] }) {
  const ranked = top(listings, 999);
  const shown = cap ? ranked.slice(0, cap) : ranked;
  const topList = shown.slice(0, 10);
  const rest = shown.slice(10);
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
    + featuredHTML(listings)
    + mapSection
    + `<section class="section"><div class="shell">`
    + segmentedHTML(listings)
    + `<div class="vcard-grid" data-more-list>`
    + topList.map((l) => vaultCardHTML(l)).join('')
    + rest.map((l) => vaultCardHTML(l)).join('')
    + `</div><button class="more-btn" data-more-btn>Show more</button>`
    + (cap && ranked.length > cap ? `<p class="area-intro cap-note">Showing the top ${nf(cap)} of ${nf(ranked.length)}. ${capNote || 'Use the category chips or a city page for the rest.'}</p>` : '')
    + `</div></section>`
    + nearbySection
    + (about && about.html ? `<section class="section page-about"><div class="shell"><div class="section-head"><h2>${esc(about.title)}</h2></div>${about.html}${faqHTML(faq)}</div></section>` : '')
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
const CHANGED = new Set();   // canonical URLs whose HTML changed this build (drives <lastmod>)
const PREV_LASTMOD = new Map();
try {
  for (const m of readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) PREV_LASTMOD.set(m[1], m[2]);
} catch { /* first build with lastmod */ }
function emit(urlPath, html) {
  const rel = urlPath === '/' ? 'index.html' : join(urlPath.replace(/^\/|\/$/g, ''), 'index.html');
  const full = join(ROOT, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  let prev = null;
  try { prev = readFileSync(full, 'utf8'); } catch { /* new */ }
  if (prev !== html) { writeFileSync(full, html); CHANGED.add(ORIGIN + urlPath); }
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
    { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, alternateName: [ALT, SITE], url: ORIGIN + '/', potentialAction: { '@type': 'SearchAction', target: `${ORIGIN}/search/?q={query}`, 'query-input': 'required name=query' } },
    { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, alternateName: SITE, url: ORIGIN + '/', logo: OG_IMAGE },
  ];
  emit('/', page({ urlPath: '/', title: `Georgia Pawn Shops | Find Pawn Shops and Gold Buyers (${YEAR})`, desc: `Find and compare ${nf(TOTAL)} pawn shops, title pawns, gun pawns and gold, coin and jewelry buyers across Georgia by city and rating. See who pays fair before you sell.`, jsonld, body, active: 'Home', priority: 1.0, bodyClass: 'home' }));
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
  emit('/directory/', page({ urlPath: '/directory/', title: `Browse Georgia Pawn Shops by City, County and Category | ${ALT}`, desc: `Browse every Georgia pawn shop and valuables buyer by city, county, category, and zip code.`, body, active: 'Browse', priority: 0.8, bodyClass: 'listing',
    jsonld: [breadcrumbLD([{ name: 'Home', href: '/' }, { name: 'Directory', href: '/directory/' }])] }));
}

// CITIES
function buildCities() {
  for (const c of CITIES) {
    const listings = inCity(c.slug);
    const county = c.county ? `${c.county} County` : 'Georgia';
    const extra = c.countySlug ? `<section class="section"><div class="shell"><div class="section-head"><h2>Nearby</h2></div><div class="chips chips--wrap"><a class="chip" href="/county/${esc(c.countySlug)}/">All of ${esc(c.county)} County</a></div></div></section>` : '';
    const types = [...new Set(listings.map(l => l.type))].slice(0, 3).map(t => t.toLowerCase());
    listingPage({
      urlPath: `/${c.slug}/`,
      title: mkTitle(`Pawn Shops in ${c.name}, GA | Title Pawn and Gold Buyers (${YEAR})`),
      desc: `Compare ${nf(listings.length)} pawn shops and buyers in ${c.name}, GA by rating and reviews.${types.length ? ` ${types.map((t, i) => i ? t : t.charAt(0).toUpperCase() + t.slice(1)).join(', ')} and more.` : ''} Call or get directions from the listing.`,
      cap: CAP.city, capNote: 'Pick a category chip above for the full ranked list of that kind.',
      about: { title: `About pawn shops in ${c.name}`, html: cityProse(c, listings) },
      faq: [
        { q: `How many pawn shops are in ${c.name}, GA?`, a: `${nf(listings.length)} pawn shops and valuables buyers in ${c.name}${c.county ? `, ${c.county} County,` : ''} are listed here, ranked by rating and reviews.` },
        { q: `How much can a pawn shop in ${c.name} charge?`, a: `Georgia law caps pawn charges at 25 percent of the loan per 30 days for the first 90 days and 12.5 percent per 30 days after that. The pawn ticket must show the maturity date and grace period.` },
      ],
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
      title: mkTitle(`Pawn Shops in ${c.name} County, GA | Top Rated (${YEAR})`),
      desc: `Compare ${nf(listings.length)} pawn shops and buyers across ${c.name} County, GA by city, rating and reviews. ${cities.slice(0, 3).join(', ')} and more.`,
      cap: CAP.county, capNote: 'Open a city below for its full ranked list.',
      about: { title: `About pawn shops in ${c.name} County`, html: para(
        `${c.name} County has ${nf(listings.length)} pawn shops and valuables buyers across ${joinList(cities.slice(0, 6))}${cities.length > 6 ? ` and ${nf(cities.length - 6)} more ${cities.length - 6 === 1 ? 'city' : 'cities'}` : ''}. All operate under Georgia's pawnbroker law: charges capped at 25 percent a month for the first 90 days, a written pawn ticket, and ID recorded on every transaction.`,
        `Rankings come from published ratings and review counts. Pick a city for the shops closest to you, or a category chip for title pawns, gold buyers or jewelry buyers.`) },
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
      title: mkTitle(`Pawn Shops in ${z.slug}, ${z.city}, GA | Pawn and Gold Buyers`),
      desc: `Compare ${nf(listings.length)} pawn shops and buyers in ZIP code ${z.slug}, ${z.city}, GA, ranked by rating and reviews. See all ${z.city} pawn shops for more nearby.`,
      cap: CAP.zip, capNote: `See all ${z.city} pawn shops for the full list.`,
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
    const tpA = top(listings, 1)[0];
    listingPage({
      urlPath: `/area/${a.slug}/`,
      title: mkTitle(`Georgia ${a.name}s | Top Rated Locations (${YEAR})`),
      desc: `Compare ${nf(listings.length)} ${a.name.toLowerCase()} locations across Georgia by city, rating and reviews. ${cities.slice(0, 3).join(', ')} and ${nf(Math.max(0, cities.length - 3))} more cities.`,
      cap: CAP.area, capNote: 'Pick a city below for every location near you.',
      about: { title: `${a.name} in Georgia, in brief`, html: AREA_PROSE[a.slug] ? AREA_PROSE[a.slug](listings.length) : '' },
      faq: AREA_FAQ(a, listings.length, tpA),
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
      const tpC = top(combo, 1)[0];
      listingPage({
        urlPath: `/${c.slug}/${a.slug}/`,
        title: mkTitle(`${c.name}, GA ${a.name}s | Top Rated (${YEAR})`),
        desc: `Compare ${nf(combo.length)} ${a.name.toLowerCase()} locations in ${c.name}, GA by rating and reviews.${tpC && tpC.rating ? ` ${tpC.name} leads with ${tpC.rating.toFixed(1)} stars.` : ''} Call or get directions from the listing.`,
        cap: CAP.cityArea, capNote: `See all ${c.name} pawn shops or the statewide ${a.name.toLowerCase()} list for the rest.`,
        about: { title: `${a.name} in ${c.name}, in brief`, html: (AREA_PROSE[a.slug] ? AREA_PROSE[a.slug](combo.length) : '') + para(`These ${nf(combo.length)} ${c.name} ${a.name.toLowerCase()} locations are ranked by published ratings and review counts.${tpC && tpC.rating ? ` ${tpC.name} currently ranks first with ${tpC.rating.toFixed(1)} stars${tpC.reviews ? ` from ${nf(tpC.reviews)} reviews` : ''}.` : ''}`) },
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
  const today = new Date().toISOString().slice(0, 10);
  // lastmod moves only when the page's HTML actually changed, so Google can trust it.
  const urls = sitemap.filter(Boolean).map(s => `<url><loc>${esc(s.url)}</loc><lastmod>${CHANGED.has(s.url) ? today : (PREV_LASTMOD.get(s.url) || today)}</lastmod><priority>${s.priority.toFixed(1)}</priority></url>`).join('\n  ');
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
