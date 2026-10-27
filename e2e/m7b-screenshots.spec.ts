import { expect, test, type Page } from '@playwright/test';
import type { GenerationId } from '../src/core/types';
import { openCardIn, startHidden } from './m7bCards';
import { findCardState } from './m7bStates';
import { findDelegatedYear, showParentCard } from './parentStates';
import { setRootFontPercent } from './textResize';

/**
 * M7b 증거 스크린샷 (SPEC-003 M7b 1단계, qa/screenshots/003/dev-M7b-*.png): 모달 시트(통계 인용·연구 인용·인용 없음) · 접힌 띠 · 비모달 인라인 카드 · 다크 · 강제 색상 · 글자 200% × 폭 320 · 데스크톱.
 * 파일 이름: dev-M7b-<무엇>-<상태>[-뷰포트].png. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 *
 * SPEC-005 QI5: 사람이 고르는 카드는 `youth-startup`(통계 인용, 예전 school-tutoring) · `youth-workplace-romance`(인용 없음, 예전 infant-fever)로 옮겼다. 「연구」 인용(Teti 외)이 붙는 카드는
 * 이제 아이의 일로 흘러간 비모달 카드라 `dev-M7b-parentcard-research-*`로 카드를 찍는다(`open`의 `parentCard`).
 */

const SHOTS = 'qa/screenshots/003';

test.use({ deviceScaleFactor: 2 });

/** 「연구」 인용이 붙는 흘러간 카드(infant-new-sibling)를 띄워 일시정지로 붙잡는다 — 시트가 아니라 비모달 카드다 */
async function openResearchCard(page: Page, era: GenerationId = 'alpha'): Promise<void> {
  await page.goto('/');
  const y = await findDelegatedYear(page, { eventId: 'infant-new-sibling', by: 'child', era, firstBorn: true });
  await showParentCard(page, y);
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
}

async function open(page: Page, eventId: string, ui: 'sheet' | 'inline' | 'folded', era: GenerationId = 'alpha'): Promise<void> {
  await startHidden(page);
  const state = await findCardState(page, eventId, era);
  await openCardIn(page, state, ui);
  await ready(page);
}

test('모바일 360×740: 모달 시트 — 통계 인용 / 연구 인용 / 인용 없음', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'youth-startup', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-stat-cite-360x740.png` });
  await openResearchCard(page);
  await page.screenshot({ path: `${SHOTS}/dev-M7b-parentcard-research-cite-360x740.png` });
  await open(page, 'youth-workplace-romance', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-no-cite-360x740.png` });
});

test('모바일 360×740: 접힌 띠 · 비모달 인라인 카드', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'youth-startup', 'folded');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-folded-360x740.png` });
  await open(page, 'youth-startup', 'inline');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-inline-360x740.png` });
});

test('다크 모드 시트 · 강제 색상 시트', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, 'youth-startup', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-dark-360x740.png` });
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  await open(page, 'youth-startup', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-forced-colors-360x740.png` });
});

test('폭 320 · 글자 200%: 가장 긴 연구 인용(Teti 외, 영문 원제)의 흘러간 카드와 접힌 띠', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await openResearchCard(page, 'industrial');
  await setRootFontPercent(page, 200);
  await page.screenshot({ path: `${SHOTS}/dev-M7b-parentcard-research-past-320-text200.png`, fullPage: true });
  await open(page, 'youth-startup', 'folded', 'genz');
  await setRootFontPercent(page, 200);
  await page.screenshot({ path: `${SHOTS}/dev-M7b-folded-320-text200.png`, fullPage: true });
});

test('지난 세상 · 다가올 세상 머리말: 「지금의 연구로는」 / 「지금 기준으로는」', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await openResearchCard(page, 'industrial');
  await expect(page.getByTestId('cite-text')).toContainText('지금의 연구로는');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-parentcard-past-prefix-360x740.png` });
  await open(page, 'youth-startup', 'sheet', 'genz');
  await expect(page.getByTestId('cite-text')).toContainText('지금 기준으로는');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-future-prefix-360x740.png` });
});

test('데스크톱 1280×800: 가운데 모달 시트 · 인라인 카드(3열 가운데 열 맨 위)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'youth-startup', 'sheet');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-sheet-1280x800.png` });
  await open(page, 'youth-startup', 'inline');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-inline-1280x800.png` });
  await open(page, 'youth-startup', 'folded');
  await page.screenshot({ path: `${SHOTS}/dev-M7b-folded-1280x800.png` });
});
