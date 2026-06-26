#!/usr/bin/env node
/**
 * `help-layer` CLI. Thin I/O wrapper around the pure auditor in src/cli: parse args, load the config,
 * read the source files, then hand both to buildAuditReport() and print formatReport(). Zero runtime
 * dependencies — Node built-ins only (fs / path / url / util.parseArgs).
 *
 * Usage:
 *   help-layer check --config <path> --src <dir...> [--ext ...] [--export name] [--attribute attr] [--strict]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { buildAuditReport, scanSourceIds } from '../src/cli/audit.js';
import { formatReport } from '../src/cli/format.js';
import { buildScaffold } from '../src/cli/scaffold.js';
import { isPlainObject } from '../src/config.js';

const DEFAULT_EXTS = ['html', 'htm', 'jsx', 'tsx', 'vue', 'js', 'ts', 'mjs', 'svelte'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build']);

const HELP = `help-layer — developer tools for HelpLayer (no app run required)

Usage:
  help-layer check    --config <path> --src <dir...> [options]   audit config against markup
  help-layer scaffold --src <dir...> [options]                   generate a config skeleton

check options:
  --config <path>     config file (.json, or a .js/.mjs module). Required.
  --src <path...>     source roots to scan (repeatable or comma-separated). Default: current dir.
  --ext <list>        comma-separated extensions to scan. Default: ${DEFAULT_EXTS.join(',')}
  --export <name>     which export holds the config (default: default export / first object export).
                      If the chosen export is a function it is called with no arguments.
  --attribute <attr>  target attribute name (default: data-help-id).
  --strict            exit non-zero on warnings too (not just errors).

scaffold options:
  --src <path...>     source roots to scan (as above). Default: current dir.
  --format <js|json>  output format. Default: js (export const helpConfig = { ... }).
  --out <path>        write to a file. Default: print to stdout.
  --config <path>     existing config — only stub ids that are NOT already defined (with --export).
  --attribute <attr>  target attribute name (default: data-help-id).

  -h, --help          show this help.

check exits 1 on errors (missing definitions) — or on warnings too with --strict.`;

/** Split repeated/comma-separated CLI values into a flat list. */
function splitList(values) {
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Resolve the helpConfig object from a config file (json, plain export, or a no-arg factory). */
async function loadConfig(configPath, exportName) {
  const abs = resolve(configPath);
  if (extname(abs).toLowerCase() === '.json') {
    return JSON.parse(readFileSync(abs, 'utf8'));
  }

  let mod;
  try {
    mod = await import(pathToFileURL(abs).href);
  } catch (err) {
    throw new Error(
      `could not import config "${configPath}": ${err.message}\n` +
      'TypeScript sources cannot be imported directly — point --config at a .json file or compiled .js.',
    );
  }

  let value;
  if (exportName) {
    value = mod[exportName];
    if (value === undefined) {
      throw new Error(`config "${configPath}" has no export named "${exportName}"`);
    }
  } else if (mod.default !== undefined) {
    value = mod.default;
  } else {
    value = Object.values(mod).find((v) => isPlainObject(v) || typeof v === 'function');
  }

  // Support factory configs (e.g. buildHelpConfig(lang) with a default) by calling them with no args.
  if (typeof value === 'function') {
    value = value();
  }
  if (!isPlainObject(value)) {
    throw new Error(
      `config "${configPath}" did not resolve to an object. ` +
      'Use --export <name> to pick the export, or point at a JSON config.',
    );
  }
  return value;
}

/** Recursively collect readable source files under each root, filtered by extension. */
function collectSources(roots, exts) {
  const extSet = new Set(exts.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()));
  const sources = [];

  const walk = (entry) => {
    const stat = statSync(entry);
    if (stat.isDirectory()) {
      for (const name of readdirSync(entry)) {
        if (SKIP_DIRS.has(name)) {
          continue;
        }
        walk(resolve(entry, name));
      }
      return;
    }
    if (extSet.has(extname(entry).toLowerCase())) {
      sources.push({ file: relative(process.cwd(), entry) || entry, text: readFileSync(entry, 'utf8') });
    }
  };

  for (const root of roots) {
    walk(resolve(root));
  }
  return sources;
}

/** Resolve --src / --ext into the scanned source files. */
function gatherSources(values) {
  const roots = values.src && values.src.length > 0 ? splitList(values.src) : ['.'];
  const exts = values.ext ? splitList([values.ext]) : DEFAULT_EXTS;
  return collectSources(roots, exts);
}

async function runCheck(values) {
  if (!values.config) {
    process.stderr.write(`error: --config is required\n\n${HELP}\n`);
    process.exit(2);
  }

  let config;
  try {
    config = await loadConfig(values.config, values.export);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  }

  const sources = gatherSources(values);

  let report;
  try {
    report = buildAuditReport({ config, sources, attribute: values.attribute });
  } catch (err) {
    // validateConfig throws on a malformed config — surface it as a hard error.
    process.stderr.write(`error: invalid config — ${err.message}\n`);
    process.exit(2);
  }

  process.stdout.write(`${formatReport(report, { color: Boolean(process.stdout.isTTY), scannedFiles: sources.length })}\n`);

  const failed = report.summary.errors > 0 || (values.strict && report.summary.warnings > 0);
  process.exit(failed ? 1 : 0);
}

async function runScaffold(values) {
  const format = values.format === 'json' ? 'json' : 'js';
  if (values.format && values.format !== 'js' && values.format !== 'json') {
    process.stderr.write(`error: --format must be "js" or "json"\n`);
    process.exit(2);
  }

  // An existing config (optional) lets us stub only the ids that aren't defined yet.
  let existingKeys = new Set();
  if (values.config) {
    try {
      const config = await loadConfig(values.config, values.export);
      existingKeys = new Set(Object.keys(config));
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`);
      process.exit(2);
    }
  }

  const sources = gatherSources(values);
  const hits = scanSourceIds(sources, values.attribute);
  const { content, count } = buildScaffold({ hits, existingKeys, format });

  if (count === 0) {
    process.stderr.write('help-layer scaffold: no data-help-id targets found to scaffold.\n');
  }

  if (values.out) {
    writeFileSync(resolve(values.out), `${content}\n`);
    process.stderr.write(`help-layer scaffold: wrote ${count} stub(s) to ${values.out}\n`);
  } else {
    process.stdout.write(`${content}\n`);
  }
  process.exit(0);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      src: { type: 'string', multiple: true },
      ext: { type: 'string' },
      export: { type: 'string' },
      attribute: { type: 'string' },
      strict: { type: 'boolean' },
      format: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const command = positionals[0];
  if (values.help || (command !== 'check' && command !== 'scaffold')) {
    process.stdout.write(`${HELP}\n`);
    process.exit(values.help ? 0 : 1);
  }

  if (command === 'scaffold') {
    await runScaffold(values);
  } else {
    await runCheck(values);
  }
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(2);
});
