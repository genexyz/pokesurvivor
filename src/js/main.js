/* ============ main.js — boot ============ */
(() => {
  // If a file fails to load (e.g. a dropped mobile connection), better to
  // warn than to start half-broken.
  const NEED = [
    'U',
    'I18n',
    'Settings',
    'DB',
    'Audio',
    'Input',
    'Touch',
    'Sprites',
    'Camera',
    'Moves',
    'Enemies',
    'Upgrades',
    'Items',
    'World',
    'FX',
    'Projectiles',
    'EnemyMgr',
    'Pickups',
    'Player',
    'Combat',
    'Spawner',
    'LevelUp',
    'Gacha',
    'Rift',
    'Weather',
    'Progress',
    'Hazards',
    'Social',
    'Net',
    'Coop',
    'Ranking',
    'Icons',
    'UI',
    'HUD',
    'MenuUI',
    'RunUI',
    'SettingsUI',
    'Funding',
    'SupportUI',
    'Game',
    'Flow'
  ];
  function broken() {
    // (In the published build G is not on window: it is wrapped, see scripts/build.js.)
    const miss = NEED.filter(k => typeof G !== 'object' || !G[k]);
    if (!miss.length) return false;
    const el = document.getElementById('boot');
    const es = typeof G === 'object' && G.I18n ? G.I18n.lang === 'es' : /^es/i.test(navigator.language || '');
    el.innerHTML =
      (es ? 'No se pudo cargar todo el juego (¿se cortó la conexión?).' : "The game couldn't fully load (did the connection drop?).") +
      '<br><button class="btn gold" style="margin-top:12px" onclick="location.reload()">' +
      (es ? 'Recargar' : 'Reload') +
      '</button>';
    console.warn('[Boot] missing:', miss.join(', '));
    return true;
  }

  // Maintenance (moving to new servers): no entering the game or signing
  // in, so nothing is written while accounts and saves are being copied.
  // To test locally: add ?dev to the address.
  const MAINTENANCE = false;
  function maintenance() {
    if (!MAINTENANCE || /[?&]dev\b/.test(location.search)) return false;
    const es = typeof G === 'object' && G.I18n ? G.I18n.lang === 'es' : /^es/i.test(navigator.language || '');
    const el = document.getElementById('boot');
    el.setAttribute('translate', 'no');
    el.innerHTML =
      '<div class="boot-in"><h1>PokéSurvivor</h1>' +
      (!es
        ? '<p><b>We are under maintenance.</b></p><p>We are moving the game to new servers so it can stay free for everyone. ' +
          'Your account, your save and your Pokémon are safe. Please come back in a few hours!</p>'
        : '<p><b>Estamos en mantenimiento.</b></p><p>Estamos mudando el juego a servidores nuevos para que siga siendo gratis para todos. ' +
          'Tu cuenta, tu partida y tus Pokémon están a salvo. ¡Vuelve en unas horas!</p>') +
      '<button class="btn gold" style="margin-top:12px" onclick="location.reload()">' +
      (es ? 'Volver a intentarlo' : 'Try again') +
      '</button></div>';
    return true;
  }

  function boot() {
    if (maintenance()) return;
    if (broken()) return;
    G.I18n.startDom();
    // Wait for the pixel font so the UI doesn't jump when it loads.
    const ready = document.fonts && document.fonts.load ? document.fonts.load('16px Pixelify') : Promise.resolve();
    ready.catch(() => {}).then(() => G.Flow.boot());
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();

  // Installable as an app (PWA). Only over http(s): not needed when opened by double-click (file://).
  // Not with npm run dev: it would cache the code while developing.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.PS_DEV) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('[PWA]', e.message)));
  }
})();
