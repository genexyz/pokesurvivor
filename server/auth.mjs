/* Cuentas: sólo con Google (better-auth, como precios-tcg).
 * Variables de entorno:
 *   BETTER_AUTH_URL       https://survivor.preciostcg.com (en local, http://localhost:3000)
 *   BETTER_AUTH_SECRET    secreto largo al azar (openssl rand -base64 32)
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   el cliente OAuth de Google
 *   ADMIN_EMAILS          correos de moderación, separados por comas
 * La sesión va en una cookie httpOnly (pokesurvivor.session_token).
 */
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { pool } from './db.mjs';

export const BASE_URL = (process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const ADMINS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export const haveGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const options = {
  appName: 'PokéSurvivor',
  baseURL: BASE_URL,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  trustedOrigins: [BASE_URL],
  emailAndPassword: { enabled: false },
  socialProviders: haveGoogle
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          prompt: 'select_account'
        }
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 días
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 }
  },
  advanced: { cookiePrefix: 'pokesurvivor' }
};

export const auth = pool ? betterAuth(options) : null;
export const authHandler = auth ? toNodeHandler(auth) : null;

/** Crea o actualiza las tablas de better-auth. */
export async function migrateAuth() {
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
}

/** El usuario de la petición (cookie de sesión) → { id, email, name, admin } o null. */
export async function userOf(req) {
  if (!auth) return null;
  try {
    const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!s || !s.user) return null;
    return { id: s.user.id, email: s.user.email, name: s.user.name, admin: ADMINS.includes((s.user.email || '').toLowerCase()) };
  } catch (e) {
    return null;
  }
}
