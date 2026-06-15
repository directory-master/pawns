// format.js — small display helpers. Pure functions, no DOM, vertical-agnostic.

// Two-letter initials for the photo fallback ("Value Pawn" → "VP").
export function initials(name) {
  const words = (name || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// tel: href from a display phone, or null.
export function telHref(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, '');
  return digits.length >= 7 ? 'tel:' + digits : null;
}

// Bare hostname for a website link ("https://www.x.com/a" → "x.com").
export function prettyHost(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return String(url).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
}

// Google Maps directions/search link for a listing.
export function mapsHref(l) {
  if (l && l.lat != null && l.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
  }
  const q = encodeURIComponent((l && (l.address || l.name)) || '');
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// "★★★★☆" style string for a numeric rating (out of 5).
export function stars(rating) {
  const r = Math.max(0, Math.min(5, Math.round((rating || 0) * 2) / 2));
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

export function fmtRating(rating) {
  return rating ? Number(rating).toFixed(1) : 'New';
}

export function fmtReviews(reviews) {
  if (!reviews) return '';
  return `${Number(reviews).toLocaleString()} review${reviews === 1 ? '' : 's'}`;
}

export function fmtDistance(miles) {
  if (miles == null || !isFinite(miles)) return '';
  if (miles < 0.1) return 'Nearby';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// The scraper only gives a relative status string ("Closed · Opens Mon 10 AM").
// We surface it as-is, normalizing the middot to a plain word so copy stays clean.
export function parseHours(hoursText) {
  if (!hoursText) return '';
  return String(hoursText).replace(/\s*·\s*/g, ', ').trim();
}
