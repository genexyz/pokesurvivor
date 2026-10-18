/* ============ fullscreen.js — fullscreen on/off ============
 * Used by the top bar, Settings, the pause menu and the in-run HUD button.
 * Browsers only allow entering fullscreen from a real tap or key press, and on
 * Android leaving the browser (minimizing, switching apps) drops it. So when the
 * player had it on and comes back, the next tap anywhere puts it back on.
 */
export const Fullscreen = (() => {
  const listeners = [];

  const can = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const is = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  // iPhone: Safari does not let a website go fullscreen. It does work when
  // opened from the home screen.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () =>
    !!navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  const iosTip = () => IOS && !can() && !standalone();
  const IOS_TIP =
    'On iPhone, Safari does not let websites go fullscreen. Tap Share and then "Add to Home Screen": opening the game from that icon plays it fullscreen.';

  /** Worth offering a button: the browser can do it and it is off right now. */
  const offer = () => can() && !is() && !standalone();

  function enter() {
    if (!can() || is()) return;
    const el = document.documentElement;
    try {
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
    } catch (e) {
      /* nothing */
    }
  }
  function exit() {
    if (is()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
  function toggle() {
    if (is()) exit();
    else enter();
  }

  // Taps on the game canvas are handled on touchstart, which does not count as a
  // gesture for fullscreen; the touchend of the same tap does. arm() enters on
  // the next one (right away if this event already counts).
  let armed = false;
  const GESTURES = ['touchend', 'pointerup', 'click', 'keydown'];
  function onGesture(e) {
    if (e.type === 'keydown' && e.key === 'Escape') return;
    disarm();
    enter();
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    for (const t of GESTURES) document.removeEventListener(t, onGesture, true);
  }
  function arm() {
    if (!can() || is()) return;
    if (navigator.userActivation && navigator.userActivation.isActive) return enter();
    if (armed) return;
    armed = true;
    for (const t of GESTURES) document.addEventListener(t, onGesture, true);
  }

  // Remember whether the player wanted fullscreen, so leaving the browser and
  // coming back restores it, but exiting it on purpose (Esc, back) does not.
  let wanted = false,
    lastVis = 0;
  document.addEventListener('visibilitychange', () => {
    lastVis = Date.now();
    if (!document.hidden && wanted && !is()) arm();
  });
  function changed() {
    if (is()) {
      wanted = true;
      disarm();
    } else if (!document.hidden && Date.now() - lastVis > 1500) wanted = false;
    else if (wanted && !document.hidden) arm();
    for (const fn of listeners) fn(is());
  }
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);

  /** fn(isFull) runs every time fullscreen turns on or off. */
  const onChange = fn => listeners.push(fn);

  return { can, is, offer, iosTip, IOS_TIP, enter, exit, toggle, arm, onChange };
})();
