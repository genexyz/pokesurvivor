/* ============ support-ui.js — "Support the project" ============
 * Heart button in the menu bar (only if there is a Ko-fi account in
 * js/data/funding.js) and a window that explains, with numbers, where the
 * money goes. Nothing is charged inside the game: payment happens on Ko-fi.
 */
G.SupportUI = (() => {
  const $ = G.UI.$;
  const F = G.Funding;
  const val = v =>
    typeof v === 'number'
      ? (Math.round(v * 100) / 100).toLocaleString(G.I18n.locale, { style: 'currency', currency: 'EUR' }) + ' / month'
      : v;

  function init() {
    const b = $('btn-support');
    if (!F.url) return; // no Ko-fi account yet: hidden
    b.classList.remove('hidden');
    b.innerHTML = G.Icons.html('heart', 18) + ' <span>Support</span>';
    b.onclick = open;
    $('sup-close').onclick = close;
  }

  function open() {
    const rows = F.costs.map(([c, v]) => `<tr><td>${c}</td><td class="num">${val(v)}</td></tr>`).join('');
    $('sup-body').innerHTML = `
      <p>PokéSurvivor is and will stay <b>free</b>, with no ads or purchases. If you'd like to help keep it online, you can make a
      <b>voluntary donation</b>: all the money goes to the <b>servers and the domain</b>, nothing else.</p>
      <p class="sub">Donating gives no advantage in the game.</p>
      <h3>What it costs to keep it running</h3>
      <table class="sup-tab">${rows}</table>
      <p class="sub">The more people play, the more the servers cost. Anything left over is saved for the following months' costs.</p>
      <div class="row wrap" style="gap:8px;justify-content:center;margin-top:10px">
        <a class="btn gold" href="${F.url}" target="_blank" rel="noopener">${G.Icons.html('heart', 18)} Donate on Ko-fi</a>
        ${window.PS_PAGES ? `<a class="btn" href="${G.I18n.page('support/')}" target="_blank">More info</a>` : ''}
      </div>`;
    $('scr-support').classList.remove('hidden');
  }
  function close() {
    $('scr-support').classList.add('hidden');
  }

  return { init, open, close };
})();
