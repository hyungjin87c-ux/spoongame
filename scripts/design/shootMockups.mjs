/**
 * 시안 HTML을 Playwright로 찍어 docs/design/screens/003/ 에 저장한다 (SPEC-003 DS6, designer).
 * 실행: npx vite-node scripts/design/buildMockups.mjs && npx vite-node scripts/design/shootMockups.mjs [이름조각]
 *   모바일 360×740(DPR 2), 데스크톱 1280×800(DPR 1), 320×640(DPR 2, 좁은 화면 1장 이상).
 * 넘침 점검(모든 샷 + 320px 전수, REV-003-D-1 R-122):
 *   ① 문서 가로 넘침: documentElement.scrollWidth > clientWidth
 *   ② 요소 단위 넘침: overflow가 auto/scroll이 아닌 모든 요소에서 scrollWidth > clientWidth + 1 (버튼 이름이 버튼 밖으로 삐져나오는 것을 잡는다),
 *      그리고 요소의 경계 상자가 화면 밖(left < 0, right > 화면 폭)으로 나가는 것. sr-only·svg 내부·inline·숨김 요소는 제외.
 *   하나라도 있으면 목록을 출력하고 종료 코드 1.
 * 파일 이름: <화면>-<mobile|desktop|320>[-dark|-forced|-reduced][-full].png (birth-bottom은 맨 아래로 스크롤한 샷)
 *   -reduced = 움직임 줄이기(prefers-reduced-motion: reduce) 에뮬레이션. 그 밖의 샷은 no-preference(연출이 보이는 상태).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOCK = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/';
const OUT = ROOT + 'docs/design/screens/003/';
mkdirSync(OUT, { recursive: true });

const VIEW = { mobile: { width: 360, height: 740, dpr: 2 }, desktop: { width: 1280, height: 800, dpr: 1 }, 320: { width: 320, height: 640, dpr: 2 } };
/** [파일, 이름, { m: 모바일 변형[], d: 데스크톱 변형[], n: 320 변형[] }] 변형 옵션: dark, forced, reduced, full(전체 길이), bottom(맨 아래로 스크롤) */
const SHOTS = [
  // 첫 화면 (확정 A안)
  ['title-a.html', 'title-a', { m: [{}, { dark: true }, { forced: true }, { full: true }], d: [{}, { dark: true }], n: [{}] }],
  ['title-continue.html', 'title-continue', { m: [{}], d: [{}] }],
  // 룰렛: 회전 중(연출 있는 상태) / 결과 / 움직임 줄이기(= 결과 상태 + 안내 한 줄, 별도 시안 파일 — R-171)
  ['roulette-spin.html', 'roulette-spin', { m: [{}], d: [{}] }],
  ['roulette-result.html', 'roulette-result', { m: [{}, { dark: true }], d: [{}] }],
  ['roulette-result-reduced.html', 'roulette-result', { m: [{ reduced: true }], d: [{ reduced: true }] }],
  // 출생신고 상·하
  ['birth.html', 'birth-top', { m: [{}, { full: true }, { dark: true }], d: [{}] }],
  ['birth.html', 'birth-bottom', { m: [{ bottom: true }], d: [{ bottom: true }] }],
  // 대시보드
  ['dashboard-infant.html', 'dashboard-infant', { m: [{}, { dark: true }, { full: true }], d: [{}, { dark: true }] }],
  ['dashboard-adult.html', 'dashboard-adult', { m: [{}, { full: true }, { forced: true }], d: [{}, { dark: true }, { forced: true }], n: [{}] }],
  // 카드
  ['decision-infant.html', 'decision-infant', { m: [{}], d: [{}] }],
  ['decision-adult.html', 'decision-adult', { m: [{}, { dark: true }], d: [{}, { dark: true }] }],
  ['note.html', 'note', { m: [{}, { dark: true }], d: [{}] }],
  // 엔딩
  ['ending.html', 'ending', { m: [{}, { full: true }, { dark: true }], d: [{}] }],
  // 디자인 시스템
  ['components.html', 'components', { m: [{ full: true }], d: [{ full: true }, { dark: true, full: true }] }],
  ['symbols.html', 'symbols', { m: [{ full: true }], d: [{ full: true }] }],
  ['faces.html', 'faces-48', { m: [{ full: true }], d: [{ full: true }] }],
  ['faces-all.html', 'faces-80', { m: [{ full: true }], d: [{ full: true }] }],
];

const only = process.argv[2];
const browser = await chromium.launch();
const problems = [];

/** 페이지 안에서 실행: 문서·요소 단위 가로 넘침 목록 */
function overflowReport() {
  const out = [];
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(`document scrollWidth ${de.scrollWidth} > ${de.clientWidth}`);
  const vw = de.clientWidth;
  const describe = (el) => {
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `<${el.tagName.toLowerCase()}${cls}> "${text}"`;
  };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)') continue; // 읽기 전용(시각적으로 숨긴) 요소
    if (el.clientWidth === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${describe(el)} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    if (r.right > vw + 1 || r.left < -1) out.push(`${describe(el)} 화면 밖 (left ${Math.round(r.left)}, right ${Math.round(r.right)}, 화면 ${vw})`);
  }
  return out;
}

async function shoot(file, name, kind, opt) {
  const v = VIEW[kind];
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
    forcedColors: opt.forced ? 'active' : 'none',
    reducedMotion: opt.reduced ? 'reduce' : 'no-preference',
    colorScheme: opt.dark ? 'dark' : 'light',
  });
  const page = await ctx.newPage();
  await page.goto(MOCK + file + (opt.dark ? '?theme=dark' : ''));
  await page.waitForLoadState('load');
  await page.waitForTimeout(80);
  let suffix = '';
  if (opt.dark) suffix += '-dark';
  if (opt.forced) suffix += '-forced';
  if (opt.reduced) suffix += '-reduced';
  const label = `${name}-${kind}${suffix}`;
  for (const p of await page.evaluate(overflowReport)) problems.push(`${label}: ${p}`);
  if (opt.full) {
    const h = await page.evaluate(() => Math.min(6000, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
    await page.setViewportSize({ width: v.width, height: Math.max(v.height, h) });
    await page.waitForTimeout(100);
    suffix += '-full';
  }
  if (opt.bottom) {
    // 이름(birth-bottom)에 이미 「아래」가 들어 있으므로 접미사를 더하지 않는다
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
  }
  const path = `${OUT}${name}-${kind}${suffix}.png`;
  await page.screenshot({ path });
  await ctx.close();
  console.log('saved', path.replace(ROOT, ''));
}

for (const [file, name, plan] of SHOTS) {
  if (only && !name.includes(only)) continue;
  for (const [kind, variants] of [['mobile', plan.m ?? []], ['desktop', plan.d ?? []], ['320', plan.n ?? []]]) {
    for (const opt of variants) await shoot(file, name, kind, opt);
  }
}

// 320px 전수 넘침 점검(스크린샷 없이): 모든 화면 시안, 라이트·다크
if (!only) {
  for (const [file] of SHOTS.filter(([, n]) => !/^faces|^components|^symbols/.test(n))) {
    for (const dark of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
      const page = await ctx.newPage();
      await page.goto(MOCK + file + (dark ? '?theme=dark' : ''));
      await page.waitForLoadState('load');
      await page.waitForTimeout(60);
      for (const p of await page.evaluate(overflowReport)) problems.push(`${file} 320px${dark ? ' dark' : ''}: ${p}`);
      await ctx.close();
    }
  }
}
await browser.close();
const uniq = [...new Set(problems)];
console.log(uniq.length === 0 ? '넘침 없음: 문서 가로 넘침 0 · 요소 단위 넘침 0 (360·1280·320, 라이트·다크·강제 색상·움직임 줄이기)' : `넘침 ${uniq.length}건:\n` + uniq.join('\n'));
if (uniq.length > 0) process.exit(1);
