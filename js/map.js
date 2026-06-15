// map.js — plots pawn listings + the visitor's location on an OpenStreetMap map
// via self-hosted Leaflet (/vendor/leaflet/, global `L`). No API key, no billing.
//
// Data comes from an embedded <script type="application/json" id="map-data"> on
// the page (written by the generator for each listing page). Markers are canvas
// circleMarkers (fast with many points), styled in the gold/green theme. The
// "Show my location" button drops a green dot and recomputes popup distances.
(function () {
  const el = document.getElementById('pawn-map');
  if (!el || !window.L) return;
  const L = window.L;

  const GOLD = '#e7b34d', GREEN = '#0f3d2e';
  const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? null : n; };
  const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const milesBetween = (a, b) => {
    const R = 3958.8, rad = (d) => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  function listingsFromJSON() {
    try {
      const raw = document.getElementById('map-data')?.textContent;
      if (raw) return JSON.parse(raw).filter((s) => s.lat != null && s.lng != null);
    } catch { /* */ }
    return [];
  }

  function savedUser() {
    try { const l = JSON.parse(localStorage.getItem('gap:location') || 'null'); if (l && typeof l.lat === 'number') return { lat: l.lat, lng: l.lng }; } catch { /* */ }
    return null;
  }

  function popupHtml(s, getUser) {
    const meta = [esc(s.type), esc(s.city)].filter(Boolean).join(' · ');
    const r = Math.round(s.rating || 0);
    const rating = s.rating
      ? `<div class="map-pop-rate">${'★'.repeat(r)}${'☆'.repeat(5 - r)} ${Number(s.rating).toFixed(1)}${s.reviews ? ` · ${s.reviews} review${s.reviews === 1 ? '' : 's'}` : ''}</div>`
      : `<div class="map-pop-rate map-pop-new">New</div>`;
    const u = getUser && getUser();
    const dist = u ? `<div class="map-pop-dist">${(() => { const mi = milesBetween(u, s); return mi < 10 ? mi.toFixed(1) : Math.round(mi); })()} mi away</div>` : '';
    const dest = `${s.lat},${s.lng}`;
    const origin = u ? `&origin=${u.lat},${u.lng}` : '';
    const visit = s.website ? `<a href="${esc(s.website)}" target="_blank" rel="noopener nofollow">Website</a> · ` : '';
    return `<div class="map-pop"><strong>${esc(s.name)}</strong>${meta ? `<div class="map-pop-meta">${meta}</div>` : ''}${rating}${dist}`
      + `<div class="map-pop-links">${visit}<a href="https://www.google.com/maps/dir/?api=1${origin}&destination=${dest}" target="_blank" rel="noopener">Directions</a></div></div>`;
  }

  const pros = listingsFromJSON();
  const center = [num(el.dataset.lat) ?? 32.9, num(el.dataset.lng) ?? -83.5];
  const map = L.map(el, { scrollWheelZoom: false, preferCanvas: true }).setView(center, num(el.dataset.zoom) || 11);
  L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 }).addTo(map);

  let currentUser = savedUser();
  const getUser = () => currentUser;

  const renderer = L.canvas({ padding: 0.5 });
  const bounds = [];
  pros.forEach((s) => {
    const fill = s.entity === 'buyer' ? GREEN : GOLD;
    L.circleMarker([s.lat, s.lng], { renderer, radius: 7, color: '#fff', weight: 1.5, fillColor: fill, fillOpacity: 0.95 })
      .bindPopup(() => popupHtml(s, getUser)).addTo(map);
    bounds.push([s.lat, s.lng]);
  });

  // user location — a distinct pulsing green dot
  const userIcon = L.divIcon({ className: 'user-dot-wrap', html: '<span class="user-dot"></span>', iconSize: [20, 20] });
  let userMarker = null;
  const setUser = (lat, lng, pan) => {
    currentUser = { lat, lng };
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map).bindPopup('You are here');
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 12));
  };
  if (currentUser) { setUser(currentUser.lat, currentUser.lng, false); bounds.push([currentUser.lat, currentUser.lng]); window.dispatchEvent(new CustomEvent('gap:userloc', { detail: { lat: currentUser.lat, lng: currentUser.lng } })); }

  if (bounds.length) { const b = L.latLngBounds(bounds); if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 13 }); }

  const btn = document.querySelector('[data-map-locate]');
  btn?.addEventListener('click', () => {
    if (!navigator.geolocation) { btn.textContent = 'Location unavailable'; return; }
    const label = btn.textContent;
    btn.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(5), lng = +pos.coords.longitude.toFixed(5);
        try { localStorage.setItem('gap:location', JSON.stringify({ lat, lng, ts: Date.now() })); } catch { /* */ }
        setUser(lat, lng, true);
        window.dispatchEvent(new CustomEvent('gap:userloc', { detail: { lat, lng } }));
        btn.textContent = 'Location on';
      },
      () => { btn.textContent = label; },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 120000 },
    );
  });
})();
