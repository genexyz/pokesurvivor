/* ============ news-ui.js — "What's new" ============
 * Button in the top bar that opens the list of game changes
 * (js/data/changelog.js). It shows a dot while there is something you haven't seen.
 */
G.NewsUI = (() => {
  const $ = G.UI.$;
  const KEY = 'ps.news.seen';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const latest = () => (G.CHANGELOG[0] || {}).d || '';
  function seen() {
    try {
      return localStorage.getItem(KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function init() {
    const b = $('btn-news');
    b.innerHTML = G.Icons.html('book', 18) + ' <span>What\'s new</span><i class="dot"></i>';
    b.onclick = open;
    $('news-close').onclick = close;
    refresh();
  }
  function refresh() {
    $('btn-news').classList.toggle('new', seen() < latest());
  }

  function fmt(d) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(G.I18n.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function open() {
    // Each entry is [English, Spanish].
    const li = G.I18n.lang === 'es' ? 1 : 0;
    // Every text is already in its language: translate="no" so i18n leaves it alone.
    const PARTS = [
      ['new', ['New', 'Nuevo']],
      ['chg', ['Changes', 'Cambios']],
      ['fix', ['Fixes', 'Arreglos']]
    ];
    $('news-body').innerHTML = G.CHANGELOG.map(
      v =>
        `<div class="news-day" translate="no"><h3>${esc(v.title ? v.title[li] : '')}<small>${fmt(v.d)}</small></h3>` +
        PARTS.filter(([k]) => v[k] && v[k].length)
          .map(
            ([k, lbl]) =>
              `<div class="news-part"><span class="news-tag ${k}">${lbl[li]}</span><ul>${v[k].map(t => `<li>${esc(t[li])}</li>`).join('')}</ul></div>`
          )
          .join('') +
        '</div>'
    ).join('');
    $('news-body').scrollTop = 0;
    $('scr-news').classList.remove('hidden');
    try {
      localStorage.setItem(KEY, latest());
    } catch (e) {
      /* nothing */
    }
    refresh();
  }
  function close() {
    $('scr-news').classList.add('hidden');
  }

  return { init, open, close };
})();
