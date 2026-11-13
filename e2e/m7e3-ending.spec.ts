import { expect, test } from '@playwright/test';
import { injectSave, noHorizontalOverflow, startPageHidden } from './helpers';
import { KINDS, SHOT, endedBase, stateOf, withFinal } from './m7e3Ending';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { auditFocus, summarize } from './focusObscured';
import { findPendingEvent, openImpactScreen } from './m5States';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 엔딩 새 디자인 (SPEC-003 M7e-3, REV-003-M4-1 R-327, docs/design/copy.md 5-3·5-4, diff-003.md D-41~D-46): 머리 「{세상} · 생애 기록」, 스무 살 전 갈래, 0원 판.
 * 2026-11-13(결정 후속 256): 출발선 막대·범례·도착 자리·이동 판정과 그 좌표·색 시험, 증거 화면 1(출발선 카드 사진)은 삭제와 함께 걷었다.
 *  - 형태: 네 상태 × 320×568·360×740 × 글자 100·150·200% (CM11), 낱말 끊김 0 (QM3-1) — 출발선 카드가 없다는 것도 함께 본다
 *  - 포커스 가림 없음 (CM10)
 *  - 증거 화면 (qa/screenshots/003/dev-M7e-3-*.png): 선택지 안내 줄, 20세 미만 자산 카드, 지배 고침 표본, 단계 진입 줄
 */

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const PERCENTS = [100, 150, 200] as const;

// ---------- 형태: 막대 좌표·범례·aria-label × 두 화면 × 세 글자 크기 (CM11) · 낱말 끊김 (QM3-1) ----------

for (const kind of KINDS) {
  test(`${kind}: 320×568·360×740 × 글자 100·150·200%에서 잘림·가로 넘침·낱말 끊김이 없고 출발선 카드가 없다 (CM11·QM3-1)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(240_000);
    const state = await stateOf(page, kind);
    for (const size of SIZES) {
      for (const percent of PERCENTS) {
        const label = `${kind} ${size.width}x${size.height}/${percent}%`;
        await page.setViewportSize(size);
        await injectSave(page, state, '/');
        await expect(page.getByTestId('ending-screen')).toBeVisible();
        if (percent !== 100) await setRootFontPercent(page, percent);
        for (const id of ['ending-journey-section', 'ending-bar', 'ending-legend', 'ending-movement']) await expect(page.getByTestId(id), `${label} ${id}`).toHaveCount(0);
        await expect(page.getByTestId('final-net'), label).toBeVisible();
        expect(textResizeViolations(await measureTextResize(page), label), label).toEqual([]);
        expect(await noHorizontalOverflow(page), `${label} 가로 넘침`).toBe(true);
        const words = await measureWordBreaks(page, { scope: '[data-testid="ending-stats"], .ending__head' });
        expect(words.checked, `${label} 잰 낱말 수`).toBeGreaterThan(4);
        expect(words.broken.map(describeWordBreak), `${label} 낱말 끊김`).toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `${label} 100%에서는 한 줄보다 긴 낱말도 0`).toEqual([]);
        // 머리: 「{세상} · 생애 기록」 + 「{출생 연월} ~ {사망 연도}년 · {나이}세」, 제목은 한 줄 이름 「…의 인생」
        await expect(page.getByTestId('ending-era'), label).toHaveText('생애 기록'); // 세대 표기는 `ending-gen`이 맡는다 (SPEC-004 GS9)
        await expect(page.getByTestId('ending-span'), label).toHaveText(/^\d{4}년( \d{1,2}월)? ~ \d{4}년 · \d+세$/);
      }
    }
  });
}

test('넓은 화면(1280×800): 네 상태 모두 출발선 카드가 없고 가로로 넘치지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop에서만 실행');
  test.setTimeout(120_000);
  const base = await endedBase(page);
  for (const kind of KINDS) {
    const state = await stateOf(page, kind, base);
    await injectSave(page, state, '/');
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    for (const id of ['ending-journey-section', 'ending-bar', 'ending-legend', 'ending-movement']) await expect(page.getByTestId(id), `desktop ${kind} ${id}`).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
});

// ---------- 0원 판: 최종 순자산 줄은 「0원」만 말하고 자리(백분위)·방향은 말하지 않는다 (결정 후속 256 — 동률 불리 규칙을 지키던 도착 자리가 없어졌다) ----------

test('0원 판: 재력 1·2단계가 정확히 0원으로 마쳐도 최종 순자산 줄은 「0원」이고 출발선과의 방향·자리 문장은 어디에도 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const ended = await endedBase(page);
  for (const wealth of [1, 2] as const) {
    const state = withFinal(ended, wealth, 0);
    await injectSave(page, state, '/');
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('ending-movement')).toHaveCount(0);
    await expect(page.getByTestId('ending-legend-end')).toHaveCount(0);
    await expect(page.getByTestId('ending-screen')).not.toContainText(/출발선|앞선 자리|뒤쪽 자리/);
    // 금액 옆에는 자리 글자가 없다
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

// (증거 화면 1 — 엔딩 네 상태의 출발선 카드 사진 — 은 카드 삭제와 함께 걷었다, 결정 후속 256)

test('증거 화면 2: 선택지 안내 줄 · 20세 미만 자산 카드 · 단계 진입 줄 (360×740)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  // 20세 미만: 자산 카드(둘째·셋째 문장)와 선택지 안내 줄
  await openImpactScreen(page, 'impact-young');
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  await expect(page.getByTestId('choice-hint')).toBeVisible();
  await expect(page.getByTestId('assets-note')).toContainText('자산은 독립하는 해부터 셉니다.');
  await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-choice-hint.png` });
  await page.getByTestId('assets-card').scrollIntoViewIfNeeded();
  await page.getByTestId('assets-card').screenshot({ path: `${SHOT}-assets-young.png` });
  // 20세 이상: 인생 기록의 단계 진입 줄 (「스무 살을 넘겼습니다. …」 — SPEC-019 r2)
  await openImpactScreen(page, 'impact-adult');
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  const stage = page.locator('[data-testid="log-row"][data-kind="stage"]').filter({ hasText: '스무 살을 넘겼습니다' });
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
    const state = await findPendingEvent(page, fixture.id, { era: 'alpha', tier: fixture.tier, seedFrom: 1000, seedTo: 9000 });
    await injectSave(page, state, '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('auto')).toBeEnabled(); // 입력 가드가 풀린 뒤(선택지가 흐리지 않은 화면)
    await expect(page.getByTestId('impact').first()).toBeVisible();
    await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
    await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
    await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-${fixture.name}.png` });
  });
}
