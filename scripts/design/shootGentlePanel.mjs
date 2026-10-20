/**
 * QI6(무거운 장면 가리기)·QI7(새 소식과 소개 패널) 시안을 Playwright 크로미움으로 찍어 docs/design/screens/005/qi6-*.png·qi7-*.png 로 저장한다 (SPEC-005 QI6·QI7, designer 2026-10-21).
 * 실행: node scripts/design/shootGentlePanel.mjs [이름 조각]
 *   시안 둘 — docs/design/mockups/qi6/veil.html(?state=rows|sheet|inline|fold|parent|ending|tools6) · docs/design/mockups/title-005.html(?hero=illust&gentle=1[&slide=suicide-rate][&veil=open] / ?panel=news|intro[&faq=N][&seen=1]).
 *   브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 다크는 `?theme=dark`, 강제 색상은 forcedColors: 'active'.
 *   샷마다 넘침 점검 ①②(shootMockups.mjs와 같은 규칙), 파일 크기(≤ 300 KB), 그리고 측정 둘 — 첫 화면(HS3 ③④: 왼쪽 열 끝·오른쪽 열 표제어/값 아래끝·띠 위끝), 도구 줄 6칸(이름의 줄 수 — R-122 「두 줄까지」).
 *   넘침이나 300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/';
const OUT = ROOT + 'docs/design/screens/005/';
mkdirSync(OUT, { recursive: true });

const VIEW = { '360x740': { width: 360, height: 740 }, '1280x800': { width: 1280, height: 800 }, '320x640': { width: 320, height: 640 } };
/** 한 장: name(파일 이름 조각) · file(veil|title) · q(질의) · view · dpr · dark · forced · text(글자 %) · full · el(요소만) · measure(title|tools) */
const SHOTS = [
  // ---------- QI6 ----------
  { name: 'qi6-rows-360x740', file: 'veil', q: 'state=rows', view: '360x740', dpr: 2, full: true },
  { name: 'qi6-rows-360x740-dark', file: 'veil', q: 'state=rows&theme=dark', view: '360x740', dpr: 2, dark: true },
  { name: 'qi6-rows-1280x800', file: 'veil', q: 'state=rows', view: '1280x800', dpr: 1 },
  { name: 'qi6-rows-320x640-text200', file: 'veil', q: 'state=rows', view: '320x640', dpr: 1, text: 200, full: true },
  { name: 'qi6-rows-360x740-forced', file: 'veil', q: 'state=rows', view: '360x740', dpr: 2, forced: true },
  { name: 'qi6-sheet-360x740', file: 'veil', q: 'state=sheet', view: '360x740', dpr: 2 },
  { name: 'qi6-sheet-1280x800', file: 'veil', q: 'state=sheet', view: '1280x800', dpr: 1 },
  { name: 'qi6-sheet-1280x800-dark', file: 'veil', q: 'state=sheet&theme=dark', view: '1280x800', dpr: 1, dark: true },
  { name: 'qi6-inline-360x740', file: 'veil', q: 'state=inline', view: '360x740', dpr: 2 },
  { name: 'qi6-fold-360x740', file: 'veil', q: 'state=fold', view: '360x740', dpr: 2, el: 'main.dash' },
  { name: 'qi6-parent-360x740', file: 'veil', q: 'state=parent', view: '360x740', dpr: 2 },
  { name: 'qi6-parent-1280x800-forced', file: 'veil', q: 'state=parent', view: '1280x800', dpr: 1, forced: true },
  { name: 'qi6-ending-360x740', file: 'veil', q: 'state=ending', view: '360x740', dpr: 2, full: true },
  { name: 'qi6-ending-1280x800', file: 'veil', q: 'state=ending', view: '1280x800', dpr: 1, el: '.ending' },
  { name: 'qi6-tools6-360x740', file: 'veil', q: 'state=tools6', view: '360x740', dpr: 2, el: '.toolbar', measure: 'tools' },
  { name: 'qi6-tools6-320x640-text200', file: 'veil', q: 'state=tools6', view: '320x640', dpr: 2, text: 200, el: '.toolbar', measure: 'tools' },
  { name: 'qi6-home-slide-1280x800', file: 'title', q: 'hero=illust&gentle=1&slide=suicide-rate&seen=1', view: '1280x800', dpr: 1, measure: 'title' },
  { name: 'qi6-home-slide-open-360', file: 'title', q: 'hero=illust&gentle=1&slide=suicide-rate&veil=open&seen=1', view: '360x740', dpr: 2, el: '.carousel--005' },
  // ---------- QI7 ----------
  { name: 'qi7-panel-1280x800', file: 'title', q: 'hero=illust&panel=news', view: '1280x800', dpr: 1 },
  { name: 'qi7-panel-1280x800-dark', file: 'title', q: 'hero=illust&panel=news&theme=dark', view: '1280x800', dpr: 1, dark: true },
  { name: 'qi7-panel-360x740', file: 'title', q: 'hero=illust&panel=news', view: '360x740', dpr: 2 },
  { name: 'qi7-panel-intro-360x740', file: 'title', q: 'hero=illust&panel=intro&faq=7', view: '360x740', dpr: 2 },
  { name: 'qi7-panel-320x640-text200', file: 'title', q: 'hero=illust&panel=intro&faq=10', view: '320x640', dpr: 2, text: 200 },
  { name: 'qi7-panel-1280x800-forced', file: 'title', q: 'hero=illust&panel=intro&faq=1', view: '1280x800', dpr: 1, forced: true },
  { name: 'qi7-footer-360', file: 'title', q: 'hero=illust', view: '360x740', dpr: 2, el: '.title-foot' },
];

const only = process.argv[2];
const browser = await chromium.launch();
const problems = [];
const notes = [];
for (const s of SHOTS) {
  if (only !== undefined && !s.name.includes(only)) continue;
  const vw = VIEW[s.view];
  const ctx = await browser.newContext({ viewport: vw, deviceScaleFactor: s.dpr, colorScheme: s.dark ? 'dark' : 'light', forcedColors: s.forced ? 'active' : 'none' });
  const page = await ctx.newPage();
  const url = `${BASE}${s.file === 'veil' ? 'qi6/veil.html' : 'title-005.html'}?${s.q}`;
  await page.goto(url);
  if (s.text !== undefined) await page.addStyleTag({ content: `html { font-size: ${s.text}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const name = `${s.name}.png`;
  // 넘침 점검 ①②(shootMockups.mjs와 같은 규칙 — 숨은 템플릿·탐침·sr-only·svg 안은 제외)
  const over = await page.evaluate(() => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) out.push(`문서 가로 넘침 ${de.scrollWidth} > ${de.clientWidth}`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || el.closest('template') || el.classList.contains('sr-only') || el.closest('.sr-only') || el.classList.contains('fit-pair__probe')) continue;
      const cs = getComputedStyle(el);
      // 시각 숨김(clip rect 0 — 320px의 「일시정지」 라벨처럼 CSS로 읽기 전용이 된 글자)은 auditMockup.mjs와 같이 제외한다
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden' || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      if (/(auto|scroll)/.test(cs.overflowX)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
  if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
  if (s.measure === 'title') {
    // HS3 ③④: 설정 줄(스위치)을 포함한 왼쪽 열 끝 · 오른쪽 열의 표제어·값(가린 슬라이드는 「펼쳐 보기」 버튼) 아래끝 · 하단 띠 위끝 — 스크롤 0 기준
    const m = await page.evaluate(() => {
      const b = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().bottom) : null; };
      const t = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : null; };
      return { leftEnd: b('.title__main'), switchEnd: b('.switch'), insightEnd: b('.slide.is-active .slide__insight'), veilBtnEnd: b('.slide.is-active .slide__veil-btn'), helpEnd: b('.slide.is-active .slide__help'), sideEnd: b('.title__side'), barTop: t('.bottom-bar'), vh: innerHeight };
    });
    notes.push(`${name}: 왼쪽 열 끝 ${m.leftEnd}(스위치 ${m.switchEnd}) · 표제어 아래 ${m.insightEnd} · 「펼쳐 보기」 아래 ${m.veilBtnEnd} · 상담전화 아래 ${m.helpEnd} · 오른쪽 열 보이는 끝 ${m.sideEnd} · 띠 위 ${m.barTop} (뷰포트 ${m.vh})`);
  }
  if (s.measure === 'tools') {
    // 도구 줄 이름의 줄 수(R-122 두 줄까지)와 칸 폭·줄 개수
    const m = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.controls__tools--six > .btn--tool')];
      const rows = new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)));
      return btns.map((b) => { const sp = b.querySelector('span'); const cs = getComputedStyle(sp); const lh = parseFloat(cs.lineHeight); return `${sp.textContent}: ${Math.round(sp.getBoundingClientRect().height / lh)}줄, 칸 ${Math.round(b.getBoundingClientRect().width)}px`; }).concat([`버튼 줄 수 ${rows.size}`, `도구 줄 높이 ${Math.round(document.querySelector('.controls__tools--six').getBoundingClientRect().height)}px`]);
    });
    notes.push(`${name}: ${m.join(' · ')}`);
  }
  if (s.el !== undefined) await page.locator(s.el).first().screenshot({ path: OUT + name });
  else await page.screenshot({ path: OUT + name, fullPage: s.full === true });
  const kb = Math.round(statSync(OUT + name).size / 1024);
  if (kb > 300) problems.push(`${name}: ${kb} KB > 300 KB`);
  console.log('saved', name, `${kb} KB`);
  await ctx.close();
}
await browser.close();
if (notes.length > 0) console.log('\n측정:\n' + notes.join('\n'));
if (problems.length > 0) {
  console.error('\n문제:\n' + problems.join('\n'));
  process.exit(1);
}
