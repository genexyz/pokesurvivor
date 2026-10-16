/* Postgres: la conexión y las tablas del juego.
 * Las tablas de las cuentas (user, session, account, verification) las crea
 * better-auth (auth.mjs, runMigrations). Las del juego, aquí: se crean al
 * arrancar si no existen (CREATE ... IF NOT EXISTS), así que no hay que hacer
 * nada a mano al publicar.
 */
import pg from 'pg';

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: +process.env.PG_POOL || 10 })
  : null;

if (pool) pool.on('error', e => console.error('[db]', e.message));

export const q = (text, params) => pool.query(text, params);

/** Ejecuta fn(client) dentro de una transacción. */
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS saves (
  uid        text PRIMARY KEY,
  save       jsonb NOT NULL,
  v          int NOT NULL DEFAULT 3,
  ban        boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saves_ban ON saves (ban) WHERE ban;

-- Apodo único y perfil público (favoritos, título, récords, medallas).
CREATE TABLE IF NOT EXISTS profiles (
  uid   text PRIMARY KEY,
  name  text NOT NULL,
  lower text NOT NULL UNIQUE,
  data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  at    timestamptz NOT NULL DEFAULT now()
);

-- Amistades: a < b; status 'pending' (la envió from_uid) u 'ok'.
CREATE TABLE IF NOT EXISTS friendships (
  a        text NOT NULL,
  b        text NOT NULL,
  from_uid text NOT NULL,
  status   text NOT NULL DEFAULT 'pending',
  at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS friendships_b ON friendships (b);

-- Anti-trampas: cuándo empezó la primera partida de la sesión.
CREATE TABLE IF NOT EXISTS run_starts (
  uid        text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  mode       text NOT NULL DEFAULT 's'
);

-- Ranking: una marca por tabla y jugador (o equipo).
CREATE TABLE IF NOT EXISTS lb_entries (
  board text NOT NULL,
  id    text NOT NULL,
  t     int NOT NULL,
  uids  text[] NOT NULL,
  names text[] NOT NULL,
  dex   int[] NOT NULL,
  shiny boolean[] NOT NULL,
  lv    int NOT NULL DEFAULT 0,
  kills int NOT NULL DEFAULT 0,
  at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board, id)
);
CREATE INDEX IF NOT EXISTS lb_entries_top ON lb_entries (board, t DESC);
CREATE INDEX IF NOT EXISTS lb_entries_uids ON lb_entries USING gin (uids);

CREATE TABLE IF NOT EXISTS reports (
  board  text NOT NULL,
  e      text NOT NULL,
  by_uid text NOT NULL,
  names  text[] NOT NULL DEFAULT '{}',
  t      int NOT NULL DEFAULT 0,
  at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board, e, by_uid)
);
`;

export async function initSchema() {
  await pool.query(SCHEMA);
}
