import { expect, test, type Page } from '@playwright/test';
import { describeWordBreak, measureWordBreaks, type WordBreakRecord } from './lineBreaks';
import { setRootFontPercent } from './textResize';

/**
 * 선택지 라벨 낱말 끊김 — **풀의 모든 선택지 라벨**을 감사한다 (SPEC-003 QM3-1, QA-003-M7e L02 재발 방지, M7e-4):
 * L02는 「무리해서라도 뒷바라지한다」가 폭 320 · 글자 200%에서 낱말 중간에서 끊긴 결함이었다(번호 원 옆 라벨 칸 약 164px, 글자 200%에서 음절당 약 32px이라 6음절 이상 어절이 칸을 넘는다).
 * 그때까지의 e2e 레이아웃 감사(`e2e/layout.spec.ts`)는 패널의 가림·넘침만 쟀고 **낱말 끊김**은 가장 긴 표본 하나(`e2e/m7e-lengths.spec.ts`)만 봤다 — 라벨 25종 × 11뷰포트 × 3글자의 QA 감사(825조합)에서야 드러났다.
 * 이 감사는 하니스(`harness/layout.html` — 실제 `LifeScreen`·실제 CSS)에서 **선택지 이벤트 전부**(그 이벤트의 선택지 전부, `requires`와 무관한 최악)를 320×568·360×740 × 글자 200%로 돌며
 * 공통 낱말 끊김 감사기(`measureWordBreaks`)로 재서 **결함 끊김 0**·**한 줄보다 긴 라벨 낱말 0**을 단언한다(글자 100·150%는 칸이 넉넉해 200%가 가장 나쁜 조합이다 — 글자 150%도 함께 본다).
 * 라벨 규칙(어절 5음절 이하, `tests/m7eContent.test.ts` 「M7e-4 L02」)을 어긴 새 라벨은 여기서도 걸린다. 개발 서버 전용 하니스라 mobile-360 프로젝트에서만 돈다.
 */

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const PERCENTS = [150, 200] as const;

async function openHarness(page: Page, vp: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(vp);
  await page.goto('/harness/layout.html');
  await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
}

const frames = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

for (const vp of VIEWPORTS) {
  for (const percent of PERCENTS) {
    test(`${vp.width}x${vp.height} · 글자 ${percent}%: 풀의 모든 선택지 이벤트 — 선택지 라벨의 낱말이 중간에서 끊기지 않고 한 줄보다 긴 라벨 낱말이 없다 (L02 재발 방지, QM3-1)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(300_000);
      await openHarness(page, vp);
      await setRootFontPercent(page, percent);
      const ids = await page.evaluate(() => (window as unknown as { __layout: { ids: string[] } }).__layout.ids);
      expect(ids.length, '풀의 선택지 이벤트(공허 통과 방지)').toBeGreaterThanOrEqual(80);
      const broken: string[] = [];
      const longLabelWords: string[] = [];
      let labelWords = 0;
      let events = 0;
      for (const id of ids) {
        await page.evaluate((x) => (window as unknown as { __layout: { show: (id: string) => void } }).__layout.show(x), id);
        await frames(page);
        const report = await measureWordBreaks(page, { scope: '[data-testid="choice-panel"]', categories: { label: '.choice__label' } });
        events++;
        labelWords += report.categories.label ?? 0;
        expect(report.categories.label ?? 0, `${id}: 라벨 낱말을 쟀다(선택자 확인)`).toBeGreaterThan(0);
        const isLabel = (r: WordBreakRecord): boolean => r.where.includes('choice__label');
        for (const r of report.broken) broken.push(`${id}: ${describeWordBreak(r)}`);
        for (const r of report.unavoidable.filter(isLabel)) longLabelWords.push(`${id}: ${describeWordBreak(r)}`);
      }
      expect(events).toBe(ids.length);
      expect(labelWords, '잰 라벨 낱말 수').toBeGreaterThan(ids.length * 4);
      expect(broken, `${vp.width}x${vp.height}/${percent}%: 낱말 중간에서 끊긴 곳(결함)`).toEqual([]);
      expect(longLabelWords, `${vp.width}x${vp.height}/${percent}%: 한 줄보다 긴 라벨 낱말`).toEqual([]);
    });
  }
}

// 측정기 대조: 6음절 어절(옛 라벨 「무리해서라도」)을 실제 라벨 자리에 넣으면 320px · 글자 200%에서 끊김으로 잡힌다 — 감사가 이 결함을 못 잡으면 위 단언은 공허하다.
test('측정기 대조: 6음절 어절이 든 라벨(옛 「무리해서라도 뒷바라지한다」)을 넣으면 320×568 · 글자 200%에서 끊김으로 잡힌다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  await openHarness(page, VIEWPORTS[0]);
  await setRootFontPercent(page, 200);
  await page.evaluate(() => (window as unknown as { __layout: { show: (id: string) => void } }).__layout.show('middle-child-school'));
  await frames(page);
  // 현재 라벨은 통과한다
  const before = await measureWordBreaks(page, { scope: '[data-testid="choice-panel"]', categories: { label: '.choice__label' } });
  expect(before.broken.map(describeWordBreak)).toEqual([]);
  // 옛 라벨로 바꿔 끊김이 생기는지 본다 (화면 글자만 바꾼다 — 데이터는 그대로)
  const changed = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement>('.choice__label')].find((x) => (x.textContent ?? '').includes('뒷받침'));
    if (el === undefined) return false;
    el.textContent = '무리해서라도 뒷바라지한다';
    return true;
  });
  expect(changed, '고친 라벨을 찾았다(선택자·라벨이 바뀌면 이 대조가 썩는다)').toBe(true);
  await frames(page);
  const after = await measureWordBreaks(page, { scope: '[data-testid="choice-panel"]', categories: { label: '.choice__label' } });
  const hit = [...after.broken, ...after.unavoidable].filter((r) => r.word.includes('무리해서라도') || r.word.includes('뒷바라지한다'));
  expect(hit.length, `옛 라벨이 끊김으로 잡혀야 한다: ${[...after.broken, ...after.unavoidable].map(describeWordBreak).join(' / ')}`).toBeGreaterThan(0);
});
