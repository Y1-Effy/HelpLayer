/**
 * Positioning seam. Every other module imports positioning from here (anchorPopup / watchReference /
 * makeVirtualElement / isFixedReference / isReferenceHidden), so the backend can be swapped in one
 * place without touching consumers.
 *
 * Default: ./floating.self.js — dependency-free.
 * To switch back to Floating UI, change the line below to:
 *   export * from './floating.floatingui.js';
 * and move `@floating-ui/dom` from devDependencies back to dependencies (see that file's header).
 */
export * from './floating.self.js';
