/**
 * Validation and normalization of the helpConfig object. A pure function that does no DOM work.
 */

/**
 * @typedef {object} HelpEntry
 * @property {string} title heading shown on the marker / popup (non-empty)
 * @property {string} text description body (non-empty)
 * @property {{ top: number, left: number }} [position] if given, becomes a free placement not tied to an element
 */

/**
 * The helpConfig itself. For element-bound entries the key is the `data-help-id` value;
 * for free placement it is any identifier.
 * @typedef {Object<string, HelpEntry>} HelpConfig
 */

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPosition(position) {
  // Number.isFinite rejects NaN / Infinity / non-numbers, so a computed coordinate that became NaN
  // fails validation here instead of silently pinning the marker to 0,0 at render time.
  return (
    isPlainObject(position) &&
    Number.isFinite(position.top) &&
    Number.isFinite(position.left)
  );
}

/**
 * Validate the shape of helpConfig. Throws an Error on any problem (fail fast).
 */
export function validateConfig(config) {
  if (!isPlainObject(config)) {
    throw new Error('helpConfig must be a plain object');
  }

  for (const [key, entry] of Object.entries(config)) {
    if (!isPlainObject(entry)) {
      throw new Error(`helpConfig["${key}"] must be an object`);
    }
    if (typeof entry.title !== 'string' || entry.title === '') {
      throw new Error(`helpConfig["${key}"].title must be a non-empty string`);
    }
    if (typeof entry.text !== 'string' || entry.text === '') {
      throw new Error(`helpConfig["${key}"].text must be a non-empty string`);
    }
    if (entry.position !== undefined && !isValidPosition(entry.position)) {
      throw new Error(`helpConfig["${key}"].position must be { top: finite number, left: finite number }`);
    }
  }
}

/**
 * Convert a validated helpConfig into the shared array of "help items" the rendering
 * code works with. The target of kind:'element' is null at this point (DOM matching is
 * left to matcher.js).
 */
export function normalizeConfig(config) {
  return Object.entries(config).map(([key, entry]) => {
    if (isValidPosition(entry.position)) {
      return {
        key,
        title: entry.title,
        text: entry.text,
        kind: 'free',
        target: null,
        position: { top: entry.position.top, left: entry.position.left },
      };
    }

    return {
      key,
      title: entry.title,
      text: entry.text,
      kind: 'element',
      target: null,
      position: null,
    };
  });
}
