/* Ejecuta un script de Python 3 con el intérprete que haya (Windows, Mac, Linux, Docker).
 *   node scripts/py.js scripts/make_seo_pages.py [args...]
 * Orden: $PYTHON, python3, python, py y, en Windows, las instalaciones normales
 * aunque no estén en el PATH. Se salta el "python" falso de la Microsoft Store.
 */
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');

function candidates() {
  const list = [process.env.PYTHON, 'python3', 'python', 'py'].filter(Boolean);
  if (process.platform === 'win32') {
    for (const base of [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'), 'C:\\Program Files', 'C:\\Python']) {
      try {
        for (const d of fs.readdirSync(base).filter(d => /^Python3\d+$/i.test(d)).sort().reverse()) list.push(path.join(base, d, 'python.exe'));
      } catch { /* no existe */ }
    }
  }
  return list;
}

const python = candidates().find(py => {
  const r = spawnSync(py, ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0 && /Python 3/.test(r.stdout + r.stderr);
});
if (!python) {
  console.error('No se encontró Python 3. Instálalo (y ponlo en el PATH) o indica dónde está con PYTHON=/ruta/a/python.');
  process.exit(1);
}
const r = spawnSync(python, process.argv.slice(2), { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
process.exit(r.status ?? 1);
