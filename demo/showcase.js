/**
 * Demo-only "value layer" shared by the Vanilla / React / Vue demos. It adds two things on top of any
 * HelpLayer demo, framework-agnostically and without touching the host DOM:
 *
 * 1. A first-run coach that guides the visitor through the core "aha": turn the mode ON, then click an
 *    "i" marker. Step 1 points at the toggle while OFF; step 2 appears once ON; both vanish after the
 *    first popup open (remembered via localStorage so repeat visits aren't nagged).
 * 2. A status pill showing the current mode and the live marker count.
 *
 * Everything here is a fixed-position overlay with `pointer-events: none`, so it never shifts the page
 * layout and never intercepts clicks — which keeps the real-browser e2e suite (which clicks the toggle,
 * markers, and host buttons) unaffected. The library itself is not involved; this is pure demo chrome.
 */
import { showcaseStrings } from './showcase-i18n.js';

const COACH_DONE_KEY = 'help-layer-demo-coach-done';
const STYLE_ID = 'hl-showcase-style';

// z-index 2147483001 sits above the library's blocking scrim (2147483000) so the chrome stays visible
// while help mode is ON, but below the popup (Z_POPUP = 2147483002 in src/style.js) so an open popup is
// never covered by the status pill or coach.
const CSS = `
.hl-sc-status {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 2147483001;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font: 600 12px/1 sans-serif;
  color: #fff;
  background: #475569;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.hl-sc-status[data-active="true"] { background: #0f6bff; }
.hl-sc-status__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
}
.hl-sc-status[data-active="true"] .hl-sc-status__dot {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
}
.hl-sc-status__count { font-weight: 500; opacity: 0.85; }

.hl-sc-coach {
  position: fixed;
  z-index: 2147483001;
  pointer-events: none;
  max-width: 240px;
  padding: 10px 14px;
  border-radius: 10px;
  font: 600 13px/1.4 sans-serif;
  color: #fff;
  background: #111827;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.hl-sc-coach[hidden] { display: none; }
.hl-sc-coach__arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
}
/* Step 1 sits under the toggle (top-right) and points up at it. */
.hl-sc-coach--step1 .hl-sc-coach__arrow {
  top: -14px;
  right: 22px;
  border-bottom-color: #111827;
}
/* Step 2 is centered near the top; arrow omitted (markers can be anywhere). */
.hl-sc-coach__step { display: flex; gap: 8px; align-items: baseline; }
.hl-sc-coach__num {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #0f6bff;
  font-size: 11px;
}
@media (prefers-reduced-motion: no-preference) {
  .hl-sc-coach--step1 { animation: hl-sc-bob 1.6s ease-in-out infinite; }
}
@keyframes hl-sc-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
`;

function injectStyleOnce() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Mount the demo showcase (status pill + first-run coach).
 *
 * @param {object} options
 * @param {HTMLElement} options.toggleEl the existing help-mode toggle (used to position step 1)
 * @param {'en'|'ja'} options.lang initial language
 * @returns {{
 *   setLang(lang: 'en'|'ja'): void,
 *   handleEnable(): void,
 *   handleDisable(): void,
 *   handleOpen(): void,
 *   destroy(): void,
 * }}
 */
export function mountShowcase({ toggleEl, lang }) {
  injectStyleOnce();
  let strings = showcaseStrings(lang);

  let active = false;
  let done = false;
  try {
    done = localStorage.getItem(COACH_DONE_KEY) === '1';
  } catch {
    // localStorage may throw in private/sandboxed contexts — treat as "not done yet".
  }

  // --- Status pill ---
  const status = document.createElement('div');
  status.className = 'hl-sc-status';
  status.setAttribute('data-active', 'false');
  const dot = document.createElement('span');
  dot.className = 'hl-sc-status__dot';
  const statusText = document.createElement('span');
  const countText = document.createElement('span');
  countText.className = 'hl-sc-status__count';
  status.append(dot, statusText, countText);
  document.body.appendChild(status);

  // --- Coach ---
  const coach = document.createElement('div');
  coach.className = 'hl-sc-coach';
  const coachArrow = document.createElement('span');
  coachArrow.className = 'hl-sc-coach__arrow';
  const coachBody = document.createElement('div');
  coachBody.className = 'hl-sc-coach__step';
  const coachNum = document.createElement('span');
  coachNum.className = 'hl-sc-coach__num';
  const coachLabel = document.createElement('span');
  coachBody.append(coachNum, coachLabel);
  coach.append(coachArrow, coachBody);
  document.body.appendChild(coach);

  // Everything HelpLayer adds to the DOM. Counting this and showing it drop to 0 on OFF is a live proof
  // of the "complete teardown" claim. Only the library's own nodes are counted — never the demo chrome
  // (hl-sc-* / #hl-showcase-style / .demo-code) — so the number genuinely returns to 0.
  const FOOTPRINT_SELECTOR =
    '.help-layer-marker, .help-layer-popup, .help-layer-blocking-layer, style[data-help-layer-style]';

  function footprintCount() {
    return document.querySelectorAll(FOOTPRINT_SELECTOR).length;
  }

  // Cache the last-written values so renderStatus only touches the DOM when something actually changed.
  // This matters because the MutationObserver below watches document.body: if renderStatus wrote the
  // textContent unconditionally, its own write would re-trigger the observer every frame (a busy loop).
  // Writing only on change lets the observer go idle once the status is stable.
  let lastActive = null;
  let lastStatusText = null;
  let lastCountText = null;

  function renderStatus() {
    if (active !== lastActive) {
      status.setAttribute('data-active', String(active));
      lastActive = active;
    }
    const nextStatusText = active ? strings.statusOn : strings.statusOff;
    if (nextStatusText !== lastStatusText) {
      statusText.textContent = nextStatusText;
      lastStatusText = nextStatusText;
    }
    // Shown in both states: a non-zero footprint while ON, and 0 once OFF tears everything down.
    const nextCountText = strings.domNodes.replace('{n}', String(footprintCount()));
    if (nextCountText !== lastCountText) {
      countText.textContent = nextCountText;
      lastCountText = nextCountText;
    }
  }

  function positionStep1() {
    // Place step 1 just below the toggle so its arrow points up at it.
    const r = toggleEl.getBoundingClientRect();
    coach.style.top = `${Math.round(r.bottom + 12)}px`;
    coach.style.right = `${Math.round(window.innerWidth - r.right)}px`;
    coach.style.left = 'auto';
  }

  function positionStep2() {
    // Centered near the top — markers can be anywhere, so don't anchor to one.
    coach.style.top = '64px';
    coach.style.left = '50%';
    coach.style.right = 'auto';
    coach.style.transform = 'translateX(-50%)';
  }

  function renderCoach() {
    if (done) {
      coach.hidden = true;
      return;
    }
    coach.hidden = false;
    coach.style.transform = '';
    if (!active) {
      coach.classList.add('hl-sc-coach--step1');
      coach.classList.remove('hl-sc-coach--step2');
      coachArrow.hidden = false;
      coachNum.textContent = '1';
      coachLabel.textContent = strings.coachStep1;
      positionStep1();
    } else {
      coach.classList.remove('hl-sc-coach--step1');
      coach.classList.add('hl-sc-coach--step2');
      coachArrow.hidden = true;
      coachNum.textContent = '2';
      coachLabel.textContent = strings.coachStep2;
      positionStep2();
    }
  }

  // Recount markers as they mount/unmount (enable/disable, SPA changes). Debounced via rAF so a burst
  // of mutations triggers a single recount.
  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (active) {
        renderStatus();
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const onResize = () => {
    if (!done && !active) {
      positionStep1();
    }
  };
  window.addEventListener('resize', onResize);

  renderStatus();
  renderCoach();

  return {
    setLang(nextLang) {
      strings = showcaseStrings(nextLang);
      renderStatus();
      renderCoach();
    },
    handleEnable() {
      active = true;
      renderStatus();
      renderCoach();
    },
    handleDisable() {
      active = false;
      renderStatus();
      renderCoach();
    },
    handleOpen() {
      if (done) {
        return;
      }
      done = true;
      try {
        localStorage.setItem(COACH_DONE_KEY, '1');
      } catch {
        // Ignore persistence failures; the coach still hides for this session.
      }
      renderCoach();
    },
    destroy() {
      observer.disconnect();
      if (frame) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener('resize', onResize);
      status.remove();
      coach.remove();
    },
  };
}
