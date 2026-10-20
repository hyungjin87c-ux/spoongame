import { expect, test, type Page } from '@playwright/test';
import { injectSave, noHorizontalOverflow, startPageHidden } from './helpers';
import { KINDS, SHOT, barOracle, endedBase, geometry, stateOf, withFinal, type BarOracle, type Kind } from './m7e3Ending';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { auditFocus, summarize } from './focusObscured';
import { findPendingEvent, openImpactScreen } from './m5States';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 엔딩 새 디자인 (SPEC-003 M7e-3, REV-003-M4-1 R-327, docs/design/copy.md 5-3·5-4, diff-003.md D-41~D-46): 머리 「{세상} · 생애 기록」, 출발선 막대(구간 띠·50% 눈금·마지막 마름모), 범례(수저 칩),
 * aria-label, 스무 살 전 갈래, 동률 불리(마스터 결정 C). 막대의 숫자는 구현 함수(startBandOf·standingScore)에서 오고, 이 파일은 실제 브라우저에서 **그려진 위치**가 그 숫자와 같은지 잰다.
 *  - 형태(막대 좌표·범례·aria-label·방향 읽힘): 네 상태 × 320×568·360×740 × 글자 100·150·200% (CM11), 낱말 끊김 0 (QM3-1)
 *  - 색: 라이트·다크·강제 색상 — 렌더 픽셀 대비 (글자 4.5:1, 그림 3:1)
 *  - 포커스 가림 없음 (CM10), 0원 판의 방향 (O04 되돌림 방지)
 *  - 증거 화면 (qa/screenshots/003/dev-M7e-3-*.png): 엔딩 네 상태, 선택지 안내 줄, 20세 미만 자산 카드, 지배 고침 표본, 단계 진입 줄
 */

/** 한 상태의 막대·범례·aria-label·방향 읽힘을 오라클과 견준다. label은 실패 메시지용 */
async function expectBar(page: Page, o: BarOracle, label: string): Promise<void> {
  const g = await geometry(page);
  const scoreAt = (x: number): number => ((x - g.track.left) / g.track.width) * 100;
  const tol = 1.5 / (g.track.width / 100); // 1.5px를 점수로
  // 읽기용 이름: role=img + 함수 조합 aria-label (손으로 적지 않는다, R-191(d))
  const bar = page.getByTestId('ending-bar');
  await expect(bar, label).toHaveAttribute('role', 'img');
  await expect(bar, label).toHaveAttribute('aria-label', o.ariaLabel);
  expect(o.ariaLabel.startsWith(`출발선 ${o.bandLabel}`), label).toBe(true);
  // 띠: 출발선 구간 [low, high]% 위치 그대로
  expect(scoreAt(g.band.left), `${label} 띠 왼쪽`).toBeGreaterThan(o.low - tol);
  expect(scoreAt(g.band.left), `${label} 띠 왼쪽`).toBeLessThan(o.low + tol);
  expect(scoreAt(g.band.right), `${label} 띠 오른쪽`).toBeGreaterThan(o.high - tol);
  expect(scoreAt(g.band.right), `${label} 띠 오른쪽`).toBeLessThan(o.high + tol);
  // 50% 눈금
  const midX = (g.mid.left + g.mid.right) / 2;
  expect(Math.abs(scoreAt(midX) - 50), `${label} 50% 눈금`).toBeLessThan(tol);
  // 막대는 카드 안·화면 안, 선은 막대 안
  expect(g.bar.left, label).toBeGreaterThanOrEqual(g.card.left - 0.5);
  expect(g.bar.right, label).toBeLessThanOrEqual(g.card.right + 0.5);
  expect(g.track.left, label).toBeGreaterThanOrEqual(g.bar.left - 0.5);
  expect(g.track.right, label).toBeLessThanOrEqual(g.bar.right + 0.5);
  expect(g.track.right, label).toBeLessThanOrEqual(g.vw + 0.5);
  // 그림 크기는 글자 크기와 무관한 px (선 상자 28px, 띠 20px)
  expect(g.track.height, `${label} 선 상자 높이`).toBe(28);
  expect(g.band.height, `${label} 띠 높이`).toBe(20);

  const legend = page.getByTestId('ending-legend');
  const rows = legend.locator(':scope > div');
  const chip = legend.locator('.grade');
  await expect(chip, label).toHaveCount(1);
  await expect(chip, label).toHaveAttribute('data-grade', String(o.wealth));
  await expect(page.getByTestId('grade-range'), label).toHaveText(`(${o.bandLabel})`);
  await expect(rows.first().locator('dt'), label).toHaveText('출발선');
  if (o.kind === 'early') {
    // 스무 살 전: 마름모·「마지막」 범례·방향 줄이 없다
    expect(g.end, `${label} 마름모 없음`).toBeNull();
    await expect(rows, label).toHaveCount(1);
    await expect(page.getByTestId('ending-bar-end'), label).toHaveCount(0);
    await expect(page.getByTestId('ending-movement'), label).toHaveCount(0);
    await expect(bar, label).toHaveAttribute('aria-label', `출발선 ${o.bandLabel}.`);
    await expect(page.getByTestId('ending-journey'), label).toHaveText(o.journeyText);
    return;
  }
  expect(g.end, `${label} 마름모`).not.toBeNull();
  const endX = (g.end!.left + g.end!.right) / 2;
  expect(Math.abs(scoreAt(endX) - o.score!), `${label} 마름모 위치(점수 ${o.score})`).toBeLessThan(tol);
  // 마름모는 막대 상자를 벗어나지 않는다 (양 끝 점수 0·100에서도 선 양옆 12px 여백 안)
  expect(g.end!.left, label).toBeGreaterThanOrEqual(g.bar.left - 0.5);
  expect(g.end!.right, label).toBeLessThanOrEqual(g.bar.right + 0.5);
  // 눈으로 읽히는 방향: 띠 오른쪽 밖 = 앞선 자리, 왼쪽 밖 = 뒤쪽, 띠 안·가장자리 = 비슷함 (movementOf의 여유 2점)
  if (o.movement === 'up') expect(o.score!, label).toBeGreaterThan(o.high);
  if (o.movement === 'down') expect(o.score!, label).toBeLessThan(o.low);
  if (o.movement === 'same') {
    expect(o.score!, label).toBeGreaterThanOrEqual(o.low - 2);
    expect(o.score!, label).toBeLessThanOrEqual(o.high + 2);
  }
  await expect(rows, label).toHaveCount(2);
  await expect(rows.nth(1).locator('dt'), label).toHaveText('마지막');
  await expect(page.getByTestId('ending-legend-end'), label).toHaveText(o.endLabel!);
  await expect(page.getByTestId('ending-movement'), label).toHaveText(o.movementText!);
  await expect(page.getByTestId('ending-journey'), label).toHaveText(o.journeyText);
  // 범례 표식은 막대와 같은 모양: 띠 = 네모(테두리), 마름모 = 45도 돌린 채움
  const keys = await page.evaluate(() => ({
    band: getComputedStyle(document.querySelector('.journey__key--band')!).transform,
    end: getComputedStyle(document.querySelector('.journey__key--end')!).transform,
  }));
  expect(keys.band, `${label} 띠 표식은 돌리지 않는다`).toBe('none');
  expect(keys.end, `${label} 마름모 표식은 돌린다`).not.toBe('none');
}

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const PERCENTS = [100, 150, 200] as const;

// ---------- 형태: 막대 좌표·범례·aria-label × 두 화면 × 세 글자 크기 (CM11) · 낱말 끊김 (QM3-1) ----------

for (const kind of KINDS) {
  test(`${kind}: 막대 좌표·범례·aria-label이 구현 함수의 값과 같고, 320×568·360×740 × 글자 100·150·200%에서 잘림·가로 넘침·낱말 끊김이 없다 (CM11·QM3-1)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(240_000);
    const state = await stateOf(page, kind);
    const oracle = await barOracle(page, state);
    expect(oracle.kind).toBe(kind === 'early' ? 'early' : 'compared');
    for (const size of SIZES) {
      for (const percent of PERCENTS) {
        const label = `${kind} ${size.width}x${size.height}/${percent}%`;
        await page.setViewportSize(size);
        await injectSave(page, state, '/');
        await expect(page.getByTestId('ending-screen')).toBeVisible();
        if (percent !== 100) await setRootFontPercent(page, percent);
        await expectBar(page, oracle, label);
        expect(textResizeViolations(await measureTextResize(page), label), label).toEqual([]);
        expect(await noHorizontalOverflow(page), `${label} 가로 넘침`).toBe(true);
        const words = await measureWordBreaks(page, { scope: '[data-testid="ending-journey-section"], .ending__head' });
        expect(words.checked, `${label} 잰 낱말 수`).toBeGreaterThan(8);
        expect(words.broken.map(describeWordBreak), `${label} 낱말 끊김`).toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `${label} 100%에서는 한 줄보다 긴 낱말도 0`).toEqual([]);
        // 머리: 「{세상} · 생애 기록」 + 「{출생 연월} ~ {사망 연도}년 · {나이}세」, 제목은 한 줄 이름 「…의 인생」
        await expect(page.getByTestId('ending-era'), label).toContainText('· 생애 기록');
        await expect(page.getByTestId('ending-span'), label).toHaveText(/^\d{4}년( \d{1,2}월)? ~ \d{4}년 · \d+세$/);
      }
    }
  });
}

test('넓은 화면(1280×800): 네 상태 모두 막대 좌표·범례·aria-label이 구현 함수의 값과 같다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop에서만 실행');
  test.setTimeout(120_000);
  const base = await endedBase(page);
  for (const kind of KINDS) {
    const state = await stateOf(page, kind, base);
    const oracle = await barOracle(page, state);
    await injectSave(page, state, '/');
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expectBar(page, oracle, `desktop ${kind}`);
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
});

// ---------- 동률 불리 (마스터 결정 C): 0원으로 마친 가난한 집의 인생이 「앞선 자리」로 읽히지 않는다 (QA-003-M5 O04 되돌림 방지) ----------

test('0원 판: 재력 1·2단계가 정확히 0원으로 마쳐도 「앞선 자리」가 아니고, 「가운데쯤」이 아니라 하위 자리로 읽힌다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const ended = await endedBase(page);
  for (const wealth of [1, 2] as const) {
    const state = withFinal(ended, wealth, 0);
    const o = await barOracle(page, state);
    await injectSave(page, state, '/');
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    expect(o.movement, `${wealth}단계 0원`).not.toBe('up');
    await expect(page.getByTestId('ending-movement')).not.toHaveText('출발선보다 앞선 자리입니다.');
    await expect(page.getByTestId('ending-legend-end')).toHaveText(/^하위 약 \d+%$/);
    await expect(page.getByTestId('ending-legend-end')).not.toContainText('가운데쯤');
    // 같은 줄이 최종 순자산 한 줄과 부딪치지 않는다: 금액 옆에는 자리 글자가 없다
    await expect(page.locator('.final-net')).not.toContainText('같은 세상 안에서');
    await expect(page.locator('.final-net__value')).toHaveText('0원');
  }
});

// ---------- 포커스 가림 없음 (CM10) ----------

for (const size of SIZES) {
  for (const percent of [100, 200] as const) {
    test(`포커스 가림 없음 ${size.width}x${size.height} · 글자 ${percent}% · 엔딩: Tab·Shift+Tab 순회와 제목·「다시 태어나기」 focus()에서 고정 요소에 가려진 포커스 0 (CM10)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize(size);
      const state = await stateOf(page, 'behind');
      await injectSave(page, state, '/');
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      await expect(page.getByTestId('rebirth')).toBeEnabled();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const audit = await auditFocus(page, `ending/${size.width}x${size.height}/${percent}%`, { headingTestId: 'ending-name' });
      expect(audit.violations, summarize(audit)).toEqual([]);
      expect(audit.tabbables, '다시 태어나기가 순회에 있다').toContain('rebirth');
      expect(audit.forward.length).toBe(audit.tabbables.length);
    });
  }
}

// ---------- 증거 화면 (qa/screenshots/003/dev-M7e-3-*.png) ----------

test('증거 화면 1: 엔딩 네 상태 — 앞섬 · 뒤쪽 · 0원 · 스무 살 전 (360×740, 출발선 카드와 머리)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const base = await endedBase(page);
  const names: Record<Kind, string> = { ahead: 'ending-ahead', behind: 'ending-behind', zero: 'ending-zero', early: 'ending-before20' };
  for (const kind of KINDS) {
    const state = await stateOf(page, kind, base);
    await injectSave(page, state, '/');
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('rebirth')).toBeEnabled();
    await page.addStyleTag({ content: '.site-head { position: static !important; }' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SHOT}-${names[kind]}-top.png`, fullPage: false });
    await page.getByTestId('ending-journey-section').scrollIntoViewIfNeeded();
    await page.getByTestId('ending-journey-section').screenshot({ path: `${SHOT}-${names[kind]}.png` });
  }
  // 어두운 화면과 320×568 · 글자 200%의 가장 좁은 조합 한 장씩
  await page.emulateMedia({ colorScheme: 'dark' });
  await injectSave(page, await stateOf(page, 'behind', base), '/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await page.getByTestId('ending-journey-section').scrollIntoViewIfNeeded();
  await page.getByTestId('ending-journey-section').screenshot({ path: `${SHOT}-ending-behind-dark.png` });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 320, height: 568 });
  await injectSave(page, await stateOf(page, 'behind', base), '/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await setRootFontPercent(page, 200);
  await page.getByTestId('ending-journey-section').scrollIntoViewIfNeeded();
  await page.getByTestId('ending-journey-section').screenshot({ path: `${SHOT}-ending-behind-320-200.png` });
});

test('증거 화면 2: 선택지 안내 줄 · 20세 미만 자산 카드 · 단계 진입 줄 (360×740)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  // 20세 미만: 자산 카드(둘째·셋째 문장)와 선택지 안내 줄
  await openImpactScreen(page, 'impact-young');
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  await expect(page.getByTestId('choice-hint')).toBeVisible();
  await expect(page.getByTestId('assets-note')).toContainText('자산은 스무 살부터 셉니다.');
  await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-choice-hint.png` });
  await page.getByTestId('assets-card').scrollIntoViewIfNeeded();
  await page.getByTestId('assets-card').screenshot({ path: `${SHOT}-assets-young.png` });
  // 20세 이상: 인생 기록의 단계 진입 줄 (「스무 살이 되었습니다. …」)
  await openImpactScreen(page, 'impact-adult');
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  const stage = page.locator('[data-testid="log-row"][data-kind="stage"]').filter({ hasText: '스무 살이 되었습니다' });
  await expect(stage).toHaveCount(1);
  await expect(stage).toContainText('이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.');
  await stage.scrollIntoViewIfNeeded();
  await page.getByTestId('log').screenshot({ path: `${SHOT}-stage-entry.png` });
});

for (const fixture of [
  { id: 'youth-first-job', tier: 5, name: 'fix-first-job' },
  { id: 'youth-housing', tier: 3, name: 'fix-housing' }, // SPEC-005 QI5: school-tutoring(fix-tutoring)은 부모님이 정하는 카드가 되어 선택지 카드로 뜨지 않는다 — 사람이 고르는 youth-housing으로 옮김
  { id: 'senior-travel', tier: 3, name: 'fix-travel' },
] as const) {
  test(`증거 화면 3: 지배 고침 표본 ${fixture.id} — 선택지 카드의 영향 줄이 서로 갈린다 (360×740)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await startPageHidden(page);
    await page.goto('/');
    const state = await findPendingEvent(page, fixture.id, { era: 'present', tier: fixture.tier, seedFrom: 1000, seedTo: 9000 });
    await injectSave(page, state, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('auto')).toBeEnabled(); // 입력 가드가 풀린 뒤(선택지가 흐리지 않은 화면)
    await expect(page.getByTestId('impact').first()).toBeVisible();
    await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
    await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
    await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-${fixture.name}.png` });
  });
}
