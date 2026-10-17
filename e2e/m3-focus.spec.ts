import { expect, test, type Page } from '@playwright/test';
import { auditFocus, sampleFocus, summarize } from './focusObscured';
import { M3_SCREENS, freezeTime, headingOf, mainButtonOf, openM3Screen } from './m3States';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 룰렛·출생신고 화면에서 고정 하단 띠가 키보드 포커스를 가리지 않는다 (SPEC-003 CM10, QM2-1 (g)·완료 기준 4: M3 마일스톤의 완료 조건).
 * 첫 화면의 e2e/focus-not-obscured.spec.ts와 같은 방식(e2e/focusObscured.ts#auditFocus)과 같은 뷰포트 11종 × 글자 100·200%를 룰렛(회전 중·결과)·출생신고에 적용한다.
 * 회전 중 화면은 연출이 5.4초에 끝나 측정이 끝나기 전에 모양이 바뀌므로 시간을 멈춰(page.clock) 붙들어 두고 잰다(e2e/m3States.ts#freezeTime).
 * 출생신고는 가장 긴 내용 표본(흙수저·다이아몬드수저·지난 세상·다가올 세상, e2e/m3Variants.ts)도 같은 조합으로 잰다(REV-003-M3-1 R-262).
 * 화면의 조작 요소는 하단 띠의 버튼 하나뿐이다(본문은 읽는 글이라 Tab으로 닿는 곳이 없다) — 그래서 이 audit은 (1) 띠 버튼 포커스 링이 화면 안에 있고 (2) 화면이 뜬 뒤 제목(h1)에 가는
 * 프로그램 포커스가 고정 띠에 가리지 않으며 (3) 띠가 고정이면 고정 요소로 자동 수집되고 풀렸으면(QM2-12) 수집되지 않는 것을 본다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

/** 띠가 풀리지 않고 고정(fixed·sticky)인가 */
async function barIsFixed(page: Page): Promise<boolean> {
  return page.getByTestId('bottom-bar').evaluate((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position));
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M3 포커스 가림 없음 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    for (const percent of [100, 200] as const) {
      for (const screen of M3_SCREENS) {
        test(`${vp.name} · 글자 ${percent}% · ${screen}: Tab·Shift+Tab 전체 순회·프로그램 focus()·제목 포커스에서 가려진 포커스 0 (CM10)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          test.setTimeout(120_000);
          await openM3Screen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          if (screen === 'roulette-spin') await freezeTime(page); // 연출이 끝나 화면이 바뀌지 않게 붙들어 둔다
          const audit = await auditFocus(page, `${vp.name}/${percent}%/${screen}`, { headingTestId: headingOf(screen) });
          expect(audit.violations, summarize(audit)).toEqual([]);
          // 공허 통과 방지: 띠 버튼이 실제로 순회됐고 프로그램 focus()로도 측정됐다
          expect(audit.tabbables, `조작 요소 ${audit.tabbables.join(' → ')}`).toContain(mainButtonOf(screen));
          expect(audit.forward.map((s) => s.id)).toContain(mainButtonOf(screen));
          expect(audit.backward.map((s) => s.id)).toContain(mainButtonOf(screen));
          expect(audit.programmatic.length, '프로그램 focus() 측정 수(띠 버튼 + 제목)').toBeGreaterThanOrEqual(2);
          expect(audit.forward.length).toBe(audit.tabbables.length);
          // 고정 요소 자동 수집: 띠가 고정이면 모이고, 풀렸으면(position: static) 모이지 않는다 (QM2-12 d)
          const fixed = await barIsFixed(page);
          if (fixed) expect(audit.fixedIds, '띠가 고정이면 고정 요소로 모인다').toContain('bottom-bar');
          else expect(audit.fixedIds, '띠가 풀렸으면(static) 고정 요소로 모이지 않는다').not.toContain('bottom-bar');
          testInfo.annotations.push({ type: 'bar', description: fixed ? '고정' : '해제' });
        });
      }
    }
  });
}

test('화면 전환 직후 제목 포커스: 첫 화면 → 룰렛 → 출생신고 → 인생까지 새 화면이 뜰 때마다 제목(h1)에 포커스가 가고 고정 띠에 가려지지 않는다 (360x568 · 320x568 · 글자 200%)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  for (const vp of [
    { width: 360, height: 568 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(vp);
    await openM3Screen(page, 'roulette-result');
    await setRootFontPercent(page, 200);
    await page.getByTestId('to-birth').click();
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('birth-heading');
    const stop = await sampleFocus(page);
    expect(stop.judgement.violations, `${vp.width}x${vp.height} 출생신고 제목 포커스`).toEqual([]);
  }
});
