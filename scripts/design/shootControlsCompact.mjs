/**
 * SPEC-012 조작 버튼 작게 시안(docs/design/mockups/controls-compact.html)을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/012/ (designer 2026-11-08).
 * 실행: node scripts/design/shootControlsCompact.mjs
 *   변형 ?v=now | a | b × 뷰포트 360×740(터치, 글자 100%·200%) · 320×568(터치) · 1280×800 · 1024×768(마우스). 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 외부 요청 0.
 *   잰 것: 하단 띠(.controls-fixed) 높이·뷰포트 대비 %·줄 수·버튼 높이·거친 포인터의 ::before 확장, 도구 줄(.controls__tools) 높이·줄 수·버튼 폭, 도구 줄 블록(.toolbar) 높이, 넘침(shootR4.mjs와 같은 규칙).
 *   산출: controls-compact-360.png(지금 · 안 A · 안 B 나란히) · controls-compact-pc.png(1280·1024, 지금 ↔ 안 B) · controls-compact-measure.json. 넘침이나 300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/controls-compact.html';
const OUT = ROOT + 'docs/design/screens/012/';
const TMP = ROOT + '.taste-skill/012/controls/tmp/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const kb = (f) => Math.round(statSync(f).size / 1024);

async function open({ v, view, mobile = false, text, dark = false }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(`${PAGE}?v=${v}${text ? `&text=${text}` : ''}${dark ? '&theme=dark' : ''}`);
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
      if (el.closest('svg') || el.closest('template') || el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
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
const measure = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const bar = q('.controls-fixed');
    const tools = q('.controls__tools');
    const toolbar = q('.toolbar');
    const head = q('.dash-head');
    const r = (el) => el.getBoundingClientRect();
    const btns = [...bar.querySelectorAll('.btn')];
    const toolBtns = [...tools.querySelectorAll('.btn')];
    const rowsOf = (els) => [...new Set(els.map((b) => Math.round(r(b).top)))].length;
    const before = getComputedStyle(btns[0], '::before');
    const hasBefore = before.content !== 'none' && before.content !== 'normal' && before.content !== '';
    const barCs = getComputedStyle(bar);
    return {
      vw: innerWidth,
      vh: innerHeight,
      coarse: matchMedia('(pointer: coarse)').matches,
      bar: { h: Math.round(r(bar).height), fixed: barCs.position === 'fixed', pct: +((r(bar).height / innerHeight) * 100).toFixed(1), rows: rowsOf(btns), btnH: Math.round(r(btns[0]).height), btnW: btns.map((b) => Math.round(r(b).width)), hitExt: hasBefore ? `${before.top} ${before.bottom}` : 'none', padTop: barCs.paddingTop, gap: barCs.gap },
      tools: { h: Math.round(r(tools).height), rows: rowsOf(toolBtns), btnH: Math.round(r(toolBtns[0]).height), btnW: toolBtns.map((b) => Math.round(r(b).width)), labelLines: toolBtns.map((b) => Math.round(r(b.querySelector('span:not(.sr-only)')).height)) },
      toolbarH: Math.round(r(toolbar).height),
      headH: Math.round(r(head).height),
      released: document.documentElement.classList.contains('bar-released'),
    };
  });

const CASES = [
  { id: '360x740', view: { width: 360, height: 740 }, mobile: true },
  { id: '360x740-text200', view: { width: 360, height: 740 }, mobile: true, text: 200 },
  { id: '360x640', view: { width: 360, height: 640 }, mobile: true },
  { id: '320x568', view: { width: 320, height: 568 }, mobile: true },
  { id: '1280x800', view: { width: 1280, height: 800 } },
  { id: '1024x768', view: { width: 1024, height: 768 } },
];
const result = {};
const shots = {};
for (const c of CASES) {
  for (const v of ['now', 'a', 'b']) {
    const { ctx, page } = await open({ v, view: c.view, mobile: c.mobile, text: c.text });
    const name = `${c.id}-${v}`;
    const over = await overflowReport(page);
    if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
    result[name] = await measure(page);
    console.log(name, JSON.stringify(result[name]));
    if (c.id === '360x740' || c.id === '360x740-text200') {
      const f = `${TMP}${name}.png`;
      await page.screenshot({ path: f });
      shots[name] = f;
    } else if ((c.id === '1280x800' || c.id === '1024x768') && v !== 'a') {
      const f = `${TMP}${name}.png`;
      await page.screenshot({ path: f, clip: { x: 0, y: 0, width: c.view.width, height: 176 } });
      shots[name] = f;
    }
    await ctx.close();
  }
}
writeFileSync(`${OUT}controls-compact-measure.json`, JSON.stringify(result, null, 2));

// ---------- 합성(외부 요청 0): 요소 샷을 한 페이지에 모아 다시 찍는다 ----------
const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
async function compose(file, html, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#e9e4d8;font:12px/1.4 'Malgun Gothic',sans-serif;color:#23211d}.row{display:flex;gap:16px;align-items:flex-start}figure{margin:0}figcaption{margin:0 0 6px;font-weight:700}img{display:block;border:1px solid #857d6b}.col{display:flex;flex-direction:column;gap:14px}</style><body>${html}</body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  const size = kb(file);
  if (size > 300) problems.push(`${file}: ${size} KB > 300 KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
const m = (name) => result[name];
const cap = (name, label) => {
  const x = m(name);
  return `${label} — 하단 띠 ${x.bar.h}px(${x.bar.pct}%) · 도구 줄 ${x.tools.h}px`;
};
await compose(
  `${OUT}controls-compact-360.png`,
  `<div class="row">
    <figure><figcaption>${cap('360x740-now', '지금')}</figcaption><img src="${img(shots['360x740-now'])}" width="360"></figure>
    <figure><figcaption>${cap('360x740-a', '안 A · 두 줄 36px')}</figcaption><img src="${img(shots['360x740-a'])}" width="360"></figure>
    <figure><figcaption>${cap('360x740-b', '안 B · 한 줄, 배속 한 단추')}</figcaption><img src="${img(shots['360x740-b'])}" width="360"></figure>
  </div>`,
  1160,
);
const capPc = (name, label) => {
  const x = m(name);
  return `${label} — 도구 줄 블록 ${x.toolbarH}px · 진행 줄 ${x.bar.rows}줄 ${x.bar.btnH}px`;
};
await compose(
  `${OUT}controls-compact-pc.png`,
  `<div class="col">
    <figure><figcaption>${capPc('1280x800-now', '1280 · 지금')}</figcaption><img src="${img(shots['1280x800-now'])}" width="1280"></figure>
    <figure><figcaption>${capPc('1280x800-b', '1280 · 안 B')}</figcaption><img src="${img(shots['1280x800-b'])}" width="1280"></figure>
    <figure><figcaption>${capPc('1024x768-now', '1024 · 지금')}</figcaption><img src="${img(shots['1024x768-now'])}" width="1024"></figure>
    <figure><figcaption>${capPc('1024x768-b', '1024 · 안 B')}</figcaption><img src="${img(shots['1024x768-b'])}" width="1024"></figure>
  </div>`,
  1310,
);

await browser.close();
if (problems.length > 0) {
  console.error('문제:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('완료 — 넘침 0, 300 KB 초과 0');
