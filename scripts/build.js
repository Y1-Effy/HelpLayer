/**
 * Output the prebuilt distribution to dist/ (esbuild).
 * It wipes the whole dist/ before generating, so leftovers from past builds (old files from
 * before a rename, type definitions of deleted modules, etc.) don't sneak in.
 *
 * The library has no runtime dependencies, so both forms are fully self-contained (nothing external):
 * - help-layer.esm.js  : ESM, for npm/bundler consumers.
 * - help-layer.iife.js : IIFE for a single <script>. Loading it exposes a global `HelpLayer`
 *                       (`HelpLayer.initHelpLayer({ ... })`).
 *
 * Type definitions (.d.ts) are emitted separately to dist/types by `npm run build:types` (tsc).
 * This script runs first in the build chain (build:bundle), so wiping dist/ here means everything
 * through the subsequent build:types is rebuilt from a clean state.
 */
import { rmSync } from 'node:fs';

import { build } from 'esbuild';

// Wipe the output destination before generating. force:true so the first build with no dist/ doesn't throw.
rmSync('dist', { recursive: true, force: true });
console.log('cleaned dist/');

const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  logLevel: 'info',
};

await Promise.all([
  build({ ...shared, format: 'esm', outfile: 'dist/help-layer.esm.js' }),
  build({ ...shared, format: 'iife', globalName: 'HelpLayer', outfile: 'dist/help-layer.iife.js' }),
]);

console.log('built dist/help-layer.esm.js and dist/help-layer.iife.js');
