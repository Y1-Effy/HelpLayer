# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For released versions, the full notes also live on the
[GitHub Releases](https://github.com/Y1-Effy/HelpLayer/releases) page.

## [Unreleased]

### Added
- **Localizable assistive-tech labels** — `markerAriaLabel` (build a marker's `aria-label` from the help
  title) and `closeLabel` (the popup close button's `aria-label`). Both default to the previous English
  strings (`Help: <title>` / `Close`), so this is non-breaking.
- **`help-layer` CLI** — `check` (static config audit: bound / inline / unused / missing ids) and
  `scaffold` (generate a config stub from your markup), plus a runtime `diagnose()` that reports how the
  config maps onto the live DOM (also on `window.helpLayerDiagnose` with `debug: true`). ([#23])
- **Performance docs** — the README now documents how the marker-count numbers are measured and how to
  reproduce them, and links the bundled stress page (surfaced in the demo nav and published). ([#24])

### Fixed
- **Balanced open/close callbacks** — `onClose` now fires when switching directly from one marker's popup
  to another's (previously only `onOpen` fired for the new one). ([#24])

### Changed
- Demo refreshed to the current zero-dependency / config-audit build: `diagnose()` + CLI showcase, a live
  `markerPlacement` / `popupPlacement` playground, and stale-content fixes (Floating UI references, pinned
  version, dependency count). ([#24])
- Expanded regression coverage (popup-switch `onClose`, Escape two-stage, scrim-click close, Shadow DOM /
  free-placement markers, SPA dynamic mount, and the new a11y label options).

## [1.3.0] - 2026-06-26

Zero-dependency release. Non-breaking, drop-in upgrade from 1.2.0.

### Changed
- **Zero runtime dependencies** — popup positioning (offset / flip / shift) and tracking are now
  self-implemented; `@floating-ui/dom` is removed. The IIFE/CDN bundle shrinks ~34.6KB → ~20.8KB, and
  many-marker tracking is faster. A one-line seam (`src/floating.js`) keeps Floating UI swappable back in.

### Added
- Popup accessibility polish and a WCAG 2.5.8 minimum target-size bump for markers.

## [1.2.0] - 2026-06-26

Accessibility release. Non-breaking, drop-in upgrade from 1.1.0.

### Added
- **Background isolated from assistive tech** — while ON, the host is removed from the accessibility tree
  via `inert`; only the markers, popup, and toggle stay reachable.
- Unique popup ids + `aria-modal` so multiple instances on one page don't collide.
- Markers follow target visibility (hide when a target becomes `display:none`, return when shown).

### Changed
- OSS hardening: security policy, coverage CI, and a packaging fix.

## [1.1.0] - 2026-06-21

### Added
- **`position:fixed` target support** — markers/popups anchored inside a fixed subtree use a fixed
  strategy, so they no longer jitter while the page scrolls.
- Self-contained showcase demo site (per-card "view source", adoption footer, theme docs), auto-deployed
  to GitHub Pages; embedded demo GIFs and substantially expanded en/ja READMEs.

## [1.0.1] - 2026-06-21

Runtime hardening release. No public API changes — non-breaking, drop-in upgrade from 1.0.0.

### Fixed
- Resilient teardown and isolated user callbacks (a throw can no longer half-tear-down help mode or
  strand DOM / observers / styles; `render` falls back to safe text on error).
- Fail-fast validation of the options object, the `toggle` type, and free-placement coordinates.
- No leaked promise rejections from per-frame positioning; robust SPA MutationObserver tracking.

## [1.0.0] - 2026-06-20

### Added
- Initial release: a framework-agnostic, drop-in "help mode" that never touches the host app's events.
  Toggleable help markers with description popups, Shadow DOM piercing, SPA dynamic elements, marker
  overlap avoidance, screen-edge flip/shift, focus management, and full teardown on OFF.

[Unreleased]: https://github.com/Y1-Effy/HelpLayer/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/Y1-Effy/HelpLayer/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Y1-Effy/HelpLayer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Y1-Effy/HelpLayer/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/Y1-Effy/HelpLayer/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Y1-Effy/HelpLayer/releases/tag/v1.0.0
[#23]: https://github.com/Y1-Effy/HelpLayer/pull/23
[#24]: https://github.com/Y1-Effy/HelpLayer/pull/24
