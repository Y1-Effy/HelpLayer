/** @jest-environment jsdom */
import { jest } from '@jest/globals';

import { buildRuntimeReport, formatRuntimeReport } from '../src/diagnostics.js';

const config = {
  save: { title: 'Save', text: 'Saves your input.' },
  ghost: { title: 'Ghost', text: 'In config, will have no element.' },
  panel: { title: 'Panel', text: 'A free placement.', position: { top: 10, left: 20 } },
};

function el(attrs) {
  const node = document.createElement('button');
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value);
  }
  document.body.appendChild(node);
  return node;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('buildRuntimeReport', () => {
  it('classifies bound / inline / missingConfig / unmatchedConfig / free against the live DOM', () => {
    el({ 'data-help-id': 'save' }); // bound
    el({ 'data-help-id': 'save' }); // bound (2nd)
    el({ 'data-help-id': 'tip', 'data-help-title': 'T', 'data-help-text': 'X' }); // inline (no config)
    el({ 'data-help-id': 'broken' }); // missingConfig

    const report = buildRuntimeReport(config);

    expect(report.bound).toEqual([{ key: 'save', elements: expect.any(Array), count: 2 }]);
    expect(report.inline.map((entry) => entry.id)).toEqual(['tip']);
    expect(report.missingConfig.map((entry) => entry.id)).toEqual(['broken']);
    // 'ghost' is a config element key with no DOM element; 'save' is matched so excluded.
    expect(report.unmatchedConfig).toEqual([{ key: 'ghost' }]);
    expect(report.free).toEqual([{ key: 'panel', position: { top: 10, left: 20 } }]);
    expect(report.summary).toEqual({ bound: 1, inline: 1, missingConfig: 1, unmatchedConfig: 1, free: 1 });
  });

  it('lets config win over inline attributes on the same element', () => {
    el({ 'data-help-id': 'save', 'data-help-title': 'ignored', 'data-help-text': 'ignored' });

    const report = buildRuntimeReport(config);

    expect(report.bound.map((entry) => entry.key)).toEqual(['save']);
    expect(report.inline).toEqual([]);
  });

  it('pierces open Shadow DOM when scanning', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    inner.setAttribute('data-help-id', 'save');
    shadow.appendChild(inner);

    const report = buildRuntimeReport(config);

    expect(report.bound.map((entry) => entry.key)).toEqual(['save']);
  });
});

describe('formatRuntimeReport', () => {
  it('does not throw when console.table is unavailable', () => {
    const original = console.table;
    // Simulate an environment without console.table.

    console.table = undefined;
    const groupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    el({ 'data-help-id': 'save' });
    const report = buildRuntimeReport(config);

    expect(() => formatRuntimeReport(report)).not.toThrow();

    console.table = original;
    groupSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('flags keys shared by multiple elements (open() targets the first)', () => {
    const quiet = ['group', 'groupEnd', 'table', 'warn']
      .map((method) => jest.spyOn(console, method).mockImplementation(() => {}));
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    el({ 'data-help-id': 'save' });
    el({ 'data-help-id': 'save' }); // duplicate id -> shared key
    const report = buildRuntimeReport(config);

    formatRuntimeReport(report);

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('save (2)'));

    infoSpy.mockRestore();
    quiet.forEach((spy) => spy.mockRestore());
  });
});
