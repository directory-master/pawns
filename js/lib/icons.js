// icons.js — clean line-icon set (Feather/Lucide geometry, MIT-style), rendered
// as DOM via h() or as a string for the generator so card markup matches. Each
// icon is a list of SVG child elements [tag, attrs], so multi-part icons (globe,
// search, clock) render correctly. 24x24 viewBox, 2px stroke, round caps.

import { h } from './dom.js?v=0.9.12';

const ICONS = {
  phone: [['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.34 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.54 2.81.66A2 2 0 0 1 22 16.92z' }]],
  navigation: [['polygon', { points: '3 11 22 2 13 21 11 13 3 11' }]],
  globe: [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 2, y1: 12, x2: 22, y2: 12 }], ['path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }]],
  bookmark: [['path', { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }]],
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }]],
  mapPin: [['path', { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
  star: [['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26' }]],
  home: [['path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }], ['polyline', { points: '9 22 9 12 15 12 15 22' }]],
  grid: [['rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }], ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }], ['rect', { x: 14, y: 14, width: 7, height: 7, rx: 1 }], ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }]],
  heart: [['path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '12 6 12 12 16 14' }]],
  tag: [['path', { d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z' }], ['circle', { cx: 7, cy: 7, r: 1.4 }]],
  layers: [['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }], ['polyline', { points: '2 17 12 22 22 17' }], ['polyline', { points: '2 12 12 17 22 12' }]],
  map: [['polygon', { points: '1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6' }], ['line', { x1: 8, y1: 2, x2: 8, y2: 18 }], ['line', { x1: 16, y1: 6, x2: 16, y2: 22 }]],
  car: [['path', { d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2' }], ['circle', { cx: 7, cy: 17, r: 2 }], ['path', { d: 'M9 17h6' }], ['circle', { cx: 17, cy: 17, r: 2 }]],
  gem: [['path', { d: 'M6 3h12l4 6-10 13L2 9z' }], ['path', { d: 'M11 3 8 9l4 13 4-13-3-6' }], ['path', { d: 'M2 9h20' }]],
  coin: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M14.6 9.4a2.6 2.2 0 0 0-2.6-1.4c-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.6.9 2.6 2-1.1 2-2.6 2a2.6 2.2 0 0 1-2.6-1.4' }], ['path', { d: 'M12 6.4v11.2' }]],
  crosshair: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 3.2 }], ['line', { x1: 12, y1: 2, x2: 12, y2: 5.5 }], ['line', { x1: 12, y1: 18.5, x2: 12, y2: 22 }], ['line', { x1: 2, y1: 12, x2: 5.5, y2: 12 }], ['line', { x1: 18.5, y1: 12, x2: 22, y2: 12 }]],
  sparkles: [['path', { d: 'M12 3l1.6 4.8a3 3 0 0 0 1.9 1.9L20 11l-4.5 1.3a3 3 0 0 0-1.9 1.9L12 19l-1.6-4.8a3 3 0 0 0-1.9-1.9L4 11l4.5-1.3a3 3 0 0 0 1.9-1.9z' }], ['path', { d: 'M19 4v3M17.5 5.5h3' }]],
  check: [['polyline', { points: '20 6 9 17 4 12' }]],
  chevron: [['polyline', { points: '9 6 15 12 9 18' }]],
};

const FILLED = new Set(['star', 'sparkles', 'heart']);
// Icons render via a once-per-page <symbol> sprite (see iconSprite); each use is a
// tiny <svg><use href="#vi-name"/></svg>, so icon-heavy pages don't repeat path data.
const presAttrs = (size, solid) => solid
  ? { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none', 'aria-hidden': 'true', focusable: 'false' }
  : { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };

export function icon(name, { size = 20, fill = false } = {}) {
  if (!ICONS[name]) return h('span', { 'aria-hidden': 'true' });
  return h('svg', presAttrs(size, fill || FILLED.has(name)), h('use', { href: `#vi-${name}` }));
}

// Server-side string version, used by the generator so markup matches the client.
export function iconHTML(name, { size = 20, fill = false } = {}) {
  if (!ICONS[name]) return '';
  const o = presAttrs(size, fill || FILLED.has(name));
  const attrStr = Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<svg ${attrStr}><use href="#vi-${name}"/></svg>`;
}

// The sprite: every icon as a <symbol>, emitted once near the top of <body>. Symbol
// children carry only geometry, so fill/stroke is inherited from each <use> wrapper.
export function iconSprite() {
  const attrStr = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
  const syms = Object.entries(ICONS).map(([name, parts]) =>
    `<symbol id="vi-${name}" viewBox="0 0 24 24">${parts.map(([tag, attrs]) => `<${tag} ${attrStr(attrs)}/>`).join('')}</symbol>`).join('');
  return `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;overflow:hidden"><defs>${syms}</defs></svg>`;
}
