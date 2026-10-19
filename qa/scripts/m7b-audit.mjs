// QA-003 M7b 레이아웃·접근성 감사 (카드 상태 × 공통 뷰포트 11종 × 글자 크기). 상태 = 시트(수동) · 접힌 띠 · 인라인(자동).
// 측정(독립): 가로 넘침, 카드 안 글 낱말 끊김(WB_AUDIT), 줄 끝·첫머리 구분 기호, 시트 스크롤로 선택지·안내·접기 버튼에 닿는가, Tab 순회에서 가려진 포커스(elementFromPoint)·화면 밖 포커스.
// 사용: node qa/scripts/m7b-audit.mjs <cards,comma> [fonts=100,200] [workers=3] [modes=sheet,fold,inline]
// 상태 파일 = qa/results/m7b/states/<이름>.json (m7b-states.mjs). 결과: qa/results/m7b/audit.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, GAME_KEY, SETTINGS_KEY, setRootFont, settingsEnvelope, SET_MANUAL, SET_AUTO } from './m7b-lib.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';

const cards = (process.argv[2] || 'tutoring-present').split(',');
const fonts = (process.argv[3] || '100,200').split(',').map(Number);
const workers = Number(process.argv[4] || 3);
const modes = (process.argv[5] || 'sheet,fold,inline').split(',');
const STATES = path.join(OUT, 'states');
const outFile = path.join(OUT, process.env.AUDIT_OUT || 'audit.jsonl');

export const VPS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x568', width: 360, height: 568 },
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812 },
  { name: '667x375-landscape', width: 667, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x620', width: 1280, height: 620 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '640x400-zoom200', width: 640, height: 400 },
  { name: '320x256-zoom400', width: 320, height: 256 },
];

/** 가려진 탭처럼 보이게(앱 타이머·자동 선택을 멈춰 화면을 안정시킨다) */
const HIDDEN_INIT = () => {
  window.__vis = 'hidden';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
};

const VIS_INIT = () => {
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
};

export async function openCard(browser, name, mode, { vp, font = 100, ctxOpts = {}, theme = 'system', hidden = true, vishook = false, settingsOverride = null }) {
  const opts = { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), ...ctxOpts };
  const ctx = await mkctx(browser, opts);
  const raw = JSON.stringify({ version: 8, data: JSON.parse(fs.readFileSync(path.join(STATES, `${name}.json`), 'utf8')) });
  const settings = settingsEnvelope({ ...(mode === 'inline' ? SET_AUTO : SET_MANUAL), theme, ...(settingsOverride || {}) });
  await ctx.addInitScript(
    ([k, v, sk, sv]) => {
      try {
        if (!sessionStorage.getItem('__qa_seeded')) {
          localStorage.clear();
          localStorage.setItem(k, v);
          localStorage.setItem(sk, sv);
          sessionStorage.setItem('__qa_seeded', '1');
        }
      } catch {}
    },
    [GAME_KEY, raw, SETTINGS_KEY, settings],
  );
  if (hidden) await ctx.addInitScript(HIDDEN_INIT);
  else if (vishook) await ctx.addInitScript(VIS_INIT);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid="decision-fold-btn"]');
    return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
  }, null, { timeout: 8000 }).catch(() => {});
  if (mode === 'fold') {
    await page.getByTestId('decision-fold-btn').click();
    await page.waitForSelector('[data-testid="decision-fold"]', { timeout: 4000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-testid="decision-reopen"]');
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    }, null, { timeout: 4000 }).catch(() => {});
  }
  await sleep(250);
  if (font !== 100) await setRootFont(page, font);
  await sleep(250);
  return { ctx, page };
}

const SCOPE_CLASS = /(decision|cite|choice|fold|impact|sheet|overlay)/;

/** 카드(시트·인라인·접힌 띠) 안의 가로 넘침·잘린 글·시트 스크롤 도달 */
export const CARD_MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const root = document.documentElement;
  const panel = document.querySelector('[data-testid="choice-panel"]') || document.querySelector('[data-testid="decision-fold"]');
  const out = { docOverflow: root.scrollWidth - root.clientWidth, over: [], clipped: [], panelRect: null, sheet: null, scrollCue: null };
  if (!panel) return { ...out, noPanel: true };
  const pr = panel.getBoundingClientRect();
  out.panelRect = { l: Math.round(pr.left), r: Math.round(pr.right), t: Math.round(pr.top), b: Math.round(pr.bottom), w: Math.round(pr.width), h: Math.round(pr.height) };
  for (const e of panel.querySelectorAll('*')) {
    if (e.closest('.sr-only') || e.classList.contains('sr-only')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.right > pr.right + 1 || r.left < pr.left - 1) out.over.push(`${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''} ${Math.round(r.left)}~${Math.round(r.right)} (카드 ${Math.round(pr.left)}~${Math.round(pr.right)})`);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') out.clipped.push(`${typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName} ${e.scrollWidth}>${e.clientWidth}`);
  }
  const sheet = document.querySelector('.sheet');
  if (sheet) {
    const sr = sheet.getBoundingClientRect();
    const cs = getComputedStyle(sheet);
    out.sheet = { scrollH: sheet.scrollHeight, clientH: sheet.clientHeight, canScroll: sheet.scrollHeight > sheet.clientHeight + 1, overflowY: cs.overflowY, top: Math.round(sr.top), bottom: Math.round(sr.bottom), vh };
    // 맨 위에서 보이는 가장 아래 요소가 잘려 있는가(스크롤 단서)
    sheet.scrollTop = 0;
    const kids = [...sheet.querySelectorAll('.decision__title, .decision__text, .cite, .choice, .decision__hint, .decision__auto')];
    const cut = kids.filter((k) => {
      const r = k.getBoundingClientRect();
      return r.top < sr.bottom - 1 && r.bottom > sr.bottom + 1;
    }).map((k) => (k.getAttribute('data-testid') || k.className.split(' ')[0]) + ' 아래 잘림');
    const hiddenBelow = kids.filter((k) => k.getBoundingClientRect().top >= sr.bottom - 1).map((k) => k.getAttribute('data-testid') || k.className.split(' ')[0]);
    out.scrollCue = { cut, hiddenBelow, hasMask: cs.maskImage !== 'none' || cs.webkitMaskImage !== 'none' };
    // 끝까지 스크롤하면 마지막 요소(안내·마지막 선택지)가 시트 안에 온전히 들어오는가
    sheet.scrollTop = sheet.scrollHeight;
    const last = sheet.querySelector('.decision__auto');
    const lastChoice = [...sheet.querySelectorAll('.choice')].pop();
    const R = (e) => (e ? e.getBoundingClientRect() : null);
    const la = R(last);
    const lc = R(lastChoice);
    out.sheet.reach = {
      autoNoteInside: la ? la.bottom <= sr.bottom + 1 && la.bottom <= vh + 1 : null,
      lastChoiceInside: lc ? lc.top >= sr.top - 1 && lc.bottom <= sr.bottom + 1 : null,
      autoNoteBottomGap: la ? Math.round(sr.bottom - la.bottom) : null,
    };
    sheet.scrollTop = 0;
    const fold = R(sheet.querySelector('[data-testid="decision-fold-btn"]'));
    out.sheet.foldBtnAtTop = fold ? fold.top >= sr.top - 1 && fold.bottom <= sr.bottom + 1 : null;
  }
  return out;
};

/** 카드 영역 줄 끝·첫머리의 구분 기호(·, —, /) */
export const SEP_AUDIT = () => {
  const panel = document.querySelector('[data-testid="choice-panel"]') || document.querySelector('[data-testid="decision-fold"]');
  if (!panel) return { bad: [] };
  const bad = [];
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  let n;
  const SEP = /[·—/]/;
  while ((n = walker.nextNode())) {
    const pe = n.parentElement;
    if (!pe || pe.closest('.sr-only') || pe.closest('[aria-hidden="true"]')) continue;
    const s = n.textContent;
    for (let i = 0; i < s.length; i++) {
      if (!SEP.test(s[i])) continue;
      const rg = document.createRange();
      rg.setStart(n, i);
      rg.setEnd(n, i + 1);
      const rs = rg.getClientRects();
      if (!rs.length) continue;
      const r = rs[0];
      // 앞 글자·뒤 글자(같은 텍스트 노드 안, 공백 제외)가 다른 줄에 있는가
      const nb = (j) => {
        if (j < 0 || j >= s.length || /\s/.test(s[j])) return null;
        const g = document.createRange();
        g.setStart(n, j);
        g.setEnd(n, j + 1);
        const q = g.getClientRects();
        return q.length ? q[0] : null;
      };
      const prev = nb(i - 1);
      const next = nb(i + 1);
      const diff = (a, b) => a && b && Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) > 0.5 * Math.max(a.height, b.height);
      if (next && diff(r, next)) bad.push(`줄 끝 「${s.slice(Math.max(0, i - 4), i + 1)}」`);
      if (prev && diff(r, prev)) bad.push(`줄 첫머리 「${s.slice(i, i + 5)}」`);
    }
  }
  return { bad };
};

const TAGS = () => {
  let n = 0;
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]')) {
    if (e.getAttribute('tabindex') === '-1' || e.disabled) continue;
    if (e.closest('[inert]')) continue;
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2) continue;
    e.setAttribute('data-qa-i', String(n));
    out.push({ i: n, id: e.getAttribute('data-testid') || (e.textContent || '').trim().slice(0, 10) || e.tagName });
    n++;
  }
  return out;
};

const FOCUS_MEASURE = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return { none: true };
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const r = a.getBoundingClientRect();
  const dialog = a.closest('[role="dialog"]');
  // 보이는 부분(시트·스크롤 영역 안쪽만)
  let vis = { l: Math.max(r.left, 0), t: Math.max(r.top, 0), r: Math.min(r.right, vw), b: Math.min(r.bottom, vh) };
  for (let x = a.parentElement; x && x !== document.body; x = x.parentElement) {
    const cs = getComputedStyle(x);
    if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
    const b = x.getBoundingClientRect();
    vis = { l: Math.max(vis.l, b.left), t: Math.max(vis.t, b.top), r: Math.min(vis.r, b.right), b: Math.min(vis.b, b.bottom) };
  }
  const fullyVisible = vis.t <= r.top + 1 && vis.b >= r.bottom - 1 && vis.l <= r.left + 1 && vis.r >= r.right - 1;
  const tallerThanView = r.height > vh * 0.8;
  const pts = [];
  if (vis.r - vis.l > 2 && vis.b - vis.t > 2) {
    const mx = (vis.l + vis.r) / 2;
    const my = (vis.t + vis.b) / 2;
    pts.push([mx, my], [vis.l + 3, vis.t + 3], [vis.r - 3, vis.t + 3], [vis.l + 3, vis.b - 3], [vis.r - 3, vis.b - 3]);
  }
  let covered = 0;
  const coverers = [];
  for (const [x, y] of pts) {
    const el = document.elementFromPoint(Math.min(Math.max(x, 0), vw - 1), Math.min(Math.max(y, 0), vh - 1));
    if (!el || !(a === el || a.contains(el) || el.contains(a))) {
      covered++;
      if (el) coverers.push((el.getAttribute('data-testid') || (typeof el.className === 'string' ? el.className.split(' ')[0] : '') || el.tagName));
    }
  }
  return {
    id: a.getAttribute('data-testid') || (a.getAttribute('data-speed') ? 'speed-' + a.getAttribute('data-speed') : (a.textContent || '').trim().slice(0, 10) || a.tagName),
    qi: a.getAttribute('data-qa-i'),
    inDialog: !!dialog,
    fullyVisible,
    tallerThanView,
    covered,
    npts: pts.length,
    coverers: [...new Set(coverers)].slice(0, 3),
    rectT: Math.round(r.top),
    rectB: Math.round(r.bottom),
    offscreen: r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw,
  };
};

export async function job(browser, j) {
  const { ctx, page } = await openCard(browser, j.card, j.mode, { vp: j.vp, font: j.font });
  const m = await page.evaluate(CARD_MEASURE);
  // 낱말 끊김은 카드 영역 안 낱말만: 시트는 맨 위 → 맨 아래 두 위치에서
  const wbAll = { broken: [], unavoidable: [], wordsN: 0 };
  const positions = j.mode === 'sheet' ? await page.evaluate(() => { const sh = document.querySelector('.sheet'); const step = Math.max(40, sh.clientHeight * 0.6); const n = Math.ceil(sh.scrollHeight / step) + 1; return Array.from({ length: n }, (_, i) => Math.min(sh.scrollHeight, Math.round(i * step))); }) : [null];
  const seen = new Set();
  let sep = [];
  for (const pos of positions) {
    if (pos !== null) await page.evaluate((p) => { document.querySelector('.sheet').scrollTop = p; }, pos);
    await sleep(80);
    const wb = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
    wbAll.wordsN = Math.max(wbAll.wordsN, wb.wordsN);
    for (const b of wb.broken) if (SCOPE_CLASS.test(b.where) && !seen.has(b.word + b.where)) { seen.add(b.word + b.where); wbAll.broken.push(b); }
    for (const b of wb.unavoidable) if (SCOPE_CLASS.test(b.where) && !seen.has(b.word + b.where)) { seen.add(b.word + b.where); wbAll.unavoidable.push(b); }
    const s = await page.evaluate(SEP_AUDIT);
    sep = sep.concat(s.bad);
  }
  // Tab 순회
  const rec = { fwd: [], issues: [], interactive: 0, reached: 0, missing: [], leak: [] };
  if (j.focus) {
    const inter = await page.evaluate(TAGS);
    rec.interactive = inter.length;
    await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
    await sleep(100);
    const reached = new Set();
    let nones = 0;
    for (let i = 0; i < inter.length * 2 + 6; i++) {
      await page.keyboard.press('Tab');
      await sleep(55);
      const f = await page.evaluate(FOCUS_MEASURE);
      if (f.none) {
        nones++;
        rec.fwd.push('(문서 밖/본문)');
        if (nones >= 2) break;
        continue;
      }
      rec.fwd.push(f.id);
      if (f.qi !== null) reached.add(Number(f.qi));
      if (j.mode === 'sheet' && !f.inDialog) rec.leak.push(f.id);
      if (f.offscreen || f.covered > 0 || (!f.fullyVisible && !f.tallerThanView)) rec.issues.push(f);
      if (reached.size >= inter.length && i >= inter.length) break;
    }
    rec.reached = reached.size;
    rec.missing = inter.filter((x) => !reached.has(x.i)).map((x) => x.id);
  }
  const shotName = j.shot ? path.join(OUT, '..', '..', 'screenshots', '003', `M7b-${j.shot}.png`) : null;
  if (shotName) await page.screenshot({ path: shotName });
  await ctx.close();
  return { m, wb: wbAll, sep, tab: rec };
}

if (process.argv[1] && process.argv[1].endsWith('m7b-audit.mjs')) {
  if (!process.env.QA_APPEND) fs.writeFileSync(outFile, '');
  const browser = await launch();
  const jobs = [];
  for (const card of cards) for (const mode of modes) for (const vp of VPS) for (const font of fonts) {
    if (vp.name === '320x256-zoom400' && font === 200) continue;
    jobs.push({ card, mode, vp, font, focus: font === 100 || font === 200 });
  }
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      let rec = { card: j.card, mode: j.mode, vp: j.vp.name, font: j.font };
      try {
        rec = { ...rec, ...(await job(browser, j)) };
      } catch (e) {
        rec.err = String(e.message).slice(0, 200);
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
      done++;
      if (done % 20 === 0) console.log(`${done}/${jobs.length}`);
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  await browser.close();
  console.log('DONE', done);
}
