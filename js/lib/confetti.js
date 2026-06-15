// confetti.js — a tiny one-shot "puff" of dots from a point, for the save tap.
// Pure DOM + WAAPI, self-cleaning, respects reduced-motion. No deps.

const COLORS = ['#febd69', '#d7a94f', '#00a8e1', '#ffd814', '#ffffff'];

export function puffFrom(el, evt) {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  } catch { /* */ }
  const rect = (el && el.getBoundingClientRect) ? el.getBoundingClientRect() : null;
  const x = (evt && evt.clientX) || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
  const y = (evt && evt.clientY) || (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

  const layer = document.createElement('div');
  layer.style.cssText = `position:fixed;left:0;top:0;pointer-events:none;z-index:9999`;
  document.body.appendChild(layer);

  const N = 10;
  for (let i = 0; i < N; i++) {
    const dot = document.createElement('span');
    const size = 5 + Math.random() * 4;
    dot.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;background:${COLORS[i % COLORS.length]}`;
    layer.appendChild(dot);
    const ang = (Math.PI * 2 * i) / N + Math.random() * 0.6;
    const dist = 26 + Math.random() * 26;
    dot.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0)`, opacity: 0 },
      ],
      { duration: 460 + Math.random() * 160, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
  }
  setTimeout(() => layer.remove(), 760);
}
