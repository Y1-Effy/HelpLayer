/**
 * Build a self-contained static site for the demo, suitable for GitHub Pages (or any static host).
 *
 * The source demo under demo/ is wired for local dev: the Vanilla page resolves bare imports via an
 * importmap into node_modules and loads ../src directly, and everything is served from the repo root
 * by scripts/serve.js. That setup is great for `npm run demo` and the e2e suite, but it can't be
 * hosted as-is (no node_modules, and absolute paths assume serving from /).
 *
 * So instead of mutating the source, this script emits a transformed copy into ./site:
 * - All three demos are bundled with esbuild so they're dependency-free and self-contained.
 * - The HTML is rewritten to use relative asset paths (no importmap, no /node_modules, no ../src),
 *   so it works under a project subpath like https://<user>.github.io/HelpLayer/.
 *
 * The source demo/ files are left untouched.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(demoDir, '..');
const siteDir = path.join(rootDir, 'site');

await mkdir(siteDir, { recursive: true });

// --- 1. Bundle the three demos (self-contained, no bare-import resolution needed at runtime) ---
// This is the public-facing build, so it's production + minified: React/Vue then drop their dev-only
// console output (e.g. the "Download the React DevTools" tip) and shrink dramatically (the React
// bundle goes from ~1.2MB dev to a fraction of that). Sourcemaps are kept so the code stays inspectable.
const shared = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
};

await Promise.all([
  build({
    ...shared,
    entryPoints: [path.join(demoDir, 'demo-app.js')],
    outfile: path.join(siteDir, 'vanilla-demo.js'),
  }),
  build({
    ...shared,
    entryPoints: [path.join(demoDir, 'stress.js')],
    outfile: path.join(siteDir, 'stress.js'),
  }),
  build({
    ...shared,
    entryPoints: [path.join(demoDir, 'react-demo.jsx')],
    outfile: path.join(siteDir, 'react-demo.js'),
    jsx: 'automatic',
  }),
  build({
    ...shared,
    entryPoints: [path.join(demoDir, 'vue-demo.js')],
    outfile: path.join(siteDir, 'vue-demo.js'),
    define: {
      ...shared.define,
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  }),
]);

// --- 2. Copy the stylesheets verbatim (their hrefs are already relative) ---
await Promise.all([
  copyFile(path.join(demoDir, 'demo.css'), path.join(siteDir, 'demo.css')),
  copyFile(path.join(demoDir, 'framework-demo.css'), path.join(siteDir, 'framework-demo.css')),
]);

// --- 3. Emit hosted HTML by transforming the source pages to relative, bundle-based assets ---
async function emitHtml(srcName, outName, transform) {
  const html = await readFile(path.join(demoDir, srcName), 'utf8');
  await writeFile(path.join(siteDir, outName), transform(html), 'utf8');
}

await Promise.all([
  // Vanilla: drop the importmap (and its explanatory comment) and load the bundle instead of ../src.
  emitHtml('index.html', 'index.html', (html) => html
    .replace(/<!--\s*Browsers can't resolve[\s\S]*?-->\n?/, '')
    .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
    .replace('src="demo-app.js"', 'src="./vanilla-demo.js"')),
  // React/Vue already load a bundle; just point at the flat site path instead of dist/.
  emitHtml('react.html', 'react.html', (html) => html.replace('dist/react-demo.js', 'react-demo.js')),
  emitHtml('vue.html', 'vue.html', (html) => html.replace('dist/vue-demo.js', 'vue-demo.js')),
  // Stress page: its <script src="stress.js"> already points at the (now bundled) sibling file, so copy as-is.
  emitHtml('stress.html', 'stress.html', (html) => html),
]);

console.log(`help-layer demo site built: ${path.relative(rootDir, siteDir)}/`);
