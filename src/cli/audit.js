/**
 * Static audit of a helpConfig against source markup. Pure: touches no DOM and no filesystem — the
 * caller passes already-read source text. It cross-references config keys with the `data-help-id`
 * literals found in the sources so the `help-layer check` CLI can report, without running the app,
 * what is wired up, what looks like a typo, and what would silently fail to render a marker.
 *
 * Because this runs statically (no execution), only string-literal ids are visible. A computed id
 * (`data-help-id={expr}`) cannot be resolved here, so a config key that is only referenced that way
 * shows up as `unusedConfig` — a *warning*, not an error, to avoid crying wolf on a legitimate pattern.
 *
 * Mirrors the runtime resolution in matcher.js: config wins; otherwise an element falls back to its
 * inline `data-help-title` / `data-help-text`, and BOTH are required for it to be a target.
 */
import { normalizeConfig, validateConfig } from '../config.js';
import { TEXT_ATTR, TITLE_ATTR } from '../matcher.js';

const DEFAULT_ATTR = 'data-help-id';

// When inspecting the tag that encloses a non-config id, give up past this many characters. A runaway
// (e.g. a JSX expression value containing a stray '>') would otherwise let us "confirm" the wrong tag
// and emit a false missingConfig error. Past the cap we downgrade to the `unknownId` warning instead.
const TAG_SCAN_CAP = 2000;

/** Escape a string for safe use inside a RegExp (attribute names are usually safe, but be defensive). */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 1-based line number of the character at `index` within `text`. */
function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

/**
 * Extract the opening tag that encloses the attribute match at `index`. Returns `confident: false`
 * when the tag boundaries cannot be pinned down (no '<' before, no '>' within the cap) so the caller
 * can treat the case as undecidable rather than risk a false classification.
 * @returns {{ tag: string, confident: boolean }}
 */
function extractEnclosingTag(text, index) {
  const start = text.lastIndexOf('<', index);
  if (start < 0) {
    return { tag: '', confident: false };
  }
  const end = text.indexOf('>', index);
  if (end < 0 || end - start > TAG_SCAN_CAP) {
    return { tag: '', confident: false };
  }
  return { tag: text.slice(start, end + 1), confident: true };
}

/**
 * Read a quoted attribute value out of a start tag, or null if the attribute is absent.
 * @param {string} tag
 * @param {string} attrName
 * @returns {string|null}
 */
function attrValue(tag, attrName) {
  // Match up to the *matching* quote (backreference) so a value may contain the other quote char.
  const match = new RegExp(`${escapeRegExp(attrName)}\\s*=\\s*(["'])(.*?)\\1`).exec(tag);
  return match ? match[2] : null;
}

/**
 * @typedef {object} IdHit
 * @property {string} id the data-help-id literal value
 * @property {string} file source file the hit came from
 * @property {number} line 1-based line number
 * @property {boolean} hasTitle the enclosing tag also carries data-help-title
 * @property {boolean} hasText the enclosing tag also carries data-help-text
 * @property {string|null} titleValue inline data-help-title value (for scaffolding), null if absent
 * @property {string|null} textValue inline data-help-text value (for scaffolding), null if absent
 * @property {boolean} confident the enclosing tag could be determined
 */

/**
 * Find every `attr="value"` literal across the sources, recording the enclosing tag's inline
 * data-help-title / data-help-text (presence and value). Shared by the auditor and the scaffolder.
 * @param {Array<{ file: string, text: string }>} sources
 * @param {string} [attr] attribute marking targets (default 'data-help-id')
 * @returns {IdHit[]}
 */
export function scanSourceIds(sources, attr = DEFAULT_ATTR) {
  /** @type {IdHit[]} */
  const hits = [];
  const re = new RegExp(`${escapeRegExp(attr)}\\s*=\\s*["']([^"']+)["']`, 'g');

  for (const { file, text } of sources) {
    let match;
    while ((match = re.exec(text)) !== null) {
      const { tag, confident } = extractEnclosingTag(text, match.index);
      const titleValue = confident ? attrValue(tag, TITLE_ATTR) : null;
      const textValue = confident ? attrValue(tag, TEXT_ATTR) : null;
      hits.push({
        id: match[1],
        file,
        line: lineAt(text, match.index),
        hasTitle: titleValue !== null,
        hasText: textValue !== null,
        titleValue,
        textValue,
        confident,
      });
    }
  }
  return hits;
}

/**
 * Find inline-only targets: tags carrying data-help-title but no data-help-id. The library treats
 * these as valid targets (matcher's targetSelector includes `[data-help-title]`), so they are not
 * errors — but they still need BOTH title and text to render.
 */
function collectInlineOnly(sources, attr) {
  const found = [];
  const titleRe = new RegExp(`${escapeRegExp(TITLE_ATTR)}\\s*=`, 'g');
  const idRe = new RegExp(`${escapeRegExp(attr)}\\s*=`);
  const textRe = new RegExp(`${escapeRegExp(TEXT_ATTR)}\\s*=`);

  for (const { file, text } of sources) {
    let match;
    while ((match = titleRe.exec(text)) !== null) {
      const { tag, confident } = extractEnclosingTag(text, match.index);
      // Tags that also carry an id are handled by the id pass — skip to avoid double-counting.
      if (!confident || idRe.test(tag)) {
        continue;
      }
      found.push({ file, line: lineAt(text, match.index), hasText: textRe.test(tag) });
    }
  }
  return found;
}

/** Stable ordering so output and test snapshots don't depend on scan order. */
function byIdThenLocation(a, b) {
  const ak = a.id ?? a.key ?? '';
  const bk = b.id ?? b.key ?? '';
  return ak.localeCompare(bk) || (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0);
}

/**
 * @typedef {object} AuditReport
 * @property {Array<{ key: string, occurrences: Array<{ file: string, line: number }> }>} bound config(element) keys wired to a literal id
 * @property {Array<{ key: string }>} unusedConfig config(element) keys never seen in the markup (typo / removed / dynamic)
 * @property {Array<{ key: string, position: { top: number, left: number } }>} free free-placement entries (not id-bound)
 * @property {Array<{ id: string|null, file: string, line: number }>} inline ids/elements that render via inline title+text, no config
 * @property {Array<{ id: string|null, file: string, line: number }>} missingConfig ids with no config and no usable inline definition (broken)
 * @property {Array<{ id: string, file: string, line: number }>} unknownId ids with no config whose tag could not be inspected (verify by hand)
 * @property {{ bound: number, unusedConfig: number, free: number, inline: number, missingConfig: number, unknownId: number, errors: number, warnings: number }} summary
 */

/**
 * Build the audit report. Throws (via validateConfig) on a malformed config — fail fast.
 * @param {object} params
 * @param {import('../config.js').HelpConfig} params.config
 * @param {Array<{ file: string, text: string }>} params.sources already-read source files
 * @param {string} [params.attribute] attribute marking targets (default 'data-help-id')
 * @returns {AuditReport}
 */
export function buildAuditReport({ config, sources, attribute = DEFAULT_ATTR }) {
  validateConfig(config);
  const items = normalizeConfig(config);

  const elementKeys = new Set(items.filter((item) => item.kind === 'element').map((item) => item.key));
  const free = items
    .filter((item) => item.kind === 'free')
    .map((item) => ({ key: item.key, position: item.position }));

  const idHits = scanSourceIds(sources, attribute);

  /** @type {Map<string, Array<{ file: string, line: number }>>} */
  const boundOccurrences = new Map();
  const inline = [];
  const missingConfig = [];
  const unknownId = [];
  const seenKeys = new Set();

  for (const hit of idHits) {
    const where = { file: hit.file, line: hit.line };
    if (elementKeys.has(hit.id)) {
      // config wins; inline attributes on the same element are irrelevant.
      seenKeys.add(hit.id);
      const list = boundOccurrences.get(hit.id) ?? [];
      list.push(where);
      boundOccurrences.set(hit.id, list);
    } else if (!hit.confident) {
      unknownId.push({ id: hit.id, ...where });
    } else if (hit.hasTitle && hit.hasText) {
      inline.push({ id: hit.id, ...where });
    } else {
      missingConfig.push({ id: hit.id, ...where });
    }
  }

  // Inline-only targets (data-help-title, no id). Both attrs render; one alone is a broken target.
  for (const entry of collectInlineOnly(sources, attribute)) {
    const where = { id: null, file: entry.file, line: entry.line };
    (entry.hasText ? inline : missingConfig).push(where);
  }

  const bound = [...boundOccurrences.entries()]
    .map(([key, occurrences]) => ({ key, occurrences }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const unusedConfig = [...elementKeys]
    .filter((key) => !seenKeys.has(key))
    .sort()
    .map((key) => ({ key }));

  inline.sort(byIdThenLocation);
  missingConfig.sort(byIdThenLocation);
  unknownId.sort(byIdThenLocation);

  const summary = {
    bound: bound.length,
    unusedConfig: unusedConfig.length,
    free: free.length,
    inline: inline.length,
    missingConfig: missingConfig.length,
    unknownId: unknownId.length,
    errors: missingConfig.length,
    warnings: unusedConfig.length + unknownId.length,
  };

  return { bound, unusedConfig, free, inline, missingConfig, unknownId, summary };
}
