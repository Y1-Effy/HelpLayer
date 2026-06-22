/**
 * Semantic background blocking for assistive technology (AT).
 *
 * The clip-path layer / focus containment / key suppression block pointer, physical focus, and
 * physical keys, but a screen reader's virtual cursor (browse mode) reads and can activate background
 * content regardless of focus or hit-testing. So while ON we also remove the host from the
 * accessibility tree with `inert` (which both excludes from the a11y tree and suppresses interaction),
 * giving AT users the same "host is inactive" guarantee.
 *
 * Why operate at document.body's top level: `inert` is inherited and cannot be cancelled on a
 * descendant of an inert subtree. The toggle is host-owned and may be deeply nested, so—exactly like
 * the clip-path "hole" that lets the toggle show through—we inert each body child that is neither a
 * library node nor the branch containing the toggle. The toggle's own top-level branch stays
 * reachable (a bounded leak when the toggle is nested; none when it's a direct body child).
 */

const ELEMENT_NODE = 1;

/**
 * @param {object} state teardown registry
 * @param {object} params
 * @param {HTMLElement|null} params.toggleEl the toggle (must stay reachable), or null for programmatic-only
 * @param {(el: Element) => boolean} params.isLibraryNode whether a body child belongs to the library UI
 */
export function isolateBackgroundFromAT(state, { toggleEl, isLibraryNode }) {
  /** @type {Set<Element>} */
  const isolated = new Set();

  /** @param {Node} node */
  function isolate(node) {
    if (node.nodeType !== ELEMENT_NODE) {
      return;
    }
    const el = /** @type {Element} */ (node);
    // Skip library UI, the toggle's branch, and anything the host already made inert (so restore
    // doesn't clobber the host's own inert state).
    if (
      isLibraryNode(el) ||
      (toggleEl && (el === toggleEl || el.contains(toggleEl))) ||
      el.hasAttribute('inert')
    ) {
      return;
    }
    el.toggleAttribute('inert', true);
    isolated.add(el);
  }

  for (const child of [...document.body.children]) {
    isolate(child);
  }

  // The host may add top-level nodes while ON (SPA route changes, portals, ...). Keep them isolated
  // too. Only direct body children matter here, so childList without subtree is enough.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach(isolate);
    }
  });
  observer.observe(document.body, { childList: true });

  state.track(() => {
    observer.disconnect();
    // Remove inert only from the nodes we added it to (leave any host-owned inert untouched).
    isolated.forEach((el) => el.removeAttribute('inert'));
    isolated.clear();
  });
}
