/**
 * Runtime diagnostics: scan the live DOM right now and report how the helpConfig maps onto it. This
 * complements the static `help-layer check` CLI — the CLI can only see string-literal ids in source,
 * whereas this runs in the browser and therefore also catches dynamically-computed ids and SPA-mounted
 * elements. Reads the DOM only (never writes), mirroring matcher.js's resolution (config wins, else the
 * element's inline data-help-title / data-help-text, both required).
 *
 * Exposed through the controller as `diagnose()` and, with `debug: true`, as `window.helpLayerDiagnose`
 * for quick use from the devtools console.
 */
import { normalizeConfig } from './config.js';
import { elementConfigMap, freeRecords, recordForElement, targetSelector } from './matcher.js';
import { queryAllDeep } from './observer.js';

/**
 * @typedef {object} RuntimeReport
 * @property {Array<{ key: string, elements: Element[], count: number }>} bound config keys matched to elements in the DOM
 * @property {Array<{ id: string|null, element: Element }>} inline elements rendering via inline title+text (no config)
 * @property {Array<{ id: string|null, element: Element }>} missingConfig elements with the attribute but no config and no usable inline def
 * @property {Array<{ key: string }>} unmatchedConfig config(element) keys with no matching element in the DOM
 * @property {Array<{ key: string, position: { top: number, left: number } }>} free free-placement entries
 * @property {{ bound: number, inline: number, missingConfig: number, unmatchedConfig: number, free: number }} summary
 */

/**
 * Build the runtime diagnostics report for the given config against the current DOM.
 * @param {import('./config.js').HelpConfig} config
 * @param {object} [options]
 * @param {string} [options.attribute] attribute marking targets (default 'data-help-id')
 * @param {ParentNode} [options.root] subtree to scan (default document)
 * @returns {RuntimeReport}
 */
export function buildRuntimeReport(config, { attribute = 'data-help-id', root = document } = {}) {
  const items = normalizeConfig(config);
  const configMap = elementConfigMap(items);
  const elementKeys = new Set([...configMap.keys()]);

  const seen = new Set();
  /** @type {Map<string, Element[]>} */
  const boundMap = new Map();
  const inline = [];
  const missingConfig = [];

  queryAllDeep(root, targetSelector(attribute)).forEach((el) => {
    const key = el.getAttribute(attribute);
    if (key != null && configMap.has(key)) {
      // config wins; the element is wired up regardless of any inline attributes it also carries.
      seen.add(key);
      const list = boundMap.get(key) ?? [];
      list.push(el);
      boundMap.set(key, list);
      return;
    }
    // No config match → it only works if the element carries a complete inline definition.
    const record = recordForElement(el, configMap, attribute);
    (record ? inline : missingConfig).push({ id: key, element: el });
  });

  const bound = [...boundMap.entries()]
    .map(([key, elements]) => ({ key, elements, count: elements.length }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const unmatchedConfig = [...elementKeys]
    .filter((key) => !seen.has(key))
    .sort()
    .map((key) => ({ key }));
  const free = freeRecords(items).map((record) => ({ key: record.key, position: record.position }));

  const summary = {
    bound: bound.length,
    inline: inline.length,
    missingConfig: missingConfig.length,
    unmatchedConfig: unmatchedConfig.length,
    free: free.length,
  };

  return { bound, inline, missingConfig, unmatchedConfig, free, summary };
}

/**
 * Pretty-print a RuntimeReport to the console. Uses console.group / console.table when available and
 * degrades gracefully where they aren't (e.g. older runtimes), so it never throws.
 * @param {RuntimeReport} report
 */
export function formatRuntimeReport(report) {
  const { summary } = report;
  const group = typeof console.group === 'function' ? console.group.bind(console) : console.log.bind(console);
  const groupEnd = typeof console.groupEnd === 'function' ? console.groupEnd.bind(console) : () => {};
  const table = typeof console.table === 'function' ? console.table.bind(console) : (rows) => console.log(rows);
  const ids = (rows) => rows.map((row) => row.id ?? '(no id)').join(', ');

  group(
    `[help-layer] diagnostics — bound ${summary.bound}, inline ${summary.inline}, ` +
    `missing ${summary.missingConfig}, unmatched ${summary.unmatchedConfig}, free ${summary.free}`,
  );
  if (report.bound.length > 0) {
    table(report.bound.map((entry) => ({ key: entry.key, count: entry.count })));
    // Surface keys held by several elements: open(key) can only show one popup, so it targets the first.
    const shared = report.bound.filter((entry) => entry.count > 1);
    if (shared.length > 0) {
      console.info(
        'keys shared by multiple elements (open() targets the first): ' +
        shared.map((entry) => `${entry.key} (${entry.count})`).join(', '),
      );
    }
  }
  if (report.free.length > 0) {
    table(report.free.map((entry) => ({ key: entry.key, top: entry.position.top, left: entry.position.left })));
  }
  if (report.inline.length > 0) {
    console.info(`inline (no config; via data-help-title/text): ${ids(report.inline)}`);
  }
  if (report.unmatchedConfig.length > 0) {
    console.warn(`unmatchedConfig (in config, not in DOM): ${report.unmatchedConfig.map((entry) => entry.key).join(', ')}`);
  }
  if (report.missingConfig.length > 0) {
    console.warn(`missingConfig (in DOM, no config and no inline definition): ${ids(report.missingConfig)}`);
  }
  groupEnd();
}
