/* Sending email through Resend (resend.com). Set in Vercel:
     RESEND_API_KEY   the API key
     MAIL_FROM        a sender on a domain verified in Resend, e.g. "Shafar Fragrances <orders@shafarfragrances.com>"
     SITE_URL         the live address, e.g. https://www.shafarfragrances.com (used for links and pictures in emails)
   Without RESEND_API_KEY nothing is sent and the shop carries on as before. */

const API = 'https://api.resend.com';

export const mailOn = () => !!(process.env.RESEND_API_KEY || globalThis.__SHAFAR_TEST_MAIL);
const from = () => process.env.MAIL_FROM || 'Shafar Fragrances <onboarding@resend.dev>';

/* The address emails link back to. SITE_URL wins; otherwise the address the visitor used. */
export function siteUrl(req) {
  const set = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (set) return /^https?:\/\//.test(set) ? set : 'https://' + set;
  const host = String((req && (req.headers['x-forwarded-host'] || req.headers.host)) || 'localhost:3000').split(',')[0].trim();
  const proto = String((req && req.headers['x-forwarded-proto']) || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')).split(',')[0].trim();
  return proto + '://' + host;
}

function payload(m) {
  const p = { from: from(), to: Array.isArray(m.to) ? m.to : [m.to], subject: m.subject, html: m.html, text: m.text };
  if (m.replyTo) p.reply_to = m.replyTo;
  return p;
}

async function post(path, body) {
  if (globalThis.__SHAFAR_TEST_MAIL) return globalThis.__SHAFAR_TEST_MAIL(path, body);
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

/* send({ to, subject, html, text, replyTo }). Never throws: an email that fails must not break an order or a sign-up. */
export async function send(m) {
  if (!m || !m.to || (Array.isArray(m.to) && !m.to.length)) return { skipped: true };
  if (!mailOn()) { console.log('[mail off] ' + m.subject + ' -> ' + m.to); return { skipped: true }; }
  try { return await post('/emails', payload(m)); }
  catch (e) { console.error('email failed', m.subject, e.message || e); return { error: String(e.message || e) }; }
}

/* Many personal emails at once (Resend takes up to 100 per call). Returns how many were accepted. */
export async function sendMany(list) {
  if (!mailOn()) { console.log('[mail off] ' + list.length + ' emails'); return { sent: 0, skipped: list.length }; }
  let sent = 0, failed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    try { await post('/emails/batch', chunk.map(payload)); sent += chunk.length; }
    catch (e) { console.error('batch email failed', e.message || e); failed += chunk.length; }
  }
  return { sent, failed };
}

/* Admin addresses for new-order alerts: the dashboard setting, else ADMIN_EMAIL in Vercel. */
export function adminAddresses(settings) {
  const raw = String((settings && settings.alert_emails) || process.env.ADMIN_EMAIL || '');
  return raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)).slice(0, 10);
}
