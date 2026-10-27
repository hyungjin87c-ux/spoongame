/**
 * SPEC-009 FM2 그림체 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/fm2-*.png (designer 2026-10-27).
 * 실행: node scripts/design/shootFamily.mjs            ← 정본 캡처 6장 + 검사
 *       node scripts/design/shootFamily.mjs preview    ← 작업 중 미리보기(.taste-skill/009/preview/, 저장소에 올리지 않는다)
 *   시안은 먼저 `node scripts/design/buildFamilyMockups.mjs`로 만든다. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://).
 * 캡처(6장, ≤ 300 KB):
 *   fm2-s1-scene-a.png · fm2-s1-scene-b.png · fm2-s2-scene-a.png · fm2-s2-scene-b.png — 그림체 × 장면, 한 장에 라이트 520px · 다크 520px · 라이트 328px(휴대폰 폭) 합성
 *   fm2-dash-1280x800.png(그림체 1 · 장면 A) · fm2-dash-360x740.png(그림체 2 · 장면 B — 두 그림체가 자리 캡처에 한 번씩)
 * 검사: 문서·요소 가로 넘침 0, 그림 높이 ≤ 25vh(1280×800 · 360×740), 카드 순서(결정 → 그림 → 기록), 접기 버튼 키보드 조작, 대체 글(aria-labelledby → 한 줄 + 반려동물 문장), 다크·강제 색상·움직임 줄이기·320 글자 200% 넘침, 외부 요청 0.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/';
const PREVIEW = process.argv.includes('preview');
const OUT = PREVIEW ? ROOT + '.taste-skill/009/preview/' : ROOT + 'docs/design/screens/009/';
const TMP = ROOT + '.taste-skill/009/shoot/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);

async function open({ file, q = '', view, dpr = 1, dark = false, forced = false, text, coarse = false, reduced = false }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: dpr, colorScheme: dark ? 'dark' : 'light', forcedColors: forced ? 'active' : 'none', hasTouch: coarse, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('request', (r) => { if (!r.url().startsWith('file:')) external.add(r.url()); });
  if (coarse) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] });
  }
  await page.goto(`${BASE}${file}.html${q ? `?${q}` : ''}`);
  if (text !== undefined) await page.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return { ctx, page };
}
const overflowReport = (page) =>
  page.evaluate(() => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) out.push(`문서 가로 넘침 ${de.scrollWidth} > ${de.clientWidth}`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || el.closest('template') || el.classList.contains('sr-only') || el.closest('.sr-only') || el.classList.contains('fit-pair__probe')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden' || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      if (/(auto|scroll)/.test(cs.overflowX) || /(hidden)/.test(cs.overflow)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
async function check(page, name) {
  const over = await overflowReport(page);
  if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
}
function saved(file) {
  const size = kb(file);
  if (size > 300) problems.push(`${file}: ${size} KB > 300 KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
/** 요소 샷 여러 장을 한 페이지에 모아 다시 찍는다(설명 글은 시안 표식 — 외부 자원 0) */
async function composite(outFile, items, title, { row = false, width = 1120 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = items.map(([f, cap, w]) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt=""${w ? ` style="width:${w}px"` : ''}><figcaption>${cap}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-direction:${row ? 'row' : 'column'};flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0;flex:none;min-width:0}img{display:block;height:auto;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.screenshot({ path: outFile, fullPage: true });
  saved(outFile);
  await ctx.close();
}

// ---------- ① 그림체 × 장면 합성 4장 ----------
for (const s of ['s1', 's2']) {
  for (const k of ['a', 'b']) {
    const items = [];
    for (const [label, q, opt, w] of [['라이트 · 520px(PC 가운데 열)', 'w=520', {}, 520], ['다크', 'w=520&theme=dark', { dark: true }, 520], ['라이트 · 328px(휴대폰 360 카드 폭)', 'w=328', { dpr: 2 }, 328]]) {
      const { ctx, page } = await open({ file: 'compare', q, view: { width: 1120, height: 900 }, ...opt });
      await check(page, `compare ${s}${k} ${label}`);
      const f = `${TMP}${s}-${k}-${w}${opt.dark ? '-dark' : ''}.png`;
      await page.locator(`.cmp__fig[data-style="${s}"][data-scene="${k}"]`).screenshot({ path: f });
      items.push([f, label, w]);
      await ctx.close();
    }
    const sc = { a: '장면 A · 1975년 서울 성북구 · 단독주택 셋방 · 부모님(30대)·누나 둘·할머니·나(아기)·마당 개', b: '장면 B · 2005년 경기 안양시 동안구 · 아파트 · 부모님(30대)·나(초등학생)·집 안 고양이' }[k];
    const name = { s1: '그림체 1 · 종이 오림', s2: '그림체 2 · 굵은 선 그림책' }[s];
    await composite(`${OUT}fm2-${s}-scene-${k}.png`, items, `${name} — ${sc} (시안 · 가짜 이름·나이)`, { row: true, width: 1120 });
  }
}

// ---------- ② 대시보드 자리 2장 + 검사 ----------
const dashMeasure = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const order = [...document.querySelectorAll('main.dash .card')].map((c) => ({ top: Math.round(c.getBoundingClientRect().top), left: Math.round(c.getBoundingClientRect().left), cls: c.className.split(' ').filter((x) => x !== 'card')[0] }));
    const pic = r('.scene__svg');
    const svg = document.querySelector('.scene__svg');
    const ids = (svg && svg.getAttribute('aria-labelledby')) || '';
    const alt = ids.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    return { vw: innerWidth, vh: innerHeight, picH: pic && Math.round(pic.height), picW: pic && Math.round(pic.width), picTop: pic && Math.round(pic.top), maxH: Math.round(innerHeight * 0.25), order, alt, fold: (document.querySelector('.scene-card') || {}).dataset?.fold, foldName: (document.querySelector('.scene__fold') || {}).textContent };
  });
{
  // 결정 카드는 「잠시 덮어 두기」로 접은 띠 상태 — 열린 카드는 한 화면을 다 차지해 그림이 아래로 밀리므로(FH1: 그림이 결정 카드를 밀어내지 않는다) 자리를 한 장에 보이려면 이 상태가 맞다. 열린 상태의 순서는 측정으로 확인한다(아래 dash-decision-open)
  const { ctx, page } = await open({ file: 'dashboard-family', q: 'style=s1&scene=a&decision=fold', view: { width: 1280, height: 800 } });
  await check(page, 'fm2-dash-1280x800');
  const m = await dashMeasure(page);
  notes.push(`fm2-dash-1280x800: ${JSON.stringify(m)}`);
  if (m.picH > m.maxH) problems.push(`1280×800 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
  await page.screenshot({ path: `${OUT}fm2-dash-1280x800.png` });
  saved(`${OUT}fm2-dash-1280x800.png`);
  // 키보드: 접기 버튼에 초점 → Enter → 접힘(그림 없음, 한 줄 남음) → Enter → 펼침
  await page.focus('.scene__fold');
  await page.keyboard.press('Enter');
  const folded = await dashMeasure(page);
  await page.keyboard.press('Enter');
  const unfolded = await dashMeasure(page);
  notes.push(`접기 키보드: 접힘 ${folded.fold} 「${folded.foldName}」 그림 ${folded.picH === null ? '없음' : folded.picH} → 펼침 ${unfolded.fold} 「${unfolded.foldName}」 그림 ${unfolded.picH}`);
  if (folded.fold !== 'true' || unfolded.fold !== 'false') problems.push('접기 버튼 키보드 동작 실패');
  await ctx.close();
}
{
  const { ctx, page } = await open({ file: 'dashboard-family', q: 'style=s2&scene=b&open=1', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
  await check(page, 'fm2-dash-360x740');
  const m = await dashMeasure(page);
  notes.push(`fm2-dash-360x740: ${JSON.stringify(m)}`);
  if (m.picH > m.maxH) problems.push(`360×740 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
  // 결정 카드 아래로 스크롤해 그림 카드가 화면에 들어오게
  await page.evaluate(() => { const el = document.querySelector('.scene-card'); const head = document.querySelector('.dash-head').getBoundingClientRect().height; window.scrollBy(0, el.getBoundingClientRect().top - head - 8); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}fm2-dash-360x740.png` });
  saved(`${OUT}fm2-dash-360x740.png`);
  await ctx.close();
}
// 검사만(임시 샷): 다크 1280 · 강제 색상 1280·360 · 움직임 줄이기 · 320 글자 200% · 접힌 상태 360 · 1920×1080 높이
for (const [label, q, view, opt] of [
  ['dash-dark-1280', 'style=s1&scene=a&theme=dark', { width: 1280, height: 800 }, { dark: true }],
  ['dash-dark-360', 'style=s2&scene=b&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }],
  ['dash-forced-1280', 'style=s2&scene=a', { width: 1280, height: 800 }, { forced: true }],
  ['dash-forced-360', 'style=s1&scene=b', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
  ['dash-reduced-1280', 'style=s1&scene=a&motion=reduce', { width: 1280, height: 800 }, { reduced: true }],
  ['dash-320-text200', 'style=s1&scene=a&open=1', { width: 320, height: 640 }, { text: 200 }],
  ['dash-fold-360', 'style=s1&scene=a&fold=1', { width: 360, height: 740 }, { dpr: 2 }],
  ['dash-1920x1080', 'style=s2&scene=b', { width: 1920, height: 1080 }, {}],
  ['dash-1280x620', 'style=s1&scene=a&decision=fold', { width: 1280, height: 620 }, {}],
  ['dash-decision-open-1280', 'style=s1&scene=a', { width: 1280, height: 800 }, {}],
]) {
  const { ctx, page } = await open({ file: 'dashboard-family', q, view, ...opt });
  await check(page, label);
  const m = await dashMeasure(page);
  if (m.picH !== null && m.picH > m.maxH) problems.push(`${label} 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
  notes.push(`${label}: 그림 ${m.picW}×${m.picH}(25vh ${m.maxH}) 접힘 ${m.fold} · 가운데 열 순서 ${m.order.filter((o) => o.left === m.order.find((x) => x.cls === 'scene-card').left).sort((a, b) => a.top - b.top).map((o) => o.cls).join(' → ')}`);
  await page.evaluate(() => { const el = document.querySelector('.scene-card'); if (el) el.scrollIntoView({ block: 'start' }); });
  await page.screenshot({ path: `${TMP}${label}.png` });
  await ctx.close();
}
await browser.close();

console.log('\n--- 측정 ---');
for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('\n외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('\n문제 0');
