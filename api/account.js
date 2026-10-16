/* POST /api/account  { action, ... }  - customer accounts.
   register -> an email with a link -> verify (account opens, welcome email) -> signed in.
   Also: me, login, logout, resend, forgot, reset, profile, password, wish. */
import { q, one, hasDb, ready } from '../lib/db.js';
import { body, send, fail, clean, cookies } from '../lib/http.js';
import { ensure, getSettings } from '../lib/schema.js';
import { PROVINCES, normalPhone } from '../lib/store.js';
import {
  EMAIL, hashPassword, passwordMatches, passwordProblem, signIn, signOut, currentCustomer,
  newToken, useToken, lastTokenAge, loyaltyConfig, customerStats, isLoyal, claimOrders
} from '../lib/customer.js';
import { send as sendMail, mailOn, siteUrl } from '../lib/mail.js';
import { verifyEmail, welcome, resetPassword } from '../lib/emails.js';

const pause = () => new Promise((r) => setTimeout(r, 600));     // slows down password guessing
const oops = (msg, extra) => Object.assign(new Error(msg), { userMessage: msg, extra });

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  if (!hasDb() || !(await ready())) return fail(res, 503, 'Accounts are not switched on yet.', { offline: true });
  const b = await body(req);
  const action = String(b.action || '');
  try {
    await ensure();
    const fn = ACTIONS[action];
    if (!fn) return fail(res, 400, 'Unknown action');
    return send(res, 200, Object.assign({ ok: true }, await fn(b, req, res)));
  } catch (e) {
    if (e.userMessage) return fail(res, e.status || 400, e.userMessage, e.extra || {});
    console.error('account action failed', action, e);
    return fail(res, 500, 'Something went wrong. Please try again.');
  }
}

async function needMe(req) {
  const me = await currentCustomer(req);
  if (!me) throw Object.assign(oops('Please sign in again.', { signedOut: true }), { status: 401 });
  return me;
}
const emailOf = (v) => clean(v, 120).toLowerCase();

/* Everything the account page shows. */
async function dashboard(c) {
  const settings = await getSettings();
  const cfg = loyaltyConfig(settings);
  const [stats, orders] = await Promise.all([
    customerStats(c.id),
    q(`select number, status, items, subtotal, discount, delivery, total, code, loyalty, name, phone, address, city, province, created_at
         from orders where customer_id = $1 order by created_at desc limit 100`, [c.id])
  ]);
  const loyal = isLoyal(stats, cfg);
  const codes = loyal ? await q(`select code, title, kind, value, min_total, expires from discounts d
                                  where active and loyal_only and (expires is null or expires >= (now() at time zone 'Asia/Karachi')::date)
                                    and (max_uses is null or uses < max_uses)
                                    and not exists (select 1 from orders o where o.customer_id = $1 and o.code = d.code and o.status <> 'cancelled')
                                  order by created_at desc`, [c.id]) : [];
  return {
    signedIn: true,
    customer: { name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city, province: c.province, since: c.created_at },
    loyalty: { on: cfg.on, loyal, completed: stats.completed, after: cfg.after, tiers: cfg.tiers, since: c.loyal_since },
    stats: { orders: stats.orders, spent: stats.spent },
    orders: orders.map((o) => Object.assign(o, { items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items })),
    wish: Array.isArray(c.wish) ? c.wish : (typeof c.wish === 'string' ? JSON.parse(c.wish) : []),
    codes
  };
}

async function sendVerify(req, c) {
  const token = await newToken(c.id, 'verify', 48);
  const link = siteUrl(req) + '/account?verify=' + token;
  return sendMail(Object.assign({ to: c.email }, verifyEmail(siteUrl(req), { name: c.name, link })));
}

const ACTIONS = {
  async me(b, req, res) {
    const me = await currentCustomer(req);
    if (!me) {
      if (cookies(req).sf_customer || cookies(req).sf_in) signOut(req, res);       // an old or broken cookie: tidy it away
      const cfg = loyaltyConfig(await getSettings());
      return { signedIn: false, mail: mailOn(), loyalty: { on: cfg.on, after: cfg.after, tiers: cfg.tiers } };
    }
    return dashboard(me);
  },

  async register(b, req) {
    if (b.website) throw oops('Something went wrong.');                              // hidden field only robots fill in
    const name = clean(b.name, 80), email = emailOf(b.email);
    const fields = {};
    if (name.length < 2) fields.name = 'Please enter your name.';
    if (!EMAIL.test(email)) fields.email = 'Please enter a valid email address.';
    const pwBad = passwordProblem(b.password); if (pwBad) fields.password = pwBad;
    if (Object.keys(fields).length) throw oops('Please check the highlighted details.', { fields });
    if (!mailOn()) throw oops('Sign-ups open as soon as email sending is switched on. Please check back soon.');

    let c = await one('select * from customers where email = $1', [email]);
    if (c && c.verified) throw oops('There is already an account with this email. Sign in instead.', { exists: true, fields: { email: 'Already registered. Sign in instead.' } });
    const pass = await hashPassword(b.password);
    if (c) c = await one('update customers set name = $2, pass = $3 where id = $1 returning *', [c.id, name, pass]);
    else c = await one('insert into customers (email, name, pass) values ($1, $2, $3) returning *', [email, name, pass]);
    await sendVerify(req, c);
    return { pending: true, email };
  },

  async resend(b, req) {
    const c = await one('select * from customers where email = $1 and not verified', [emailOf(b.email)]);
    if (c) {
      const age = await lastTokenAge(c.id, 'verify');
      if (age !== null && age < 60) throw oops('A link was sent a moment ago. Please wait a minute before asking again.');
      await sendVerify(req, c);
    }
    return { sent: true };
  },

  async verify(b, req, res) {
    const id = await useToken(clean(b.token, 100), 'verify');
    if (!id) throw oops('This link has expired or has already been used. Sign in, or ask for a new link.', { expired: true });
    const c = await one('update customers set verified = true, last_login = now() where id = $1 returning *', [id]);
    await claimOrders(c);
    signIn(req, res, c);
    const settings = await getSettings();
    const products = await q('select id, name, kind, img, tint, price from products where active and best and price is not null order by sort limit 3');
    await sendMail(Object.assign({ to: c.email }, welcome(siteUrl(req), { name: c.name, loyalty: loyaltyConfig(settings), products })));
    return Object.assign({ welcome: true }, await dashboard(c));
  },

  async login(b, req, res) {
    const email = emailOf(b.email);
    const c = email ? await one('select * from customers where email = $1', [email]) : null;
    if (!c || !(await passwordMatches(b.password, c.pass))) { await pause(); throw Object.assign(oops('That email and password do not match.'), { status: 401 }); }
    if (!c.verified) throw Object.assign(oops('Please confirm your email first. We sent a link to ' + c.email + '.', { unverified: true, email: c.email }), { status: 403 });
    await q('update customers set last_login = now() where id = $1', [c.id]);
    signIn(req, res, c);
    return dashboard(c);
  },

  async logout(b, req, res) { signOut(req, res); return { signedIn: false }; },

  async forgot(b, req) {
    const c = await one('select * from customers where email = $1 and verified', [emailOf(b.email)]);
    if (c) {
      const age = await lastTokenAge(c.id, 'reset');
      if (age === null || age >= 60) {
        const token = await newToken(c.id, 'reset', 1);
        await sendMail(Object.assign({ to: c.email }, resetPassword(siteUrl(req), { name: c.name, link: siteUrl(req) + '/account?reset=' + token })));
      }
    }
    return { sent: true };                                                           // same answer either way, so emails cannot be fished for
  },

  async reset(b, req, res) {
    const pwBad = passwordProblem(b.password);
    if (pwBad) throw oops(pwBad, { fields: { password: pwBad } });
    const id = await useToken(clean(b.token, 100), 'reset');
    if (!id) throw oops('This link has expired or has already been used. Ask for a new one.', { expired: true });
    const c = await one('update customers set pass = $2, pass_ver = pass_ver + 1, verified = true, last_login = now() where id = $1 returning *', [id, await hashPassword(b.password)]);
    signIn(req, res, c);
    return dashboard(c);
  },

  async profile(b, req) {
    const me = await needMe(req);
    const p = b.profile || {};
    const v = { name: clean(p.name, 80), phone: clean(p.phone, 20), address: clean(p.address, 240), city: clean(p.city, 60), province: clean(p.province, 60) };
    const fields = {};
    if (v.name.length < 2) fields.name = 'Please enter your name.';
    if (v.phone) { v.phone = normalPhone(v.phone); if (!v.phone) fields.phone = 'Please enter a Pakistani mobile number, like 0300 1234567.'; }
    if (v.province && !PROVINCES.includes(v.province)) fields.province = 'Please choose your province.';
    if (Object.keys(fields).length) throw oops('Please check the highlighted details.', { fields });
    const c = await one('update customers set name = $2, phone = $3, address = $4, city = $5, province = $6 where id = $1 returning *', [me.id, v.name, v.phone, v.address, v.city, v.province]);
    return dashboard(c);
  },

  async password(b, req, res) {
    const me = await needMe(req);
    if (!(await passwordMatches(b.current, me.pass))) { await pause(); throw oops('Your current password is not right.', { fields: { current: 'Not right.' } }); }
    const pwBad = passwordProblem(b.next);
    if (pwBad) throw oops(pwBad, { fields: { next: pwBad } });
    const c = await one('update customers set pass = $2, pass_ver = pass_ver + 1 where id = $1 returning *', [me.id, await hashPassword(b.next)]);
    signIn(req, res, c);                                                             // stays signed in here, signed out everywhere else
    return { changed: true };
  },

  async wish(b, req) {
    const me = await needMe(req);
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map((x) => String(x || '').slice(0, 60)).filter((x) => /^[a-z0-9]+$/.test(x)))].slice(0, 100);
    await q('update customers set wish = $2::jsonb where id = $1', [me.id, JSON.stringify(ids)]);
    return { wish: ids };
  }
};
