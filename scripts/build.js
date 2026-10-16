/* Empaqueta el juego para publicarlo en dist/: un solo JS minificado en vez de ~60.
 *   npm run build   (= node scripts/build.js && node scripts/export_data.js && node scripts/py.js scripts/make_seo_pages.py)
 *
 * - src/index.html es la página "fuente": carga cada script por separado (para
 *   programar y depurar cómodamente con npm run dev). SE EDITA src/index.html.
 * - dist/ se genera entero: public/ tal cual, src/css, y dist/index.html a partir
 *   de src/index.html, cambiando el bloque de scripts por js/app.min.js (con la
 *   huella en la URL para que no se quede en caché).
 * - node scripts/build.js --sin-seo  ->  sin lo de SEO (hasta tener survivor.preciostcg.com).
 * - Después se generan las páginas web y en/index.html: scripts/make_seo_pages.py
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
if (i < 0 || j < 0) throw new Error('src/index.html no tiene las marcas ' + BEGIN + ' / ' + END);
const block = dev.slice(i, j + END.length);
const files = [...block.matchAll(/<script[^>]*src="(js\/[^"]+\.js)"/g)].map(m => m[1]);

// dist/ desde cero: lo estático de public/ y el CSS de src/.
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });
fs.cpSync(path.join(SRC, 'css'), path.join(DIST, 'css'), { recursive: true });

// Une los archivos en orden; cada uno separado por ';' por si alguno no acaba en punto y coma.
let joined = files.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n');
// Anti-trampas: en la versión publicada el juego va ENCERRADO en una función:
// G deja de existir en la consola del navegador (F12), y con él los atajos para
// hacerse invencible, saltar el reloj, etc. (src/index.html sigue igual, para programar).
//   --expose   sin encerrar ni ofuscar (para las pruebas automáticas)
const EXPOSE = process.argv.includes('--expose');
if (!EXPOSE) {
  const WIN_G = 'window.G = window.G || {};';
  if (!joined.includes(WIN_G)) throw new Error('util.js ya no crea G como se esperaba: revisa build.js');
  joined = '(() => {\n' + joined.replace(WIN_G, 'var G = {};') + '\n})();\n';
}
const tmp = path.join(CACHE, 'app.js');
fs.mkdirSync(CACHE, { recursive: true });
fs.writeFileSync(tmp, joined);
const outJs = path.join(DIST, 'js', 'app.min.js');
fs.mkdirSync(path.dirname(outJs), { recursive: true });
// terser y javascript-obfuscator vienen de devDependencies (npm install); se lanzan con este mismo node.
function run(pkg, args) {
  let dir;
  try {
    dir = path.dirname(require.resolve(pkg + '/package.json', { paths: [ROOT] }));
  } catch {
    throw new Error(`Falta ${pkg}: ejecuta npm install`);
  }
  const binField = require(path.join(dir, 'package.json')).bin;
  const cli = path.join(dir, typeof binField === 'string' ? binField : binField[pkg]);
  execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
}
run('terser', [tmp, '--compress', 'passes=1', '--mangle', '--comments', 'false', '--ecma', '2020', '-o', outJs]);
// Y ofuscado: el código queda ilegible y se rompe solo si lo reformatean para
// tocarlo. Las cadenas, en una tabla codificada (sólo una parte, para no frenar
// el juego). Semilla fija: el mismo código da siempre el mismo archivo.
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
html = html.replace(/<meta name="robots" content="noindex">\s*/, '');
// --sin-seo: sin canonical/redes/datos estructurados ni enlaces a las páginas
// (para publicar antes de tener el dominio survivor.preciostcg.com).
const SIN_SEO = process.argv.includes('--sin-seo');
html = SIN_SEO ? html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->\n?/g, '') : html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
html = html.replace(
  /<!-- src\/index.html: página fuente[^>]*-->/,
  '<!-- GENERADO desde src/index.html por scripts/build.js: no editar a mano. -->'
);
fs.writeFileSync(OUT, html);
// Versión publicada: los jugadores la miran cada 5 min y, si cambia, el juego se
// actualiza solo (en el menú, o al acabar la partida). Ver src/js/core/updater.js.
// --forzar: versión obligatoria, también corta las partidas en curso (guardándolas).
const FORZAR = process.argv.includes('--forzar');
fs.writeFileSync(
  path.join(DIST, 'version.json'),
  JSON.stringify(Object.assign({ v: hash, at: new Date().toISOString() }, FORZAR ? { force: true } : {})) + '\n'
);
console.log(
  `${FORZAR ? '[OBLIGATORIA] ' : ''}${SIN_SEO ? '[sin SEO] ' : ''}${EXPOSE ? '[SIN PROTEGER, sólo pruebas] ' : ''}ok: ${files.length} scripts · ${(joined.length / 1024).toFixed(0)} KB -> ${(min.length / 1024).toFixed(0)} KB (dist/js/app.min.js?v=${hash})`
);
