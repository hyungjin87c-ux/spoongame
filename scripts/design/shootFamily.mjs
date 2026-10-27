/**
 * SPEC-009 집과 가족 그림 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/ (designer 2026-10-27).
 * 실행: node scripts/design/shootFamily.mjs            ← FM2c 정본 캡처 4장 + 검사 (집 그림 + 연도 표 + 「시대의 창」 배치)
 *       node scripts/design/shootFamily.mjs preview    ← 작업 중 미리보기(.taste-skill/009/preview/, 저장소에 올리지 않는다)
 *       node scripts/design/shootFamily.mjs fm2        ← FM2 게이트 캡처 6장(그림체 둘 — 먼저 buildFamilyMockups.mjs --with-s2)
 *       node scripts/design/shootFamily.mjs fm2b       ← (기록) FM2b 캡처 — 생성기가 매체 층을 뺀 뒤에는 다시 만들지 않는다(커밋 9f9d2da의 산출물을 그대로 둔다)
 *   시안은 먼저 `node scripts/design/buildFamilyMockups.mjs`로 만든다. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://).
 * FM2c 캡처(4장, ≤ 300 KB):
 *   fm2c-dash-1280.png — 1280×800 대시보드(장면 A를 1988년에 · 시대의 창 = 성화대 · 결정 카드 접은 띠)
 *   fm2c-dash-e-1280.png — 한계 장면 E(8명 + 2마리, 1968 · 시대의 창 = 생활 장면 연) 그림 카드 2:1 · 비교 5:2 · 3:1 (식구 px 실측)
 *   fm2c-dash-360.png — 360×740 대시보드(쌓기, 기본) · 비교: 나란히 2:1 · 접기
 *   fm2c-dash-dark.png — 다크 1280 그림 카드 · 다크 360 · 강제 색상 1280 그림 카드
 * 검사: 문서·요소 가로 넘침 0(1280·360·320 글자 200%·1920), 집 그림 높이 ≤ 25vh, 카드 순서(결정 → 그림 → 기록), 접기(둘 다 사라짐) 키보드, 대체 글(연도 포함), 시대의 창 = 링크 1(초점 정지점), 한 줄 ≤ 2줄@360·창 한 줄 ≤ 2줄, 연도 표 대비 ≥ 4.5, 다크·강제 색상, 외부 요청 0.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/';
const MODE = process.argv[2] || 'fm2c';
const PREVIEW = MODE === 'preview';
if (MODE === 'fm2b') { console.log('fm2b 캡처는 기록입니다 — 생성기가 매체 층을 뺀 뒤에는 다시 만들지 않습니다(docs/design/screens/009/fm2b-*.png 그대로).'); process.exit(0); }
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
    // FM2c: 연도 표 · 시대의 창 · 식구 조각 px · 초점 정지점
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
    const yEl = document.querySelector('.scene__year');
    const yr = yEl && yEl.getBoundingClientRect();
    const ycs = yEl && getComputedStyle(yEl);
    const era = document.querySelector('.era');
    const er = era && era.getBoundingClientRect();
    const ep = era && era.querySelector('.era__pic') && era.querySelector('.era__pic').getBoundingClientRect();
    const ecap = era && era.querySelector('.era__cap');
    const ecs = ecap && getComputedStyle(ecap);
    const eline = era && era.querySelector('.era__line');
    const eraLines = eline ? Math.round(eline.getBoundingClientRect().height / (parseFloat(ecs.lineHeight) || 1)) : 0; // 문장(.era__line)이 차지하는 줄 수 — PC에서는 머리 글자 줄이 그 위에 하나 더 있다
    const eraName = era && (era.textContent || '').replace(/\s+/g, ' ').trim();
    const figOf = (sel) => { const g = document.querySelector(`.scene__svg [data-layer="식구"] [data-piece^="${sel}"]`); if (!g) return null; const b = g.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
    const focusables = [...document.querySelectorAll('.scene-card a[href], .scene-card button, .scene-card summary, .scene-card [tabindex]:not([tabindex="-1"])')].filter((el) => el.getBoundingClientRect().height > 0).map((el) => (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase());
    const strip = r('.scene');
    return { vw: innerWidth, vh: innerHeight, picH: pic && Math.round(pic.height), picW: pic && Math.round(pic.width), picTop: pic && Math.round(pic.top), maxH: Math.round(innerHeight * 0.25), order, alt, lines, lineText: line && line.textContent, fold: (document.querySelector('.scene-card') || {}).dataset?.fold, foldName: (document.querySelector('.scene__fold') || {}).textContent,
      stripH: strip && Math.round(strip.height), year: yEl && { text: yEl.textContent, w: Math.round(yr.width), h: Math.round(yr.height), fontPx: parseFloat(ycs.fontSize), contrast: contrast(ycs.color, ycs.backgroundColor), right: Math.round(pic ? pic.right - yr.right : 0), top: Math.round(pic ? yr.top - pic.top : 0) },
      era: era && { id: era.dataset.era, hidden: era.dataset.hidden, w: Math.round(er.width), h: Math.round(er.height), picW: ep && Math.round(ep.width), picH: ep && Math.round(ep.height), capFontPx: ecs && parseFloat(ecs.fontSize), capLines: eraLines, capH: ecap && Math.round(ecap.getBoundingClientRect().height), capChars: (era.querySelector('.era__line') || {}).textContent?.length, name: eraName, href: era.getAttribute('href'), capContrast: ecs && contrast(ecs.color, getComputedStyle(era).backgroundColor) },
      fig: { adult: figOf('fig-young-m') || figOf('fig-young-f'), child: figOf('fig-child'), toddler: figOf('fig-toddler') }, focusables, eraLinkTarget: !!document.querySelector((era && era.getAttribute('href')) || '#nope') };
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
  // ================= FM2c — 집 그림 + 연도 표 + 시대의 창 =================
  const cardShot = async (label, q, view, opt, file) => {
    const { ctx, page } = await open({ file: 'dashboard-family', q, view, ...opt });
    await check(page, label);
    const m = await dashMeasure(page);
    if (m.picH !== null && m.picH > m.maxH) problems.push(`${label} 집 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
    if (m.lines > 2 && view.width >= 360) problems.push(`${label} 한 줄 ${m.lines}줄`);
    if (m.era && m.era.capLines > 2 && !opt.text && !/split=(2.5|3)/.test(q)) problems.push(`${label} 시대의 창 한 줄 ${m.era.capLines}줄`); // 5:2·3:1은 비교용 — 줄 수는 캡션에 적는다
    if (m.year && m.year.contrast < 4.5 && !opt.forced) problems.push(`${label} 연도 표 대비 ${m.year.contrast}`);
    if (m.era && m.era.capContrast < 4.5 && !opt.forced) problems.push(`${label} 시대의 창 글자 대비 ${m.era.capContrast}`);
    if (m.era && !m.eraLinkTarget) problems.push(`${label} 시대의 창 링크 대상 없음 ${m.era.href}`);
    const center = m.order.find((x) => x.cls === 'scene-card');
    const ord = m.order.filter((o) => center && o.left === center.left).sort((x, y) => x.top - y.top).map((o) => o.cls).join(' → ');
    notes.push(`${label}: 집 ${m.picW}×${m.picH}(25vh ${m.maxH}) 띠 ${m.stripH} · 연도 「${m.year?.text}」 ${m.year?.w}×${m.year?.h} ${m.year?.fontPx}px 대비 ${m.year?.contrast} · 창 ${m.era?.id ?? '-'} ${m.era?.w}×${m.era?.h} 그림 ${m.era?.picW}×${m.era?.picH} 글 ${m.era?.capFontPx}px ${m.era?.capLines}줄(${m.era?.capChars}자) 대비 ${m.era?.capContrast} · 식구 어른 ${m.fig.adult?.join('×')} 어린이 ${m.fig.child?.join('×')} · 한 줄 ${m.lines}줄 · 초점 ${m.focusables.join(', ')} · 순서 ${ord}`);
    if (file) {
      await page.evaluate(() => { const el = document.querySelector('.scene-card'); const head = document.querySelector('.dash-head'); const h = head ? head.getBoundingClientRect().height : 0; window.scrollBy(0, el.getBoundingClientRect().top - h - 8); });
      await page.waitForTimeout(150);
      if (file.endsWith('-full.png')) await page.screenshot({ path: file });
      else await page.locator('.scene-card').screenshot({ path: file });
    }
    await ctx.close();
    return m;
  };
  // ---------- ① 1280×800 대시보드: 장면 A @ 1988 · 시대의 창 성화대 · 결정 카드 띠 ----------
  {
    const { ctx, page } = await open({ file: 'dashboard-family', q: 'scene=a&era=stadium&decision=fold', view: { width: 1280, height: 800 } });
    await check(page, 'fm2c-dash-1280');
    const m = await dashMeasure(page);
    notes.push(`dash-a1988-1280: 집 ${m.picW}×${m.picH}(25vh ${m.maxH}) 연도 「${m.year.text}」 대비 ${m.year.contrast} 창 ${m.era.id} ${m.era.w}×${m.era.h} 그림 ${m.era.picW}×${m.era.picH} 글 ${m.era.capLines}줄 · 대체 글 「${m.alt}」 · 창 접근 이름 「${m.era.name}」 · 초점 ${m.focusables.join(', ')}`);
    if (m.focusables.filter((f) => f === 'era').length !== 1) problems.push('시대의 창 초점 정지점이 1개가 아님');
    // 접기: 집 그림과 창이 함께 사라지고 한 줄·펼침·접기 단추가 남는다 (키보드 Enter 왕복)
    await page.focus('.scene__fold');
    await page.keyboard.press('Enter');
    const folded = await page.evaluate(() => ({ fold: document.querySelector('.scene-card').dataset.fold, strip: getComputedStyle(document.querySelector('.scene')).display, line: !!document.querySelector('.scene__line').offsetParent, era: document.querySelector('.era').getBoundingClientRect().height }));
    await page.keyboard.press('Enter');
    const un = await dashMeasure(page);
    if (folded.fold !== 'true' || folded.strip !== 'none' || !folded.line || folded.era !== 0 || un.fold !== 'false') problems.push(`접기 동작: ${JSON.stringify(folded)} → ${un.fold}`);
    // 시대의 창 링크 Enter → 인생 기록 카드로
    await page.focus('.era');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const hash = await page.evaluate(() => location.hash);
    if (hash !== '#life-log') problems.push(`시대의 창 링크 이동 실패 ${hash}`);
    await page.evaluate(() => { history.replaceState(null, '', location.pathname + location.search); scrollTo(0, 0); });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}fm2c-dash-1280.png` });
    saved(`${OUT}fm2c-dash-1280.png`);
    await ctx.close();
  }
  // ---------- ② 한계 장면 E @ 1968(연) — 2:1 기본 · 5:2 · 3:1 비교 (식구 px 실측) ----------
  {
    const items = [];
    for (const [split, cap] of [['2', '2:1 (제안)'], ['2.5', '5:2 (비교)'], ['3', '3:1 (비교)']]) {
      const f = `${TMP}dash-e-split-${split}.png`;
      const m = await cardShot(`dash-e-1280-split-${split}`, `scene=e&split=${split}&decision=fold`, { width: 1280, height: 800 }, {}, f);
      items.push([f, `${cap} — 집 ${m.picW}×${m.picH}px · 창 ${m.era.w}×${m.era.h}(그림 ${m.era.picW}×${m.era.picH}) · 어른 ${m.fig.adult?.[1]}px · 어린이 ${m.fig.child?.[1]}px · 창 한 줄 ${m.era.capLines}줄`, 534]);
    }
    await composite(`${OUT}fm2c-dash-e-1280.png`, items, `FM2c — ${SCENE_CAP.e} · 1280 가운데 열(카드 534px) · 집 그림 : 시대의 창 비율 비교 (시안 · 가짜 이름·나이 · 시대의 창 = 생활 장면 표본, 승인 전)`, { row: true, width: 1120 });
  }
  // ---------- ③ 360×740: 쌓기(기본) · 나란히(비교, 컨테이너 규칙을 강제로 끔) · 접기 ----------
  {
    const items = [];
    const f1 = `${TMP}dash-a-360-full.png`;
    const m1 = await cardShot('dash-a1988-360', 'scene=a&era=stadium', { width: 360, height: 740 }, { dpr: 2, coarse: true }, f1);
    items.push([f1, `쌓기(제안) — 집 ${m1.picW}×${m1.picH}(25vh ${m1.maxH}) · 창 띠 ${m1.era.w}×${m1.era.h}(그림 ${m1.era.picW}×${m1.era.picH}, 글 ${m1.era.capFontPx}px ${m1.era.capLines}줄) · 띠 합계 ${m1.stripH}px · 한 줄 ${m1.lines}줄`, 360]);
    {
      const { ctx, page } = await open({ file: 'dashboard-family', q: 'scene=a&era=stadium', view: { width: 360, height: 740 }, dpr: 2 });
      await page.addStyleTag({ content: '.scene{grid-template-columns:minmax(0,2fr) minmax(0,1fr) !important}.era{flex-direction:column !important}.era__pic{width:auto !important;aspect-ratio:auto !important;flex:1 1 0 !important;min-height:48px !important}.era__cap{font-size:var(--fs-xs) !important;padding:var(--sp-1) var(--sp-2) var(--sp-2) !important}.era__label{display:block !important}.era__sep{display:none !important}' });
      await page.waitForTimeout(100);
      const m = await dashMeasure(page);
      notes.push(`dash-a-360-sidebyside(비교): 집 ${m.picW}×${m.picH} 창 ${m.era.w}×${m.era.h} 그림 ${m.era.picW}×${m.era.picH} 글 ${m.era.capLines}줄 · 어른 ${m.fig.adult?.join('×')} 어린이 ${m.fig.child?.join('×')}`);
      await page.evaluate(() => { const el = document.querySelector('.scene-card'); el.scrollIntoView({ block: 'start' }); });
      const f = `${TMP}dash-a-360-side.png`;
      await page.locator('.scene-card').screenshot({ path: f });
      items.push([f, `나란히 2:1(비교) — 집 ${m.picW}×${m.picH} · 어른 ${m.fig.adult?.[1]}px · 어린이 ${m.fig.child?.[1]}px · 창 ${m.era.w}×${m.era.h} 글 ${m.era.capLines}줄`, 326]);
      await ctx.close();
    }
    const f3 = `${TMP}dash-a-360-fold.png`;
    const m3 = await cardShot('dash-a1988-360-fold', 'scene=a&era=stadium&fold=1', { width: 360, height: 740 }, { dpr: 2 }, f3);
    items.push([f3, `접기(「그림 접기」 뒤) — 집 그림과 창이 함께 접히고 한 줄·펼침이 남는다 · 접힘 ${m3.fold}`, 326]);
    await composite(`${OUT}fm2c-dash-360.png`, items, 'FM2c — 360×740 휴대폰 · 장면 A를 1988년에 · 시대의 창 = 성화대 (시안 · 가짜 이름·나이 · 표본은 승인 전)', { row: true, width: 1120 });
  }
  // ---------- ④ 다크 1280 · 다크 360 · 강제 색상 1280 ----------
  {
    const items = [];
    const f1 = `${TMP}dash-dark-1280.png`;
    const m1 = await cardShot('dash-dark-1280-a1988', 'scene=a&era=stadium&theme=dark&decision=fold', { width: 1280, height: 800 }, { dark: true }, f1);
    items.push([f1, `다크 1280 — 연도 표 대비 ${m1.year.contrast} · 창 글자 대비 ${m1.era.capContrast}`, 534]);
    const f2 = `${TMP}dash-dark-360-full.png`;
    const m2 = await cardShot('dash-dark-360-e', 'scene=e&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }, f2);
    items.push([f2, `다크 360 — 한계 장면 E · 창 = 생활 장면(연) · 한 줄 ${m2.lines}줄`, 360]);
    const f3 = `${TMP}dash-forced-1280.png`;
    await cardShot('dash-forced-1280-a1988', 'scene=a&era=stadium&decision=fold', { width: 1280, height: 800 }, { forced: true }, f3);
    items.push([f3, '강제 색상 1280 — 그림은 토큰 유지(forced-color-adjust none), 연도 표·창은 Canvas/CanvasText + 1px 테두리', 534]);
    await composite(`${OUT}fm2c-dash-dark.png`, items, 'FM2c — 다크·강제 색상 (시안 · 가짜 이름·나이)', { row: true, width: 1120 });
  }
  // ---------- ⑤ 검사만: 결정 카드 열림 · 1920 · 1280×600(25vh이 먼저 닿는 높이) · 글자 200% · 강제 360 · 가리기 상태 · 머리 글자 없이 · 나이 표 · 표본 없는 장면 · 움직임 줄이기 ----------
  for (const [label, q, view, opt] of [
    ['dash-decision-open-1280-a', 'scene=a&era=stadium', { width: 1280, height: 800 }, {}],
    ['dash-1920-e', 'scene=e', { width: 1920, height: 1080 }, {}],
    ['dash-1280x600-a', 'scene=a&era=stadium&decision=fold', { width: 1280, height: 600 }, {}],
    ['dash-320-text200-e-open', 'scene=e&open=1', { width: 320, height: 640 }, { text: 200 }],
    ['dash-1280-text200-a', 'scene=a&era=stadium&decision=fold', { width: 1280, height: 800 }, { text: 200 }],
    ['dash-forced-360-e', 'scene=e', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
    ['dash-hide-1280-a', 'scene=a&era=ballot&hide=1&decision=fold', { width: 1280, height: 800 }, {}],
    ['dash-nolabel-1280-a', 'scene=a&era=stadium&label=0&decision=fold', { width: 1280, height: 800 }, {}],
    ['dash-stamp-age-360-a', 'scene=a&era=stadium&stamp=age', { width: 360, height: 740 }, { dpr: 2 }],
    ['dash-b-1280', 'scene=b&decision=fold', { width: 1280, height: 800 }, {}],
    ['dash-d-360-dark', 'scene=d&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }],
    ['dash-reduce-1280-a', 'scene=a&era=stadium&motion=reduce', { width: 1280, height: 800 }, { reduced: true }],
  ]) await cardShot(label, q, view, opt, `${TMP}${label}.png`);
  // scenes.html 전체(라이트·다크·360) 넘침 + 표본 셋
  for (const [label, q, view, opt] of [['scenes-1280', '', { width: 1280, height: 800 }, {}], ['scenes-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }], ['scenes-360', '', { width: 360, height: 740 }, { dpr: 2 }]]) {
    const { ctx, page } = await open({ file: 'scenes', q, view, ...opt });
    await check(page, label);
    const n = await page.locator('#era-samples .cmp__fig').count();
    if (n !== 3) problems.push(`${label}: 시대의 창 표본 ${n}개(3 기대)`);
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
