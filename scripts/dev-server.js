/* Servidor local, sin dependencias.
 *   npm run dev            ->  http://localhost:3000  src/ + public/, sin nube, se recarga al guardar
 *   npm run dev:emulator   ->  igual, pero con el emulador de Firebase (necesita Java)
 *   npm start              ->  sirve dist/ tal cual se publica (antes: npm run build)
 * Puerto: PORT=4000 npm run dev
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const DIST_MODE = process.argv.includes('--dist'), EMULATOR = process.argv.includes('--emulator');
const PORT = +process.env.PORT || 3000;
const DIRS = DIST_MODE ? [path.join(ROOT, 'dist')] : [path.join(ROOT, 'src'), path.join(ROOT, 'public')];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.md': 'text/plain; charset=utf-8'
};

if (DIST_MODE && !fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('No hay dist/: ejecuta antes npm run build');
  process.exit(1);
}

// Recarga al guardar (sólo en dev): el navegador escucha /__reload y recarga cuando cambia algo de src/.
const clients = new Set();
if (!DIST_MODE) {
  let t = 0;
  fs.watch(path.join(ROOT, 'src'), { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => { for (const res of clients) res.write('data: reload\n\n'); }, 100);
  });
}

function devPage(en) {
  let html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  const inject = `<script>window.PS_DEV = ${JSON.stringify(EMULATOR ? 'emulator' : 'local')};` +
    `new EventSource('/__reload').onmessage = () => location.reload();</script>\n`;
  html = html.replace('<!-- scripts:begin -->', inject + '<!-- scripts:begin -->');
  // /en/: el juego en inglés, igual que lo genera scripts/make_seo_pages.py.
  if (en) html = html.replace('<html lang="es">', '<html lang="en">').replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">');
  return html;
}

function find(urlPath) {
  for (const dir of DIRS) {
    let f = path.join(dir, urlPath);
    if (!f.startsWith(dir)) return null;
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, TYPES['.txt'], 'Bad request'); }
  if (!DIST_MODE) {
    if (p === '/__reload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/' || p === '/index.html') return send(res, 200, TYPES['.html'], devPage(false));
    if (p === '/en' || p === '/en/' || p === '/en/index.html') {
      if (p === '/en') { res.writeHead(301, { Location: '/en/' }); return res.end(); }
      return send(res, 200, TYPES['.html'], devPage(true));
    }
    // updater.js no hace nada en dev; social.js sólo usa la cabecera Date.
    if (p === '/version.json') return send(res, 200, TYPES['.json'], JSON.stringify({ v: 'dev' }) + '\n');
  }
  const f = find(p);
  if (f) {
    // /pokedex -> /pokedex/ (como un servidor estático normal), así funcionan los enlaces relativos.
    if (fs.statSync(path.join(DIRS.find(d => f.startsWith(d)), p)).isDirectory() && !p.endsWith('/')) {
      res.writeHead(301, { Location: p + '/' });
      return res.end();
    }
    return send(res, 200, TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', req.method === 'HEAD' ? '' : fs.readFileSync(f));
  }
  const nf = DIST_MODE && path.join(ROOT, 'dist', '404.html');
  if (nf && fs.existsSync(nf)) return send(res, 404, TYPES['.html'], fs.readFileSync(nf));
  send(res, 404, TYPES['.txt'], `404: ${p}` + (DIST_MODE ? '' : '\nLas páginas de la web (guía, pokédex...) sólo existen tras npm run build; míralas con npm start.'));
}).listen(PORT, () => {
  const mode = DIST_MODE ? 'dist/ (como en producción)' : EMULATOR ? 'desarrollo + emulador de Firebase' : 'desarrollo (sin nube)';
  console.log(`PokéSurvivor · ${mode}\n  http://localhost:${PORT}/\n  http://localhost:${PORT}/en/`);
});

if (EMULATOR) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const emu = spawn(npx, ['--yes', 'firebase-tools', 'emulators:start', '--project', 'demo-ps', '--only', 'auth,firestore,database'],
    { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  const stop = () => { emu.kill(); process.exit(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  emu.on('exit', code => { console.log('[emulador] terminado', code); });
}
