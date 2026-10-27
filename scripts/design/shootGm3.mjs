/**
 * SPEC-004 GM3 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/004/gm3-*.png (designer 2026-10-27) · r2 gm3r2-*.png · r3 gm3r3-*.png · **r4 gm3r4-*.png (2026-10-27 형진 님 답 3차 반영 — 기본)**.
 * 실행: node scripts/design/shootGm3.mjs [r4] [조각]  ← r4 캡처 7장(첫 화면 PC·360 · 세대를 바꾼 뒤 그래프 PC · 360의 목록 아래 그래프 · 하단 PC·360 · 바탕이 바뀐 룰렛 결과 PC) + 검사(다크·강제 색상·320 200%·1920·키보드·가리킴·자리 옮김·세대 바꿈 뒤 읽기 이름·숫자 검산 — 임시 샷은 .taste-skill/004r4/after/mock/)
 *       node scripts/design/shootGm3.mjs r3 [조각]     ← r3 블록(gm3r3-*). 시안이 r4로 바뀌어 r3 캡처를 다시 찍으면 r3 기록이 덮인다 — r3을 명시해야만 돈다(지난 캡처는 지우지 않는다, 마스터 지시)
 *       node scripts/design/shootGm3.mjs r2 [조각]     ← r2 블록(gm3r2-*). 같은 이유로 r2를 명시해야만 돈다
 *       node scripts/design/shootGm3.mjs --r1 [조각]  ← 1차 블록(gm3-*). 같은 이유로 --r1을 명시해야만 돈다
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
/** 회차 분기(위 머리글): --r1 → 1차 블록(이름이 gm3r로 시작하지 않음) · `r2` → r2 블록(gm3r2-*) · `r3` → r3 블록(gm3r3-*) · 그 밖(기본) → r4 블록(gm3r4-*). 조각 이름(title·roulette…)을 더 주면 그 이름이 든 것만 */
const PARTS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const MODE = R1 ? 'r1' : PARTS.includes('r2') ? 'r2' : PARTS.includes('r3') ? 'r3' : 'r4';
const PART = PARTS.find((a) => !/^r[234]$/.test(a)); // 예: `r4 title` → title 블록만
const want = (name) => { const m = name.startsWith('gm3r4') ? 'r4' : name.startsWith('gm3r3') ? 'r3' : name.startsWith('gm3r2') ? 'r2' : 'r1'; return m === MODE && (PART === undefined || name.includes(PART)); };

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

// ============================================================ r3 (2026-10-27 형진 님 답 2차 반영 — 벤치마킹·두 릴·연도 숨김·Noto Sans KR 조각) ============================================================
// 캡처 8장(gm3r3-*): PC 첫 화면 · 360 첫 화면 · PC 룰렛 도는 중 · PC 룰렛 결과 · 360 룰렛 결과 · 출생신고 연도 노출(PC, 서류 부분) · 대안 2(flat · paper). 다크·강제 색상·320 200%·1920은 **검사만**(임시 샷 .taste-skill/004r3/after/mock/, 문제가 있을 때만 docs로).
const TMP3 = ROOT + '.taste-skill/004r3/after/mock/';
mkdirSync(TMP3, { recursive: true });
/** 글꼴 적재 확인: document.fonts에서 loaded 상태인 face(가족 + 굵기 + unicode-range 조각 수)와 본문 글자가 실제로 쓰는 첫 글꼴 이름(계산값 — 선언 스택의 첫 항목) */
const fontsInfo = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    const faces = {};
    for (const f of document.fonts) if (f.status === 'loaded') { const k = `${f.family} ${f.weight}`; faces[k] = (faces[k] || 0) + 1; }
    const used = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || el.closest('script,style,template,.sr-only')) continue; if (getComputedStyle(el).display === 'none') continue; const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, ''); used[f] = (used[f] || 0) + t.length; }
    return { faces, used, htmlFont: document.documentElement.getAttribute('data-font') };
  });
/** 바뀜 흔들림(CLS) 추정: 같은 화면을 ① 글꼴이 오기 전 상태(대체 글꼴)로 ② Noto Sans KR로 열어 첫 화면 안 요소의 위치를 견준다.
 *  CLS ≈ 영향 비율(움직인 요소들의 전후 세로 구간 합집합 ÷ 뷰포트 높이) × 거리 비율(가장 큰 이동 ÷ 뷰포트 높이) — web-vitals 정의의 근사. 두 가지 「전」: naive = 맑은 고딕 그대로 · adjusted = 'Noto Sans KR Fallback'(metric override) */
async function layoutShift(file, q, view, opts = {}) {
  const snap = async (css) => {
    const { ctx, page } = await open({ file, q, view, ...opts });
    if (css) await page.addStyleTag({ content: css });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const out = await page.evaluate(() => {
      const vh = innerHeight; const rects = [];
      const path = (el) => { const p = []; let e = el; while (e && e !== document.body) { p.unshift([...e.parentNode.children].indexOf(e)); e = e.parentNode; } return p.join('/'); };
      for (const el of document.querySelectorAll('main *, header *')) {
        if (el.closest('template,svg,.sr-only')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.position === 'fixed' || cs.visibility === 'hidden') continue;
        if (el.children.length > 0 && !el.matches('p,h1,h2,h3,li,label,button,dt,dd,th,td,legend,summary')) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.width === 0 || r.top > vh || r.bottom < 0) continue;
        rects.push({ key: path(el), top: r.top, h: r.height });
      }
      return { vh, vw: innerWidth, rects, scrollH: document.documentElement.scrollHeight };
    });
    await ctx.close();
    return out;
  };
  const after = await snap('');
  const result = {};
  for (const [label, css] of [['naive', `:root{--font-sans:'Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif !important}`], ['adjusted', `:root{--font-sans:'Noto Sans KR Fallback','Malgun Gothic',system-ui,sans-serif !important}`]]) {
    const before = await snap(css);
    const map = new Map(before.rects.map((r) => [r.key, r]));
    let maxShift = 0; const spans = [];
    for (const r of after.rects) { const p = map.get(r.key); if (!p) continue; const d = Math.abs(r.top - p.top); if (d >= 1) { maxShift = Math.max(maxShift, d); spans.push([Math.max(0, Math.min(r.top, p.top)), Math.min(after.vh, Math.max(r.top + r.h, p.top + p.h))]); } }
    spans.sort((a, b) => a[0] - b[0]);
    let union = 0, cur = null;
    for (const s of spans) { if (!cur || s[0] > cur[1]) { if (cur) union += cur[1] - cur[0]; cur = [...s]; } else cur[1] = Math.max(cur[1], s[1]); }
    if (cur) union += cur[1] - cur[0];
    const impact = union / after.vh, distance = maxShift / after.vh;
    result[label] = { moved: spans.length, maxShift: Math.round(maxShift * 10) / 10, impact: +impact.toFixed(3), distance: +distance.toFixed(3), cls: +(impact * distance).toFixed(4), scrollH: [before.scrollH, after.scrollH] };
  }
  return { view: `${after.vw}x${after.vh}`, ...result };
}
const titleMeasure3 = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const list = document.querySelector('.gen-list');
    const rows = [...document.querySelectorAll('.gen-row')];
    const lr = list ? list.getBoundingClientRect() : null;
    const inView = (el) => { if (!el || !lr) return false; const b = el.getBoundingClientRect(); return b.top >= lr.top - 1 && b.bottom <= lr.bottom + 1; };
    const main = r('.title__main'); const bar = r('.bottom-bar'); const card = r('.carousel--005');
    const slide = document.querySelector('.slide.is-active'); const insight = slide && slide.querySelector('.slide__insight').getBoundingClientRect(); const value = slide && slide.querySelector('.slide__value').getBoundingClientRect();
    const fs = (s) => { const el = document.querySelector(s); return el ? `${getComputedStyle(el).fontSize}/${getComputedStyle(el).lineHeight} ${getComputedStyle(el).fontWeight}` : null; };
    const metaWrapped = rows.filter((row) => { const n = row.querySelector('.gen-row__name'), m = row.querySelector('.gen-row__meta'); return n && m && Math.round(m.getBoundingClientRect().top) > Math.round(n.getBoundingClientRect().top) + 2; }).length;
    return {
      vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight,
      listTop: lr && Math.round(lr.top), listH: lr && Math.round(lr.height), rowH: rows.map((x) => Math.round(x.getBoundingClientRect().height)), visibleRows: rows.filter(inView).length, metaWrapped, selected: (document.querySelector('input[name=gen]:checked') || {}).value, selectedInView: inView(document.querySelector('.gen-row.is-selected')),
      mainBottom: main && Math.round(main.bottom), barTop: bar && Math.round(bar.top), carouselTop: card && Math.round(card.top), insightBottom: insight && Math.round(insight.bottom), valueBottom: value && Math.round(value.bottom),
      type: { tag: fs('.hero__tag'), span: fs('.hero__span'), lead: fs('.slot__lead'), name: fs('.gen-row__name'), meta: fs('.gen-row__meta'), desc: fs('.gen-row__desc'), question: fs('.slot--gen8 .group-title') },
      boxes: { listBorder: list ? getComputedStyle(list).borderLeftWidth : null, pills: document.querySelectorAll('.gen-row__lived[style], .gen-intro').length },
    };
  });
async function keyboardTest3(page) {
  await page.focus('input[name=gen][value=random]');
  const y0 = await page.evaluate(() => scrollY);
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);
  const down = await titleMeasure3(page);
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(500);
  const up = await titleMeasure3(page);
  const y1 = await page.evaluate(() => scrollY);
  return { docScrollBefore: y0, docScrollAfter: y1, down: { selected: down.selected, inView: down.selectedInView }, up: { selected: up.selected, inView: up.selectedInView } };
}
const reelMeasure3 = (page) =>
  page.evaluate(() => ({
    cols: [...document.querySelectorAll('.reel-col')].map((c) => ({ w: Math.round(c.getBoundingClientRect().width), top: Math.round(c.getBoundingClientRect().top), rows: c.querySelectorAll('tbody tr').length, tdW: Math.max(0, ...[...c.querySelectorAll('tbody td')].map((td) => Math.round(td.getBoundingClientRect().width))), h: Math.round(c.getBoundingClientRect().height) })),
    rowsSide: new Set([...document.querySelectorAll('.reel-col')].map((c) => Math.round(c.getBoundingClientRect().top))).size,
    itemOverflow: [...document.querySelectorAll('.reel__item')].filter((i) => i.scrollWidth > i.clientWidth + 1).length,
    docW: document.documentElement.scrollWidth, vw: innerWidth, scrollH: document.documentElement.scrollHeight,
    heads: [...document.querySelectorAll('.odds__head')].map((h) => h.textContent), yearText: document.body.textContent.includes('태어나는 해'), tdFont: (() => { const td = document.querySelector('.odds--r3 td'); return td ? getComputedStyle(td).fontSize : null; })(),
    sums: [...document.querySelectorAll('.odds--r3 table')].map((t) => Math.round([...t.querySelectorAll('td')].reduce((s, td) => s + parseFloat(td.textContent), 0) * 10) / 10),
  }));
if (want('gm3r3-title')) {
  // 캡처는 포커스 없는 상태로 먼저 찍고(마스터 지적 — 정본 캡처에 포커스 링이 없어야 한다), 키보드 검사는 그 뒤. 대안은 paper 하나(캐러셀 평면화는 정본 — D4-55)
  for (const [name, q, view, opt] of [
    ['gm3r3-title-1280x800', 'gen=random&lived=boomer', { width: 1280, height: 800 }, {}],
    ['gm3r3-alt-title-paper-1280x800', 'gen=random&lived=boomer&alt=paper', { width: 1280, height: 800 }, {}],
    ['gm3r3-title-360x740', 'gen=random&lived=boomer', { width: 360, height: 740 }, { dpr: 2, coarse: true }],
  ]) {
    const { ctx, page } = await open({ file: 'title-004', q, view, ...opt });
    await check(page, name);
    notes.push(`${name}: ${JSON.stringify(await titleMeasure3(page))}`);
    await shot(page, name);
    if (name === 'gm3r3-title-1280x800' || name === 'gm3r3-title-360x740') {
      notes.push(`${name} 글꼴: ${JSON.stringify(await fontsInfo(page))}`);
      // 첫 화면이 **실제로 그리는** 글자(숨은 슬라이드·hidden 요소 제외 — 글꼴 조각은 그려지는 글자에만 내려받힌다) → buildGm3Fonts.mjs가 이 파일로 s0를 「처음 그리는 글자」와 「첫 화면의 나머지」로 나눈다
      const rendered = await page.evaluate(() => { const set = new Set(); const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = walker.nextNode())) { const el = n.parentElement; if (!el || el.closest('script,style,template,svg')) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; if (el.closest('[hidden]')) continue; for (const ch of n.textContent) { const cp = ch.codePointAt(0); if (cp > 0x20) set.add(cp); } } return [...set].sort((a, b) => a - b); });
      const f = `${ROOT}.taste-skill/004r3/title-rendered-chars.${name.includes('360') ? '360' : '1280'}.txt`;
      writeFileSync(f, rendered.map((cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')).join('\n') + '\n');
      notes.push(`${name} 처음 그리는 글자 ${rendered.length}자(한글 ${rendered.filter((cp) => cp >= 0xac00 && cp <= 0xd7a3).length}) → ${f.replace(ROOT, '')}`);
      notes.push(`${name} 키보드: ${JSON.stringify(await keyboardTest3(page))}`);
      // 메타가 줄의 오른쪽 안쪽 여백 안에 끝나는지(목록 끝선에 붙거나 잘리지 않는지 — 마스터 지적): 모든 줄에서 메타 오른쪽 끝 ≤ 목록 오른쪽 끝 − 8
      const metaEdge = await page.evaluate(() => { const l = document.querySelector('.gen-list').getBoundingClientRect(); return [...document.querySelectorAll('.gen-row__meta')].map((m) => Math.round(l.right - m.getBoundingClientRect().right)); });
      notes.push(`${name} 메타 오른쪽 여유(px): ${JSON.stringify(metaEdge)}`);
      if (metaEdge.some((v) => v < 8)) problems.push(`${name}: 메타가 목록 오른쪽 여백 8px 안에 들어오지 않는다 ${JSON.stringify(metaEdge)}`);
    }
    await ctx.close();
  }
  // 검사만: 다크 1280 · 강제 색상 1280(알파 선택)·360 · 1920×1080 · 320 글자 200% · 대체 글꼴(?font=system) 1280 — 임시 폴더
  for (const [label, view, q, opt] of [
    ['title-dark-1280', { width: 1280, height: 800 }, 'gen=random&lived=boomer&theme=dark', { dark: true }],
    ['title-forced-1280', { width: 1280, height: 800 }, 'gen=alpha&lived=boomer', { forced: true }],
    ['title-forced-360', { width: 360, height: 740 }, 'gen=alpha&lived=boomer', { forced: true, dpr: 2, coarse: true }],
    ['title-1920x1080', { width: 1920, height: 1080 }, 'gen=random&lived=boomer', {}],
    ['title-320-text200', { width: 320, height: 640 }, 'gen=random&lived=boomer', { text: 200 }],
    ['title-system-font-1280', { width: 1280, height: 800 }, 'gen=random&lived=boomer&font=system', {}],
  ]) {
    const { ctx, page } = await open({ file: 'title-004', q, view, ...opt });
    await check(page, `r3 ${label}`);
    const m = await titleMeasure3(page);
    const broken = label.includes('text200') ? await brokenWords(page, '.title__main') : [];
    notes.push(`r3 ${label}: ${JSON.stringify({ listH: m.listH, visibleRows: m.visibleRows, metaWrapped: m.metaWrapped, selectedInView: m.selectedInView, mainBottom: m.mainBottom, barTop: m.barTop, valueBottom: m.valueBottom, scrollH: m.scrollH })}${label.includes('text200') ? ` · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}` : ''}`);
    await page.screenshot({ path: `${TMP3}${label}.png` });
    await ctx.close();
  }
  for (const [view, opt] of [[{ width: 1280, height: 800 }, {}], [{ width: 360, height: 740 }, { dpr: 2, coarse: true }]]) notes.push(`첫 화면 CLS 추정: ${JSON.stringify(await layoutShift('title-004', 'gen=random&lived=boomer', view, opt))}`);
}
if (want('gm3r3-roulette')) {
  for (const [name, q, view, opt] of [
    ['gm3r3-roulette-spin-1280x800', 'state=spinning', { width: 1280, height: 800 }, {}],
    ['gm3r3-roulette-result-1280x800', 'state=result', { width: 1280, height: 800 }, {}],
    ['gm3r3-roulette-result-360x740', 'state=result', { width: 360, height: 740 }, { dpr: 2, coarse: true }],
  ]) {
    const { ctx, page } = await open({ file: 'roulette-004', q, view, ...opt });
    await check(page, name);
    notes.push(`${name}: ${JSON.stringify(await reelMeasure3(page))}`);
    if (name === 'gm3r3-roulette-spin-1280x800') notes.push(`${name} 글꼴: ${JSON.stringify(await fontsInfo(page))}`);
    await shot(page, name);
    await ctx.close();
  }
  // 흔들림: 도는 중 ↔ 결과의 표 줄 수·열 폭·값 칸 폭·열 높이가 같은가(1280 · 360) — 표가 세대 전체 기준이라 그대로여야 한다
  for (const view of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    const got = {};
    for (const s of ['spinning', 'result']) { const { ctx, page } = await open({ file: 'roulette-004', q: `state=${s}`, view }); got[s] = await reelMeasure3(page); await ctx.close(); }
    const same = got.spinning.cols.every((c, i) => c.rows === got.result.cols[i].rows && Math.abs(c.w - got.result.cols[i].w) <= 1 && Math.abs(c.tdW - got.result.cols[i].tdW) <= 1 && Math.abs(c.h - got.result.cols[i].h) <= 1);
    notes.push(`룰렛 흔들림 ${view.width}: ${same ? '같다' : '다르다'} — 도는 중 ${JSON.stringify(got.spinning.cols)} / 결과 ${JSON.stringify(got.result.cols)}`);
    if (!same) problems.push(`룰렛 ${view.width}: 도는 중 ↔ 결과 표 크기가 다르다`);
  }
  // 검사만: 360 도는 중 · 320 200% · 1280 200% · 다크 360 결과 · 강제 색상 1280 도는 중 · 베이비붐(1940~1980 인구 비례) · 랜덤 세대 경로 · 직접 고른 시도 · 세대 뽑기 단계
  for (const [label, view, q, opt] of [
    ['roulette-spin-360', { width: 360, height: 740 }, 'state=spinning', { dpr: 2, coarse: true }],
    ['roulette-320-text200', { width: 320, height: 640 }, 'state=result', { text: 200 }],
    ['roulette-1280-text200', { width: 1280, height: 800 }, 'state=spinning', { text: 200 }],
    ['roulette-dark-360', { width: 360, height: 740 }, 'state=result&theme=dark', { dark: true, dpr: 2 }],
    ['roulette-forced-1280', { width: 1280, height: 800 }, 'state=spinning', { forced: true }],
    ['roulette-boomer-1280', { width: 1280, height: 800 }, 'state=result&gen=boomer', {}],
    ['roulette-random-1280', { width: 1280, height: 800 }, 'state=spinning&from=random', {}],
    ['roulette-picked-1280', { width: 1280, height: 800 }, 'state=result&region=picked', {}],
    ['roulette-draw-360', { width: 360, height: 740 }, 'state=draw', { dpr: 2, coarse: true }],
  ]) {
    const { ctx, page } = await open({ file: 'roulette-004', q, view, ...opt });
    await check(page, `r3 ${label}`);
    const broken = label.includes('text200') ? await brokenWords(page, 'main.roulette') : [];
    notes.push(`r3 ${label}: ${JSON.stringify(await reelMeasure3(page))}${label.includes('text200') ? ` · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}` : ''}`);
    await page.screenshot({ path: `${TMP3}${label}.png`, fullPage: label.includes('boomer') || label.includes('picked') });
    await ctx.close();
  }
  notes.push(`룰렛 CLS 추정: ${JSON.stringify(await layoutShift('roulette-004', 'state=spinning', { width: 1280, height: 800 }))}`);
}
if (want('gm3r3-birth')) {
  {
    const { ctx, page } = await open({ file: 'birth-004', view: { width: 1280, height: 800 } });
    await check(page, 'gm3r3-birth-year-1280');
    notes.push(`gm3r3-birth-year-1280 글꼴: ${JSON.stringify(await fontsInfo(page))} · 연도 자리: ${JSON.stringify(await page.evaluate(() => ({ gen: document.querySelector('.doc__gen')?.textContent, sentence: document.querySelector('.doc__sentence')?.textContent.slice(0, 30), note: document.querySelector('.doc-notes p')?.textContent.slice(0, 40), docH: Math.round(document.querySelector('.doc').getBoundingClientRect().height) })))}`);
    await shot(page, 'gm3r3-birth-year-1280', { el: '.doc' });
    await ctx.close();
  }
  for (const [label, view, q, opt] of [
    ['birth-dark-360', { width: 360, height: 740 }, 'theme=dark', { dark: true, dpr: 2 }],
    ['birth-forced-1280', { width: 1280, height: 800 }, '', { forced: true }],
    ['birth-320-text200', { width: 320, height: 640 }, '', { text: 200 }],
  ]) {
    const { ctx, page } = await open({ file: 'birth-004', q, view, ...opt });
    await check(page, `r3 ${label}`);
    const broken = label.includes('text200') ? await brokenWords(page, 'main.doc-page') : [];
    notes.push(`r3 ${label}: 넘침 점검 완료${label.includes('text200') ? ` · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}` : ''}`);
    await page.screenshot({ path: `${TMP3}${label}.png` });
    await ctx.close();
  }
}

// ============================================================ r4 (2026-10-27 형진 님 답 3차 반영 — 바탕 종이색·제목 크게·설명 두 줄·「한 판 약 30분」·세대 그래프·하단) ============================================================
// 캡처 7장(gm3r4-*): 첫 화면 PC(기본 = 랜덤 세대, 그래프는 전체) · 첫 화면 360 · **세대를 X세대로 바꾼 뒤** 그래프 카드(PC) · 360에서 밀레니얼을 고른 뒤 목록 아래 그래프(뷰포트) · 하단 PC · 하단 360 · 바탕이 바뀐 룰렛 결과 PC. 다크·강제 색상·320 200%·1920·cream 비교는 **검사만**(임시 샷 .taste-skill/004r4/after/mock/).
const TMP4 = ROOT + '.taste-skill/004r4/after/mock/';
mkdirSync(TMP4, { recursive: true });
const titleMeasure4 = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const rd = (b) => (b ? { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) } : null);
    const fs = (s) => { const el = document.querySelector(s); return el ? `${getComputedStyle(el).fontSize}/${getComputedStyle(el).lineHeight} ${getComputedStyle(el).fontWeight}` : null; };
    const list = document.querySelector('.gen-list'); const rows = [...document.querySelectorAll('.gen-row')]; const lr = list && list.getBoundingClientRect();
    const inView = (el) => { if (!el || !lr) return false; const b = el.getBoundingClientRect(); return b.top >= lr.top - 1 && b.bottom <= lr.bottom + 1; };
    const chart = document.querySelector('.gen-chart'); const svg = document.querySelector('.gen-chart__plot');
    return {
      vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight, bg: getComputedStyle(document.body).backgroundColor, paper: document.documentElement.getAttribute('data-paper'),
      logo: rd(r('.hero__logo--a svg.logo')), time: rd(r('.hero__time')), tag: rd(r('.hero__tag')), span: rd(r('.hero__span')), lead: document.querySelectorAll('.slot__lead').length,
      listTop: lr && Math.round(lr.top), listH: lr && Math.round(lr.height), visibleRows: rows.filter(inView).length, selected: (document.querySelector('input[name=gen]:checked') || {}).value, selectedInView: inView(document.querySelector('.gen-row.is-selected')),
      mainBottom: rd(r('.title__main'))?.bottom, barTop: rd(r('.bottom-bar'))?.top, chart: rd(r('.gen-chart')), chartParent: chart && chart.parentElement.id ? `#${chart.parentElement.id}` : chart && `.${[...chart.parentElement.classList].join('.')}`, svg: rd(r('.gen-chart__plot')), foot: rd(r('.title-foot')),
      live: document.querySelector('.gen-chart__gen')?.textContent, label: svg?.getAttribute('aria-label'), nums: [...document.querySelectorAll('.gen-chart__nums dd .gen-chart__val')].map((e) => e.textContent), subs: [...document.querySelectorAll('.gen-chart__nums small')].map((e) => e.textContent), tableRows: document.querySelectorAll('.gen-chart__tbody tr').length, band: !!svg?.querySelector('.gchart__band'), peak: svg?.querySelector('.gchart__peak')?.textContent,
      type: { tag: fs('.hero__tag'), time: fs('.hero__time'), span: fs('.hero__span'), name: fs('.gen-row__name'), chartTitle: fs('.gen-chart__title'), val: fs('.gen-chart__val'), footH: fs('.foot-cols h2'), footP: fs('.foot-cols p'), footSmall: fs('.foot-small') },
      footCols: new Set([...document.querySelectorAll('.foot-cols section')].map((s) => Math.round(s.getBoundingClientRect().left))).size,
    };
  });
async function pickGen(page, id) { await page.locator(`input[name=gen][value=${id}]`).check({ force: true }); await page.waitForTimeout(450); }
if (want('gm3r4-title')) {
  const { ctx, page } = await open({ file: 'title-004', q: 'gen=random&lived=boomer', view: { width: 1280, height: 800 } });
  await check(page, 'gm3r4-title-1280x800');
  const m0 = await titleMeasure4(page);
  notes.push(`gm3r4-title-1280x800(랜덤): ${JSON.stringify(m0)}`);
  if (m0.lead !== 0) problems.push('안내 한 줄(.slot__lead)이 남아 있다');
  if (!m0.chart || m0.chart.bottom > m0.barTop) problems.push(`그래프 카드 아래끝 ${m0.chart?.bottom}이 띠 ${m0.barTop} 아래다(HS3 ④)`);
  if (m0.chartParent !== '.title__side.title__side--r4') problems.push(`1280에서 그래프 자리가 오른쪽 열이 아니다: ${m0.chartParent}`);
  await shot(page, 'gm3r4-title-1280x800');
  // 세대를 바꾼다(라디오 체크) → 그래프·숫자·표·읽기 이름이 X세대로
  await pickGen(page, 'genx');
  const m1 = await titleMeasure4(page);
  notes.push(`gm3r4-chart-genx-1280(X세대로 바꾼 뒤): ${JSON.stringify({ live: m1.live, label: m1.label, nums: m1.nums, subs: m1.subs, tableRows: m1.tableRows, band: m1.band, peak: m1.peak, chart: m1.chart })}`);
  if (!/X세대/.test(m1.live || '') || !/1970~1980년생 구간/.test(m1.label || '') || m1.nums.join() !== '46~56세,89만 명,62.3~66.1세' || m1.tableRows !== 11 || !m1.band || m1.peak !== '1971년 102만') problems.push(`X세대 그래프 상태가 어긋난다: ${JSON.stringify({ live: m1.live, nums: m1.nums, rows: m1.tableRows, band: m1.band, peak: m1.peak })}`);
  await shot(page, 'gm3r4-chart-genx-1280', { el: '.gen-chart' });
  // 가리킴: 플롯 위 1988년 자리로 포인터 → 세로 선·점·글자가 보인다
  const svgBox = await page.locator('.gen-chart__plot').boundingBox();
  const sc = svgBox.width / 400; await page.mouse.move(svgBox.x + (46 + (1988 - 1940) * (346 / 80)) * sc, svgBox.y + 100 * sc); await page.waitForTimeout(100);
  const hover = await page.evaluate(() => ({ text: document.querySelector('.gchart__cursor-text')?.textContent, hidden: document.querySelector('.gchart__cursor-text')?.hasAttribute('hidden') }));
  notes.push(`가리킴(1988년 자리): ${JSON.stringify(hover)}`);
  if (hover.hidden || !/1988년 · 63만 명/.test(hover.text || '')) problems.push(`가리킴 글자가 어긋난다: ${JSON.stringify(hover)}`);
  await page.screenshot({ path: `${TMP4}chart-hover-1280.png`, clip: { x: svgBox.x - 8, y: svgBox.y - 8, width: svgBox.width + 16, height: svgBox.height + 16 } });
  await page.mouse.move(0, 0);
  // 세대 7종 + 랜덤 모두: 숫자 셋이 비지 않고(값 또는 —), 표 줄 수 = 1970년 이후 해 수(+ 1969 이전이면 한 줄)
  for (const id of ['industrial', 'boomer', 'g86', 'millennial', 'genz', 'alpha', 'random']) { await pickGen(page, id); const mm = await titleMeasure4(page); notes.push(`세대 ${id}: nums ${JSON.stringify(mm.nums)} subs ${JSON.stringify(mm.subs)} rows ${mm.tableRows} band ${mm.band} peak ${mm.peak} · ${mm.label}`); if (mm.nums.length !== 3 || mm.nums.some((v) => v === '')) problems.push(`${id}: 숫자 칸이 비었다`); }
  // 키보드(목록, r3와 같은 검사) + 하단
  notes.push(`gm3r4-title-1280x800 키보드: ${JSON.stringify(await keyboardTest3(page))}`);
  await page.locator('.title-foot').scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
  const mf = await titleMeasure4(page); notes.push(`gm3r4-footer-1280: foot ${JSON.stringify(mf.foot)} cols ${mf.footCols} type ${JSON.stringify(mf.type)}`);
  if (mf.footCols !== 3) problems.push(`1280 하단 세 칸이 3열이 아니다: ${mf.footCols}`);
  await shot(page, 'gm3r4-footer-1280', { el: '.title-foot' });
  await ctx.close();
  // 360
  {
    const { ctx: c3, page: p3 } = await open({ file: 'title-004', q: 'gen=random&lived=boomer', view: { width: 360, height: 740 }, dpr: 2, coarse: true });
    await check(p3, 'gm3r4-title-360x740');
    const n0 = await titleMeasure4(p3); notes.push(`gm3r4-title-360x740(랜덤): ${JSON.stringify(n0)}`);
    if (n0.chartParent !== '#gen-chart-slot') problems.push(`360에서 그래프 자리가 목록 아래가 아니다: ${n0.chartParent}`);
    if (n0.logo && n0.logo.width > 328) problems.push(`360 워드마크 폭 ${n0.logo.width} > 328`);
    await shot(p3, 'gm3r4-title-360x740');
    await pickGen(p3, 'millennial');
    await p3.evaluate(() => { const c = document.querySelector('.gen-chart'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 120); }); await p3.waitForTimeout(200);
    const n1 = await titleMeasure4(p3); notes.push(`gm3r4-chart-360x740(밀레니얼): ${JSON.stringify({ live: n1.live, nums: n1.nums, chart: n1.chart, svg: n1.svg, peak: n1.peak })}`);
    await shot(p3, 'gm3r4-chart-360x740');
    notes.push(`gm3r4-title-360x740 키보드: ${JSON.stringify(await keyboardTest3(p3))}`);
    const metaEdge = await p3.evaluate(() => { const l = document.querySelector('.gen-list').getBoundingClientRect(); return [...document.querySelectorAll('.gen-row__meta')].map((m) => Math.round(l.right - m.getBoundingClientRect().right)); });
    if (metaEdge.some((v) => v < 8)) problems.push(`360 메타 오른쪽 여유 < 8: ${JSON.stringify(metaEdge)}`);
    await p3.locator('.title-foot').scrollIntoViewIfNeeded(); await p3.waitForTimeout(150);
    const nf = await titleMeasure4(p3); notes.push(`gm3r4-footer-360: foot ${JSON.stringify(nf.foot)} cols ${nf.footCols}`);
    await shot(p3, 'gm3r4-footer-360', { el: '.title-foot' });
    await c3.close();
  }
  // 검사만: 다크 1280(X세대) · 강제 색상 1280·360(X세대) · 1920 · 320 글자 200%(끊긴 낱말 — 하단 포함) · cream 비교(바탕값) · 대체 글꼴
  for (const [label, view, q, opt] of [
    ['title-dark-1280', { width: 1280, height: 800 }, 'gen=genx&lived=boomer&theme=dark', { dark: true }],
    ['title-forced-1280', { width: 1280, height: 800 }, 'gen=genx&lived=boomer', { forced: true }],
    ['title-forced-360', { width: 360, height: 740 }, 'gen=genx&lived=boomer', { forced: true, dpr: 2, coarse: true }],
    ['title-1920x1080', { width: 1920, height: 1080 }, 'gen=genx&lived=boomer', {}],
    ['title-320-text200', { width: 320, height: 640 }, 'gen=genx&lived=boomer', { text: 200 }],
    ['title-cream-1280', { width: 1280, height: 800 }, 'gen=genx&lived=boomer&alt=cream', {}],
    ['title-system-font-1280', { width: 1280, height: 800 }, 'gen=genx&lived=boomer&font=system', {}],
  ]) {
    const { ctx: c4, page: p4 } = await open({ file: 'title-004', q, view, ...opt });
    await check(p4, `r4 ${label}`);
    const m = await titleMeasure4(p4);
    const broken = label.includes('text200') ? await brokenWords(p4, '.title') : [];
    notes.push(`r4 ${label}: ${JSON.stringify({ bg: m.bg, paper: m.paper, logo: m.logo, listH: m.listH, visibleRows: m.visibleRows, selectedInView: m.selectedInView, mainBottom: m.mainBottom, barTop: m.barTop, chart: m.chart, chartParent: m.chartParent, scrollH: m.scrollH, live: m.live })}${label.includes('text200') ? ` · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}` : ''}`);
    if (label.includes('text200') && broken.length) problems.push(`320 · 200% 끊긴 낱말: ${broken.join(', ')}`);
    await p4.screenshot({ path: `${TMP4}${label}.png`, fullPage: label.includes('text200') || label.includes('forced-1280') });
    await c4.close();
  }
}
if (want('gm3r4-roulette')) {
  const { ctx, page } = await open({ file: 'roulette-004', q: 'state=result', view: { width: 1280, height: 800 } });
  await check(page, 'gm3r4-roulette-result-1280x800');
  notes.push(`gm3r4-roulette-result-1280x800: ${JSON.stringify(await reelMeasure3(page))} · 바탕 ${await page.evaluate(() => getComputedStyle(document.body).backgroundColor)}`);
  await shot(page, 'gm3r4-roulette-result-1280x800');
  await ctx.close();
  for (const [label, file, q, view, opt] of [['roulette-dark-360', 'roulette-004', 'state=result&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }], ['birth-paper-1280', 'birth-004', '', { width: 1280, height: 800 }, {}], ['dash-paper-1280', 'dashboard-004', 'state=then', { width: 1280, height: 800 }, {}]]) {
    const { ctx: c2, page: p2 } = await open({ file, q, view, ...opt });
    await check(p2, `r4 ${label}`);
    notes.push(`r4 ${label}: 바탕 ${await p2.evaluate(() => getComputedStyle(document.body).backgroundColor)} · 넘침 점검 완료`);
    await p2.screenshot({ path: `${TMP4}${label}.png` });
    await c2.close();
  }
}

await browser.close();
writeFileSync(`${MODE === 'r4' ? TMP4 : MODE === 'r3' ? TMP3 : TMP}notes.txt`, notes.join('\n\n'));
if (notes.length > 0) console.log('\n측정:\n' + notes.join('\n\n'));
if (problems.length > 0) {
  console.error('\n문제:\n' + problems.join('\n'));
  process.exit(1);
}
