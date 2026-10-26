import { expect, test } from '@playwright/test';
import { dashViolations, measureDash } from './m4Fixed';
import { CARD_UI_STATES, longestCardStates, openCardIn, startHidden } from './m7bCards';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 중대 결정 카드의 글자 확대·리플로 (SPEC-003 CM11, QM2-3, 완료 기준 16③·16⑩ — M7b 마일스톤의 완료 조건, content-M7b 7절).
 * 폭 320·360 × 글자 100·150·200% × 카드 3상태(모달 시트 · 접힌 띠 · 자동 모드 인라인 카드) × **「본문 + 라벨 + 인용 + 출처」 합이 가장 긴 카드 5개**(데이터에서 자동으로 고른다, e2e/m7bCards.ts#longestCards)에서
 *  - 가로 넘침 0px · 글자 잘림 0 · 화면 밖으로 나간 요소 0 (e2e/textResize.ts#measureTextResize)
 *  - 모달 시트: 시트 자신의 가로 스크롤 0, 「잠시 덮어 두기」와 모든 선택지가 시트 안 스크롤로 닿는다(위쪽 변이 시트 안에 보인다)
 *  - 접힘·인라인: 진행 줄·도구 줄 버튼이 눌리고(≥ 44px) 고정 띠가 화면 절반 이하이거나 풀린다 (QM2-12, e2e/m4Fixed.ts#dashViolations) — 시트가 띠를 가리지 않는 상태 포함
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const PERCENTS = [100, 150, 200] as const;
const WIDTHS = [320, 360] as const;

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const ui of CARD_UI_STATES) {
      test(`${width}px · 글자 ${percent}% · ${ui}: 가장 긴 카드 5개 — 가로 넘침 0px·글자 잘림 0${ui === 'sheet' ? '·시트 안 스크롤로 선택지·접기 버튼에 닿음' : '·진행 줄·도구 줄 버튼이 눌린다'} (CM11)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(300_000);
        await page.setViewportSize({ width, height: width === 320 ? 568 : 740 });
        await startHidden(page);
        const cards = await longestCardStates(page, 5);
        expect(cards, '가장 긴 카드 5개를 골랐다').toHaveLength(5);
        const problems: string[] = [];
        for (const { card, state } of cards) {
          await openCardIn(page, state, ui);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const label = `${width}px/${percent}%/${ui}/${card.id}(${card.era}, ${card.total}자)`;
          if (ui === 'sheet') {
            problems.push(...textResizeViolations(await measureTextResize(page), label));
            const sheet = await reachability(page);
            if (sheet.sheetOverflowX > 0) problems.push(`${label}: 시트 안 가로 넘침 ${sheet.sheetOverflowX}px`);
            for (const r of sheet.reach) if (!r.visible) problems.push(`${label}: ${r.id}에 포커스를 주어도 위쪽 변이 시트 안에 보이지 않는다 (top ${Math.round(r.top)}, 시트 ${Math.round(sheet.sheetTop)}~${Math.round(sheet.sheetBottom)})`);
            expect(sheet.reach.length, `${label}: 시트 안 버튼(접기 + 선택지)`).toBeGreaterThanOrEqual(3);
          } else {
            problems.push(...dashViolations(await measureDash(page), label));
          }
        }
        expect(problems).toEqual([]);
      });
    }
  }
}

/** 시트 안 버튼마다 포커스를 주고 위쪽 변이 시트 상자 안에 보이는지, 시트 자신의 가로 스크롤이 없는지 */
async function reachability(page: import('@playwright/test').Page): Promise<{ sheetOverflowX: number; sheetTop: number; sheetBottom: number; reach: Array<{ id: string; top: number; visible: boolean }> }> {
  await page.keyboard.press('Shift'); // 키보드 사용 중(:focus-visible)
  return page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
    const sr = sheet.getBoundingClientRect();
    const reach: Array<{ id: string; top: number; visible: boolean }> = [];
    for (const b of Array.from(sheet.querySelectorAll<HTMLElement>('button'))) {
      b.focus();
      const r = b.getBoundingClientRect();
      reach.push({ id: b.getAttribute('data-testid') ?? b.tagName, top: r.top, visible: r.top >= sr.top - 1 && r.top < sr.bottom && r.top < window.innerHeight });
    }
    sheet.scrollTop = 0;
    return { sheetOverflowX: sheet.scrollWidth - sheet.clientWidth, sheetTop: sr.top, sheetBottom: sr.bottom, reach };
  });
}

test('낮은 화면 667×375 · 320×256: 모달 시트가 94dvh 안에서 스크롤되고 화면 위로 잘리지 않으며, 접으면 띠가 규칙대로 놓인다 (16⑩)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  for (const [w, h] of [[667, 375], [320, 256]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await startHidden(page);
    const [first] = await longestCardStates(page, 1);
    await openCardIn(page, first.state, 'sheet');
    const box = await page.evaluate(() => {
      const r = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, h: r.height, vh: window.innerHeight };
    });
    expect(box.top, `${w}x${h}: 시트가 화면 위로 잘리지 않는다`).toBeGreaterThanOrEqual(-0.5);
    expect(box.h, `${w}x${h}: 시트 높이 ≤ 94dvh`).toBeLessThanOrEqual(box.vh * 0.94 + 1);
    const m = await measureTextResize(page);
    expect(textResizeViolations(m, `${w}x${h}`)).toEqual([]);
    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-fold')).toBeVisible();
    expect(dashViolations(await measureDash(page), `${w}x${h}/folded`)).toEqual([]);
  }
});

// 측정기 대조: 시트 안 넘침을 일부러 만들면 잡힌다 (공허 통과 방지)
test('측정기 대조: 인용 출처 줄을 줄바꿈 없는 긴 글자로 바꾸면 시트 안 가로 넘침이나 화면 밖 요소로 잡힌다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startHidden(page);
  const [first] = await longestCardStates(page, 1);
  await openCardIn(page, first.state, 'sheet');
  const before = await measureTextResize(page);
  expect(textResizeViolations(before, 'before')).toEqual([]);
  await page.evaluate(() => {
    const src = document.querySelector('.cite__src') as HTMLElement;
    src.style.whiteSpace = 'nowrap';
    src.textContent = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  });
  const after = await measureTextResize(page);
  const sheetOverflow = await page.evaluate(() => {
    const s = document.querySelector('[role="dialog"]') as HTMLElement;
    return s.scrollWidth - s.clientWidth;
  });
  expect(textResizeViolations(after, 'after').length + (sheetOverflow > 0 ? 1 : 0), '일부러 만든 넘침이 잡힌다').toBeGreaterThan(0);
});
