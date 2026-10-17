/**
 * 시안 HTML을 Playwright로 찍어 docs/design/screens/003/ 에 저장한다 (SPEC-003 DS6, designer).
 * 실행: npx vite-node scripts/design/buildMockups.mjs && npx vite-node scripts/design/shootMockups.mjs [이름조각 | --check]
 *   모바일 360×740(DPR 2), 데스크톱 1280×800(DPR 1), 320×640(DPR 2, 좁은 화면 1장 이상), low 320×256(DPR 2 — 400% 확대 상당의 낮은 화면, 띠 고정 해제 QM2-12 확인용).
 *   이름조각을 주면 그 이름의 샷만 다시 찍고(320px 전수 점검은 건너뜀), `--check`면 샷 없이 320px 전수 점검만 한다.
 * 넘침 점검(모든 샷 + 320px 전수, REV-003-D-1 R-122):
 *   ① 문서 가로 넘침: documentElement.scrollWidth > clientWidth
 *   ② 요소 단위 넘침: overflow가 auto/scroll이 아닌 모든 요소에서 scrollWidth > clientWidth + 1 (버튼 이름이 버튼 밖으로 삐져나오는 것을 잡는다),
 *      그리고 요소의 경계 상자가 화면 밖(left < 0, right > 화면 폭)으로 나가는 것. sr-only·svg 내부·inline·숨김 요소는 제외.
 *   하나라도 있으면 목록을 출력하고 종료 코드 1.
 * 파일 이름: <화면>-<mobile|desktop|320|low>[-dark|-forced|-reduced][-textNNN][-full].png (birth-bottom은 맨 아래로 스크롤한 샷)
 *   -reduced = 움직임 줄이기(prefers-reduced-motion: reduce) 에뮬레이션. 그 밖의 샷은 no-preference(연출이 보이는 상태).
 *   -textNNN = 글자 크기 NNN%(html { font-size } — CM11 글자 확대 상태, e2e/textResize.ts와 같은 방식).
 * 같은 시안 파일을 주소 질의(`query`)로 다른 상태로 여는 샷(첫 화면 `state=confirm`·`slide=…`, 출생신고 `era=past|future`)은 320px 전수 점검에도 (파일, 질의) 조합마다 들어간다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOCK = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/';
const OUT = ROOT + 'docs/design/screens/003/';
mkdirSync(OUT, { recursive: true });

const VIEW = { mobile: { width: 360, height: 740, dpr: 2 }, desktop: { width: 1280, height: 800, dpr: 1 }, 320: { width: 320, height: 640, dpr: 2 }, low: { width: 320, height: 256, dpr: 2 } };
/** [파일, 이름, { m: 모바일 변형[], d: 데스크톱 변형[], n: 320 변형[], l: low(320×256) 변형[] }] 변형 옵션: dark, forced, reduced, full(전체 길이), bottom(맨 아래로 스크롤), to(이 선택자의 요소가 화면 위에 오게 스크롤), query(시안 주소의 질의 문자열 — 예 'slide=marriage-count', 'state=confirm', 'era=past'), text(글자 크기 %, 예 200) */
const SHOTS = [
  // 첫 화면 (확정 A안). 캐러셀은 구현과 같은 모델의 14장을 모두 품고 `?slide=<id>`로 보이는 슬라이드를 고른다(기본 1/14 합계출산율)
  ['title-a.html', 'title-a', { m: [{}, { dark: true }, { forced: true }, { full: true }], d: [{}, { dark: true }], n: [{}] }],
  // B형 기준 줄 「27.8명」 / 「인구 10만 명당 · 2025년 기준」 + 상담전화 안내(QM2-4·SC6); 320px에서는 「통계 기준」 줄의 짧은 쌍이 두 줄 모드(QM2-10)
  ['title-a.html', 'title-a-suicide', { m: [{ query: 'slide=suicide-rate', to: '.carousel' }], n: [{ query: 'slide=suicide-rate', to: '.carousel' }] }],
  // 320px 기준 줄부터 카드 끝까지: 「통계 기준」 짧은 쌍이 두 줄 모드(기호 숨김, QM2-10 규칙 3 — 문턱 16.5em > 칸 256px)
  ['title-a.html', 'title-a-pair-split', { n: [{ query: 'slide=suicide-rate', to: '.slide.is-active .slide__basis' }] }],
  // 큰 값 아래 조혼인율 줄(QM2-11)
  ['title-a.html', 'title-a-marriage', { m: [{ query: 'slide=marriage-count', to: '.carousel' }], d: [{ query: 'slide=marriage-count' }] }],
  ['title-continue.html', 'title-continue', { m: [{}], d: [{}] }],
  // 확인 단계(R-204·QM2-6): 안내문 + 「이전 판 지우고 태어나기」(보조) / 「돌아가기」(기본, 맨 아래). low(320×256)에서는 띠가 화면 절반을 넘어 고정이 풀려 본문 끝에 놓인다(QM2-12)
  ['title-continue.html', 'title-confirm', { m: [{ query: 'state=confirm' }], d: [{ query: 'state=confirm' }], l: [{ query: 'state=confirm', bottom: true }] }],
  // 룰렛(구현 모델 core/roulette.ts#buildRoulette, 2026-10-16 M3 맞춤): 회전 중(가장 빠른 구간의 한 프레임 — 흐림·줄무늬) / 결과(수저 릴 왕복 순서라 창 위아래가 이웃 단계: 은 · 동 · [흙] · 동 · 은, R-274) / 움직임 줄이기(= 결과 상태 + 안내 한 줄, 별도 시안 파일 — R-171)
  ['roulette-spin.html', 'roulette-spin', { m: [{}], d: [{}], n: [{}] }],
  // 320 · 글자 200%: 제목 글자 크기 상한(QM3-2) — 「태어날 곳이 / 정해졌습니다」 낱말 사이에서만 접히고 한 글자가 홀로 남지 않는다. 릴 칸의 「다이아몬드<wbr>수저」(D-05)는 320 · 100% 샷
  ['roulette-result.html', 'roulette-result', { m: [{}, { dark: true }, { forced: true }], d: [{}], n: [{}, { text: 200 }] }],
  ['roulette-result-reduced.html', 'roulette-result', { m: [{ reduced: true }], d: [{ reduced: true }] }],
  // 출생신고(지금 세상·시안 주인공): 위·전체·다크·강제 색상(띠는 Canvas/CanvasText + 3px 아래선 — R-291) / 아래(비교 표 3행 + 기대수명 한 줄 + 하단 표기) / 320(「태어난 곳」 한 줄, 또래 칩이 이름 아래) / 넓은 화면(3열 격자 — 「태어난 곳」 두 칸, R-281)
  // / 폭 320·글자 200%(띠 표기가 제목 아래로, 도장은 본문 기준, 격자는 본문 폭 11.5rem 미만이라 **1열** — QM3-1)
  ['birth.html', 'birth-top', { m: [{}, { full: true }, { dark: true }, { forced: true }], d: [{}], n: [{}, { text: 200 }] }],
  // 폭 320 · 글자 200%의 서류 격자: 본문 폭 246px < 11.5rem(368px)이라 **1열** — 어머니·아버지 칸이 한 줄 전체를 받아 직업 이름이 끊기지 않는다(QM3-1, 구현 근거 qa/screenshots/003/dev-M3-r4-birth-grid-320x568-200-jobs.png)
  ['birth.html', 'birth-grid', { n: [{ to: '.doc__grid', text: 200 }] }],
  ['birth.html', 'birth-bottom', { m: [{ bottom: true }], d: [{ bottom: true }] }],
  // 또래 목록(R-269: 이름 옆 「여성/남성」, 좁은 폭에서 칩은 이름 아래 줄)과 비교 카드(카드 내용 폭 35rem 미만이면 한 행이 한 덩어리 — 글자 100%는 좁은 화면, 글자 150%는 데스크톱에서도 쌓인다, QM3-1)
  ['birth.html', 'birth-peers', { m: [{ to: '[aria-labelledby="peers-t"]' }], n: [{ to: '[aria-labelledby="peers-t"]' }] }],
  ['birth.html', 'birth-compare', { m: [{ to: '[aria-labelledby="cmp-t"]' }], d: [{ to: '[aria-labelledby="cmp-t"]' }, { to: '[aria-labelledby="cmp-t"]', text: 150 }], n: [{ to: '[aria-labelledby="cmp-t"]' }] }],
  // 지난·다가올 세상 출생신고(구현 출생 생성기 출력, `?era=`): 비교 카드 없음(R-263), 하단 표기 5줄, 지난 세상은 지역 표기가 다르다(R-264). 다가올 세상은 다이아몬드수저 + 「전남광주통합특별시」
  // — 320 · 글자 150%는 다이아몬드 칩이 칸보다 넓어져 점이 다음 줄로, 이름은 「다이아몬드<wbr>수저」 자리에서만 끊기는 모습(D-05 후속 샷)
  ['birth.html', 'birth-past', { m: [{ query: 'era=past' }, { query: 'era=past', full: true }], d: [{ query: 'era=past' }] }],
  ['birth.html', 'birth-past-bottom', { d: [{ query: 'era=past', bottom: true }] }],
  ['birth.html', 'birth-future', { m: [{ query: 'era=future' }, { query: 'era=future', full: true }], d: [{ query: 'era=future' }], n: [{ query: 'era=future', full: true }, { query: 'era=future', text: 150, to: '.doc__grid' }] }],
  ['birth.html', 'birth-future-bottom', { d: [{ query: 'era=future', bottom: true }] }],
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

const arg = process.argv[2];
const checkOnly = arg === '--check';
const only = checkOnly ? undefined : arg;
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
  // 읽기 전용으로 접은(clip: rect(0 0 0 0)) 요소와 그 안 — 좁은 화면 비교 표의 머리글(thead)처럼 화면에 그려지지 않는 것은 세지 않는다(구현 e2e 측정기 e2e/textResize.ts와 같은 규칙, M3)
  const clipped = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).clip === 'rect(0px, 0px, 0px, 0px)');
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || clipped.some((c) => c.contains(el))) continue;
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
  const query = [opt.dark ? 'theme=dark' : '', opt.query ?? ''].filter(Boolean).join('&');
  await page.goto(MOCK + file + (query ? `?${query}` : ''));
  await page.waitForLoadState('load');
  if (opt.text) {
    // 글자 확대 상태(CM11): 문서 루트 글자 크기만 키운다(e2e/textResize.ts와 같은 방식). 시안의 흉내 스크립트(띠 높이·FitPair)는 resize 신호로 다시 잰다
    await page.addStyleTag({ content: `html { font-size: ${opt.text}%; }` });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  }
  await page.waitForTimeout(80);
  let suffix = '';
  if (opt.dark) suffix += '-dark';
  if (opt.forced) suffix += '-forced';
  if (opt.reduced) suffix += '-reduced';
  if (opt.text) suffix += `-text${opt.text}`;
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
  if (opt.to) {
    // 특정 요소(예: 좁은 화면에서 접힘선 아래에 있는 통계 카드)가 화면 위에 오도록 스크롤한 샷 — 이름에 그 뜻이 들어 있어 접미사를 더하지 않는다
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8);
    }, opt.to);
    await page.waitForTimeout(150);
  }
  const path = `${OUT}${name}-${kind}${suffix}.png`;
  await page.screenshot({ path });
  await ctx.close();
  console.log('saved', path.replace(ROOT, ''));
}

for (const [file, name, plan] of SHOTS) {
  if (checkOnly || (only && !name.includes(only))) continue;
  for (const [kind, variants] of [['mobile', plan.m ?? []], ['desktop', plan.d ?? []], ['320', plan.n ?? []], ['low', plan.l ?? []]]) {
    for (const opt of variants) await shoot(file, name, kind, opt);
  }
}

// 320px 전수 넘침 점검(스크린샷 없이): 모든 화면 시안 × 주소 질의로 여는 상태(확인 단계·슬라이드·세상) × 라이트·다크
if (!only) {
  const targets = new Map(); // "file?query" → [file, query]
  for (const [file, name, plan] of SHOTS) {
    if (/^faces|^components|^symbols/.test(name)) continue;
    for (const variants of Object.values(plan)) for (const opt of variants) targets.set(`${file}?${opt.query ?? ''}`, [file, opt.query ?? '']);
  }
  for (const [file, q] of targets.values()) {
    for (const dark of [false, true]) {
      const query = [dark ? 'theme=dark' : '', q].filter(Boolean).join('&');
      const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
      const page = await ctx.newPage();
      await page.goto(MOCK + file + (query ? `?${query}` : ''));
      await page.waitForLoadState('load');
      await page.waitForTimeout(60);
      for (const p of await page.evaluate(overflowReport)) problems.push(`${file}${q ? `?${q}` : ''} 320px${dark ? ' dark' : ''}: ${p}`);
      await ctx.close();
    }
  }
}
await browser.close();
const uniq = [...new Set(problems)];
console.log(uniq.length === 0 ? '넘침 없음: 문서 가로 넘침 0 · 요소 단위 넘침 0 (360·1280·320, 라이트·다크·강제 색상·움직임 줄이기)' : `넘침 ${uniq.length}건:\n` + uniq.join('\n'));
if (uniq.length > 0) process.exit(1);
