// saved.js — localStorage-backed Saved + Visited lists. No backend.
// IDs are listing ids (stable URL keys). Other tabs are notified via events.

import { track } from './analytics.js?v=0.9.16';

const SAVED_KEY = 'gap.saved';
const VISITED_KEY = 'gap.visited';

function read(key) {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function write(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* quota / private mode */ }
  try { window.dispatchEvent(new CustomEvent('gap:store', { detail: { key } })); } catch { /* */ }
}

export function savedIds() { return read(SAVED_KEY); }
export function visitedIds() { return read(VISITED_KEY); }
export function isSaved(id) { return read(SAVED_KEY).includes(id); }
export function savedCount() { return read(SAVED_KEY).length; }
export function visitedCount() { return read(VISITED_KEY).length; }

// Toggle a save; returns the new saved state (true = now saved).
export function toggleSave(id) {
  const list = read(SAVED_KEY);
  const i = list.indexOf(id);
  if (i >= 0) { list.splice(i, 1); write(SAVED_KEY, list); track('unsave_listing', { item_id: id }); return false; }
  list.unshift(id); write(SAVED_KEY, list); track('save_listing', { item_id: id }); return true;
}

// Record that the user tapped through to a listing (call/site/directions).
export function markVisited(id) {
  const list = read(VISITED_KEY).filter((x) => x !== id);
  list.unshift(id);
  write(VISITED_KEY, list.slice(0, 200));
}
