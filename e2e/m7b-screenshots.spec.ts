import { expect, test, type Page } from '@playwright/test';
import { openCardIn, startHidden } from './m7bCards';
import { findCardState } from './m7bStates';
import { setRootFontPercent } from './textResize';

/**
 * M7b 증거 스크린샷 (SPEC-003 M7b 1단계, qa/screenshots/003/dev-M7b-*.png): 모달 시트(통계 인용·연구 인용·인용 없음) · 접힌 띠 · 비모달 인라인 카드 · 다크 · 강제 색상 · 글자 200% × 폭 320 · 데스크톱.
 * 파일 이름: dev-M7b-<무엇>-<상태>[-뷰포트].png. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SHOTS = 'qa/screenshots/003';

test.use({ deviceScaleFactor: 2 });

async function ready(page: Page): Promise<void> {
  await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
}

async function open(page: Page, eventId: string, ui: 'sheet' | 'inline' | 'folded', era: 'present' | 'past' | 'future' = 'present'): Promise<void> {
  await startHidden(page);
  const state = await findCardState(page, eventId, era);
  await openCardIn(page, state, ui);
  await ready(page);
}

test('모바일 360×740: 모달 시트 — 통계 인용 / 연구 인용 / 인용 없음', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'school-tutoring', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-stat-cite-360x740.png` });
  await open(page, 'infant-new-sibling', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-research-cite-360x740.png` });
  await open(page, 'infant-fever', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-no-cite-360x740.png` });
});

test('모바일 360×740: 접힌 띠 · 비모달 인라인 카드', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'school-tutoring', 'folded');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-folded-360x740.png` });
  await open(page, 'school-tutoring', 'inline');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-inline-360x740.png` });
});

test('다크 모드 시트 · 강제 색상 시트', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, 'school-tutoring', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-dark-360x740.png` });
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  await open(page, 'school-tutoring', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-forced-colors-360x740.png` });
});

test('폭 320 · 글자 200%: 가장 긴 연구 인용(Teti 외, 영문 원제)의 시트와 접힌 띠', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, 'infant-new-sibling', 'sheet', 'past');
  await setRootFontPercent(page, 200);
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-research-past-320-text200.png` });
  await open(page, 'infant-new-sibling', 'folded', 'future');
  await setRootFontPercent(page, 200);
  await page.screenshot({ path: `${SHOTS}/dev-M7b-folded-320-text200.png`, fullPage: true });
});

test('지난 세상 · 다가올 세상 머리말: 「지금의 연구로는」 / 「지금 기준으로는」', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'infant-new-sibling', 'sheet', 'past');
  await expect(page.getByTestId('cite-text')).toContainText('지금의 연구로는');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-past-prefix-360x740.png` });
  await open(page, 'school-tutoring', 'sheet', 'future');
  await expect(page.getByTestId('cite-text')).toContainText('지금 기준으로는');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-future-prefix-360x740.png` });
});

test('데스크톱 1280×800: 가운데 모달 시트 · 인라인 카드(3열 가운데 열 맨 위)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'school-tutoring', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-1280x800.png` });
  await open(page, 'school-tutoring', 'inline');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-inline-1280x800.png` });
  await open(page, 'school-tutoring', 'folded');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-folded-1280x800.png` });
});
