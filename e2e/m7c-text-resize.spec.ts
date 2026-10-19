import { expect, test, type Page } from '@playwright/test';
import { injectSave } from './helpers';
import { settleDash } from './m4Fixed';
import { NOTE_UI_STATES, endedWithLongNotes, lifeWithLongNotes, openNoteIn, startNoteHidden, type NoteSubject } from './m7cSheets';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 기록 시트와 「나의 기록」 줄의 글자 확대·리플로 (SPEC-003 CM11, QM2-3, content-M7c 6-4절 16③·16⑩ — M7c 마일스톤의 완료 조건).
 * 폭 320·360 × 글자 100·150·200% × 시트 3상태(열림 · 확인 단계 · 40개 안내) × 카드 둘(인용 박스가 있는 ① · 가장 긴 질문 + 이름 5글자):
 *  - 가로 넘침 0px · 글자 잘림 0 · 화면 밖으로 나간 요소 0 (e2e/textResize.ts#measureTextResize), 시트 자신의 가로 스크롤 0,
 *    입력란·두 버튼·끄기 칸(또는 확인 단계 버튼·「닫기」)에 포커스를 주면 위쪽 변이 시트 안에 보인다(시트 안 스크롤로 닿는다, 16⑩ — 시트는 고정 띠가 아니다).
 * 사용자 글: 줄바꿈 없는 긴 글(A16)·긴 URL·방향 글이 든 인생 기록 줄과 엔딩 연표 줄이 같은 조합에서 가로로 넘치지 않는다 — **글 영역(`data-user-text`)은 넘침·잘림 측정에서 빼지 않는다**(D-80: 낱말 끊김 감사에서만 뺀다).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다. 스크린샷은 qa/screenshots/003/dev-M7c-resize-*.png.
 */

const SHOTS = 'qa/screenshots/003';
const PERCENTS = [100, 150, 200] as const;
const WIDTHS = [320, 360] as const;
const SUBJECTS: readonly NoteSubject[] = ['infant', 'long-question'];

/** 시트 안 조작 요소마다 포커스를 주고 위쪽 변이 시트 상자 안에 보이는지, 시트 자신의 가로 스크롤이 없는지 */
async function reachability(page: Page): Promise<{ sheetOverflowX: number; reach: Array<{ id: string; top: number; visible: boolean }> }> {
  await page.keyboard.press('Shift'); // 키보드 사용 중(:focus-visible)
  return page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
    const sr = sheet.getBoundingClientRect();
    const reach: Array<{ id: string; top: number; visible: boolean }> = [];
    for (const b of Array.from(sheet.querySelectorAll<HTMLElement>('button, textarea'))) {
      b.focus();
      const r = b.getBoundingClientRect();
      reach.push({ id: b.getAttribute('data-testid') ?? b.tagName, top: r.top, visible: r.top >= sr.top - 1 && r.top < sr.bottom && r.top < window.innerHeight });
    }
    sheet.scrollTop = 0;
    return { sheetOverflowX: sheet.scrollWidth - sheet.clientWidth, reach };
  });
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const ui of NOTE_UI_STATES) {
      test(`${width}px · 글자 ${percent}% · ${ui}: 가로 넘침 0px·글자 잘림 0·시트 안 스크롤로 입력란·버튼에 닿음 (카드 ①과 가장 긴 질문 + 이름 5글자)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(240_000);
        await page.setViewportSize({ width, height: width === 320 ? 568 : 740 });
        await startNoteHidden(page);
        const problems: string[] = [];
        for (const subject of ui === 'limit' ? (['infant'] as const) : SUBJECTS) {
          await openNoteIn(page, ui, subject);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const label = `${width}px/${percent}%/${ui}/${subject}`;
          problems.push(...textResizeViolations(await measureTextResize(page), label));
          const sheet = await reachability(page);
          if (sheet.sheetOverflowX > 0) problems.push(`${label}: 시트 안 가로 넘침 ${sheet.sheetOverflowX}px`);
          for (const r of sheet.reach) if (!r.visible) problems.push(`${label}: ${r.id}에 포커스를 주어도 위쪽 변이 시트 안에 보이지 않는다 (top ${Math.round(r.top)})`);
          expect(sheet.reach.length, `${label}: 시트 안 조작 요소`).toBeGreaterThanOrEqual(ui === 'limit' ? 1 : 3);
          if (percent === 200 && subject === 'infant') await page.screenshot({ path: `${SHOTS}/dev-M7c-resize-${width}-200-${ui}.png` });
        }
        expect(problems).toEqual([]);
      });
    }
  }
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    test(`${width}px · 글자 ${percent}% · 긴 글이 든 「나의 기록」 줄(인생 기록·엔딩 연표): 가로 넘침 0px·글자 잘림 0 — 줄바꿈 없는 긴 글·URL·방향 글`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: width === 320 ? 568 : 740 });
      await startNoteHidden(page);
      const problems: string[] = [];
      // 인생 기록 줄
      const life = await lifeWithLongNotes(page);
      await injectSave(page, life, '/', { speed: 1, autoMode: false, noteCards: false });
      await expect(page.getByTestId('life-screen')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await settleDash(page);
      await expect(page.getByTestId('log-row').filter({ has: page.getByTestId('note-label') })).toHaveCount(5);
      problems.push(...textResizeViolations(await measureTextResize(page), `${width}px/${percent}%/인생 기록`));
      // 기록 목록(스크롤 영역) 안의 줄도 넘치지 않는다 — 줄마다 오른쪽 끝이 목록 안
      const rowsOver = await page.getByTestId('log-list').evaluate((list) => {
        const lr = list.getBoundingClientRect();
        return Array.from(list.querySelectorAll<HTMLElement>('.log__row--note')).filter((row) => row.scrollWidth > row.clientWidth + 1 || row.getBoundingClientRect().right > lr.right + 1).length;
      });
      if (rowsOver > 0) problems.push(`${width}px/${percent}%/인생 기록: 넘치는 나의 기록 줄 ${rowsOver}개`);
      if (percent === 200) await page.screenshot({ path: `${SHOTS}/dev-M7c-resize-${width}-200-log-rows.png` });
      // 엔딩 연표 줄
      const ended = await endedWithLongNotes(page);
      await injectSave(page, ended, '/', { speed: 1, autoMode: false, noteCards: false });
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await expect(page.locator('[data-testid="timeline-entry"][data-kind="note"]').first()).toBeVisible();
      problems.push(...textResizeViolations(await measureTextResize(page), `${width}px/${percent}%/엔딩 연표`));
      const tlOver = await page.locator('.timeline li.is-note').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
      if (tlOver > 0) problems.push(`${width}px/${percent}%/엔딩 연표: 넘치는 나의 기록 줄 ${tlOver}개`);
      if (percent === 200) await page.locator('.timeline li.is-note').first().scrollIntoViewIfNeeded();
      if (percent === 200) await page.screenshot({ path: `${SHOTS}/dev-M7c-resize-${width}-200-timeline-rows.png` });
      expect(problems).toEqual([]);
    });
  }
}

test('측정기 대조(공허 통과 방지): 「나의 기록」 줄의 글 영역이 넘치게 만들면 넘침으로 잡힌다 — data-user-text 글도 넘침 측정에서 빠지지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startNoteHidden(page);
  const life = await lifeWithLongNotes(page);
  await injectSave(page, life, '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('log-row').filter({ has: page.getByTestId('note-label') })).toHaveCount(5);
  await settleDash(page);
  expect(textResizeViolations(await measureTextResize(page), 'before')).toEqual([]);
  // 규칙을 걷어 낸다: 글이 줄바꿈 없이 흐르게 해 가로로 넘치게 한다
  await page.addStyleTag({ content: '.note-text, [data-user-text] { white-space: nowrap !important; overflow-wrap: normal !important; word-break: keep-all !important; }' });
  const after = textResizeViolations(await measureTextResize(page), 'after');
  expect(after.length, '일부러 만든 넘침이 잡힌다').toBeGreaterThan(0);
});
