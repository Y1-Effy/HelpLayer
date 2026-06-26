/**
 * Integration tests for the `help-layer` CLI binary: real arg parsing, config loading, recursive file
 * scan with extension filtering, and exit codes. Runs the bin in a child process against fixtures.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(here, '../bin/help-layer.js');
const FIX = resolve(here, 'fixtures/cli');

function runCheck(args) {
  return spawnSync('node', [BIN, 'check', ...args], { encoding: 'utf8' });
}

describe('help-layer check (bin)', () => {
  it('exits 0 and lists bound keys when everything is configured', () => {
    const res = runCheck(['--config', resolve(FIX, 'config.js'), '--src', resolve(FIX, 'ok')]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('bound');
    expect(res.stdout).toContain('save');
  });

  it('ignores files whose extension is not in the scan list', () => {
    const res = runCheck(['--config', resolve(FIX, 'config.js'), '--src', resolve(FIX, 'ok')]);
    // The .txt sibling references an id but must not be scanned, so it cannot surface as a problem.
    expect(res.stdout).not.toContain('should-be-ignored');
  });

  it('exits 1 when an id has no config and no inline definition', () => {
    const res = runCheck(['--config', resolve(FIX, 'config.js'), '--src', resolve(FIX, 'bad')]);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('missingConfig');
    expect(res.stdout).toContain('oops');
  });

  it('treats unusedConfig as a warning (exit 0), but fails under --strict', () => {
    const base = ['--config', resolve(FIX, 'config.js'), '--export', 'buildConfig', '--src', resolve(FIX, 'ok')];
    const lenient = runCheck(base);
    expect(lenient.status).toBe(0);
    expect(lenient.stdout).toContain('unusedConfig');

    const strict = runCheck([...base, '--strict']);
    expect(strict.status).toBe(1);
  });

  it('loads a JSON config', () => {
    const res = runCheck(['--config', resolve(FIX, 'config.json'), '--src', resolve(FIX, 'ok')]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('save');
  });

  it('errors (exit 2) when --config is missing', () => {
    const res = runCheck(['--src', resolve(FIX, 'ok')]);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('--config is required');
  });
});

function runScaffold(args) {
  return spawnSync('node', [BIN, 'scaffold', ...args], { encoding: 'utf8' });
}

describe('help-layer scaffold (bin)', () => {
  it('prints a JS config skeleton with the discovered ids', () => {
    const res = runScaffold(['--src', resolve(FIX, 'bad')]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('export const helpConfig = {');
    expect(res.stdout).toContain('save:');
    expect(res.stdout).toContain('oops:');
  });

  it('emits parseable JSON with --format json', () => {
    const res = runScaffold(['--src', resolve(FIX, 'bad'), '--format', 'json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(Object.keys(parsed).sort()).toEqual(['oops', 'save']);
  });

  it('stubs only ids missing from an existing config', () => {
    const res = runScaffold([
      '--src', resolve(FIX, 'bad'),
      '--config', resolve(FIX, 'config.js'), '--export', 'buildConfig',
    ]);
    expect(res.status).toBe(0);
    // config.js defines save (and ghost) but not oops.
    expect(res.stdout).toContain('oops:');
    expect(res.stdout).not.toContain('save:');
  });
});
