/**
 * Render an AuditReport (from audit.js) into a human-readable terminal string. Pure: it returns a
 * string and reads no I/O — the CLI decides whether to colorize (TTY) and prints the result. Keeping
 * color a parameter (rather than reading process.stdout here) also keeps this module Node-type-free
 * so it typechecks against the DOM lib like the rest of src/.
 */

// Minimal hand-rolled ANSI (zero dependencies, matching the project's no-deps stance).
const CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function makePaint(color) {
  return function paint(code, text) {
    return color ? `${CODES[code]}${text}${CODES.reset}` : text;
  };
}

/** Pad an id/key column so the location lines up; '—' stands in for an id-less inline target. */
function label(value) {
  return (value ?? '—').padEnd(20);
}

/**
 * @param {import('./audit.js').AuditReport} report
 * @param {object} [options]
 * @param {boolean} [options.color] emit ANSI colors (caller passes process.stdout.isTTY)
 * @param {number} [options.scannedFiles] number of source files scanned (for the header)
 * @returns {string}
 */
export function formatReport(report, { color = false, scannedFiles } = {}) {
  const paint = makePaint(color);
  const lines = [];
  const { summary } = report;

  const scanned = typeof scannedFiles === 'number' ? `  ·  scanned ${scannedFiles} file(s)` : '';
  lines.push(paint('bold', 'help-layer check') + paint('dim', `  ·  ${summary.bound + summary.unusedConfig} config key(s)${scanned}`));
  lines.push('');

  const section = (marker, code, title, rows) => {
    if (rows.length === 0) {
      return;
    }
    lines.push(paint(code, `${marker} ${title} (${rows.length})`));
    for (const row of rows) {
      lines.push(`  ${row}`);
    }
    lines.push('');
  };

  section('✔', 'green', 'bound', report.bound.map((b) => {
    const first = b.occurrences[0];
    const extra = b.occurrences.length > 1 ? paint('dim', ` (+${b.occurrences.length - 1} more)`) : '';
    return `${label(b.key)}${first ? `${first.file}:${first.line}` : ''}${extra}`;
  }));

  section('▣', 'cyan', 'free', report.free.map(
    (f) => `${label(f.key)}position {top:${f.position.top}, left:${f.position.left}}`,
  ));

  section('◌', 'cyan', 'inline (renders via data-help-title/text, no config)', report.inline.map(
    (i) => `${label(i.id)}${i.file}:${i.line}`,
  ));

  section('⚠', 'yellow', 'unusedConfig (in config, not found in markup — typo or dynamic id?)',
    report.unusedConfig.map((u) => label(u.key)));

  section('⚠', 'yellow', 'unknownId (no config; tag not statically resolvable — verify by hand)',
    report.unknownId.map((u) => `${label(u.id)}${u.file}:${u.line}`));

  section('✖', 'red', 'missingConfig (id present but no config and no inline definition — marker will not show)',
    report.missingConfig.map((m) => `${label(m.id)}${m.file}:${m.line}`));

  const errPart = paint(summary.errors > 0 ? 'red' : 'green', `${summary.errors} error(s)`);
  const warnPart = paint(summary.warnings > 0 ? 'yellow' : 'green', `${summary.warnings} warning(s)`);
  lines.push(`Result: ${errPart}, ${warnPart}`);

  return lines.join('\n');
}
