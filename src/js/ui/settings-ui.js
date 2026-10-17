/* ============ settings-ui.js — Settings screen (PC and mobile) ============
 * Opens on top of whatever is showing (menu or pause) and returns there on close.
 * Tabs: Sound · Graphics · Controls · Account · About.
 * Settings belong to this device (Settings / Audio in the browser).
 */
import { I18n } from '../core/i18n.js';
import { Settings } from '../core/settings.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { Social } from '../net/social.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { LayoutUI } from './layout-ui.js';
import { Flow, Game } from '../game.js';

export const SettingsUI = (() => {
  const $ = UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let tab = 'sound';

  function init() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => {
      b.onclick = () => {
        tab = b.dataset.t;
        render();
      };
    });
    $('set-close').onclick = close;
    $('btn-settings').innerHTML = Icons.html('gear', 20);
    $('btn-settings').onclick = () => open();
    $('btn-pause-settings').onclick = () => open('sound');
    // Fullscreen (if the browser allows it; on iPhone, how to get it).
    if (canFull() || iosTip()) {
      $('btn-full').classList.remove('hidden');
      $('btn-full').innerHTML = Icons.html('full', 20);
      $('btn-full').onclick = toggleFull;
    }
  }

  function open(t) {
    if (t) tab = t;
    $('scr-settings').classList.remove('hidden');
    render();
  }
  function close() {
    $('scr-settings').classList.add('hidden');
  }
  const isOpen = () => !$('scr-settings').classList.contains('hidden');

  // ---------------- fullscreen ----------------
  function canFull() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }
  function isFull() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  // iPhone: Safari does not let a website go fullscreen (that's why the option
  // sometimes didn't show). It does work when opened from the home screen.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () =>
    !!navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  function iosTip() {
    return IOS && !canFull() && !standalone();
  }
  const IOS_TIP =
    'On iPhone, Safari does not let websites go fullscreen. Tap Share and then "Add to Home Screen": opening the game from that icon plays it fullscreen.';
  function toggleFull() {
    if (!canFull()) {
      if (iosTip()) UI.toast(IOS_TIP, 9000);
      return;
    }
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      // On mobile, also try to lock the screen in landscape.
      if (p && p.then)
        p.then(() => {
          try {
            screen.orientation.lock('landscape').catch(() => {});
          } catch (e) {
            /* nothing */
          }
        }).catch(() => {});
    }
    setTimeout(() => {
      if (isOpen()) render();
    }, 300);
  }

  // ---------------- pieces ----------------
  function section(title, sub) {
    return `<h3 class="set-h">${esc(title)}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}`;
  }
  function toggle(key, label, desc) {
    const on = !!Settings.get(key);
    return `<div class="set-row"><div class="grow"><b>${esc(label)}</b><small>${esc(desc)}</small></div>
      <button class="btn small switch ${on ? 'gold' : ''}" data-k="${key}">${on ? 'Yes' : 'No'}</button></div>`;
  }
  function choice(key, opts) {
    const cur = Settings.get(key);
    return `<div class="chips set-chips">${opts.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  }

  function render() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const box = $('set-body');
    box.scrollTop = 0;
    if (tab === 'sound') {
      box.innerHTML = section('Sound') + '<div id="set-sound" class="sound-inline"></div>';
      UI.soundControls($('set-sound'));
    } else if (tab === 'gfx') {
      const auto = ['low', 'medium', 'high'][Settings.autoLevel];
      box.innerHTML =
        section('Language', 'The game reloads when you change it.') +
        `<div class="chips set-chips" translate="no">${[
          ['en', 'English'],
          ['es', 'Español']
        ]
          .map(([v, l]) => `<button class="chip ${I18n.lang === v ? 'on' : ''}" data-lang="${v}">${l}</button>`)
          .join('')}</div>` +
        section(
          'Quality',
          'How many effects and particles are drawn. <b>Auto</b> lowers it automatically if the game stutters (now: ' + auto + ').'
        ) +
        choice('quality', [
          ['auto', 'Auto'],
          ['high', 'High'],
          ['mid', 'Medium'],
          ['low', 'Low']
        ]) +
        section(
          'Resolution',
          'How many pixels the game draws. <b>Low</b> is much lighter on big screens (less heat and battery); the text looks a bit blockier. <b>Auto</b> goes low when the quality does (now: ×' +
            Game.dpr +
            ').'
        ) +
        choice('res', [
          ['auto', 'Auto'],
          ['high', 'High'],
          ['low', 'Low']
        ]) +
        section('Frame limit', 'Fewer frames per second: less heat and battery. Menus always run at 30.') +
        choice('fpsCap', [
          [0, 'No limit'],
          [120, '120'],
          [60, '60'],
          [30, '30']
        ]) +
        section('Display') +
        toggle('dmgNumbers', 'Damage numbers', 'The numbers that pop up when you hit or get hit.') +
        toggle('calm', 'Less shaking and flashing', 'The camera shakes less and flashes are softer.') +
        toggle('fps', 'Show FPS', 'Frames per second, in the bottom corner.') +
        toggle('recount', 'Damage meter', 'During a run, how much damage each move (and each teammate in co-op) deals. Key R.') +
        toggle('gachaSkip', 'Open without animation', 'The gacha shows the results right away, without the slot machine.') +
        (canFull()
          ? `<div class="set-row"><div class="grow"><b>Fullscreen</b><small>Without browser bars.</small></div>
             <button class="btn small" id="set-full">${isFull() ? 'Exit' : 'Turn on'}</button></div>`
          : iosTip()
            ? `<div class="set-row"><div class="grow"><b>Fullscreen</b><small>${esc(IOS_TIP)}</small></div></div>`
            : '');
    } else if (tab === 'ctl') {
      box.innerHTML =
        section('During a run') +
        `<div class="set-row"><div class="grow"><b>Ask before equipping</b><small>When you find your first item of a run, choose whether to equip it or keep going without one.</small></div></div>` +
        choice('itemConfirm', [
          ['drawback', 'Items with a downside'],
          ['always', 'Always'],
          ['never', 'Never']
        ]) +
        toggle('autoFast', 'Start at ×2 speed', 'Solo runs start at double speed. You can still switch it during the run (the ×2 button or F).') +
        section('Controller', 'Plug in a controller (Xbox, PlayStation, Switch Pro...) and press any button.') +
        `<div class="pad-map"><b>Left stick / D-pad</b><span>Move · in menus, move between buttons</span><b>A</b><span>Choose · Mega Evolve · skip the Judgment cutscene</span><b>B</b><span>Back · pause</span><b>X</b><span>Damage meter · new cards on level-up</span><b>Y</b><span>×2 speed</span><b>LB / RB</b><span>Previous / next move · in menus, switch tabs</span><b>Start</b><span>Pause</span><b>Right stick</b><span>Scroll long lists</span></div>` +
        section('On mobile or tablet') +
        `<p class="sub">Put your finger anywhere and drag to move: the joystick appears where you touch. Tap a move at the bottom to switch to it and the top-right button to pause. Play in landscape.</p>` +
        `<div class="set-row"><div class="grow"><b>Joystick size</b><small>How far you need to drag your finger.</small></div></div>` +
        choice('stick', [
          [0.8, 'Small'],
          [1, 'Normal'],
          [1.25, 'Large']
        ]) +
        `<div class="set-row"><div class="grow"><b>Place the buttons</b><small>Put the attacks, the pause button and the joystick (fixed, if you like) anywhere on the screen.</small></div>
             <button class="btn small" id="set-layout">Place</button></div>` +
        section('On PC') +
        `<div class="keys">
             <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys</div><span>move</span>
             <div><kbd>1</kbd>–<kbd>4</kbd> or click its icon</div><span>choose move</span>
             <div><kbd>Q</kbd> / <kbd>E</kbd></div><span>previous / next move</span>
             <div><kbd>Esc</kbd> or <kbd>P</kbd></div><span>pause</span>
             <div><kbd>R</kbd></div><span>damage meter</span>
             <div><kbd>1</kbd>–<kbd>3</kbd></div><span>choose a card when leveling up</span>
             <div><kbd>R</kbd></div><span>reroll the cards</span>
           </div>`;
    } else if (tab === 'acc') {
      renderAccount(box);
    } else {
      box.innerHTML =
        `<div class="about-logo">PokéSurvivor</div>` +
        `<p class="sub">Fan game <b>free and non-profit</b>: no ads or purchases. Pokémon and its characters are owned by Nintendo, Creatures and GAME FREAK; this project is not affiliated with them.</p>` +
        section('Credits') +
        `<ul class="credits">
             <li><b>Sprites:</b> PMD SpriteCollab and its artists (CC BY-NC 4.0).</li>
             <li><b>Pokémon data:</b> PokéAPI.</li>
             <li><b>Music and sounds:</b> original, generated by the game itself.</li>
             <li><b>Font:</b> Pixelify Sans (OFL).</li>
           </ul>` +
        `<div class="row wrap" style="justify-content:center;gap:8px">
             ${
               window.PS_PAGES
                 ? `<a class="btn small" href="${I18n.page('guide/')}" target="_blank">Guide &amp; FAQ</a>
             <a class="btn small" href="${I18n.page('pokedex/')}" target="_blank">Pokédex</a>`
                 : ''
             }
             <button class="btn small" data-legal>Legal notice &amp; privacy</button>
           </div>`;
    }
    wire(box);
  }

  function renderAccount(box) {
    const st = DB.guest ? 'guest' : DB.syncState;
    const SYNC = {
      ok: 'Saved in the cloud',
      syncing: 'Saving…',
      pending: 'Waiting to upload (uploads when you leave the game)',
      offline: "Offline: it will upload when you're back",
      local: 'Saved only in this browser',
      guest: 'Guest: not saved'
    };
    if (DB.guest) {
      box.innerHTML =
        section('Account', "You're playing as <b>guest</b>: your progress isn't saved when you leave.") +
        `<button class="btn gold" id="set-login">Sign up or log in</button>`;
      return;
    }
    const nick = Social.me ? Social.me.name : DB.user || '';
    const kind = DB.mode === 'local' ? "This browser's save" : 'Google';
    box.innerHTML =
      section('Account') +
      `<div class="set-row"><div class="grow"><b>Nickname</b><small>It's unique and can't be changed.</small></div><span class="gold" translate="no">${esc(nick)}</span></div>` +
      `<div class="set-row"><div class="grow"><b>Account type</b></div><span>${esc(kind)}</span></div>` +
      `<div class="set-row"><div class="grow"><b>Save data</b></div><span>${esc(SYNC[st] || st)}</span></div>` +
      `<div class="row wrap" style="gap:8px;margin-top:12px">
           <button class="btn" id="set-logout">Log out</button>
           <button class="btn danger" id="set-delete">Delete account</button>
         </div><p class="note" id="set-msg"></p>`;
  }

  function wire(box) {
    box.querySelectorAll('.switch[data-k]').forEach(b => {
      b.onclick = () => {
        Settings.set(b.dataset.k, !Settings.get(b.dataset.k));
        render();
      };
    });
    box.querySelectorAll('.chip[data-k]').forEach(b => {
      b.onclick = () => {
        const v = b.dataset.v;
        Settings.set(b.dataset.k, isNaN(+v) ? v : +v);
        render();
      };
    });
    const full = $('set-full');
    if (full) full.onclick = toggleFull;
    const lay = $('set-layout');
    if (lay) lay.onclick = () => LayoutUI.open();
    box.querySelectorAll('[data-lang]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.lang !== I18n.lang) I18n.set(b.dataset.lang);
      };
    });
    const lo = $('set-login');
    if (lo)
      lo.onclick = () => {
        close();
        leave();
      };
    const out = $('set-logout');
    if (out)
      out.onclick = () => {
        close();
        leave();
      };
    const del = $('set-delete');
    if (del)
      del.onclick = async () => {
        const ok = await UI.confirmDelete();
        if (!ok) return;
        del.disabled = true;
        const r = await DB.deleteAccount();
        if (!r.ok) {
          $('set-msg').textContent = r.error;
          del.disabled = false;
          return;
        }
        close();
        UI.toast('Account deleted');
        Audio.music(null);
        Flow.toLogin();
      };
  }

  /** Log out (if you're in a run, it is abandoned). */
  function leave() {
    if (DB.guest && !confirm("You're a guest: all your progress will be lost. Log out?")) return;
    if (Game.state !== 'ui') Game.quit && Game.quit();
    Audio.music(null);
    DB.logout().then(() => Flow.toLogin());
  }

  return {
    init,
    open,
    close,
    get isOpen() {
      return isOpen();
    }
  };
})();
