/**
 * SPEC-013 T5 「시대의 창」 10차 시트를 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/013/ (designer 2026-11-08, r10).
 * 실행: node scripts/design/shootEraWindowR10.mjs      ← 먼저 `node scripts/design/buildEraWindowR10.mjs`. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 띄운 프로세스는 자기 것만 닫는다.
 * 캡처(JPEG — 마스터 허용):
 *   era-r10-cards-360.jpg — 형진 님께 보일 한 장(360 휴대폰 폭 · 카드 절만 `?only=cards`: 사건 14 × 띠 326×80 + 캡션 + 첫 문장·둘째 문장 + 두 안)
 *   era-r10-cards-360-dark.jpg — 같은 절 다크
 *   era-r10-sheet.jpg(, -2, -3 …) — 1280 PC · 시트 전체를 세로 8000px 이하로 나눠 저장
 *   era-r10-before-after.jpg — 수정 여섯의 전·후 절(1280)
 * 검사: 가로 넘침 0(1280 · 360 · 360 글자 200% · 다크 · 강제 색상), 사건 14 · 두 안 2 · 전·후 6 · 확대 16, 창 칸 PC 175×140(그림 175×118) · 띠 326×80(그림 100×78), 캡션 글자 모두 있음·칸 안, 외부 요청 0, use가 실제로 그려지는지, 캡처 ≤ 300KB.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, statSync, unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/era-window-r10.html';
const OUT = ROOT + 'docs/design/screens/013/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);
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
const overflowReport = (page) => page.evaluate(() => {
  const out = []; const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth) out.push(`문서 가로 넘침 ${de.scrollWidth} > ${de.clientWidth}`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || el.closest('pre')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
    if (/(auto|scroll)/.test(cs.overflowX) || /hidden/.test(cs.overflow) || el.closest('.ew__tablewrap')) continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
    if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
  }
  return out;
});
const measure = (page) => page.evaluate(() => {
  const sz = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
  const inside = (m, host) => { const a = m.getBoundingClientRect(), b = host.getBoundingClientRect(); return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5; };
  const events = [...document.querySelectorAll('.ew__event')];
  const variants = document.querySelectorAll('.ew__variant').length;
  const ba = document.querySelectorAll('.ew__ba').length;
  const zooms = document.querySelectorAll('.ew__zoom .ew__fig').length;
  const pc = [...document.querySelectorAll('.ew__era:not(.ew__era--phone)')].filter((e) => getComputedStyle(e).display !== 'none');
  const ph = [...document.querySelectorAll('.ew__era--phone')];
  const caps = [...document.querySelectorAll('.ew__era [data-testid="era-cap"]')].filter((c) => getComputedStyle(c.closest('.ew__era')).display !== 'none');
  const capsInside = caps.every((c) => inside(c, c.closest('.ew__era')) && c.textContent.trim().length > 0);
  const capsOverPic = caps.filter((c) => { const p = c.closest('.ew__era').querySelector('.ew__pic'); const a = c.getBoundingClientRect(), b = p.getBoundingClientRect(); return a.top < b.bottom - 0.5 && a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.bottom > b.top + 0.5; }).length;
  const uses = [...document.querySelectorAll('.ew__cards .ew__era--phone use')].slice(0, 120);
  const emptyUse = uses.filter((u) => { const b = u.getBBox(); return b.width === 0 || b.height === 0; }).length;
  const fontSizes = [...new Set([...document.querySelectorAll('.ew p, .ew span, .ew td, .ew th, .ew h1, .ew h2, .ew h3, .ew dd, .ew dt')].map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize))))].sort((a, b) => a - b);
  const approveBoxes = document.querySelectorAll('.ew__approve').length;
  return { events: events.length, eventIds: events.map((e) => e.dataset.event), variants, ba, zooms, pcCells: pc.length, pcSize: pc.length ? sz(pc[0]) : null, pcPic: pc.length ? sz(pc[0].querySelector('.ew__pic')) : null, phoneCells: ph.length, phoneSize: ph.length ? sz(ph[0]) : null, phonePic: ph.length ? sz(ph[0].querySelector('.ew__pic')) : null, caps: caps.length, capsInside, capsOverPic, usesChecked: uses.length, emptyUse, fontSizes, approveBoxes, docH: document.documentElement.scrollHeight };
});
async function shootParts(page, base) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const w = page.viewportSize().width; const parts = Math.ceil(h / MAX_PART); const files = [];
  for (let i = 0; i < parts; i++) { const f = `${OUT}${base}${i ? `-${i + 1}` : ''}.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 80, clip: { x: 0, y: i * MAX_PART, width: w, height: Math.min(MAX_PART, h - i * MAX_PART) }, fullPage: true }); files.push(f); }
  return files;
}
for (const f of ['era-r10-cards-360.jpg', 'era-r10-cards-360-dark.jpg', 'era-r10-sheet.jpg', 'era-r10-sheet-2.jpg', 'era-r10-sheet-3.jpg', 'era-r10-sheet-4.jpg', 'era-r10-before-after.jpg']) if (existsSync(OUT + f)) unlinkSync(OUT + f);

// 1280 PC — 전체 시트 + 측정
{
  const { ctx, page } = await open({ view: { width: 1280, height: 900 } });
  const m = await measure(page); notes.push({ view: '1280', ...m });
  if (m.events !== 14) problems.push(`사건 ${m.events}(14 기대)`);
  if (m.variants !== 2) problems.push(`두 안 ${m.variants}(2 기대)`);
  if (m.ba !== 6) problems.push(`전·후 ${m.ba}(6 기대)`);
  if (m.zooms !== 16) problems.push(`확대 ${m.zooms}(16 기대)`);
  if (!m.pcSize || m.pcSize[0] !== 175 || m.pcSize[1] !== 140) problems.push(`PC 창 칸 ${m.pcSize}(175×140 기대)`);
  if (!m.pcPic || m.pcPic[0] !== 173 || Math.abs(m.pcPic[1] - 117) > 2) problems.push(`PC 그림 상자 ${m.pcPic}(173×117 안팎 기대 — 테두리 1px 안)`);
  if (!m.phoneSize || m.phoneSize[0] !== 326 || m.phoneSize[1] !== 80) problems.push(`띠 ${m.phoneSize}(326×80 기대)`);
  if (!m.phonePic || m.phonePic[0] !== 100 || m.phonePic[1] !== 78) problems.push(`띠 그림 ${m.phonePic}(100×78 기대)`);
  if (m.caps !== m.pcCells + m.phoneCells) problems.push(`캡션 ${m.caps} ≠ 칸 ${m.pcCells + m.phoneCells}`);
  if (!m.capsInside) problems.push('캡션이 칸 밖이거나 비어 있음');
  if (m.capsOverPic) problems.push(`캡션이 그림을 가림 ${m.capsOverPic}`);
  if (m.emptyUse) problems.push(`빈 use ${m.emptyUse}/${m.usesChecked}`);
  if (m.fontSizes[0] < 12) problems.push(`글자 ${m.fontSizes[0]}px < 12`);
  const ov = await overflowReport(page); if (ov.length) problems.push(`1280 넘침: ${ov.slice(0, 5).join(' | ')}`);
  const files = await shootParts(page, 'era-r10-sheet'); notes.push({ sheet: files.map((f) => `${f.split('/').pop()} ${kb(f)}KB`) });
  const ba = page.locator('.ew__bas'); await ba.screenshot({ path: OUT + 'era-r10-before-after.jpg', type: 'jpeg', quality: 82 });
  await ctx.close();
}
// 360 휴대폰 — 카드 절만(형진 님께 보일 한 장) 라이트 · 다크, 글자 200%·강제 색상은 검사만
for (const v of [{ q: 'only=cards', file: 'era-r10-cards-360.jpg' }, { q: 'only=cards&theme=dark', dark: true, file: 'era-r10-cards-360-dark.jpg' }, { q: 'only=cards', text: 200 }, { q: 'only=cards', forced: true }]) {
  const { ctx, page } = await open({ q: v.q, view: { width: 360, height: 740 }, dark: !!v.dark, forced: !!v.forced, text: v.text });
  const m = await measure(page); notes.push({ view: `360 ${v.q}${v.text ? ` 글자 ${v.text}%` : ''}${v.forced ? ' 강제 색상' : ''}${v.dark ? ' 다크' : ''}`, events: m.events, phoneCells: m.phoneCells, phoneSize: m.phoneSize, caps: m.caps, capsInside: m.capsInside, capsOverPic: m.capsOverPic, docH: m.docH });
  if (m.events !== 14) problems.push(`360 사건 ${m.events}`);
  if (!m.capsInside) problems.push(`360 ${v.q} 캡션이 칸 밖`);
  if (m.capsOverPic) problems.push(`360 ${v.q} 캡션이 그림을 가림 ${m.capsOverPic}`);
  if (m.phoneSize && (m.phoneSize[0] > 328 || (v.text === undefined && m.phoneSize[1] !== 80))) problems.push(`360 띠 크기 ${m.phoneSize}`);
  const ov = await overflowReport(page); if (ov.length) problems.push(`360 ${v.q}${v.text ? ' 200%' : ''} 넘침: ${ov.slice(0, 5).join(' | ')}`);
  if (v.file) { const h = m.docH; if (h > MAX_PART) problems.push(`360 카드 절 ${h}px > ${MAX_PART}`); await page.screenshot({ path: OUT + v.file, type: 'jpeg', quality: 66, fullPage: true }); notes.push({ file: v.file, kb: kb(OUT + v.file), h }); }
  await ctx.close();
}
await browser.close();
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
for (const f of ['era-r10-cards-360.jpg', 'era-r10-cards-360-dark.jpg', 'era-r10-before-after.jpg']) if (existsSync(OUT + f) && kb(OUT + f) > 300) problems.push(`${f} ${kb(OUT + f)}KB > 300`);
writeFileSync(OUT + 'era-r10-measure.json', JSON.stringify({ measuredAt: '2026-11-08', problems, notes }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(notes, null, 1));
console.log(problems.length ? `문제 ${problems.length}:\n- ${problems.join('\n- ')}` : '문제 0');
