/**
 * SPEC-009 「시대의 창」 5차 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/ (designer 2026-10-28, r5).
 * 실행: node scripts/design/shootEraWindowR5.mjs            ← 캡처(시트 여러 장 + 띠 1장) + 검사
 *   시트는 먼저 `node scripts/design/buildEraWindowR5.mjs`. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG — 마스터 허용 · 시트 q72, 띠 q80):
 *   era-r5-sheet.jpg, era-r5-sheet-2.jpg, … — 1280 PC · 시트 전체를 세로 8000px 이하로 나눠 저장(10년대 그리드 4 + 변주 4쌍 + 확대 9 + 띠 51 + R-553 비교 + 표 + 물음)
 *   era-r5-strip-360.jpg — 360 휴대폰 · 쉰한 장을 띠 크기(100×80)로 라이트·다크 + 계층 변주 여덟 장(360 폭) + R-553 카드 모형 셋(360) + 2014 확대
 * 검사: 가로 넘침 0(1280·360·320 글자 200%·1280 글자 200%·768·다크·강제 색상), 본 그림 43(승인된 1995·1998 포함)·무거운 장면 9·변주 8(아래 4·위 4)·확대 9·띠 51, PC 칸 175×140·확대 350×280·휴대폰 100×80,
 *   캡션(해·이름·종류·그리는 것·유지선), 심볼 참조가 실제로 그려지는지(use 요소의 렌더 상자 > 0), R-553 모형 셋(띠 높이 80/80/104 · A 바탕 = 카드 바탕), 외부 요청 0, 글자 ≥ 12px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r5.html';
const OUT = ROOT + 'docs/design/screens/009/';
const TMP = ROOT + '.taste-skill/009/era-r5-shoot/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);
const EXPECT = { figs: 51, heavy: 10, variants: 8, zooms: 9, strips: 51, approved: 2, r553: 3 }; // figs 51 = 그리드 43(승인 2 포함) + 변주 8 · heavy 10 = 새 9 + 승인된 1995
const MAX_PART = 8000;

async function open({ q = '', view, dpr = 1, dark = false, forced = false, text }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: dpr, colorScheme: dark ? 'dark' : 'light', forcedColors: forced ? 'active' : 'none' });
  const page = await ctx.newPage();
  page.on('request', (r) => { if (!r.url().startsWith('file:')) external.add(r.url()); });
  await page.goto(`${URL_}${q ? `?${q}` : ''}`);
  if (text !== undefined) await page.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return { ctx, page };
}
const overflowReport = (page) =>
  page.evaluate(() => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) out.push(`문서 가로 넘침 ${de.scrollWidth} > ${de.clientWidth}`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
      if (/(auto|scroll)/.test(cs.overflowX) || /hidden/.test(cs.overflow) || el.closest('.ew__tablewrap')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
const measure = (page) =>
  page.evaluate(() => {
    const sz = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const grids = [...document.querySelectorAll('.ew__grid')];
    const figs = grids.flatMap((g) => [...g.querySelectorAll('.ew__fig')]);
    const vars = [...document.querySelectorAll('.ew__pair .ew__fig')];
    const zooms = [...document.querySelectorAll('.ew__zoom .ew__fig')];
    const strips = [...document.querySelectorAll('.ew__strip .ew__fig')];
    const useBoxes = [...document.querySelectorAll('.ew__zoom use')].slice(0, 60).map((u) => { try { const b = u.getBBox(); return b.width * b.height; } catch { return 0; } });
    const all = [...figs, ...vars];
    const r553 = [...document.querySelectorAll('.r553')].map((m) => { const era = m.querySelector('.r553__era'); return { h: Math.round(era.getBoundingClientRect().height), bg: getComputedStyle(era).backgroundColor, card: getComputedStyle(m).backgroundColor, pic: sz(era.querySelector('.era__pic')) }; });
    return {
      figs: all.length, heavy: all.filter((f) => f.dataset.heavy === 'true').length, variants: vars.length, low: vars.filter((f) => f.dataset.band === 'low').length, high: vars.filter((f) => f.dataset.band === 'high').length, approved: all.filter((f) => f.dataset.approved === 'true').length, zooms: zooms.length, strips: strips.length,
      picPc: figs[0] && sz(figs[0].querySelector('.ew__pic')), picZoom: zooms[0] && sz(zooms[0].querySelector('.ew__pic')), picStrip: strips[0] && sz(strips[0].querySelector('.ew__pic')),
      caps: all.map((f) => ({ year: f.querySelector('.ew__year')?.textContent, name: f.querySelector('.ew__name')?.textContent, kind: f.querySelector('.ew__kind')?.textContent, draws: f.querySelector('.ew__draws')?.textContent, ft3: f.querySelector('.ew__ft3')?.textContent, heavy: f.querySelector('.ew__heavy')?.textContent || '', band: f.querySelector('.ew__band')?.textContent || '' })),
      useCount: document.querySelectorAll('.ew__grid use, .ew__pair use').length, useEmpty: useBoxes.filter((a) => !(a > 0)).length, useChecked: useBoxes.length,
      filter90: figs[0] && getComputedStyle(figs[0].querySelector('svg')).filter, filter2010: zooms[4] && getComputedStyle(zooms[4].querySelector('svg')).filter,
      r553,
      fontPx: [...new Set([...document.querySelectorAll('.ew__cap *, .ew__note, .ew__lead, .ew td, .ew th, .ew__pairhead, .r553__cap, .r553__line, .ew__ask li')].map((el) => parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b),
      height: document.documentElement.scrollHeight,
    };
  });
async function check(page, label) {
  const over = await overflowReport(page);
  if (over.length) problems.push(`${label}: ${over.join(' | ')}`);
  const m = await measure(page);
  if (m.figs !== EXPECT.figs) problems.push(`${label}: 본 그림 ${m.figs}장(${EXPECT.figs} 기대)`);
  if (m.heavy !== EXPECT.heavy) problems.push(`${label}: 무거운 장면 ${m.heavy}(${EXPECT.heavy} 기대)`);
  if (m.variants !== EXPECT.variants || m.low !== 4 || m.high !== 4) problems.push(`${label}: 계층 변주 ${m.variants}(아래 ${m.low} 위 ${m.high})`);
  if (m.approved !== EXPECT.approved) problems.push(`${label}: 승인된 r3 그림 ${m.approved}(${EXPECT.approved} 기대)`);
  if (m.zooms !== EXPECT.zooms) problems.push(`${label}: 확대 ${m.zooms}(${EXPECT.zooms} 기대)`);
  if (m.strips !== EXPECT.strips) problems.push(`${label}: 띠 ${m.strips}장(${EXPECT.strips} 기대)`);
  for (const c of m.caps) if (!c.year || !c.name || !c.kind || !c.draws || !c.ft3) problems.push(`${label}: 캡션 빠짐 ${JSON.stringify(c)}`);
  if (m.caps.filter((c) => c.band).length !== 8) problems.push(`${label}: 수저 구간 표시 ${m.caps.filter((c) => c.band).length}(8 기대)`);
  if (m.useEmpty) problems.push(`${label}: 그려지지 않은 use ${m.useEmpty}/${m.useChecked}`);
  if (m.fontPx[0] < 12) problems.push(`${label}: 글자 ${m.fontPx[0]}px < 12`);
  if (m.r553.length !== EXPECT.r553) problems.push(`${label}: R-553 모형 ${m.r553.length}(3 기대)`);
  else {
    if (m.r553[0].h !== 80 || m.r553[1].h !== 80 || m.r553[2].h !== 104) problems.push(`${label}: R-553 띠 높이 ${m.r553.map((r) => r.h).join('/')}(80/80/104 기대)`);
    if (!label.includes('forced')) { // 강제 색상은 바탕이 모두 Canvas라 대조 검사를 건너뛴다(테두리 1px CanvasText로 구분)
      if (m.r553[1].bg !== m.r553[1].card) problems.push(`${label}: R-553 A 띠 바탕 ${m.r553[1].bg} ≠ 카드 ${m.r553[1].card}`);
      if (m.r553[0].bg === m.r553[0].card) problems.push(`${label}: R-553 지금 띠 바탕이 카드와 같다(대조 불가)`);
    }
  }
  return m;
}
function saved(file, limit = 300) {
  const size = kb(file);
  if (size > limit) problems.push(`${file}: ${size} KB > ${limit} KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
async function composite(outFile, items, title, { width = 1120 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = items.map(([f, cap, w]) => `<figure${w ? ` style="width:${w}px"` : ''}><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt=""${w ? ` style="width:${w}px"` : ''}><figcaption>${cap}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0;flex:none;min-width:0}img{display:block;height:auto;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.screenshot({ path: outFile, fullPage: true, type: 'jpeg', quality: 76 });
  saved(outFile, 1500);
  await ctx.close();
}

// ① 1280 PC — 시트 전체를 8000px 이하로 나눠 저장
{
  const { ctx, page } = await open({ view: { width: 1280, height: 800 } });
  const m = await check(page, 'sheet-1280');
  if (!m.picPc || m.picPc[0] !== 175 || m.picPc[1] !== 140) problems.push(`PC 칸 ${m.picPc}(175×140 기대)`);
  if (!m.picZoom || m.picZoom[0] !== 350 || m.picZoom[1] !== 280) problems.push(`확대 ${m.picZoom}(350×280 기대)`);
  if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`띠 그림 ${m.picStrip}(100×80 기대)`);
  notes.push(`sheet-1280: 높이 ${m.height} · 본 ${m.figs}(무거움 ${m.heavy} · 변주 ${m.variants} · 승인 ${m.approved}) · 확대 ${m.zooms} · 띠 ${m.strips} · PC 칸 ${m.picPc} · 확대 ${m.picZoom} · 띠 ${m.picStrip} · use ${m.useCount}(검사 ${m.useChecked}, 빈 것 ${m.useEmpty}) · 1990 필터 「${m.filter90}」 · 2010 필터 「${m.filter2010}」 · R-553 ${JSON.stringify(m.r553)} · 글자 px ${m.fontPx.join('/')}`);
  const parts = Math.ceil(m.height / MAX_PART);
  for (let i = 0; i < parts; i++) {
    const file = `${OUT}era-r5-sheet${i ? `-${i + 1}` : ''}.jpg`;
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72, clip: { x: 0, y: i * MAX_PART, width: 1280, height: Math.min(MAX_PART, m.height - i * MAX_PART) } });
    saved(file, 1500);
  }
  for (let i = parts; i < 8; i++) { const f = `${OUT}era-r5-sheet-${i + 1}.jpg`; if (existsSync(f)) unlinkSync(f); }
  notes.push(`sheet parts: ${parts}`);
  await ctx.close();
}
// ② 360 휴대폰 — 띠 크기 쉰한 장 라이트·다크 + 변주 여덟 장 + R-553 모형 + 2014 확대
{
  const items = [];
  for (const [label, opt, cap] of [['light', { dpr: 2 }, '라이트 · 쉰한 장을 띠 크기(100×80)로 — 1990년대 컬러 → 2000년대 디지털, 군중·바다·골목이 이 크기에서 읽히는지'], ['dark', { dpr: 2, dark: true }, '다크(토큰만 바뀌고 1990년대~ 필터 없음) · 같은 띠']]) {
    const { ctx, page } = await open({ q: opt.dark ? 'theme=dark' : '', view: { width: 360, height: 740 }, ...opt });
    const m = await check(page, `strip-360-${label}`);
    if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`strip-360-${label}: 띠 그림 ${m.picStrip}(100×80 기대)`);
    notes.push(`strip-360-${label}: 띠 그림 ${m.picStrip} · PC 칸(360에서) ${m.picPc} · R-553 ${m.r553.map((r) => `${r.h}/${r.pic.join('x')}`).join(' ')}`);
    const f1 = `${TMP}strip-${label}.png`;
    await page.locator('.ew__strip').screenshot({ path: f1 });
    items.push([f1, cap, 360]);
    if (label === 'light') {
      const f2 = `${TMP}pairs-${label}.png`; await page.locator('.ew__pairs').screenshot({ path: f2 }); items.push([f2, '계층 변주 여덟 장(360 폭 · 그림 175×140) — 1990년대 옥탑방 / 신도시 거실 · 2000년대 고시원 / 학원가 · 2010년대 원룸 / 출국장 · 2020년대 물류센터 / 고층 거실', 360]);
      const f4 = `${TMP}r553-${label}.png`; await page.locator('.r553s').screenshot({ path: f4 }); items.push([f4, 'R-553 — 360 카드 모형 셋: 지금(띠 바탕 --c-surface-2) · A 추천(카드 바탕과 같게) · B 띠 104px', 360]);
      const f3 = `${TMP}zoom-2014.png`; await page.locator('.ew__zoom .ew__fig[data-era="era-2014-tilted-ferry-ribbons"] .ew__pic').screenshot({ path: f3 }); items.push([f3, '2014년 4월 — 크게 보기(350×280 · 휴대폰 폭에서는 326으로 줄어든다)', 360]);
    } else {
      const f5 = `${TMP}r553-${label}.png`; await page.locator('.r553s').screenshot({ path: f5 }); items.push([f5, 'R-553 — 다크에서 같은 셋', 360]);
    }
    await ctx.close();
  }
  await composite(`${OUT}era-r5-strip-360.jpg`, items, '시대의 창 5차 — 360×740 휴대폰 · 띠 크기(FM2d 80px) 라이트·다크 · 계층 변주 · R-553 비교 · 2014 크게 (시안 · 승인 전)', { width: 1180 });
}
// ③ 검사만
for (const [label, q, view, opt] of [
  ['sheet-320-text200', '', { width: 320, height: 640 }, { text: 200 }],
  ['sheet-1280-text200', '', { width: 1280, height: 800 }, { text: 200 }],
  ['sheet-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }],
  ['sheet-forced-1280', '', { width: 1280, height: 800 }, { forced: true }],
  ['sheet-forced-360', '', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
  ['sheet-768', '', { width: 768, height: 1024 }, {}],
]) { const { ctx, page } = await open({ q, view, ...opt }); await check(page, label); await page.screenshot({ path: `${TMP}${label}.png`, fullPage: true }); await ctx.close(); }
await browser.close();

console.log('\n--- 측정 ---');
for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('\n외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('\n문제 0');
