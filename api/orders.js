/* POST /api/orders
   { items: [{ id, qty }], code, dry: true }                -> price check for the checkout summary (nothing saved)
   { items, code, customer: { name, phone, email, address, city, province, notes } } -> places a cash-on-delivery order
   A signed-in customer's order is saved to their account and gets their Shafar Loyal reward.
   Once saved, a confirmation goes to the customer (when there is an email) and an alert to the shop. */
import { q, one, hasDb, ready } from '../lib/db.js';
import { body, send, fail, clean } from '../lib/http.js';
import { quote, PROVINCES, normalPhone } from '../lib/store.js';
import { ensure } from '../lib/schema.js';
import { currentCustomer, customerStats, EMAIL } from '../lib/customer.js';
import { send as sendMail, siteUrl, adminAddresses } from '../lib/mail.js';
import { orderPlaced, orderAlert } from '../lib/emails.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  if (!hasDb() || !(await ready())) return fail(res, 503, 'Ordering is not switched on yet.', { offline: true });
  const b = await body(req);
  try {
    await ensure();
    const me = await currentCustomer(req);
    const member = me ? { id: me.id, completed: (await customerStats(me.id)).completed } : null;
    const qt = await quote(b.items, b.code, member);
    const pub = { lines: qt.lines, subtotal: qt.subtotal, discount: qt.discount, delivery: qt.delivery, total: qt.total, code: qt.code, errors: qt.errors, open: qt.open,
      loyalty: qt.loyalty, loyaltyPct: qt.loyaltyPct, notice: qt.settings.notice || '', freeOver: qt.settings.free_over || null };
    if (b.dry) return send(res, 200, Object.assign({ ok: true }, pub));

    if (!qt.open) return fail(res, 409, 'We are not taking orders right now. Please message us on WhatsApp.', pub);
    if (b.website) return fail(res, 400, 'Something went wrong.');            // hidden field only robots fill in
    if (qt.errors.length) return fail(res, 409, qt.errors[0].msg, pub);
    if (!qt.lines.length) return fail(res, 400, 'Your cart is empty.', pub);
    if (qt.code && !qt.code.ok) return fail(res, 409, qt.code.msg, pub);

    const c = b.customer || {};
    const cust = {
      name: clean(c.name, 80), phone: normalPhone(c.phone), email: clean(c.email, 120).toLowerCase() || (me ? me.email : ''),
      address: clean(c.address, 240), city: clean(c.city, 60), province: clean(c.province, 60), notes: clean(c.notes, 300)
    };
    const bad = {};
    if (cust.name.length < 2) bad.name = 'Please enter your full name.';
    if (!cust.phone) bad.phone = 'Please enter a Pakistani mobile number, like 0300 1234567.';
    if (cust.email && !EMAIL.test(cust.email)) bad.email = 'That email does not look right.';
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
    // a guest who types the email of a confirmed account still gets the order saved to that account
    let ownerId = me ? me.id : null;
    if (!ownerId && cust.email) {
      const acc = await one('select id from customers where email = $1 and verified', [cust.email]);
      if (acc) ownerId = acc.id;
    }
    const temp = 'TMP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const row = await one(`insert into orders (number, status, name, phone, email, address, city, province, notes, items, subtotal, discount, delivery, total, code, customer_id, loyalty)
                           values ($1,'pending',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16) returning id, created_at`,
      [temp, cust.name, cust.phone, cust.email, cust.address, cust.city, cust.province, cust.notes,
       JSON.stringify(qt.lines.map((l) => ({ id: l.id, name: l.name, size: l.size, qty: l.qty, price: l.price }))),
       qt.subtotal, qt.discount, qt.delivery, qt.total, qt.codeApplied ? qt.code.code : null, ownerId, qt.loyaltyPct || 0]);
    const number = 'SF-' + (10000 + row.id);
    await q('update orders set number = $1 where id = $2', [number, row.id]);
    if (qt.codeApplied) await q('update discounts set uses = uses + 1 where code = $1', [qt.code.code]);

    // a member's first order fills in their saved delivery details
    if (me && !me.address) {
      await q('update customers set phone = case when phone = \'\' then $2 else phone end, address = $3, city = $4, province = $5 where id = $1',
        [me.id, cust.phone, cust.address, cust.city, cust.province]);
    }

    // the emails go out before we answer: on Vercel the function stops once the answer is sent
    const order = Object.assign({ number, created_at: row.created_at, items: qt.lines, subtotal: qt.subtotal, discount: qt.discount, delivery: qt.delivery, total: qt.total,
      code: qt.codeApplied ? qt.code.code : null, loyalty: qt.loyaltyPct || 0 }, cust);
    const site = siteUrl(req);
    const mails = [];
    if (cust.email) mails.push(sendMail(Object.assign({ to: cust.email }, orderPlaced(site, order, { member: !!ownerId }))));
    const admins = adminAddresses(qt.settings);
    if (admins.length) mails.push(sendMail(Object.assign({ to: admins, replyTo: cust.email || undefined }, orderAlert(site, order, { member: !!ownerId, loyal: !!(qt.loyalty && qt.loyalty.loyal) }))));
    await Promise.allSettled(mails);

    return send(res, 200, { ok: true, number, total: qt.total, delivery: qt.delivery, discount: qt.discount, loyaltyPct: qt.loyaltyPct || 0, emailed: !!cust.email, member: !!me });
  } catch (e) {
    console.error('order failed', e);
    return fail(res, 500, 'We could not place the order. Please try again or message us on WhatsApp.');
  }
}
