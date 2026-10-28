/**
 * SPEC-009 「시대의 창」 r4b 전·후 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/era-r4b-fix.jpg 1장 (designer 2026-10-28).
 * 실행: node scripts/design/shootEraWindowR4b.mjs   ← 시트는 먼저 buildEraWindowR4.mjs → buildEraWindowR4b.mjs. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG q74): 1280 PC 시트 전체(왼쪽) + 360 휴대폰 시트 전체(오른쪽)를 한 장에 합친다.
 * 검사: 가로 넘침 0(1280·360·320 글자 200%·다크·강제 색상), 전 4·후 4·확대 4·띠 4, 칸 175×140·350×280·100×80, `use` 렌더 상자 0인 것 0, 외부 요청 0, 글자 ≥ 12px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r4b.html';
const OUT = ROOT + 'docs/design/screens/009/';
const TMP = ROOT + '.taste-skill/009/era-r4b-shoot/';
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
      if (el.closest('svg') || el.classList.contains('sr-only')) continue;
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
    const q = (s) => [...document.querySelectorAll(s)];
    const useBoxes = q('.fx__after use, .fx__zoom use').slice(0, 80).map((u) => { try { const b = u.getBBox(); return b.width * b.height; } catch { return 0; } });
    return {
      before: q('.fx__before .ew__pic').length, after: q('.fx__after .ew__pic').length, zoom: q('.fx__zoom .ew__pic').length, strip: q('.ew__strip .ew__pic').length,
      pc: sz(q('.fx__after .ew__pic')[0]), zm: sz(q('.fx__zoom .ew__pic')[0]), mb: sz(q('.ew__strip .ew__pic')[0]),
      heavy: q('.fx[data-heavy="true"]').length, low: q('.fx[data-band="low"]').length,
      useEmpty: useBoxes.filter((a) => !(a > 0)).length, useChecked: useBoxes.length,
      fontPx: [...new Set(q('.ew p, .ew li, .ew td, .ew th, .ew__cap *').map((el) => parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b),
    };
  });
async function check(page, label) {
  const over = await overflowReport(page);
  if (over.length) problems.push(`${label}: ${over.join(' | ')}`);
  const m = await measure(page);
  if (m.before !== 4 || m.after !== 4 || m.zoom !== 4 || m.strip !== 4) problems.push(`${label}: 전 ${m.before} 후 ${m.after} 확대 ${m.zoom} 띠 ${m.strip}(각 4 기대)`);
  if (m.heavy !== 1 || m.low !== 2) problems.push(`${label}: 무거움 ${m.heavy}(1) · 아래 변주 ${m.low}(2)`);
  if (m.useEmpty) problems.push(`${label}: 그려지지 않은 use ${m.useEmpty}/${m.useChecked}`);
  if (m.fontPx[0] < 12) problems.push(`${label}: 글자 ${m.fontPx[0]}px < 12`);
  return m;
}
function saved(file, limit) { const size = kb(file); if (size > limit) problems.push(`${file}: ${size} KB > ${limit} KB`); console.log('saved', file.replace(ROOT, ''), `${size} KB`); }

const shots = [];
{
  const { ctx, page } = await open({ view: { width: 1280, height: 800 } });
  const m = await check(page, 'sheet-1280');
  if (m.pc[0] !== 175 || m.pc[1] !== 140) problems.push(`PC 칸 ${m.pc}(175×140 기대)`);
  if (m.zm[0] !== 350 || m.zm[1] !== 280) problems.push(`확대 ${m.zm}(350×280 기대)`);
  if (m.mb[0] !== 100 || m.mb[1] !== 80) problems.push(`띠 ${m.mb}(100×80 기대)`);
  notes.push(`sheet-1280: 전 ${m.before} 후 ${m.after} 확대 ${m.zoom} 띠 ${m.strip} · 칸 ${m.pc}/${m.zm}/${m.mb} · use 검사 ${m.useChecked}(빈 것 ${m.useEmpty}) · 글자 px ${m.fontPx.join('/')}`);
  const f1 = `${TMP}sheet-1280.png`; await page.screenshot({ path: f1, fullPage: true }); shots.push([f1, 1280, '1280 PC — 전 · 후 · 크게 보기']);
  await ctx.close();
}
{
  const { ctx, page } = await open({ view: { width: 360, height: 740 }, dpr: 2 });
  const m = await check(page, 'sheet-360');
  notes.push(`sheet-360: 칸 ${m.pc}/${m.zm}/${m.mb}`);
  const f2 = `${TMP}sheet-360.png`; await page.screenshot({ path: f2, fullPage: true }); shots.push([f2, 360, '360 휴대폰 — 같은 시트(2배)']);
  await ctx.close();
}
for (const [label, q, view, opt] of [
  ['sheet-320-text200', '', { width: 320, height: 640 }, { text: 200 }],
  ['sheet-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }],
  ['sheet-forced-1280', '', { width: 1280, height: 800 }, { forced: true }],
  ['sheet-forced-360', '', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
  ['sheet-768', '', { width: 768, height: 1024 }, {}],
]) { const { ctx, page } = await open({ q, view, ...opt }); await check(page, label); await page.screenshot({ path: `${TMP}${label}.png`, fullPage: true }); await ctx.close(); }

// 합치기 — 1280 시트(왼쪽) + 360 시트(오른쪽) 한 장
{
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = shots.map(([f, w, cap]) => `<figure style="width:${w}px"><figcaption>${cap}</figcaption><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt="" style="width:${w}px"></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;gap:16px;align-items:flex-start}figure{margin:0;flex:none}img{display:block;height:auto;border:1px solid #d8d1c2}figcaption{margin:0 0 4px;color:#4f4a41}</style><body><h1>시대의 창 r4b — 세 곳 보강 전·후(1961 시민 · 1958 빈 밥상과 아이들 · 1970년대 셋방 · 1980년대 반지하) · 시안 · 승인 전</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1700, height: h });
  await page.screenshot({ path: `${OUT}era-r4b-fix.jpg`, fullPage: true, type: 'jpeg', quality: 74 });
  saved(`${OUT}era-r4b-fix.jpg`, 1500);
  await ctx.close();
}
await browser.close();
console.log('\n--- 측정 ---'); for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('문제 0');
