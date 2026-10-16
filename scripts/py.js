/* Runs a Python 3 script with whatever interpreter is available (Windows, Mac, Linux, Docker).
 *   node scripts/py.js scripts/make_seo_pages.py [args...]
 * Order: $PYTHON, python3, python, py and, on Windows, the usual install locations
 * even if they are not on the PATH. Skips the fake Microsoft Store "python".
 */
const { spawnSync } = require('child_process'),
  fs = require('fs'),
  path = require('path');

function candidates() {
  const list = [process.env.PYTHON, 'python3', 'python', 'py'].filter(Boolean);
  if (process.platform === 'win32') {
    for (const base of [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'), 'C:\\Program Files', 'C:\\Python']) {
      try {
        for (const d of fs
          .readdirSync(base)
          .filter(d => /^Python3\d+$/i.test(d))
          .sort()
          .reverse())
          list.push(path.join(base, d, 'python.exe'));
      } catch {
        /* does not exist */
      }
    }
  }
  return list;
}

const python = candidates().find(py => {
  const r = spawnSync(py, ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0 && /Python 3/.test(r.stdout + r.stderr);
});
if (!python) {
  console.error('Python 3 not found. Install it (and add it to the PATH) or point to it with PYTHON=/path/to/python.');
  process.exit(1);
}
const r = spawnSync(python, process.argv.slice(2), { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
process.exit(r.status ?? 1);
