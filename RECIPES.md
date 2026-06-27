# HelpLayer — Recipes on top of the public API

**English** | [日本語](./RECIPES.ja.md)

HelpLayer keeps its core small on purpose: a help **mode** you toggle, markers that open a
description popup, and full cleanup on OFF. Analytics, deep-linking, a search palette, framework
glue — those are intentionally **out of scope for the library** (see the DAP note in the
[README](./README.md#why-helplayer-vs-existing-options)).

But "out of scope for the core" doesn't mean "hard to get." The public API is a small, composable
seam — lifecycle callbacks plus an `open(key)` handle — so you can build all of the above **on top,
in a few lines, with no fork and no core changes**. This document collects four such recipes.

Everything here uses only the public API:

```js
const help = initHelpLayer(options);
help.open(key);         // opens the entry for `key`; auto-enables the mode if it's OFF
help.close();           // closes the open popup (mode stays ON)
help.update(config);    // swap the config (rebuilds while ON)
help.destroy();         // detach listeners + full cleanup
help.isActive();        // boolean
```

…and these callbacks:

| Callback | When it fires |
|---|---|
| `onEnable` | right after the mode turns ON |
| `onDisable` | right after the mode turns OFF |
| `onOpen(record)` | when a description popup opens |
| `onClose` | when a description popup closes |

`record` carries `key` (the stable config-key string), `title`, and `kind` (`'element' \| 'free'`).
See the [API section of the README](./README.md#api) for the full reference.

---

## 1. Analytics: count mode toggles and per-entry views

The four callbacks are an instrumentation seam. Wire them to any sink — your own endpoint, PostHog,
GA4 — and you get "how often the mode is used" and "which explanation was shown how many times."

```js
function track(event, props = {}) {
  // Pick ONE sink:
  navigator.sendBeacon?.('/collect', JSON.stringify({ event, ...props, t: Date.now() }));
  // window.posthog?.capture(event, props);
  // window.gtag?.('event', event, props);
}

// onClose carries no record, so remember what was opened to measure dwell time.
let openedId = null;
let openedAt = 0;

const help = initHelpLayer({
  config,
  toggle: '#help-toggle',
  onEnable:  () => track('help_mode_on'),
  onDisable: () => track('help_mode_off'),
  onOpen: (record) => {
    openedId = record.key ?? record.title; // see the note below on key vs id
    openedAt = Date.now();
    track('help_open', { id: openedId, kind: record.kind });
  },
  onClose: () => {
    if (openedId !== null) {
      track('help_close', { id: openedId, dwellMs: Date.now() - openedAt });
      openedId = null;
    }
  },
});
```

| Event | Metric you can build |
|---|---|
| `help_mode_on` / `help_mode_off` | adoption / how often help mode is entered |
| `help_open` (by `id`) | which entries are viewed, and how often |
| `help_close` (`dwellMs`) | how long each explanation is read |

> **Use `record.key`, not `record.id`.** For element-bound entries `record.id` is the target
> **element itself** (not serializable); `record.key` is the stable config-key string. Fall back to
> `record.title` for inline-only targets that have no key.

> `onClose` also fires once when `update()` / `disable()` / `destroy()` close an open popup during
> cleanup, and once for the previous entry when you open a different one while a popup is already
> showing (switching markers), so the dwell timing above stays balanced.

---

## 2. Deep-linking: `?help=<key>` opens an explanation on load

Because `open(key)` auto-enables the mode, a URL like `?help=save` can drop a visitor straight onto
a specific explanation — handy for support replies and docs ("see the help for *this* button").

```js
const help = initHelpLayer({ config, toggle: '#help-toggle' });

const key = new URLSearchParams(location.search).get('help');
if (key && config[key]) {
  // For element-bound entries, bring the target into view before opening.
  document
    .querySelector(`[data-help-id="${CSS.escape(key)}"]`)
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  help.open(key); // auto-enables if the mode is OFF
}
```

You can keep the URL in sync the other way too — write `?help=<key>` in `onOpen` and clear it in
`onClose` with `history.replaceState`, so the address bar always reflects what's open and is
copy-pasteable.

---

## 3. Help search: a command palette over your entries

The `config` you pass in is also a directory of every explanation. List it, filter as the user
types, and call `open(key)` on pick — great for dense screens where hunting for the right marker is
slower than searching.

```js
// `config` is the same object you passed to initHelpLayer.
const entries = Object.entries(config).map(([key, v]) => ({ key, title: v.title }));

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  const hits = entries.filter(
    (e) => e.key.toLowerCase().includes(q) || e.title.toLowerCase().includes(q),
  );
  resultList.replaceChildren(
    ...hits.map((e) => {
      const li = document.createElement('li');
      li.textContent = e.title;
      li.dataset.key = e.key;
      return li;
    }),
  );
});

resultList.addEventListener('click', (event) => {
  const key = event.target.closest('[data-key]')?.dataset.key;
  if (key) {
    help.open(key); // scrolls the popup open; auto-enables if OFF
  }
});
```

---

## 4. Framework glue: mount/unmount with React or Vue

`initHelpLayer` returns a handle and `destroy()` cleans up completely, which maps directly onto
component lifecycles. Init on mount, destroy on unmount, and call `update(config)` when the data
changes.

**React** — a small hook:

```jsx
import { useEffect, useRef } from 'react';
import { initHelpLayer } from 'help-layer';

export function useHelpLayer(options) {
  const ref = useRef(null);

  useEffect(() => {
    const help = initHelpLayer(options);
    ref.current = help;
    return () => help.destroy(); // full cleanup on unmount
    // Init once: keep `options` stable (define it outside render or wrap in useMemo).
  }, []);

  // Push config changes without re-initializing.
  useEffect(() => {
    ref.current?.update(options.config);
  }, [options.config]);

  return ref;
}
```

**Vue** — `<script setup>`:

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { initHelpLayer } from 'help-layer';

let help;
onMounted(() => {
  help = initHelpLayer({ config, toggle: '#help-toggle' });
});
onUnmounted(() => help?.destroy());
</script>
```

---

## A note on privacy

Recipe 1 emits events from the client; **you** decide what leaves the page and where it goes.
Respect the user's consent settings, keep personally identifiable information out of your `config`
keys (they become analytics labels), and prefer `navigator.sendBeacon` so a closing tab doesn't drop
the final `help_close`.
