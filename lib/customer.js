/* Customer accounts: passwords, the sign-in cookie, one-time email links, and Shafar Loyal status.
   The cookie is signed with a key made from SESSION_SECRET (optional) and the database address, which is already secret.
   Changing a password bumps pass_ver, which signs that customer out everywhere else. */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { q, one, dbUrl } from './db.js';
import { cookies, isHttps } from './http.js';
import { DEFAULT_LOYALTY } from './schema.js';

const scrypt = promisify(crypto.scrypt);
const NAME = 'sf_customer';
const HINT = 'sf_in';            // not secret: lets every page show the signed-in initial without asking the server
const DAYS = 30;

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- passwords ---------- */
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await scrypt(String(pw), salt, 64);
  return 'scrypt$' + salt + '$' + key.toString('base64url');
}
export async function passwordMatches(pw, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const key = await scrypt(String(pw || ''), salt, 64);
  const want = Buffer.from(hash, 'base64url');
  return want.length === key.length && crypto.timingSafeEqual(key, want);
}
export function passwordProblem(pw) {
  const s = String(pw || '');
  if (s.length < 8) return 'Use at least 8 characters for your password.';
  if (s.length > 200) return 'That password is too long.';
  return '';
}

/* ---------- the sign-in cookie ---------- */
const key = () => crypto.createHash('sha256').update('shafar-customer|' + (process.env.SESSION_SECRET || '') + '|' + dbUrl()).digest();
const mac = (s) => crypto.createHmac('sha256', key()).update(s).digest('base64url');
const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function signIn(req, res, c) {
  const exp = Date.now() + DAYS * 864e5;
  const body = c.id + '.' + c.pass_ver + '.' + exp;
  const secure = isHttps(req) ? '; Secure' : '';
  const initial = encodeURIComponent(String(c.name || c.email || '?').trim().charAt(0).toUpperCase() || '?');
  res.setHeader('Set-Cookie', [
    `${NAME}=${body}.${mac(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`,
    `${HINT}=${initial}; Path=/; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`
  ]);
}
export function signOut(req, res) {
  const secure = isHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', [`${NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`, `${HINT}=; Path=/; SameSite=Lax; Max-Age=0${secure}`]);
}

/* The signed-in customer's row, or null. */
export async function currentCustomer(req) {
  const tok = cookies(req)[NAME];
  if (!tok) return null;
  const [id, ver, exp, sig] = tok.split('.');
  if (!id || !ver || !exp || !sig || Number(exp) < Date.now()) return null;
  if (!same(sig, mac(id + '.' + ver + '.' + exp))) return null;
  const c = await one('select * from customers where id = $1', [Number(id)]);
  if (!c || !c.verified || String(c.pass_ver) !== ver) return null;
  return c;
}

/* ---------- one-time links (confirm email, reset password) ---------- */
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export async function newToken(customerId, kind, hours) {
  const raw = crypto.randomBytes(32).toString('base64url');
  await q('delete from tokens where customer_id = $1 and kind = $2', [customerId, kind]);
  await q(`insert into tokens (hash, customer_id, kind, expires) values ($1, $2, $3, now() + make_interval(hours => $4::int))`, [sha(raw), customerId, kind, hours]);
  return raw;
}
/* Uses the link up: returns the customer id, or null when it is wrong, used or out of date. */
export async function useToken(raw, kind) {
  const r = await one('delete from tokens where hash = $1 and kind = $2 returning customer_id, expires', [sha(raw || ''), kind]);
  if (!r || new Date(r.expires) < new Date()) return null;
  return r.customer_id;
}
export async function lastTokenAge(customerId, kind) {
  const r = await one('select extract(epoch from now() - created_at)::int as s from tokens where customer_id = $1 and kind = $2', [customerId, kind]);
  return r ? r.s : null;
}

/* ---------- Shafar Loyal ---------- */
export function loyaltyConfig(settings) {
  const l = Object.assign({}, DEFAULT_LOYALTY, (settings && settings.loyalty) || {});
  const after = Math.max(1, Math.min(50, Math.round(Number(l.after) || 3)));
  const tiers = (Array.isArray(l.tiers) ? l.tiers : DEFAULT_LOYALTY.tiers)
    .map((t) => ({ qty: Math.max(1, Math.round(Number(t && t.qty) || 0)), pct: Math.max(0, Math.min(90, Math.round(Number(t && t.pct) || 0))) }))
    .filter((t) => t.qty && t.pct).sort((a, b) => a.qty - b.qty);
  return { on: l.on !== false, after, tiers };
}

/* Orders that count towards loyalty are the completed ones: delivered and paid for. */
export async function customerStats(id) {
  return (await one(`select (count(*) filter (where status = 'completed'))::int as completed,
                            (count(*) filter (where status <> 'cancelled'))::int as orders,
                            coalesce(sum(total) filter (where status <> 'cancelled'), 0)::int as spent
                       from orders where customer_id = $1`, [id])) || { completed: 0, orders: 0, spent: 0 };
}

export function isLoyal(stats, cfg) { return !!(cfg.on && stats.completed >= cfg.after); }

/* The percentage a Loyal member gets for this many bottles (0 when none applies). */
export function tierFor(bottles, cfg) {
  let pct = 0;
  cfg.tiers.forEach((t) => { if (bottles >= t.qty) pct = Math.max(pct, t.pct); });
  return pct;
}
export function nextTier(bottles, cfg) {
  return cfg.tiers.filter((t) => t.qty > bottles && t.pct > tierFor(bottles, cfg))[0] || null;
}

/* Guest orders placed with this (now confirmed) email join the account. */
export async function claimOrders(c) {
  await q('update orders set customer_id = $1 where customer_id is null and lower(email) = $2', [c.id, c.email]);
}
