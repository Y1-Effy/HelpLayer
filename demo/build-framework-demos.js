import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(demoDir, 'dist');

await mkdir(distDir, { recursive: true });

const shared = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  logLevel: 'info',
};

await Promise.all([
  build({
    ...shared,
    entryPoints: [path.join(demoDir, 'react-demo.jsx')],
    outfile: path.join(distDir, 'react-demo.js'),
    jsx: 'automatic',
  }),
  build({
    ...shared,
    entryPoints: [path.join(demoDir, 'vue-demo.js')],
    outfile: path.join(distDir, 'vue-demo.js'),
    define: {
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  }),
]);
