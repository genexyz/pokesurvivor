/* Vite: npm run dev serves src/ through it (server/index.mjs, middleware mode) and
 * npm run build (scripts/build.js) bundles src/ + public/ into dist/.
 *
 * The ps-release plugin does what the published game needs on top of a plain build:
 *   - obfuscates the bundle (anti-cheat), unless mode 'expose' (npm run build:debug)
 *   - writes dist/version.json and <meta name="ps-version"> with the same fingerprint:
 *     src/js/core/updater.js compares them to move every player to a new version.
 *     Do not remove this (see CLAUDE.md).
 *   - strips the SEO block from index.html with PS_NO_SEO (scripts/build.js --no-seo)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Same options the hand-made build used (scripts/build.js before Vite). Only change them on purpose:
// self-defending code breaks itself if anything reformats it afterwards.
const OBFUSCATOR = {
  compact: true,
  selfDefending: true,
  seed: 7,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.1,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  transformObjectKeys: false,
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  unicodeEscapeSequence: false,
  target: 'browser'
};

function psRelease(mode) {
  const expose = mode === 'expose';
  let version = '';
  return {
    name: 'ps-release',
    apply: 'build',
    enforce: 'post',
    // generateBundle runs after the minifier, so nothing touches the obfuscated code again.
    async generateBundle(_opts, bundle) {
      const chunks = Object.values(bundle).filter(f => f.type === 'chunk');
      if (!expose) {
        const { default: JavaScriptObfuscator } = await import('javascript-obfuscator');
        for (const c of chunks) c.code = JavaScriptObfuscator.obfuscate(c.code, OBFUSCATOR).getObfuscatedCode();
      }
      const h = crypto.createHash('sha1');
      for (const c of chunks.sort((a, b) => a.fileName.localeCompare(b.fileName))) h.update(c.code);
      version = h.digest('hex').slice(0, 10);

      const page = bundle['index.html'];
      let html = String(page.source);
      html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="ps-version" content="${version}">`);
      html = process.env.PS_NO_SEO
        ? html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->\n?/g, '')
        : html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
      html = html.replace(
        /<!-- src\/index\.html:[^>]*-->/,
        '<!-- GENERATED from src/index.html by Vite (npm run build): do not edit by hand. -->'
      );
      page.source = html;
    },
    writeBundle(opts) {
      const v = { v: version, at: new Date().toISOString() };
      if (process.env.PS_FORCE) v.force = true;
      fs.writeFileSync(path.join(opts.dir, 'version.json'), JSON.stringify(v) + '\n');
    }
  };
}

export default defineConfig(({ mode }) => ({
  root: path.join(ROOT, 'src'),
  publicDir: path.join(ROOT, 'public'),
  base: '/',
  plugins: [psRelease(mode)],
  build: {
    outDir: path.join(ROOT, 'dist'),
    emptyOutDir: true,
    sourcemap: mode === 'expose',
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 4096, // one bundle on purpose (~1.7 MB obfuscated)
    minify: mode === 'expose' ? false : 'terser',
    terserOptions: { compress: { passes: 1 }, mangle: true, format: { comments: false }, ecma: 2020 },
    // Not Vite's default assets/ folder: public/assets/ (sprites, fonts) already lives there.
    rolldownOptions: {
      output: {
        entryFileNames: 'js/app-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'css/[name]-[hash][extname]'
      }
    }
  }
}));
