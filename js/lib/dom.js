// dom.js — the entire "framework": a tiny hyperscript that builds real DOM nodes.
// Components are plain functions returning nodes via h(). No virtual DOM, no deps.
//
//   h('div', { class: 'x', onclick: fn }, child, 'text', [moreChildren])
//
// Conventions:
//   - `class` / `className` set the class attribute.
//   - `dataset: { listingId }` → data-listing-id="…".
//   - `on*` keys (onclick, oninput…) attach event listeners.
//   - boolean attrs (disabled, hidden) toggle by truthiness.
//   - null / undefined / false children are skipped (so `cond && h(...)` works).

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'line', 'rect', 'polygon', 'polyline', 'defs', 'use']);

function appendChild(node, child) {
  if (child == null || child === false || child === true) return;
  if (Array.isArray(child)) { child.forEach((c) => appendChild(node, c)); return; }
  node.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

export function h(tag, props, ...children) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (val == null || val === false) continue;
      if (key === 'class' || key === 'className') el.setAttribute('class', val);
      else if (key === 'dataset') for (const [d, dv] of Object.entries(val)) { if (dv != null) el.dataset[d] = dv; }
      else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
      else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
      else if (val === true) el.setAttribute(key, '');
      else el.setAttribute(key, val);
    }
  }
  children.forEach((c) => appendChild(el, c));
  return el;
}

// Document fragment from a list of nodes.
export function frag(...children) {
  const f = document.createDocumentFragment();
  children.forEach((c) => appendChild(f, c));
  return f;
}

// Replace a container's contents with new node(s).
export function mount(container, ...children) {
  clear(container);
  children.forEach((c) => appendChild(container, c));
  return container;
}

export function clear(container) {
  while (container.firstChild) container.removeChild(container.firstChild);
  return container;
}
