/* PokéSurvivor server (replaces nginx and scripts/dev-server.js).
 *   npm start      ->  dist/ exactly as published (run npm run build first). This is what runs on Coolify.
 *   npm run dev    ->  src/ + public/, reloads on save.
 * With DATABASE_URL there is a cloud: Google accounts, saves, friends, leaderboard and
 * co-op rooms (api.mjs, live.mjs). Without it, the game runs in local mode
 * (in dev) or the server only serves the files.
 * Port: PORT (3000 by default; 80 in the Dockerfile).
 */
import './env.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { pool, initSchema } from './db.mjs';
import { authHandler, migrateAuth, haveGoogle, BASE_URL } from './auth.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const PORT = +process.env.PORT || 3000;
const DIRS = DEV ? [path.join(ROOT, 'src'), path.join(ROOT, 'public')] : [path.join(ROOT, 'dist')];
const CLOUD = !!pool;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};
const GZIP = /^(text\/|application\/(json|javascript|manifest\+json|xml)|image\/svg)/;

if (!DEV && !fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('No dist/: run npm run build first');
  process.exit(1);
}

process.on('unhandledRejection', e => console.error('[server] unhandled rejection:', e));

// ---------------- old URLs ----------------

/** The website used to have Spanish paths at the root and English under /en/. */
const OLD_PAGES = {
  guia: 'guide',
  legendarios: 'legendaries',
  tipos: 'types',
  movimientos: 'moves',
  objetos: 'items',
  logros: 'achievements',
  novedades: 'news',
  apoyar: 'support',
  contacto: 'contact'
};

function renamed(p) {
  const m = /^\/([a-z]+)(\/.*)?$/.exec(p);
  return m && Object.hasOwn(OLD_PAGES, m[1]) ? '/' + OLD_PAGES[m[1]] + (m[2] || '/') : null;
}

/** Where an old URL lives now (permanent redirect), or null. */
function movedTo(p) {
  if (p === '/en' || p.startsWith('/en/')) {
    const q = p.slice(3) || '/';
    return renamed(q) || q;
  }
  return renamed(p);
}

// ---------------- files ----------------

/** Same caching that deploy/nginx.conf used to do. */
function cacheOf(p) {
  if (DEV || p === '/version.json') return 'no-store';
  if (p.startsWith('/js/')) return 'public, max-age=31536000, immutable';
  if (p.startsWith('/assets/')) return 'public, max-age=2592000';
  return 'no-cache';
}

function find(urlPath) {
  for (const dir of DIRS) {
    let f = path.join(dir, urlPath);
    if (!f.startsWith(dir)) return null;
    try {
      let st = fs.statSync(f);
      if (st.isDirectory()) {
        f = path.join(f, 'index.html');
        st = fs.statSync(f);
      }
      if (st.isFile()) return { f, st, dir };
    } catch (e) {
      /* not here */
    }
  }
  return null;
}

const gzCache = new Map(); // file -> { mtime, buf } (files don't change in production)
function body(req, file, type, st) {
  const raw = fs.readFileSync(file);
  if (!GZIP.test(type) || raw.length < 1024 || !/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return { buf: raw };
  let c = gzCache.get(file);
  if (!c || c.mtime !== st.mtimeMs) {
    c = { mtime: st.mtimeMs, buf: zlib.gzipSync(raw, { level: 6 }) };
    if (!DEV) gzCache.set(file, c);
  }
  return { buf: c.buf, gz: true };
}

function sendFile(req, res, status, file, st, p) {
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const { buf, gz } = body(req, file, type, st);
  const h = {
    'Content-Type': type,
    'Cache-Control': cacheOf(p),
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': buf.length,
    Vary: 'Accept-Encoding'
  };
  if (gz) h['Content-Encoding'] = 'gzip';
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? undefined : buf);
}

function sendText(res, status, type, text) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(text);
}

// ---------------- development: reload on save ----------------

const reloaders = new Set();
if (DEV) {
  let t = 0;
  fs.watch(path.join(ROOT, 'src'), { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      for (const res of reloaders) res.write('data: reload\n\n');
    }, 100);
  });
}

function devPage(es) {
  let html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  // Without a database, the game runs in local mode (no cloud).
  const inject =
    (CLOUD ? '<script>' : `<script>window.PS_DEV = 'local';`) +
    `new EventSource('/__reload').onmessage = () => location.reload();</script>\n`;
  html = html.replace('<!-- scripts:begin -->', inject + '<!-- scripts:begin -->');
  // /es/: the game in Spanish, just like scripts/make_seo_pages.py generates it.
  if (es)
    html = html
      .replace(/<html lang="[a-z]+">/, '<html lang="es">')
      .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">');
  return html;
}

function devRoute(req, res, p) {
  if (p === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': ok\n\n');
    reloaders.add(res);
    req.on('close', () => reloaders.delete(res));
    return true;
  }
  if (p === '/' || p === '/index.html') {
    sendText(res, 200, TYPES['.html'], devPage(false));
    return true;
  }
  if (p === '/es') {
    res.writeHead(301, { Location: '/es/' });
    res.end();
    return true;
  }
  if (p === '/es/' || p === '/es/index.html') {
    sendText(res, 200, TYPES['.html'], devPage(true));
    return true;
  }
  // updater.js does nothing in dev.
  if (p === '/version.json') {
    sendText(res, 200, TYPES['.json'], JSON.stringify({ v: 'dev' }) + '\n');
    return true;
  }
  return false;
}

// ---------------- server ----------------

const api = CLOUD ? await import('./api.mjs') : null;
const live = CLOUD ? await import('./live.mjs') : null;

const server = http.createServer(async (req, res) => {
  let p;
  try {
    p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return sendText(res, 400, TYPES['.txt'], 'Bad request');
  }
  if (p.startsWith('/api/')) {
    if (!CLOUD) return sendText(res, 200, TYPES['.json'], JSON.stringify({ cloud: false }));
    if (p.startsWith('/api/auth/')) return authHandler(req, res);
    return api.handleApi(req, res, new URL(req.url, BASE_URL));
  }
  const moved = movedTo(p);
  if (moved) {
    const q = new URL(req.url, 'http://x').search;
    res.writeHead(301, { Location: encodeURI(moved) + q });
    return res.end();
  }
  if (DEV && devRoute(req, res, p)) return;
  const hit = find(p);
  if (hit) {
    // /pokedex -> /pokedex/ (like a normal static server), so relative links work.
    if (!p.endsWith('/') && fs.statSync(path.join(hit.dir, p)).isDirectory()) {
      res.writeHead(301, { Location: p + '/' });
      return res.end();
    }
    return sendFile(req, res, 200, hit.f, hit.st, p);
  }
  const nf = !DEV && find('/404.html');
  if (nf) return sendFile(req, res, 404, nf.f, nf.st, '/404.html');
  sendText(
    res,
    404,
    TYPES['.txt'],
    `404: ${p}` + (DEV ? '\nThe website pages (guide, pokédex...) only exist after npm run build; view them with npm start.' : '')
  );
});

if (live) server.on('upgrade', (req, socket, head) => live.handleUpgrade(req, socket, head).catch(() => socket.destroy()));

if (CLOUD) {
  await migrateAuth();
  await initSchema();
  if (!haveGoogle) console.warn('[server] Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: nobody will be able to sign in.');
  if (!process.env.BETTER_AUTH_SECRET) console.warn('[server] Missing BETTER_AUTH_SECRET.');
}

server.listen(PORT, () => {
  const mode = DEV ? 'development' : 'dist/';
  console.log(`PokéSurvivor · ${mode} · ${CLOUD ? 'with cloud (' + BASE_URL + ')' : 'no cloud (DATABASE_URL missing)'}`);
  console.log(`  http://localhost:${PORT}/\n  http://localhost:${PORT}/es/`);
});

// Coolify stops the container with SIGTERM: shut down cleanly.
for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () => {
    server.close();
    if (pool) pool.end().catch(() => {});
    setTimeout(() => process.exit(0), 1500).unref();
  });
