/* Admin sign-in. One password, set as ADMIN_PASSWORD in Vercel. A signed cookie keeps the admin signed in for 7 days;
   changing the password signs everyone out, because the signature is made with it. */
import crypto from 'node:crypto';
import { cookies, isHttps } from './http.js';

const NAME = 'sf_admin';
const DAYS = 7;

const secret = () => 'shafar|' + (process.env.ADMIN_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || '');
const mac = (s) => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

export const passwordSet = () => !!process.env.ADMIN_PASSWORD;

export function passwordOk(pw) {
  return passwordSet() && same(pw || '', process.env.ADMIN_PASSWORD);
}

export function isAdmin(req) {
  if (!passwordSet()) return false;
  const tok = cookies(req)[NAME];
  if (!tok) return false;
  const [who, exp, sig] = tok.split('.');
  if (who !== 'admin' || !exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, mac(who + '.' + exp));
}

export function signIn(req, res) {
  const exp = Date.now() + DAYS * 864e5;
  const tok = 'admin.' + exp + '.' + mac('admin.' + exp);
  res.setHeader('Set-Cookie', `${NAME}=${tok}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`);
}

export function signOut(req, res) {
  res.setHeader('Set-Cookie', `${NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isHttps(req) ? '; Secure' : ''}`);
}
