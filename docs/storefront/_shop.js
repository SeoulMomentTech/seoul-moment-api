/* Seoul Moment — 스토어프론트 시안 공용 스크립트
 * 시안이지만 실제 API 를 호출한다. 화면만 그리는 목업이 아니라
 * 금액·재고·배송비가 서버 응답 그대로 나온다.
 */

const S = {
  base: 'sm.shop.base',
  token: 'sm.shop.token',
  lang: 'sm.shop.lang',
};
const DEFAULT_BASE = 'http://localhost:3111';

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) { /* 저장이 막혀도 화면은 돌아야 한다 */ }
  return v;
}

const shop = {
  base: () => ls(S.base) || DEFAULT_BASE,
  token: () => ls(S.token) || '',
  lang: () => ls(S.lang) || 'ko',
  setBase: (v) => ls(S.base, v),
  setToken: (v) => ls(S.token, v),
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

/** 대만 달러 표기. 서버가 주는 값은 전부 정수다 */
const nt = (n) => (typeof n === 'number' ? 'NT$' + n.toLocaleString('en-US') : '-');

async function apiCall(method, path, opts = {}) {
  const url = new URL(shop.base().replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const headers = { 'Accept-language': shop.lang() };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && shop.token()) headers.Authorization = `Bearer ${shop.token()}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (e) {
    return { status: 0, ok: false, body: null, error: '서버에 연결하지 못했습니다' };
  }

  const text = await res.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch (e) { body = text; } }

  return { status: res.status, ok: res.ok, body, data: body && body.data };
}

/* ---------- 아이콘 ---------- */
const ICON = {
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.6 11.1a1.8 1.8 0 0 0 1.75 1.4h8.6a1.8 1.8 0 0 0 1.76-1.42L21 6.6H5.6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><path d="M12 16h.01"/></svg>',
};

function icon(name, cls) {
  const span = el('span', { class: cls || '' });
  span.innerHTML = ICON[name] || '';
  return span.firstChild;
}

/* ---------- 헤더 ---------- */
function mountHeader(current) {
  const badge = el('span', { class: 'sm-badge num', id: 'cartBadge', hidden: true, text: '0' });

  const header = el('header', { class: 'sm-header' }, [
    el('div', { class: 'sm-header-in' }, [
      el('div', { class: 'sm-cluster' }, [
        el('a', { href: 'index.html', class: 'sm-wordmark' }, 'SEOUL MOMENT'),
        el('ul', { class: 'sm-nav' }, [
          el('li', {}, [el('a', { href: 'index.html', class: 'sm-lnk' + (current === 'index' ? ' on' : '') }, 'Product')]),
          el('li', { class: 'hide-m' }, [el('span', { class: 'sm-lnk' }, 'News')]),
        ]),
      ]),
      el('ul', { class: 'sm-nav' }, [
        el('li', { class: 'hide-m' }, [el('span', { class: 'sm-lnk' }, 'About')]),
        el('li', { class: 'hide-m' }, [el('span', { class: 'sm-lnk' }, 'MyPage')]),
        el('li', {}, [
          el('a', { href: 'cart.html', class: 'sm-cart-btn', 'aria-label': '장바구니' }, [icon('cart'), badge]),
        ]),
      ]),
    ]),
  ]);

  document.body.insertBefore(header, document.body.firstChild);
  refreshBadge();
}

async function refreshBadge() {
  const badge = $('#cartBadge');
  if (!badge || !shop.token()) return;
  const res = await apiCall('GET', '/user/cart/count');
  const count = res.data && res.data.count;
  if (count > 0) {
    badge.textContent = String(count);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ---------- 토스트 ---------- */
function toast(message, opts = {}) {
  let wrap = $('.toast-wrap');
  if (!wrap) {
    wrap = el('div', { class: 'toast-wrap' });
    document.body.appendChild(wrap);
  }

  const node = el('div', { class: 'toast' + (opts.bad ? ' bad' : '') }, [
    icon(opts.bad ? 'alert' : 'ok', 'ic'),
    el('span', { class: 'tx', text: message }),
    opts.actionText
      ? el('span', { class: 'act', text: opts.actionText, onclick: opts.onAction || (() => {}) })
      : null,
  ]);
  node.firstChild.classList.add('ic');

  wrap.appendChild(node);
  setTimeout(() => node.remove(), opts.ms || 3200);
}

/** 서버 에러를 사용자 문구로. message 를 그대로 노출하면 영어가 새어 나온다 */
function errorText(res, fallback) {
  if (res.status === 0) return '서버에 연결하지 못했습니다. API 가 켜져 있는지 확인해주세요.';
  if (res.status === 401) return '로그인이 필요합니다.';
  if (res.status === 409) return '재고가 부족합니다.';
  if (res.status === 404) return '상품 정보를 찾을 수 없습니다.';
  if (res.status === 400) return fallback || '입력값을 확인해주세요.';
  return fallback || '잠시 후 다시 시도해주세요.';
}

/* ---------- 개발용 바 ----------
 * 시안이지만 실제 API 를 부르므로, 어느 서버에 붙었는지와 로그인 여부는 보여야 한다.
 */
function mountDevBar() {
  const baseInput = el('input', {
    value: shop.base(),
    size: '24',
    onchange: (e) => { shop.setBase(e.target.value.trim() || DEFAULT_BASE); location.reload(); },
  });

  const status = shop.token()
    ? el('span', { class: 'ok', text: '로그인됨' })
    : el('span', { class: 'no', text: '비로그인' });

  const bar = el('div', { class: 'devbar' }, [
    el('span', { text: '시안 · 실제 API 연동' }),
    el('span', { text: 'API' }),
    baseInput,
    status,
    el('span', { class: 'spacer' }),
    el('a', { href: '../api-playground/index.html' }, '로그인 / 디버그 →'),
    shop.token()
      ? el('button', { text: '로그아웃', onclick: () => { shop.setToken(null); location.reload(); } })
      : null,
  ]);

  document.body.insertBefore(bar, document.body.firstChild);
}

/** 로그인이 필요한 화면에서 쓴다 */
function requireLogin(container) {
  if (shop.token()) return true;
  container.innerHTML = '';
  container.appendChild(
    el('div', { class: 'sm-empty' }, [
      el('span', { class: 'ico' }, [icon('cart')]),
      el('h2', { text: '로그인이 필요합니다' }),
      el('p', { text: '장바구니와 주문은 로그인한 뒤에 이용할 수 있습니다.' }),
      el('a', { href: '../api-playground/index.html' }, [
        el('button', { class: 'sm-btn' }, '로그인하러 가기'),
      ]),
    ]),
  );
  return false;
}
