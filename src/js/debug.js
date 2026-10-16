/* ============ debug.js — window.G for the console (dev and build:debug only) ============
 * Every module's exports merged into one object, as the old global G was:
 * G.Game.player, G.Balance, G.DB.save... main.js loads this only when
 * import.meta.env.DEV or the 'expose' mode, so it never reaches the published build.
 */
const mods = import.meta.glob(['./**/*.js', '!./debug.js', '!./main.js', '!./ui/dev-ui.js'], { eager: true });
window.G = Object.assign({}, ...Object.values(mods));
