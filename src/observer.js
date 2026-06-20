/**
 * DOM observation and Shadow DOM-piercing traversal.
 *
 * A normal querySelectorAll does not cross shadow boundaries, so queryAllDeep walks open
 * shadowRoots recursively. A closed shadowRoot is unreachable from JS, so it is unsupported
 * (a known limitation).
 *
 * For SPA support, while ON a MutationObserver watches for additions/removals of data-help-id
 * elements and mounts/unmounts markers dynamically.
 */

const ELEMENT_NODE = 1;

/**
 * Internal worker that traverses everything under root (including inside open shadowRoots) once,
 * collecting both selector-matching elements and shadowRoots at the same time. It uses a single
 * `querySelectorAll('*')` pass and does both the `matches` test and shadowRoot detection within it.
 * The goal is to cut what used to be two separate full scans ("collect matches" and "find shadow
 * hosts") down to one (lightening the hot path that reacts to host DOM changes while ON).
 * @param {ParentNode} root
 * @param {string} selector
 * @param {(el: Element) => void} [onMatch]
 * @param {(shadow: ShadowRoot) => void} [onShadowRoot]
 */
function walkDeep(root, selector, onMatch, onShadowRoot) {
  if (typeof root.querySelectorAll !== 'function') {
    return;
  }
  // querySelectorAll('*') does not cross shadow boundaries, so run it flatly once per root and,
  // when a shadowRoot is found, recurse into it right there (depth-first).
  root.querySelectorAll('*').forEach((el) => {
    if (onMatch && el.matches(selector)) {
      onMatch(el);
    }
    if (el.shadowRoot) {
      if (onShadowRoot) {
        onShadowRoot(el.shadowRoot);
      }
      walkDeep(el.shadowRoot, selector, onMatch, onShadowRoot);
    }
  });
}

/**
 * Collect every element under root (including inside open shadowRoots) matching selector.
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {Element[]}
 */
export function queryAllDeep(root, selector) {
  const results = [];
  walkDeep(root, selector, (el) => results.push(el));
  return results;
}

/**
 * Collect every open shadowRoot under root (excluding root itself).
 * @param {ParentNode} root
 * @returns {ShadowRoot[]}
 */
export function collectShadowRoots(root) {
  const roots = [];
  walkDeep(root, '*', null, (shadow) => roots.push(shadow));
  return roots;
}

/**
 * Traverse a node and its descendants (including shadow) once, returning both selector-matching
 * elements and the descendants' open shadowRoots together. Used in MutationObserver added-node
 * handling to fold "collect matches" and "add shadow observation" into one traversal per subtree.
 * @param {Node} node
 * @param {string} selector
 * @returns {{ matches: Element[], shadowRoots: ShadowRoot[] }}
 */
function scanSubtree(node, selector) {
  /** @type {Element[]} */
  const matches = [];
  /** @type {ShadowRoot[]} */
  const shadowRoots = [];
  if (node.nodeType !== ELEMENT_NODE) {
    return { matches, shadowRoots };
  }
  // node itself is not included in querySelectorAll('*'), so test it separately (equivalent to the former matchingWithin).
  const el = /** @type {Element} */ (node);
  if (typeof el.matches === 'function' && el.matches(selector)) {
    matches.push(el);
  }
  // The added node itself may be a shadow host. walkDeep only inspects the shadowRoots of
  // descendants (querySelectorAll('*') never includes the root), so handle the node's own
  // shadowRoot here before descending into the light-DOM subtree.
  if (el.shadowRoot) {
    shadowRoots.push(el.shadowRoot);
    walkDeep(el.shadowRoot, selector, (m) => matches.push(m), (shadow) => shadowRoots.push(shadow));
  }
  walkDeep(el, selector, (m) => matches.push(m), (shadow) => shadowRoots.push(shadow));
  return { matches, shadowRoots };
}

/**
 * While ON, watch root and all shadowRoots under it, notifying on entry/exit of selector-matching elements.
 * If an added element has a new shadowRoot, that shadowRoot is also added to the observation.
 *
 * @param {object} params
 * @param {ParentNode} [params.root=document]
 * @param {string} params.selector
 * @param {(el: Element) => void} params.onAdded
 * @param {(el: Element) => void} params.onRemoved
 * @returns {{ disconnect(): void }}
 */
export function createMutationWatcher({ root = document, selector, onAdded, onRemoved }) {
  const observed = new Set();

  const handle = (records) => {
    for (const record of records) {
      // For added nodes, get both "matching elements" and "shadowRoots to start observing" in one traversal per subtree.
      record.addedNodes.forEach((node) => {
        const { matches, shadowRoots } = scanSubtree(node, selector);
        matches.forEach((el) => onAdded(el));
        shadowRoots.forEach(observe);
      });
      record.removedNodes.forEach((node) => {
        scanSubtree(node, selector).matches.forEach((el) => onRemoved(el));
      });
    }
  };

  const observer = new MutationObserver(handle);

  function observe(target) {
    if (observed.has(target)) {
      return;
    }
    observed.add(target);
    observer.observe(target, { childList: true, subtree: true });
  }

  observe(root);
  collectShadowRoots(root).forEach(observe);

  return {
    disconnect() {
      observer.disconnect();
      observed.clear();
    },
  };
}
