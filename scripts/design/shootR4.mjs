/**
 * SPEC-005 r4 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/005/r4-*.png (designer 2026-10-26).
 * 실행: node scripts/design/shootR4.mjs [이름 조각]   (시안은 먼저 `node node_modules/vite-node/vite-node.mjs scripts/design/buildR4Mockups.mjs`로 만든다)
 *   시안: docs/design/mockups/r4/decision-r4.html(?state=sheet|inline|fold|veiled|opened) · toolbar-r4.html(?state=default|bgm|exit|auto). 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 다크 `?theme=dark`, 강제 색상 forcedColors.
 *   샷마다 넘침 점검 ①②(shootGentlePanel.mjs와 같은 규칙), 파일 크기(≤ 300 KB). 합성 샷 둘(폭별 도구 줄 쌓기 · 가린 카드 ↔ 펼친 카드 나란히)은 요소 샷을 한 페이지에 모아 다시 찍는다(외부 요청 0).
 *   측정: ① 도구 줄 — 폭 960·1024·1100·1180·1280·1366·1920 × 글자 100%(1280·1920은 200%도)에서 12개 버튼의 줄 수, 진행 줄·도구 줄 폭, 필요 폭(두 묶음 + 16), 컨테이너 질의 적용 여부(도구 줄 flex-wrap), 문서 넘침
 *        ② 결정 시트 — 질문 줄·풀이·자동 버튼의 자리(위쪽 좌표)·시트 높이, 360·320 글자 200%의 넘침·끊김.
 *   넘침이나 300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/r4/';
const OUT = ROOT + 'docs/design/screens/005/';
const TMP = ROOT + '.taste-skill/005/r4/after/mock/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const only = process.argv[2];
const browser = await chromium.launch();
const problems = [];
const notes = [];
const kb = (f) => Math.round(statSync(f).size / 1024);

async function open({ file, q = '', view, dpr = 1, dark = false, forced = false, text }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: dpr, colorScheme: dark ? 'dark' : 'light', forcedColors: forced ? 'active' : 'none' });
  const page = await ctx.newPage();
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
      if (/(auto|scroll)/.test(cs.overflowX)) continue;
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
const want = (name) => only === undefined || name.includes(only);

// ---------- ① 도구 줄 측정 + 폭별 요소 샷 ----------
const toolbarMeasure = (page) =>
  page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-testid="controls"] .btn, [data-testid="tools"] .btn')];
    const tops = [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)))];
    const q = (sel) => document.querySelector(sel);
    const de = document.documentElement;
    return {
      buttons: btns.length,
      rows: tops.length,
      innerW: Math.round(q('.toolbar__inner').getBoundingClientRect().width),
      ctlW: q('[data-testid="controls"]').scrollWidth,
      toolsW: q('[data-testid="tools"]').scrollWidth,
      needed: q('[data-testid="controls"]').scrollWidth + 16 + q('[data-testid="tools"]').scrollWidth,
      toolsNowrap: getComputedStyle(q('[data-testid="tools"]')).flexWrap === 'nowrap',
      docOverflow: de.scrollWidth - de.clientWidth,
      btnH: Math.round(btns[0].getBoundingClientRect().height),
    };
  });
const widthShots = {};
if (want('toolbar')) {
  const table = [];
  for (const w of [960, 1024, 1100, 1180, 1280, 1366, 1920]) {
    for (const text of w === 1280 || w === 1920 ? [100, 200] : [100]) {
      const { ctx, page } = await open({ file: 'toolbar-r4', q: 'state=default', view: { width: w, height: 800 }, text: text === 100 ? undefined : text });
      const m = await toolbarMeasure(page);
      table.push({ w, text, ...m });
      await check(page, `toolbar-${w}-${text}`);
      if (text === 100) {
        const f = `${TMP}toolbar-${w}.png`;
        await page.locator('.toolbar').screenshot({ path: f });
        widthShots[w] = f;
      }
      await ctx.close();
    }
  }
  notes.push('도구 줄(시안): 폭 | 글자 | 줄 수 | 진행 줄 폭 | 도구 줄 폭 | 필요 폭 | 내용 폭 | nowrap | 넘침\n' + table.map((r) => `${r.w} | ${r.text}% | ${r.rows} | ${r.ctlW} | ${r.toolsW} | ${r.needed} | ${r.innerW} | ${r.toolsNowrap} | ${r.docOverflow}`).join('\n'));
  // 볼륨 줄·확인 상자: 12개 버튼의 x 좌표 불변(1280)
  const xs = {};
  for (const state of ['default', 'bgm', 'exit']) {
    const { ctx, page } = await open({ file: 'toolbar-r4', q: `state=${state}`, view: { width: 1280, height: 800 } });
    xs[state] = await page.evaluate(() => [...document.querySelectorAll('[data-testid="controls"] .btn, [data-testid="tools"] .btn')].map((b) => Math.round(b.getBoundingClientRect().left)));
    const f = `${TMP}toolbar-1280-${state}.png`;
    await page.locator('.toolbar').screenshot({ path: f });
    await check(page, `toolbar-1280-${state}`);
    if (state === 'default') {
      await page.screenshot({ path: `${OUT}r4-toolbar-1280x800.png` });
      saved(`${OUT}r4-toolbar-1280x800.png`);
    }
    await ctx.close();
  }
  const shift = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  notes.push(`볼륨 줄을 켰을 때 12개 버튼 x 변화 최대 ${shift(xs.default, xs.bgm)}px · 확인 상자 ${shift(xs.default, xs.exit)}px (1280)`);
  // 합성 1: 폭별 도구 줄 쌓기
  await composite(`${OUT}r4-toolbar-widths.png`, [960, 1024, 1100, 1180, 1280, 1366, 1920].map((w) => [widthShots[w], `${w}px (내용 폭 ${Math.min(w, 1200) - 32}px)`]), '도구 줄 r4 — 폭별 (글자 100%)');
  // 합성 2: 1280에서 기본 / 볼륨 줄 / 확인 상자
  await composite(`${OUT}r4-toolbar-rows-1280.png`, [[`${TMP}toolbar-1280-default.png`, '기본'], [`${TMP}toolbar-1280-bgm.png`, 'BGM 켜짐 — 볼륨 줄은 아래 별도 줄'], [`${TMP}toolbar-1280-exit.png`, '나가기 — 확인 상자는 아래 별도 줄']], '도구 줄 r4 — 1280px, 한 줄 밖의 것');
  // 360 불변
  {
    const { ctx, page } = await open({ file: 'toolbar-r4', q: 'state=default', view: { width: 360, height: 740 }, dpr: 2 });
    await check(page, 'toolbar-360');
    await page.screenshot({ path: `${OUT}r4-toolbar-360x740.png` });
    saved(`${OUT}r4-toolbar-360x740.png`);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="controls"]');
      const tools = document.querySelector('[data-testid="tools"]');
      return { barPos: getComputedStyle(bar).position, barH: Math.round(bar.getBoundingClientRect().height), toolsRows: [...new Set([...tools.querySelectorAll('.btn')].map((b) => Math.round(b.getBoundingClientRect().top)))].length, toolsH: Math.round(tools.getBoundingClientRect().height) };
    });
    notes.push(`360×740: 진행 줄 position ${m.barPos}(하단 고정 띠) 높이 ${m.barH}px · 도구 줄 ${m.toolsRows}줄 높이 ${m.toolsH}px — < 960px 규칙 불변`);
    await ctx.close();
  }
}

// ---------- ② 결정 카드 ----------
const sheetMeasure = (page) =>
  page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : null; };
    const h = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : null; };
    const sheet = document.querySelector('.sheet, .decision--inline');
    return { sheetH: h('.sheet, .decision--inline'), sheetScrollH: sheet ? sheet.scrollHeight : null, cite: t('.cite'), insight: t('.cite__insight'), src: t('.cite__src'), ask: t('.decision__ask'), firstChoice: t('.choice'), autoBtn: t('.decision__autobtn'), autoSub: t('.decision__autosub'), askGap: t('.choice') - (t('.decision__ask') ?? 0) - h('.decision__ask'), insightGap: (t('.cite__insight') ?? 0) - (t('.cite__src') ?? 0) - (h('.cite__src') ?? 0), vh: innerHeight };
  });
if (want('sheet') || want('inline') || want('veiled') || want('focus')) {
  // 1280 라이트 / 강제 색상
  for (const [name, opt] of [['r4-sheet-1280x800', {}], ['r4-sheet-1280x800-forced', { forced: true }]]) {
    const { ctx, page } = await open({ file: 'decision-r4', q: 'state=sheet', view: { width: 1280, height: 800 }, ...opt });
    await check(page, name);
    await page.screenshot({ path: `${OUT}${name}.png` });
    saved(`${OUT}${name}.png`);
    if (!opt.forced) notes.push(`시트 1280×800: ${JSON.stringify(await sheetMeasure(page))}`);
    await ctx.close();
  }
  // 360 다크(뷰포트) · 360 전체(시트 요소, max-height 해제) · 320 글자 200% 전체
  {
    const { ctx, page } = await open({ file: 'decision-r4', q: 'state=sheet&theme=dark', view: { width: 360, height: 740 }, dpr: 2, dark: true });
    await check(page, 'r4-sheet-360x740-dark');
    await page.screenshot({ path: `${OUT}r4-sheet-360x740-dark.png` });
    saved(`${OUT}r4-sheet-360x740-dark.png`);
    await ctx.close();
  }
  for (const [name, view, text, dpr] of [['r4-sheet-360-full', { width: 360, height: 740 }, undefined, 2], ['r4-sheet-320-text200-full', { width: 320, height: 640 }, 200, 1]]) {
    const { ctx, page } = await open({ file: 'decision-r4', q: 'state=sheet', view, dpr, text });
    const before = await sheetMeasure(page);
    await check(page, name);
    await page.addStyleTag({ content: '.sheet { max-height: none !important; } .overlay { align-items: flex-start !important; height: auto !important; position: absolute !important; }' });
    await page.waitForTimeout(100);
    await page.locator('.sheet').screenshot({ path: `${OUT}${name}.png` });
    saved(`${OUT}${name}.png`);
    const broken = await page.evaluate(() => {
      // 낱말 끊김(QM3-1): 시트 안 글자 요소에서 한 줄보다 긴 낱말이 있는지 — 어절 단위 범위로 잰다(간이: 글자 상자가 줄 폭을 넘는 어절)
      const out = [];
      const sheet = document.querySelector('.sheet');
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let n;
      while ((n = walker.nextNode())) {
        const el = n.parentElement;
        if (!el || el.closest('.sr-only, svg, .fit-pair__probe')) continue;
        const lineW = el.getBoundingClientRect().width;
        const words = n.textContent.split(/\s+/).filter(Boolean);
        let idx = 0;
        for (const w of words) {
          const at = n.textContent.indexOf(w, idx);
          range.setStart(n, at); range.setEnd(n, at + w.length);
          const rects = [...range.getClientRects()];
          if (rects.length > 1 && w.length > 1 && !/^[A-Za-z0-9(),.%:~·—-]+$/.test(w)) out.push(`${w}(${Math.round(lineW)}px)`);
          idx = at + w.length;
        }
      }
      return out.slice(0, 10);
    });
    notes.push(`${name}: 시트 전체 높이 ${before.sheetScrollH}px(보이는 ${before.sheetH}, 화면 ${before.vh}) · 질문↔첫 선택지 ${before.askGap}px · 출처↔풀이 ${before.insightGap}px · 끊긴 낱말 ${broken.length === 0 ? '0' : broken.join(', ')}`);
    await ctx.close();
  }
  // 인라인 카드(자동 모드 켜짐) — 카드 요소
  {
    const { ctx, page } = await open({ file: 'decision-r4', q: 'state=inline', view: { width: 360, height: 740 }, dpr: 2 });
    await check(page, 'r4-inline-360-card');
    notes.push(`인라인 360(측정은 띠를 숨기기 전): ${JSON.stringify(await sheetMeasure(page))}`);
    // 카드 요소 샷: 카드가 한 화면보다 길어 조각을 이어 붙일 때 하단 고정 진행 줄이 가운데에 끼므로 이 샷에서만 띠를 숨긴다(시안 표식 — 구현 화면의 띠는 그대로)
    await page.addStyleTag({ content: '.controls-fixed { visibility: hidden !important; }' });
    await page.locator('.decision--inline').screenshot({ path: `${OUT}r4-inline-360-card.png` });
    saved(`${OUT}r4-inline-360-card.png`);
    await ctx.close();
  }
  // 가린 카드 ↔ 펼친 카드(같은 카드 middle-layoff 55세) — 합성
  const pair = [];
  for (const [state, cap] of [['veiled', '가린 카드(설정 켜짐): 질문·풀이·자동 고르기 버튼 없음 — 「이번에는 자동으로 고르기」만'], ['opened', '「펼쳐서 읽기」 뒤: 질문 줄 · 풀이 · 「이후 결정을 자동으로 고르게 하기」']]) {
    const { ctx, page } = await open({ file: 'decision-r4', q: `state=${state}`, view: { width: 360, height: 740 }, dpr: 1 });
    await check(page, `r4-${state}-360`);
    await page.addStyleTag({ content: '.sheet { max-height: none !important; } .overlay { align-items: flex-start !important; height: auto !important; position: absolute !important; }' });
    await page.waitForTimeout(100);
    const f = `${TMP}sheet-${state}-360.png`;
    await page.locator('.sheet').screenshot({ path: f });
    pair.push([f, cap]);
    await ctx.close();
  }
  await composite(`${OUT}r4-veiled-vs-opened-360.png`, pair, '가린 카드와 펼친 카드 — 55세 「정리 대상이 된 아침」(일과 생계), 360px', { row: true });
  // 키보드 포커스: Tab으로 자동 고르기 버튼까지
  {
    const { ctx, page } = await open({ file: 'decision-r4', q: 'state=sheet', view: { width: 1280, height: 800 } });
    await page.locator('#dc-title').focus();
    let id = '';
    const order = [];
    for (let i = 0; i < 12 && id !== 'auto-on-btn'; i++) {
      await page.keyboard.press('Tab');
      id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? '');
      order.push(id);
    }
    notes.push(`Tab 순서(시트): 제목 → ${order.join(' → ')}`);
    await page.locator('.sheet').screenshot({ path: `${OUT}r4-focus-1280.png` });
    saved(`${OUT}r4-focus-1280.png`);
    await ctx.close();
  }
}

/** 요소 샷 여러 장을 한 페이지에 모아 다시 찍는다(설명 글은 시안 표식 — 외부 자원 0) */
async function composite(outFile, items, title, { row = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: row ? 760 : 1240, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = items.map(([f, cap]) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt=""><figcaption>${cap}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f6f3ec;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-direction:${row ? 'row' : 'column'};gap:16px;align-items:flex-start}figure{margin:0;flex:${row ? '1 1 0' : 'none'};min-width:0}img{display:block;max-width:100%;height:auto;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: row ? 760 : 1240, height: h });
  await page.screenshot({ path: outFile, fullPage: true });
  saved(outFile);
  await ctx.close();
}

await browser.close();
writeFileSync(`${TMP}notes.txt`, notes.join('\n\n'));
if (notes.length > 0) console.log('\n측정:\n' + notes.join('\n\n'));
if (problems.length > 0) {
  console.error('\n문제:\n' + problems.join('\n'));
  process.exit(1);
}
