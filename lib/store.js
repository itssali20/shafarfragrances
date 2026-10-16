/* Shop logic shared by the website and the dashboard: the public catalogue and order pricing. */
import { q } from './db.js';
import { getSettings } from './schema.js';
import seed from './seed.js';

export const STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
export const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'];

/* One product as the website expects it (same shape as the lists inside the pages). */
export function publicProduct(p) {
  const soldout = p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0;
  const out = {
    name: p.name, kind: p.kind, cat: p.cat, best: !!p.best,
    img: p.img, tint: p.tint || '#EFD3A8', deep: p.deep || '#D9AE78', ink: p.ink || '#3A2113', accent: p.accent || '#7A3F10',
    desc: p.descr || '',
    prices: { 50: soldout || p.price === null || p.price === undefined ? null : Number(p.price) }
  };
  if (soldout) out.soldout = true;
  if (p.notes_top || p.notes_heart || p.notes_base) out.notes = { top: p.notes_top || '', heart: p.notes_heart || '', base: p.notes_base || '' };
  return out;
}

export async function liveProducts() {
  return q('select * from products where active order by sort, name');
}

export function catalogScript(rows, settings, source) {
  const cat = {}, order = [], wheel = [];
  rows.forEach((p) => {
    cat[p.id] = publicProduct(p); order.push(p.id);
    if (p.wheel && p.price !== null) wheel.push(p.id);
  });
  const store = { ordersOpen: settings.orders_open !== false, deliveryFee: Number(settings.delivery_fee) || 0, freeOver: settings.free_over || null, source };
  return '/* Shafar catalogue (' + source + ') */\n' +
    'window.SHAFAR_CATALOG = ' + JSON.stringify(cat) + ';\n' +
    'window.SHAFAR_ORDER = ' + JSON.stringify(order) + ';\n' +
    'window.SHAFAR_WHEEL = ' + JSON.stringify(wheel) + ';\n' +
    'window.SHAFAR_STORE = ' + JSON.stringify(store) + ';\n';
}

export function seedRows() {
  return seed.map((p) => Object.assign({ active: true, stock: null }, p));
}

/* Price an order on the server: prices, stock and discounts always come from the database, never from the browser. */
export async function quote(items, code) {
  const settings = await getSettings();
  const errors = [];
  const want = new Map();
  (Array.isArray(items) ? items : []).slice(0, 40).forEach((l) => {
    const id = String(l && l.id || '').slice(0, 60);
    const qty = Math.max(0, Math.min(20, Math.round(Number(l && l.qty) || 0)));
    if (id && qty) want.set(id, (want.get(id) || 0) + qty);
  });
  const ids = [...want.keys()];
  const rows = ids.length ? await q('select * from products where id = any($1)', [ids]) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines = [];
  let subtotal = 0;
  ids.forEach((id) => {
    const p = byId.get(id), qty = want.get(id);
    if (!p || !p.active) { errors.push({ id, msg: 'This fragrance is no longer available.' }); return; }
    if (p.price === null) { errors.push({ id, msg: p.name + ' has no price yet.' }); return; }
    if (p.stock !== null && p.stock < qty) {
      errors.push({ id, msg: p.stock <= 0 ? p.name + ' is sold out.' : 'Only ' + p.stock + ' left of ' + p.name + '.' });
      return;
    }
    const price = Number(p.price);
    lines.push({ id, name: p.name, kind: p.kind, img: p.img, size: 50, qty, price });
    subtotal += price * qty;
  });

  let discount = 0, codeInfo = null;
  const c = String(code || '').trim().toUpperCase().slice(0, 30);
  if (c) {
    const d = (await q('select * from discounts where code = $1', [c]))[0];
    const today = new Date().toISOString().slice(0, 10);
    const expires = d && d.expires ? new Date(d.expires).toISOString().slice(0, 10) : null;
    if (!d || !d.active) codeInfo = { code: c, ok: false, msg: 'That code is not valid.' };
    else if (expires && expires < today) codeInfo = { code: c, ok: false, msg: 'That code has expired.' };
    else if (d.max_uses !== null && d.uses >= d.max_uses) codeInfo = { code: c, ok: false, msg: 'That code has been used up.' };
    else if (subtotal < d.min_total) codeInfo = { code: c, ok: false, msg: 'This code needs an order of Rs ' + d.min_total.toLocaleString('en-US') + ' or more.' };
    else {
      discount = d.kind === 'percent' ? Math.round(subtotal * Math.min(100, d.value) / 100) : Math.min(subtotal, d.value);
      codeInfo = { code: c, ok: true, msg: d.kind === 'percent' ? d.value + '% off' : 'Rs ' + d.value.toLocaleString('en-US') + ' off' };
    }
  }
  const after = subtotal - discount;
  const fee = Number(settings.delivery_fee) || 0;
  const delivery = !lines.length ? 0 : (settings.free_over && after >= Number(settings.free_over) ? 0 : fee);
  return { lines, subtotal, discount, delivery, total: after + delivery, code: codeInfo, errors, open: settings.orders_open !== false, settings };
}
