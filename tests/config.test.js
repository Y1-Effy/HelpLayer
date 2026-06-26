import { normalizeConfig, validateConfig } from '../src/config.js';

describe('validateConfig', () => {
  it('does not throw on a valid config', () => {
    expect(() => validateConfig({
      save: { title: 'Save', text: 'Saves the entered content.' },
      __free_001: { title: 'About this list', text: 'Past processing history.', position: { top: 80, left: 600 } },
    })).not.toThrow();
  });

  it('rejects a config that is not an object', () => {
    // Errors are prefixed with help-layer: and name the public `config` option (not the internal "helpConfig").
    expect(() => validateConfig(null)).toThrow(/help-layer: config must be a plain object/);
    expect(() => validateConfig('not an object')).toThrow();
    expect(() => validateConfig([])).toThrow();
  });

  it('rejects an entry that is not an object', () => {
    expect(() => validateConfig({ save: 'not an object' })).toThrow(/help-layer: config\["save"\] must be an object/);
  });

  it('rejects an entry missing title', () => {
    expect(() => validateConfig({ save: { text: 'description' } })).toThrow(/config\["save"\]\.title/);
  });

  it('rejects an entry missing text', () => {
    expect(() => validateConfig({ save: { title: 'Save' } })).toThrow(/config\["save"\]\.text/);
  });

  it('rejects an entry with a malformed position', () => {
    expect(() => validateConfig({
      __free_001: { title: 'Title', text: 'description', position: { top: 'eighty', left: 600 } },
    })).toThrow();
  });

  it('rejects a non-finite position (NaN / Infinity)', () => {
    expect(() => validateConfig({
      __free_001: { title: 'Title', text: 'description', position: { top: NaN, left: 0 } },
    })).toThrow();
    expect(() => validateConfig({
      __free_001: { title: 'Title', text: 'description', position: { top: 10, left: Infinity } },
    })).toThrow();
  });
});

describe('normalizeConfig', () => {
  it('makes an entry without position kind:element', () => {
    const items = normalizeConfig({ save: { title: 'Save', text: 'description' } });

    expect(items).toEqual([
      { key: 'save', title: 'Save', text: 'description', kind: 'element', target: null, position: null },
    ]);
  });

  it('makes an entry with a valid position kind:free', () => {
    const items = normalizeConfig({
      __free_001: { title: 'About this list', text: 'description', position: { top: 80, left: 600 } },
    });

    expect(items).toEqual([
      {
        key: '__free_001',
        title: 'About this list',
        text: 'description',
        kind: 'free',
        target: null,
        position: { top: 80, left: 600 },
      },
    ]);
  });

  it('returns multiple entries as an array', () => {
    const items = normalizeConfig({
      save: { title: 'Save', text: 'description 1' },
      __free_001: { title: 'Free placement', text: 'description 2', position: { top: 1, left: 2 } },
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.kind)).toEqual(['element', 'free']);
  });
});
