/**
 * Map the help-item array returned by normalizeConfig() onto actual DOM elements or free
 * placements, producing the "help records" the marker manager works with. Reads the DOM only;
 * never writes.
 *
 * Behavior of this module:
 * - Searches with queryAllDeep for Shadow DOM support.
 * - Emits a marker for each of multiple elements sharing the same data-help-id (correct in practice).
 *   Because of that, an element-bound record uses "the element itself" as its id (identity).
 * - A free-placement record uses the config key as its id.
 *
 * Resolution order for title/text:
 * - First look up config by the `data-help-id` value (config always wins).
 * - If config has no match, use the element's `data-help-title` / `data-help-text` as an inline definition.
 *   This lets you adopt the library with markup alone, without a config object.
 */
import { queryAllDeep } from './observer.js';

/**
 * One marker's worth of "help record". Produced by matcher; consumed by markers/popup/toggle/index — the shared contract.
 * Other modules reference it via `import('./matcher.js').HelpRecord` (the same style as config.js's HelpConfig).
 * @typedef {object} HelpRecord
 * @property {Element|string} id for element-bound, the target element itself; for free placement, the config key string
 * @property {'element'|'free'} kind
 * @property {string|null} key config key (null for an inline-definition-only element)
 * @property {string} title
 * @property {string} text
 * @property {Element} [target] the target element when kind:'element'
 * @property {{top:number,left:number}} [position] the placement coordinate when kind:'free'
 */

// Attribute names used for inline definitions (fixed defaults so as not to grow the API).
export const TITLE_ATTR = 'data-help-title';
export const TEXT_ATTR = 'data-help-text';

/**
 * Build the selector to scan. In addition to elements with `data-help-id` (default), also pick up
 * elements that only have an inline definition (`data-help-title`).
 * A single source of truth so collectElementRecords and the MutationObserver share the same condition.
 * @param {string} [attribute] attribute name marking targets (default 'data-help-id')
 */
export function targetSelector(attribute = 'data-help-id') {
  return `[${attribute}], [${TITLE_ATTR}]`;
}

/** Turn element-bound items into a key->item Map. */
export function elementConfigMap(items) {
  const map = new Map();
  for (const item of items) {
    if (item.kind === 'element') {
      map.set(item.key, item);
    }
  }
  return map;
}

/**
 * Turn free-placement items into records.
 * @returns {HelpRecord[]}
 */
export function freeRecords(items) {
  return items
    .filter((item) => item.kind === 'free')
    .map((item) => ({
      id: item.key,
      kind: 'free',
      key: item.key,
      title: item.title,
      text: item.text,
      position: item.position,
    }));
}

/**
 * Build the help record for a single element. title/text prefer config; if absent, fall back to
 * the element's data-help-title / data-help-text (inline definition). If neither source yields
 * both title and text, return null (not a target).
 * (Used by both the initial scan and SPA dynamic additions.)
 * @param {string} [attribute] attribute name marking targets (default 'data-help-id')
 * @returns {HelpRecord|null}
 */
export function recordForElement(el, configMap, attribute = 'data-help-id') {
  const key = el.getAttribute(attribute);
  // config wins. If there's no matching key, fall back to the inline attributes.
  const item = key != null ? configMap.get(key) : undefined;
  const title = item ? item.title : el.getAttribute(TITLE_ATTR);
  const text = item ? item.text : el.getAttribute(TEXT_ATTR);
  // If both title and text aren't present, it's not a target (treated as unregistered).
  if (!title || !text) {
    return null;
  }
  return {
    id: el,
    kind: 'element',
    key,
    title,
    text,
    target: el,
  };
}

/**
 * Scan target-attribute elements under root (including Shadow DOM) and collect element-bound records.
 * Targets not in config are warned about and ignored (non-fatal). silent:true suppresses the warning.
 * @param {object[]} items
 * @param {ParentNode} [root]
 * @param {object} [options]
 * @param {boolean} [options.silent] don't warn on unregistered keys
 * @param {string} [options.attribute] attribute name marking targets (default 'data-help-id')
 * @returns {HelpRecord[]}
 */
export function collectElementRecords(items, root = document, { silent = false, attribute = 'data-help-id' } = {}) {
  const configMap = elementConfigMap(items);
  const records = [];

  queryAllDeep(root, targetSelector(attribute)).forEach((el) => {
    const record = recordForElement(el, configMap, attribute);
    if (!record) {
      if (!silent) {
        const key = el.getAttribute(attribute);
        console.warn(
          key != null
            ? `[help-layer] element with ${attribute}="${key}" has no matching helpConfig entry or inline ${TITLE_ATTR}/${TEXT_ATTR}`
            : `[help-layer] element needs both ${TITLE_ATTR} and ${TEXT_ATTR} (or a ${attribute} matching helpConfig)`,
        );
      }
      return;
    }
    records.push(record);
  });

  return records;
}
