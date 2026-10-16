/* POST /api/orders
   { items: [{ id, qty }], code, dry: true }                -> price check for the checkout summary (nothing saved)
   { items, code, customer: { name, phone, email, address, city, province, notes } } -> places a cash-on-delivery order */
import { q, one, hasDb, ready } from '../lib/db.js';
import { body, send, fail, clean } from '../lib/http.js';
import { quote, PROVINCES } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  if (!hasDb() || !(await ready())) return fail(res, 503, 'Ordering is not switched on yet.', { offline: true });
  const b = await body(req);
  try {
    const qt = await quote(b.items, b.code);
    const pub = { lines: qt.lines, subtotal: qt.subtotal, discount: qt.discount, delivery: qt.delivery, total: qt.total, code: qt.code, errors: qt.errors, open: qt.open,
      notice: qt.settings.notice || '', freeOver: qt.settings.free_over || null };
    if (b.dry) return send(res, 200, Object.assign({ ok: true }, pub));

    if (!qt.open) return fail(res, 409, 'We are not taking orders right now. Please message us on WhatsApp.', pub);
    if (b.website) return fail(res, 400, 'Something went wrong.');            // hidden field only robots fill in
    if (qt.errors.length) return fail(res, 409, qt.errors[0].msg, pub);
    if (!qt.lines.length) return fail(res, 400, 'Your cart is empty.', pub);
    if (qt.code && !qt.code.ok) return fail(res, 409, qt.code.msg, pub);

    const c = b.customer || {};
    const cust = {
      name: clean(c.name, 80), phone: normalPhone(c.phone), email: clean(c.email, 120).toLowerCase(),
      address: clean(c.address, 240), city: clean(c.city, 60), province: clean(c.province, 60), notes: clean(c.notes, 300)
    };
    const bad = {};
    if (cust.name.length < 2) bad.name = 'Please enter your full name.';
    if (!cust.phone) bad.phone = 'Please enter a Pakistani mobile number, like 0300 1234567.';
    if (cust.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) bad.email = 'That email does not look right.';
    if (cust.address.length < 6) bad.address = 'Please enter your full address.';
    if (cust.city.length < 2) bad.city = 'Please enter your city.';
    if (!PROVINCES.includes(cust.province)) bad.province = 'Please choose your province.';
    if (Object.keys(bad).length) return fail(res, 400, 'Please check the highlighted details.', { fields: bad });

    // take the stock first, so two people cannot buy the last bottle
    const taken = [];
    for (const l of qt.lines) {
      const r = await one('update products set stock = stock - $2, updated_at = now() where id = $1 and (stock is null or stock >= $2) returning stock', [l.id, l.qty]);
      if (!r) {
        for (const t of taken) await q('update products set stock = stock + $2 where id = $1 and stock is not null', [t.id, t.qty]);
        return fail(res, 409, 'Sorry, ' + l.name + ' just sold out.');
      }
      taken.push(l);
    }
    const temp = 'TMP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const row = await one(`insert into orders (number, status, name, phone, email, address, city, province, notes, items, subtotal, discount, delivery, total, code)
                           values ($1,'pending',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14) returning id`,
      [temp, cust.name, cust.phone, cust.email, cust.address, cust.city, cust.province, cust.notes,
       JSON.stringify(qt.lines.map((l) => ({ id: l.id, name: l.name, size: l.size, qty: l.qty, price: l.price }))),
       qt.subtotal, qt.discount, qt.delivery, qt.total, qt.code && qt.code.ok ? qt.code.code : null]);
    const number = 'SF-' + (10000 + row.id);
    await q('update orders set number = $1 where id = $2', [number, row.id]);
    if (qt.code && qt.code.ok) await q('update discounts set uses = uses + 1 where code = $1', [qt.code.code]);
    return send(res, 200, { ok: true, number, total: qt.total, delivery: qt.delivery, discount: qt.discount });
  } catch (e) {
    console.error('order failed', e);
    return fail(res, 500, 'We could not place the order. Please try again or message us on WhatsApp.');
  }
}

/* 0300 1234567, +92 300 1234567, 923001234567 -> 03001234567 */
function normalPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  if (d.startsWith('92') && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return /^03\d{9}$/.test(d) ? d : '';
}
