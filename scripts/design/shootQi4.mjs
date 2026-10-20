/**
 * QI4(전망 슬라이드 5 · 연령별 격차 슬라이드) 시안을 Playwright 크로미움으로 찍어 docs/design/screens/005/qi4-*.png 로 저장하고, 일곱 슬라이드 전부를 뷰포트마다 재서 넘침·HS3 ④를 점검한다 (SPEC-005 QI4, designer 2026-10-21).
 * 실행: node scripts/design/shootQi4.mjs [이름 조각]   (--measure-only 면 샷 없이 측정만)
 *   시안: docs/design/mockups/title-005.html?hero=illust&seen=1&slide=<id>[&theme=dark]. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://).
 *   360은 CDP로 pointer: coarse·hover: none을 흉내 내어 터치 규칙(44px)을 켠다. 글자 200%는 html font-size 200%.
 *   샷마다 넘침 점검 ①②(shootGentlePanel.mjs와 같은 규칙), 파일 크기(≤ 300 KB). 넘침이나 300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 *   측정(HS3 ③④): 스크롤 0에서 왼쪽 열 끝 · 전망 칩 위끝 · 표제어 아래끝 · 값 아래끝 · 오른쪽 열 보이는 끝 · 하단 띠 위끝.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/title-005.html?hero=illust&seen=1';
const OUT = ROOT + 'docs/design/screens/005/';
mkdirSync(OUT, { recursive: true });

const SLIDES = ['elderly-poverty', 'income-gap-by-age', 'projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection', 'projection-newborn-age-structure'];
const VIEW = { '360x740': { width: 360, height: 740 }, '1280x800': { width: 1280, height: 800 }, '1920x1080': { width: 1920, height: 1080 }, '320x640': { width: 320, height: 640 } };
/** 한 장: name · slide · view · dpr · dark · forced · text(글자 %) · el(요소만) · coarse */
const SHOTS = [
  { name: 'qi4-pop-1280x800', slide: 'projection-population-total', view: '1280x800', dpr: 1 },
  { name: 'qi4-pop-1280x800-dark', slide: 'projection-population-total', view: '1280x800', dpr: 1, dark: true },
  { name: 'qi4-pop-1920x1080', slide: 'projection-population-total', view: '1920x1080', dpr: 1, el: '.carousel--005' }, // 전체 화면 410 KB·오른쪽 열 304 KB라 카드만(1920 폭의 카드 428px) — 왼쪽 열·그림은 1280 샷과 같고 HS3 ④ 수치는 측정 표에
  { name: 'qi4-pop-360x740', slide: 'projection-population-total', view: '360x740', dpr: 2, coarse: true, el: '.carousel--005' },
  { name: 'qi4-aging-1280x800', slide: 'projection-aging-share', view: '1280x800', dpr: 1 },
  { name: 'qi4-aging-360x740-dark', slide: 'projection-aging-share', view: '360x740', dpr: 2, coarse: true, dark: true, el: '.carousel--005' },
  { name: 'qi4-onep-1280x800', slide: 'projection-one-person-households', view: '1280x800', dpr: 1 },
  { name: 'qi4-onep-360x740', slide: 'projection-one-person-households', view: '360x740', dpr: 2, coarse: true, el: '.carousel--005' },
  { name: 'qi4-heat-1280x800-forced', slide: 'heat-projection', view: '1280x800', dpr: 1, forced: true },
  { name: 'qi4-heat-360x740', slide: 'heat-projection', view: '360x740', dpr: 2, coarse: true, el: '.carousel--005' },
  { name: 'qi4-newborn-1280x800', slide: 'projection-newborn-age-structure', view: '1280x800', dpr: 1 },
  { name: 'qi4-newborn-360x740', slide: 'projection-newborn-age-structure', view: '360x740', dpr: 2, coarse: true, el: '.carousel--005' },
  { name: 'qi4-gap-1280x800', slide: 'income-gap-by-age', view: '1280x800', dpr: 1, clip: { x: 640, y: 0, width: 640, height: 800 } }, // r2: 보조 줄 둘이 더해져 전체 화면이 301 KB — 오른쪽 열(그림 + 카드 + 띠, 스크롤 0)만. 왼쪽 열은 다른 1280 샷과 같다

  { name: 'qi4-gap-320x640-text200', slide: 'income-gap-by-age', view: '320x640', dpr: 1, text: 200, el: '.carousel--005' },
  // r2(REV-005-QI4-1): 격차 막대 360 · 띠 그래프(#17) 강제 색상(R-477·R-483 a — 띠 면이 사라지고 가장자리 점선·「고위」「저위」가 남는지) · 아기 점무늬 강제 색상(R-477). 1280 강제 색상은 카드만(그래프가 접힘 아래)
  { name: 'qi4-gap-360x740', slide: 'income-gap-by-age', view: '360x740', dpr: 2, coarse: true, el: '.carousel--005' },
  { name: 'qi4-aging-1280x800-forced', slide: 'projection-aging-share', view: '1280x800', dpr: 1, forced: true, el: '.carousel--005' },
  { name: 'qi4-newborn-1280x800-forced', slide: 'projection-newborn-age-structure', view: '1280x800', dpr: 1, forced: true, el: '.carousel--005' },
];
/** 측정 조합: 일곱 슬라이드 × 여섯 조건(샷은 없음) */
const MEASURES = [
  { view: '1280x800', dpr: 1 },
  { view: '1920x1080', dpr: 1 },
  { view: '1280x800', dpr: 1, dark: true },
  { view: '1280x800', dpr: 1, forced: true },
  { view: '360x740', dpr: 1, coarse: true },
  { view: '320x640', dpr: 1, text: 200 },
];

const args = process.argv.slice(2);
const measureOnly = args.includes('--measure-only');
const only = args.find((a) => !a.startsWith('--'));
const browser = await chromium.launch();
const problems = [];
const notes = [];

async function open(s) {
  const vw = VIEW[s.view];
  const ctx = await browser.newContext({ viewport: vw, deviceScaleFactor: s.dpr, colorScheme: s.dark ? 'dark' : 'light', forcedColors: s.forced ? 'active' : 'none' });
  const page = await ctx.newPage();
  if (s.coarse) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }, { name: 'any-pointer', value: 'coarse' }] });
  }
  await page.goto(`${BASE}&slide=${s.slide}${s.dark ? '&theme=dark' : ''}`);
  if (s.text !== undefined) await page.addStyleTag({ content: `html { font-size: ${s.text}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return { ctx, page };
}
const overflowOf = (page) =>
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
const measureOf = (page) =>
  page.evaluate(() => {
    const b = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().bottom) : null; };
    const t = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : null; };
    const a = document.querySelector('.slide.is-active');
    const chip = a.querySelector('.chip');
    const chipBox = chip ? chip.getBoundingClientRect() : null;
    const nav = [...document.querySelectorAll('.carousel__nav .nav-btn')].map((x) => `${Math.round(x.getBoundingClientRect().width)}×${Math.round(x.getBoundingClientRect().height)}`);
    const insight = a.querySelector('.slide__insight');
    const lh = parseFloat(getComputedStyle(insight).lineHeight);
    return {
      leftEnd: b('.title__main'), cardTop: t('.carousel--005'), chipTop: chipBox ? Math.round(chipBox.top) : null, chip: chipBox ? `${Math.round(chipBox.width)}×${Math.round(chipBox.height)}` : null,
      insightEnd: b('.slide.is-active .slide__insight'), insightLines: Math.round(insight.getBoundingClientRect().height / lh), valueEnd: b('.slide.is-active .slide__value'), chartEnd: b('.slide.is-active .chart'),
      sideEnd: b('.title__side'), barTop: t('.bottom-bar'), vh: innerHeight, nav: nav.join(' '),
    };
  });

if (!measureOnly) {
  for (const s of SHOTS) {
    if (only !== undefined && !s.name.includes(only)) continue;
    const { ctx, page } = await open(s);
    const name = `${s.name}.png`;
    const over = await overflowOf(page);
    if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
    if (s.el !== undefined) await page.locator(s.el).first().screenshot({ path: OUT + name });
    else if (s.clip !== undefined) await page.screenshot({ path: OUT + name, clip: s.clip });
    else await page.screenshot({ path: OUT + name });
    const kb = Math.round(statSync(OUT + name).size / 1024);
    if (kb > 300) problems.push(`${name}: ${kb} KB > 300 KB`);
    console.log('saved', name, `${kb} KB`);
    await ctx.close();
  }
}
for (const m of MEASURES) {
  for (const slide of SLIDES) {
    if (only !== undefined && !measureOnly && !slide.includes(only)) continue;
    const s = { ...m, slide };
    const { ctx, page } = await open(s);
    const tag = `${slide} @ ${m.view}${m.dark ? ' dark' : ''}${m.forced ? ' forced' : ''}${m.coarse ? ' coarse' : ''}${m.text ? ` text${m.text}` : ''}`;
    const over = await overflowOf(page);
    if (over.length > 0) problems.push(`${tag}: ${over.join(' | ')}`);
    const r = await measureOf(page);
    const wide = VIEW[m.view].width >= 960;
    const ok = !wide || (r.insightEnd < r.barTop && r.valueEnd < r.barTop);
    notes.push(`${tag}: 왼쪽 열 끝 ${r.leftEnd} · 카드 위 ${r.cardTop} · 칩 ${r.chip ?? '-'}(위 ${r.chipTop ?? '-'}) · 표제어 아래 ${r.insightEnd}(${r.insightLines}줄) · 값 아래 ${r.valueEnd} · 그래프 아래 ${r.chartEnd} · 열 끝 ${r.sideEnd} · 띠 위 ${r.barTop} · 조작 ${r.nav}${wide ? (ok ? ' · HS3④ 통과' : ' · HS3④ 실패') : ''}`);
    if (wide && !ok) problems.push(`${tag}: HS3 ④ — 표제어 ${r.insightEnd}/값 ${r.valueEnd} vs 띠 ${r.barTop}`);
    await ctx.close();
  }
}
await browser.close();
if (notes.length > 0) console.log('\n측정:\n' + notes.join('\n'));
if (problems.length > 0) {
  console.error('\n문제:\n' + problems.join('\n'));
  process.exit(1);
}
