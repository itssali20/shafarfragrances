/* POST /api/track  { vid, path, ref }  - one page view. vid is a random id kept in the visitor's browser,
   so the dashboard can count unique visitors per month. No names, no IP addresses are stored. */
import { q, hasDb } from '../lib/db.js';
import { body, clean } from '../lib/http.js';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i;

export default async function handler(req, res) {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST' || !hasDb() || BOT.test(req.headers['user-agent'] || '')) return res.end();
    const b = await body(req);
    const vid = clean(b.vid, 40).replace(/[^\w-]/g, '');
    if (!vid) return res.end();
    const path = clean(b.path, 120) || '/';
    if (path.startsWith('/admin')) return res.end();
    let ref = clean(b.ref, 200);
    try { ref = ref ? new URL(ref).hostname : ''; } catch (e) { ref = ''; }
    // the day in Pakistan time, so "this month" matches the shop's calendar
    await q("insert into visits (day, vid, path, ref) values ((now() at time zone 'Asia/Karachi')::date, $1, $2, $3)", [vid, path, ref]);
  } catch (e) { /* counting must never break the page */ }
  res.end();
}
