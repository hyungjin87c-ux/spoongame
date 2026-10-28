/**
 * SPEC-009 FM5 조각 보강 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/fm5-pieces.jpg 1장 (designer 2026-10-28).
 * 실행: node scripts/design/shootFm5Pieces.mjs            ← 캡처 1장 + 검사
 *       node scripts/design/shootFm5Pieces.mjs preview    ← 작업 중 미리보기(.taste-skill/009/fm5-preview/ — 장면 묶음·밴드별 조각 묶음 PNG, 저장소에 올리지 않는다)
 * 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 검사: 가로 넘침 0(1280·360·320 글자 200%·다크·강제 색상), 장면 18 · 조각 33, 조각마다 **그린 내용이 상자 안**인지(getBBox가 box를 2단위 넘게 벗어나면 문제), 장면 svg 폭 351(PC)·326(360), 외부 요청 0, 글자 ≥ 12px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/fm5-pieces.html';
const PREVIEW = process.argv[2] === 'preview';
const OUT = ROOT + 'docs/design/screens/009/';
const TMP = ROOT + (PREVIEW ? '.taste-skill/009/fm5-preview/' : '.taste-skill/009/fm5-shoot/');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);

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
      if (el.closest('svg')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
      if (/(auto|scroll)/.test(cs.overflowX) || /hidden/.test(cs.overflow) || el.closest('.pc__tablewrap')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
const measure = (page) =>
  page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const sz = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const outOfBox = [];
    for (const cell of q('.pc__cell')) {
      const svg = cell.querySelector('svg'); const vb = svg.viewBox.baseVal; const g = svg;
      let b; try { b = g.getBBox(); } catch { continue; }
      const tol = 2; // 그림자 (3,3)는 상자 밖 3단위까지 허용 — 상자는 조각 본체 기준(FH8)
      const over = [];
      if (b.x < vb.x - tol) over.push(`왼 ${Math.round(vb.x - b.x)}`);
      if (b.y < vb.y - tol) over.push(`위 ${Math.round(vb.y - b.y)}`);
      if (b.x + b.width > vb.x + vb.width + 3 + tol) over.push(`오른 ${Math.round(b.x + b.width - vb.x - vb.width)}`);
      if (b.y + b.height > vb.y + vb.height + 3 + tol) over.push(`아래 ${Math.round(b.y + b.height - vb.y - vb.height)}`);
      if (over.length) outOfBox.push(`${cell.dataset.piece}(${over.join(' ')})`);
    }
    return { scenes: q('.sc__fig').length, cells: q('.pc__cell').length, sceneW: sz(q('.sc__fig .scene__svg')[0]), outOfBox, fontPx: [...new Set(q('.pc p, .pc li, .pc td, .pc th, .pc figcaption, .pc figcaption *').map((el) => parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b) };
  });
async function check(page, label) {
  const over = await overflowReport(page);
  if (over.length) problems.push(`${label}: ${over.join(' | ')}`);
  const m = await measure(page);
  if (m.scenes !== 18) problems.push(`${label}: 장면 ${m.scenes}(18 기대)`);
  if (m.cells !== 33) problems.push(`${label}: 조각 ${m.cells}(33 기대)`);
  if (m.outOfBox.length) problems.push(`${label}: 상자 밖 조각 ${m.outOfBox.join(', ')}`);
  if (m.fontPx[0] < 12) problems.push(`${label}: 글자 ${m.fontPx[0]}px < 12`);
  return m;
}
function saved(file, limit) { const size = kb(file); if (size > limit) problems.push(`${file}: ${size} KB > ${limit} KB`); console.log('saved', file.replace(ROOT, ''), `${size} KB`); }

const shots = [];
{
  const { ctx, page } = await open({ view: { width: 1280, height: 800 } });
  const m = await check(page, 'sheet-1280');
  if (m.sceneW[0] < 349 || m.sceneW[0] > 352) problems.push(`PC 장면 폭 ${m.sceneW}(351 ± 2 기대 — 2:1 배치의 집 그림 350.7)`);
  notes.push(`sheet-1280: 장면 ${m.scenes} · 조각 ${m.cells} · 장면 svg ${m.sceneW} · 상자 밖 ${m.outOfBox.length} · 글자 px ${m.fontPx.join('/')}`);
  if (PREVIEW) {
    await page.locator('.sc__grid').screenshot({ path: `${TMP}scenes.png` });
    const grids = page.locator('.pc__grid'); const n = await grids.count();
    for (let i = 0; i < n; i++) await grids.nth(i).screenshot({ path: `${TMP}band-${i + 1}.png` });
  } else { const f1 = `${TMP}sheet-1280.png`; await page.screenshot({ path: f1, fullPage: true }); shots.push([f1, 1280, '1280 PC — 장면 열여덟(351×140) · 밴드별 새 조각 서른셋']); }
  await ctx.close();
}
if (!PREVIEW) {
  {
    const { ctx, page } = await open({ view: { width: 360, height: 740 }, dpr: 2 });
    const m = await check(page, 'sheet-360');
    if (m.sceneW[0] < 324 || m.sceneW[0] > 330) problems.push(`360 장면 폭 ${m.sceneW}(326 ± 2 기대 — 시트는 카드 안쪽 여백이 없어 328)`);
    notes.push(`sheet-360: 장면 svg ${m.sceneW}`);
    const f2 = `${TMP}scenes-360.png`; await page.locator('.sc__grid').screenshot({ path: f2 }); shots.push([f2, 360, '360 휴대폰 — 장면 열여덟(전폭 326×130, 2배)']);
    await ctx.close();
  }
  for (const [label, q, view, opt] of [
    ['sheet-320-text200', '', { width: 320, height: 640 }, { text: 200 }],
    ['sheet-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }],
    ['sheet-forced-1280', '', { width: 1280, height: 800 }, { forced: true }],
    ['sheet-768', '', { width: 768, height: 1024 }, {}],
  ]) { const { ctx, page } = await open({ q, view, ...opt }); await check(page, label); if (label === 'sheet-dark-1280') { const f3 = `${TMP}scenes-dark.png`; await page.locator('.sc__grid').screenshot({ path: f3 }); shots.push([f3, 1280, '다크 — 같은 장면(토큰만 바뀐다)']); } await ctx.close(); }
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = shots.map(([f, w, cap]) => `<figure style="width:${w}px"><figcaption>${cap}</figcaption><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt="" style="width:${w}px"></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}figure{margin:0;flex:none}img{display:block;height:auto;border:1px solid #d8d1c2}figcaption{margin:0 0 4px;color:#4f4a41}</style><body><h1>집 그림 조각 보강 서른세 장(SPEC-009 FM5) — 장면 열여덟 · 밴드별 조각 · 360 · 다크 · 시안</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const hh = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1700, height: hh });
  await page.screenshot({ path: `${OUT}fm5-pieces.jpg`, fullPage: true, type: 'jpeg', quality: 74 });
  saved(`${OUT}fm5-pieces.jpg`, 2000);
  await ctx.close();
}
await browser.close();
console.log('\n--- 측정 ---'); for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('문제 0');
