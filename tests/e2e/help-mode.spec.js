import { expect, test } from '@playwright/test';

/**
 * Real-browser regression tests for the help mode, run against the demo (scripts/serve.js on :5500).
 * These cover behaviors that jsdom unit tests can't: layout-dependent positioning, z-index/paint order,
 * scroll-induced focus jumps, blocking-layer click absorption, and the scrim/cursor affordances.
 */

const TOGGLE = '#help-layer-toggle';
const MARKER = '.help-layer-marker';
const POPUP = '.help-layer-popup';
const BLOCKING = '.help-layer-blocking-layer';

/**
 * In the page, find the marker whose center is nearest the given target's top-right corner and return
 * its viewport center {x,y} plus the offset {dx,dy} from that corner. Markers aren't selectable by
 * their target, so proximity is how we pick "the marker for this element".
 */
function nearestMarkerTo(page, selector) {
  return page.evaluate((sel) => {
    const tr = document.querySelector(sel).getBoundingClientRect();
    const corner = { x: tr.right, y: tr.top };
    let best = null;
    for (const m of document.querySelectorAll('.help-layer-marker')) {
      const r = m.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const d = Math.hypot(c.x - corner.x, c.y - corner.y);
      if (!best || d < best.d) {
        best = { d, x: c.x, y: c.y, dx: c.x - corner.x, dy: c.y - corner.y };
      }
    }
    return best;
  }, selector);
}

test.beforeEach(async({ page }) => {
  await page.goto('/demo/');
});

test('markers appear on enable and clear on disable', async({ page }) => {
  await expect(page.locator(MARKER)).toHaveCount(0);

  await page.click(TOGGLE);
  await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(MARKER).first()).toBeVisible();
  expect(await page.locator(MARKER).count()).toBeGreaterThan(0);

  await page.click(TOGGLE);
  await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(MARKER)).toHaveCount(0);
});

test('the blocking layer absorbs host clicks while enabled', async({ page }) => {
  const count = page.locator('#demo-click-count');

  // OFF: the host handler runs normally.
  await page.locator('#demo-host-click').click();
  await expect(count).toHaveText('1');

  // ON: the transparent layer is topmost, so the click is absorbed (force: true to click through it).
  await page.click(TOGGLE);
  await expect(page.locator(MARKER).first()).toBeVisible();
  await page.locator('#demo-host-click').click({ force: true });
  await expect(count).toHaveText('1');
});

test('the popup renders above the markers (z-index)', async({ page }) => {
  await page.click(TOGGLE);
  await page.locator(MARKER).first().click();
  await expect(page.locator(POPUP)).toBeVisible();

  const z = await page.evaluate(() => {
    const popup = document.querySelector('.help-layer-popup');
    const marker = document.querySelector('.help-layer-marker');
    return {
      popup: parseInt(window.getComputedStyle(popup).zIndex, 10),
      marker: parseInt(window.getComputedStyle(marker).zIndex, 10),
    };
  });
  expect(z.popup).toBeGreaterThan(z.marker);
});

test('clicking a marker does not scroll the page (preventScroll)', async({ page }) => {
  await page.click(TOGGLE);
  await expect(page.locator(MARKER).first()).toBeVisible();

  // Target an element far down the page and scroll to it, so the page is scrolled by a meaningful
  // amount. A focus()-without-preventScroll on the popup (whose stale position is top:0) would jump
  // scrollY toward 0; preventScroll keeps it put. Click via mouse coords to avoid Playwright's own
  // auto-scroll-into-view.
  const target = page.locator('[data-help-id="apitarget"]');
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  const marker = await nearestMarkerTo(page, '[data-help-id="apitarget"]');

  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(100); // sanity: we really are scrolled down
  await page.mouse.click(marker.x, marker.y);
  await expect(page.locator(POPUP)).toBeVisible();
  const after = await page.evaluate(() => window.scrollY);

  expect(Math.abs(after - before)).toBeLessThan(2);
});

test('the blocking layer shows the scrim and not-allowed cursor (demo config)', async({ page }) => {
  await page.click(TOGGLE);
  await expect(page.locator(MARKER).first()).toBeVisible();
  await expect(page.locator(BLOCKING)).toBeVisible();

  const style = await page.evaluate(() => {
    const cs = window.getComputedStyle(document.querySelector('.help-layer-blocking-layer'));
    return { bg: cs.backgroundColor, cursor: cs.cursor };
  });
  expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.bg).not.toBe('transparent');
  expect(style.cursor).toBe('not-allowed');
});

test('a marker stays anchored to its target while scrolling', async({ page }) => {
  await page.click(TOGGLE);
  await expect(page.locator(MARKER).first()).toBeVisible();

  // If the marker follows on scroll, its offset from the target stays constant.
  const before = await nearestMarkerTo(page, '[data-help-id="save"]');
  await page.evaluate(() => window.scrollTo(0, 120));
  await page.waitForTimeout(80);
  const after = await nearestMarkerTo(page, '[data-help-id="save"]');

  expect(Math.abs(after.dx - before.dx)).toBeLessThan(3);
  expect(Math.abs(after.dy - before.dy)).toBeLessThan(3);
});

test('a marker on a position:fixed target uses the fixed strategy (no scroll jitter)', async({ page }) => {
  // A marker anchored to a fixed element must itself be position:fixed; otherwise it scrolls with the
  // document and visibly jitters while the fixed target stays put. A normal target keeps using absolute.
  await page.click(TOGGLE);
  await expect(page.locator(MARKER).first()).toBeVisible();

  const positions = await page.evaluate(() => {
    const nearestMarkerPosition = (sel) => {
      const t = document.querySelector(sel).getBoundingClientRect();
      const corner = { x: t.right, y: t.top };
      let best = null;
      for (const m of document.querySelectorAll('.help-layer-marker')) {
        const r = m.getBoundingClientRect();
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const d = Math.hypot(c.x - corner.x, c.y - corner.y);
        if (!best || d < best.d) {
          best = { d, el: m };
        }
      }
      return best ? window.getComputedStyle(best.el).position : null;
    };
    return {
      fixed: nearestMarkerPosition('.demo-fixedbar .demo-btn'),
      normal: nearestMarkerPosition('[data-help-id="save"]'),
    };
  });

  expect(positions.fixed).toBe('fixed');
  expect(positions.normal).toBe('absolute');
});

test('each card can reveal its implementation code', async({ page }) => {
  // The first card's <details> starts closed and opens to show a non-empty code snippet.
  const details = page.locator('.demo-card[data-snippet] details.demo-code').first();
  await expect(details).toHaveJSProperty('open', false);
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', true);
  const code = await details.locator('pre code').innerText();
  expect(code.length).toBeGreaterThan(20);
});

test('the footer gives an adoption path (install command + outbound links)', async({ page }) => {
  const footer = page.locator('footer.demo-footer');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('npm install help-layer');
  expect(await footer.locator('a[href*="github.com"]').count()).toBeGreaterThan(0);
  expect(await footer.locator('a[href*="npmjs.com/package/help-layer"]').count()).toBe(1);
});

test('the Customize card documents options and theme CSS variables', async({ page }) => {
  const blocks = page.locator('.demo-card[data-snippet="customize"] details.demo-code');
  await expect(blocks).toHaveCount(2); // options (JS) + theme (CSS)
  // The theme block (2nd) lists the CSS custom properties.
  await blocks.nth(1).locator('summary').click();
  await expect(blocks.nth(1).locator('pre code')).toContainText('--help-layer-marker-bg');
});

test('the HelpLayer DOM footprint returns to zero after disabling (teardown proof)', async({ page }) => {
  const footprint = () => page.evaluate(() =>
    document.querySelectorAll(
      '.help-layer-marker, .help-layer-popup, .help-layer-blocking-layer, style[data-help-layer-style]',
    ).length);

  expect(await footprint()).toBe(0);

  await page.click(TOGGLE);
  await expect(page.locator(MARKER).first()).toBeVisible();
  expect(await footprint()).toBeGreaterThan(0);

  await page.click(TOGGLE);
  await expect(page.locator(MARKER)).toHaveCount(0);
  expect(await footprint()).toBe(0);
});
