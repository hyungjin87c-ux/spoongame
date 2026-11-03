/**
 * SPEC-010 「시대의 창」 8차 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/010/ (designer 2026-11-03, r8).
 * 실행: node scripts/design/shootEraWindowR8.mjs            ← 캡처(시트 1~3장 + 적용 모습 2장 + 띠 1장) + 검사
 *   시트는 먼저 `node scripts/design/buildEraWindowR8.mjs`. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG — 마스터 허용):
 *   era-r8-sheet.jpg(, -2, -3) — 1280 PC · 시트 전체를 세로 8000px 이하로 나눠 저장
 *   era-r8-applied.jpg — 확정 칩(안 B)·톤(안 1)이 적용된 카드 절(2065 PC·휴대폰 + 2111 끝 장면 + 기록)을 1280에서 라이트 · 다크 · 강제 색상으로
 *   era-r8-applied-360.jpg — 같은 절을 360(라이트 · 다크 · 강제 색상)과 320 글자 200%로
 *   era-r8-strip-360.jpg — 360 휴대폰 · 2065 둘 · 2095 둘 · 일상 10년대 다섯 · 끝 장면 · 열여덟 장 띠(톤 · 톤 + 표) 라이트, 톤 띠 다크
 * 검사: 가로 넘침 0(1280 · 360 · 320 글자 200% · 1280 글자 200% · 768 · 다크 · 강제 색상), 그림 18 · 확대 18 · 띠 18×3, 적용 모습(창 표 1 — 칸 안, 1280은 그림 위 · 360은 그림 옆; 끝 장면 카드는 표 0 · 톤 0; 시대 줄 7 모두 칩 + 근거, 끝 줄 1은 칩 0),
 *   PC 칸 175×140 · 확대 350×280 · 휴대폰 100×80, 캡션, use가 실제로 그려지는지, 외부 요청 0, 글자 ≥ 12px, 강제 색상에서 칩 글자·테두리가 남는지.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r8.html';
const OUT = ROOT + 'docs/design/screens/010/';
const TMP = ROOT + '.taste-skill/010/era-r8-shoot/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);
const EXPECT = { pieces: 18, zooms: 18, strips: 3, forecastRows: 7, factRows: 1, pairs: { 2065: 2, 2095: 2, '2060s': 2, '2070s': 2, '2080s': 2, '2090s': 2, '2100s': 2, end: 1 } };
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
    for (const row of document.querySelectorAll('.log__row')) { const lr = row.getBoundingClientRect(); for (const el of row.querySelectorAll('.chip--fc, .log__basis, .log__tl')) { const r = el.getBoundingClientRect(); if (r.right > lr.right + 0.5) out.push(`줄 밖 ${[...el.classList].join('.')} ${Math.round(r.right)} > ${Math.round(lr.right)}`); } }
    return out;
  });
const measure = (page) =>
  page.evaluate(() => {
    const sz = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const grid = [...document.querySelectorAll('#pieces ~ .ew__grid .ew__fig')];
    const zooms = [...document.querySelectorAll('.ew__zoom .ew__fig')];
    const strips = [...document.querySelectorAll('.ew__strip')].map((s) => s.querySelectorAll('.ew__fig').length);
    const pairs = {}; for (const p of document.querySelectorAll('.ew__grid3[data-pair]')) pairs[p.dataset.pair] = p.querySelectorAll('.ew__fig').length;
    const inside = (m, host) => { const a = m.getBoundingClientRect(), b = host.getBoundingClientRect(); return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5; };
    const s = document.querySelector('.ew__applied'); const pcScene = s.querySelector('.ew__appliedcol > .ew__scene:not([data-end])'); const phScene = s.querySelector('.ew__phone .ew__scene'); const endScene = s.querySelector('.ew__scene[data-end]');
    const marks = [...pcScene.querySelectorAll('.era__fc')]; const pic = pcScene.querySelector('.era__pic'); const phMarks = [...phScene.querySelectorAll('.era__fc')]; const phPic = phScene.querySelector('.era__pic');
    const applied = { marks: marks.length, markInPic: marks.every((m) => m.closest('.era') !== null && inside(m, m.closest('.era'))), markBeside: marks.length ? marks[0].getBoundingClientRect().left >= pic.getBoundingClientRect().right - 0.5 : null, forecastRows: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="true"]').length, forecastChips: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="true"] .chip--fc').length, factRows: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="false"]').length, factChips: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="false"] .chip--fc, .log__row[data-tl="era"][data-forecast="false"] .log__basis').length, basis: s.querySelectorAll('.log__row[data-tl="era"][data-forecast="true"] .log__basis').length, projRows: s.querySelectorAll('.log__row[data-tl="proj"]').length, eraPic: sz(pic), picFilter: getComputedStyle(pic.querySelector('svg')).filter,
      phone: { marks: phMarks.length, markInPic: phMarks.every((m) => inside(m, m.closest('.era'))), markBeside: phMarks.length ? phMarks[0].getBoundingClientRect().left >= phPic.getBoundingClientRect().right - 0.5 : null, eraPic: sz(phPic) },
      end: { marks: endScene.querySelectorAll('.era__fc').length, picFilter: getComputedStyle(endScene.querySelector('.era__pic svg')).filter, future: endScene.querySelector('.era').getAttribute('data-future'), eraPic: sz(endScene.querySelector('.era__pic')) },
      colGap: Math.abs(s.querySelector('.ew__appliedcol').getBoundingClientRect().bottom - s.querySelector('.ew__log').getBoundingClientRect().bottom) };
    const chip = s.querySelector('.chip--fc'); const cc = getComputedStyle(chip);
    const useBoxes = [...document.querySelectorAll('.ew__zoom use')].slice(0, 80).map((u) => { try { const b = u.getBBox(); return b.width * b.height; } catch { return 0; } });
    const capOf = (f) => ({ year: f.querySelector('.ew__year')?.textContent, name: f.querySelector('.ew__name')?.textContent, line: f.querySelector('.ew__line')?.textContent, draws: f.querySelector('.ew__draws')?.textContent, ft3: f.querySelector('.ew__ft3')?.textContent, band: f.querySelector('.ew__band')?.textContent || '' });
    const stripMarks = [...document.querySelectorAll('.ew__strip[data-strip="draft-mark"] .ew__fig')].map((f) => f.querySelectorAll('.era__fc').length);
    const endStrip = document.querySelector('.ew__strip[data-strip="draft"] .ew__fig[data-u="U44"] .ew__pic svg');
    return {
      pieces: grid.length, zooms: zooms.length, strips, pairs, applied,
      chip: { h: sz(chip)[1], w: sz(chip)[0], color: cc.color, bg: cc.backgroundColor, border: cc.borderTopColor, radius: cc.borderTopLeftRadius, borderW: cc.borderTopWidth, font: cc.fontSize },
      picPc: grid[0] && sz(grid[0].querySelector('.ew__pic')), picZoom: zooms[0] && sz(zooms[0].querySelector('.ew__pic')), picStrip: sz(document.querySelector('.ew__strip .ew__pic')),
      caps: grid.map(capOf), stripMarks, endStripFilter: endStrip ? getComputedStyle(endStrip).filter : null,
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
  if (m.strips.length !== EXPECT.strips || m.strips.some((n) => n !== 18)) problems.push(`${label}: 띠 ${m.strips.join('/')}(18×${EXPECT.strips} 기대)`);
  for (const [k, n] of Object.entries(EXPECT.pairs)) if (m.pairs[k] !== n) problems.push(`${label}: 짝 ${k} ${m.pairs[k]}(${n} 기대)`);
  const a = m.applied;
  if (a.marks !== 1 || !a.markInPic) problems.push(`${label}: 적용 모습 창 표 ${a.marks}(1, 칸 안 기대) 칸 안 ${a.markInPic}`);
  const narrow = a.eraPic[0] === 100; if (a.markBeside !== narrow) problems.push(`${label}: 창 표 자리 — 그림 옆 ${a.markBeside}(띠 ${narrow} 기대)`);
  if (a.phone.marks !== 1 || !a.phone.markInPic || a.phone.markBeside !== true || a.phone.eraPic[0] !== 100 || a.phone.eraPic[1] !== 80) problems.push(`${label}: 휴대폰 폭 모형 — 표 ${a.phone.marks} 칸 안 ${a.phone.markInPic} 그림 옆 ${a.phone.markBeside} 그림 ${a.phone.eraPic}(1 · true · true · 100×80 기대)`);
  if (a.end.marks !== 0 || a.end.future !== null || (!forced && a.end.picFilter !== 'none')) problems.push(`${label}: 끝 장면 카드 — 표 ${a.end.marks} data-future ${a.end.future} 필터 ${a.end.picFilter}(0 · 없음 · none 기대)`);
  if (a.forecastRows !== EXPECT.forecastRows || a.forecastChips !== a.forecastRows || a.basis !== a.forecastRows) problems.push(`${label}: 예측 줄 ${a.forecastRows} 칩 ${a.forecastChips} 근거 ${a.basis}(${EXPECT.forecastRows} 기대)`);
  if (a.factRows !== EXPECT.factRows || a.factChips !== 0) problems.push(`${label}: 끝 줄 ${a.factRows}(1 기대) 칩·근거 ${a.factChips}(0 기대)`);
  if (a.projRows !== 1) problems.push(`${label}: 「전망」 줄 ${a.projRows}(1 기대)`);
  if (!forced && !/saturate/.test(a.picFilter)) problems.push(`${label}: 창 그림에 밑그림 톤 없음(${a.picFilter})`);
  if (!forced && m.endStripFilter !== 'none') problems.push(`${label}: 톤 띠의 끝 장면에 톤이 걸렸다(${m.endStripFilter})`);
  if (m.stripMarks.length !== 18 || m.stripMarks.slice(0, 17).some((n) => n !== 1) || m.stripMarks[17] !== 0) problems.push(`${label}: 톤+표 띠의 표 수 ${m.stripMarks.join('')}(17장 1 · 끝 장면 0 기대)`);
  if (forced && (m.chip.borderW === '0px' || m.chip.color === m.chip.bg)) problems.push(`${label}: 강제 색상에서 칩 테두리·글자가 안 남는다 ${JSON.stringify(m.chip)}`);
  if (m.chip.radius === '999px' || m.chip.radius === '9999px') problems.push(`${label}: 칩이 알약 모양(${m.chip.radius}) — 꼬리표여야 한다`);
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
  notes.push(`sheet-1280: 높이 ${m.height} · 그림 ${m.pieces} · 확대 ${m.zooms} · 띠 ${m.strips.join('/')} · 짝 ${JSON.stringify(m.pairs)} · 적용 ${JSON.stringify(m.applied)} · 칩 ${JSON.stringify(m.chip)} · use ${m.useCount}(검사 ${m.useChecked}, 빈 것 ${m.useEmpty}) · 글자 px ${m.fontPx.join('/')}`);
  const parts = Math.ceil(m.height / MAX_PART);
  for (let i = 0; i < parts; i++) {
    const file = `${OUT}era-r8-sheet${i ? `-${i + 1}` : ''}.jpg`;
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72, clip: { x: 0, y: i * MAX_PART, width: 1280, height: Math.min(MAX_PART, m.height - i * MAX_PART) } });
    saved(file, 1500);
  }
  for (let i = parts; i < 6; i++) { const f = `${OUT}era-r8-sheet-${i + 1}.jpg`; if (existsSync(f)) unlinkSync(f); }
  notes.push(`sheet parts: ${parts}`);
  await ctx.close();
}
// ② 적용 모습 — 1280 라이트·다크·강제 색상
{
  const items = [];
  for (const [label, opt, cap] of [['light', {}, '라이트 1280'], ['dark', { dark: true, q: 'theme=dark' }, '다크 1280'], ['forced', { forced: true }, '강제 색상 1280(칩 면 Canvas · 글자·테두리 CanvasText — 글자·아이콘·모양이 남는다)']]) {
    const { ctx, page } = await open({ view: { width: 1280, height: 800 }, ...opt });
    await check(page, `applied-1280-${label}`, { forced: !!opt.forced });
    const clip = await sectionOf(page, 'applied', 'bands');
    const f = `${TMP}applied-1280-${label}.png`; await page.screenshot({ path: f, fullPage: true, clip }); items.push([f, cap, 1120]);
    await ctx.close();
  }
  await composite(`${OUT}era-r8-applied.jpg`, items, '시대의 창 8차 — 확정 칩(안 B 줄과 창)·톤(안 1 밑그림)이 적용된 2065년 집과 가족 카드 · 2111년 끝 장면 카드(표·톤 없음) · 2065~2110 인생 기록 발췌 — 1280 라이트 · 다크 · 강제 색상 (시안 · 승인 전)', { width: 1180 });
}
// ③ 적용 모습 — 360 라이트·다크·강제 색상 + 320 글자 200%
{
  const items = [];
  for (const [label, view, opt, cap] of [['360-light', { width: 360, height: 740 }, { dpr: 2 }, '360 라이트'], ['360-dark', { width: 360, height: 740 }, { dpr: 2, dark: true, q: 'theme=dark' }, '360 다크'], ['360-forced', { width: 360, height: 740 }, { dpr: 2, forced: true }, '360 강제 색상'], ['320-text200', { width: 320, height: 640 }, { dpr: 2, text: 200 }, '320 · 글자 200% — 표지·칩·근거 글자가 다음 줄로 내려가고 가로 넘침 0']]) {
    const { ctx, page } = await open({ view, ...opt });
    const m = await check(page, `applied-${label}`, { forced: !!opt.forced });
    notes.push(`applied-${label}: 창 ${m.applied.eraPic} · 표 그림 옆 ${m.applied.markBeside} · 끝 장면 표 ${m.applied.end.marks} · 칩 ${m.chip.w}×${m.chip.h}`);
    const clip = await sectionOf(page, 'applied', 'bands');
    const f = `${TMP}applied-${label}.png`; await page.screenshot({ path: f, fullPage: true, clip: { ...clip, height: Math.min(clip.height, 7000) } }); items.push([f, cap, view.width]);
    await ctx.close();
  }
  await composite(`${OUT}era-r8-applied-360.jpg`, items, '시대의 창 8차 — 적용 모습 · 360 라이트 · 다크 · 강제 색상 · 320 글자 200% (시안 · 승인 전)', { width: 1480 });
}
// ④ 360 휴대폰 — 2065 둘 · 2095 둘 · 일상 다섯 묶음 · 끝 장면 · 띠(톤 · 톤+표) 라이트 + 톤 띠 다크
{
  const items = [];
  const { ctx, page } = await open({ view: { width: 360, height: 740 }, dpr: 2 });
  const m = await check(page, 'strip-360-light');
  if (!m.picStrip || m.picStrip[0] !== 100 || m.picStrip[1] !== 80) problems.push(`strip-360-light: 띠 그림 ${m.picStrip}(100×80 기대)`);
  const shots = [['.ew__grid3[data-pair="2065"]', 'pair-2065', '2065 — 어려운 쪽·가운데 U27 / 부유한 쪽 U28(360 폭)'], ['.ew__grid3[data-pair="2095"]', 'pair-2095', '2095 — 어려운 쪽·가운데 U37 ○ / 부유한 쪽 U38(360 폭)'], ['.ew__grid3[data-pair="2060s"]', 'daily-2060s', '2060년대 일상 — U29 · U30'], ['.ew__grid3[data-pair="2070s"]', 'daily-2070s', '2070년대 일상 — U32 · U33'], ['.ew__grid3[data-pair="2080s"]', 'daily-2080s', '2080년대 일상 — U35 · U36'], ['.ew__grid3[data-pair="2090s"]', 'daily-2090s', '2090년대 일상 — U39 · U40'], ['.ew__grid3[data-pair="2100s"]', 'daily-2100s', '2100년대 일상 — U42 · U43'], ['.ew__grid3[data-pair="end"]', 'end', '끝 장면 U44 — 2110년부터(칩·표·톤 없음)'], ['.ew__strip[data-strip="draft"]', 'strip-draft', '열여덟 장 띠(100×80) · 밑그림 톤(끝 장면은 톤 없음)'], ['.ew__strip[data-strip="draft-mark"]', 'strip-draft-mark', '열여덟 장 띠 · 밑그림 톤 + 창 표 — 휴대폰 띠 326×80, 표는 그림 옆(끝 장면은 표 없음)']];
  for (const [sel, name, cap] of shots) { const f = `${TMP}${name}.png`; await page.locator(sel).screenshot({ path: f }); items.push([f, cap, 360]); }
  await ctx.close();
  const d = await open({ view: { width: 360, height: 740 }, dpr: 2, dark: true, q: 'theme=dark' });
  await check(d.page, 'strip-360-dark');
  const fd = `${TMP}strip-draft-dark.png`; await d.page.locator('.ew__strip[data-strip="draft"]').screenshot({ path: fd }); items.push([fd, '열여덟 장 띠 · 밑그림 톤 · 다크', 360]);
  const fd2 = `${TMP}pair-2065-dark.png`; await d.page.locator('.ew__grid3[data-pair="2065"]').screenshot({ path: fd2 }); items.push([fd2, '2065 두 장 · 다크', 360]);
  await d.ctx.close();
  await composite(`${OUT}era-r8-strip-360.jpg`, items, '시대의 창 8차 — 360×740 휴대폰 · 2065 둘 · 2095 둘 · 일상 다섯 묶음 · 끝 장면 · 열여덟 장 띠(FM2d 80px) (시안 · 승인 전)', { width: 1180 });
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
