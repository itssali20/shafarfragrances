/* Small helpers shared by the API functions (plain Node request/response, so they run on Vercel and in local tests). */

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const k in headers) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(data));
}

export function fail(res, status, message, extra = {}) {
  send(res, status, Object.assign({ ok: false, error: message }, extra));
}

/* The request body as an object, whether or not the platform already parsed it. */
export async function body(req) {
  let b = req.body;
  if (b === undefined) {
    b = await new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 8e6) req.destroy(); });
      req.on('end', () => resolve(raw));
      req.on('error', () => resolve(''));
    });
  }
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    try { b = b ? JSON.parse(b) : {}; } catch (e) { b = {}; }
  }
  return b && typeof b === 'object' ? b : {};
}

export function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

export function query(req) {
  if (req.query) return req.query;
  const u = new URL(req.url, 'http://x');
  return Object.fromEntries(u.searchParams.entries());
}

export function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

/* text helpers */
export const clean = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
export const int = (v, fallback = null) => {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
