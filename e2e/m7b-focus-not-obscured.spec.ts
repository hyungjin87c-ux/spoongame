import { expect, test, type Page } from '@playwright/test';
import { auditFocus, sampleFocus, summarize } from './focusObscured';
import { CARD_UI_STATES, openCardIn, startHidden, type CardUiState } from './m7bCards';
import { findCardState } from './m7bStates';
import { settleDash } from './m4Fixed';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 중대 결정 카드에서 고정 요소가 키보드 포커스를 가리지 않는다 (SPEC-003 CM10, QM2-1 (g) — M7b 마일스톤의 완료 조건, 완료 기준 16①).
 * 공통 뷰포트 11종 × 글자 100·200% × 카드 3상태(수동 모달 시트 · 접힌 띠 · 자동 모드 인라인 카드)에서 Tab·Shift+Tab 전체 순회와 프로그램 focus()를 측정한다(e2e/focusObscured.ts#auditFocus).
 * 모달 시트가 떠 있는 동안에는 바깥(헤더·진행 줄·도구 줄·main)이 `inert`이고 스크림 뒤에 있다 — 측정기는 `[inert]` 바깥을 고정 요소·조작 요소에서 뺀다(diff-003.md D-59).
 * 시트 안은 자기 스크롤 영역이다: 선택지로 Tab하면 시트 안이 스크롤되어 포커스가 시트 안에 보인다(CM10).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

/** 상태마다 반드시 순회에 들어와야 하는 조작 요소 (공허 통과 방지) */
function mustTab(state: CardUiState): string[] {
  if (state === 'sheet') return ['decision-fold-btn'];
  if (state === 'folded') return ['decision-reopen', 'pause', 'skip', 'auto', 'tool-bgm', 'tool-exit', 'log-list'];
  return ['decision-fold-btn', 'pause', 'skip', 'auto', 'tool-bgm', 'tool-exit', 'log-list'];
}

async function isFixedBox(page: Page, selector: string): Promise<boolean> {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) return false;
  return el.evaluate((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position));
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M7b 카드 포커스 가림 없음 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    for (const percent of [100, 200] as const) {
      for (const ui of CARD_UI_STATES) {
        test(`${vp.name} · 글자 ${percent}% · ${ui}: Tab·Shift+Tab 전체 순회·프로그램 focus()에서 가려진 포커스 0 (CM10)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          // QM2-1 r5 메모 4: 320×256에 글자 200%를 겹친 조합(800% 확대 상당)은 CM10 포커스 측정에서 제외한다(WCAG 1.4.10의 400% 기준을 넘는다 — m4-focus.spec.ts와 같다)
          test.skip(percent === 200 && vp.name === '320x256-zoom400', 'CM10 측정 제외 조합(QM2-1 r5 메모 4): 320×256 × 글자 200%');
          test.setTimeout(240_000);
          await startHidden(page);
          const state = await findCardState(page, 'youth-startup');
          await openCardIn(page, state, ui);
          if (percent !== 100) await setRootFontPercent(page, percent);
          await settleDash(page);
          const heading = ui === 'sheet' || ui === 'inline' ? 'choice-title' : 'life-name';
          const audit = await auditFocus(page, `${vp.name}/${percent}%/${ui}`, { headingTestId: heading });
          expect(audit.violations, summarize(audit)).toEqual([]);
          for (const id of mustTab(ui)) {
            expect(audit.tabbables, `조작 요소 ${audit.tabbables.join(' → ')}`).toContain(id);
            expect(audit.forward.map((s) => s.id), `Tab 순회 ${id}`).toContain(id);
          }
          expect(audit.forward.length).toBe(audit.tabbables.length);
          expect(audit.programmatic.length, '프로그램 focus() 측정 수').toBeGreaterThanOrEqual(audit.tabbables.length);
          if (ui === 'sheet') {
            // 시트가 떠 있으면 조작 요소는 시트 안뿐이다(선택지 2~3개 + 접기) — 바깥(진행 줄·도구 줄)은 inert라 순회에 없다
            expect(audit.tabbables.length, `시트 안 조작 요소 ${audit.tabbables.join(' → ')}`).toBeGreaterThanOrEqual(3);
            expect(audit.tabbables.length).toBeLessThanOrEqual(5);
            for (const outside of ['pause', 'skip', 'auto', 'tool-bgm', 'log-list']) expect(audit.tabbables, `${outside}는 inert라 순회에 없다`).not.toContain(outside);
            expect(audit.tabbables.filter((id) => id.startsWith('choice-')).length, '선택지가 순회에 있다').toBeGreaterThanOrEqual(2);
          } else {
            // 시트가 아니면 헤더·진행 줄이 고정/해제 규칙대로 모이고 가리지 않는다 (QM2-12)
            const headFixed = await isFixedBox(page, '[data-testid="dash-head"]');
            const barFixed = await isFixedBox(page, '[data-testid="controls"]');
            if (headFixed) expect(audit.fixedIds, '헤더가 고정이면 고정 요소로 모인다').toContain('dash-head');
            else expect(audit.fixedIds, '헤더가 풀렸으면 고정 요소로 모이지 않는다').not.toContain('dash-head');
            if (barFixed) expect(audit.fixedIds, '진행 줄이 고정이면 고정 요소로 모인다').toContain('controls');
            else expect(audit.fixedIds, '진행 줄이 풀렸거나 데스크톱이면 고정 요소로 모이지 않는다').not.toContain('controls');
          }
        });
      }
    }
  });
}

test('모달 시트: 선택지·접기 버튼으로 Tab하면 시트 안이 스크롤되어 포커스가 시트 상자 안에 보이고 시트 밖 고정 요소에 가려지지 않는다 — 가장 낮은 화면 320×256 · 667×375 · 글자 200%', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  for (const [w, h] of [[320, 256], [667, 375], [360, 568]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await startHidden(page);
    const state = await findCardState(page, 'youth-startup');
    await openCardIn(page, state, 'sheet');
    // 320×256 × 글자 200% × 선택지 카드는 M4부터 CM10의 측정 제외 조합이다(QM2-1 r5 메모 4: e2e/m4-focus.spec.ts — 선택지 하나(305px)가 화면(256px)보다 커 포커스 링이 어떻게든 한쪽에서 잘린다). 이 높이는 글자 100%로 잰다
    await setRootFontPercent(page, w === 320 && h === 256 ? 100 : 200);
    await settleDash(page);
    await page.keyboard.press('Shift'); // 키보드 사용 중(:focus-visible)
    const ids = await page.locator('[role="dialog"] button').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) {
      await page.getByTestId(id).focus();
      const stop = await sampleFocus(page);
      expect(stop.judgement.violations, `${w}x${h} ${id}`).toEqual([]);
      const inside = await page.evaluate((testId) => {
        const el = document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect();
        const sheet = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
        const sheetBottom = Math.min(sheet.bottom, window.innerHeight);
        // 시트 안 보이는 높이보다 작은 요소는 통째로 시트 안에 있어야 한다. 그보다 큰 선택지(폭 320 × 높이 256 × 글자 200%에서 253px짜리가 241px 시트에 든다)는 브라우저가 가운데로 맞추므로
        // 시트와 겹치는 부분이 보이면 된다(WCAG 2.4.11 — 통째로 가려지지 않는다). 나머지는 시트를 스크롤해 읽는다
        if (el.height <= sheetBottom - sheet.top) return el.top >= sheet.top - 1 && el.bottom <= sheetBottom + 1;
        return el.top < sheetBottom && el.bottom > sheet.top;
      }, id);
      expect(inside, `${w}x${h} ${id}가 시트 상자 안에 보인다`).toBe(true);
    }
  }
});
