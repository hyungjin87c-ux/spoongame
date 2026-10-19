import { expect, test, type Page } from '@playwright/test';
import { injectSave } from './helpers';
import { settleDash } from './m4Fixed';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { expandSheet } from './m7bCards';
import { NOTE_UI_STATES, endedWithLongNotes, lifeWithLongNotes, openNoteIn, startNoteHidden, type NoteSubject } from './m7cSheets';
import { setRootFontPercent } from './textResize';

/**
 * 기록 시트와 「나의 기록」 줄의 낱말 끊김 감사 (SPEC-003 QM3-1, content-M7c 6-4절 17①·17②, design D-80 — M7c 마일스톤의 완료 조건).
 * 폭 320·360·1280 × 글자 100·150·200% × 시트 3상태(열림 · 확인 단계 · 40개 안내) × 카드 둘(① 인용 박스 · 가장 긴 질문 + 이름 5글자):
 *  - 눈에 보이는 모든 낱말(질문·인용·안내·버튼 이름·보조 설명·끄기 칸·확인 문구)에서 한 줄보다 짧은데 중간에서 끊긴 낱말(결함) 0, 글자 100%에서 한 줄보다 긴 낱말 0.
 *  - 17②: **질문(h2 `#nc-title`)은 폭 320 · 글자 200%에서도 중간에서 끊기지 않는다**(한 줄보다 긴 낱말 예외도 없다 — 글자 크기 상한 `titleCharsFor`).
 *  - 사용자 글(`[data-user-text]`)은 우리 문구가 아니라 어디서든 끊길 수 있으므로 **낱말 끊김 감사에서만** 뺀다(D-80, design-system.md 11-8). 그 밖의 글 — 「나의 기록 · 주제」 라벨·나이 — 은 감사 대상 그대로다.
 *    측정기 대조: 같은 줄에서 표식을 떼면 긴 글이 걸리고, 표식이 있으면 걸리지 않으며, 라벨의 낱말은 두 경우 모두 잰다.
 * 폭 320·360은 mobile-360, 1280은 desktop 프로젝트. `INTENDED_BREAKS` 새 항목 없음 — 의도된 끊김 0, 강제 `<br>` 0.
 */

const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;
const SUBJECTS: readonly NoteSubject[] = ['infant', 'long-question'];

/** 기록 목록은 안쪽 스크롤 영역이라 스크롤 밖 줄의 글자는 감사기가 「안 보이는 글자」로 건너뛴다 — 다섯 줄이 모두 보이게 높이 제한을 푼다(폭은 그대로) */
async function expandLog(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.log__list { max-height: none !important; overflow: visible !important; }' });
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const ui of NOTE_UI_STATES) {
      test(`${width}px · 글자 ${percent}% · ${ui}: 끊긴 낱말(결함) 0${percent === 100 ? ', 한 줄보다 긴 낱말 0' : ''}${ui === 'open' ? ', 질문(h2)은 끊기지 않는다(17②)' : ''}`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === 'mobile-360';
        test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
        test.setTimeout(300_000);
        await page.setViewportSize({ width, height: mobile ? 740 : 800 });
        await startNoteHidden(page);
        const problems: string[] = [];
        let totalWords = 0;
        for (const subject of ui === 'limit' ? (['infant'] as const) : SUBJECTS) {
          await openNoteIn(page, ui, subject);
          await expandSheet(page); // 시트의 안쪽 스크롤 밖 글자도 재도록 세로 제한을 푼다(폭은 그대로)
          if (percent !== 100) await setRootFontPercent(page, percent);
          const label = `${width}px/${percent}%/${ui}/${subject}`;
          const words = await measureWordBreaks(page, { scope: '[data-testid="note-sheet"]' });
          totalWords += words.checked;
          for (const b of words.broken) problems.push(`${label}: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
          if (percent === 100) for (const u of words.unavoidable) problems.push(`${label}: 글자 100%인데 한 줄보다 긴 낱말 ${describeWordBreak(u)}`);
          for (const i of words.intended) problems.push(`${label}: 기록 시트에는 의도된 끊김(<wbr>)이 없다 ${describeWordBreak(i)}`);
          for (const f of words.forced) problems.push(`${label}: 기록 시트에는 강제 줄바꿈(<br>) 낱말이 없다 ${describeWordBreak(f)}`);
          // 17②: 질문(h2)의 낱말은 한 줄보다 긴 것도 없다 — 어떤 폭·글자 크기에서도 낱말 사이에서만 접힌다
          const title = await measureWordBreaks(page, { scope: '#nc-title' });
          expect(title.checked, `${label}: 질문에서 잰 낱말 수`).toBeGreaterThan(0);
          for (const b of [...title.broken, ...title.unavoidable]) problems.push(`${label}: 질문 낱말 끊김 ${describeWordBreak(b)}`);
          // 입력란은 사용자 글 영역이라 낱말 끊김에서 뺀다: 입력란에 값을 넣어도 낱말 수가 늘지 않는다(textarea 값은 글자 노드가 아니다)
        }
        expect(totalWords, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(ui === 'limit' ? 8 : 20);
        expect(problems).toEqual([]);
      });
    }
  }
}

for (const width of [320, 360] as const) {
  for (const percent of PERCENTS) {
    test(`${width}px · 글자 ${percent}% · 「나의 기록」 줄(인생 기록·엔딩 연표): 라벨·나이의 끊긴 낱말(결함) 0 — 사용자 글(data-user-text)은 감사에서 뺀다 (D-80)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: width === 320 ? 568 : 740 });
      await startNoteHidden(page);
      const problems: string[] = [];
      const life = await lifeWithLongNotes(page);
      await injectSave(page, life, '/', { speed: 1, autoMode: false, noteCards: false });
      await expect(page.getByTestId('life-screen')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await settleDash(page);
      await expandLog(page);
      const logWords = await measureWordBreaks(page, { scope: '[data-testid="log-list"]' });
      for (const b of logWords.broken) problems.push(`인생 기록: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
      expect(logWords.words, '라벨의 낱말은 잰다').toEqual(expect.arrayContaining(['나의', '기록']));
      expect(logWords.words.filter((w) => w.length >= 30), '사용자 글은 낱말 감사에 들지 않는다').toEqual([]);
      const ended = await endedWithLongNotes(page);
      await injectSave(page, ended, '/', { speed: 1, autoMode: false, noteCards: false });
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await expect(page.locator('.timeline li.is-note').first()).toBeVisible();
      const tl = await measureWordBreaks(page, { scope: '[data-testid="ending-timeline"]' });
      for (const b of tl.broken) problems.push(`엔딩 연표: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
      expect(tl.words, '연표 라벨의 낱말은 잰다').toEqual(expect.arrayContaining(['나의', '기록']));
      expect(tl.words.filter((w) => w.length >= 30), '사용자 글은 낱말 감사에 들지 않는다').toEqual([]);
      expect(problems).toEqual([]);
    });
  }
}

test('측정기 대조(D-80, 공허 통과 방지): 긴 글에서 data-user-text 표식을 떼면 낱말 끊김으로 잡히고, 표식이 있으면 잡히지 않으며, 라벨의 낱말은 두 경우 모두 잰다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startNoteHidden(page);
  const life = await lifeWithLongNotes(page);
  await injectSave(page, life, '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('log-row').filter({ has: page.getByTestId('note-label') })).toHaveCount(5);
  await settleDash(page);
  await expandLog(page);
  const withMark = await measureWordBreaks(page, { scope: '[data-testid="log-list"]' });
  expect([...withMark.broken, ...withMark.unavoidable].filter((b) => b.word.length >= 30), '표식이 있으면 긴 글은 낱말 감사에 들지 않는다').toEqual([]);
  expect(withMark.words).toEqual(expect.arrayContaining(['나의', '기록']));
  await page.evaluate(() => document.querySelectorAll('[data-user-text]').forEach((el) => el.removeAttribute('data-user-text')));
  const withoutMark = await measureWordBreaks(page, { scope: '[data-testid="log-list"]' });
  const caught = [...withoutMark.broken, ...withoutMark.unavoidable].filter((b) => b.word.length >= 30);
  expect(caught.length, '표식을 떼면 긴 글이 끊긴 낱말(또는 한 줄보다 긴 낱말)로 잡힌다').toBeGreaterThan(0);
  expect(withoutMark.checked, '표식을 떼면 잰 낱말이 늘어난다').toBeGreaterThan(withMark.checked);
  expect(withoutMark.words).toEqual(expect.arrayContaining(['나의', '기록']));
});
