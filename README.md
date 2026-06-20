# HelpLayer

[![npm](https://img.shields.io/npm/v/help-layer.svg)](https://www.npmjs.com/package/help-layer)
[![license](https://img.shields.io/npm/l/help-layer.svg)](./LICENSE)
[![repo](https://img.shields.io/badge/GitHub-Y1--Effy%2FHelpLayer-181717?logo=github)](https://github.com/Y1-Effy/HelpLayer)

**English** | [日本語](./README.ja.md)

A **framework-agnostic "help mode" library you can drop into any existing web app**.
While the mode is ON, it shows a "?" marker next to each target element; clicking it opens a description popup.
It never touches the host app's own event listeners — a transparent blocking layer absorbs interaction instead — so you can adopt it without rewriting existing code.

- Only one dependency, [`@floating-ui/dom`](https://floating-ui.com/); lightweight (the prebuilt IIFE is ~30KB minified, with `@floating-ui/dom` bundled in)
- Pierces Shadow DOM, follows SPA dynamic elements, avoids marker-to-marker overlap, and auto-adjusts the popup at screen edges
- Fully cleans up the DOM, listeners, and styles it added when you turn it OFF

## Installation

```sh
npm install help-layer
```

If you'd rather drop it in with a single `<script>` and no bundler, load the prebuilt IIFE and a global `HelpLayer` is exposed (see below).

## Quick start

### 1. Define targets with a config object

Add `data-help-id` to a target element and pass a description keyed by that value.

```html
<button data-help-id="save">Save</button>
<button id="help-toggle">Help mode</button>
```

```js
import { initHelpLayer } from 'help-layer';

initHelpLayer({
  toggle: '#help-toggle',
  config: {
    save: { title: 'Save', text: 'Saves your input.' },
  },
});
```

### 2. Write it inline in your markup (no config needed)

If you'd rather keep descriptions next to your markup, just add `data-help-title` / `data-help-text` to an element and it becomes a target.
This can be combined with `config`, and **if the same key exists in `config`, the config wins**.

```html
<button data-help-title="Save" data-help-text="Saves your input.">Save</button>
```

```js
initHelpLayer({ toggle: '#help-toggle', config: {} });
```

### Use it with just a `<script>` (no bundler)

When loading from a CDN, we recommend **pinning the version** and adding **SRI (`integrity`)** so tampering is detectable.

```html
<script
  src="https://unpkg.com/help-layer@1.0.0/dist/help-layer.iife.js"
  integrity="sha384-……(replace with the published file's hash)"
  crossorigin="anonymous"></script>
<script>
  HelpLayer.initHelpLayer({
    toggle: '#help-toggle',
    config: { save: { title: 'Save', text: 'Saves your input.' } },
  });
</script>
```

> Generate the `integrity` hash from the actually published file, e.g.:
> `curl -s https://unpkg.com/help-layer@1.0.0/dist/help-layer.iife.js | openssl dgst -sha384 -binary | openssl base64 -A`
> (If you don't pin the version, the SRI will mismatch and the browser will refuse to load it.)

## Free placement (descriptions not bound to an element)

Specify `position` to place a marker at a page coordinate instead of on a specific element (useful for whole-screen descriptions, etc.).

```js
config: {
  intro: { title: 'About this screen', text: '…', position: { top: 80, left: 560 } },
}
```

## API

```js
const help = initHelpLayer(options);
help.enable();   // ON
help.disable();  // OFF
help.toggle();   // flip ON/OFF
help.isActive(); // boolean
help.open(key);  // open the description for the given key (auto-enables if OFF)
help.close();    // close the open description (the mode stays ON)
help.update(newConfig); // replace the config (rebuilds silently if ON; onEnable/onDisable are not called)
help.destroy();  // detach listeners + full cleanup
```

### Options

| Option | Type | Default | Description |
|------|------|------|------|
| `config` | `object` | (required) | key → `{ title, text, position? }`. The key is a `data-help-id` value or a free-placement key |
| `toggle` | `string \| HTMLElement` | none | the toggle element that switches ON/OFF. If omitted, control is programmatic-only |
| `attribute` | `string` | `'data-help-id'` | attribute name marking targets |
| `render` | `(record) => Node \| null` | none | render the body with your own DOM. Falls back to safe text display when nothing is returned (the title is always `record.title`) |
| `markerLabel` | `string` | `'?'` | the character shown on the marker |
| `markerPlacement` | `Placement` | `'top-end'` | corner to overlap the marker onto (`top-end`/`top-start`/`bottom-end`/`bottom-start`) |
| `popupPlacement` | `Placement` | `'bottom-start'` | initial popup placement (flips/shifts automatically at screen edges) |
| `nonce` | `string` | none | nonce to allow the injected `<style>` under a strict CSP (`style-src 'nonce-…'`); see below |
| `silent` | `boolean` | `false` | suppress the warning log for unregistered keys |

### Callbacks

| Option | When it fires |
|------|------|
| `onEnable` | right after the mode is turned ON |
| `onDisable` | right after the mode is turned OFF |
| `onOpen(record)` | when a description popup is opened |
| `onClose` | when a description popup is closed |

> Note: if a description is open when you call `update()` / `disable()` / `destroy()`, the cleanup closes it, so `onClose` fires once.

### Line breaks & links in the body

For safety the body is rendered with `textContent` by default (HTML is not interpreted), but `\n` is shown as a line break.
If you need links or styling, return your own DOM from `render`.

```js
initHelpLayer({
  config,
  render(record) {
    if (record.key !== 'save') {
      return null; // fall back to the default text display
    }
    const a = document.createElement('a');
    a.href = '/docs/save';
    a.textContent = 'Learn more';
    return a;
  },
});
```

> ⚠️ **Security:** the DOM returned by `render` is **inserted as-is and is not sanitized by the library**.
> If you use untrusted data (e.g. user input), don't build it with `innerHTML` — use `textContent`, or
> neutralize it with something like [DOMPurify](https://github.com/cure53/DOMPurify) before returning it (to prevent XSS).
> The default (no `render`) `title`/`text` rendering uses `textContent`, so it is safe.

## Theming (CSS custom properties)

You can change the look just by overriding the following variables in your host CSS. Dark-mode defaults
(`prefers-color-scheme: dark`) are built in, but any variable you set always wins via `var()`.

| Variable | Default | Purpose |
|------|------|------|
| `--help-layer-marker-size` | `22px` | marker diameter |
| `--help-layer-marker-bg` | `#2563eb` | marker background color |
| `--help-layer-marker-color` | `#fff` | marker text color |
| `--help-layer-popup-bg` | `#fff` | popup background color |
| `--help-layer-popup-color` | `#1f2933` | popup text color |
| `--help-layer-popup-max-width` | `280px` | popup max width |
| `--help-layer-popup-max-height` | `50vh` | popup body max height (the body scrolls when exceeded) |
| `--help-layer-accent` | `#1d4ed8` | focus ring color |
| `--help-layer-overlay-bg` | `transparent` | blocking-layer (scrim) background; e.g. `rgba(0,0,0,0.15)` to signal the host is inactive |
| `--help-layer-overlay-cursor` | `default` | cursor over the blocked area; e.g. `not-allowed` / `help` |

## Known limitations

- Closed Shadow DOM is unreachable from JS, so it is unsupported (only open shadow roots are pierced).
- The offset that overlaps the marker onto a corner assumes the default marker size (22px). Changing
  `--help-layer-marker-size` significantly may cause a slight drift.

## Security

- By design, `title` / `text` are rendered with `textContent` only; `innerHTML` / `eval` / `new Function` are **never used**.
- There is **no external communication** (`fetch`, etc.) and **no storage use** (`localStorage` / `cookie`) — it runs fully locally.
- The only path through which untrusted data could reach the DOM is the `render` option. Its return value is not sanitized, so
  neutralize it on the caller side if it contains user input (see "Line breaks & links in the body" above).
- The only runtime dependency is `@floating-ui/dom`. When using a CDN, pin the version and add SRI as noted above.

### Content Security Policy (CSP)

Because this library never uses `innerHTML` / `eval`, it **works as-is with Trusted Types
(`require-trusted-types-for 'script'`)**. Positioning is done by assigning directly to an element's `.style` (CSSOM),
which is outside the scope of CSP.

The one thing to watch out for is the **`<style>` tag** injected for appearance. Under a **strict CSP** whose
`style-src` has neither `'unsafe-inline'` nor a nonce, this `<style>` is blocked and the markers/popup get no styles.
On sites that operate with `style-src 'nonce-…'`, pass the per-request nonce via the `nonce` option.

```js
// pass the nonce your server issues per request (the same value as `style-src 'nonce-xxxx'` in the CSP header)
initHelpLayer({ config, toggle: '#help-toggle', nonce: pageNonce });
```

This lets the injected `<style nonce="xxxx">` be allowed by the CSP, so it renders correctly even under a strict CSP.
On sites that allow `'unsafe-inline'` or have no CSP, `nonce` is not needed.

## Development

| Purpose | Command |
|------|----------|
| Test | `npm test` |
| Lint / typecheck / all | `npm run lint` / `npm run typecheck` / `npm run check` |
| Run the demo | `npm run demo` |
| Build the distribution | `npm run build` (emits ESM, IIFE, and type definitions to `dist/`) |

## Repository

- Source: <https://github.com/Y1-Effy/HelpLayer>
- Issues & requests: <https://github.com/Y1-Effy/HelpLayer/issues>
- License: [ISC](./LICENSE)
