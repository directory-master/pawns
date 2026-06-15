// GA.Pawns taxonomy — a PAWN SHOP / VALUABLES-BUYER directory for Georgia.
//
// `slug`   — the stable URL key (NEVER change an existing one; it is a live URL).
// `type`   — the human label shown on cards and headings.
// `group`  — clusters categories on hub pages.
// `entity` — 'shop' (pawn/loan storefronts) vs 'buyer' (gold/jewelry/estate buyers
//            and consignment). Powers the All / Shops / Buyers filter, the pawn
//            analog of the lawyers firm/attorney split.
// `synonyms` feed the import classifier: which category does a scraped business
//   Name + Bing Category map onto? Name-first inference lets a generic "Pawn shop"
//   row land on a real subtype when the name reveals one (e.g. "…Title Pawn" →
//   Car Title Pawn, "…Gun & Pawn" → Gun & Firearm Pawn).
//
// We INCLUDE every kind of pawn/valuables business and classify it. Generic rows
// ("Pawn shop") fall back to `pawn-shops` rather than being dropped. Off-vertical
// rows (a cafe the scrape mislabeled "Pawn shop") are filtered at ingest
// (see scripts/gate.mjs → isPawnRow / NAME_EXCLUDE).
//
// INFERENCE ORDER MATTERS — the importer tests SPECIFIC categories in array order
// and takes the first match, then falls back to the GENERAL category (`pawn-shops`).
// Buyer synonyms may now be broad (bare "gold", "jewelry") because a PAWN GUARD in
// gate.mjs inferType() blocks any buyer-type match on a row that is clearly a pawn
// business (name or Bing category contains "pawn"). So "X Pawn & Gold" still resolves
// to a Pawn Shop, while a standalone "Best Gold Mart" / "Jewelry store" is kept as a
// buyer instead of being pruned as off-vertical.

export const GROUPS = [
  'Pawn & Loan',
  'Buyers & Consignment',
];

export const CATEGORIES = [
  // ── SPECIFIC subtypes (tested first, in this order) ──────────────────────────
  { slug: 'gun-firearm-pawn', type: 'Gun & Firearm Pawn', group: 'Pawn & Loan', entity: 'shop',
    synonyms: ['gun and pawn', 'gun & pawn', 'gun pawn', 'firearms and pawn', 'firearm', 'firearms',
      'gun shop', 'guns', 'gun', 'ammo', 'ammunition', 'pistol', 'rifle'] },

  { slug: 'car-title-pawn', type: 'Car Title Pawn', group: 'Pawn & Loan', entity: 'shop',
    synonyms: ['title pawn', 'auto pawn', 'car title', 'title loan', 'title lending', 'title cash',
      'title and loan', 'auto title', 'title'] },

  // estate/antique is tested BEFORE gold so an "antique"/"vintage"/"estate" dealer
  // that also mentions gold lands here, not in Gold & Coin.
  { slug: 'estate-antique-buyers', type: 'Estate & Antique Buyer', group: 'Buyers & Consignment', entity: 'buyer',
    synonyms: ['estate buyer', 'estate buyers', 'estate sale', 'estate sales', 'estate liquidation',
      'estate liquidator', 'estate liquidators', 'estate jewelry', 'auction house', 'auction',
      'antique store', 'antique mall', 'antiques', 'antique', 'vintage', 'collectible', 'collectibles'] },

  { slug: 'gold-coin-buyers', type: 'Gold & Coin Buyer', group: 'Buyers & Consignment', entity: 'buyer',
    synonyms: ['cash for gold', 'we buy gold', 'gold buyer', 'gold buyers', 'gold and silver', 'gold & silver',
      'gold and coin', 'gold and jewelry', 'gold & jewelry', 'gold and diamond', 'gold mart', 'gold shop',
      'gold exchange', 'gold', 'coin shop', 'coin dealer', 'coins', 'coin', 'bullion'] },

  { slug: 'jewelry-watch-consignment', type: 'Luxury Watch & Jewelry Consignment', group: 'Buyers & Consignment', entity: 'buyer',
    synonyms: ['jewelry consignment', 'jewelry buyer', 'watch buyer', 'diamond buyer', 'diamonds',
      'diamond', 'fine jewelry', 'jewelry store', 'jewelry', 'jeweler', 'jewelers', 'watch store', 'watches', 'watch'] },

  // ── GENERAL fallback: generic "Pawn shop" rows and any "…Pawn…" name ─────────
  { slug: 'pawn-shops', type: 'Pawn Shop', group: 'Pawn & Loan', entity: 'shop',
    synonyms: ['pawn shop', 'pawn and jewelry', 'pawn & jewelry', 'pawn and gold', 'pawn & gold',
      'pawnbrokers', 'pawnbroker', 'pawnshop', 'pawns', 'pawn'] },
];

// Convenience lookups
export const TYPE_BY_SLUG = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.type]));
export const SLUG_BY_TYPE = Object.fromEntries(CATEGORIES.map(c => [c.type, c.slug]));
export const ENTITY_BY_TYPE = Object.fromEntries(CATEGORIES.map(c => [c.type, c.entity]));
export const ENTITY_BY_SLUG = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.entity]));
export const CATEGORIES_BY_GROUP = GROUPS.map(g => ({
  group: g,
  items: CATEGORIES.filter(c => c.group === g),
}));
