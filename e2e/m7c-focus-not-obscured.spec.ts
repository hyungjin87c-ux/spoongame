import { expect, test } from '@playwright/test';
import { auditFocus, summarize } from './focusObscured';
import { settleDash } from './m4Fixed';
import { NOTE_UI_STATES, openNoteIn, startNoteHidden, type NoteUi } from './m7cSheets';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 기록 시트에서 고정 요소가 키보드 포커스를 가리지 않는다 (SPEC-003 CM10, QM2-1 (g), content-M7c 6-4절 16① — M7c 마일스톤의 완료 조건).
 * 공통 뷰포트 11종 × 글자 100·200% × 시트 3상태(열림 · 확인 단계 · 40개 안내)에서 Tab·Shift+Tab 전체 순회와 프로그램 focus()를 측정한다(e2e/focusObscured.ts#auditFocus).
 * 모달 시트가 떠 있는 동안 바깥(헤더·진행 줄·도구 줄·main)은 `inert`이고 스크림 뒤에 있다 — 측정기는 `[inert]` 바깥을 고정 요소·조작 요소에서 뺀다(design-system.md 11-10).
 * 시트 안은 자기 스크롤 영역이다: 입력란·두 버튼·끄기 칸으로 Tab하면 시트 안이 스크롤되어 포커스가 시트 안에 보인다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

/** 상태마다 반드시 순회에 들어와야 하는 조작 요소 (공허 통과 방지) */
const MUST_TAB: Record<NoteUi, string[]> = {
  open: ['note-input', 'note-save', 'note-skip', 'note-cards-toggle'],
  confirm: ['note-input', 'note-confirm-discard', 'note-confirm-back'],
  limit: ['note-limit-close'],
};

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M7c 기록 시트 포커스 가림 없음 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    for (const percent of [100, 200] as const) {
      for (const ui of NOTE_UI_STATES) {
        test(`${vp.name} · 글자 ${percent}% · ${ui}: Tab·Shift+Tab 전체 순회·프로그램 focus()에서 가려진 포커스 0 (CM10)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          // QM2-1 r5 메모 4: 320×256에 글자 200%를 겹친 조합(800% 확대 상당)은 CM10 포커스 측정에서 제외한다(WCAG 1.4.10의 400% 기준을 넘는다 — m4-focus.spec.ts·m7b와 같다)
          test.skip(percent === 200 && vp.name === '320x256-zoom400', 'CM10 측정 제외 조합(QM2-1 r5 메모 4): 320×256 × 글자 200%');
          test.setTimeout(240_000);
          await startNoteHidden(page);
          await openNoteIn(page, ui);
          if (percent !== 100) await setRootFontPercent(page, percent);
          await settleDash(page);
          const audit = await auditFocus(page, `${vp.name}/${percent}%/${ui}`, { headingTestId: 'note-title' });
          expect(audit.violations, summarize(audit)).toEqual([]);
          for (const id of MUST_TAB[ui]) {
            expect(audit.tabbables, `조작 요소 ${audit.tabbables.join(' → ')}`).toContain(id);
            expect(audit.forward.map((s) => s.id), `Tab 순회 ${id}`).toContain(id);
          }
          // 모달: 조작 요소는 시트 안뿐이다 — 바깥(진행 줄·도구 줄·기록 목록)은 inert라 순회에 없다
          for (const outside of ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'log-list']) expect(audit.tabbables, `${outside}는 inert라 순회에 없다`).not.toContain(outside);
          expect(audit.forward.length).toBe(audit.tabbables.length);
          expect(audit.programmatic.length, '프로그램 focus() 측정 수').toBeGreaterThanOrEqual(audit.tabbables.length);
          // 화면에 가려진 고정 요소가 없다 — 시트는 고정 띠가 아니다(헤더·진행 줄은 inert, 스크림 뒤)
          expect(audit.fixedIds, '시트가 열려 있으면 고정 요소로 모이지 않는다(inert)').not.toContain('controls');
        });
      }
    }
  });
}

test('가장 낮은 화면 320×256 · 667×375: 입력란·두 버튼·끄기 칸에 포커스를 주면 시트 안이 스크롤되어 시트 상자 안에 보이고, 위쪽 변이 화면 위로 잘리지 않는다 (16⑩)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  for (const [w, h] of [[320, 256], [667, 375]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await startNoteHidden(page);
    await openNoteIn(page, 'open');
    await page.keyboard.press('Shift'); // 키보드 사용 중(:focus-visible)
    const sheetBox = await page.evaluate(() => {
      const r = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    expect(sheetBox.top, `${w}x${h}: 시트가 화면 위로 잘리지 않는다`).toBeGreaterThanOrEqual(-0.5);
    expect(sheetBox.bottom - sheetBox.top, `${w}x${h}: 시트 높이 ≤ 94dvh`).toBeLessThanOrEqual(sheetBox.vh * 0.94 + 1);
    for (const id of ['note-input', 'note-save', 'note-skip', 'note-cards-toggle']) {
      await page.getByTestId(id).focus();
      const visible = await page.evaluate((testId) => {
        const sheet = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
        const r = document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect();
        const bottom = Math.min(sheet.bottom, window.innerHeight);
        return r.height <= bottom - sheet.top ? r.top >= sheet.top - 1 && r.bottom <= bottom + 1 : r.top < bottom && r.bottom > sheet.top;
      }, id);
      expect(visible, `${w}x${h} ${id}가 시트 상자 안에 보인다`).toBe(true);
    }
    // 시트가 낮은 화면에서도 가로로 넘치지 않는다
    const overflowX = await page.getByRole('dialog').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflowX, `${w}x${h}: 시트 안 가로 넘침`).toBeLessThanOrEqual(0);
  }
});
