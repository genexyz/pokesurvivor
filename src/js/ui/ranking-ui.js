/* ============ ranking-ui.js — leaderboard screen ============
 * Solo / Group tabs, period (daily ... all-time), everyone or friends only,
 * Pokémon filter (all-time only) and your rank at the bottom even if you are
 * not in the top. What is read is cached for 30 min (see ranking.js).
 */
G.RankingUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let mode = 's',
    period = 'w',
    scope = 'all',
    dex = null;
  let token = 0;

  function init() {
    const dl = $('rk-dl');
    dl.innerHTML = G.DEX.map(p => `<option value="${esc(p.name)}">`).join('');
    $('rk-poke').onchange = () => {
      const v = $('rk-poke').value.trim().toLowerCase();
      const p = G.DEX.find(x => x.name.toLowerCase() === v);
      if (!v) {
        setDex(null);
        return;
      }
      if (!p) {
        G.UI.toast("There's no Pokémon with that name");
        return;
      }
      setDex(p.dex);
    };
    $('rk-clear').onclick = () => {
      $('rk-poke').value = '';
      setDex(null);
    };
    $('rk-mod').onclick = () => G.ModUI.open();
  }

  /** The Pokémon filter only exists in all-time: picking one switches to that tab. */
  function setDex(d) {
    dex = d;
    if (d && period !== 'a') period = 'a';
    $('rk-clear').classList.toggle('hidden', !d);
    tabs();
    load();
  }

  function open() {
    if (!G.SocialUI.needOnline()) return;
    G.UI.show('scr-rank', true);
    if (!G.Social.started) G.Social.start();
    $('rk-mod').classList.toggle('hidden', !G.Ranking.isAdmin());
    tabs();
    load();
  }

  function tabs() {
    const mk = (box, items, cur, set, cls) => {
      box.innerHTML = '';
      for (const [k, label] of items) {
        const b = document.createElement('button');
        b.className = cls + (k === cur ? ' on' : '');
        b.innerHTML = label;
        b.onclick = () => {
          set(k);
          tabs();
          load();
        };
        box.appendChild(b);
      }
    };
    mk(
      $('rk-mode'),
      [
        ['s', `<b>${G.Icons.html('user', 16)} <span translate="no">Solo</span></b>`],
        ['g', `<b>${G.Icons.html('friends', 16)} Group</b>`]
      ],
      mode,
      k => {
        mode = k;
      },
      'gen-tab'
    );
    mk(
      $('rk-period'),
      G.Ranking.PERIODS,
      period,
      k => {
        period = k;
        if (k !== 'a' && dex) {
          dex = null;
          $('rk-poke').value = '';
          $('rk-clear').classList.add('hidden');
        }
      },
      'chip'
    );
    mk(
      $('rk-scope'),
      [
        ['all', 'All'],
        ['friends', 'Friends only']
      ],
      scope,
      k => {
        scope = k;
      },
      'chip'
    );
  }

  const fmt = t => (t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t));

  async function load() {
    const my = ++token;
    const list = $('rk-list');
    list.innerHTML = '<p class="sub">Loading…</p>';
    $('rk-me').innerHTML = '';
    let rows = [],
      me = null;
    try {
      [rows, me] = await Promise.all([
        G.Ranking.top(mode, period, dex, scope === 'friends'),
        G.Social.me ? G.Ranking.myRank(mode, period, dex) : Promise.resolve(null)
      ]);
    } catch (e) {
      if (my !== token) return;
      list.innerHTML = `<p class="sub">Couldn't load the leaderboard (${esc(e.code || e.message)}).</p>`;
      return;
    }
    if (my !== token) return;
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<p class="sub">No records here yet. Be the first!</p>';
    }
    const uid = G.Social.uid;
    const b = G.Ranking.board(mode, period, dex),
      done = G.Ranking.reported();
    rows.forEach((r, i) => list.appendChild(rowEl(r, i + 1, r.uids.includes(uid), b, done)));

    // The sentence is built per language (translating it piece by piece reads oddly).
    // English by default; the Spanish one is hand-written and marked translate="no".
    const en = G.I18n.lang !== 'es';
    const pn = en
      ? { d: 'today', w: 'this week', m: 'this month', y: 'this year', a: 'of all time' }[period]
      : { d: 'de hoy', w: 'de esta semana', m: 'de este mes', y: 'de este año', a: 'de siempre' }[period];
    const mon = dex ? G.DEX_BY[dex].name : '';
    const where = en
      ? (mode === 's' ? 'solo' : 'group') + (dex ? ' with ' + mon : '')
      : (mode === 's' ? 'en solitario' : 'en grupo') + (dex ? ' con ' + mon : '');
    $('rk-me').innerHTML = !G.Social.me
      ? 'Choose a nickname (in Friends) to appear on the leaderboard.'
      : me && me.out
        ? en
          ? `<span translate="no">You're not in the top 50 ${where} ${pn} yet. Your exact rank is in All-time.</span>`
          : `<span translate="no">Aún no estás en el top 50 ${pn} ${where}. Tu puesto exacto está en Histórico.</span>`
        : me
          ? en
            ? `<span translate="no">Your best ${where} rank ${pn}: <b class="gold">#${me.pos}</b> · ${fmt(me.t)}</span>`
            : `<span translate="no">Tu mejor puesto ${pn} ${where}: <b class="gold">#${me.pos}</b> · ${fmt(me.t)}</span>`
          : en
            ? `<span translate="no">You don't have a ${where} record ${pn} yet.</span>`
            : `<span translate="no">Aún no tienes marca ${pn} ${where}.</span>`;
  }

  function rowEl(r, pos, mine, b, done) {
    const el = document.createElement('div');
    el.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ' top' + pos : '');
    el.insertAdjacentHTML('beforeend', `<span class="pos">${pos <= 3 ? G.Icons.html('trophy', 20) : ''}${pos}</span>`);
    const mons = document.createElement('span');
    mons.className = 'mons';
    r.dex.forEach((d, i) => {
      if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!r.shiny[i] }));
    });
    el.appendChild(mons);
    el.insertAdjacentHTML(
      'beforeend',
      `<span class="who"><b translate="no">${r.names.map((n, i) => `<a href="#" class="plink" data-u="${esc(r.uids[i] || '')}">${esc(n)}</a>`).join(' · ')}</b><small>Lv. ${r.lv || 1} · ${(r.kills || 0).toLocaleString(G.I18n.locale)} defeated</small></span>
       <span class="time">${fmt(r.t)}</span>`
    );
    el.querySelectorAll('.plink').forEach(a => {
      a.onclick = e => {
        e.preventDefault();
        G.ProfileUI.show(a.dataset.u);
      };
    });
    // Report a suspicious record (not your own). The admin reviews it (mod-ui.js).
    if (!mine && G.Social.me) {
      const rep = document.createElement('button');
      const sent = done.has(b + '__' + r.id);
      rep.className = 'rk-rep' + (sent ? ' sent' : '');
      rep.title = sent ? 'You already reported it' : 'Report suspicious record';
      rep.innerHTML = G.Icons.html('flag', 16);
      rep.onclick = async () => {
        if (rep.classList.contains('sent')) {
          G.UI.toast('You already reported this record');
          return;
        }
        if (!confirm(`Report ${r.names.join(', ')}'s record as cheating?`)) return;
        rep.classList.add('sent');
        rep.title = 'You already reported it';
        await G.Ranking.report(b, r);
        G.UI.toast('Thanks: we will review it');
      };
      el.appendChild(rep);
    } else el.appendChild(document.createElement('span'));
    return el;
  }

  return { init, open };
})();
