import { expect, test, type Page } from '@playwright/test';
import { openM3Screen } from './m3States';
import { setRootFontPercent } from './textResize';
import { openWordBreakState } from './wordBreakStates';

/**
 * M3 r4 증거 스크린샷 (SPEC-003 QM3-1~QM3-5, QA-003-M3 M3-L02·M3-O02·R-291, qa/screenshots/003/dev-M3-r4-*.png).
 * QA가 FLAG로 남긴 상황(`qa/screenshots/003/M3-C-*-FLAG.png`)을 **고친 뒤의 모습**으로 다시 찍고, 강제 색상의 출생신고 띠(R-291)와 장식 도장을 남긴다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SHOTS = 'qa/screenshots/003';

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/dev-M3-r4-${name}.png` });
}

test.describe('QA FLAG 상황의 고친 뒤 모습', () => {
  test('360x740 터치 · 글자 200% · 룰렛 결과: 제목 「태어날 곳이 정해졌습니다」가 「정해졌습니 / 다」로 갈라지지 않고 낱말 사이에서만 접힌다 (M3-L02 제목)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 360, height: 740 });
    await openWordBreakState(page, 'roulette-result-3');
    await setRootFontPercent(page, 200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'result-360x740-200-title');
    await page.setViewportSize({ width: 320, height: 568 });
    await setRootFontPercent(page, 200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'result-320x568-200-title');
  });

  test('320x568 · 글자 100% · 룰렛 결과(다이아몬드수저): 릴 칸의 「다이아몬드 / 수저」는 의도한 <wbr> 나눔이다 (M3-L02 칩)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 568 });
    await openWordBreakState(page, 'roulette-result-5');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, '320x568-100-result-dia-reel');
  });

  test('320x568 · 글자 200% · 출생신고(어머니 단순노무직·아버지 농림어업직): 서류 격자가 한 줄 전체로 쌓여 직업 이름이 끊기지 않는다 (M3-L02 반쪽 칸)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 568 });
    await openWordBreakState(page, 'birth-labor-jeju');
    await setRootFontPercent(page, 200);
    const grid = page.getByTestId('birth-grid');
    await expect(grid).toBeVisible();
    await grid.scrollIntoViewIfNeeded();
    await page.addStyleTag({ content: '[data-testid="bottom-bar"] { visibility: hidden !important; }' });
    await grid.screenshot({ path: `${SHOTS}/dev-M3-r4-birth-grid-320x568-200-jobs.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'birth-labor-jeju-320x568-200-top');
  });

  // (667×375 가로 · 글자 200% 출생신고 비교 카드 스크린샷은 SPEC-004 BR5(N20)에서 비교 카드가 세대 판에 숨겨져 없앴다)

  test('360x740 · 출생신고 또래 카드: 안내는 첫 문장 하나뿐이다 — 없는 대시보드 칸을 가리키지 않는다 (M3-O05)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 360, height: 740 });
    await openWordBreakState(page, 'birth');
    const card = page.getByTestId('peers-card');
    await card.scrollIntoViewIfNeeded();
    await page.addStyleTag({ content: '[data-testid="bottom-bar"] { visibility: hidden !important; }' });
    await card.screenshot({ path: `${SHOTS}/dev-M3-r4-birth-peers-card-360x740.png` });
  });
});

test.describe('강제 색상 출생신고 띠·장식 도장 (R-291, M3-O02)', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`360x740 · 강제 색상(${colorScheme}): 출생신고 띠의 제목 「출생 신고」와 표기가 Canvas/CanvasText 짝으로 보인다`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.setViewportSize({ width: 360, height: 740 });
      await page.emulateMedia({ colorScheme, forcedColors: 'active' });
      await openM3Screen(page, 'birth');
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `birth-top-forced-colors-${colorScheme}-360x740`);
      const band = await page.locator('.doc__band').evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, color: cs.color, border: cs.borderBottomWidth, borderStyle: cs.borderBottomStyle };
      });
      expect(band.border, '띠 아래 굵은 선').toBe('3px');
      expect(band.borderStyle).toBe('solid');
      expect(band.bg, '띠 바탕과 글자색이 다르다').not.toBe(band.color);
    });
  }

  test('360x740 · 라이트: 장식 도장 「접수」가 불투명도 없이 놋쇠색 그대로다 (글자 4.5:1·테두리 3:1)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 360, height: 740 });
    await openM3Screen(page, 'birth');
    const opacity = await page.locator('.stamp').evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
    const stamp = page.locator('.stamp');
    const box = (await stamp.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/dev-M3-r4-birth-stamp-light-360x740.png`, clip: { x: Math.max(0, box.x - 120), y: Math.max(0, box.y - 20), width: 240, height: box.height + 120 } });
  });
});
