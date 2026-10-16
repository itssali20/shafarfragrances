/* On every page: the header account button, and the wishlist kept in step with a signed-in account.
   The sf_in cookie only holds the first letter of the customer's name, so no request is needed to draw the header.
   Pages announce cart and wishlist saves with a 'shafar:save' event. */
(function () {
  'use strict';
  var KEY = 'shafar.wish', SYNCED = 'shafar.wish.synced';
  var hint = (document.cookie.match(/(?:^|;\s*)sf_in=([^;]*)/) || [])[1];
  var initial = '';
  try { initial = hint ? decodeURIComponent(hint).charAt(0) : ''; } catch (e) {}
  var btn = document.getElementById('open-account');

  var css = document.createElement('style');
  css.textContent = 'a.icon{text-decoration:none}' +
    '.icon__me{width:1.875rem;height:1.875rem;border-radius:50%;display:grid;place-items:center;background:var(--espresso);color:var(--word,#FFFBF4);' +
    'font-family:var(--display);font-size:max(13px,0.9375rem);font-weight:500;line-height:1;box-shadow:0 0 0 1px var(--cream),0 0 0 2px rgba(201,162,74,.7)}';
  document.head.appendChild(css);

  if (btn && initial) {
    btn.textContent = '';
    var me = document.createElement('span');
    me.className = 'icon__me'; me.setAttribute('aria-hidden', 'true'); me.textContent = initial;
    btn.appendChild(me);
    btn.setAttribute('aria-label', 'Your account');
  }
  window.ShafarAccount = { signedIn: !!initial, initial: initial };
  if (!initial) return;

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var timer;
  function push() {
    var now = read(KEY) || '[]';
    if (now === read(SYNCED)) return;
    var ids; try { ids = JSON.parse(now); } catch (e) { return; }
    fetch('/api/account', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'wish', ids: ids }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { try { localStorage.setItem(SYNCED, now); } catch (e) {} } })
      .catch(function () {});
  }
  document.addEventListener('shafar:save', function () { clearTimeout(timer); timer = setTimeout(push, 600); });
  push();
})();
