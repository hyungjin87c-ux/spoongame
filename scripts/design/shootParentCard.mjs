/**
 * 부모·흘러감 카드 시안(docs/design/mockups/qi5/parent-card.html)을 Playwright 크로미움으로 찍어 docs/design/screens/005/qi5-*.png 로 저장한다 (SPEC-005 QI5 · REV-005-QI5-1 R-455, designer).
 * 실행: node scripts/design/shootParentCard.mjs [상태이름조각]
 *   모바일 360×740(DPR 2) · 데스크톱 1280×800(DPR 1) · 320×640 글자 200%(DPR 2) · 글리프 시트(DPR 2). 다크는 `?theme=dark`, 강제 색상은 emulateMedia({ forcedColors: 'active' }).
 *   브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 넘침 점검(shootMockups.mjs와 같은 규칙 ①②)에 걸리면 목록을 찍고 종료 코드 1.
 * 파일 이름: qi5-<상태>-<360x740|1280x800|320x640>[-dark|-forced][-text200].png, 글리프 시트는 qi5-glyphs-18px[-dark|-forced].png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOCK = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/qi5/parent-card.html';
const OUT = ROOT + 'docs/design/screens/005/';
mkdirSync(OUT, { recursive: true });

const VIEW = { '360x740': { width: 360, height: 740, dpr: 2 }, '1280x800': { width: 1280, height: 800, dpr: 1 }, '320x640': { width: 320, height: 640, dpr: 2 } };
/** [상태, 변형들] 변형: view(기본 360x740·1280x800), dark, forced, text(글자 %), full(전체 길이), el(요소만) */
const SHOTS = [
  ['parent-first', [{ view: '360x740' }, { view: '360x740', dark: true }, { view: '1280x800' }, { view: '1280x800', dark: true }, { view: '1280x800', forced: true }]],
  ['parent-scholar', [{ view: '360x740' }, { view: '1280x800' }, { view: '320x640', text: 200, full: true }]],
  ['child-bully', [{ view: '360x740' }, { view: '360x740', dark: true }, { view: '1280x800' }, { view: '1280x800', forced: true }]],
  ['child-family', [{ view: '360x740' }, { view: '1280x800', dark: true }]],
  ['rows', [{ view: '360x740', full: true }, { view: '1280x800' }, { view: '360x740', forced: true, full: true }]],
  ['glyphs', [{ view: '1280x800', el: '#glyph-sheet', tag: '18px' }, { view: '1280x800', dark: true, el: '#glyph-sheet', tag: '18px' }, { view: '1280x800', forced: true, el: '#glyph-sheet', tag: '18px' }]],
];

const only = process.argv[2];
const browser = await chromium.launch();
const problems = [];
for (const [state, variants] of SHOTS) {
  if (only !== undefined && !state.includes(only)) continue;
  for (const v of variants) {
    const vw = VIEW[v.view];
    const ctx = await browser.newContext({ viewport: { width: vw.width, height: vw.height }, deviceScaleFactor: vw.dpr, colorScheme: v.dark ? 'dark' : 'light', forcedColors: v.forced ? 'active' : 'none' });
    const page = await ctx.newPage();
    const q = new URLSearchParams({ state });
    if (v.dark) q.set('theme', 'dark');
    await page.goto(`${MOCK}?${q.toString()}`);
    if (v.text !== undefined) await page.addStyleTag({ content: `html { font-size: ${v.text}% !important; }` });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const name = `qi5-${state}${v.tag ? `-${v.tag}` : `-${v.view}`}${v.dark ? '-dark' : ''}${v.forced ? '-forced' : ''}${v.text ? `-text${v.text}` : ''}.png`;
    // 넘침 점검 ①②(shootMockups.mjs와 같은 규칙)
    const over = await page.evaluate(() => {
      const out = [];
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth) out.push(`문서 가로 넘침 ${de.scrollWidth} > ${de.clientWidth}`);
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg') || el.classList.contains('sr-only')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.display === 'inline' || cs.visibility === 'hidden') continue;
        if (/(auto|scroll)/.test(cs.overflowX)) continue;
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.left < -0.5 || r.right > de.clientWidth + 0.5)) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
      }
      return out;
    });
    if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
    if (v.el !== undefined) await page.locator(v.el).screenshot({ path: OUT + name });
    else await page.screenshot({ path: OUT + name, fullPage: v.full === true });
    console.log('saved', name);
    await ctx.close();
  }
}
await browser.close();
if (problems.length > 0) {
  console.error('넘침:\n' + problems.join('\n'));
  process.exit(1);
}
