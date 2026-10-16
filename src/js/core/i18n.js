/* ============ i18n.js — languages (English / Spanish) ============
 * The game is written in English. If the language is Spanish, every text that
 * is shown is translated with the dictionary in js/data/lang-es.js, without
 * touching each screen:
 *   - the DOM (menus, cards, notices...) through a MutationObserver,
 *   - the canvas (HUD, notices, numbers) by wrapping fillText/strokeText,
 *   - confirm()/alert().
 *
 * The dictionary uses the English text as the key. Three levels:
 *   1. exact phrase                    'Back' -> 'Volver'
 *   2. pattern with slots {x}          'You got a shiny {x}!' -> '¡Has conseguido a {x} shiny!'
 *                                      (whatever fills the slot is translated too)
 *   3. pieces inside a longer text, whole words only
 * Player-written text (nicknames) is marked with translate="no".
 *
 * Language: the one chosen in Settings; otherwise /es/ in the address, or the
 * browser's (Spanish if the browser is in Spanish, English otherwise).
 */
export const I18n = (() => {
  const KEY = 'ps.lang';
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (e) {
    /* nothing */
  }
  const byPath = /\/es(\/|$)/.test(location.pathname) ? 'es' : null;
  const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
  const lang = saved === 'es' || saved === 'en' ? saved : byPath || (nav.startsWith('es') ? 'es' : 'en');
  document.documentElement.lang = lang;
  /** Locale for numbers and dates. */
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

  const exact = new Map(),
    exactLow = new Map();
  let patterns = [],
    frag = null,
    fragMap = new Map();
  const cache = new Map();
  const L = '\\p{L}\\p{N}';
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Adds translations { 'English text': 'texto en español' }.
   * exactOnly: only whole texts match (no pieces inside longer texts), for
   * common single words such as personality traits ('Calm', 'Proud'). */
  function add(dict, exactOnly = false) {
    const fr = [];
    for (const [src, tr] of Object.entries(dict)) {
      if (!tr || src === tr) continue;
      if (src.includes('{x}')) {
        const parts = src.split('{x}').map(reEsc);
        const fixed = src.replace(/\{x\}/g, '').length;
        patterns.push({
          re: new RegExp('^' + parts.join('(.+?)') + '$', 'u'),
          reI: new RegExp('^' + parts.join('(.+?)') + '$', 'iu'),
          tr,
          fixed
        });
      } else {
        exact.set(src, tr);
        exactLow.set(src.toLowerCase(), tr);
        if (!exactOnly && (src.length >= 4 || /\s/.test(src))) {
          fr.push(src);
          fragMap.set(src.toLowerCase(), tr);
        }
      }
    }
    // The most specific patterns first ('A wild shiny {x} appeared!' before 'A wild {x} appeared!').
    patterns.sort((a, b) => b.fixed - a.fixed);
    // A single expression with every piece (longest first), whole words only.
    const all = [...fragMap.keys()]
      .sort((a, b) => b.length - a.length)
      .map(reEsc)
      .join('|');
    frag = all ? new RegExp(`(?<![${L}])(${all})(?![${L}])`, 'giu') : null;
    cache.clear();
  }

  function keepCase(src, tr) {
    if (src === src.toUpperCase() && /\p{L}/u.test(src)) return tr.toUpperCase();
    return tr;
  }

  /** Translates a text into the current language. */
  function t(s) {
    if (lang === 'en' || !s || typeof s !== 'string') return s;
    if (!/\p{L}/u.test(s)) return s;
    const c = cache.get(s);
    if (c !== undefined) return c;
    let r = core(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
    return r;
  }

  function core(s) {
    // Keeps the surrounding whitespace (DOM text nodes).
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    // HTML texts may span several lines: they are compared with whitespace collapsed.
    const lead = m[1],
      tail = m[3],
      body = m[2].replace(/\s+/g, ' ');
    if (!body) return s;
    const upper = body === body.toUpperCase() && /\p{L}/u.test(body);
    let r = exact.get(body);
    if (r === undefined && upper) {
      const e = exactLow.get(body.toLowerCase());
      if (e !== undefined) r = keepCase(body, e);
    }
    if (r === undefined) {
      for (const p of patterns) {
        const mm = (upper ? p.reI : p.re).exec(body);
        if (!mm) continue;
        let i = 1;
        r = p.tr.replace(/\{x\}/g, () => {
          const g = mm[i++];
          return g === undefined ? '' : core(g);
        });
        r = keepCase(body, r);
        break;
      }
    }
    if (r === undefined && frag) {
      r = body.replace(frag, w => keepCase(w, fragMap.get(w.toLowerCase()) || w));
    }
    return lead + (r === undefined ? body : r) + tail;
  }

  /** Text with slots for code: I18n.f('Level {x}', 5). */
  function f(src, ...vals) {
    let i = 0;
    return t(src).replace(/\{x\}/g, () => vals[i++]);
  }

  // ---------------- DOM ----------------
  const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  const skipEl = el => !!(el && el.closest && el.closest('[translate="no"], script, style, code'));

  function doText(n) {
    const p = n.parentElement;
    if (!p || skipEl(p)) return;
    const v = n.nodeValue;
    if (n.__tr === v) return;
    const r = t(v);
    n.__tr = r;
    if (r !== v) n.nodeValue = r;
  }
  function doEl(el) {
    if (skipEl(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) {
        const r = t(v);
        if (r !== v) el.setAttribute(a, r);
      }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) {
      doText(root);
      return;
    }
    if (root.nodeType !== 1 || skipEl(root)) return;
    doEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else doEl(n);
    }
  }

  /** Link to a website page ('guide/') in the current language ('es/guide/'). */
  const page = p => (lang === 'es' ? 'es/' : '') + p;

  function startDom() {
    if (lang === 'en') return;
    // Links to the website pages point to their Spanish version.
    document.querySelectorAll('a[data-page]').forEach(a => a.setAttribute('href', page(a.getAttribute('href'))));
    walk(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.title = t(document.title);
  }

  // ---------------- canvas and browser dialogs ----------------
  if (lang !== 'en') {
    const P = CanvasRenderingContext2D.prototype;
    for (const k of ['fillText', 'strokeText', 'measureText']) {
      const orig = P[k];
      P[k] = function (s, ...a) {
        return orig.call(this, typeof s === 'string' ? t(s) : s, ...a);
      };
    }
    const oc = window.confirm,
      oa = window.alert;
    window.confirm = s => oc.call(window, t(s));
    window.alert = s => oa.call(window, t(s));
  }

  function set(l) {
    try {
      localStorage.setItem(KEY, l);
    } catch (e) {
      /* nothing */
    }
    location.reload();
  }

  /** Spanish entry of an English text, whatever the current language (for save migrations). */
  const es = s => exact.get(s);

  return { lang, locale, add, t, f, es, page, set, startDom, walk };
})();
export const T = I18n.t;
