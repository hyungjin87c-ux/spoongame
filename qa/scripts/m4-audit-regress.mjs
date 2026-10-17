// QA-003 M4 회귀 감사: M4가 공용 CSS·훅을 건드렸으므로 M2·M3 화면(첫 화면 3상태·룰렛 결과·출생신고)을 같은 감사로 다시 돈다.
// 11뷰포트 × 글자 100·150·200% — 가로 넘침(CM11)·낱말 끊김(QM3-1)·h1(QM3-2)·구분 기호·고정 요소 포커스(CM10: Tab 순회, 글자 100·200%).
// 사용: node qa/scripts/m4-audit-regress.mjs   결과: qa/results/m4/audit-regress.jsonl + 케이스 M4-R02(레이아웃)·M4-R03(포커스)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, waitGuard, sleep, setRootFont, OUT, CASES, PROD, GAME_KEY } from './m4-lib.mjs';
import { VPS, loadSave } from './m4-states.mjs';
import { WB_AUDIT, H1_AUDIT } from './m3r2-wb.mjs';

const outFile = path.join(OUT, 'audit-regress.jsonl');
fs.writeFileSync(outFile, '');
const STATES = ['title-new', 'title-resume', 'title-confirm', 'roulette-result', 'birth'];
const FONTS = [100, 150, 200];

async function open(browser, state, vp, font) {
  const base = { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) };
  const ctx = await mkctx(browser, base);
  await fixSeed(ctx, 229);
  if (state === 'title-resume' || state === 'title-confirm') {
    await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, loadSave('present', 'age10')]);
  } else {
    await cleanStorageOnce(ctx);
  }
  const p = await ctx.newPage();
  if (state === 'title-resume' || state === 'title-confirm') {
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="life-screen"]');
    await sleep(500);
    await waitGuard(p, 'tool-exit');
    await p.getByTestId('tool-exit').click();
    await waitGuard(p, 'exit-yes');
    await p.getByTestId('exit-yes').click();
    await p.waitForSelector('[data-testid="resume"]');
    await sleep(500);
    if (state === 'title-confirm') {
      await waitGuard(p, 'begin-new');
      await p.getByTestId('begin-new').click();
      await p.waitForSelector('[data-testid="confirm-new-no"]');
      await sleep(300);
    }
  } else {
    await openTitle(p);
    if (state === 'roulette-result' || state === 'birth') {
      await toRoulette(p);
      await waitGuard(p, 'skip-roulette');
      await p.getByTestId('skip-roulette').click();
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 4000 });
      await sleep(400);
      if (state === 'birth') {
        await waitGuard(p, 'to-birth');
        await p.getByTestId('to-birth').click();
        await p.waitForSelector('[data-testid="birth-screen"]');
        await sleep(400);
      }
    }
  }
  if (font !== 100) await setRootFont(p, font);
  await sleep(250);
  return { ctx, p };
}

const MEASURE = () => {
  const root = document.documentElement;
  const vw = root.clientWidth;
  const over = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.namespaceURI === 'http://www.w3.org/2000/svg' && e.tagName !== 'svg') continue;
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 1.5 || r.height <= 1.5) continue;
    let clipped = false;
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) if (getComputedStyle(x).overflowX !== 'visible') { clipped = true; break; }
    if (clipped) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) over.push(`${e.tagName.toLowerCase()}${e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : ''} ${Math.round(r.left)}~${Math.round(r.right)}`);
  }
  const bar = document.querySelector('[data-testid="bottom-bar"]');
  return { docOverflow: root.scrollWidth - root.clientWidth, over: over.slice(0, 5), bar: bar ? { pos: getComputedStyle(bar).position, h: Math.round(bar.getBoundingClientRect().height) } : null, vh: innerHeight };
};

const TAG_INTERACTIVE = () => {
  let n = 0;
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]')) {
    if (e.getAttribute('tabindex') === '-1' || e.disabled) continue;
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2) continue;
    let hidden = false;
    for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none') hidden = true;
    if (hidden) continue;
    if (e.type === 'radio') {
      const grp = [...document.querySelectorAll('input[type="radio"][name="' + e.name + '"]')].filter((x) => !x.disabled);
      const rep = grp.find((x) => x.checked) || grp[0];
      if (e !== rep) continue;
    }
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
  const cs = getComputedStyle(a);
  const r = a.getBoundingClientRect();
  const ow = cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) || 0 : 0;
  const oo = cs.outlineStyle !== 'none' ? Math.max(parseFloat(cs.outlineOffset) || 0, 0) : 0;
  const g = ow + oo;
  const box = { l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g };
  const fixed = [];
  for (const e of document.body.querySelectorAll('*')) {
    const c = getComputedStyle(e);
    if (c.position !== 'fixed' && c.position !== 'sticky') continue;
    if (c.visibility === 'hidden' || parseFloat(c.opacity) === 0 || c.display === 'none') continue;
    const q = e.getBoundingClientRect();
    if (q.width < 2 || q.height < 2) continue;
    if (c.position === 'sticky' && !(q.top <= 1 || q.bottom >= vh - 1)) continue;
    if (c.pointerEvents === 'none' && e.textContent.trim() === '' && e.children.length === 0) continue;
    if (e.contains(a) || a.contains(e)) continue;
    fixed.push({ el: e.getAttribute('data-testid') || (typeof e.className === 'string' ? e.className.split(' ')[0] : '') || e.tagName, l: q.left, t: q.top, r: q.right, b: q.bottom });
  }
  let overlap = 0;
  const hit = [];
  for (const f of fixed) {
    const w = Math.min(box.r, f.r) - Math.max(box.l, f.l);
    const h = Math.min(box.b, f.b) - Math.max(box.t, f.t);
    if (w > 0.5 && h > 0.5) {
      overlap += w * h;
      hit.push(`${f.el}(${Math.round(f.t)}~${Math.round(f.b)}) vs ${Math.round(box.t)}~${Math.round(box.b)}`);
    }
  }
  const topFix = fixed.filter((f) => f.t <= 1 && f.b < vh * 0.9).reduce((m, f) => Math.max(m, f.b), 0);
  const botFix = fixed.filter((f) => f.b >= vh - 1 && f.t > vh * 0.1).reduce((m, f) => Math.min(m, f.t), vh);
  const tall = r.height > botFix - topFix;
  const outside = !tall ? box.t < -0.5 || box.b > vh + 0.5 || box.l < -0.5 || box.r > vw + 0.5 : box.t < topFix - 0.5 && r.bottom < topFix;
  // 예외 ②(QM2-1 규칙 3): 가용 높이보다 큰 포커스 대상은 위쪽 변과 링이 가용 영역 안에 보이면 통과(겹침은 그 안에서 스크롤로 닿는다)
  const tallOk = tall && box.t >= topFix - 0.5 && r.top + 40 <= botFix;
  if (tallOk) {
    overlap = 0;
    hit.length = 0;
  }
  return { id: a.getAttribute('data-testid') || a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 12) || a.tagName, qi: a.getAttribute('data-qa-i'), overlap: Math.round(overlap), hit, outside, nFixed: fixed.length };
};

const browser = await launch();
const jobs = [];
for (const st of STATES) for (const vp of VPS) for (const font of FONTS) jobs.push({ st, vp, font });
let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    const rec = { state: j.st, vp: j.vp.name, font: j.font };
    try {
      const { ctx, p } = await open(browser, j.st, j.vp, j.font);
      rec.m = await p.evaluate(MEASURE);
      const wb = await p.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
      rec.wb = { wordsN: wb.wordsN, broken: wb.broken, unavoidable: wb.unavoidable, intended: wb.intended.length };
      rec.h1 = await p.evaluate(H1_AUDIT);
      // 포커스 순회(글자 100·200%, 320×256+200%는 제외)
      if ((j.font === 100 || j.font === 200) && !(j.vp.name === '320x256-zoom400' && j.font === 200)) {
        const inter = await p.evaluate(TAG_INTERACTIVE);
        await p.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
        await sleep(80);
        const reached = new Set();
        rec.focus = { interactive: inter.length, steps: 0, issues: [], nFixedMax: 0 };
        for (let dir of ['Tab', 'Shift+Tab']) {
          for (let i = 0; i < inter.length + 6; i++) {
            await p.keyboard.press(dir);
            await sleep(60);
            const m = await p.evaluate(FOCUS_MEASURE);
            if (m.none) break;
            rec.focus.steps++;
            rec.focus.nFixedMax = Math.max(rec.focus.nFixedMax, m.nFixed);
            if (m.qi !== null) reached.add(Number(m.qi));
            if (m.overlap > 0 || m.outside) rec.focus.issues.push({ dir, id: m.id, hit: m.hit, outside: m.outside });
          }
        }
        rec.focus.missing = inter.filter((x) => !reached.has(x.i)).map((x) => x.id);
      }
      await ctx.close();
    } catch (e) {
      rec.err = String(e.message).slice(0, 200);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await browser.close();

const L = fs.readFileSync(outFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const ok = L.filter((r) => !r.err);
const key = (r) => `${r.state}/${r.vp}/${r.font}%`;
const badOver = ok.filter((r) => r.m.docOverflow > 0 || r.m.over.length);
const brokenR = ok.filter((r) => r.wb.broken.length);
const unav100 = ok.filter((r) => r.font === 100 && r.wb.unavoidable.length);
const h1bad = [];
for (const r of ok) for (const h of r.h1.rows) for (const w of h.wrows) if (w.lines !== 1 || w.natural > h.contentW + 0.6) h1bad.push(`${key(r)} h1 「${h.text.slice(0, 14)}」 낱말 「${w.word}」 ${w.lines}줄/${w.natural}>${h.contentW}`);
const words = ok.reduce((s, r) => s + r.wb.wordsN, 0);
const unavTotal = ok.reduce((s, r) => s + r.wb.unavoidable.length, 0);
const intTotal = ok.reduce((s, r) => s + r.wb.intended, 0);
const bad = [];
for (const r of badOver.slice(0, 4)) bad.push(`${key(r)}: 넘침 ${r.m.docOverflow}px ${r.m.over.join(',')}`);
for (const r of brokenR.slice(0, 4)) bad.push(`${key(r)}: 낱말 끊김 ${r.wb.broken.slice(0, 2).map((b) => `${b.word}(${b.shape})`).join(';')}`);
for (const r of unav100.slice(0, 2)) bad.push(`${key(r)}: 글자 100%인데 한 줄보다 긴 낱말 ${r.wb.unavoidable.slice(0, 2).map((b) => b.word)}`);
for (const x of h1bad.slice(0, 3)) bad.push(x);
const rec1 = {
  id: 'M4-R02',
  cat: '회귀',
  title: `M2·M3 화면 회귀 레이아웃 감사(M4가 공용 CSS를 건드렸으므로): 첫 화면 새 판·이어하기·확인 단계·룰렛 결과·출생신고 × 11뷰포트 × 글자 100·150·200% = ${ok.length}조합 — 가로 넘침 0·결함 낱말 끊김 0(QM3-1)·h1 낱말 한 줄(QM3-2)`,
  steps: '대시보드 감사와 같은 측정기로 이전 화면을 다시 측정',
  expected: 'M3 QA 결과(넘침 0·broken 0)와 같다',
  verdict: bad.length || L.some((r) => r.err) ? 'FAIL' : 'PASS',
  severity: '높음',
  actual: (bad.length ? bad.join(' / ') + ` (넘침 ${badOver.length}·끊김 ${brokenR.length}·h1 ${h1bad.length}조합) | ` : '') + `낱말 ${words.toLocaleString()}개 감사, 넘침 ${badOver.length}조합, broken ${brokenR.length}조합, unavoidable ${unavTotal}건(글자 200% 한 줄보다 긴 낱말), intended ${intTotal}건${L.some((r) => r.err) ? `, 측정 오류 ${L.filter((r) => r.err).length}` : ''}`,
  shots: [],
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
const F = ok.filter((r) => r.focus);
const fbad = [];
let steps = 0;
let fixedMax = 0;
for (const r of F) {
  steps += r.focus.steps;
  fixedMax = Math.max(fixedMax, r.focus.nFixedMax);
  if (r.focus.issues.length) fbad.push(`${key(r)}: ${r.focus.issues.slice(0, 2).map((i) => `${i.dir} ${i.id} ${i.hit.join(';') || '화면 밖'}`).join(' / ')}`);
  if (r.focus.missing.length) fbad.push(`${key(r)}: 닿지 못함 ${r.focus.missing}`);
}
const rec2 = {
  id: 'M4-R03',
  cat: '회귀',
  title: `M2·M3 화면 회귀 CM10 포커스 가림 감사: 첫 화면 3상태·룰렛 결과·출생신고 × 11뷰포트 × 글자 100·200% — Tab·Shift+Tab 순회 ${steps}번 측정`,
  steps: '대시보드 감사와 같은 측정기',
  expected: '가려진 포커스 0·닿지 못한 요소 0',
  verdict: fbad.length ? 'FAIL' : 'PASS',
  severity: '높음',
  actual: fbad.length ? fbad.slice(0, 6).join(' / ') + ` (총 ${fbad.length})` : `조합 ${F.length}개 포커스 ${steps}번, 가려진 포커스 0·화면 밖 0·닿지 못한 요소 0 (고정 요소 최대 ${fixedMax}개 수집)`,
  shots: [],
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
for (const rec of [rec1, rec2]) {
  fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
  console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual.slice(0, 1500)}`);
}
