/* Database access. On Vercel this talks to the Postgres database connected under Storage
   (Neon sets DATABASE_URL; older Vercel Postgres projects set POSTGRES_URL). */
import { neon } from '@neondatabase/serverless';

let client = null;

export function dbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
}

export function hasDb() {
  return !!(globalThis.__SHAFAR_TEST_DB || dbUrl());
}

/* q('select * from products where id = $1', [id]) -> array of rows */
export async function q(text, params = []) {
  if (globalThis.__SHAFAR_TEST_DB) {                 // local tests run against an in-memory Postgres
    const r = await globalThis.__SHAFAR_TEST_DB.query(text, params);
    return r.rows;
  }
  if (!dbUrl()) throw Object.assign(new Error('Database not connected'), { code: 'NO_DB' });
  if (!client) client = neon(dbUrl());
  return client.query(text, params);
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

/* true once the store tables exist */
export async function ready() {
  if (!hasDb()) return false;
  try {
    const r = await one("select to_regclass('public.products') as t, to_regclass('public.orders') as o");
    return !!(r && r.t && r.o);
  } catch (e) { return false; }
}
