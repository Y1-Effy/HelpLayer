/**
 * Smoke tests for the terminal formatter (src/cli/format.js). Verifies it renders the report sections
 * and never throws regardless of color, mirroring how the CLI prints it.
 */
import { buildAuditReport } from '../src/cli/audit.js';
import { formatReport } from '../src/cli/format.js';

const report = buildAuditReport({
  config: {
    save: { title: 'Save', text: 'Saves.' },
    ghost: { title: 'Ghost', text: 'Unused.' },
    panel: { title: 'Panel', text: 'Free.', position: { top: 1, left: 2 } },
  },
  sources: [{
    file: 'a.html',
    text: '<button data-help-id="save"></button>\n<button data-help-id="oops"></button>',
  }],
});

describe('formatReport', () => {
  it('renders every populated section and a result line (no color)', () => {
    const out = formatReport(report, { color: false, scannedFiles: 1 });

    expect(out).toContain('help-layer check');
    expect(out).toContain('bound');
    expect(out).toContain('free');
    expect(out).toContain('unusedConfig');
    expect(out).toContain('missingConfig');
    expect(out).toContain('1 error(s)');
    // No color requested → no ANSI escape codes.
    expect(out).not.toContain('\x1b[');
  });

  it('emits ANSI codes when color is enabled', () => {
    expect(formatReport(report, { color: true })).toContain('\x1b[');
  });
});
