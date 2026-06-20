/** @jest-environment jsdom */
import { jest } from '@jest/globals';

import { collectElementRecords, elementConfigMap, freeRecords, recordForElement } from '../src/matcher.js';

const items = [
  { key: 'save', title: 'Save', text: 'Save description', kind: 'element', target: null, position: null },
  { key: 'username', title: 'Username', text: 'Name description', kind: 'element', target: null, position: null },
  { key: '__free_001', title: 'Free', text: 'Free description', kind: 'free', target: null, position: { top: 80, left: 600 } },
];

describe('elementConfigMap / freeRecords', () => {
  it('turns only element items into a key->item Map', () => {
    const map = elementConfigMap(items);
    expect([...map.keys()].sort()).toEqual(['save', 'username']);
    expect(map.get('save').title).toBe('Save');
  });

  it('turns free-placement items into records', () => {
    expect(freeRecords(items)).toEqual([
      { id: '__free_001', kind: 'free', key: '__free_001', title: 'Free', text: 'Free description', position: { top: 80, left: 600 } },
    ]);
  });
});

describe('recordForElement', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('builds a record keyed by element identity when there is a matching config', () => {
    document.body.innerHTML = '<button data-help-id="save">Save</button>';
    const el = document.querySelector('[data-help-id="save"]');
    const record = recordForElement(el, elementConfigMap(items));

    expect(record.id).toBe(el);
    expect(record.target).toBe(el);
    expect(record.kind).toBe('element');
    expect(record.key).toBe('save');
    expect(record.title).toBe('Save');
  });

  it('returns null when there is no matching config', () => {
    document.body.innerHTML = '<button data-help-id="unknown">?</button>';
    const el = document.querySelector('[data-help-id="unknown"]');

    expect(recordForElement(el, elementConfigMap(items))).toBeNull();
  });
});

describe('collectElementRecords', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('builds a record for each of multiple elements sharing the same data-help-id', () => {
    document.body.innerHTML = `
      <button data-help-id="save" id="a">Save 1</button>
      <button data-help-id="save" id="b">Save 2</button>
    `;
    const records = collectElementRecords(items, document);

    expect(records).toHaveLength(2);
    expect(records.map((r) => r.target.id).sort()).toEqual(['a', 'b']);
  });

  it('warns about and ignores a data-help-id not registered in config', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<button data-help-id="ghost">?</button>';

    const records = collectElementRecords(items, document);

    expect(records).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ghost'));
  });

  it('also collects data-help-id elements inside Shadow DOM', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button data-help-id="username">Name</button>';

    const records = collectElementRecords(items, document);

    expect(records).toHaveLength(1);
    expect(records[0].key).toBe('username');
  });
});

describe('inline definition via data attributes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('builds a record from data-help-title / data-help-text even without config', () => {
    document.body.innerHTML = '<button data-help-title="Save" data-help-text="Saves it">Save</button>';
    const records = collectElementRecords(items, document);

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('Save');
    expect(records[0].text).toBe('Saves it');
    expect(records[0].key).toBeNull();
  });

  it('lets config take precedence over inline attributes when it has the matching key', () => {
    document.body.innerHTML = '<button data-help-id="save" data-help-title="ignored" data-help-text="ignored">Save</button>';
    const el = document.querySelector('[data-help-id="save"]');
    const record = recordForElement(el, elementConfigMap(items));

    expect(record.title).toBe('Save');
    expect(record.text).toBe('Save description');
  });

  it('warns and treats as a non-target when only one of title or text is present', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<button data-help-title="only one">x</button>';

    const records = collectElementRecords(items, document);

    expect(records).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not warn on an incomplete inline definition when silent:true', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<button data-help-title="only one">x</button>';

    collectElementRecords(items, document, { silent: true });

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
