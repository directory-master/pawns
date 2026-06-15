// analytics.js — thin, optional wrapper over gtag (if a GA tag is present).
// No-ops cleanly when no analytics is loaded, so callers never guard.

export function track(event, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', event, params);
    }
  } catch { /* never let analytics break the UI */ }
}
