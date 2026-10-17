/* ============ ui.js — shared interface utilities ============
 * - Show / hide screens.
 * - Animated PMD sprites inside DOM <canvas> elements (menu, collection,
 *   gacha...). They register here and the main loop animates them with tick().
 * - Interface sounds (via delegation: any button plays a sound on its own).
 * - Sound panel, notices (toast), coins, type chips, stars.
 */
import { U } from '../core/util.js';
import { I18n, T } from '../core/i18n.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Icons } from './icons.js';
import { Flow } from '../game.js';

export const UI = (() => {
  const $ = id => document.getElementById(id);
  const SCREENS = [
    'scr-login',
    'scr-test',
    'scr-result',
    'scr-starters',
    'scr-menu',
    'scr-play',
    'scr-dex',
    'scr-upgrades',
    'scr-gacha',
    'scr-levelup',
    'scr-pause',
    'scr-over',
    'scr-nick',
    'scr-friends',
    'scr-lobby',
    'scr-rank',
    'scr-item',
    'scr-goals',
    'scr-bond',
    'scr-mod'
  ];

  // The move tooltip (ui/move-tip.js) never stays over a screen change.
  const hideTip = () => {
    const t = document.getElementById('move-tip');
    if (t) t.classList.add('hidden');
  };

  function show(id, keepMenu = false) {
    hideTip();
    for (const s of SCREENS) if (s !== id && !(keepMenu && s === 'scr-menu')) $(s).classList.add('hidden');
    $(id).classList.remove('hidden');
  }
  function hide(id) {
    $(id).classList.add('hidden');
  }
  function hideAll() {
    hideTip();
    for (const s of SCREENS) $(s).classList.add('hidden');
  }
  function isOpen(id) {
    return !$(id).classList.contains('hidden');
  }

  /** Top bar (coins, user, sound) only outside runs. */
  function chrome(on) {
    $('topbar').classList.toggle('hidden', !on);
    $('credits-line').classList.toggle('hidden', !on);
    if (!on) $('sound-panel').classList.add('hidden');
    if (on) refreshCoins();
  }

  function refreshCoins() {
    const s = DB.save;
    $('coins').textContent = s ? s.coins.toLocaleString(I18n.locale) : '0';
    const t = (s && s.tickets) || { t1: 0, t10: 0 };
    $('tickets-pill').innerHTML = `${Icons.html('ticket', 18)} ${t.t1} &nbsp;${Icons.html('ticket10', 18)} ${t.t10}`;
    // Sync dot: green = saved in the cloud, yellow = saving,
    // red = offline (saved locally and uploaded when back online).
    const st = DB.guest ? 'guest' : DB.syncState;
    const TIP = {
      ok: 'Saved in the cloud',
      syncing: 'Saving…',
      pending: 'Saving…',
      offline: "Offline: it will upload when you're back",
      local: 'Saved only in this browser',
      guest: 'Guest: not saved'
    };
    $('user-pill').innerHTML =
      Icons.html(DB.guest ? 'user' : 'crown', 18) +
      ' <span translate="no">' +
      (DB.guest ? T('Guest') : DB.user || '') +
      '</span>' +
      `<i class="sync ${st}" title="${TIP[st] || ''}"></i>`;
    $('user-pill').title = TIP[st] || '';
  }

  let toastEl = null,
    toastT = 0;
  function toast(msg, ms = 2200) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      toastEl.style.display = 'none';
    }, ms);
  }

  function typeChips(types) {
    return types.map(t => `<span class="type" style="background:${U.TYPE_COLOR[t]}">${U.TYPE_NAME[t]}</span>`).join('');
  }

  /** Rarity: its matching Poké Ball (see Icons.rarity). */
  function stars(n, size = 12) {
    return Icons.rarity(n, size > 16 ? 24 : 12);
  }

  // ---------------- interface sound ----------------

  const CLICKABLE = '.btn, .menu-item, .tab, .chip, .card, .cell:not(.locked), .answer, .gen-tab';
  let lastHover = null;

  function wireSounds() {
    document.addEventListener('pointerover', e => {
      const el = e.target.closest(CLICKABLE);
      if (el && el !== lastHover && !el.disabled) Audio.sfx('hover');
      lastHover = el;
    });
    document.addEventListener(
      'click',
      e => {
        const el = e.target.closest(CLICKABLE);
        if (!el) return;
        if (el.disabled) {
          Audio.sfx('error');
          return;
        }
        // Buttons with their own sound (buy, pull, choose...) play it themselves.
        if (el.dataset.sfx === 'none') return;
        Audio.sfx(el.matches('[data-back]') ? 'back' : el.dataset.sfx || 'click');
      },
      true
    );
  }

  /** Volume controls (used in the top bar and in the pause menu). */
  function soundControls(box) {
    const st = Audio.settings;
    box.innerHTML = `
      <div class="snd-row">${Icons.html('sound', 18)}<span>Music</span>
        <input type="range" min="0" max="100" value="${Math.round(st.music * 100)}" data-k="music"></div>
      <div class="snd-row">${Icons.html('sound', 18)}<span>Effects</span>
        <input type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}" data-k="sfx"></div>
      <button class="btn small ${st.muted ? 'gold' : ''}" data-mute>${st.muted ? 'Unmute' : 'Mute all'}</button>`;
    box.querySelectorAll('input[type=range]').forEach(r => {
      r.oninput = () => Audio.setVolume(r.dataset.k, r.value / 100);
      r.onchange = () => Audio.sfx('click');
    });
    box.querySelector('[data-mute]').onclick = () => {
      Audio.toggleMute();
      soundControls(box);
      refreshSoundIcon();
    };
  }

  function refreshSoundIcon() {
    $('btn-sound').innerHTML = Icons.html(Audio.settings.muted ? 'mute' : 'sound', 20);
  }

  // ---------------- legal notice ----------------

  function openLegal() {
    const canDelete = DB.loggedIn && !DB.guest;
    $('legal-delete').disabled = !canDelete;
    $('legal-del-msg').textContent = canDelete ? '' : 'Log in to be able to delete your account.';
    $('scr-legal').classList.remove('hidden');
  }

  /** "Are you sure you want to delete the account?" → true if confirmed. */
  function confirmDelete() {
    return Promise.resolve(confirm(T('Your account and all your progress will be deleted forever. Are you sure?')));
  }

  function closeLegal() {
    $('scr-legal').classList.add('hidden');
  }

  function wireLegal() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-legal]')) {
        e.preventDefault();
        openLegal();
      }
    });
    $('legal-close').onclick = closeLegal;
    $('legal-delete').onclick = async () => {
      const ok = await confirmDelete();
      if (!ok) return;
      $('legal-delete').disabled = true;
      const r = await DB.deleteAccount();
      if (!r.ok) {
        $('legal-del-msg').textContent = r.error;
        $('legal-delete').disabled = false;
        return;
      }
      closeLegal();
      toast('Account deleted');
      Audio.music(null);
      Flow.toLogin();
    };
  }

  function initChrome() {
    Icons.installCss();
    wireLegal();
    DB.onSync(() => {
      if (!$('topbar').classList.contains('hidden')) refreshCoins();
    });
    wireSounds();
    refreshSoundIcon();
    $('btn-sound').onclick = () => {
      const p = $('sound-panel');
      p.classList.toggle('hidden');
      if (!p.classList.contains('hidden')) soundControls(p);
    };
  }

  // ---------------- sprites in DOM canvases ----------------

  const live = new Set();
  // Only canvases in view are animated (the collection has hundreds).
  const seen = new WeakMap();
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting)), { rootMargin: '80px' })
      : null;

  /**
   * Animates a Pokémon inside a <canvas>.
   * opts: { anim='Idle', dir=0, shiny, silhouette, lively (attacks every now
   *         and then), spin (keeps turning), shadow=true,
   *         scale=2   FIXED pixel size (×2 as in the game): every Pokémon in a
   *                   view gets the same pixel size, even if the giant ones
   *                   don't fit whole
   *         hero      single-Pokémon view: may reduce the scale so it fits,
   *                   since there's nothing to compare it with
   *         padBottom px of extra canvas below the box the Pokémon is placed in:
   *                   room for animations that reach below its feet }
   */
  function sprite(cv, dex, opts = {}) {
    for (const s of live) if (s.cv === cv) live.delete(s);
    const a = new Sprites.Animator(dex, 1, !!opts.shiny);
    a.dir = opts.dir || 0;
    a.loop(opts.anim || 'Idle');
    const s = { cv, ctx: cv.getContext('2d'), a, dex, opts, t: Math.random() * 3, spinT: 0, sparkT: 0 };
    live.add(s);
    if (io) io.observe(cv);
    return s;
  }

  function tick(dt) {
    for (const s of live) {
      if (!s.cv.isConnected) {
        live.delete(s);
        if (io) io.unobserve(s.cv);
        continue;
      }
      if (s.cv.offsetParent === null) continue; // hidden screen
      if (io && seen.get(s.cv) === false) continue; // out of view
      s.a.update(dt);

      if (s.opts.lively) {
        s.t -= dt;
        if (s.t <= 0) {
          s.t = U.rand(2.5, 4.5);
          s.a.play(U.pick(['Attack', 'Shoot', 'Charge']));
        }
      }
      if (s.opts.spin) {
        s.spinT += dt;
        if (s.spinT > 1.4) {
          s.spinT = 0;
          s.a.dir = (s.a.dir + 7) % 8;
        }
      }

      const { cv, ctx } = s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;

      // Integer scale so the pixels stay sharp.
      const m = Sprites.animMeta(s.dex, 'Idle');
      const ay = m ? m.ay : 24;
      let k = s.opts.scale || 2;
      const H = cv.height - (s.opts.padBottom || 0); // the box it is placed in
      if (s.opts.hero) k = Math.max(1, Math.min(k, Math.floor((H * 0.8) / ay)));
      s.a.scale = k / Sprites.PX;
      // If it doesn't fit standing, the body is centered in the box.
      const big = ay * k > H * 0.8;
      const fx = cv.width / 2,
        fy = big ? H / 2 + ay * k * 0.45 : H * 0.88;

      if (s.opts.shadow !== false && !s.opts.silhouette) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath();
        ctx.ellipse(fx, fy, 9 * k, 3.4 * k, 0, 0, 6.2832);
        ctx.fill();
      }
      if (s.opts.silhouette) {
        ctx.save();
        ctx.filter = 'brightness(0)';
        ctx.globalAlpha = 0.55;
        s.a.draw(ctx, fx, fy);
        ctx.restore();
      } else {
        s.a.draw(ctx, fx, fy);
      }

      // Twinkles around shinies: each one appears at a random spot.
      if (s.opts.shiny && !s.opts.silhouette) {
        s.tw = s.tw || [];
        s.sparkT -= dt;
        if (s.sparkT <= 0 && s.tw.length < 4) {
          s.sparkT = U.rand(0.18, 0.45);
          s.tw.push({ x: fx + U.rand(-0.32, 0.32) * cv.width, y: U.rand(0.12, 0.7) * cv.height, t: 0, life: U.rand(0.5, 0.8) });
        }
        for (let i = s.tw.length - 1; i >= 0; i--) {
          const w = s.tw[i];
          w.t += dt;
          if (w.t >= w.life) {
            s.tw.splice(i, 1);
            continue;
          }
          Icons.twinkle(ctx, w.x, w.y, w.t / w.life, Math.max(2, k));
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Creates a <canvas> with an animated sprite (for grids). */
  function spriteCanvas(dex, w, h, opts) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    sprite(cv, dex, opts);
    return cv;
  }

  return {
    $,
    show,
    hide,
    hideAll,
    isOpen,
    chrome,
    refreshCoins,
    toast,
    typeChips,
    stars,
    confirmDelete,
    sprite,
    spriteCanvas,
    tick,
    initChrome,
    soundControls
  };
})();
