/**
 * SPEC-004 GM3 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/004/gm3-*.png (designer 2026-10-27) · r2 gm3r2-*.png (2026-10-27 게이트 ③ 답 반영).
 * 실행: node scripts/design/shootGm3.mjs r2          ← r2 캡처 6장 + 검사(다크·강제 색상·320 200%·키보드·흔들림 — 캡처 없이 측정만, 임시 샷은 .taste-skill/004r2/after/mock/)
 *       node scripts/design/shootGm3.mjs --r1 [조각]  ← 1차 블록(gm3-*). **시안이 r2로 바뀌어 1차 캡처를 다시 찍으면 1차 기록이 덮인다** — --r1을 명시해야만 돈다(1차 캡처는 지우지 않는다, 마스터 지시)
 *   (시안은 먼저 `node node_modules/vite-node/vite-node.mjs scripts/design/buildGm3Mockups.mjs`로 만든다)
 *   시안: docs/design/mockups/gm3/title-004.html · roulette-004.html · dashboard-004.html · ending-004.html — 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 다크 `?theme=dark`, 강제 색상 forcedColors, 360은 pointer: coarse 흉내.
 *   샷마다 넘침 점검(문서·요소 가로 넘침, 화면 밖 요소 — shootR4.mjs와 같은 규칙), 파일 크기 ≤ 300 KB. 합성 샷(연표 줄 비교·자산 카드 네 기준)은 요소 샷을 한 페이지에 모아 다시 찍는다(외부 요청 0).
 *   측정: ① 첫 화면 1280×800 — 왼쪽 열 끝·카드 높이·HS3 ④(오른쪽 열 표제어·값 아래끝 < 띠 위끝) ② 룰렛 360 — 3릴 열 폭·줄 수 ③ 320 글자 200% 낱말 끊김 ④ 대비(gm3.css의 새 색 쌍은 토큰 조합뿐 — 계산은 로그에).
 *   넘침이나 300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/gm3/';
const OUT = ROOT + 'docs/design/screens/004/';
const TMP = ROOT + '.taste-skill/004/after/mock/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const R1 = process.argv.includes('--r1');
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const browser = await chromium.launch();
const problems = [];
const notes = [];
const kb = (f) => Math.round(statSync(f).size / 1024);
/** 1차 블록은 --r1일 때만(위 머리글). r2 블록은 `r2`(또는 조각 없음)로 */
const want = (name) => (name.startsWith('gm3r2') ? !R1 && (only === undefined || only === 'r2' || name.includes(only)) : R1 && (only === undefined || name.includes(only)));

async function open({ file, q = '', view, dpr = 1, dark = false, forced = false, text, coarse = false }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: dpr, colorScheme: dark ? 'dark' : 'light', forcedColors: forced ? 'active' : 'none', hasTouch: coarse });
  const page = await ctx.newPage();
  if (coarse) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] });
  }
  await page.goto(`${BASE}${file}.html${q ? `?${q}` : ''}`);
  if (text !== undefined) await page.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
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
const brokenWords = (page, rootSel) =>
  page.evaluate((sel) => {
    const out = [];
    const root = document.querySelector(sel) || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (!el || el.closest('.sr-only, svg, .fit-pair__probe, template, [data-user-text]')) continue;
      if (getComputedStyle(el).display === 'none') continue;
      const words = n.textContent.split(/\s+/).filter(Boolean);
      let idx = 0;
      for (const w of words) {
        const at = n.textContent.indexOf(w, idx);
        range.setStart(n, at);
        range.setEnd(n, at + w.length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        if (rects.length > 1 && w.length > 1 && !/^[A-Za-z0-9(),.%:~·—\-/]+$/.test(w)) out.push(w);
        idx = at + w.length;
      }
    }
    return [...new Set(out)].slice(0, 12);
  }, rootSel);
async function check(page, name) {
  const over = await overflowReport(page);
  if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
}
function saved(file) {
  const size = kb(file);
  if (size > 300) problems.push(`${file}: ${size} KB > 300 KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
/** jpeg: 큰 화면·긴 요소 샷(일러스트가 든 1920, 320 글자 200% 전체)은 PNG가 300 KB를 넘어 JPEG(품질 84)로 — 글자 판독에는 지장 없다(이전 회차의 1920 PNG도 같은 이유로 카드만 찍었다) */
async function shot(page, name, { el, full = false, jpeg = false, quality = 84 } = {}) {
  const f = `${OUT}${name}.${jpeg ? 'jpg' : 'png'}`;
  const opt = jpeg ? { path: f, type: 'jpeg', quality } : { path: f };
  if (el) await page.locator(el).first().screenshot(opt);
  else await page.screenshot({ ...opt, fullPage: full });
  saved(f);
}
/** 요소 샷 여러 장을 한 페이지에 모아 다시 찍는다(설명 글은 시안 표식 — 외부 자원 0) */
async function composite(outFile, items, title, { row = false, width = 1240 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = items.map(([f, cap]) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt=""><figcaption>${cap}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f6f3ec;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-direction:${row ? 'row' : 'column'};gap:16px;align-items:flex-start}figure{margin:0;flex:${row ? '1 1 0' : 'none'};min-width:0}img{display:block;max-width:100%;height:auto;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.screenshot({ path: outFile, fullPage: true });
  saved(outFile);
  await ctx.close();
}

// ---------- ① 첫 화면 ----------
const titleMeasure = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const cards = [...document.querySelectorAll('.radio-card--gen')].map((c) => Math.round(c.getBoundingClientRect().height));
    const bar = r('.bottom-bar');
    const main = r('.title__main');
    const slide = document.querySelector('.slide.is-active');
    const insight = slide ? slide.querySelector('.slide__insight').getBoundingClientRect() : null;
    const value = slide ? slide.querySelector('.slide__value').getBoundingClientRect() : null;
    const card = r('.carousel--005');
    return {
      vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight,
      cardH: cards, cols: new Set([...document.querySelectorAll('.radio-card--gen')].map((c) => Math.round(c.getBoundingClientRect().left))).size,
      mainBottom: main ? Math.round(main.bottom) : null, barTop: bar ? Math.round(bar.top) : null,
      carouselTop: card ? Math.round(card.top) : null, insightBottom: insight ? Math.round(insight.bottom) : null, valueBottom: value ? Math.round(value.bottom) : null,
      chips: document.querySelectorAll('.chip-opt:not([hidden])').length,
    };
  });
if (want('title')) {
  for (const [name, view, q, opt] of [
    ['gm3-title-1280x800', { width: 1280, height: 800 }, 'gen=genx&lived=boomer', {}],
    ['gm3-title-1920x1080', { width: 1920, height: 1080 }, 'gen=genx&lived=boomer', { jpeg: true }],
    ['gm3-title-1280x800-dark', { width: 1280, height: 800 }, 'gen=genx&lived=boomer&theme=dark', { dark: true }],
    ['gm3-title-1280x800-forced', { width: 1280, height: 800 }, 'gen=genx&region=pick&origin=set', { forced: true }],
  ]) {
    const { jpeg, ...o } = opt;
    const { ctx, page } = await open({ file: 'title-004', q, view, ...o });
    await check(page, name);
    notes.push(`${name}: ${JSON.stringify(await titleMeasure(page))}`);
    await shot(page, name, { jpeg });
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ file: 'title-004', q: 'gen=genx&lived=boomer', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
    await check(page, 'gm3-title-360x740');
    notes.push(`gm3-title-360x740: ${JSON.stringify(await titleMeasure(page))}`);
    await shot(page, 'gm3-title-360x740');
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ file: 'title-004', q: 'gen=genx&lived=boomer&region=pick&origin=set&open=origin&fold=open', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
    await check(page, 'gm3-title-pick-360-full');
    const m = await titleMeasure(page);
    const hit = await page.evaluate(() => [...document.querySelectorAll('.chip-opt:not([hidden]) input')].map((i) => Math.round(i.getBoundingClientRect().height)));
    notes.push(`gm3-title-region-360: 칩 ${m.chips}개 · 누르는 영역 높이 ${Math.min(...hit)}~${Math.max(...hit)}px(거친 포인터) · 왼쪽 열 끝 ${m.mainBottom}`);
    // 세대 카드는 gm3-title-360x740이 보이므로 이 샷은 아래 슬롯(인생 길이 · 태어나는 시도 직접 고르기 · 내 출신 시도 설정 열림)만
    await shot(page, 'gm3-title-region-360', { el: '.slots-bottom' });
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ file: 'title-004', q: 'gen=genx&lived=boomer&region=pick&origin=set', view: { width: 320, height: 640 }, text: 200 });
    await check(page, 'gm3-title-320-text200-full');
    const broken = await brokenWords(page, '.title__main');
    notes.push(`gm3-title-320-text200-full: 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')} · ${JSON.stringify(await titleMeasure(page))}`);
    await shot(page, 'gm3-title-320-text200-full', { el: '.title__main', jpeg: true, quality: 76 });
    await ctx.close();
  }
}

// ---------- ② 룰렛 ----------
const reelMeasure = (page) =>
  page.evaluate(() => {
    const cols = [...document.querySelectorAll('.reel-col')].map((c) => ({ w: Math.round(c.getBoundingClientRect().width), top: Math.round(c.getBoundingClientRect().top) }));
    const items = [...document.querySelectorAll('.reel__item')].map((i) => i.scrollWidth > i.clientWidth + 1).filter(Boolean).length;
    return { cols, rows: new Set(cols.map((c) => c.top)).size, itemOverflow: items, docW: document.documentElement.scrollWidth, vw: innerWidth };
  });
if (want('roulette')) {
  {
    const { ctx, page } = await open({ file: 'roulette-004', q: 'state=spinning', view: { width: 1280, height: 800 } });
    await check(page, 'gm3-roulette-1280x800');
    notes.push(`gm3-roulette-1280x800: ${JSON.stringify(await reelMeasure(page))}`);
    await shot(page, 'gm3-roulette-1280x800');
    await ctx.close();
  }
  for (const [name, q, opt] of [['gm3-roulette-result-360x740', 'state=result&region=picked', { coarse: true }], ['gm3-roulette-draw-360x740-dark', 'state=draw&theme=dark', { dark: true, coarse: true }]]) {
    const { ctx, page } = await open({ file: 'roulette-004', q, view: { width: 360, height: 740 }, dpr: 2, ...opt });
    await check(page, name);
    notes.push(`${name}: ${JSON.stringify(await reelMeasure(page))}`);
    await shot(page, name);
    await ctx.close();
  }
  for (const [label, view, text] of [['360 회전', { width: 360, height: 740 }, undefined], ['320 글자 200%', { width: 320, height: 640 }, 200], ['1280 글자 200%', { width: 1280, height: 800 }, 200]]) {
    const { ctx, page } = await open({ file: 'roulette-004', q: 'state=spinning', view, text });
    await check(page, `roulette-${label}`);
    notes.push(`룰렛 ${label}: ${JSON.stringify(await reelMeasure(page))}`);
    await ctx.close();
  }
}

// ---------- ③ 대시보드 ----------
if (want('dash') || want('log') || want('assets')) {
  {
    const { ctx, page } = await open({ file: 'dashboard-004', q: 'state=then', view: { width: 1280, height: 800 } });
    await check(page, 'gm3-dash-1280x800');
    await shot(page, 'gm3-dash-1280x800');
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ file: 'dashboard-004', q: 'state=projection', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
    await check(page, 'gm3-dash-projection-360x740');
    await page.locator('.log').scrollIntoViewIfNeeded();
    await page.evaluate(() => { const l = document.querySelector('.log'); const head = document.querySelector('.dash-head').getBoundingClientRect().height; window.scrollBy(0, l.getBoundingClientRect().top - head - 8); });
    await page.waitForTimeout(150);
    await shot(page, 'gm3-dash-projection-360x740');
    await ctx.close();
  }
  // 연표 줄 비교: 2000년(그해·배경·지역 소식) ↔ 2031년(전망·안내) 인생 기록 카드 전체
  const pair = [];
  for (const [state, cap] of [['then', '2000년 · 28세 — 그해(쪽빛 실선) · 배경(점선) · 지역 소식(실선, 보조 톤)과 일반 사연 줄'], ['projection', '2031년 · 59세 — 전망(놋쇠 긴 점선) + 2026년 안내 한 번(기준 시나리오)']]) {
    const { ctx, page } = await open({ file: 'dashboard-004', q: `state=${state}`, view: { width: 1280, height: 1600 } });
    await page.addStyleTag({ content: '.log__list { max-height: none !important; } .dash, .col, .log { height: auto !important; max-height: none !important; overflow: visible !important; }' });
    await page.waitForTimeout(100);
    const f = `${TMP}log-${state}.png`;
    await page.locator('.log').screenshot({ path: f });
    pair.push([f, cap]);
    await ctx.close();
  }
  await composite(`${OUT}gm3-log-rows-compare.png`, pair, '인생 기록의 연표 줄 4종 — 1972년생 X세대 김성민(시안, 가짜 데이터)', { row: true, width: 980 });
  // 자산 카드 네 기준 + 엔딩 최종 순자산 줄
  const money = [];
  for (const [state, cap] of [['then', '2000년 · 기본 = 당시 화폐 + 「지금 가치로 보기」'], ['now', '2000년 · 「지금 가치로 보기」를 누른 뒤 — 2026년 가치 + 「당시 화폐로 보기」'], ['projection', '2031년(전망 구간) · 2026년 가치만, 버튼 없음'], ['none', '1963년(물가 자료 없음) · 2026년 가치 + 이유 한 줄']]) {
    const { ctx, page } = await open({ file: 'dashboard-004', q: `state=${state}`, view: { width: 1280, height: 800 } });
    const f = `${TMP}assets-${state}.png`;
    await page.locator('.card--assets').screenshot({ path: f });
    money.push([f, cap]);
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ file: 'ending-004', q: 'state=2010', view: { width: 420, height: 800 } });
    const f = `${TMP}final-net-2010.png`;
    await page.locator('.ending-stats').screenshot({ path: f });
    money.push([f, '엔딩 최종 순자산 — 마지막 해 2010년: 당시 화폐 + 같은 전환 버튼(마지막 해 ≥ 2026이면 「2026년 가치」만)']);
    await ctx.close();
  }
  await composite(`${OUT}gm3-assets-money.png`, money, '자산 카드·엔딩의 당시 화폐 ↔ 지금 가치 (EY10~EY12, 시안 — 금액은 예시 배율로 계산)', { row: true, width: 1500 });
  // 강제 색상 360: 인생 기록 카드(전망 상태)
  {
    const { ctx, page } = await open({ file: 'dashboard-004', q: 'state=projection', view: { width: 360, height: 740 }, dpr: 2, forced: true });
    await check(page, 'gm3-log-rows-360-forced');
    // 카드 요소 샷: 카드가 한 화면보다 길어 조각을 이어 붙일 때 고정 머리·진행 줄이 끼므로 이 샷에서만 숨긴다(시안 표식 — 구현 화면은 그대로)
    await page.addStyleTag({ content: '.log__list { max-height: none !important; } .dash-head, .controls-fixed { visibility: hidden !important; }' });
    await shot(page, 'gm3-log-rows-360-forced', { el: '.log' });
    await ctx.close();
  }
  // 320 글자 200% 끊김(대시보드 연표 줄·자산 카드)
  {
    const { ctx, page } = await open({ file: 'dashboard-004', q: 'state=then', view: { width: 320, height: 640 }, text: 200 });
    await check(page, 'dash-320-text200');
    const broken = await brokenWords(page, 'main.dash');
    notes.push(`대시보드 320 · 200%: 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}`);
    await ctx.close();
  }
}

// ---------- ④ 엔딩 ----------
if (want('ending')) {
  const { ctx, page } = await open({ file: 'ending-004', q: 'state=future', view: { width: 1280, height: 800 } });
  await check(page, 'gm3-ending-1280-full');
  // 전체 페이지(머리의 세대 표기 → 최종 순자산 「2026년 가치」 → 비교 카드 → 연표의 전망 경계까지 한 장) — 길어 JPEG
  await shot(page, 'gm3-ending-1280-full', { full: true, jpeg: true });
  await ctx.close();
  for (const [label, view, text] of [['360', { width: 360, height: 740 }, undefined], ['320 · 200%', { width: 320, height: 640 }, 200]]) {
    const { ctx: c2, page: p2 } = await open({ file: 'ending-004', q: 'state=future', view, text });
    await check(p2, `ending-${label}`);
    const broken = await brokenWords(p2, 'main.ending');
    notes.push(`엔딩 ${label}: 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}`);
    await c2.close();
  }
}

// ============================================================ r2 (2026-10-27 게이트 ③ 답 반영) ============================================================
// 캡처 7장(gm3r2-*): PC 첫 화면 · 360 첫 화면 · PC 룰렛 도는 중 · PC 룰렛 결과 · 360 룰렛 결과 · 이름 비교 2장(살아봄 · 태어나 보니). 다크·강제 색상·320 200%·1920은 **검사만**(임시 샷은 .taste-skill/004r2/after/mock/, 문제가 있을 때만 docs로 옮긴다).
const TMP2 = ROOT + '.taste-skill/004r2/after/mock/';
mkdirSync(TMP2, { recursive: true });
const titleMeasure2 = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const list = document.querySelector('.gen-list');
    const rows = [...document.querySelectorAll('.gen-row')];
    const lr = list ? list.getBoundingClientRect() : null;
    const inView = (el) => { if (!el || !lr) return false; const b = el.getBoundingClientRect(); return b.top >= lr.top - 1 && b.bottom <= lr.bottom + 1; };
    const main = r('.title__main'); const bar = r('.bottom-bar'); const card = r('.carousel--005');
    const slide = document.querySelector('.slide.is-active'); const insight = slide && slide.querySelector('.slide__insight').getBoundingClientRect(); const value = slide && slide.querySelector('.slide__value').getBoundingClientRect();
    const fs = (s) => { const el = document.querySelector(s); return el ? `${getComputedStyle(el).fontSize}/${getComputedStyle(el).lineHeight} ${getComputedStyle(el).fontWeight}` : null; };
    return {
      vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight,
      listTop: lr && Math.round(lr.top), listH: lr && Math.round(lr.height), rowH: rows.map((x) => Math.round(x.getBoundingClientRect().height)), visibleRows: rows.filter(inView).length, selected: (document.querySelector('input[name=gen]:checked') || {}).value, selectedInView: inView(document.querySelector('.gen-row.is-selected')),
      mainBottom: main && Math.round(main.bottom), barTop: bar && Math.round(bar.top), carouselTop: card && Math.round(card.top), insightBottom: insight && Math.round(insight.bottom), valueBottom: value && Math.round(value.bottom),
      type: { tag: fs('.hero__tag'), span: fs('.hero__span'), lead: fs('.slot__lead'), name: fs('.gen-row__name'), meta: fs('.gen-row__meta'), intro: fs('.gen-intro'), h1: fs('.hero__name') },
      gone: { illust: document.querySelectorAll('.illust').length, pop: document.querySelectorAll('.hero__pop, .hero__note, .log__pin').length },
    };
  });
/** 키보드: 첫 줄(랜덤)에 포커스 → 아래 화살표 7번(알파) → 고른 줄이 목록 창 안에 있고 문서는 스크롤되지 않았는지 → 위 화살표 7번 */
async function keyboardTest(page) {
  await page.focus('input[name=gen][value=random]');
  const y0 = await page.evaluate(() => scrollY);
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500); // 목록은 scroll-behavior: smooth — 애니메이션이 끝난 뒤 잰다(120ms에서는 1280이 중간값을 읽었다)
  const down = await titleMeasure2(page);
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(500);
  const up = await titleMeasure2(page);
  const y1 = await page.evaluate(() => scrollY);
  return { docScrollBefore: y0, docScrollAfter: y1, down: { selected: down.selected, inView: down.selectedInView }, up: { selected: up.selected, inView: up.selectedInView } };
}
const reelMeasure2 = (page) =>
  page.evaluate(() => ({
    cols: [...document.querySelectorAll('.reel-col')].map((c) => ({ w: Math.round(c.getBoundingClientRect().width), top: Math.round(c.getBoundingClientRect().top), rows: c.querySelectorAll('tbody tr').length, tdW: Math.max(0, ...[...c.querySelectorAll('tbody td')].map((td) => Math.round(td.getBoundingClientRect().width))) })),
    rowsSide: new Set([...document.querySelectorAll('.reel-col')].map((c) => Math.round(c.getBoundingClientRect().top))).size,
    itemOverflow: [...document.querySelectorAll('.reel__item')].filter((i) => i.scrollWidth > i.clientWidth + 1).length,
    docW: document.documentElement.scrollWidth, vw: innerWidth,
    now: (document.querySelector('.odds__now th') || {}).textContent, dashes: document.querySelectorAll('.odds--region .odds__dash').length,
  }));
if (want('gm3r2-title')) {
  // 이름 비교 2장(N30, 마스터 지시 2026-10-27 — 「세대 유감」은 뺌): 같은 첫 화면에서 제목 글자만(살아봄은 부제 글자도) 바꾼 캡처
  for (const [name, q] of [['gm3r2-title-1280x800', 'gen=random&lived=boomer'], ['gm3r2-name-salabom', 'gen=random&lived=boomer&name=salabom'], ['gm3r2-name-taeeonabo', 'gen=random&lived=boomer&name=taeeonabo']]) {
    const { ctx, page } = await open({ file: 'title-004', q, view: { width: 1280, height: 800 } });
    await check(page, name);
    notes.push(`${name}: ${JSON.stringify(await titleMeasure2(page))}`);
    await shot(page, name);
    if (name === 'gm3r2-title-1280x800') notes.push(`gm3r2-title-1280x800 키보드: ${JSON.stringify(await keyboardTest(page))}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ file: 'title-004', q: 'gen=random&lived=boomer', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
    await check(page, 'gm3r2-title-360x740');
    notes.push(`gm3r2-title-360x740: ${JSON.stringify(await titleMeasure2(page))}`);
    await shot(page, 'gm3r2-title-360x740');
    notes.push(`gm3r2-title-360x740 키보드: ${JSON.stringify(await keyboardTest(page))}`);
    await ctx.close();
  }
  // 검사만(캡처는 임시 폴더): 다크 1280 · 강제 색상 1280(알파 선택 — 고른 줄·막대·체크) · 1920×1080 · 320 글자 200%
  for (const [label, view, q, opt] of [
    ['title-dark-1280', { width: 1280, height: 800 }, 'gen=random&lived=boomer&theme=dark', { dark: true }],
    ['title-forced-1280', { width: 1280, height: 800 }, 'gen=alpha&lived=boomer', { forced: true }],
    ['title-forced-360', { width: 360, height: 740 }, 'gen=alpha&lived=boomer', { forced: true, dpr: 2, coarse: true }],
    ['title-1920x1080', { width: 1920, height: 1080 }, 'gen=random&lived=boomer', {}],
    ['title-320-text200', { width: 320, height: 640 }, 'gen=random&lived=boomer', { text: 200 }],
  ]) {
    const { ctx, page } = await open({ file: 'title-004', q, view, ...opt });
    await check(page, `r2 ${label}`);
    const m = await titleMeasure2(page);
    const broken = label.includes('text200') ? await brokenWords(page, '.title__main') : [];
    notes.push(`r2 ${label}: ${JSON.stringify({ listH: m.listH, visibleRows: m.visibleRows, selectedInView: m.selectedInView, mainBottom: m.mainBottom, barTop: m.barTop, valueBottom: m.valueBottom, scrollH: m.scrollH })}${label.includes('text200') ? ` · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}` : ''}`);
    await page.screenshot({ path: `${TMP2}${label}.png` });
    await ctx.close();
  }
}
if (want('gm3r2-roulette')) {
  for (const [name, q, view, opt] of [
    ['gm3r2-roulette-spin-1280x800', 'state=spinning', { width: 1280, height: 800 }, {}],
    ['gm3r2-roulette-result-1280x800', 'state=result', { width: 1280, height: 800 }, {}],
    ['gm3r2-roulette-result-360x740', 'state=result', { width: 360, height: 740 }, { dpr: 2, coarse: true }],
  ]) {
    const { ctx, page } = await open({ file: 'roulette-004', q, view, ...opt });
    await check(page, name);
    notes.push(`${name}: ${JSON.stringify(await reelMeasure2(page))}`);
    await shot(page, name);
    await ctx.close();
  }
  // 흔들림: 같은 폭에서 도는 중 ↔ 결과의 표 줄 수·열 폭·값 칸 폭이 같은가(1280 · 360)
  for (const view of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    const got = {};
    for (const s of ['spinning', 'result']) {
      const { ctx, page } = await open({ file: 'roulette-004', q: `state=${s}`, view });
      got[s] = await reelMeasure2(page);
      await ctx.close();
    }
    const same = got.spinning.cols.every((c, i) => c.rows === got.result.cols[i].rows && Math.abs(c.w - got.result.cols[i].w) <= 1 && Math.abs(c.tdW - got.result.cols[i].tdW) <= 1);
    notes.push(`룰렛 흔들림 ${view.width}: ${same ? '같다' : '다르다'} — 도는 중 ${JSON.stringify(got.spinning.cols)} / 결과 ${JSON.stringify(got.result.cols)}`);
    if (!same) problems.push(`룰렛 ${view.width}: 도는 중 ↔ 결과 표 크기가 다르다`);
  }
  // 검사만: 360 도는 중(3열) · 320 200% · 1280 200% · 다크 360 결과 · 강제 색상 1280 도는 중 · 베이비붐 「예시」 상태
  for (const [label, view, q, opt] of [
    ['roulette-spin-360', { width: 360, height: 740 }, 'state=spinning', { dpr: 2, coarse: true }],
    ['roulette-320-text200', { width: 320, height: 640 }, 'state=result', { text: 200 }],
    ['roulette-1280-text200', { width: 1280, height: 800 }, 'state=spinning', { text: 200 }],
    ['roulette-dark-360', { width: 360, height: 740 }, 'state=result&theme=dark', { dark: true, dpr: 2 }],
    ['roulette-forced-1280', { width: 1280, height: 800 }, 'state=spinning', { forced: true }],
    ['roulette-boomer-1280', { width: 1280, height: 800 }, 'state=spinning&gen=boomer', {}],
  ]) {
    const { ctx, page } = await open({ file: 'roulette-004', q, view, ...opt });
    await check(page, `r2 ${label}`);
    const broken = label.includes('text200') ? await brokenWords(page, 'main.roulette') : [];
    notes.push(`r2 ${label}: ${JSON.stringify(await reelMeasure2(page))}${label.includes('text200') ? ` · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}` : ''}`);
    await page.screenshot({ path: `${TMP2}${label}.png`, fullPage: label.includes('boomer') });
    await ctx.close();
  }
}

await browser.close();
writeFileSync(`${TMP}notes.txt`, notes.join('\n\n'));
if (notes.length > 0) console.log('\n측정:\n' + notes.join('\n\n'));
if (problems.length > 0) {
  console.error('\n문제:\n' + problems.join('\n'));
  process.exit(1);
}
