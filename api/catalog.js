/* GET /api/catalog        -> the live product list as a script the pages load (window.SHAFAR_CATALOG ...)
   GET /img/<id>           -> an uploaded bottle picture (rewritten here as /api/catalog?img=<id>)
   If the database is not connected or set up yet, the starting product list is served instead, so the shop never breaks. */
import { q, hasDb } from '../lib/db.js';
import { query } from '../lib/http.js';
import { getSettings, DEFAULT_SETTINGS } from '../lib/schema.js';
import { liveProducts, catalogScript, seedRows } from '../lib/store.js';

export default async function handler(req, res) {
  const qs = query(req);
  if (qs.img) return image(res, String(qs.img).replace(/\.\w+$/, '').slice(0, 40));

  let script;
  try {
    if (!hasDb()) throw new Error('no db');
    const [rows, settings] = await Promise.all([liveProducts(), getSettings()]);
    script = catalogScript(rows, settings, 'live');
  } catch (e) {
    script = catalogScript(seedRows(), DEFAULT_SETTINGS, 'starting list');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  // edge cache for a few seconds: a change made in the dashboard reaches the shop almost at once
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
  res.end(script);
}

async function image(res, id) {
  try {
    const r = (await q('select mime, data from images where id = $1', [id]))[0];
    if (!r) { res.statusCode = 404; return res.end('Not found'); }
    res.statusCode = 200;
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');   // a new upload always gets a new address
    res.end(Buffer.from(r.data, 'base64'));
  } catch (e) {
    res.statusCode = 404; res.end('Not found');
  }
}
