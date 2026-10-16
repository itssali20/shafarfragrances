/* The emails the shop sends, drawn to match the website: espresso and gold bands, a cream page,
   Noto Serif Display headings with an italic accent, and the brown order panel from the checkout.
   Built from tables with inline styles, because that is what email apps render reliably.
   Every function returns { subject, html, text }. */

const C = {
  paper: '#EDE3D3', cream: '#F6EFE4', linen: '#FBF7F0', sand: '#E8DAC3', line: '#DDCBAE',
  espresso: '#2B1810', brown: '#2C190F', cocoa: '#6B4A36', bronze: '#8A5B1E',
  gold: '#C9A24A', goldSoft: '#E3C57A', goldDeep: '#B0842D', ivory: '#F1E6D3', mute: '#BFAE94', mute2: '#D9C7AC', rule: '#4C3A2E'
};
const SERIF = "'Noto Serif Display','Bodoni 72',Didot,'Playfair Display',Georgia,'Times New Roman',serif";
const SANS = "Jost,'Century Gothic','Avenir Next',Avenir,'Segoe UI',Helvetica,Arial,sans-serif";
export const CONTACT = { whatsapp: '923180250552', phone: '0318 0250552', email: 'shafarfragrances@gmail.com', instagram: 'https://www.instagram.com/shafar.fragrances/' };

/* ---------- small helpers ---------- */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rs = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US');
/* 03001234567 -> 0300 1234567 */
const phone = (p) => { const d = String(p || ''); return /^03\d{9}$/.test(d) ? d.slice(0, 4) + ' ' + d.slice(4) : d; };
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
export const longDate = (d) => new Date(d || Date.now()).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' });
const wa = (text) => 'https://wa.me/' + CONTACT.whatsapp + (text ? '?text=' + encodeURIComponent(text) : '');

/* Bottle pictures: the email copies are PNG (Outlook and some phones do not show WebP). */
function pic(site, img) {
  const s = String(img || '');
  const m = s.match(/^\/?assets\/([\w-]+)\.webp$/);
  if (m) return site + '/assets/mail/' + m[1] + '.png';
  if (/^https?:\/\//.test(s)) return s;
  return site + '/' + s.replace(/^\/+/, '');
}

/* ---------- building blocks ---------- */
const eyebrow = (t, color = C.bronze) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:${color}">${t}</p>`;

const h1 = (html) =>
  `<h1 class="h1" style="margin:0 0 18px;font-family:${SERIF};font-size:46px;line-height:1.02;font-weight:500;letter-spacing:-.01em;color:${C.espresso}">${html}</h1>`;
const em = (t) => `<em style="font-style:italic;font-weight:400">${esc(t)}</em>`;

const p = (html, extra = '') =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.cocoa};${extra}">${html}</p>`;

const small = (html, extra = '') =>
  `<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.cocoa};${extra}">${html}</p>`;

const gap = (h) => `<div style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div>`;

function button(href, label, kind = 'dark') {
  const bg = kind === 'dark' ? C.espresso : kind === 'gold' ? C.gold : 'transparent';
  const fg = kind === 'dark' ? '#FFFBF4' : kind === 'gold' ? C.brown : C.espresso;
  const border = kind === 'outline' ? `border:1px solid ${C.espresso};` : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 6px 10px 0"><tr>
    <td align="center" bgcolor="${kind === 'outline' ? '' : bg}" style="border-radius:27px;${border}background:${bg}">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:18px 34px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${fg};text-decoration:none;border-radius:27px">${label}</a>
    </td></tr></table>`;
}

function ornament(site) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 30px"><tr>
    <td style="border-top:1px solid ${C.line};font-size:1px;line-height:1px">&nbsp;</td>
    <td width="56" align="center" style="padding:0 14px"><img src="${site}/assets/mail/crest-gold.png" width="26" alt="" style="display:block;width:26px;height:auto;border:0"></td>
    <td style="border-top:1px solid ${C.line};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`;
}

/* The brown order panel, as on the checkout page. */
function orderPanel(site, o, title = 'Your order') {
  const lines = (o.items || []).map((l) => `
    <tr><td style="padding:0 30px" class="pp">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.rule}"><tr>
        <td width="62" style="padding:14px 0;vertical-align:middle">
          <div style="width:54px;height:70px;border-radius:27px 27px 6px 6px;background:${esc(l.tint || '#EFD3A8')};text-align:center;overflow:hidden">
            <img src="${esc(pic(site, l.img))}" height="58" alt="" style="height:58px;width:auto;margin-top:7px;border:0">
          </div></td>
        <td style="padding:14px 12px 14px 14px;vertical-align:middle">
          <p style="margin:0;font-family:${SERIF};font-size:19px;line-height:1.15;color:${C.ivory}">${esc(l.name)}</p>
          <p style="margin:4px 0 0;font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.mute}"><span style="white-space:nowrap">${esc(l.kind || 'Parfum')}</span> &middot; <span style="white-space:nowrap">${esc(l.size || 50)} ml</span> &middot; <span style="white-space:nowrap">Qty ${esc(l.qty)}</span></p></td>
        <td align="right" style="padding:14px 0;vertical-align:middle;white-space:nowrap;font-family:${SANS};font-size:15px;color:${C.ivory}">${rs(l.price * l.qty)}</td>
      </tr></table></td></tr>`).join('');
  const row = (label, value, gold) => `<tr>
      <td style="padding:5px 0;font-family:${SANS};font-size:14px;color:${C.mute2}">${label}</td>
      <td align="right" style="padding:5px 0;font-family:${SANS};font-size:14px;color:${gold ? C.goldSoft : C.ivory};white-space:nowrap">${value}</td></tr>`;
  const discLabel = o.loyalty ? 'Loyal reward &middot; ' + esc(o.loyalty) + '%' : 'Discount' + (o.code ? ' (' + esc(o.code) + ')' : '');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.brown}" style="background:${C.brown};border-radius:16px">
    <tr><td style="padding:28px 30px 16px" class="pp">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:${SERIF};font-size:26px;line-height:1;color:${C.ivory}">${title}</td>
        <td align="right" style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${C.goldSoft};white-space:nowrap">${esc(o.number || '')}</td>
      </tr></table></td></tr>
    ${lines}
    <tr><td style="padding:6px 30px 0" class="pp">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.rule}">
        <tr><td colspan="2" style="height:10px;font-size:1px;line-height:1px">&nbsp;</td></tr>
        ${row('Subtotal', rs(o.subtotal))}
        ${o.discount ? row(discLabel, '&minus; ' + rs(o.discount), true) : ''}
        ${row('Delivery', o.delivery ? rs(o.delivery) : 'Free')}
      </table></td></tr>
    <tr><td style="padding:14px 30px 0" class="pp">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #5C4A3E"><tr>
        <td style="padding-top:16px;font-family:${SANS};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${C.ivory}">Total</td>
        <td align="right" style="padding-top:12px;font-family:${SERIF};font-size:36px;line-height:1;font-weight:600;color:${C.goldSoft};white-space:nowrap">${rs(o.total)}</td>
      </tr></table></td></tr>
    <tr><td style="padding:22px 30px 28px" class="pp">
      <span style="display:inline-block;padding:9px 16px;border:1px solid #7A6233;border-radius:22px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:${C.goldSoft}"><span style="color:${C.gold}">&#9679;</span>&nbsp; Cash on delivery</span>
    </td></tr>
  </table>`;
}

/* Two or three side-by-side blocks that stack on a phone. */
function columns(cols) {
  const w = Math.floor(100 / cols.length);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${cols.map((c, i) => `<td class="stack" width="${w}%" valign="top" style="padding:0 ${i < cols.length - 1 ? 18 : 0}px 18px 0">${c}</td>`).join('')}
  </tr></table>`;
}

const label = (t) => `<p style="margin:0 0 8px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${C.bronze}">${t}</p>`;
const plain = (html) => `<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.espresso}">${html}</p>`;

function steps(list) {
  return columns(list.map((s, i) => `
    <p style="margin:0 0 6px;font-family:${SERIF};font-size:40px;line-height:.9;font-weight:600;color:${C.goldDeep}">0${i + 1}</p>
    <p style="margin:0 0 6px;font-family:${SERIF};font-size:19px;line-height:1.2;color:${C.espresso}">${s[0]}</p>
    <p style="margin:0;font-family:${SANS};font-size:13.5px;line-height:1.55;color:${C.cocoa}">${s[1]}</p>`));
}

/* The Shafar Loyal panel: perks, and progress for members who are not there yet. */
function loyalPanel(site, cfg, opts = {}) {
  const tiers = (cfg.tiers || []).map((t) => [t.pct + '% off', 'whenever you buy ' + bottles(t.qty) + ' together']);
  tiers.push(['Occasion gifts', 'private codes for Eid and the moments worth marking']);
  const rows = tiers.map((t) => `<tr>
      <td width="120" style="padding:14px 0;border-top:1px solid ${C.rule};font-family:${SERIF};font-size:22px;line-height:1.1;color:${C.goldSoft};vertical-align:top;white-space:nowrap">${t[0]}</td>
      <td style="padding:16px 0 14px 14px;border-top:1px solid ${C.rule};font-family:${SANS};font-size:14px;line-height:1.5;color:${C.ivory};vertical-align:top">${t[1]}</td></tr>`).join('');
  const progress = opts.progress != null ? `
    <tr><td colspan="2" style="padding:18px 0 0;border-top:1px solid ${C.rule}">
      <p style="margin:0 0 10px;font-family:${SANS};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${C.mute}">Your progress &middot; ${opts.progress} of ${cfg.after} completed orders</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${Array.from({ length: cfg.after }, (_, i) => `<td width="${Math.floor(100 / cfg.after)}%" style="padding-right:${i < cfg.after - 1 ? 6 : 0}px"><div style="height:4px;line-height:4px;font-size:1px;border-radius:2px;background:${i < opts.progress ? C.gold : C.rule}">&nbsp;</div></td>`).join('')}
      </tr></table></td></tr>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.brown}" style="background:${C.brown};border-radius:16px">
    <tr><td style="padding:30px 30px 26px" class="pp">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top">${eyebrow('Shafar Loyal', C.goldSoft)}
          <p style="margin:0 0 20px;font-family:${SERIF};font-size:28px;line-height:1.1;color:${C.ivory}">${opts.heading || 'Rewards that grow with every bottle'}</p></td>
        <td width="64" align="right" valign="top"><img src="${site}/assets/mail/crest-gold.png" width="52" alt="" style="display:block;width:52px;height:auto;border:0;opacity:.9"></td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}${progress}</table>
    </td></tr></table>`;
}
const bottles = (n) => n === 1 ? 'one bottle' : n === 2 ? 'two bottles' : n === 3 ? 'three bottles' : n === 4 ? 'four or more bottles' : n + ' or more bottles';

function bottleTrio(site, products) {
  return columns(products.slice(0, 3).map((b) => `
    <a href="${site}/product#${esc(b.id)}" target="_blank" style="text-decoration:none;color:${C.espresso}">
      <div style="height:170px;border-radius:85px 85px 10px 10px;background:${esc(b.tint || '#EFD3A8')};text-align:center">
        <img src="${esc(pic(site, b.img))}" height="140" alt="${esc(b.name)}" style="height:140px;width:auto;margin-top:18px;border:0">
      </div>
      <p style="margin:12px 0 2px;font-family:${SERIF};font-size:19px;line-height:1.15;color:${C.espresso}">${esc(b.name)}</p>
      <p style="margin:0;font-family:${SANS};font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.cocoa}">${b.price != null ? rs(b.price) + ' &middot; 50 ml' : esc(b.kind || '')}</p>
    </a>`));
}

/* ---------- the page every email sits in ---------- */
function layout(site, { title, preheader, body, why }) {
  const year = new Date().getFullYear();
  const link = (href, t) => `<a href="${esc(href)}" target="_blank" style="color:${C.goldSoft};text-decoration:none">${t}</a>`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Noto+Serif+Display:ital,wght@0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%}
  a{color:inherit}
  img{-ms-interpolation-mode:bicubic}
  @media (max-width:620px){
    .wrap{padding:16px 8px!important}
    .px{padding-left:24px!important;padding-right:24px!important}
    .pp{padding-left:20px!important;padding-right:20px!important}
    .h1{font-size:36px!important}
    .stack{display:block!important;width:100%!important;padding-right:0!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.paper}" style="background:${C.paper}">
<tr><td align="center" class="wrap" style="padding:36px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
    <tr><td align="center" bgcolor="${C.brown}" style="background:${C.brown};border-radius:18px 18px 0 0;padding:40px 24px 30px">
      <a href="${site}/" target="_blank"><img src="${site}/assets/mail/logo-gold.png" width="108" alt="Shafar Fragrances" style="display:block;width:108px;height:auto;border:0;color:${C.goldSoft};font-family:${SERIF};font-size:24px"></a>
      <div style="width:56px;height:1px;background:${C.gold};margin:26px auto 0;font-size:1px;line-height:1px">&nbsp;</div>
    </td></tr>
    <tr><td bgcolor="${C.cream}" class="px" style="background:${C.cream};padding:50px 48px 46px">
      ${body}
    </td></tr>
    <tr><td align="center" bgcolor="${C.brown}" style="background:${C.brown};border-radius:0 0 18px 18px;padding:40px 32px 0">
      <p style="margin:0 0 18px;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.3;color:${C.ivory}">Where every scent tells a tale.</p>
      <p style="margin:0 0 16px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;line-height:2">
        ${link(site + '/shop', 'Shop')} &nbsp;<span style="color:#6E5528">&middot;</span>&nbsp; ${link(site + '/account', 'Your account')} &nbsp;<span style="color:#6E5528">&middot;</span>&nbsp; ${link(wa(), 'WhatsApp')} &nbsp;<span style="color:#6E5528">&middot;</span>&nbsp; ${link(CONTACT.instagram, 'Instagram')}</p>
      <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.mute}">${CONTACT.phone} &nbsp;&middot;&nbsp; ${CONTACT.email}<br>Cash on delivery across Pakistan</p>
      <img src="${site}/assets/mail/word-gold.png" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;margin:30px auto 0;border:0">
    </td></tr>
    <tr><td align="center" style="padding:22px 24px 0">
      <p style="margin:0;font-family:${SANS};font-size:11.5px;line-height:1.7;color:#8C7563">${why ? esc(why) + '<br>' : ''}&copy; ${year} Shafar Fragrances</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/* ---------- plain-text twin, for apps that do not show HTML ---------- */
function textOf(lines) { return lines.filter((l) => l !== null && l !== undefined).join('\n') + '\n\nShafar Fragrances\nWhatsApp ' + CONTACT.phone + ' · ' + CONTACT.email + '\n'; }
function textOrder(o) {
  const out = (o.items || []).map((l) => `- ${l.name}, ${l.size || 50} ml x ${l.qty}: ${rs(l.price * l.qty)}`);
  out.push('', 'Subtotal: ' + rs(o.subtotal));
  if (o.discount) out.push((o.loyalty ? 'Loyal reward ' + o.loyalty + '%' : 'Discount' + (o.code ? ' (' + o.code + ')' : '')) + ': -' + rs(o.discount));
  out.push('Delivery: ' + (o.delivery ? rs(o.delivery) : 'Free'), 'Total: ' + rs(o.total) + ' (cash on delivery)');
  return out.join('\n');
}

/* ==================================================================
   THE EMAILS
   ================================================================== */

/* To the customer, the moment the order is placed. */
export function orderPlaced(site, o, opts = {}) {
  const name = first(o.name);
  const addr = esc(o.address) + '<br>' + [o.city, o.province].filter(Boolean).map(esc).join(', ');
  const body = `
    ${eyebrow('Order received')}
    ${h1('Thank you, ' + em(name))}
    ${p(`Your order is in. We will call or message you on <b style="color:${C.espresso};font-weight:500;white-space:nowrap">${esc(phone(o.phone))}</b> to confirm it, then your parcel is on its way. You pay <b style="color:${C.espresso};font-weight:500">${rs(o.total)}</b> in cash when it arrives.`)}
    ${small(`Order <b style="color:${C.espresso}">${esc(o.number)}</b> &nbsp;&middot;&nbsp; ${longDate(o.created_at)}`, 'margin-bottom:30px')}
    ${orderPanel(site, o)}
    ${gap(34)}
    ${columns([
      label('Delivering to') + plain(`${esc(o.name)}<br>${addr}<br>${esc(phone(o.phone))}`),
      label('Payment') + plain(`Cash on delivery<br><span style="color:${C.cocoa}">${rs(o.total)} to the rider when your parcel arrives. Nothing to pay now.</span>`)
    ])}
    ${o.notes ? label('Your note') + plain(esc(o.notes)) + gap(18) : ''}
    ${gap(10)}${ornament(site)}
    <p style="margin:0 0 22px;font-family:${SERIF};font-size:26px;line-height:1.1;color:${C.espresso}">What happens <em style="font-style:italic;font-weight:400">next</em></p>
    ${steps([
      ['We confirm', 'A quick call or WhatsApp message to check your details.'],
      ['We dispatch', 'Your bottles are packed with care and sent to your door.'],
      ['You pay on arrival', 'Cash to the rider when the parcel reaches you.']
    ])}
    ${gap(16)}
    <div style="text-align:center">
      ${opts.member ? button(site + '/account#orders', 'View your order') : button(site + '/account?join=' + encodeURIComponent(o.email || ''), 'Create your account')}
      ${button(wa('Hello Shafar, about my order ' + o.number + '.'), 'WhatsApp us', 'outline')}
    </div>
    ${opts.member ? '' : gap(8) + small('Open an account with this email and this order is saved to it, counting towards Shafar Loyal rewards.', 'text-align:center')}`;
  return {
    subject: `Order ${o.number} received · Shafar Fragrances`,
    html: layout(site, { title: 'Order ' + o.number, preheader: `Thank you, ${name}. We will call you on ${phone(o.phone)} to confirm order ${o.number}.`, body, why: 'You are receiving this because you placed an order at Shafar Fragrances.' }),
    text: textOf([`Thank you, ${name}.`, '', `Your order ${o.number} is in. We will call or message you on ${o.phone} to confirm it. You pay ${rs(o.total)} in cash when it arrives.`, '', textOrder(o), '',
      'Delivering to: ' + [o.name, o.address, o.city, o.province].filter(Boolean).join(', '), '', opts.member ? 'Your orders: ' + site + '/account#orders' : 'Create an account: ' + site + '/account'])
  };
}

/* To the shop, for every new order. */
export function orderAlert(site, o, opts = {}) {
  const count = (o.items || []).reduce((s, l) => s + Number(l.qty || 0), 0);
  const tag = opts.loyal ? 'Shafar Loyal member' : opts.member ? 'Account holder' : 'Guest checkout';
  const body = `
    ${eyebrow('New order &middot; ' + esc(tag))}
    ${h1('Order ' + em(o.number))}
    ${p(`<b style="color:${C.espresso};font-weight:500">${esc(o.name)}</b> from ${esc(o.city)} ordered ${count} ${count === 1 ? 'bottle' : 'bottles'} for <b style="color:${C.espresso};font-weight:500">${rs(o.total)}</b>, cash on delivery.`)}
    <div style="margin:6px 0 26px">
      ${button(site + '/admin#orders', 'Open dashboard')}
      ${button('https://wa.me/' + waNumber(o.phone) + '?text=' + encodeURIComponent('Hello ' + first(o.name) + ', this is Shafar Fragrances about your order ' + o.number + '.'), 'WhatsApp customer', 'outline')}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.linen}" style="background:${C.linen};border:1px solid ${C.sand};border-radius:14px;margin-bottom:26px"><tr><td style="padding:24px 26px" class="pp">
      ${columns([
        label('Customer') + plain(`${esc(o.name)}<br><a href="tel:${esc(o.phone)}" style="color:${C.espresso}">${esc(phone(o.phone))}</a>${o.email ? '<br><a href="mailto:' + esc(o.email) + '" style="color:' + C.espresso + '">' + esc(o.email) + '</a>' : ''}`),
        label('Deliver to') + plain(esc(o.address) + '<br>' + [o.city, o.province].filter(Boolean).map(esc).join(', '))
      ])}
      ${o.notes ? label('Note from the customer') + plain(esc(o.notes)) : ''}
    </td></tr></table>
    ${orderPanel(site, o, 'Order details')}
    ${gap(20)}
    ${small(`Placed ${new Date(o.created_at || Date.now()).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} (Pakistan time).`, 'text-align:center')}`;
  return {
    subject: `New order ${o.number} · ${rs(o.total)} · ${o.name}, ${o.city}`,
    html: layout(site, { title: 'New order ' + o.number, preheader: `${o.name}, ${o.city}: ${count} ${count === 1 ? 'bottle' : 'bottles'}, ${rs(o.total)} cash on delivery.`, body, why: 'Sent to the order alert addresses set in the Shafar dashboard.' }),
    text: textOf([`New order ${o.number} (${tag})`, '', `${o.name}, ${o.phone}${o.email ? ', ' + o.email : ''}`, [o.address, o.city, o.province].filter(Boolean).join(', '), o.notes ? 'Note: ' + o.notes : null, '', textOrder(o), '', 'Dashboard: ' + site + '/admin#orders'])
  };
}
const waNumber = (phone) => { const d = String(phone || '').replace(/\D/g, ''); return d.startsWith('0') ? '92' + d.slice(1) : d; };

/* Sign-up: confirm the address before the account opens. */
export function verifyEmail(site, { name, link }) {
  const body = `
    ${eyebrow('One last step')}
    ${h1('Confirm your ' + em('email'))}
    ${p(`Hello ${esc(first(name))}, thank you for joining Shafar. Press the button below to confirm this is your email address, and your account opens straight away.`)}
    ${gap(8)}
    ${button(link, 'Confirm my email')}
    ${gap(22)}
    ${small('The link works for 48 hours. If you did not ask for a Shafar account, you can ignore this email and nothing will happen.')}
    ${gap(26)}${ornament(site)}
    ${small(`Button not working? Paste this into your browser:<br><a href="${esc(link)}" style="color:${C.bronze};word-break:break-all">${esc(link)}</a>`)}`;
  return {
    subject: 'Confirm your email for Shafar Fragrances',
    html: layout(site, { title: 'Confirm your email', preheader: 'One tap to open your Shafar account.', body, why: 'You are receiving this because this address was used to create a Shafar account.' }),
    text: textOf([`Hello ${first(name)},`, '', 'Confirm your email to open your Shafar account:', link, '', 'The link works for 48 hours. If you did not ask for an account, ignore this email.'])
  };
}

/* Sent once the email is confirmed. */
export function welcome(site, { name, loyalty, products }) {
  const n = first(name);
  const body = `
    ${eyebrow('Your account is ready')}
    ${h1('Welcome, ' + em(n))}
    ${p('Your Shafar account is open. Every order you place is kept in one place, your wishlist follows you to any device, and your rewards build with every bottle.')}
    ${gap(14)}
    ${products && products.length >= 3 ? `<p style="margin:0 0 18px;font-family:${SERIF};font-size:26px;line-height:1.1;color:${C.espresso}">The house <em style="font-style:italic;font-weight:400">favourites</em></p>` + bottleTrio(site, products) + gap(18) : ''}
    ${loyalty && loyalty.on ? loyalPanel(site, loyalty, { heading: bottlesHeading(loyalty.after), progress: 0 }) + gap(34) : ''}
    <div style="text-align:center">
      ${button(site + '/shop', 'Explore the collection')}
      ${button(site + '/account', 'Your account', 'outline')}
    </div>`;
  return {
    subject: `Welcome to Shafar, ${n}`,
    html: layout(site, { title: 'Welcome to Shafar', preheader: `Your account is open, ${n}. Here is what it does for you.`, body, why: 'You are receiving this because you created a Shafar account.' }),
    text: textOf([`Welcome, ${n}.`, '', 'Your Shafar account is open. Your orders, your wishlist and your rewards now live in one place.', '',
      loyalty && loyalty.on ? `Shafar Loyal: after ${loyalty.after} completed orders, ` + loyalty.tiers.map((t) => `${t.pct}% off ${t.qty}+ bottles`).join(', ') + ', plus occasion codes.' : null, '', 'Shop: ' + site + '/shop'])
  };
}
const bottlesHeading = (after) => (after === 3 ? 'Three' : after === 2 ? 'Two' : String(after)) + ' orders in, and the house opens up';

/* Forgotten password. */
export function resetPassword(site, { name, link }) {
  const body = `
    ${eyebrow('Account help')}
    ${h1('Reset your ' + em('password'))}
    ${p(`Hello ${esc(first(name))}, someone asked to reset the password for this Shafar account. If it was you, choose a new one below.`)}
    ${gap(8)}
    ${button(link, 'Choose a new password')}
    ${gap(22)}
    ${small('The link works for one hour and only once. If you did not ask for this, ignore this email; your password stays as it is.')}
    ${gap(26)}${ornament(site)}
    ${small(`Button not working? Paste this into your browser:<br><a href="${esc(link)}" style="color:${C.bronze};word-break:break-all">${esc(link)}</a>`)}`;
  return {
    subject: 'Reset your Shafar password',
    html: layout(site, { title: 'Reset your password', preheader: 'A link to choose a new password. It works for one hour.', body, why: 'You are receiving this because a password reset was asked for on your Shafar account.' }),
    text: textOf([`Hello ${first(name)},`, '', 'Choose a new password for your Shafar account:', link, '', 'The link works for one hour. If you did not ask for this, ignore this email.'])
  };
}

/* When a member's completed orders reach the loyalty mark. */
export function loyalWelcome(site, { name, loyalty }) {
  const n = first(name);
  const body = `
    ${eyebrow('A thank you from the house')}
    ${h1('You are now ' + em('Shafar Loyal'))}
    ${p(`${esc(n)}, ${loyalty.after} orders with us, and we noticed. From today your rewards are applied for you at checkout whenever you are signed in. No codes to remember.`)}
    ${gap(10)}
    ${loyalPanel(site, loyalty, { heading: 'Your rewards, from today' })}
    ${gap(34)}
    <div style="text-align:center">${button(site + '/shop', 'Shop with your rewards')}</div>`;
  return {
    subject: `${n}, you are now Shafar Loyal`,
    html: layout(site, { title: 'You are Shafar Loyal', preheader: loyalty.tiers.map((t) => `${t.pct}% off ${t.qty} bottles`).join(', ') + ', from today.', body, why: 'You are receiving this because you are a Shafar Loyal member.' }),
    text: textOf([`${n}, you are now Shafar Loyal.`, '', 'Your rewards, applied at checkout when you are signed in:', ...loyalty.tiers.map((t) => `- ${t.pct}% off when you buy ${t.qty} or more bottles`), '- Private codes on every occasion', '', 'Shop: ' + site + '/shop'])
  };
}

/* An occasion code, to every Loyal member. */
export function occasion(site, { name, d }) {
  const n = first(name);
  const title = String(d.title || '').trim();
  const off = d.kind === 'percent' ? d.value + '% off' : rs(d.value) + ' off';
  const terms = [d.expires ? 'Until ' + longDate(d.expires) : null, d.min_total ? 'On orders of ' + rs(d.min_total) + ' or more' : null, 'One use per member'].filter(Boolean);
  const body = `
    ${eyebrow('For our Loyal members')}
    ${h1((title ? esc(title) : 'A little gift') + ', ' + em(n))}
    ${p(`As one of our Shafar Loyal members, here is a private code${title ? ' to celebrate with us' : ''}. It is yours to use on anything in the collection.`)}
    ${gap(10)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.brown}" style="background:${C.brown};border-radius:16px"><tr><td style="padding:12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed #8A6D35;border-radius:10px"><tr><td align="center" style="padding:34px 20px 32px">
        <p style="margin:0 0 12px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:${C.mute}">Your code</p>
        <p style="margin:0 0 12px;font-family:${SERIF};font-size:40px;line-height:1;font-weight:600;letter-spacing:.08em;color:${C.goldSoft}">${esc(d.code)}</p>
        <p style="margin:0 0 6px;font-family:${SERIF};font-style:italic;font-size:22px;color:${C.ivory}">${off}</p>
        <p style="margin:0;font-family:${SANS};font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.mute}">${terms.join(' &middot; ')}</p>
      </td></tr></table>
    </td></tr></table>
    ${gap(26)}
    ${p('Sign in, then type the code at checkout. If your Loyal bottle reward saves you more on the same order, the better of the two is applied for you.', 'font-size:14px')}
    ${gap(6)}
    <div style="text-align:center">${button(site + '/shop', 'Shop with your code')}</div>`;
  return {
    subject: `${title ? title + ': ' : ''}a gift for you, ${n}`,
    html: layout(site, { title: title || 'A gift from Shafar', preheader: `${off} with code ${d.code}, just for Shafar Loyal members.`, body, why: 'You are receiving this because you are a Shafar Loyal member.' }),
    text: textOf([`${title ? title + ', ' : ''}${n}`, '', `A private code for Shafar Loyal members: ${d.code} (${off}).`, terms.join(' · '), '', 'Sign in and type the code at checkout: ' + site + '/shop'])
  };
}
