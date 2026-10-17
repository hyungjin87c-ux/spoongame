// QA-003 M3 2회차 — 새 컨테이너 질의(서류 격자 1열 쌓기·비교 카드 쌓기·제목 상한)가 넓은 화면·글자 100%의 모습을 깨지 않는지.
// 기준(1회차 빌드의 규칙, 미디어 질의): 뷰포트 < 640px → 서류 2열·비교 표 쌓기, ≥ 640px → 서류 3열·비교 표 그대로. 글자 100%에서 이 기준과 다르면 회귀, 글자 125%+의 차이는 의도된 변경(기록).
// 사용: node qa/scripts/m3r2-layout.mjs   결과: qa/results/m3r2/layout.json + 케이스 M3-C11b
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, sleep, runCase, shot, OUT, STD_VIEWPORTS, TOUCH, setRootFont } from './m3r2-lib.mjs';

const browser = await launch();
const MEASURE = () => {
  const q = (s) => document.querySelector(s);
  const cols = (el) => (el ? getComputedStyle(el).gridTemplateColumns.split(' ').filter((t) => t && t !== 'none').length : null);
  const dl = q('[data-testid="birth-grid"]');
  const body = q('.doc__body');
  const cmpTable = q('[data-testid="compare-table"]');
  const cmpCard = q('[data-testid="compare-card"]');
  const place = q('[data-testid="birth-field-place"]');
  const reels = q('.reels');
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
  const cs = cmpTable ? getComputedStyle(cmpTable) : null;
  const thead = cmpTable ? cmpTable.querySelector('thead') : null;
  const theadVisible = thead ? thead.getBoundingClientRect().width > 2 && thead.getBoundingClientRect().height > 2 : null;
  const row = cmpTable ? cmpTable.querySelector('tbody tr') : null;
  return {
    vw: document.documentElement.clientWidth,
    rem,
    gridCols: cols(dl),
    docBodyW: w(body),
    docBodyRem: body ? Math.round((w(body) / rem) * 10) / 10 : null,
    placeSpan: place ? getComputedStyle(place).gridColumnStart + '/' + getComputedStyle(place).gridColumnEnd : null,
    cmpTableDisplay: cs ? cs.display : null,
    cmpCardW: w(cmpCard),
    cmpCardRem: cmpCard ? Math.round((w(cmpCard) / rem) * 10) / 10 : null,
    cmpTheadVisible: theadVisible,
    cmpRowDisplay: row ? getComputedStyle(row).display : null,
    reelsCols: reels ? new Set([...reels.querySelectorAll('.reel-col')].map((c) => Math.round(c.getBoundingClientRect().left))).size : null,
    docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  };
};

const rows = [];
const FONTS = [100, 125, 150, 200];
for (const vp of STD_VIEWPORTS) {
  for (const [era, seed, tag] of [['present', 229, 'honam'], ['present', 5, 'labor']]) {
    const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });
    await fixSeed(ctx, seed);
    const p = await ctx.newPage();
    await openTitle(p);
    await toRoulette(p, era);
    await waitGuard(p, 'skip-roulette');
    await p.getByTestId('skip-roulette').click();
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
    await sleep(450);
    const roulette = {};
    for (const font of FONTS) {
      await setRootFont(p, font);
      await sleep(180);
      roulette[font] = (await p.evaluate(MEASURE)).reelsCols;
    }
    await setRootFont(p, 100);
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
    await sleep(450);
    for (const font of FONTS) {
      await setRootFont(p, font);
      await sleep(200);
      const m = await p.evaluate(MEASURE);
      rows.push({ vp: vp.name, w: vp.width, tag, font, ...m, reelsColsRoulette: roulette[font] });
      if (tag === 'honam' && font === 100 && ['1280x800', '768x1024', '640x400-zoom200', '360x740-touch', '1024x768'].includes(vp.name)) {
        await p.evaluate(() => window.scrollTo(0, 0));
        await shot(p, 'C11b', `birth-top-${vp.name}-100`);
        await p.evaluate(() => document.querySelector('[data-testid="compare-card"]')?.scrollIntoView({ block: 'start' }));
        await sleep(150);
        await shot(p, 'C11b', `birth-compare-${vp.name}-100`);
      }
    }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(rows, null, 1));

await runCase(
  {
    id: 'M3-C11b',
    cat: '접근성',
    title: '새 컨테이너 질의(서류 격자 1열 쌓기·비교 카드 쌓기)가 넓은 화면·글자 100%의 모습을 깨지 않는다 (출생신고 서류 격자 열 수·비교 표 표/쌓기·룰렛 릴 열 수)',
    steps: '11뷰포트 × 글자 100·125·150·200% × 표본 2(전남광주통합특별시·단순노무직/서비스직)에서 서류 격자 열 수·「태어난 곳」 칸 차지·비교 표 모양(표/쌓기)·룰렛 릴 열 수·가로 넘침을 읽어 1회차 규칙(뷰포트 640px 기준)과 견준다',
    expected: '글자 100%: 폭 ≥ 640이면 서류 3열·비교 표(머리글 보임), 폭 < 640이면 서류 2열·비교 쌓기, 릴 2열, 넘침 0. 글자 125%+의 차이는 기록(의도)',
  },
  async () => {
    const bad = [];
    const notes = [];
    const base = rows.filter((r) => r.font === 100);
    for (const r of base) {
      const wide = r.w >= 640;
      if (r.docOverflow > 0) bad.push(`${r.vp}/${r.tag}/100%: 가로 넘침 ${r.docOverflow}px`);
      if (wide && r.gridCols !== 3) bad.push(`${r.vp}/${r.tag}/100%: 넓은 화면인데 서류 격자 ${r.gridCols}열(기대 3열, 본문 폭 ${r.docBodyW}px = ${r.docBodyRem}rem)`);
      if (!wide && r.gridCols !== 2) bad.push(`${r.vp}/${r.tag}/100%: 좁은 화면인데 서류 격자 ${r.gridCols}열(기대 2열)`);
      if (wide && !(r.cmpTableDisplay === 'table' && r.cmpTheadVisible)) bad.push(`${r.vp}/${r.tag}/100%: 넓은 화면인데 비교 표가 쌓임(display ${r.cmpTableDisplay}, 카드 ${r.cmpCardW}px = ${r.cmpCardRem}rem, 머리글 ${r.cmpTheadVisible})`);
      if (!wide && r.cmpTableDisplay === 'table') bad.push(`${r.vp}/${r.tag}/100%: 좁은 화면인데 비교 표가 표 모양(카드 ${r.cmpCardW}px)`);
      if (r.reelsColsRoulette !== 2) bad.push(`${r.vp}/${r.tag}/100%: 룰렛 릴 ${r.reelsColsRoulette}열(기대 2열)`);
    }
    const diffs = rows.filter((r) => r.font > 100 && r.tag === 'honam').map((r) => `${r.vp}/${r.font}%: 서류 ${r.gridCols}열·비교 ${r.cmpTableDisplay === 'table' ? '표' : '쌓기'}·릴 ${r.reelsColsRoulette}열`);
    const changedWide = rows.filter((r) => r.font > 100 && r.tag === 'honam' && r.w >= 1024 && (r.gridCols !== 3 || r.cmpTableDisplay !== 'table'));
    notes.push(`글자 125%+ 넓은 화면(≥1024) 중 3열·표가 아닌 조합: ${changedWide.map((r) => `${r.vp}/${r.font}%(${r.gridCols}열·${r.cmpTableDisplay})`).join(', ') || '없음'}`);
    return {
      verdict: bad.length ? 'FAIL' : 'PASS',
      severity: '중간',
      actual: bad.length ? bad.slice(0, 6).join(' / ') : `글자 100% ${base.length}조합 모두 1회차 규칙과 같다(≥640px: 서류 3열·표, <640px: 2열·쌓기, 릴 2열, 넘침 0). ${notes.join(' ')}`,
      shots: ['qa/screenshots/003/M3r2-C11b-birth-top-1280x800-100.png', 'qa/screenshots/003/M3r2-C11b-birth-compare-1280x800-100.png', 'qa/screenshots/003/M3r2-C11b-birth-top-768x1024-100.png', 'qa/screenshots/003/M3r2-C11b-birth-compare-768x1024-100.png'],
    };
  },
);
await browser.close();
