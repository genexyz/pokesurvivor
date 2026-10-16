/* ============ main.js — boot (the entry module: index.html loads only this) ============ */
import { I18n } from './core/i18n.js';
import './data/lang-es.js'; // registers the Spanish translation (nothing imports it by name)
import { Flow } from './game.js';

// Developer tools: window.G with every module, and the balance panel. Never in the published build.
if (import.meta.env.DEV || import.meta.env.MODE === 'expose') import('./debug.js');
if (import.meta.env.DEV) import('./ui/dev-ui.js');

// Maintenance (moving to new servers): no entering the game or signing
// in, so nothing is written while accounts and saves are being copied.
// To test locally: add ?dev to the address.
const MAINTENANCE = false;
function maintenance() {
  if (!MAINTENANCE || /[?&]dev\b/.test(location.search)) return false;
  const es = I18n.lang === 'es';
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
  I18n.startDom();
  // Wait for the pixel font so the UI doesn't jump when it loads.
  const ready = document.fonts && document.fonts.load ? document.fonts.load('16px Pixelify') : Promise.resolve();
  ready.catch(() => {}).then(() => Flow.boot());
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();

// Installable as an app (PWA). Only over http(s): not needed when opened by double-click (file://).
// Not with npm run dev: it would cache the code while developing.
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV && !window.PS_DEV) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[PWA]', e.message)));
}
