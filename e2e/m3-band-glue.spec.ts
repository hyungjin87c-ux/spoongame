import { expect, test, type Page } from '@playwright/test';
import { setRootFontPercent } from './textResize';
import { ROULETTE_RESULT_IDS, openWordBreakState } from './wordBreakStates';

/**
 * 룰렛 결과 문장의 구간 표기가 반으로 갈라지지 않는다 (QA-003-M3 기록 M3-O13, M3 r5). 결과 문장은 「{수저}({구간}) · {시·도}」이고 구간은 「(상위 3% 안쪽)」「(하위 25%와 상위 45% 사이)」 같은 괄호 글자다.
 * 예전에는 글자 200%·폭 360에서 「다이아몬드수저(상위 / 3% 안쪽) 전남광주」처럼 구간 한가운데에서 줄이 바뀌었다. 지금은 괄호 구간이 한 묶음(`Glue` 규칙, src/core/glue.ts)이라
 * **한 줄에 들어가는 구간은 한 줄에 놓인다** — 줄이 바뀐다면 수저 이름과 구간 사이에서 바뀐다.
 * 구간이 한 줄보다 길면(글자 200%의 폭 320에서 「(상위 3% 안쪽)」 자체가 246px보다 넓다) 묶음 안에서 줄이 바뀌는 것은 불가피해 위반으로 세지 않는다(자연 폭 > 한 줄 폭).
 * 대조: 묶음 규칙을 CSS로 끄면(`.keep-phrase { display: inline }`) 같은 조합에서 갈라지는 구간이 잡혀야 한다(측정이 눈먼 통과가 아님).
 * 모든 시험이 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface BandReport {
  /** 구간 묶음의 글자 */
  text: string;
  /** 글자 하나씩 잰 줄 수 */
  lines: number;
  /** 한 줄에 놓았을 때의 폭(px) */
  natural: number;
  /** 결과 문장(<p>)의 내용 폭(px) */
  line: number;
}

async function measureBands(page: Page): Promise<BandReport[]> {
  return page.evaluate(() => {
    const status = document.querySelector('[data-testid="roulette-status"]');
    if (status === null) throw new Error('결과 문장을 찾지 못했다');
    const cs = getComputedStyle(status);
    const line = status.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const groups = [...status.querySelectorAll('.keep-phrase')].filter((el) => (el.textContent ?? '').trim().startsWith('('));
    const range = document.createRange();
    return groups.map((group) => {
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node !== null; node = walker.nextNode() as Text | null) {
        for (let i = 0; i < node.data.length; i++) {
          if (/\s/.test(node.data[i])) continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (r !== undefined && r.width > 0) rects.push(r);
        }
      }
      let lines = rects.length === 0 ? 0 : 1;
      for (let i = 1; i < rects.length; i++) {
        const a = rects[i - 1];
        const b = rects[i];
        if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < 0.5 * Math.min(a.height, b.height)) lines++;
      }
      // 한 줄에 놓았을 때의 폭: 같은 글꼴로 줄을 바꾸지 않게 한 복제본을 잰다
      const probe = group.cloneNode(true) as HTMLElement;
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;max-width:none;display:inline-block;left:0;top:0';
      status.appendChild(probe);
      const natural = probe.getBoundingClientRect().width;
      probe.remove();
      return { text: (group.textContent ?? '').trim(), lines, natural, line };
    });
  });
}

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 375, height: 812 },
] as const;
const PERCENTS = [100, 150, 200] as const;

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
});

for (const vp of VIEWPORTS) {
  test(`${vp.width}x${vp.height} · 글자 100·150·200% · 룰렛 결과 5수저: 한 줄에 들어가는 구간 표기는 한 줄에 놓인다 — 「(상위 / 3% 안쪽)」으로 갈라지지 않는다 (M3-O13)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    const problems: string[] = [];
    let checked = 0;
    let fitting = 0;
    for (const id of ROULETTE_RESULT_IDS) {
      await openWordBreakState(page, id);
      for (const percent of PERCENTS) {
        await setRootFontPercent(page, percent);
        const bands = await measureBands(page);
        expect(bands.length, `${id}/${percent}%: 결과 문장에 구간 묶음이 하나 있다(공허 통과 방지)`).toBe(1);
        for (const b of bands) {
          checked++;
          if (b.natural <= b.line + 0.5) fitting++;
          if (b.lines > 1 && b.natural <= b.line + 0.5) problems.push(`${vp.width}px/${id}/${percent}%: 한 줄에 들어가는 구간 「${b.text}」(${b.natural.toFixed(0)}px ≤ ${b.line.toFixed(0)}px)가 ${b.lines}줄로 갈라졌다`);
        }
      }
    }
    expect(checked, '잰 구간 수').toBe(ROULETTE_RESULT_IDS.length * PERCENTS.length);
    expect(fitting, '한 줄에 들어가는 구간이 실제로 있었다(공허 통과 방지)').toBeGreaterThanOrEqual(5);
    expect(problems).toEqual([]);
  });
}

test('360x740 · 글자 200% · 다이아몬드수저 결과: 구간 「(상위 3% 안쪽)」이 한 줄이고 수저 이름 뒤에서 줄이 바뀌어도 구간 안은 갈라지지 않는다 (스크린샷)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openWordBreakState(page, 'roulette-result-5');
  await setRootFontPercent(page, 200);
  const [band] = await measureBands(page);
  expect(band.text).toMatch(/^\(상위 \d+% 안쪽\)$/);
  expect(band.lines).toBe(1);
  expect(band.natural).toBeLessThanOrEqual(band.line + 0.5);
  await page.getByTestId('roulette-status').scrollIntoViewIfNeeded();
  await page.getByTestId('roulette-status').screenshot({ path: 'qa/screenshots/003/dev-M3-r5-band-glue-360x740-200.png' });
});

test('대조: 묶음 규칙을 끄면(`.keep-phrase { display: inline }`) 같은 조합에서 한 줄에 들어갈 구간이 반으로 갈라진다 — 이 측정이 예전 모습을 잡는다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const split: string[] = [];
  for (const id of ROULETTE_RESULT_IDS) {
    await openWordBreakState(page, id);
    await page.addStyleTag({ content: '.keep-phrase { display: inline !important; }' });
    for (const percent of [150, 200] as const) {
      await setRootFontPercent(page, percent);
      for (const b of await measureBands(page)) if (b.lines > 1 && b.natural <= b.line + 0.5) split.push(`${id}/${percent}% 「${b.text}」`);
    }
  }
  expect(split.length, `묶음을 끄면 갈라지는 구간: ${split.join(', ')}`).toBeGreaterThanOrEqual(1);
});
