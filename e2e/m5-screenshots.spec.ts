import { expect, test, type Page } from '@playwright/test';
import { adultStateOf, findEarlyDeath, findFarewellState, findImpactState, findPendingEvent } from './m5States';
import { injectSave, oracleAuto, oracleLife, startPageHidden } from './helpers';
import type { GameState } from '../src/core/types';

/**
 * M5 증거 스크린샷 (SPEC-003 M5 2b, qa/screenshots/003/dev-M5-*.png): 선택지 영향 줄(지금 세상·지난 세상·20세 미만 「집안 살림」·부채 ▲ 붉음), 자산 카드(세 시대), 엔딩 「최종 순자산」 줄(세 가지),
 * 인생 기록의 상속 한 줄. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 * 파일 이름: dev-M5-<무엇>-<세상|상태>[-뷰포트].png
 */

const SHOTS = 'qa/screenshots/003';

/** 입력 가드(0.4초, 0.55 흐림 — 과도 상태)가 풀린 뒤에 찍는다: 흐린 채로 찍히면 색·대비를 잘못 보여 준다 */
async function settleGuards(page: Page): Promise<void> {
  await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
}

/** 증거용: 고정 요소(머리·진행 줄)가 요소 스크린샷의 모서리를 가리지 않게 흐름 안에 둔다 */
async function flowFixed(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
}

test.use({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });

for (const era of ['present', 'past', 'future'] as const) {
  test(`영향 줄 · ${era}: 성인 결정 카드 (영향 줄 4~5항목 + 안내 한 줄)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(90_000);
    await startPageHidden(page);
    await page.goto('/');
    const state = await findImpactState(page, 'adult', era);
    await injectSave(page, state, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await settleGuards(page);
    await flowFixed(page);
    await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M5-impact-${era}-panel.png` });
  });
}

test('영향 줄 · 20세 미만: 첫 항목이 「집안 살림」', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await startPageHidden(page);
  await page.goto('/');
  const state = await findImpactState(page, 'young');
  await injectSave(page, state, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
    await settleGuards(page);
  await flowFixed(page);
  await expect(page.locator('[data-testid="choice-panel"] .impact__item[data-key="family"]').first()).toBeVisible();
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M5-impact-young-family-panel.png` });
});

// R-351: 고교 대학 지원(school-exam) 선택지에 독립 때 확정되는 학자금 대출이 「부채 ▲」로 보인다 — 재력 1단계는 보이고 5단계는 안 보인다(같은 선택, 수저 차이)
for (const tier of [1, 5] as const) {
  test(`영향 줄 · 고교 대학 지원 · 재력 ${tier}단계: ${tier === 1 ? '「부채 ▲▲」(학자금 대출 2,300만 원)가 보인다' : '부채 항목이 없다(학자금 대출 0)'}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(120_000);
    await startPageHidden(page);
    await page.goto('/');
    const state = await findPendingEvent(page, 'school-exam', { tier, era: 'present' });
    await injectSave(page, state, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await settleGuards(page);
    await flowFixed(page);
    const apply = page.getByTestId('choice-apply');
    const debt = apply.locator('.impact__item[data-key="debt"]');
    if (tier === 1) {
      await expect(debt).toHaveCount(1);
      await expect(debt).toHaveAttribute('data-direction', 'up');
      await expect(debt).toHaveAttribute('data-steps', '2');
      // 부채 ▲는 해로운 색, 집안 살림 항목이 먼저(없으면 부채가 첫 항목)
      await expect(debt.locator('.impact__step--bad')).toHaveCount(1);
    } else {
      await expect(debt).toHaveCount(0);
    }
    await expect(page.getByTestId('choice-work').locator('.impact__item[data-key="debt"]'), 'work에는 부채가 없다').toHaveCount(0);
    await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M5-impact-exam-tier${tier}.png` });
  });
}

// R-352: youth-gig-work의 세 선택지 — settle이 juggle을 모든 줄에서 이기지 않는다(juggle 관계 ▲, settle 행복 ▼)
test('영향 줄 · 쪼개진 일자리(youth-gig-work): 어느 선택지도 다른 선택지를 모든 줄에서 이기지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(180_000);
  await startPageHidden(page);
  await page.goto('/');
  const state = await findPendingEvent(page, 'youth-gig-work', { era: 'present', seedFrom: 1000, seedTo: 9000 });
  await injectSave(page, state, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await settleGuards(page);
  await flowFixed(page);
  const items = async (id: string): Promise<string[]> => page.getByTestId(`choice-${id}`).locator('.impact__item').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}.${e.getAttribute('data-direction')}.${e.getAttribute('data-steps')}`));
  const juggle = await items('juggle');
  const settle = await items('settle');
  expect(juggle.some((x) => x.startsWith('relationships.up')), 'juggle: 관계 ▲').toBe(true);
  expect(juggle.some((x) => x.startsWith('health.down')), 'juggle: 건강 ▼').toBe(true);
  expect(settle.some((x) => x.startsWith('assets.up')), 'settle: 자산 ▲(취업 파생 소득)').toBe(true);
  expect(settle.some((x) => x.startsWith('happiness.down')), 'settle: 행복 ▼(수입이 끊긴 몇 달)').toBe(true);
  // settle에는 관계 항목이 없고 juggle에는 있다 → settle이 juggle을 모든 줄에서 이기지 않는다
  expect(settle.some((x) => x.startsWith('relationships')), 'settle에는 관계 항목이 없다').toBe(false);
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M5-impact-gig-work.png` });
});

test('영향 줄 · 부채 ▲ 붉음 / 부채 ▼ 초록: 부채 항목이 있는 선택지 줄', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, await findImpactState(page, 'adult'), '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
    await settleGuards(page);
  await flowFixed(page);
  const debtUp = page.locator('[data-testid="choice-panel"] .choice:has(.impact__item[data-key="debt"][data-direction="up"])').first();
  await expect(debtUp, '부채 ▲가 있는 선택지').toBeVisible();
  const color = await debtUp.locator('.impact__item[data-key="debt"] .impact__step').evaluate((e) => getComputedStyle(e).color);
  const down = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-down'));
  expect(color).not.toBe('');
  expect(down.trim()).not.toBe('');
  await debtUp.screenshot({ path: `${SHOTS}/dev-M5-impact-debt-up-red.png` });
  // 마우스를 올린 면(hover)
  await debtUp.hover();
  await debtUp.screenshot({ path: `${SHOTS}/dev-M5-impact-debt-up-red-hover.png` });
});

test('영향 줄 · 글자 200% 320×568: 항목이 줄마다 접힌다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, await findImpactState(page, 'adult'), '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
    await settleGuards(page);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await flowFixed(page);
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M5-impact-320-text200-panel.png` });
});

for (const era of ['present', 'past', 'future'] as const) {
  test(`자산 카드 · ${era}: 순자산·연 소득·부채 (지금 세상은 태그 없음, 지난·다가올 세상은 「지금 가치로 환산」)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(90_000);
    await startPageHidden(page);
    await page.goto('/');
    const state = await adultStateOf(page, era);
    await injectSave(page, state, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('assets-net')).toBeVisible();
    await flowFixed(page);
    if (era === 'present') await expect(page.getByTestId('assets-basis')).toHaveCount(0);
    else await expect(page.getByTestId('assets-basis')).toHaveText('지금 가치로 환산');
    await page.getByTestId('assets-card').screenshot({ path: `${SHOTS}/dev-M5-assets-${era}.png` });
    // 상태 도움말(자산 단위 + 가구 기준 문장)을 펼친 모습
    await page.locator('[data-testid="stats"] summary').click();
    await page.getByTestId('stats').screenshot({ path: `${SHOTS}/dev-M5-status-help-${era}.png` });
  });
}

test('자산 카드 · 음수 순자산과 가장 긴 금액: 부호 「−」만 쓰고 「빚」·▼를 쓰지 않는다 (글자 200% 320×568)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startPageHidden(page);
  await page.goto('/');
  const base = await adultStateOf(page, 'present');
  const state: GameState = { ...base, assets: { ...base.assets!, net: -199_999, debt: 324_500, income: 12_000 } };
  await injectSave(page, state, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('assets-net')).toHaveText('−19억 9,999만 원');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await flowFixed(page);
  await page.getByTestId('assets-card').screenshot({ path: `${SHOTS}/dev-M5-assets-big-320-text200.png` });
});

for (const era of ['present', 'past', 'future'] as const) {
  test(`엔딩 최종 순자산 줄 · ${era}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(90_000);
    await startPageHidden(page);
    await page.goto('/');
    const ended = await oracleAuto(page, await oracleLife(page, 20261013, era));
    expect(ended.phase).toBe('ending');
    await injectSave(page, ended, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('final-net')).toBeVisible();
    await flowFixed(page);
    if (era === 'present') await expect(page.getByTestId('final-net-basis')).toHaveCount(0);
    else await expect(page.getByTestId('final-net-basis')).toHaveText('지금 가치로 환산');
    await page.getByTestId('ending-stats').screenshot({ path: `${SHOTS}/dev-M5-ending-final-net-${era}.png` });
  });
}

test('엔딩 최종 순자산 줄 · 스무 살 전에 끝난 인생: 금액도 자리도 없이 한 문장', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await startPageHidden(page);
  await page.goto('/');
  const ended = await findEarlyDeath(page);
  await injectSave(page, ended, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('final-net-none')).toHaveText('스무 살이 되기 전이라 자산을 세지 않았습니다.');
  await flowFixed(page);
  await page.getByTestId('ending-stats').screenshot({ path: `${SHOTS}/dev-M5-ending-final-net-early.png` });
});

test('엔딩 최종 순자산 줄 · 음수와 0 (글자 200% 320×568)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startPageHidden(page);
  await page.goto('/');
  const ended = await oracleAuto(page, await oracleLife(page, 20261013, 'present'));
  for (const net of [-1200, 0]) {
    await injectSave(page, { ...ended, assets: { ...ended.assets!, net, debt: Math.max(ended.assets!.debt, -net) } }, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('final-net-value')).toHaveText(net === 0 ? '0원' : '−1,200만 원');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await flowFixed(page);
    await page.getByTestId('ending-stats').screenshot({ path: `${SHOTS}/dev-M5-ending-final-net-${net === 0 ? 'zero' : 'negative'}-320-text200.png` });
    await page.reload();
  }
});

test('인생 기록 · 상속 한 줄: 부모님이 모두 떠나는 결정의 영향 줄에는 상속(자산 ▲)이 없고, 고르면 그 해 끝에 「부모님이 남기신 재산을 물려받았습니다.」가 선택 기록 바로 뒤에 남는다 (r3)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(180_000);
  await startPageHidden(page);
  await page.goto('/');
  const state = await findFarewellState(page, 4);
  await injectSave(page, state, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
    await settleGuards(page);
  // 결정 카드: 상속은 해 끝 규칙이라 영향 줄에 없다 — 어느 선택지에도 「자산 ▲」가 붙지 않는다(r3). 선택지의 명시 비용(자산 ▼)만 보인다
  await flowFixed(page);
  const late = page.getByTestId('choice-late');
  for (const id of ['stay', 'late', 'share']) {
    await expect(page.getByTestId(`choice-${id}`).locator('.impact__item[data-key="assets"][data-direction="up"]'), `${id}: 자산 ▲(상속)가 영향 줄에 있다`).toHaveCount(0);
  }
  await expect(page.getByTestId('choice-stay').locator('.impact__item[data-key="assets"][data-direction="down"]')).toHaveCount(1);
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M5-inheritance-choice.png` });
  const netBefore = state.assets!.net;
  await late.click();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  const rows = page.getByTestId('log-row');
  // 최신순(SPEC-005 LR1): 상속 줄은 그 해 끝에 선택 기록 뒤에 남으므로 화면에서는 선택 기록 바로 위(맨 위)에 있다 — 예전 시간순의 「맨 아래·그 앞」을 뒤집었다
  await expect(rows.first()).toContainText('부모님이 남기신 재산을 물려받았습니다.');
  await expect(rows.nth(1)).toContainText('선택:');
  await expect(page.getByTestId('assets-net')).not.toHaveText('');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('suzeo-game:save')!).data.assets.net as number);
  expect(saved).toBeGreaterThan(netBefore);
  await page.getByTestId('log').screenshot({ path: `${SHOTS}/dev-M5-inheritance-log-line.png` });
});
