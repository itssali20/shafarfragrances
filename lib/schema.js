/* Store tables. setup() is safe to run more than once: it creates what is missing and fills the
   product list only when it is empty. */
import { q, one } from './db.js';
import seed from './seed.js';

const DDL = [
  `create table if not exists products (
     id text primary key,
     name text not null,
     kind text not null default 'Parfum',
     cat text not null default 'men',
     best boolean not null default false,
     wheel boolean not null default false,
     active boolean not null default true,
     sort integer not null default 0,
     img text not null default '',
     tint text, deep text, ink text, accent text,
     descr text not null default '',
     notes_top text, notes_heart text, notes_base text,
     price integer,
     stock integer,
     low_stock integer not null default 5,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now())`,
  `create table if not exists orders (
     id serial primary key,
     number text unique not null,
     status text not null default 'pending',
     name text not null default '', phone text not null default '', email text not null default '',
     address text not null default '', city text not null default '', province text not null default '', notes text not null default '',
     items jsonb not null default '[]',
     subtotal integer not null default 0, discount integer not null default 0, delivery integer not null default 0, total integer not null default 0,
     code text,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now())`,
  `create index if not exists orders_created on orders (created_at)`,
  `create index if not exists orders_phone on orders (phone)`,
  `create table if not exists visits (
     day date not null,
     vid text not null,
     path text not null default '',
     ref text not null default '',
     ts timestamptz not null default now())`,
  `create index if not exists visits_day on visits (day)`,
  `create table if not exists images (
     id text primary key,
     mime text not null,
     data text not null,
     created_at timestamptz not null default now())`,
  `create table if not exists discounts (
     code text primary key,
     kind text not null default 'percent',
     value integer not null,
     min_total integer not null default 0,
     max_uses integer,
     uses integer not null default 0,
     expires date,
     active boolean not null default true,
     created_at timestamptz not null default now())`,
  `create table if not exists settings (
     key text primary key,
     value jsonb not null)`
];

export const DEFAULT_SETTINGS = { delivery_fee: 0, free_over: null, orders_open: true, notice: '' };

export async function setup() {
  for (const s of DDL) await q(s);
  const n = await one('select count(*)::int as n from products');
  let seeded = 0;
  if (!n || n.n === 0) {
    for (const p of seed) {
      await q(`insert into products (id, name, kind, cat, best, wheel, active, sort, img, tint, deep, ink, accent, descr, price)
               values ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (id) do nothing`,
        [p.id, p.name, p.kind, p.cat, p.best, p.wheel, p.sort, p.img, p.tint, p.deep, p.ink, p.accent, p.descr, p.price]);
      seeded++;
    }
  }
  for (const k in DEFAULT_SETTINGS) {
    await q('insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do nothing', [k, JSON.stringify(DEFAULT_SETTINGS[k])]);
  }
  return { seeded };
}

export async function getSettings() {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  try {
    const rows = await q('select key, value from settings');
    rows.forEach((r) => { out[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value; });
  } catch (e) { /* not set up yet: defaults */ }
  return out;
}
