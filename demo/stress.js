/**
 * Stress-page logic, extracted from stress.html so the public site build can bundle it as a normal
 * esbuild entry point (an inline <script> can't be an entry). In local dev it imports ../src directly,
 * served from the repo root by scripts/serve.js — same shape as the Vanilla demo's demo-app.js.
 */
import { initHelpLayer } from '../src/index.js';

const grid = document.getElementById('stress-grid');
const countSelect = document.getElementById('stress-count');
const autoscroll = document.getElementById('stress-autoscroll');
const msEl = document.getElementById('stress-ms');
const fpsEl = document.getElementById('stress-fps');

let help = null;

// (Re)build the grid of N targets and a fresh help layer over them. Each cell carries its own
// data-help-* so no central config is needed (matcher.js falls back to the data attributes).
function rebuild(n) {
  if (help) {
    help.destroy();
    help = null;
  }
  grid.replaceChildren();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'stress-cell';
    cell.setAttribute('data-help-id', `s${i}`);
    cell.setAttribute('data-help-title', `Field ${i}`);
    cell.setAttribute('data-help-text', `This is the explanation for field ${i}.`);
    cell.textContent = `Field ${i}`;
    frag.appendChild(cell);
  }
  grid.appendChild(frag);
  // No config: every target is described inline via its data-help-* attributes (matcher.js fallback).
  help = initHelpLayer({ toggle: '#help-layer-toggle' });
}

countSelect.addEventListener('change', () => rebuild(Number(countSelect.value)));

// Frame-time meter: moving average over the last 60 rAF deltas. Text is updated ~6x/sec so the
// measurement itself stays cheap and doesn't skew the numbers it reports.
const samples = [];
let last = performance.now();
let lastPaint = 0;
function meter(now) {
  const delta = now - last;
  last = now;
  samples.push(delta);
  if (samples.length > 60) {
    samples.shift();
  }
  if (autoscroll.checked) {
    // Loop the scroll so markers keep re-tracking every frame (the expensive path).
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, max > 0 && window.scrollY >= max ? 0 : window.scrollY + 6);
  }
  if (now - lastPaint > 160) {
    lastPaint = now;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    msEl.textContent = avg.toFixed(1);
    fpsEl.textContent = (1000 / avg).toFixed(0);
  }
  requestAnimationFrame(meter);
}
requestAnimationFrame(meter);

rebuild(Number(countSelect.value));
