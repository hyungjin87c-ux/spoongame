/**
 * SPEC-009 「시대의 창」 5차b 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/ (designer 2026-11-02, r5b).
 * 실행: node scripts/design/shootEraWindowR5b.mjs            ← 캡처(시트 1~2장 + 띠 1장) + 검사
 *   시트는 먼저 `node scripts/design/buildEraWindowR5b.mjs`. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG — 마스터 허용):
 *   era-r5b-sheet.jpg(, -2) — 1280 PC · 시트 전체를 세로 8000px 이하로 나눠 저장(2009 세 갈래 + 전·후 9 + 확대 11 + 띠 11 + 앞선 네 장 + 표 + 물음)
 *   era-r5b-strip-360.jpg — 360 휴대폰 · 열한 장을 띠 크기(100×80)로 라이트·다크 + 2009 세 갈래(360 폭) + 철거 현장·2022 크게
 * 검사: 가로 넘침 0(1280·360·320 글자 200%·1280 글자 200%·768·다크·강제 색상), 세 갈래 3·전·후 9쌍·확대 11·띠 11·앞선 4, PC 칸 175×140·확대 350×280·휴대폰 100×80,
 *   캡션(해·이름·그리는 것·유지선), use가 실제로 그려지는지, 외부 요청 0, 글자 ≥ 12px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r5b.html';
const OUT = ROOT + 'docs/design/screens/009/';
const TMP = ROOT + '.taste-skill/009/era-r5b-shoot/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);
const EXPECT = { three: 3, pairs: 9, zooms: 11, strips: 11, earlier: 4, heavyAfter: 10 };
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
      if (el.closest('svg') || el.closest('pre')) continue;
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
    const three = [...grids[0].querySelectorAll('.ew__fig')];
    const befores = [...document.querySelectorAll('.ew__ba .ew__fig[data-ba="before"]')];
    const afters = [...document.querySelectorAll('.ew__ba .ew__fig[data-ba="after"]')];
    const zooms = [...document.querySelectorAll('.ew__zoom .ew__fig')];
    const strips = [...document.querySelectorAll('.ew__strip .ew__fig')];
    const earlier = [...document.querySelectorAll('.ew__fig[data-ba="earlier"]')];
    const useBoxes = [...document.querySelectorAll('.ew__zoom use')].slice(0, 80).map((u) => { try { const b = u.getBBox(); return b.width * b.height; } catch { return 0; } });
    const capOf = (f) => ({ year: f.querySelector('.ew__year')?.textContent, name: f.querySelector('.ew__name')?.textContent, draws: f.querySelector('.ew__draws')?.textContent, ft3: f.querySelector('.ew__ft3')?.textContent, heavy: f.querySelector('.ew__heavy')?.textContent || '', band: f.querySelector('.ew__band')?.textContent || '' });
    return {
      three: three.length, threeBands: three.map((f) => f.dataset.band), threeHeavy: three.map((f) => f.dataset.heavy), befores: befores.length, afters: afters.length, heavyAfter: new Set([...three, ...afters].filter((f) => f.dataset.heavy === 'true').map((f) => f.dataset.era)).size, zooms: zooms.length, strips: strips.length, earlier: earlier.length,
      picPc: three[0] && sz(three[0].querySelector('.ew__pic')), picBefore: befores[0] && sz(befores[0].querySelector('.ew__pic')), picZoom: zooms[0] && sz(zooms[0].querySelector('.ew__pic')), picStrip: strips[0] && sz(strips[0].querySelector('.ew__pic')),
      caps: [...three, ...afters].map(capOf), earlierCaps: earlier.map(capOf),
      useCount: document.querySelectorAll('.ew__ba use, .ew__grid use').length, useEmpty: useBoxes.filter((a) => !(a > 0)).length, useChecked: useBoxes.length,
      fontPx: [...new Set([...document.querySelectorAll('.ew__cap *, .ew__note, .ew__lead, .ew td, .ew th, .ew__ask li, .ew__rule li, .ew pre')].map((el) => parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b),
      height: document.documentElement.scrollHeight,
    };
  });
async function check(page, label) {
  const over = await overflowReport(page);
  if (over.length) problems.push(`${label}: ${over.join(' | ')}`);
  const m = await measure(page);
  if (m.three !== EXPECT.three || m.threeBands.join() !== 'low,,high' || m.threeHeavy.join() !== 'true,true,false') problems.push(`${label}: 2009 세 갈래 ${m.three} ${m.threeBands} ${m.threeHeavy}`);
  if (m.befores !== EXPECT.pairs || m.afters !== EXPECT.pairs) problems.push(`${label}: 전·후 ${m.befores}/${m.afters}(${EXPECT.pairs} 기대)`);
  if (m.heavyAfter !== EXPECT.heavyAfter) problems.push(`${label}: 무거운 장면 ${m.heavyAfter}(${EXPECT.heavyAfter} 기대)`);
  if (m.zooms !== EXPECT.zooms) problems.push(`${label}: 확대 ${m.zooms}(${EXPECT.zooms} 기대)`);
  if (m.strips !== EXPECT.strips) problems.push(`${label}: 띠 ${m.strips}장(${EXPECT.strips} 기대)`);
  if (m.earlier !== EXPECT.earlier) problems.push(`${label}: 앞선 네 장 ${m.earlier}`);
  for (const c of m.caps) if (!c.year || !c.name || !c.draws || !c.ft3) problems.push(`${label}: 캡션 빠짐 ${JSON.stringify(c)}`);
  for (const c of m.earlierCaps) if (!c.year || !c.name || !c.draws) problems.push(`${label}: 앞선 장 캡션 빠짐 ${JSON.stringify(c)}`);
  if (m.useEmpty) problems.push(`${label}: 그려지지 않은 use ${m.useEmpty}/${m.useChecked}`);
  if (m.fontPx[0] < 12) problems.push(`${label}: 글자 ${m.fontPx[0]}px < 12`);
  return m;
}
function saved(file, limit = 1500) {
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
  if (!m.picBefore || m.picBefore[0] !== 175 || m.picBefore[1] !== 140) problems.push(`전 칸 ${m.picBefore}(175×140 기대)`);
  if (!m.picZoom || m.picZoom[0] !== 350 || m.picZoom[1] !== 280) problems.push(`확대 ${m.picZoom}(350×280 기대)`);
  if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`띠 그림 ${m.picStrip}(100×80 기대)`);
  notes.push(`sheet-1280: 높이 ${m.height} · 세 갈래 ${m.three}(${m.threeBands.join('/')}) · 전·후 ${m.befores}/${m.afters} · 무거움 ${m.heavyAfter} · 확대 ${m.zooms} · 띠 ${m.strips} · 앞선 ${m.earlier} · PC 칸 ${m.picPc} · 확대 ${m.picZoom} · 띠 ${m.picStrip} · use ${m.useCount}(검사 ${m.useChecked}, 빈 것 ${m.useEmpty}) · 글자 px ${m.fontPx.join('/')}`);
  const parts = Math.ceil(m.height / MAX_PART);
  for (let i = 0; i < parts; i++) {
    const file = `${OUT}era-r5b-sheet${i ? `-${i + 1}` : ''}.jpg`;
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72, clip: { x: 0, y: i * MAX_PART, width: 1280, height: Math.min(MAX_PART, m.height - i * MAX_PART) } });
    saved(file, 1500);
  }
  for (let i = parts; i < 6; i++) { const f = `${OUT}era-r5b-sheet-${i + 1}.jpg`; if (existsSync(f)) unlinkSync(f); }
  notes.push(`sheet parts: ${parts}`);
  await ctx.close();
}
// ② 360 휴대폰 — 띠 크기 열한 장 라이트·다크 + 2009 세 갈래 + 철거 현장·2022 크게
{
  const items = [];
  for (const [label, opt, cap] of [['light', { dpr: 2 }, '라이트 · 열한 장을 띠 크기(100×80)로 — 당긴 거리가 이 크기에서 읽히는지'], ['dark', { dpr: 2, dark: true }, '다크 · 같은 띠']]) {
    const { ctx, page } = await open({ q: opt.dark ? 'theme=dark' : '', view: { width: 360, height: 740 }, ...opt });
    const m = await check(page, `strip-360-${label}`);
    if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`strip-360-${label}: 띠 그림 ${m.picStrip}(100×80 기대)`);
    notes.push(`strip-360-${label}: 띠 그림 ${m.picStrip} · PC 칸(360에서) ${m.picPc}`);
    const f1 = `${TMP}strip-${label}.png`;
    await page.locator('.ew__strip').screenshot({ path: f1 });
    items.push([f1, cap, 360]);
    if (label === 'light') {
      const f2 = `${TMP}three-${label}.png`; await page.locator('.ew__grid').first().screenshot({ path: f2 }); items.push([f2, '2009년 세 갈래(360 폭 · 그림 175×140) — 아래 철거 현장 ○ · 가운데 조문 줄 ○ · 위 첫 스마트폰', 360]);
      const f3 = `${TMP}zoom-demolition.png`; await page.locator('.ew__zoom .ew__fig[data-era="era-2009-demolition-fire"] .ew__pic').screenshot({ path: f3 }); items.push([f3, '2009년 1월 철거 현장 — 크게 보기(350×280 · 휴대폰 폭에서는 326으로 줄어든다)', 360]);
      const f4 = `${TMP}zoom-2022.png`; await page.locator('.ew__zoom .ew__fig[data-era="era-2022-alley-tape-flowers"] .ew__pic').screenshot({ path: f4 }); items.push([f4, '2022년 10월 밤의 골목 — 크게 보기', 360]);
    }
    await ctx.close();
  }
  await composite(`${OUT}era-r5b-strip-360.jpg`, items, '시대의 창 5차b — 360×740 휴대폰 · 띠 크기(FM2d 80px) 라이트·다크 · 2009 세 갈래 · 철거 현장·2022 크게 (시안 · 승인 전)', { width: 1180 });
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
