#!/usr/bin/env node
/**
 * Helper for Claude Code's PostToolUse hook.
 * For a single Edit/Write-ed file, if it's a .js under src/ or tests/, run eslint --fix
 * automatically. Otherwise do nothing and exit 0 (don't block the edit).
 *
 * Input: PostToolUse JSON on stdin (reads tool_input.file_path).
 * Output: shows eslint's result. Exits 0 even if lint errors remain (doesn't block the edit).
 */
import { spawnSync } from 'node:child_process';
import { relative, isAbsolute } from 'node:path';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // Avoid hanging when started without stdin.
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

function pickFilePath(payload) {
  try {
    const json = JSON.parse(payload);
    return json?.tool_input?.file_path ?? '';
  } catch {
    return '';
  }
}

/** Target only .js under src/ or tests/, by project-relative path. */
function isTarget(filePath) {
  if (!filePath || !filePath.endsWith('.js')) {
    return false;
  }
  const rel = isAbsolute(filePath) ? relative(process.cwd(), filePath) : filePath;
  const norm = rel.split('\\').join('/');
  return norm.startsWith('src/') || norm.startsWith('tests/');
}

const payload = await readStdin();
const filePath = pickFilePath(payload);

if (!isTarget(filePath)) {
  process.exit(0);
}

spawnSync('npx', ['eslint', '--fix', filePath], {
  stdio: 'inherit',
  shell: true,
});

// Don't block the edit itself even if lint errors remain.
process.exit(0);
