/* Bundles the game for publishing into dist/ with Vite (config and release plugin: vite.config.mjs).
 *   npm run build   (= node scripts/build.js && node scripts/export_data.js && node scripts/py.js scripts/make_seo_pages.py)
 *
 * - src/index.html is the source page; src/js/main.js is the entry module that imports the rest.
 * - dist/ is generated from scratch: public/ as is, the bundle in js/app-<hash>.js, the CSS in
 *   css/<name>-<hash>.css, dist/index.html, and version.json (see src/js/core/updater.js).
 * - Flags (kept so Coolify's BUILD_ARGS and the Dockerfile keep working):
 *     --force     mandatory version: version.json gets force:true, runs in progress end (saved).
 *                 (--forzar is the old Spanish name: Coolify BUILD_ARGS may still pass it.)
 *     --no-seo    without the SEO bits (social tags, links to the pages). (--sin-seo: old name.)
 *     --expose    neither minified nor obfuscated, with sourcemaps and window.G (for debugging).
 * - The site is NOT indexed: the game page keeps <meta name="robots" content="noindex, nofollow">.
 * - Afterwards the web pages and es/index.html are generated: scripts/make_seo_pages.py
 */
const fs = require('fs'),
  path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const has = (...flags) => flags.some(f => process.argv.includes(f));
const FORCE = has('--force', '--forzar'),
  NO_SEO = has('--no-seo', '--sin-seo'),
  EXPOSE = has('--expose');
if (FORCE) process.env.PS_FORCE = '1';
if (NO_SEO) process.env.PS_NO_SEO = '1';

(async () => {
  const { build } = await import('vite');
  await build({ configFile: path.join(ROOT, 'vite.config.mjs'), mode: EXPOSE ? 'expose' : 'production', logLevel: 'warn' });

  const { v } = JSON.parse(fs.readFileSync(path.join(DIST, 'version.json'), 'utf8'));
  const js = fs.readdirSync(path.join(DIST, 'js')).filter(f => f.endsWith('.js'));
  const kb = js.reduce((n, f) => n + fs.statSync(path.join(DIST, 'js', f)).size, 0) / 1024;
  console.log(
    `${FORCE ? '[MANDATORY] ' : ''}${NO_SEO ? '[no SEO] ' : ''}${EXPOSE ? '[UNPROTECTED, debug only] ' : ''}ok: ${js.join(', ')} · ${kb.toFixed(0)} KB · version ${v}`
  );
})().catch(e => {
  console.error(e);
  process.exit(1);
});
