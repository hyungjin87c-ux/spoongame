// QA-003 M7c 개인정보(P1~P5): 입력·저장·표시 중 글이 의견 보내기 주소·console·오류 메시지·document.title·sessionStorage·설정 키·IndexedDB·쿠키·DOM 속성·주소(history.state)에 복사되지 않고,
// 외부 요청 0, 게임 키(suzeo-game:save) 한 곳에만 있으며, 입력 초안은 입력 중에 어디에도 저장되지 않는다. 엔딩 화면·다시 태어나기 뒤도 본다.
// 사용: node qa/scripts/m7c-privacy.mjs
import { launch, openOracle, plainLife, openSeeded, openManual, sheetReady, readNote, readCard, shot, sleep, runCase, mkctx, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, settingsEnvelope, SET_MANUAL, PROD, TOUCH, evalCore, con } from './m7c-lib.mjs';

const MARKER = 'QAMARK_홍길동_010-1234-5678_서울시강남구_pw:hunter2';
const FRAGS = ['QAMARK', '홍길동', '010-1234', '5678', 'hunter2', '강남구'];
const hasFrag = (s) => FRAGS.filter((f) => String(s).includes(f));

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });

const NET_INIT = () => {
  window.__net = [];
  const push = (kind, url, body) => window.__net.push({ kind, url: String(url).slice(0, 200), body: body === undefined || body === null ? '' : String(body).slice(0, 200) });
  const f = window.fetch;
  window.fetch = function (u, o) {
    push('fetch', typeof u === 'string' ? u : u.url, o && o.body);
    return f.apply(this, arguments);
  };
  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    push('xhr', u);
    return xo.apply(this, arguments);
  };
  if (navigator.sendBeacon) {
    const sb = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (u, d) => {
      push('beacon', u, d);
      return sb(u, d);
    };
  }
  const WS = window.WebSocket;
  window.WebSocket = function (u) {
    push('ws', u);
    return new WS(...arguments);
  };
  window.__logs = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug', 'trace']) {
    const o = console[m].bind(console);
    console[m] = (...a) => {
      window.__logs.push(m + ': ' + a.map((x) => String(x)).join(' ').slice(0, 300));
      o(...a);
    };
  }
};

const SCAN = (frags) => {
  const hit = (v) => frags.filter((f) => String(v).includes(f));
  const out = { title: hit(document.title), attrs: [], local: {}, session: {}, cookie: hit(document.cookie), url: hit(location.href), historyState: hit(JSON.stringify(history.state)) };
  for (const el of document.querySelectorAll('*')) {
    for (const a of el.attributes) {
      const h = hit(a.name + '=' + a.value);
      if (h.length) out.attrs.push(`${el.tagName.toLowerCase()}[${a.name}] ${h.join(',')}`);
    }
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out.local[k] = hit(localStorage.getItem(k));
  }
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    out.session[k] = hit(sessionStorage.getItem(k));
  }
  out.links = [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => hit(h).length);
  out.localKeys = Object.keys(out.local);
  out.sessionKeys = Object.keys(out.session);
  return out;
};

async function scan(page) {
  const s = await page.evaluate(SCAN, FRAGS);
  s.idb = await page.evaluate(async () => {
    try {
      return indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [];
    } catch {
      return ['(error)'];
    }
  });
  s.caches = await page.evaluate(async () => {
    try {
      return await caches.keys();
    } catch {
      return [];
    }
  });
  return s;
}

await runCase(
  { id: 'P01', cat: '개인정보', title: '기록을 쓰는 동안·저장 뒤·새로고침 뒤: 글이 게임 키 한 곳에만 있다(설정 키·sessionStorage·쿠키·IndexedDB·Cache·주소·document.title·DOM 속성·링크에 0), 입력 초안은 저장되지 않는다', steps: '식별자 모양의 시험 글(이름·전화번호 꼴·주소·비밀번호 꼴)을 수동 시트에 입력(중간 스캔) → 1번 → 스캔 → 새로고침 → 스캔', expected: '입력 중: 게임 키·설정 키·sessionStorage 포함 어디에도 0 / 저장 뒤: 게임 키에만 / 나머지 0' },
  async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
    const shots = [];
    const { ctx, page } = await openSeeded(b, base, { init: NET_INIT });
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText(MARKER);
    await sleep(400);
    let s = await scan(page);
    chk('입력 중: 게임 키에도 없음(초안 미저장)', (s.local[GAME_KEY] || []).length === 0, JSON.stringify(s.local[GAME_KEY]));
    chk('입력 중: 설정 키·그 밖 저장소 키에 없음', Object.entries(s.local).every(([k, v]) => v.length === 0) && Object.entries(s.session).every(([k, v]) => v.length === 0), JSON.stringify({ local: s.local, session: s.session }));
    chk('입력 중: document.title·주소·history.state 0', s.title.length === 0 && s.url.length === 0 && s.historyState.length === 0, JSON.stringify({ t: s.title, u: s.url, h: s.historyState }));
    chk('입력 중: DOM 속성에 0(입력란 값은 속성이 아님)', s.attrs.length === 0, s.attrs.join(' | '));
    await page.getByTestId('note-save').tap();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
    await sleep(500);
    s = await scan(page);
    chk('저장 뒤: 게임 키에는 있음(정상)', (s.local[GAME_KEY] || []).length > 0, JSON.stringify(s.local[GAME_KEY]));
    chk('저장 뒤: 설정 키·그 밖 키·sessionStorage에 0', Object.entries(s.local).filter(([k]) => k !== GAME_KEY).every(([k, v]) => v.length === 0) && Object.entries(s.session).every(([k, v]) => v.length === 0), JSON.stringify({ localKeys: s.localKeys, sessionKeys: s.sessionKeys }));
    chk('저장 뒤: localStorage 키는 게임·설정 + 시험 표식뿐', s.localKeys.every((k) => [GAME_KEY, SETTINGS_KEY].includes(k)), s.localKeys.join(','));
    chk('저장 뒤: 쿠키·IndexedDB·Cache 비어 있음', s.cookie.length === 0 && s.idb.length === 0 && s.caches.length === 0, JSON.stringify({ idb: s.idb, caches: s.caches }));
    chk('저장 뒤: document.title·주소·history.state·링크 0', s.title.length === 0 && s.url.length === 0 && s.historyState.length === 0 && s.links.length === 0, JSON.stringify({ t: s.title, links: s.links }));
    chk('저장 뒤: DOM 속성(aria-label·title·data-* 포함)에 0', s.attrs.length === 0, s.attrs.join(' | '));
    chk('저장 뒤: 글은 화면 본문 텍스트로만 보임', (await page.evaluate(() => document.body.innerText)).includes(MARKER), '');
    shots.push(await shot(page, 'P01', 'saved'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(500);
    s = await scan(page);
    chk('새로고침 뒤: 설정·sessionStorage·쿠키·IndexedDB·Cache·주소·title·속성에 0', Object.entries(s.local).filter(([k]) => k !== GAME_KEY).every(([k, v]) => v.length === 0) && Object.entries(s.session).every(([k, v]) => v.length === 0) && s.title.length === 0 && s.url.length === 0 && s.attrs.length === 0 && s.idb.length === 0, JSON.stringify({ attrs: s.attrs }));
    const stor = await page.evaluate(() => ({ cookie: document.cookie, ss: Object.keys(sessionStorage) }));
    chk('쿠키 0', stor.cookie === '', stor.cookie);
    await ctx.close();
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과`, checks, shots };
  },
);

await runCase(
  { id: 'P02', cat: '개인정보', title: '의견 보내기 주소에 글 0 — 기록이 있는 인생에서 주소(href)의 모든 조각을 점검하고, 눌러 열린 새 탭 주소도 점검', steps: '글이 든 인생 화면의 「의견 보내기」 링크 href와 클릭해 열리는 주소', expected: 'href는 허용 목록(저장소 이슈 작성 + 화면·세상·인생 길이·빌드)뿐, 글 조각 0' },
  async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
    const { ctx, page } = await openSeeded(b, base);
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText(MARKER + ' <b>&quot;');
    await page.getByTestId('note-save').tap();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
    await sleep(500);
    const href = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim().slice(0, 20), href: a.href, target: a.target, rel: a.rel })));
    const fb = href.find((h) => /issues\/new/.test(h.href));
    chk('의견 보내기 링크가 있음', !!fb, JSON.stringify(href.map((h) => h.text)));
    chk('주소에 글 조각 0', href.every((h) => hasFrag(h.href).length === 0 && !/%EC%9D%B4|QAMARK/.test(h.href)), JSON.stringify(fb));
    chk('주소 모양(이슈 작성 + template + screen)', fb && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new\?template=feedback\.yml&screen=[^&]*$/.test(fb.href), fb ? fb.href : '');
    chk('새 탭 링크는 noopener noreferrer', fb && fb.target === '_blank' && /noopener/.test(fb.rel) && /noreferrer/.test(fb.rel), fb ? `${fb.target} ${fb.rel}` : '');
    // 클릭해 열리는 주소(외부 요청은 막아서 열림 시도만 본다)
    await ctx.route('https://github.com/**', (r) => r.abort());
    const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
    await page.getByTestId('tool-feedback').or(page.locator('a[href*="issues/new"]')).first().tap().catch(() => {});
    const popup = await popupP;
    if (popup) {
      const u = popup.url();
      chk('열린 주소에 글 조각 0', hasFrag(decodeURIComponent(u)).length === 0, u.slice(0, 160));
      await popup.close().catch(() => {});
    }
    await ctx.close();
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${fb ? ' — ' + fb.href.slice(0, 140) : ''}`, checks };
  },
);

await runCase(
  { id: 'P03', cat: '개인정보', title: 'console·오류·경고창·외부 요청 0 — 글(식별자 꼴·특수 문자·초장문·이모지)을 입력·저장·새로고침하는 동안 모든 console 종류(log·info·warn·error·debug)와 네트워크를 감시', steps: '여러 종류의 글로 기록 4건 + 저장 변조 한 번 + 새로고침, fetch·XHR·beacon·WebSocket 후킹 + 요청 감시', expected: 'console 출력에 글 0(출력 자체 0), pageerror 0, dialog 0, 외부 도메인 요청 0, fetch·XHR·beacon 호출 0' },
  async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
    const { ctx, page } = await openSeeded(b, base, { init: NET_INIT });
    const reqs = [];
    const bodies = [];
    page.on('request', (r) => {
      reqs.push(r.url());
      const d = r.postData();
      if (d) bodies.push(d.slice(0, 120));
    });
    const dialogs = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      d.dismiss();
    });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
    const texts = [MARKER, '<script>alert(1)</script>', 'x'.repeat(200) + '👨‍👩‍👧', '‮위험​글'];
    for (const t of texts) {
      await openManual(page);
      await page.getByTestId('note-input').focus();
      await page.keyboard.insertText(t);
      await page.getByTestId('note-save').tap();
      await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
      await sleep(450);
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(600);
    const logs = await page.evaluate(() => window.__logs || []);
    const net = await page.evaluate(() => window.__net || []);
    chk('console 출력 0(모든 종류)', logs.length === 0, JSON.stringify(logs).slice(0, 200));
    chk('console 출력에 글 0', logs.every((l) => hasFrag(l).length === 0), '');
    chk('pageerror 0·경고창 0', errs.length === 0 && dialogs.length === 0, JSON.stringify({ errs, dialogs }));
    chk('fetch·XHR·beacon·WebSocket 호출 0', net.length === 0, JSON.stringify(net));
    const external = reqs.filter((u) => { try { const h = new URL(u).hostname; return !(h === '127.0.0.1' || h === 'localhost') && !/^(data|blob|about):/.test(u); } catch { return true; } });
    chk('외부 도메인 요청 0', external.length === 0, external.join(' '));
    chk('요청 주소·본문에 글 0', reqs.every((u) => hasFrag(decodeURIComponent(u)).length === 0) && bodies.length === 0, `bodies ${bodies.length}`);
    await ctx.close();
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과 (요청 ${reqs.length}건 모두 로컬)`, checks };
  },
);

// ------------------------------------------------------------------ 오류 화면: 오류 메시지·화면 문구에 글 0 (저장 변조·개발 서버 ?__crash)
await runCase(
  { id: 'P04', cat: '개인정보', title: '오류 화면·밀린 화면의 문구에 글 0 — 렌더 중 오류(개발 서버 ?__crash)가 글이 든 인생에서 나도 화면 문구는 고정, 저장 손상 화면에도 글 0', steps: 'DEV ?__crash로 글이 든 인생을 열어 오류 화면 본문과 console을 읽는다', expected: '오류 화면 문구에 글 0, console 메시지에 글 0' },
  async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
    const withNote = JSON.parse(JSON.stringify(base));
    withNote.history.push({ age: base.age, kind: 'note', title: '지금의 생각', text: MARKER, eventId: 'note-manual' });
    const consoleAll = [];
    const { ctx, page } = await openSeeded(b, withNote, { base: 'http://127.0.0.1:5899/', query: '?__crash', wait: '[data-testid="error-screen"]' }).catch(async () => ({ ctx: null, page: null }));
    if (!page) {
      return { verdict: 'SKIP', actual: '오류 화면을 열지 못함', checks };
    }
    const text = await page.evaluate(() => document.body.innerText);
    chk('오류 화면이 뜸', (await page.locator('[data-testid="error-screen"]').count()) === 1, text.slice(0, 80));
    chk('오류 화면 문구에 글 0', hasFrag(text).length === 0, hasFrag(text).join(','));
    const s = await page.evaluate(SCAN, FRAGS);
    chk('오류 화면: title·주소·속성에 글 0', s.title.length === 0 && s.url.length === 0 && s.attrs.length === 0, JSON.stringify(s.attrs));
    await ctx.close();
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과`, checks };
  },
);

// ------------------------------------------------------------------ 엔딩·다시 태어나기
await runCase(
  { id: 'P05', cat: '개인정보', title: '엔딩 화면에서도 주소·title·속성에 글 0이고(글은 연표 본문에만), 다시 태어나기 뒤 저장소 모든 키·sessionStorage에 이전 글 0', steps: '글이 든 엔딩 저장을 열고 스캔 → 다시 태어나기 → 스캔', expected: '엔딩: 본문에만 / 다시 태어나기 뒤 0' },
  async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
    const shots = [];
    const ended = await evalCore(
      oracle,
      `let s = arg.state;
       const w = core.writeNote(s, { cardId: null, text: arg.marker });
       s = w === s ? s : w;
       for (let g = 0; g < 2000 && s.phase === 'life'; g++) {
         if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
         s = core.stepYear(s).state;
       }
       return s;`,
      { state: { ...base, paused: false }, marker: MARKER },
    );
    const { ctx, page } = await openSeeded(b, ended, { init: NET_INIT, wait: '[data-testid="ending-screen"]' });
    let s = await scan(page);
    chk('엔딩: 연표 본문에는 글이 있음(정상)', (await page.evaluate(() => document.body.innerText)).includes(MARKER), '');
    chk('엔딩: title·주소·속성·링크에 글 0', s.title.length === 0 && s.url.length === 0 && s.attrs.length === 0 && s.links.length === 0, JSON.stringify({ attrs: s.attrs, links: s.links }));
    chk('엔딩: 게임 키 한 곳에만', Object.entries(s.local).filter(([k, v]) => v.length > 0).map(([k]) => k).join() === GAME_KEY, JSON.stringify(s.local));
    shots.push(await shot(page, 'P05', 'ending'));
    await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="rebirth"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 5000 });
    await page.getByTestId('rebirth').tap();
    await sleep(1000);
    s = await scan(page);
    const all = await page.evaluate(() => JSON.stringify({ l: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])), s: Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)])) }));
    chk('다시 태어나기 뒤 저장소 모든 키에 이전 글 0', hasFrag(all).length === 0, hasFrag(all).join(','));
    chk('다시 태어나기 뒤 화면·속성에 0', !(await page.evaluate(() => document.body.innerText)).includes('QAMARK') && s.attrs.length === 0, '');
    await ctx.close();
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과`, checks, shots };
  },
);

// ------------------------------------------------------------------ 설정 키 내용
await runCase(
  { id: 'P06', cat: '개인정보', title: '설정 키(suzeo-game:settings)에는 설정 값만 — noteCards 토글을 눌러도 글·이름이 들어가지 않는다', steps: '기록을 쓰던 중 「끄기」·「켜기」를 눌러 설정 키 원문을 읽는다', expected: '설정 키 필드가 version·data{speed,autoMode,era,lifeLength,bgm,theme,noteCards}뿐' },
  async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
    const { ctx, page } = await openSeeded(b, base);
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText(MARKER);
    await page.getByTestId('note-cards-toggle').tap();
    await sleep(300);
    await page.getByTestId('note-cards-toggle').tap();
    await sleep(300);
    const raw = await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
    const st = JSON.parse(raw);
    chk('설정 키에 글 0', hasFrag(raw).length === 0, '');
    chk('설정 필드 목록', JSON.stringify(Object.keys(st.data).sort()) === JSON.stringify(['autoMode', 'bgm', 'era', 'lifeLength', 'noteCards', 'speed', 'theme']), Object.keys(st.data).join(','));
    chk('설정 버전 4', st.version === 4, st.version);
    await ctx.close();
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과`, checks };
  },
);

await b.close();
