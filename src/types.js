/**
 * Shared type definitions (JSDoc only — no runtime code).
 *
 * `Placement` mirrors the placement strings Floating UI accepts, defined locally so the library (and
 * its generated .d.ts) carry no dependency on @floating-ui/dom. A placement is a side, optionally
 * suffixed with an alignment: `top` / `top-start` / `top-end` / ... for the four sides.
 *
 * @typedef {(
 *   'top' | 'top-start' | 'top-end' |
 *   'right' | 'right-start' | 'right-end' |
 *   'bottom' | 'bottom-start' | 'bottom-end' |
 *   'left' | 'left-start' | 'left-end'
 * )} Placement
 */

// No runtime exports; this module exists solely to host the typedefs above.
export {};
