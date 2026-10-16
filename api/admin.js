/* POST /api/admin  { action, ... }  - everything the dashboard does.
   Every action except status / login needs the admin cookie (see lib/auth.js). */
import crypto from 'node:crypto';
import { q, one, hasDb, ready } from '../lib/db.js';
import { body, send, fail, clean, int } from '../lib/http.js';
import { isAdmin, passwordOk, passwordSet, signIn, signOut } from '../lib/auth.js';
import { setup, getSettings, ensure } from '../lib/schema.js';
import { STATUSES } from '../lib/store.js';
import { loyaltyConfig, customerStats, isLoyal, EMAIL } from '../lib/customer.js';
import { send as sendMail, sendMany, mailOn, siteUrl } from '../lib/mail.js';
import { loyalWelcome, occasion } from '../lib/emails.js';

const PINNED = ['halila', 'belford', 'charleston', 'shawano'];      // drawn by hand on the Featured page and Home's Featured collection
const KINDS = ['Parfum', 'Eau de Parfum'];
const CATS = ['men', 'women', 'unisex'];
const HEX = /^#[0-9a-f]{6}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const b = await body(req);
  const action = String(b.action || '');
  try {
    if (action === 'status') {
      const isReady = await ready();
      return send(res, 200, { ok: true, db: hasDb(), ready: isReady, password: passwordSet(), admin: isAdmin(req), mail: mailOn() });
    }
    if (action === 'login') {
      if (!passwordSet()) return fail(res, 400, 'Add ADMIN_PASSWORD in Vercel first (Settings > Environment Variables), then redeploy.');
      if (!passwordOk(b.password)) { await new Promise((r) => setTimeout(r, 600)); return fail(res, 401, 'That password is not right.'); }
      signIn(req, res);
      return send(res, 200, { ok: true });
    }
    if (action === 'logout') { signOut(req, res); return send(res, 200, { ok: true }); }

    if (!isAdmin(req)) return fail(res, 401, 'Please sign in again.', { signedOut: true });
    if (!hasDb()) return fail(res, 503, 'The database is not connected yet.', { noDb: true });
    if (action === 'setup') return send(res, 200, Object.assign({ ok: true }, await setup()));
    if (!(await ready())) return fail(res, 503, 'The store is not set up yet.', { notReady: true });
    await ensure();

    const fn = ACTIONS[action];
    if (!fn) return fail(res, 400, 'Unknown action');
    return send(res, 200, Object.assign({ ok: true }, await fn(b, req)));
  } catch (e) {
    if (e.userMessage) return fail(res, 400, e.userMessage);
    console.error('admin action failed', action, e);
    return fail(res, 500, 'Something went wrong on the server: ' + (e.message || e));
  }
}

const oops = (msg) => Object.assign(new Error(msg), { userMessage: msg });

/* ---------- time: the shop runs on Pakistan time (UTC+5, no daylight saving) ---------- */
function monthsBack(n) {
  const now = new Date(Date.now() + 5 * 3600e3);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

const ACTIONS = {
  /* ---------- Overview ---------- */
  async overview() {
    const keys = monthsBack(12);
    const from = keys[0] + '-01';
    const [sales, visits, statuses, top, cats, low, recent, cust, today] = await Promise.all([
      q(`select to_char(date_trunc('month', created_at at time zone 'Asia/Karachi'), 'YYYY-MM') as m,
                coalesce(sum(total) filter (where status <> 'cancelled'), 0)::int as sales,
                (count(*) filter (where status <> 'cancelled'))::int as orders
           from orders where (created_at at time zone 'Asia/Karachi') >= $1::date group by 1`, [from]),
      q(`select to_char(day, 'YYYY-MM') as m, count(distinct vid)::int as visitors, count(*)::int as views
           from visits where day >= $1::date group by 1`, [from]),
      q('select status, count(*)::int as n from orders group by status'),
      q(`select it->>'id' as id, max(it->>'name') as name, sum((it->>'qty')::int)::int as qty, sum((it->>'qty')::int * (it->>'price')::int)::int as revenue
           from orders, jsonb_array_elements(items) as it
          where status <> 'cancelled' and created_at > now() - interval '90 days'
          group by 1 order by qty desc, revenue desc limit 6`),
      q(`select coalesce(p.cat, 'other') as cat, sum((it->>'qty')::int * (it->>'price')::int)::int as revenue, sum((it->>'qty')::int)::int as qty
           from orders o cross join jsonb_array_elements(o.items) as it left join products p on p.id = it->>'id'
          where o.status <> 'cancelled' and (o.created_at at time zone 'Asia/Karachi') >= $1::date
          group by 1 order by revenue desc`, [from]),
      q('select id, name, img, stock, low_stock, tint from products where stock is not null and stock <= low_stock order by stock, name limit 12'),
      q('select id, number, name, city, total, status, created_at, items from orders order by created_at desc limit 8'),
      one(`select count(*)::int as customers, (count(*) filter (where n > 1))::int as repeat
             from (select phone, count(*) as n from orders where status <> 'cancelled' group by phone) t`),
      one(`select (select count(distinct vid) from visits where day = (now() at time zone 'Asia/Karachi')::date)::int as visitors,
                  (select count(*) from orders where (created_at at time zone 'Asia/Karachi')::date = (now() at time zone 'Asia/Karachi')::date)::int as orders`)
    ]);
    const S = Object.fromEntries(sales.map((r) => [r.m, r]));
    const V = Object.fromEntries(visits.map((r) => [r.m, r]));
    const months = keys.map((k) => ({ key: k, sales: (S[k] || {}).sales || 0, orders: (S[k] || {}).orders || 0, visitors: (V[k] || {}).visitors || 0, views: (V[k] || {}).views || 0 }));
    return { months, statuses, top, cats, low, recent, customers: cust, today };
  },

  /* ---------- Orders ---------- */
  async orders(b) {
    const status = STATUSES.includes(b.status) ? b.status : '';
    const term = clean(b.q, 60);
    const rows = await q(`select * from orders
                           where ($1 = '' or status = $1)
                             and ($2 = '' or number ilike $3 or name ilike $3 or phone ilike $3 or city ilike $3)
                           order by created_at desc limit 500`, [status, term, '%' + term + '%']);
    const counts = await q('select status, count(*)::int as n from orders group by status');
    return { orders: rows, counts };
  },
  async orderStatus(b, req) {
    const id = int(b.id);
    const next = String(b.status || '');
    if (!STATUSES.includes(next)) throw oops('Unknown status');
    const o = await one('select * from orders where id = $1', [id]);
    if (!o) throw oops('Order not found');
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    if (next === 'cancelled' && o.status !== 'cancelled') {                       // bottles go back on the shelf
      for (const l of items) await q('update products set stock = stock + $2 where id = $1 and stock is not null', [l.id, l.qty]);
    } else if (o.status === 'cancelled' && next !== 'cancelled') {
      for (const l of items) await q('update products set stock = greatest(stock - $2, 0) where id = $1 and stock is not null', [l.id, l.qty]);
    }
    const row = await one('update orders set status = $2, updated_at = now() where id = $1 returning *', [id, next]);
    let loyal = false;
    if (next === 'completed' && o.status !== 'completed' && row.customer_id) loyal = await promote(row.customer_id, req);
    return { order: row, loyal };
  },

  /* ---------- Customers (everyone who has ordered, grouped by phone number) ---------- */
  async customers() {
    const rows = await q(`select phone, max(name) as name, max(email) as email, max(city) as city,
                                 (count(*) filter (where status <> 'cancelled'))::int as orders,
                                 (count(*) filter (where status = 'completed'))::int as completed,
                                 coalesce(sum(total) filter (where status <> 'cancelled'), 0)::int as spent,
                                 min(created_at) as first, max(created_at) as last
                            from orders group by phone order by spent desc, last desc limit 2000`);
    return { customers: rows, loyalty: loyaltyConfig(await getSettings()) };
  },

  /* ---------- Members (customer accounts) ---------- */
  async members() {
    const rows = await q(`select c.id, c.name, c.email, c.phone, c.city, c.verified, c.created_at, c.last_login, c.loyal_since,
                                 jsonb_array_length(c.wish)::int as wish,
                                 (count(o.id) filter (where o.status <> 'cancelled'))::int as orders,
                                 (count(o.id) filter (where o.status = 'completed'))::int as completed,
                                 coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::int as spent,
                                 max(o.created_at) as last
                            from customers c left join orders o on o.customer_id = c.id
                           group by c.id order by c.created_at desc limit 2000`);
    return { members: rows, loyalty: loyaltyConfig(await getSettings()) };
  },
  async member(b) {
    return { orders: await q('select * from orders where customer_id = $1 order by created_at desc', [int(b.id)]) };
  },
  async customer(b) {
    const phone = clean(b.phone, 20);
    return { orders: await q('select * from orders where phone = $1 order by created_at desc', [phone]) };
  },

  /* ---------- Products ---------- */
  async products() {
    const [rows, sold] = await Promise.all([
      q('select * from products order by sort, name'),
      q(`select it->>'id' as id, sum((it->>'qty')::int)::int as sold
           from orders, jsonb_array_elements(items) as it where status <> 'cancelled' group by 1`)
    ]);
    const S = Object.fromEntries(sold.map((r) => [r.id, r.sold]));
    rows.forEach((r) => { r.sold = S[r.id] || 0; r.pinned = PINNED.includes(r.id); });
    return { products: rows };
  },
  async productSave(b) {
    const p = b.product || {};
    const name = clean(p.name, 60);
    if (name.length < 2) throw oops('Give the fragrance a name.');
    const img = clean(p.img, 300);
    if (!img) throw oops('Add a bottle picture.');
    const row = {
      name, img,
      kind: KINDS.includes(p.kind) ? p.kind : 'Parfum',
      cat: CATS.includes(p.cat) ? p.cat : 'men',
      best: !!p.best, wheel: !!p.wheel, active: p.active !== false,
      sort: int(p.sort, 1000),
      tint: HEX.test(p.tint) ? p.tint : '#EFD3A8', deep: HEX.test(p.deep) ? p.deep : '#D9AE78',
      ink: HEX.test(p.ink) ? p.ink : '#3A2113', accent: HEX.test(p.accent) ? p.accent : '#7A3F10',
      descr: clean(p.descr, 300),
      notes_top: clean(p.notes_top, 80) || null, notes_heart: clean(p.notes_heart, 80) || null, notes_base: clean(p.notes_base, 80) || null,
      price: int(p.price), stock: int(p.stock), low_stock: Math.max(0, int(p.low_stock, 5))
    };
    if (row.price !== null && (row.price < 0 || row.price > 1e6)) throw oops('Check the price.');
    if (row.stock !== null && row.stock < 0) row.stock = 0;
    let id = clean(p.id, 60);
    const exists = id ? await one('select id from products where id = $1', [id]) : null;
    if (!exists) {
      const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '') || 'fragrance';
      id = base; let n = 2;
      while (await one('select id from products where id = $1', [id])) id = base + n++;
      await q(`insert into products (id, name, kind, cat, best, wheel, active, sort, img, tint, deep, ink, accent, descr, notes_top, notes_heart, notes_base, price, stock, low_stock)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [id, row.name, row.kind, row.cat, row.best, row.wheel, row.active, row.sort, row.img, row.tint, row.deep, row.ink, row.accent, row.descr,
         row.notes_top, row.notes_heart, row.notes_base, row.price, row.stock, row.low_stock]);
    } else {
      await q(`update products set name=$2, kind=$3, cat=$4, best=$5, wheel=$6, active=$7, sort=$8, img=$9, tint=$10, deep=$11, ink=$12, accent=$13,
                      descr=$14, notes_top=$15, notes_heart=$16, notes_base=$17, price=$18, stock=$19, low_stock=$20, updated_at=now() where id=$1`,
        [id, row.name, row.kind, row.cat, row.best, row.wheel, row.active, row.sort, row.img, row.tint, row.deep, row.ink, row.accent, row.descr,
         row.notes_top, row.notes_heart, row.notes_base, row.price, row.stock, row.low_stock]);
    }
    return { product: await one('select * from products where id = $1', [id]) };
  },
  async productQuick(b) {                     // inline edits from the table: stock, price, live
    const id = clean(b.id, 60);
    const f = b.field;
    if (f === 'stock') await q('update products set stock = $2, updated_at = now() where id = $1', [id, b.value === '' || b.value === null ? null : Math.max(0, int(b.value, 0))]);
    else if (f === 'price') await q('update products set price = $2, updated_at = now() where id = $1', [id, int(b.value)]);
    else if (f === 'active') await q('update products set active = $2, updated_at = now() where id = $1', [id, !!b.value]);
    else throw oops('Unknown field');
    return { product: await one('select * from products where id = $1', [id]) };
  },
  async productDelete(b) {
    const id = clean(b.id, 60);
    if (PINNED.includes(id)) throw oops('This bottle is drawn on the Featured page, so it can be hidden but not deleted.');
    await q('delete from products where id = $1', [id]);
    return {};
  },
  async upload(b) {
    const mime = ['image/webp', 'image/png', 'image/jpeg'].includes(b.mime) ? b.mime : '';
    const data = String(b.data || '').replace(/^data:[^,]+,/, '');
    if (!mime || !data) throw oops('That file could not be read.');
    if (data.length > 3.5e6) throw oops('That picture is too large. Keep it under 2.5 MB.');
    const id = crypto.randomBytes(9).toString('hex');
    await q('insert into images (id, mime, data) values ($1, $2, $3)', [id, mime, data]);
    return { url: '/img/' + id };
  },

  /* ---------- Discount codes ---------- */
  async discounts() { return { discounts: await q('select * from discounts order by created_at desc') }; },
  async discountSave(b) {
    const d = b.discount || {};
    const code = clean(d.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (code.length < 3) throw oops('Codes need at least 3 letters or numbers.');
    const kind = d.kind === 'flat' ? 'flat' : 'percent';
    const value = int(d.value, 0);
    if (value <= 0 || (kind === 'percent' && value > 90)) throw oops(kind === 'percent' ? 'Use a percentage between 1 and 90.' : 'Enter the amount off in rupees.');
    const expires = /^\d{4}-\d{2}-\d{2}$/.test(d.expires || '') ? d.expires : null;
    await q(`insert into discounts (code, kind, value, min_total, max_uses, expires, active, loyal_only, title) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             on conflict (code) do update set kind=$2, value=$3, min_total=$4, max_uses=$5, expires=$6, active=$7, loyal_only=$8, title=$9`,
      [code, kind, value, Math.max(0, int(d.min_total, 0)), int(d.max_uses), expires, d.active !== false, !!d.loyal_only, clean(d.title, 60)]);
    return ACTIONS.discounts();
  },
  /* Emails a Loyal-only code to every Loyal member. */
  async discountSend(b, req) {
    if (!mailOn()) throw oops('Email sending is not switched on yet. Add RESEND_API_KEY in Vercel first.');
    const d = await one('select * from discounts where code = $1', [clean(b.code, 30)]);
    if (!d) throw oops('Code not found');
    if (!d.loyal_only) throw oops('Only codes for Loyal members can be emailed from here.');
    if (!d.active) throw oops('Switch the code on before sending it.');
    const list = await loyalMembers();
    if (!list.length) throw oops('There are no Loyal members yet.');
    const site = siteUrl(req);
    const r = await sendMany(list.map((m) => Object.assign({ to: m.email }, occasion(site, { name: m.name, d }))));
    if (r.sent) await q('update discounts set sent_at = now() where code = $1', [d.code]);
    return Object.assign({ members: list.length }, r, await ACTIONS.discounts());
  },
  async loyalCount() { return { count: (await loyalMembers()).length }; },
  async discountDelete(b) { await q('delete from discounts where code = $1', [clean(b.code, 30)]); return ACTIONS.discounts(); },

  /* ---------- Settings ---------- */
  async settings() { return { settings: await getSettings(), mail: mailOn(), mailEnv: !!process.env.ADMIN_EMAIL }; },
  async settingsSave(b) {
    const s = b.settings || {};
    const vals = {
      delivery_fee: Math.max(0, int(s.delivery_fee, 0)),
      free_over: s.free_over === '' || s.free_over === null || s.free_over === undefined ? null : Math.max(0, int(s.free_over, 0)),
      orders_open: s.orders_open !== false,
      notice: clean(s.notice, 200),
      alert_emails: String(s.alert_emails || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => EMAIL.test(x)).slice(0, 10).join(', '),
      loyalty: loyaltyConfig({ loyalty: s.loyalty })
    };
    for (const k in vals) await q('insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = $2::jsonb', [k, JSON.stringify(vals[k])]);
    return { settings: await getSettings(), mail: mailOn(), mailEnv: !!process.env.ADMIN_EMAIL };
  }
};

/* Verified accounts whose completed orders reach the loyalty mark. */
async function loyalMembers() {
  const cfg = loyaltyConfig(await getSettings());
  if (!cfg.on) return [];
  return q(`select c.id, c.name, c.email from customers c
             where c.verified and (select count(*) from orders o where o.customer_id = c.id and o.status = 'completed') >= $1
             order by c.id`, [cfg.after]);
}

/* After an order is completed: the first time a member reaches the mark, they get the Shafar Loyal email. */
async function promote(customerId, req) {
  const cfg = loyaltyConfig(await getSettings());
  const c = await one('select * from customers where id = $1', [customerId]);
  if (!c || !c.verified || c.loyal_since) return false;
  if (!isLoyal(await customerStats(customerId), cfg)) return false;
  const won = await one('update customers set loyal_since = now() where id = $1 and loyal_since is null returning id', [customerId]);
  if (won) await sendMail(Object.assign({ to: c.email }, loyalWelcome(siteUrl(req), { name: c.name, loyalty: cfg })));
  return !!won;
}
