import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

// gifenc ships CommonJS without an `exports` map, so named ESM imports fail — destructure the default.
const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Record the vanilla demo into an animated GIF for the README, using the same demo server the e2e
 * tests drive (scripts/serve.js on :5500). Playwright screenshots are PNG; we decode them to RGBA
 * with pngjs and encode a palette GIF with gifenc, so the whole pipeline is pure JS (no ffmpeg).
 *
 * The story we capture: idle UI -> turn help mode ON (markers appear) -> click the Save marker
 * (popup opens) -> hold -> turn OFF (everything cleans up). Frame rate favors legibility over
 * smoothness: a few frames per state plus long holds on the moments worth reading.
 */

const PORT = 5500;
const ORIGIN = `http://localhost:${PORT}`;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// One GIF per README: demo.gif (Japanese) for README.ja.md, demo.en.gif (English) for README.md.
// The demo's only difference between the two is its UI text; the capture story is identical.
const TARGETS = [
  { lang: 'ja', file: 'demo.gif' },
  { lang: 'en', file: 'demo.en.gif' },
];

const TOGGLE = '#help-layer-toggle';
const MARKER = '.help-layer-marker';
const POPUP = '.help-layer-popup';
const SAVE = '[data-help-id="save"]';

// Capture region: the header (toggle) plus the first card (the Save form), where the action happens.
const CLIP = { x: 0, y: 0, width: 860, height: 460 };

/** Poll the demo server until it answers, so we don't navigate before it's listening. */
function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(`${ORIGIN}/demo/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error('demo server did not start in time'));
          return;
        }
        setTimeout(probe, 150);
      });
    };
    probe();
  });
}

/**
 * Drive the page through the story, snapping the clip region into `frames` as we go. Each frame
 * carries its own `delay` (ms). Reading moments are single long-`delay` holds; the moving parts
 * (cursor glides, state changes) are burst-recorded so they play back as motion instead of cuts.
 */
async function capture(page, frames) {
  const shoot = async(delay) => {
    const buffer = await page.screenshot({ clip: CLIP });
    frames.push({ png: PNG.sync.read(buffer), delay });
  };

  // Burst-capture frames as fast as we can for ~durationMs, tagging each with its real elapsed time
  // (floored) so the GIF plays back at the speed the motion actually happened. Region screenshots
  // run tens of ms each, so a short transition yields several frames where shoot() captured one.
  const record = async(durationMs) => {
    const end = Date.now() + durationMs;
    let prev = Date.now();
    do {
      const buffer = await page.screenshot({ clip: CLIP });
      const now = Date.now();
      frames.push({ png: PNG.sync.read(buffer), delay: Math.max(30, now - prev) });
      prev = now;
    } while (Date.now() < end);
  };

  // Kick off the injected cursor's CSS glide toward a target (no settle wait — record() spans it).
  const moveCursorTo = async(selector) => {
    await page.evaluate((sel) => window.__moveHelpCursor(sel), selector);
  };

  // 1. Idle: the host UI as users normally see it, with no markers.
  await shoot(900);

  // 2. Glide to the toggle and turn the mode ON; markers appear next to every target.
  await moveCursorTo(TOGGLE);
  await record(450);
  await page.click(TOGGLE);
  await page.locator(MARKER).first().waitFor({ state: 'visible' });
  await record(300);
  await shoot(900);

  // 3. Glide the cursor onto the Save marker itself, then click it to open the popup right there.
  // Markers aren't selectable by their target, so find the one nearest the Save element's top-right
  // corner (same proximity trick the e2e suite uses) and move the synthetic cursor onto its center.
  const saveMarker = await page.evaluate((sel) => {
    const tr = document.querySelector(sel).getBoundingClientRect();
    const corner = { x: tr.right, y: tr.top };
    let best = null;
    for (const m of document.querySelectorAll('.help-layer-marker')) {
      const r = m.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const d = Math.hypot(c.x - corner.x, c.y - corner.y);
      if (!best || d < best.d) {
        best = { d, x: c.x, y: c.y };
      }
    }
    window.__moveHelpCursorTo(best.x, best.y);
    return best;
  }, SAVE);
  await record(500); // glide onto the marker
  await shoot(450); // let the cursor visibly rest on the marker before the click
  await page.mouse.click(saveMarker.x, saveMarker.y);
  await page.locator(POPUP).waitFor({ state: 'visible' });
  await record(300);
  await shoot(2000); // hold so the description is readable

  // 4. Close the popup with the cursor too (click its × button), then turn the mode OFF to show cleanup.
  const closeBtn = await page.evaluate(() => {
    const r = document.querySelector('.help-layer-popup__close').getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    window.__moveHelpCursorTo(c.x, c.y);
    return c;
  });
  await record(450); // glide to the close button
  await page.mouse.click(closeBtn.x, closeBtn.y);
  await page.locator(POPUP).waitFor({ state: 'hidden' });
  await record(250);
  await shoot(700);
  await moveCursorTo(TOGGLE);
  await record(450);
  await page.click(TOGGLE);
  await page.locator(MARKER).first().waitFor({ state: 'detached' });
  await record(300);
  await shoot(1300);
}

/** Encode RGBA frames into a single looping GIF buffer with a per-frame palette. */
function encodeGif(frames) {
  const gif = GIFEncoder();
  for (const { png, delay } of frames) {
    const { data, width, height } = png;
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

/** Record one language's demo into `outPath`, reusing the already-running server and browser. */
async function recordOne(browser, lang, outPath) {
  const page = await browser.newPage({
    viewport: { width: CLIP.width, height: CLIP.height },
    // 2x so text renders crisp in the GIF (CLIP stays in CSS px; the captured PNG doubles in
    // device px). Bigger file, but legibility is the point here.
    deviceScaleFactor: 2,
  });
  try {
    // The demo reads its language from localStorage (key from demo/i18n.js); seed it before any page
    // script runs to avoid a flash of the default language on the first frame.
    await page.addInitScript((code) => {
      try {
        localStorage.setItem('help-layer-demo-lang', code);
      } catch {
        // localStorage may be unavailable; the demo falls back to its default, which is acceptable.
      }
    }, lang);

    await page.goto(`${ORIGIN}/demo/`, { waitUntil: 'networkidle' });
    // The hero copy is filled in by the demo's i18n; wait for it so the first frame isn't blank.
    await page.locator('#demo-hero-tagline').filter({ hasText: /\S/ }).waitFor();

    // A synthetic cursor: Playwright doesn't paint the OS pointer into screenshots, so we draw one
    // and teleport it onto a target's center. Pure visual aid; it never receives events.
    await page.evaluate(() => {
      const dot = document.createElement('div');
      dot.style.cssText = [
        'position:fixed', 'width:18px', 'height:18px', 'margin:-2px 0 0 -2px',
        'border:2px solid #111', 'border-radius:50% 50% 50% 0', 'background:rgba(255,255,255,0.85)',
        'transform:rotate(0deg)', 'z-index:2147483647', 'pointer-events:none',
        'transition:left .35s ease, top .35s ease', 'box-shadow:0 1px 3px rgba(0,0,0,0.4)',
      ].join(';');
      document.body.appendChild(dot);
      // Move to absolute viewport coords (markers/popup buttons have no stable selector to target).
      window.__moveHelpCursorTo = (x, y) => {
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
      };
      window.__moveHelpCursor = (sel) => {
        const el = document.querySelector(sel);
        if (!el) {
          return;
        }
        const r = el.getBoundingClientRect();
        window.__moveHelpCursorTo(r.left + r.width / 2, r.top + r.height / 2);
      };
    });

    const frames = [];
    await capture(page, frames);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, encodeGif(frames));

    const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`wrote ${path.relative(ROOT_DIR, outPath)} (${lang}, ${frames.length} frames, ${kb} KB)`);
  } finally {
    await page.close();
  }
}

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'serve.js')], {
    stdio: 'ignore',
  });

  let browser;
  try {
    await waitForServer(30000);
    browser = await chromium.launch();
    for (const { lang, file } of TARGETS) {
      await recordOne(browser, lang, path.join(ROOT_DIR, 'assets', file));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
