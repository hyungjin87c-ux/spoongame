import { expect, test, type Page } from '@playwright/test';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { freezeTime } from './m3States';
import { STANDARD_VIEWPORTS } from './viewports';
import { injectSave, titleState, KNOWN_SEED } from './helpers';
import { openWordBreakState, type WordBreakStateId } from './wordBreakStates';

/**
 * 제목(h1) 글자 크기 상한 (SPEC-003 QM3-2, QA-003-M3 M3-L02의 제목 부분). 새 화면 제목의 눈에 보이는 낱말은 **어떤 조합에서도 중간에서 끊기지 않는다** —
 * QM3-1의 허용(한 줄보다 긴 낱말·`<wbr>`)을 제목에는 쓰지 않는다(「정해졌습니 / 다」처럼 한 글자가 홀로 남는 것 금지). 폭 320 · 글자 200%에서도 가장 긴 낱말이 한 줄에 들어가도록
 * 글자 크기에 **줄 폭 기준의 상한**을 둔다(rem 고정값이 아니다 — 루트 글자 200%는 rem이 두 배라 rem 상한만으로는 부족하다). 상한 때문에 제목이 본문보다 작아지지 않는다.
 * 대상: 룰렛(회전 중·결과)·출생신고의 h1. 첫 화면의 h1은 로고 그림 + 눈에 안 보이는 글자(sr-only)라 눈에 보이는 낱말이 없다(맨 아래 시험이 확인).
 * 조합 = `STANDARD_VIEWPORTS` 11종 × 글자 100·125·150·175·200%: h1의 낱말마다 (1) 한 줄에 놓인다(글자 하나씩 `Range`로 잰 줄 수 1) (2) 자연 폭 ≤ h1 내용 폭 (3) 제목의 계산 글자 크기 ≥ 같은 화면 본문 문단의 계산 글자 크기.
 * 끝의 시험은 상한을 빼면(제목을 상한 없는 크기로 되돌리면) 폭 320·360(·320×256) × 글자 200%에서 「정해졌습니 / 다」로 갈라지는 것을 확인한다(이전 구현 대조).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const PERCENTS = [100, 125, 150, 175, 200] as const;

interface HeadingWord {
  word: string;
  /** 글자 하나씩 잰 줄 수 */
  lines: number;
  /** 글자 상자 폭의 합 */
  natural: number;
}

interface HeadingReport {
  words: HeadingWord[];
  /** h1 내용 폭 */
  contentWidth: number;
  /** h1·본문 문단의 계산 글자 크기(px) */
  fontPx: number;
  bodyPx: number;
}

/** 제목의 눈에 보이는 낱말을 잰다. 글자 크기를 바꾼 직후 같은 호출 안에서 읽어도 레이아웃이 최신이다(시간이 멈춘 상태에서도 쓸 수 있다) */
async function measureHeading(page: Page, headingSelector: string, bodySelector: string): Promise<HeadingReport> {
  return page.evaluate(
    ([h, b]) => {
      const heading = document.querySelector(h);
      const body = document.querySelector(b);
      if (heading === null || body === null) throw new Error(`제목 또는 본문 문단을 찾지 못했다: ${h} / ${b}`);
      const cs = getComputedStyle(heading);
      const contentWidth = heading.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const words: Array<{ word: string; lines: number; natural: number }> = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node !== null; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (parent === null || parent.closest('.sr-only') !== null) continue;
        for (const m of node.data.matchAll(/\S+/g)) {
          const start = m.index ?? 0;
          const rects: DOMRect[] = [];
          for (let i = 0; i < m[0].length; i++) {
            range.setStart(node, start + i);
            range.setEnd(node, start + i + 1);
            const r = range.getClientRects()[0];
            if (r !== undefined && r.width > 0) rects.push(r);
          }
          let lines = rects.length === 0 ? 0 : 1;
          for (let i = 1; i < rects.length; i++) {
            const a = rects[i - 1];
            const c = rects[i];
            if (Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) < 0.5 * Math.min(a.height, c.height)) lines++;
          }
          words.push({ word: m[0], lines, natural: rects.reduce((sum, r) => sum + r.width, 0) });
        }
      }
      return { words, contentWidth, fontPx: parseFloat(cs.fontSize), bodyPx: parseFloat(getComputedStyle(body).fontSize) };
    },
    [headingSelector, bodySelector] as const,
  );
}

/** 루트 글자 크기를 바꾼다 — 한 프레임을 기다리지 않는다(시간이 멈춘 회전 중 화면에서도 쓰려고). 읽는 쪽이 같은 evaluate 안에서 레이아웃을 읽는다 */
async function setRootPercentSync(page: Page, percent: number): Promise<void> {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
}

/** 화면마다 제목·본문 문단 선택자와 제목의 가장 긴 낱말(공허 통과 방지) */
const HEADINGS: ReadonlyArray<{ id: WordBreakStateId; heading: string; body: string; longest: string; wordCount: number }> = [
  { id: 'roulette-result-3', heading: '[data-testid="roulette-heading"]', body: '[data-testid="roulette-status"]', longest: '정해졌습니다', wordCount: 3 },
  { id: 'birth', heading: '[data-testid="birth-heading"]', body: '[data-testid="birth-sentence"]', longest: '신고', wordCount: 2 },
];
const SPIN = { id: 'roulette-spin' as const, heading: '[data-testid="roulette-heading"]', body: '[data-testid="roulette-status"]', longest: '고르는', wordCount: 5 };

/** 한 상태·글자 크기의 제목이 규칙을 지키는지: 위반 목록 */
async function headingProblems(page: Page, spec: (typeof HEADINGS)[number] | typeof SPIN, percent: number, label: string): Promise<string[]> {
  const r = await measureHeading(page, spec.heading, spec.body);
  const problems: string[] = [];
  if (r.words.length !== spec.wordCount) problems.push(`${label}: 제목 낱말 ${r.words.length}개 (기대 ${spec.wordCount}) — 공허 통과 방지`);
  if (!r.words.some((w) => w.word === spec.longest)) problems.push(`${label}: 제목에 「${spec.longest}」가 없다 (${r.words.map((w) => w.word).join(' ')})`);
  for (const w of r.words) {
    if (w.lines !== 1) problems.push(`${label}: 「${w.word}」가 ${w.lines}줄에 걸쳐 끊겼다 (자연 폭 ${w.natural.toFixed(0)}px, 제목 내용 폭 ${r.contentWidth.toFixed(0)}px, 글자 ${r.fontPx.toFixed(1)}px)`);
    if (w.natural > r.contentWidth + 0.5) problems.push(`${label}: 「${w.word}」 자연 폭 ${w.natural.toFixed(0)}px > 제목 내용 폭 ${r.contentWidth.toFixed(0)}px`);
  }
  if (r.fontPx + 0.01 < r.bodyPx) problems.push(`${label}: 제목 글자 ${r.fontPx.toFixed(1)}px < 본문 문단 ${r.bodyPx.toFixed(1)}px`);
  if (percent === 100 && r.fontPx < r.bodyPx) problems.push(`${label}: 글자 100%에서 제목이 본문보다 작다`);
  return problems;
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`제목 글자 크기 상한 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    test(`${vp.name} · 글자 100·125·150·175·200% · 룰렛 결과·출생신고: 제목의 낱말이 한 줄에 놓이고(줄 수 1) 자연 폭 ≤ 제목 내용 폭이며 제목 글자 ≥ 본문 문단 (QM3-2)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      const problems: string[] = [];
      for (const spec of HEADINGS) {
        await openWordBreakState(page, spec.id);
        for (const percent of PERCENTS) {
          await setRootPercentSync(page, percent);
          problems.push(...(await headingProblems(page, spec, percent, `${vp.name}/${percent}%/${spec.id}`)));
          // 제목은 QM3-1의 허용(한 줄보다 긴 낱말·<wbr>)을 쓰지 않는다 — 감사기에서도 끊김·불가피·의도 모두 0
          const wb = await measureWordBreaks(page, { scope: spec.heading });
          for (const rec of [...wb.broken, ...wb.unavoidable, ...wb.intended, ...wb.forced]) problems.push(`${vp.name}/${percent}%/${spec.id}: 제목 낱말 끊김 ${describeWordBreak(rec)}`);
        }
      }
      expect(problems).toEqual([]);
    });

    test(`${vp.name} · 글자 100·125·150·175·200% · 룰렛 회전 중: 제목의 낱말이 한 줄에 놓이고 제목 글자 ≥ 본문 문단 (QM3-2)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      await openWordBreakState(page, 'roulette-spin');
      await freezeTime(page); // 연출이 5.4초에 끝나므로 시간을 멈춰 붙들고 잰다
      const problems: string[] = [];
      for (const percent of PERCENTS) {
        await setRootPercentSync(page, percent);
        problems.push(...(await headingProblems(page, SPIN, percent, `${vp.name}/${percent}%/roulette-spin`)));
      }
      expect(await page.getByTestId('roulette-screen').getAttribute('data-state'), '측정 중에 연출이 끝나지 않았다').toBe('spinning');
      expect(problems).toEqual([]);
    });
  });
}

// ---------- 이전 구현 대조 (QM3-2 (b)(c)) ----------
// 상한을 빼면(제목을 상한 없는 크기 var(--fs-2xl)로 되돌리면) 폭 320·360(·320×256) × 글자 200%에서 「정해졌습니다」가 「정해졌습니 / 다」로 갈라진다 — 시험이 실제로 잡는다.
// 파일 변조(doc.css의 상한 규칙을 지우고 돌린 뒤 `cmp`로 되돌림) 결과는 ai-log dev-M3-r4에 있다.

for (const [name, width, height, touch] of [
  ['320x568', 320, 568, false],
  ['360x568', 360, 568, false],
  ['360x740 터치', 360, 740, true],
  ['320x256', 320, 256, false],
] as const) {
  test.describe(`이전 구현 대조 ${name}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch });
    test(`${name} · 글자 200%: 상한이 있으면 「정해졌습니다」가 한 줄이고, 상한을 빼면(이전 구현) 한 글자가 홀로 남도록 갈라진다`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await openWordBreakState(page, 'roulette-result-3');
      await setRootPercentSync(page, 200);
      const spec = HEADINGS[0];
      expect(await headingProblems(page, spec, 200, `${name}/200%`), '상한이 있으면 위반 없음').toEqual([]);
      // 이전 구현: 제목 글자 크기를 상한 없이 키운다. (Noto Sans KR로 글꼴이 바뀐 뒤에는 --fs-2xl(28px)에서 「정해졌습니다」가 360px에 한 줄로 들어가 버려 대조가 눌리므로, 상한 없는 큰 제목의 대표로 --fs-3xl(36px)을 쓴다)
      await page.addStyleTag({ content: '.roulette__lead .t-title { font-size: var(--fs-3xl) !important; }' });
      const before = await measureHeading(page, spec.heading, spec.body);
      const done = before.words.find((w) => w.word === '정해졌습니다');
      expect(done, '「정해졌습니다」를 쟀다').toBeDefined();
      expect(done!.lines, `상한을 빼면 한 줄에 못 들어간다 (자연 폭 ${done!.natural.toFixed(0)}px > 제목 내용 폭 ${before.contentWidth.toFixed(0)}px)`).toBeGreaterThan(1);
      expect((await headingProblems(page, spec, 200, `${name}/200%`)).length, '이전 구현은 위반이 난다').toBeGreaterThan(0);
    });
  });
}

// ---------- 첫 화면의 제목 ----------

test.describe('첫 화면 제목 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test('첫 화면의 h1은 로고 그림 + 눈에 안 보이는 글자(sr-only 「수저 게임」)뿐이라 눈에 보이는 낱말이 없다 — 글자 200%에서도 가로 넘침이 없고 감사 대상 낱말 0', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await injectSave(page, titleState(KNOWN_SEED));
    await expect(page.getByTestId('start-birth')).toBeVisible();
    await setRootPercentSync(page, 200);
    const h1 = page.getByTestId('title-heading');
    expect(await h1.locator('svg').count(), '제목은 로고 그림').toBeGreaterThan(0);
    const wb = await measureWordBreaks(page, { scope: '[data-testid="title-heading"]' });
    expect(wb.checked, '눈에 보이는 낱말 없음').toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
