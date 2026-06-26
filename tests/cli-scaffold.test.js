/**
 * Unit tests for the scaffold generator (src/cli/scaffold.js) and the shared scanner export
 * (scanSourceIds from src/cli/audit.js). Pure logic — sources are in-memory strings.
 */
import { scanSourceIds } from '../src/cli/audit.js';
import { buildScaffold } from '../src/cli/scaffold.js';

const sources = [{
  file: 'a.html',
  text: [
    '<button data-help-id="save">x</button>',
    '<button data-help-id="export-csv">y</button>',
    '<span data-help-id="tip" data-help-title="Tip title" data-help-text="Tip body">z</span>',
  ].join('\n'),
}];

describe('buildScaffold', () => {
  it('emits a JS module with one stub per unique id, sorted, with source locations', () => {
    const { content, count } = buildScaffold({ hits: scanSourceIds(sources) });

    expect(count).toBe(3);
    expect(content).toContain('export const helpConfig = {');
    // hyphenated id must be quoted; valid identifier left bare.
    expect(content).toContain('save: { title: \'\', text: \'\' }, // a.html:1');
    expect(content).toContain('\'export-csv\': { title: \'\', text: \'\' }, // a.html:2');
    // sorted: export-csv < save < tip
    expect(content.indexOf('export-csv')).toBeLessThan(content.indexOf('save:'));
  });

  it('pre-fills title/text from inline attributes when present', () => {
    const { content } = buildScaffold({ hits: scanSourceIds(sources) });
    expect(content).toContain('tip: { title: \'Tip title\', text: \'Tip body\' }');
  });

  it('skips ids already defined in the existing config', () => {
    const { content, count } = buildScaffold({
      hits: scanSourceIds(sources),
      existingKeys: new Set(['save', 'tip']),
    });

    expect(count).toBe(1);
    expect(content).toContain('export-csv');
    expect(content).not.toContain('save:');
    expect(content).not.toContain('tip:');
  });

  it('produces valid JSON in json format', () => {
    const { content } = buildScaffold({ hits: scanSourceIds(sources), format: 'json' });
    const parsed = JSON.parse(content);

    expect(Object.keys(parsed).sort()).toEqual(['export-csv', 'save', 'tip']);
    expect(parsed.tip).toEqual({ title: 'Tip title', text: 'Tip body' });
    expect(parsed.save).toEqual({ title: '', text: '' });
  });

  it('emits an empty skeleton (count 0) when no ids are found', () => {
    const { content, count } = buildScaffold({ hits: [] });
    expect(count).toBe(0);
    expect(content).toContain('export const helpConfig = {');
    expect(content).toContain('};');
  });

  it('escapes quotes in inline values so the output stays valid', () => {
    const tricky = [{ file: 'b.html', text: '<i data-help-id="q" data-help-title="a\'b">i</i>' }];
    const { content } = buildScaffold({ hits: scanSourceIds(tricky) });
    expect(content).toContain('title: \'a\\\'b\'');
  });
});
