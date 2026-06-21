/** @jest-environment jsdom */

/**
 * Unit tests for isFixedReference — the helper that decides whether a marker/popup must use Floating
 * UI's `fixed` strategy (so it doesn't jitter while scrolling) instead of the default `absolute`.
 *
 * Only this pure helper is exercised here; the rest of floating.js calls Floating UI's autoUpdate /
 * computePosition, which need layout APIs jsdom lacks, so the DOM-layer tests mock floating.js whole.
 */
import { isFixedReference } from '../src/floating.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('returns true for an element that is itself position:fixed', () => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  document.body.appendChild(el);
  expect(isFixedReference(el)).toBe(true);
});

test('returns true for a descendant of a position:fixed ancestor', () => {
  const bar = document.createElement('div');
  bar.style.position = 'fixed';
  const btn = document.createElement('button');
  bar.appendChild(btn);
  document.body.appendChild(bar);
  expect(isFixedReference(btn)).toBe(true);
});

test('returns false for a normal (non-fixed) element', () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  expect(isFixedReference(el)).toBe(false);
});

test('returns false for a virtual element (free placement)', () => {
  const virtual = { getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }) };
  expect(isFixedReference(virtual)).toBe(false);
});

test('returns false for null/undefined', () => {
  expect(isFixedReference(null)).toBe(false);
  expect(isFixedReference(undefined)).toBe(false);
});

test('crosses the shadow boundary to find a fixed host', () => {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  const inner = document.createElement('button');
  root.appendChild(inner);
  expect(isFixedReference(inner)).toBe(true);
});
