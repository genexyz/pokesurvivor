/* ============ camera.js — view and world<->screen transform ============
 * The visible world width is constant (VIEW_W) whatever the window size,
 * so the game feels the same on any screen.
 */
import { U } from './util.js';
import { Settings } from './settings.js';

export const Camera = {
  x: 0,
  y: 0,
  scale: 1,
  VIEW_W: 768, // 20% more view than originally (640)
  shake: 0,
  _sx: 0,
  _sy: 0,

  /** Recomputes the scale for the current canvas size. */
  dpr: 1,

  // On screens wider than 16:9 (phones in landscape) a minimum world height
  // is also ensured, so you don't see a narrow strip.
  MIN_VIEW_H: 420,

  resize(cssW, cssH, dpr = 1) {
    this.dpr = dpr;
    this.scale = Math.min(cssW / this.VIEW_W, cssH / this.MIN_VIEW_H);
    this.w = cssW / this.scale;
    this.h = cssH / this.scale;
  },

  follow(tx, ty, dt) {
    this.x = U.damp(this.x, tx, 9, dt);
    this.y = U.damp(this.y, ty, 9, dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const a = this.shake * 7;
      this._sx = U.rand(-a, a);
      this._sy = U.rand(-a, a);
    } else {
      this._sx = this._sy = 0;
    }
  },

  kick(amount) {
    if (Settings.get('calm')) amount *= 0.25; // "less shaking"
    this.shake = Math.min(1.2, this.shake + amount);
  },

  /** Applies the camera transform to the context. */
  apply(ctx) {
    // Round to physical screen pixels: without this, 1 px seams appear
    // between chunks and sprites "jitter" while moving.
    const k = this.scale * this.dpr;
    ctx.translate(Math.round((-this.left() + this._sx) * k) / k, Math.round((-this.top() + this._sy) * k) / k);
  },

  left() {
    return this.x - this.w / 2;
  },
  top() {
    return this.y - this.h / 2;
  },

  /** Is the point inside the view (with a margin)? */
  sees(x, y, pad = 60) {
    return x > this.left() - pad && x < this.left() + this.w + pad && y > this.top() - pad && y < this.top() + this.h + pad;
  },

  /** Radius of the circle around the view: used to spawn outside it. */
  outerRadius() {
    return Math.hypot(this.w, this.h) / 2 + 40;
  }
};
