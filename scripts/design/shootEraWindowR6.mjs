/**
 * SPEC-010 「시대의 창」 6차 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/010/ (designer 2026-11-03, r6).
 * 실행: node scripts/design/shootEraWindowR6.mjs            ← 캡처(시트 1~3장 + 칩 2장 + 띠 1장) + 검사
 *   시트는 먼저 `node scripts/design/buildEraWindowR6.mjs`. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG — 마스터 허용):
 *   era-r6-sheet.jpg(, -2, -3) — 1280 PC · 시트 전체를 세로 8000px 이하로 나눠 저장
 *   era-r6-chips.jpg — 「예측」 칩 두 안 절을 1280에서 라이트 · 다크 · 강제 색상으로
 *   era-r6-chips-360.jpg — 같은 절을 360(라이트 · 다크 · 강제 색상)과 320 글자 200%로
 *   era-r6-strip-360.jpg — 360 휴대폰 · 톤 두 안(U06) · 열두 장 띠(안 1 · 안 2 · 안 1 + 표) 라이트, 안 1 다크 · 2026 둘 · 2030 셋
 * 검사: 가로 넘침 0(1280 · 360 · 320 글자 200% · 1280 글자 200% · 768 · 다크 · 강제 색상), 그림 12 · 확대 12 · 띠 12×4 · 톤 칸, 칩 두 안(안 A 창 표 0 · 안 B 창 표 1, 칩 있는 시대 줄 = 2027~ 줄 수, 2026 줄 칩 0),
 *   PC 칸 175×140 · 확대 350×280 · 휴대폰 100×80, 캡션, use가 실제로 그려지는지, 외부 요청 0, 글자 ≥ 12px, 강제 색상에서 칩 글자·테두리가 남는지.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r6.html';
const OUT = ROOT + 'docs/design/screens/010/';
const TMP = ROOT + '.taste-skill/010/era-r6-shoot/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);
const EXPECT = { pieces: 12, zooms: 12, strips: 4, toneCells: { past: 2, plain: 1, draft: 4, frame: 4 }, forecastRows: 4, factRows: 1 };
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
      if (/(auto|scroll)/.test(cs.overflowX) || /hidden/.test(cs.overflow) || el.closest('.ew__tablewrap') || el.closest('.log__list')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    // 인생 기록 줄(스크롤 영역 안)은 따로: 칩·근거 글자가 줄 밖으로 나가면 안 된다
    for (const row of document.querySelectorAll('.log__row')) { const lr = row.getBoundingClientRect(); for (const el of row.querySelectorAll('.chip--fc, .log__basis, .log__tl')) { const r = el.getBoundingClientRect(); if (r.right > lr.right + 0.5) out.push(`줄 밖 ${[...el.classList].join('.')} ${Math.round(r.right)} > ${Math.round(lr.right)}`); } }
    return out;
  });
const measure = (page) =>
  page.evaluate(() => {
    const sz = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const grid = [...document.querySelectorAll('#pieces ~ .ew__grid .ew__fig')];
    const zooms = [...document.querySelectorAll('.ew__zoom .ew__fig')];
    const strips = [...document.querySelectorAll('.ew__strip')].map((s) => s.querySelectorAll('.ew__fig').length);
    const tone = {}; for (const k of ['past', 'plain', 'draft', 'frame']) tone[k] = document.querySelectorAll(`.ew__fig[data-tcell="${k}"]`).length;
    const inside = (m, host) => { const a = m.getBoundingClientRect(), b = host.getBoundingClientRect(); return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5; };
    const opts = {}; for (const o of ['A', 'B']) { const s = document.querySelector(`.ew__opt[data-opt="${o}"]`); const marks = [...s.querySelectorAll('.ew__scene .era__fc')]; const pic = s.querySelector('.ew__scene .era__pic'); opts[o] = { marks: marks.length, markInPic: marks.every((m) => m.closest('.era') !== null && inside(m, m.closest('.era'))), markBeside: marks.length ? marks[0].getBoundingClientRect().left >= pic.getBoundingClientRect().right - 0.5 : null, forecastRows: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="true"]').length, forecastChips: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="true"] .chip--fc').length, factRows: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="false"]').length, factChips: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="false"] .chip--fc').length, basis: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="true"] .log__basis').length, eraPic: sz(s.querySelector('.ew__scene .era__pic')) }; }
    const chip = document.querySelector('.ew__cmp .chip--fc'); const cc = getComputedStyle(chip);
    const proj = document.querySelector('.ew__cmp .chip--proj'); const pc = getComputedStyle(proj);
    const useBoxes = [...document.querySelectorAll('.ew__zoom use')].slice(0, 80).map((u) => { try { const b = u.getBBox(); return b.width * b.height; } catch { return 0; } });
    const capOf = (f) => ({ year: f.querySelector('.ew__year')?.textContent, name: f.querySelector('.ew__name')?.textContent, line: f.querySelector('.ew__line')?.textContent, draws: f.querySelector('.ew__draws')?.textContent, ft3: f.querySelector('.ew__ft3')?.textContent, band: f.querySelector('.ew__band')?.textContent || '' });
    return {
      pieces: grid.length, zooms: zooms.length, strips, tone, opts,
      chip: { h: sz(chip)[1], w: sz(chip)[0], color: cc.color, bg: cc.backgroundColor, border: cc.borderTopColor, radius: cc.borderTopLeftRadius, borderW: cc.borderTopWidth, font: cc.fontSize },
      proj: { color: pc.color, bg: pc.backgroundColor, radius: pc.borderTopLeftRadius },
      picPc: grid[0] && sz(grid[0].querySelector('.ew__pic')), picZoom: zooms[0] && sz(zooms[0].querySelector('.ew__pic')), picStrip: sz(document.querySelector('.ew__strip .ew__pic')),
      caps: grid.map(capOf),
      useCount: document.querySelectorAll('.ew__grid use').length, useEmpty: useBoxes.filter((a) => !(a > 0)).length, useChecked: useBoxes.length,
      fontPx: [...new Set([...document.querySelectorAll('.ew__cap *, .ew__note, .ew__lead, .ew td, .ew th, .ew__ask li, .ew__rule li, .ew__list li, .chip--fc, .log__basis, .era__fc, .log__sent, .log__tl')].map((el) => parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b),
      height: document.documentElement.scrollHeight,
    };
  });
async function check(page, label, { forced = false } = {}) {
  const over = await overflowReport(page);
  if (over.length) problems.push(`${label}: ${over.join(' | ')}`);
  const m = await measure(page);
  if (m.pieces !== EXPECT.pieces) problems.push(`${label}: 그림 ${m.pieces}(${EXPECT.pieces} 기대)`);
  if (m.zooms !== EXPECT.zooms) problems.push(`${label}: 확대 ${m.zooms}(${EXPECT.zooms} 기대)`);
  if (m.strips.length !== EXPECT.strips || m.strips.some((n) => n !== 12)) problems.push(`${label}: 띠 ${m.strips.join('/')}(12×${EXPECT.strips} 기대)`);
  for (const [k, n] of Object.entries(EXPECT.toneCells)) if (m.tone[k] !== n) problems.push(`${label}: 톤 칸 ${k} ${m.tone[k]}(${n} 기대)`);
  if (m.opts.A.marks !== 0) problems.push(`${label}: 안 A 창 표 ${m.opts.A.marks}(0 기대)`);
  if (m.opts.B.marks !== 1 || !m.opts.B.markInPic) problems.push(`${label}: 안 B 창 표 ${m.opts.B.marks}(1, 칸 안 기대) 칸 안 ${m.opts.B.markInPic}`);
  // 휴대폰 띠(카드 ≤ 480px)에서는 표가 그림 옆, PC에서는 그림 위
  const narrow = m.opts.B.eraPic[0] === 100; if (m.opts.B.markBeside !== narrow) problems.push(`${label}: 안 B 창 표 자리 — 그림 옆 ${m.opts.B.markBeside}(띠 ${narrow} 기대)`);
  for (const o of ['A', 'B']) { const x = m.opts[o]; if (x.forecastRows !== EXPECT.forecastRows || x.forecastChips !== x.forecastRows || x.basis !== x.forecastRows) problems.push(`${label}: 안 ${o} 예측 줄 ${x.forecastRows} 칩 ${x.forecastChips} 근거 ${x.basis}(${EXPECT.forecastRows} 기대)`); if (x.factRows !== EXPECT.factRows || x.factChips !== 0) problems.push(`${label}: 안 ${o} 2026 줄 ${x.factRows} 칩 ${x.factChips}(1·0 기대)`); }
  if (m.chip.radius === m.proj.radius) problems.push(`${label}: 칩 모양이 같다(${m.chip.radius})`);
  if (m.chip.color === m.proj.color && !forced) problems.push(`${label}: 칩 글자 색이 같다(${m.chip.color})`);
  if (forced && (m.chip.borderW === '0px' || m.chip.color === m.chip.bg)) problems.push(`${label}: 강제 색상에서 칩 테두리·글자가 안 남는다 ${JSON.stringify(m.chip)}`);
  for (const c of m.caps) if (!c.year || !c.name || !c.line || !c.draws || !c.ft3) problems.push(`${label}: 캡션 빠짐 ${JSON.stringify(c)}`);
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
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0;flex:none;min-width:0}img{display:block;height:auto;max-width:100%;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.min(h, 16000) });
  await page.screenshot({ path: outFile, fullPage: true, type: 'jpeg', quality: 76 });
  saved(outFile, 1500);
  await ctx.close();
}
const sectionOf = (page, startId, endId) => page.evaluate(([a, b]) => { const s = document.getElementById(a).getBoundingClientRect(); const e = document.getElementById(b).getBoundingClientRect(); return { x: 0, y: Math.round(s.top + window.scrollY) - 8, width: document.documentElement.clientWidth, height: Math.round(e.top - s.top) }; }, [startId, endId]);

// ① 1280 PC — 시트 전체를 8000px 이하로 나눠 저장
{
  const { ctx, page } = await open({ view: { width: 1280, height: 800 } });
  const m = await check(page, 'sheet-1280');
  if (!m.picPc || m.picPc[0] !== 175 || m.picPc[1] !== 140) problems.push(`PC 칸 ${m.picPc}(175×140 기대)`);
  if (!m.picZoom || m.picZoom[0] !== 350 || m.picZoom[1] !== 280) problems.push(`확대 ${m.picZoom}(350×280 기대)`);
  if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`띠 그림 ${m.picStrip}(100×80 기대)`);
  notes.push(`sheet-1280: 높이 ${m.height} · 그림 ${m.pieces} · 확대 ${m.zooms} · 띠 ${m.strips.join('/')} · 톤 칸 ${JSON.stringify(m.tone)} · 안 A ${JSON.stringify(m.opts.A)} · 안 B ${JSON.stringify(m.opts.B)} · 칩 ${JSON.stringify(m.chip)} · 전망 칩 ${JSON.stringify(m.proj)} · use ${m.useCount}(검사 ${m.useChecked}, 빈 것 ${m.useEmpty}) · 글자 px ${m.fontPx.join('/')}`);
  const parts = Math.ceil(m.height / MAX_PART);
  for (let i = 0; i < parts; i++) {
    const file = `${OUT}era-r6-sheet${i ? `-${i + 1}` : ''}.jpg`;
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72, clip: { x: 0, y: i * MAX_PART, width: 1280, height: Math.min(MAX_PART, m.height - i * MAX_PART) } });
    saved(file, 1500);
  }
  for (let i = parts; i < 6; i++) { const f = `${OUT}era-r6-sheet-${i + 1}.jpg`; if (existsSync(f)) unlinkSync(f); }
  notes.push(`sheet parts: ${parts}`);
  await ctx.close();
}
// ② 칩 두 안 — 1280 라이트·다크·강제 색상
{
  const items = [];
  for (const [label, opt, cap] of [['light', {}, '라이트 1280'], ['dark', { dark: true, q: 'theme=dark' }, '다크 1280'], ['forced', { forced: true }, '강제 색상 1280(칩 면 Canvas · 글자·테두리 CanvasText — 글자·아이콘·모양이 남는다)']]) {
    const { ctx, page } = await open({ view: { width: 1280, height: 800 }, ...opt });
    await check(page, `chips-1280-${label}`, { forced: !!opt.forced });
    const clip = await sectionOf(page, 'chips', 'tones');
    const f = `${TMP}chips-1280-${label}.png`; await page.screenshot({ path: f, fullPage: true, clip }); items.push([f, cap, 1120]);
    await ctx.close();
  }
  await composite(`${OUT}era-r6-chips.jpg`, items, '시대의 창 6차 — 「예측」 칩 두 안(안 A 줄에만 · 안 B 줄과 창) · 「전망」과 나란히 · 대비 실측 — 1280 라이트 · 다크 · 강제 색상 (시안 · 승인 전)', { width: 1180 });
}
// ③ 칩 두 안 — 360 라이트·다크·강제 색상 + 320 글자 200%
{
  const items = [];
  for (const [label, view, opt, cap] of [['360-light', { width: 360, height: 740 }, { dpr: 2 }, '360 라이트'], ['360-dark', { width: 360, height: 740 }, { dpr: 2, dark: true, q: 'theme=dark' }, '360 다크'], ['360-forced', { width: 360, height: 740 }, { dpr: 2, forced: true }, '360 강제 색상'], ['320-text200', { width: 320, height: 640 }, { dpr: 2, text: 200 }, '320 · 글자 200% — 표지·칩·근거 글자가 다음 줄로 내려가고 가로 넘침 0']]) {
    const { ctx, page } = await open({ view, ...opt });
    const m = await check(page, `chips-${label}`, { forced: !!opt.forced });
    notes.push(`chips-${label}: 안 A 창 ${m.opts.A.eraPic} · 안 B 창 ${m.opts.B.eraPic} · 표 그림 옆 ${m.opts.B.markBeside} · 칩 ${m.chip.w}×${m.chip.h}`);
    const clip = await sectionOf(page, 'chips', 'tones');
    const f = `${TMP}chips-${label}.png`; await page.screenshot({ path: f, fullPage: true, clip: { ...clip, height: Math.min(clip.height, 7000) } }); items.push([f, cap, view.width]);
    await ctx.close();
  }
  await composite(`${OUT}era-r6-chips-360.jpg`, items, '시대의 창 6차 — 「예측」 칩 두 안 · 360 라이트 · 다크 · 강제 색상 · 320 글자 200% (시안 · 승인 전)', { width: 1480 });
}
// ④ 360 휴대폰 — 톤 두 안 · 띠 셋 · 2026 둘 · 2030 셋 (라이트) + 안 1 띠(다크)
{
  const items = [];
  const { ctx, page } = await open({ view: { width: 360, height: 740 }, dpr: 2 });
  const m = await check(page, 'strip-360-light');
  if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`strip-360-light: 띠 그림 ${m.picStrip}(100×80 기대)`);
  const shots = [['.ew__tone[data-ftone="none"] .ew__tonerow', 'tone-past', '기준 · 과거 2022(r5b) 175·100과 U06 톤 없음'], ['.ew__tone[data-ftone="draft"] .ew__tonerow', 'tone-draft', '안 1 밑그림 · U06 175 · 175 + 창 표 · 100 · 100 + 표'], ['.ew__tone[data-ftone="frame"] .ew__tonerow', 'tone-frame', '안 2 점선 틀 · 같은 넷'], ['.ew__strip[data-strip="draft"]', 'strip-draft', '열두 장 띠(100×80) · 안 1 밑그림'], ['.ew__strip[data-strip="frame"]', 'strip-frame', '열두 장 띠 · 안 2 점선 틀'], ['.ew__strip[data-strip="draft-mark"]', 'strip-draft-mark', '열두 장 띠 · 안 1 + 창 표(안 B) — 휴대폰 띠 326×80, 표는 그림 옆'], ['.ew__grid3[data-pair="2026"]', 'pair-2026', '2026 — 어려운 쪽·가운데 U01 / 부유한 쪽 U02(360 폭)'], ['.ew__grid3[data-pair="2030"]', 'pair-2030', '2030 — 어려운 쪽 U06 / 가운데 U07 / 부유한 쪽 U08(360 폭)']];
  for (const [sel, name, cap] of shots) { const f = `${TMP}${name}.png`; await page.locator(sel).screenshot({ path: f }); items.push([f, cap, 360]); }
  await ctx.close();
  const d = await open({ view: { width: 360, height: 740 }, dpr: 2, dark: true, q: 'theme=dark' });
  await check(d.page, 'strip-360-dark');
  const fd = `${TMP}strip-draft-dark.png`; await d.page.locator('.ew__strip[data-strip="draft"]').screenshot({ path: fd }); items.push([fd, '열두 장 띠 · 안 1 밑그림 · 다크', 360]);
  const fd2 = `${TMP}tone-draft-dark.png`; await d.page.locator('.ew__tone[data-ftone="draft"] .ew__tonerow').screenshot({ path: fd2 }); items.push([fd2, '안 1 밑그림 · 다크', 360]);
  await d.ctx.close();
  await composite(`${OUT}era-r6-strip-360.jpg`, items, '시대의 창 6차 — 360×740 휴대폰 · 미래 그림 톤 두 안(U06) · 열두 장 띠(FM2d 80px) · 2026 둘 · 2030 셋 (시안 · 승인 전)', { width: 1180 });
}
// ⑤ 검사만
for (const [label, q, view, opt] of [
  ['sheet-320-text200', '', { width: 320, height: 640 }, { text: 200 }],
  ['sheet-1280-text200', '', { width: 1280, height: 800 }, { text: 200 }],
  ['sheet-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }],
  ['sheet-forced-1280', '', { width: 1280, height: 800 }, { forced: true }],
  ['sheet-forced-360', '', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
  ['sheet-768', '', { width: 768, height: 1024 }, {}],
]) { const { ctx, page } = await open({ q, view, ...opt }); await check(page, label, { forced: !!opt.forced }); await page.screenshot({ path: `${TMP}${label}.png`, fullPage: true }); await ctx.close(); }
await browser.close();

console.log('\n--- 측정 ---');
for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('\n외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('\n문제 0');
