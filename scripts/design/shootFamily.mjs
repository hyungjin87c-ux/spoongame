/**
 * SPEC-009 집과 가족 그림 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/ (designer 2026-10-27).
 * 실행: node scripts/design/shootFamily.mjs            ← FM2b 정본 캡처 4장 + 검사 (그림체 종이 오림, 장면 c·d·e + 매체 자리)
 *       node scripts/design/shootFamily.mjs preview    ← 작업 중 미리보기(.taste-skill/009/preview/, 저장소에 올리지 않는다)
 *       node scripts/design/shootFamily.mjs fm2        ← FM2 게이트 캡처 6장(그림체 둘 — 먼저 buildFamilyMockups.mjs --with-s2)
 *   시안은 먼저 `node scripts/design/buildFamilyMockups.mjs`로 만든다. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://).
 * FM2b 캡처(4장, ≤ 300 KB):
 *   fm2b-scene-c.png · fm2b-scene-d.png — 라이트 520px · 다크 520px · 라이트 328px(휴대폰 카드 폭) 합성
 *   fm2b-scene-e.png — 한계 장면(8명 + 2마리): 라이트 520 · 다크 520 · **360×740 대시보드(한 줄 줄 수 확인)**
 *   fm2b-tv-slots.png — 매체(라디오·TV) 자리와 빈 화면 슬롯 확대(장면 a·b·c·d·e, ×3)
 * 검사: 문서·요소 가로 넘침 0(1280·360·320 글자 200%), 그림 높이 ≤ 25vh, 카드 순서(결정 → 그림 → 기록), 접기 키보드, 대체 글, 한계 장면 한 줄 ≤ 2줄@360, 다크·강제 색상, 외부 요청 0.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/';
const MODE = process.argv[2] || 'fm2b';
const PREVIEW = MODE === 'preview';
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
  const figs = items.map(([f, cap, w]) => `<figure${w ? ` style="width:${w}px"` : ''}><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt=""${w ? ` style="width:${w}px"` : ''}><figcaption>${cap}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-direction:${row ? 'row' : 'column'};flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0;flex:none;min-width:0}img{display:block;height:auto;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.screenshot({ path: outFile, fullPage: true });
  saved(outFile);
  await ctx.close();
}
const dashMeasure = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const order = [...document.querySelectorAll('main.dash .card')].map((c) => ({ top: Math.round(c.getBoundingClientRect().top), left: Math.round(c.getBoundingClientRect().left), cls: c.className.split(' ').filter((x) => x !== 'card')[0] }));
    const pic = r('.scene__svg');
    const svg = document.querySelector('.scene__svg');
    const ids = (svg && svg.getAttribute('aria-labelledby')) || '';
    const alt = ids.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    const line = document.querySelector('.scene__line');
    const lh = line ? parseFloat(getComputedStyle(line).lineHeight) : 0;
    const lines = line ? Math.round(line.getBoundingClientRect().height / lh) : 0;
    return { vw: innerWidth, vh: innerHeight, picH: pic && Math.round(pic.height), picW: pic && Math.round(pic.width), picTop: pic && Math.round(pic.top), maxH: Math.round(innerHeight * 0.25), order, alt, lines, lineText: line && line.textContent, fold: (document.querySelector('.scene-card') || {}).dataset?.fold, foldName: (document.querySelector('.scene__fold') || {}).textContent };
  });
const SCENE_CAP = {
  a: '장면 A · 1975년 서울 성북구 · 단독주택 셋방 · 6명 · 마당 개 · 흑백 텔레비전(창 너머)',
  b: '장면 B · 2005년 경기 안양시 동안구 · 아파트 · 3명 · 집 안 고양이 · 컬러 텔레비전(창 너머)',
  c: '장면 C · 1955년 전남 고흥군 · 초가 단독주택 3세대 · 7명(나는 업힌 아기) · 마당 개 · 라디오(마루)',
  d: '장면 D · 2015년 서울 관악구 · 다세대주택 · 3명 · 집 안 개 · 벽걸이 텔레비전(창 너머)',
  e: '장면 E(한계) · 1968년 대구 중구 · 기와 단독주택 · 8명 · 마당 개 + 마루 고양이 · 라디오(마루)',
};

if (MODE === 'fm2') {
  // ---------- FM2 게이트 기록(그림체 둘 — compare.html은 --with-s2 빌드에서만 갱신) ----------
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
      const name = { s1: '그림체 1 · 종이 오림', s2: '그림체 2 · 굵은 선 그림책' }[s];
      await composite(`${OUT}fm2-${s}-scene-${k}.png`, items, `${name} — ${SCENE_CAP[k]} (시안 · 가짜 이름·나이)`, { row: true, width: 1120 });
    }
  }
} else {
  // ---------- ① 장면 c·d 합성(라이트 520 · 다크 520 · 라이트 328) ----------
  const shot = async (k, label, q, opt, w) => {
    const { ctx, page } = await open({ file: 'scenes', q, view: { width: 1120, height: 900 }, ...opt });
    await check(page, `scenes ${k} ${label}`);
    const f = `${TMP}s1-${k}-${w}${opt.dark ? '-dark' : ''}.png`;
    await page.locator(`.cmp__fig[data-scene="${k}"]`).screenshot({ path: f });
    await ctx.close();
    return [f, label, w];
  };
  for (const k of ['c', 'd']) {
    const items = [];
    for (const [label, q, opt, w] of [['라이트 · 520px(PC 가운데 열)', 'w=520', {}, 520], ['다크', 'w=520&theme=dark', { dark: true }, 520], ['라이트 · 328px(휴대폰 360 카드 폭)', 'w=328', { dpr: 2 }, 328]]) items.push(await shot(k, label, q, opt, w));
    await composite(`${OUT}fm2b-scene-${k}.png`, items, `종이 오림 — ${SCENE_CAP[k]} (시안 · 가짜 이름·나이 · 화면은 빈 자리)`, { row: true, width: 1120 });
  }
  // ---------- ② 한계 장면 e: 라이트 520 · 다크 520 · 360×740 대시보드(한 줄 줄 수) ----------
  {
    const items = [await shot('e', '라이트 · 520px(PC 가운데 열)', 'w=520', {}, 520), await shot('e', '다크', 'w=520&theme=dark', { dark: true }, 520)];
    const { ctx, page } = await open({ file: 'dashboard-family', q: 'scene=e', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
    await check(page, 'fm2b-dash-e-360');
    const m = await dashMeasure(page);
    notes.push(`dash-e-360: ${JSON.stringify({ picW: m.picW, picH: m.picH, maxH: m.maxH, lines: m.lines, lineText: m.lineText, alt: m.alt })}`);
    if (m.picH > m.maxH) problems.push(`360×740 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
    if (m.lines > 2) problems.push(`한계 장면 한 줄이 360에서 ${m.lines}줄(> 2)`);
    await page.evaluate(() => { const el = document.querySelector('.scene-card'); const head = document.querySelector('.dash-head').getBoundingClientRect().height; window.scrollBy(0, el.getBoundingClientRect().top - head - 8); });
    await page.waitForTimeout(150);
    const f = `${TMP}dash-e-360.png`;
    await page.screenshot({ path: f });
    await ctx.close();
    items.push([f, `360×740 대시보드 · 한 줄 ${m.lines}줄(${m.lineText.length}자)`, 360]);
    await composite(`${OUT}fm2b-scene-e.png`, items, `종이 오림 — ${SCENE_CAP.e} · 아래 한 줄이 가장 길어지는 경우 (시안 · 가짜 이름·나이)`, { row: true, width: 1120 });
  }
  // ---------- ③ 매체 자리 확대(장면마다 ×3) ----------
  {
    const items = [];
    for (const k of ['a', 'b', 'c', 'd', 'e']) {
      const { ctx, page } = await open({ file: 'scenes', q: 'w=520', view: { width: 1120, height: 900 }, dpr: 3 });
      const info = await page.evaluate((k) => {
        const fig = document.querySelector(`.cmp__fig[data-scene="${k}"]`);
        fig.scrollIntoView({ block: 'center' });
        const m = fig.querySelector('[data-layer="매체"] [data-piece]');
        if (!m) return null;
        const r = m.getBoundingClientRect();
        const fr = fig.querySelector('.scene__svg').getBoundingClientRect();
        return { id: m.dataset.piece, x: r.x, y: r.y, w: r.width, h: r.height, scale: fr.width / 640, pic: { x: fr.x, y: fr.y, r: fr.right, b: fr.bottom } };
      }, k);
      if (!info) { await ctx.close(); continue; }
      const pad = 36;
      const f = `${TMP}media-${k}.png`;
      // 그림 영역 안으로 자른다(제목 글자가 들어오지 않게)
      const x0 = Math.max(info.pic.x, info.x - pad), y0 = Math.max(info.pic.y, info.y - pad);
      const x1 = Math.min(info.pic.r, info.x + info.w + pad), y1 = Math.min(info.pic.b, info.y + info.h + pad);
      await page.screenshot({ path: f, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
      const sc = JSON.parse(readFileSync(ROOT + 'docs/design/mockups/family/scenes.json', 'utf8')).scenes.find((s) => s.id === k);
      const slot = sc.screen ? `빈 화면 자리 ${sc.screen.units.join('×')}단위 = PC ${sc.screen.pc.join('×')}px · 휴대폰 ${sc.screen.mobile.join('×')}px` : '화면 없음(라디오)';
      items.push([f, `${k.toUpperCase()} ${sc.year} · ${info.id} · 조각 ${Math.round(info.w / info.scale)}×${Math.round(info.h / info.scale)}단위 · ${slot}`, Math.round((x1 - x0) * 3)]);
      notes.push(`media ${k}: ${info.id} ${Math.round(info.w)}×${Math.round(info.h)}px@520 ${slot}`);
      await ctx.close();
    }
    // 화면 표본 둘(FT2) — scenes.html #screen-samples
    {
      const { ctx, page } = await open({ file: 'scenes', view: { width: 1120, height: 900 } });
      for (const fig of await page.locator('#screen-samples .cmp__fig').all()) {
        const id = await fig.getAttribute('data-sample');
        const f = `${TMP}sample-${id}.png`;
        await fig.scrollIntoViewIfNeeded();
        await fig.screenshot({ path: f });
        const cap = await fig.locator('figcaption').textContent();
        items.push([f, `화면 표본 ${id} — ${cap}`, 520]);
      }
      await ctx.close();
    }
    await composite(`${OUT}fm2b-tv-slots.png`, items, '매체(라디오·텔레비전) 자리(FT1) — 시대 소품 층, 집의 실내 자리(창 너머·마루). 위: 장면별 자리와 빈 화면 슬롯(×3, 520px 기준) · 아래: 화면 속 그해의 장면 표본 둘(FT2, 승인 전) (시안)', { row: true, width: 1120 });
  }
  // ---------- ④ 검사만(임시 샷): 1280 자리·순서·접기 키보드 · 다크 · 강제 · 320 글자 200% · 접힘 · 1920 ----------
  {
    const { ctx, page } = await open({ file: 'dashboard-family', q: 'scene=c&decision=fold', view: { width: 1280, height: 800 } });
    await check(page, 'dash-c-1280');
    const m = await dashMeasure(page);
    notes.push(`dash-c-1280: 그림 ${m.picW}×${m.picH}(25vh ${m.maxH}) 순서 ${m.order.filter((o) => o.left === m.order.find((x) => x.cls === 'scene-card').left).sort((a, b) => a.top - b.top).map((o) => o.cls).join(' → ')} 대체 글 「${m.alt}」`);
    if (m.picH > m.maxH) problems.push(`1280×800 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
    await page.focus('.scene__fold');
    await page.keyboard.press('Enter');
    const folded = await dashMeasure(page);
    await page.keyboard.press('Enter');
    const unfolded = await dashMeasure(page);
    if (folded.fold !== 'true' || unfolded.fold !== 'false') problems.push('접기 버튼 키보드 동작 실패');
    await page.screenshot({ path: `${TMP}dash-c-1280.png` });
    await ctx.close();
  }
  for (const [label, q, view, opt] of [
    ['dash-dark-1280-d', 'scene=d&theme=dark&decision=fold', { width: 1280, height: 800 }, { dark: true }],
    ['dash-dark-360-c', 'scene=c&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }],
    ['dash-forced-1280-e', 'scene=e&decision=fold', { width: 1280, height: 800 }, { forced: true }],
    ['dash-forced-360-d', 'scene=d', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
    ['dash-320-text200-e', 'scene=e&open=1', { width: 320, height: 640 }, { text: 200 }],
    ['dash-fold-360-e', 'scene=e&fold=1', { width: 360, height: 740 }, { dpr: 2 }],
    ['dash-1920-d', 'scene=d', { width: 1920, height: 1080 }, {}],
    ['dash-decision-open-1280-e', 'scene=e', { width: 1280, height: 800 }, {}],
    ['dash-360-e-open', 'scene=e&open=1', { width: 360, height: 740 }, { dpr: 2 }],
  ]) {
    const { ctx, page } = await open({ file: 'dashboard-family', q, view, ...opt });
    await check(page, label);
    const m = await dashMeasure(page);
    if (m.picH !== null && m.picH > m.maxH) problems.push(`${label} 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
    if (m.lines > 2 && view.width >= 360) problems.push(`${label} 한 줄 ${m.lines}줄`);
    notes.push(`${label}: 그림 ${m.picW}×${m.picH}(25vh ${m.maxH}) 한 줄 ${m.lines}줄 접힘 ${m.fold} · 순서 ${m.order.filter((o) => o.left === m.order.find((x) => x.cls === 'scene-card').left).sort((a, b) => a.top - b.top).map((o) => o.cls).join(' → ')}`);
    await page.evaluate(() => { const el = document.querySelector('.scene-card'); if (el) el.scrollIntoView({ block: 'start' }); });
    await page.screenshot({ path: `${TMP}${label}.png` });
    await ctx.close();
  }
  // scenes.html 전체(라이트·다크·360) 넘침
  for (const [label, q, view, opt] of [['scenes-1280', '', { width: 1280, height: 800 }, {}], ['scenes-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }], ['scenes-360', '', { width: 360, height: 740 }, { dpr: 2 }]]) {
    const { ctx, page } = await open({ file: 'scenes', q, view, ...opt });
    await check(page, label);
    await page.screenshot({ path: `${TMP}${label}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();

console.log('\n--- 측정 ---');
for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('\n외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('\n문제 0');
