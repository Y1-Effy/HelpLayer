/**
 * Unit tests for the static auditor (src/cli/audit.js). Pure logic, so no jsdom and no fs — sources
 * are passed as in-memory strings.
 */
import { buildAuditReport } from '../src/cli/audit.js';

const config = {
  save: { title: 'Save', text: 'Saves your input.' },
  ghost: { title: 'Ghost', text: 'Defined but never used.' },
  panel: { title: 'Panel', text: 'A free placement.', position: { top: 10, left: 20 } },
};

const markup = {
  file: 'a.html',
  text: [
    '',
    '<button data-help-id="save">x</button>',
    '<button data-help-id="broken">y</button>',
    '<button data-help-id="inlined" data-help-title="T" data-help-text="X">z</button>',
    '<span data-help-title="Z" data-help-text="W">w</span>',
  ].join('\n'),
};

describe('buildAuditReport', () => {
  it('classifies bound / unusedConfig / free / inline / missingConfig', () => {
    const report = buildAuditReport({ config, sources: [markup] });

    expect(report.bound).toEqual([
      { key: 'save', occurrences: [{ file: 'a.html', line: 2 }] },
    ]);
    expect(report.unusedConfig).toEqual([{ key: 'ghost' }]);
    expect(report.free).toEqual([{ key: 'panel', position: { top: 10, left: 20 } }]);
    expect(report.missingConfig).toEqual([{ id: 'broken', file: 'a.html', line: 3 }]);

    // 'inlined' (id + inline attrs, not in config) and the id-less <span> both render via inline defs.
    expect(report.inline).toEqual([
      { id: null, file: 'a.html', line: 5 },
      { id: 'inlined', file: 'a.html', line: 4 },
    ]);
    expect(report.summary).toMatchObject({ errors: 1, warnings: 1 });
  });

  it('lets config win over inline attributes on the same element', () => {
    const sources = [{
      file: 'b.html',
      text: '<button data-help-id="save" data-help-title="ignored" data-help-text="ignored">x</button>',
    }];
    const report = buildAuditReport({ config, sources });

    expect(report.bound).toEqual([
      { key: 'save', occurrences: [{ file: 'b.html', line: 1 }] },
    ]);
    expect(report.inline).toEqual([]);
    expect(report.missingConfig).toEqual([]);
  });

  it('does not false-flag missingConfig when inline attrs span multiple lines', () => {
    const sources = [{
      file: 'm.jsx',
      text: [
        '<button',
        '  data-help-id="multi"',
        '  data-help-title="T"',
        '  data-help-text="X"',
        '>label</button>',
      ].join('\n'),
    }];
    const report = buildAuditReport({ config, sources });

    expect(report.missingConfig).toEqual([]);
    expect(report.inline).toEqual([{ id: 'multi', file: 'm.jsx', line: 2 }]);
  });

  it('downgrades to unknownId when the enclosing tag cannot be resolved', () => {
    // An id literal inside a JS string with no preceding '<' has no determinable tag.
    const sources = [{ file: 'c.js', text: 'const s = \'data-help-id="loose"\';' }];
    const report = buildAuditReport({ config, sources });

    expect(report.unknownId).toEqual([{ id: 'loose', file: 'c.js', line: 1 }]);
    expect(report.missingConfig).toEqual([]);
    expect(report.summary.warnings).toBeGreaterThan(0);
  });

  it('aggregates multiple occurrences of the same bound key across files', () => {
    const sources = [
      { file: 'one.html', text: '<i data-help-id="save"></i>' },
      { file: 'two.html', text: '\n<i data-help-id="save"></i>' },
    ];
    const report = buildAuditReport({ config, sources });

    expect(report.bound).toEqual([
      {
        key: 'save',
        occurrences: [
          { file: 'one.html', line: 1 },
          { file: 'two.html', line: 2 },
        ],
      },
    ]);
  });

  it('honors a custom attribute name', () => {
    const sources = [{ file: 'd.html', text: '<i data-hl="save"></i>' }];
    const report = buildAuditReport({ config, sources, attribute: 'data-hl' });

    expect(report.bound).toEqual([
      { key: 'save', occurrences: [{ file: 'd.html', line: 1 }] },
    ]);
  });

  it('throws (fail fast) on a malformed config', () => {
    expect(() => buildAuditReport({ config: { x: { title: '', text: 't' } }, sources: [] }))
      .toThrow(/title must be a non-empty string/);
  });
});
