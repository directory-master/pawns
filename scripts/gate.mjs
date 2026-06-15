// gate.mjs — shared ingest logic for the Bing Maps scraper CSVs.
// Used by import-csv.mjs (merge + write) and scan-downloads.mjs (classify files).
//
// The gate keeps ONLY GA pawn / valuables-business rows. Category inference is
// name-first and uses WORD-BOUNDARY matching, so a bare synonym ("pawn", "gun")
// can't false-match a substring when scanning a Downloads folder that also holds
// scrapes for other verticals.

import { readFileSync } from 'node:fs';
import { CATEGORIES, ENTITY_BY_TYPE } from '../js/data/categories.js';

export const kebab = (s) => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Build word-boundary regexes per category. Longest synonyms first so a more
// specific phrase ("title pawn") is preferred over a shorter overlap.
const wb = (syn) => new RegExp('\\b' + syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
const GENERAL = CATEGORIES.find(c => c.slug === 'pawn-shops');
const SPECIFIC = CATEGORIES.filter(c => c.slug !== 'pawn-shops')
  .map(c => ({ type: c.type, res: [...c.synonyms].sort((a, b) => b.length - a.length).map(wb) }));
const GENERAL_RES = GENERAL.synonyms.map(wb);

// Rows the scrape sometimes mislabels as a "Pawn shop" but are clearly NOT pawn
// or valuables businesses. Excluded by NAME so a cafe/restaurant/grocery never
// enters the directory regardless of the Bing Category.
const NAME_EXCLUDE = /\b(cafe|café|restaurant|diner|grill|bakery|grocery|supermarket|barber|salon|laundr\w*|car wash|auto repair|tire shop|cell ?phone repair|smoke shop|vape|gold mine|gold mines|mines?|mining|museum|gym|fitness|corp|corporation)\b/i;

// Buyer categories (gold/jewelry/estate) carry entity 'buyer'. A PAWN row must
// never resolve to one of these, or a pawn shop would flip to the buyer bucket.
const BUYER_TYPES = new Set(CATEGORIES.filter(c => c.entity === 'buyer').map(c => c.type));

export function inferType(name, category) {
  const hay = `${name} ${category}`;
  // PAWN GUARD: a row that is clearly a pawn business (name/category says "pawn")
  // can match pawn SUBTYPES (gun, title) but never a buyer subtype.
  const isPawn = /\bpawn/i.test(hay);
  for (const t of SPECIFIC) {
    if (isPawn && BUYER_TYPES.has(t.type)) continue;
    if (t.res.some(re => re.test(hay))) return t.type;
  }
  if (GENERAL_RES.some(re => re.test(hay))) return GENERAL.type;
  return null;
}

// entity (shop | buyer) is a property of the matched CATEGORY, not the name.
export const entityOf = (type) => ENTITY_BY_TYPE[type] || 'shop';

export const stateOf = (addr) => (addr || '').split(',').pop().trim().split(/\s+/)[0];
export const isGA = (addr) => { const s = stateOf(addr); return s === 'GA' || s === 'Georgia'; };

export function isPawnRow(r) {
  const addr = r['Address'] || '';
  if (!isGA(addr)) return false;
  const nm = r['Name'] || '';
  if (!nm) return false;
  if (NAME_EXCLUDE.test(nm)) return false;
  return inferType(nm, r['Category'] || '') != null;
}

// Bing sometimes truncates long city names in the scraped address. Normalize known
// truncations so they don't spawn a junk duplicate city each re-scrape.
const CITY_FIXUPS = {
  'peachtree cor': 'Peachtree Corners',
};
export const cityNameFromAddr = (addr) => {
  const parts = (addr || '').split(',').map(s => s.trim());
  const raw = parts.length >= 2 ? parts[parts.length - 2] : '';
  const clean = raw.replace(/^private address in\s*/i, '').replace(/^private address.*$/i, '').trim();
  return CITY_FIXUPS[clean.toLowerCase()] || clean;
};
export const citySlugOf = (r) => kebab(cityNameFromAddr(r['Address'])) || '_unknown';
export const rawKey = (r) => ((r['ID'] || '').trim()) || `${(r['Name'] || '').toLowerCase()}|${(r['Address'] || '').toLowerCase()}`;

// Email filters: drop platform/privacy/role inboxes and free-mail providers so we
// never surface a junk address. A pawn shop's real address is rare in the scrape.
export const JUNK_EMAIL = /(stripe|zoca|chargebee|yelp|vagaro|twilio|microsoft|mixpanel|uxcam|moengage|imagekit|styleseat|clarity|birdeye|wix\.|squarespace|godaddy|sentry|cloudflare|gmail\.com|hotmail|yahoo\.com|naver|uol\.com|aol\.com|gearfire|ezcorp|firstcash|buya\.com)/i;
export const JUNK_LOCAL = /^(privacy|privacyoptout|unsubscribe|webmaster|legal|people|help|ir|support|dataprotection|quality|web|noreply|no-reply|admin|info|contact|team|hello|office|intake|billing|orders|feedback|careers|booking|customerservice|collections|investorrelations|acquisitions|realestate|compliance)/i;

// ─── minimal RFC-4180 CSV parser ─────────────────────────────────────────────
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
export function rowsOf(path) {
  const raw = parseCSV(readFileSync(path, 'utf8')).filter(r => r.length > 5);
  const header = raw.shift().map(h => h.trim().replace(/^﻿/, '').replace(/^"|"$/g, ''));
  return raw.map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));
}
