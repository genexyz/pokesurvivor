/* Bundles the game for publishing into dist/: a single minified JS instead of ~60.
 *   npm run build   (= node scripts/build.js && node scripts/export_data.js && node scripts/py.js scripts/make_seo_pages.py)
 *
 * - src/index.html is the "source" page: it loads every script separately (to
 *   code and debug comfortably with npm run dev). EDIT src/index.html.
 * - dist/ is generated from scratch: public/ as is, src/css, and dist/index.html from
 *   src/index.html, replacing the scripts block with js/app.min.js (with the
 *   fingerprint in the URL so it does not stay cached).
 * - node scripts/build.js --no-seo  ->  without the SEO bits (social tags, links to the pages).
 * - The site is NOT indexed: the game page keeps <meta name="robots" content="noindex, nofollow">
 *   and canonical / hreflang / JSON-LD are stripped.
 * - Afterwards the web pages and es/index.html are generated: scripts/make_seo_pages.py
 */
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src'),
  PUBLIC = path.join(ROOT, 'public'),
  DIST = path.join(ROOT, 'dist'),
  CACHE = path.join(ROOT, '.cache');
const DEV = path.join(SRC, 'index.html'),
  OUT = path.join(DIST, 'index.html');
const BEGIN = '<!-- scripts:begin -->',
  END = '<!-- scripts:end -->';

const dev = fs.readFileSync(DEV, 'utf8');
const i = dev.indexOf(BEGIN),
  j = dev.indexOf(END);
if (i < 0 || j < 0) throw new Error('src/index.html is missing the markers ' + BEGIN + ' / ' + END);
const block = dev.slice(i, j + END.length);
const files = [...block.matchAll(/<script[^>]*src="(js\/[^"]+\.js)"/g)].map(m => m[1]);

// dist/ from scratch: the static files from public/ and the CSS from src/.
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });
fs.cpSync(path.join(SRC, 'css'), path.join(DIST, 'css'), { recursive: true });

// Joins the files in order, separated by ';' in case one does not end with a semicolon.
let joined = files.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n');
// Anti-cheat: in the published version the game is WRAPPED in a function:
// G no longer exists in the browser console (F12), and with it the shortcuts to
// become invincible, skip the clock, etc. (src/index.html stays the same, for coding).
//   --expose   neither wrapped nor obfuscated (for the automated tests)
const EXPOSE = process.argv.includes('--expose');
if (!EXPOSE) {
  const WIN_G = 'window.G = window.G || {};';
  if (!joined.includes(WIN_G)) throw new Error('util.js no longer creates G as expected: check build.js');
  joined = '(() => {\n' + joined.replace(WIN_G, 'var G = {};') + '\n})();\n';
}
const tmp = path.join(CACHE, 'app.js');
fs.mkdirSync(CACHE, { recursive: true });
fs.writeFileSync(tmp, joined);
const outJs = path.join(DIST, 'js', 'app.min.js');
fs.mkdirSync(path.dirname(outJs), { recursive: true });
// terser and javascript-obfuscator come from devDependencies (npm install); they run with this same node.
function run(pkg, args) {
  let dir;
  try {
    dir = path.dirname(require.resolve(pkg + '/package.json', { paths: [ROOT] }));
  } catch {
    throw new Error(`Missing ${pkg}: run npm install`);
  }
  const binField = require(path.join(dir, 'package.json')).bin;
  const cli = path.join(dir, typeof binField === 'string' ? binField : binField[pkg]);
  execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
}
run('terser', [tmp, '--compress', 'passes=1', '--mangle', '--comments', 'false', '--ecma', '2020', '-o', outJs]);
// And obfuscated: the code becomes unreadable and breaks itself if someone reformats it
// to tamper with it. Strings go into an encoded table (only some of them, so the
// game is not slowed down). Fixed seed: the same code always gives the same file.
if (!EXPOSE) {
  run('javascript-obfuscator', [
    outJs,
    '--output',
    outJs,
    '--compact',
    'true',
    '--self-defending',
    'true',
    '--seed',
    '7',
    '--string-array',
    'true',
    '--string-array-encoding',
    'base64',
    '--string-array-threshold',
    '0.1',
    '--identifier-names-generator',
    'hexadecimal',
    '--rename-globals',
    'false',
    '--transform-object-keys',
    'false',
    '--split-strings',
    'false',
    '--control-flow-flattening',
    'false',
    '--dead-code-injection',
    'false',
    '--unicode-escape-sequence',
    'false',
    '--target',
    'browser'
  ]);
}
const min = fs.readFileSync(outJs);
const hash = crypto.createHash('sha1').update(min).digest('hex').slice(0, 10);

let html = dev.slice(0, i) + `<script defer src="js/app.min.js?v=${hash}"></script>` + dev.slice(j + END.length);
// --no-seo: without social tags or links to the pages.
// (--sin-seo is the old Spanish name, still accepted.)
const NO_SEO = process.argv.includes('--no-seo') || process.argv.includes('--sin-seo');
html = NO_SEO ? html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->\n?/g, '') : html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
html = html.replace(/<!-- src\/index\.html:[^>]*-->/, '<!-- GENERATED from src/index.html by scripts/build.js: do not edit by hand. -->');
fs.writeFileSync(OUT, html);
// Published version: players check it every 5 min and, if it changes, the game
// updates itself (in the menu, or when the run ends). See src/js/core/updater.js.
// --force: mandatory version, it also ends the runs in progress (saving them).
// (--forzar is the old Spanish name: Coolify BUILD_ARGS may still pass it.)
const FORCE = process.argv.includes('--force') || process.argv.includes('--forzar');
fs.writeFileSync(
  path.join(DIST, 'version.json'),
  JSON.stringify(Object.assign({ v: hash, at: new Date().toISOString() }, FORCE ? { force: true } : {})) + '\n'
);
console.log(
  `${FORCE ? '[MANDATORY] ' : ''}${NO_SEO ? '[no SEO] ' : ''}${EXPOSE ? '[UNPROTECTED, tests only] ' : ''}ok: ${files.length} scripts · ${(joined.length / 1024).toFixed(0)} KB -> ${(min.length / 1024).toFixed(0)} KB (dist/js/app.min.js?v=${hash})`
);
