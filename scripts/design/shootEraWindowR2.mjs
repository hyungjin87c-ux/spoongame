/**
 * SPEC-009 「시대의 창」 2차 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/ (designer 2026-10-28, r2).
 * 실행: node scripts/design/shootEraWindowR2.mjs            ← 캡처 2장 + 검사
 *       node scripts/design/shootEraWindowR2.mjs preview    ← 작업 중 미리보기(.taste-skill/009/era-r2-preview/, 저장소에 올리지 않는다)
 *   시트는 먼저 `node scripts/design/buildEraWindowR2.mjs`. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG q85 — 망점 톤 때문에 PNG는 1.3MB가 되어 jpg로 둔다, 마스터에 보고):
 *   era-r2-sheet.jpg     — 1280 PC · 시트 전체(톤 비교 · 열두 장 175×140 · 확대 셋 · 2:1 예시 둘 · 띠 크기 · 문장 표)
 *   era-r2-strip-360.jpg — 360 휴대폰 · 집 그림 아래 띠(80px, 그림 100×80) 라이트·다크 + 열두 장을 띠 크기로
 * 검사: 가로 넘침 0(1280·360·320 글자 200%·1280 글자 200%·768·다크·강제 색상), 열두 장·무거운 장면 ≥ 2, PC 칸 175×140·휴대폰 100×80, 칸 링크 대상 + title, 캡션(해·이름·종류·FT3), 외부 요청 0, 글자 ≥ 11px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r2.html';
const PREVIEW = process.argv[2] === 'preview';
const OUT = PREVIEW ? ROOT + '.taste-skill/009/era-r2-preview/' : ROOT + 'docs/design/screens/009/';
const TMP = ROOT + '.taste-skill/009/era-r2-shoot/';
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
      if (el.closest('svg') || el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
      if (/(auto|scroll)/.test(cs.overflowX) || /hidden/.test(cs.overflow)) continue;
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
    const figs = [...document.querySelectorAll('.ew__grid .ew__fig')];
    const strips = [...document.querySelectorAll('.ew__strip .ew__fig')];
    const eras = [...document.querySelectorAll('.era')];
    return {
      figs: figs.length, heavy: figs.filter((f) => f.dataset.heavy === 'true').length, tones: document.querySelectorAll('.ew__tone .ew__fig').length,
      picPc: figs[0] && sz(figs[0].querySelector('.ew__pic')), picStrip: strips[0] && sz(strips[0].querySelector('.ew__pic')),
      caps: figs.map((f) => ({ year: f.querySelector('.ew__year')?.textContent, name: f.querySelector('.ew__name')?.textContent, kind: f.querySelector('.ew__kind')?.textContent, ft3: f.querySelector('.ew__ft3')?.textContent, heavy: f.querySelector('.ew__heavy')?.textContent || '' })),
      eras: eras.map((a) => ({ id: a.dataset.era, box: sz(a), pic: sz(a.querySelector('.era__pic')), href: a.getAttribute('href'), target: !!document.querySelector(a.getAttribute('href')), title: a.getAttribute('title'), filter: getComputedStyle(a.querySelector('svg')).filter })),
      house: document.querySelector('.scene__svg') && sz(document.querySelector('.scene__svg')),
      fontPx: [...new Set([...document.querySelectorAll('.ew__cap *, .ew__note, .ew__lead, .ew td, .ew th, .ew__tone p')].map((el) => parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b),
    };
  });
async function check(page, label) {
  const over = await overflowReport(page);
  if (over.length) problems.push(`${label}: ${over.join(' | ')}`);
  const m = await measure(page);
  if (m.figs !== 12) problems.push(`${label}: 그림 ${m.figs}장(12 기대)`);
  if (m.heavy < 2) problems.push(`${label}: 무거운 장면 ${m.heavy} < 2`);
  if (m.tones !== 6) problems.push(`${label}: 톤 비교 ${m.tones}장(6 기대)`);
  for (const c of m.caps) if (!c.year || !c.name || !c.kind || !c.ft3) problems.push(`${label}: 캡션 빠짐 ${JSON.stringify(c)}`);
  for (const e of m.eras) { if (!e.target) problems.push(`${label}: 칸 링크 대상 없음 ${e.href}`); if (!e.title) problems.push(`${label}: 칸 title 없음 ${e.id}`); if (e.box[1] > 100 && (Math.abs(e.box[0] - e.pic[0]) > 2 || Math.abs(e.box[1] - e.pic[1]) > 2)) problems.push(`${label}: 칸에 그림 말고 다른 것 ${e.id} ${e.box} vs ${e.pic}`); }
  if (m.fontPx[0] < 11) problems.push(`${label}: 글자 ${m.fontPx[0]}px < 11`);
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
  await page.screenshot({ path: outFile, fullPage: true, type: 'jpeg', quality: 85 });
  saved(outFile, 420);
  await ctx.close();
}

// ① 1280 PC — 시트 전체
{
  const { ctx, page } = await open({ view: { width: 1280, height: 800 } });
  const m = await check(page, 'sheet-1280');
  if (!m.picPc || m.picPc[0] !== 175 || m.picPc[1] !== 140) problems.push(`PC 칸 ${m.picPc}(175×140 기대)`);
  if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`띠 그림 ${m.picStrip}(100×80 기대)`);
  notes.push(`sheet-1280: 그림 ${m.figs}(무거움 ${m.heavy}) · 톤 비교 ${m.tones} · PC 칸 ${m.picPc} · 띠 ${m.picStrip} · 2:1 예시 집 ${m.house} 창 ${m.eras[0]?.box} 필터 「${m.eras[0]?.filter}」 · 글자 px ${m.fontPx.join('/')}`);
  await page.screenshot({ path: `${OUT}era-r2-sheet.jpg`, fullPage: true, type: 'jpeg', quality: 85 });
  saved(`${OUT}era-r2-sheet.jpg`, 800);
  if (PREVIEW) { for (const [n, sel] of [['tones', '.ew__tones'], ['grid', '.ew__grid'], ['zoom', '.ew__zoom'], ['examples', '.ew__examples'], ['strip', '.ew__strip']]) await page.locator(sel).screenshot({ path: `${OUT}${n}.png` }); }
  await ctx.close();
}
// ② 360 휴대폰 — 쌓기(띠 80px) 라이트·다크 + 띠 크기 열두 장
{
  const items = [];
  for (const [label, opt, cap] of [['light', { dpr: 2 }, '라이트 · 집 326×130 아래 띠 80px(그림 100×80) · 1980년 5월(무거운 장면, 기본 보임) · 1975 교실'], ['dark', { dpr: 2, dark: true }, '다크(토큰만 바뀌고 필터는 약하게) · 같은 자리']]) {
    const { ctx, page } = await open({ q: opt.dark ? 'theme=dark' : '', view: { width: 360, height: 740 }, ...opt });
    const m = await check(page, `strip-360-${label}`);
    const e = m.eras[0];
    if (!e || e.pic[0] !== 100 || e.pic[1] !== 80) problems.push(`strip-360-${label}: 띠 그림 ${e?.pic}(100×80 기대)`);
    notes.push(`strip-360-${label}: 집 ${m.house} · 띠 그림 ${e?.pic} · 칸 ${e?.box}`);
    const f1 = `${TMP}ex-${label}.png`;
    await page.locator('.ew__examples').screenshot({ path: f1 });
    items.push([f1, cap, 360]);
    if (label === 'light') { const f2 = `${TMP}strip-${label}.png`; await page.locator('.ew__strip').screenshot({ path: f2 }); items.push([f2, '열두 장을 띠 크기(100×80)로', 360]); }
    await ctx.close();
  }
  await composite(`${OUT}era-r2-strip-360.jpg`, items, '시대의 창 2차 — 360×740 휴대폰 · 집 그림 아래 띠(FM2d 80px) (시안 · 가짜 이름·나이 · 승인 전)', { width: 1140 });
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
