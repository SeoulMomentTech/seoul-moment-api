/* Seoul Moment — 로컬 API 플레이그라운드 공용 스크립트
 *
 * 설정(baseUrl / 토큰 / 언어)은 localStorage 에 담아 페이지 간에 공유한다.
 * file:// 로 열어도 origin 이 null 이라 서버의 cors:true 가 그대로 통과시킨다.
 */

const STORE = {
  base: 'sm.pg.base',
  token: 'sm.pg.token',
  adminToken: 'sm.pg.adminToken',
  lang: 'sm.pg.lang',
  email: 'sm.pg.email',
};

const DEFAULT_BASE = 'http://localhost:3111';

function ls(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    /* 시크릿 모드 등에서 접근이 막히면 기본값으로 동작한다 */
  }
  return value;
}

const cfg = {
  base: () => ls(STORE.base) || DEFAULT_BASE,
  token: () => ls(STORE.token) || '',
  adminToken: () => ls(STORE.adminToken) || '',
  lang: () => ls(STORE.lang) || 'ko',
  setBase: (v) => ls(STORE.base, v),
  setToken: (v) => ls(STORE.token, v),
  setAdminToken: (v) => ls(STORE.adminToken, v),
  setLang: (v) => ls(STORE.lang, v),
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const money = (n) =>
  typeof n === 'number' ? 'NT$' + n.toLocaleString('en-US') : '-';

/**
 * API 호출. opts: { body, auth: 'user'|'admin'|false, lang: bool, query: object }
 * 반환은 { status, ok, ms, body } — 본문이 비어 있으면 body 는 null 이다.
 */
async function api(method, path, opts = {}) {
  const url = new URL(cfg.base().replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const headers = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.lang !== false) headers['Accept-language'] = cfg.lang();

  const auth = opts.auth === undefined ? 'user' : opts.auth;
  if (auth === 'user' && cfg.token()) headers.Authorization = `Bearer ${cfg.token()}`;
  if (auth === 'admin' && cfg.adminToken()) headers.Authorization = `Bearer ${cfg.adminToken()}`;

  const started = performance.now();
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (e) {
    return {
      status: 0,
      ok: false,
      ms: Math.round(performance.now() - started),
      body: {
        error: '서버에 연결하지 못했습니다',
        detail: String(e),
        hint: `${cfg.base()} 가 떠 있는지 확인하세요 (npm run start:local)`,
      },
    };
  }

  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }
  }

  return { status: res.status, ok: res.ok, ms, body };
}

/** 결과 패널 렌더. 요청도 함께 보여줘야 뭘 눌렀는지 헷갈리지 않는다 */
function showResult(target, res, label) {
  const node = typeof target === 'string' ? $(target) : target;
  if (!node) return res;

  const cls = res.status === 0 ? 's5' : 's' + String(res.status)[0];
  node.innerHTML = '';
  node.appendChild(
    el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'status ' + cls, text: res.status || 'ERR' }),
        label ? el('span', { text: label }) : null,
        el('span', { class: 'ms', text: res.ms + 'ms' }),
      ]),
      el('pre', { text: res.body === null ? '(본문 없음)' : JSON.stringify(res.body, null, 2) }),
    ]),
  );
  return res;
}

/** 상단 공용 바. 페이지마다 mountShell('cart') 처럼 현재 페이지만 알려주면 된다 */
function mountShell(current) {
  const pages = [
    ['index.html', '설정·로그인'],
    ['product.html', '상품상세 v1'],
    ['cart.html', '장바구니'],
    ['order.html', '주문'],
    ['shipping.html', '배송비 정책'],
  ];

  const baseInput = el('input', {
    value: cfg.base(),
    style: 'width: 210px',
    onchange: (e) => cfg.setBase(e.target.value.trim() || DEFAULT_BASE),
  });

  const langSelect = el(
    'select',
    { style: 'width: 92px', onchange: (e) => cfg.setLang(e.target.value) },
    ['ko', 'en', 'zh-TW'].map((code) =>
      el('option', { value: code, ...(cfg.lang() === code ? { selected: '' } : {}) }, code),
    ),
  );

  const userChip = el('span', {
    class: 'tokenchip ' + (cfg.token() ? 'on' : 'off'),
    text: cfg.token() ? 'user 토큰 있음' : 'user 토큰 없음',
  });
  const adminChip = el('span', {
    class: 'tokenchip ' + (cfg.adminToken() ? 'on' : 'off'),
    text: cfg.adminToken() ? 'admin 토큰 있음' : 'admin 토큰 없음',
  });

  const shell = el('div', { class: 'shell' }, [
    el('div', { class: 'shell-in' }, [
      el('div', { class: 'shell-row' }, [
        el('span', { class: 'mark', text: 'SM API Playground' }),
        el('nav', {}, pages.map(([href, name]) =>
          el('a', { href, ...(href === current ? { 'aria-current': 'page' } : {}) }, name),
        )),
      ]),
      el('div', { class: 'shell-row' }, [
        el('span', { class: 'mark', text: 'Base' }),
        baseInput,
        el('span', { class: 'mark', text: 'Lang' }),
        langSelect,
        el('span', { class: 'spacer' }),
        userChip,
        adminChip,
      ]),
    ]),
  ]);

  document.body.insertBefore(shell, document.body.firstChild);
}

/** 서버가 안 떠 있을 때 가장 먼저 의심할 것을 알려준다 */
function connectionHint() {
  return el('div', { class: 'banner' }, [
    el('span', {
      html:
        '서버가 필요합니다 — <code>npm run start:local</code> (기본 <code>http://localhost:3111</code>). ' +
        '포트가 다르면 위 <b>Base</b> 를 고치세요. 설정과 토큰은 브라우저에 저장되어 페이지를 옮겨도 유지됩니다.',
    }),
  ]);
}
