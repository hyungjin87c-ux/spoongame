import { expect, test } from '@playwright/test';
import { measureLineBreaks } from './lineBreaks';
import { CARD_UI_STATES, expandSheet, longestCardStates, openCardIn, startHidden } from './m7bCards';
import { setRootFontPercent } from './textResize';

/**
 * 중대 결정 카드의 줄바꿈 감사 (SPEC-003 QM2-5·QM2-10, 완료 기준 16⑤ — M7b 마일스톤의 완료 조건, content-M7b 7절).
 * 폭 320·360·1280 × 글자 100·150·200% × 카드 3상태 × 「본문 + 라벨 + 인용 + 출처」가 가장 긴 카드 5개:
 *  - 구분 기호(「·」「/」「—」)와 여는 괄호가 줄 끝에, 구분 기호·닫는 괄호·쉼표·마침표가 줄 첫머리에 혼자 남지 않는다 — 머리 「{연도}년 · {나이}세」(`FitPair`), 영향 줄 「 · 」(CSS가 그리는 기호),
 *    출처 줄의 쉼표·저자 「A·B」, 접힌 띠(구분 기호를 글자로 두지 않는다).
 *  - 숫자와 바로 뒤 단위(「75.7%」「45만 8천 원」), 날짜 묶음이 두 줄로 갈라지지 않는다.
 * 폭 320·360은 mobile-360, 1280은 desktop 프로젝트.
 */

const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const ui of CARD_UI_STATES) {
      test(`${width}px · 글자 ${percent}% · ${ui}: 가장 긴 카드 5개 — 줄 끝·첫머리에 혼자 남는 구분 기호 0, 숫자와 단위가 갈라지는 곳 0 (QM2-10)`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === 'mobile-360';
        test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
        test.setTimeout(300_000);
        await page.setViewportSize({ width, height: mobile ? 740 : 800 });
        await startHidden(page);
        const cards = await longestCardStates(page, 5);
        const problems: string[] = [];
        let chars = 0;
        let lines = 0;
        for (const { card, state } of cards) {
          await openCardIn(page, state, ui);
          if (ui === 'sheet') await expandSheet(page); // 시트의 안쪽 스크롤 밖 글자도 재도록 세로 제한을 푼다(폭은 그대로)
          if (percent !== 100) await setRootFontPercent(page, percent);
          const report = await measureLineBreaks(page, ui === 'folded' ? '[data-testid="decision-fold"]' : '[data-testid="choice-panel"]', { separators: true, keeps: true });
          chars += report.charCount;
          lines += report.lineCount;
          for (const v of report.violations) problems.push(`${width}px/${percent}%/${ui}/${card.id}: ${v}`);
        }
        expect(chars, '잰 글자 수(공허 통과 방지)').toBeGreaterThan(ui === 'folded' ? 100 : 800);
        expect(lines, '잰 줄 수').toBeGreaterThan(ui === 'folded' ? 5 : 40);
        expect(problems).toEqual([]);
      });
    }
  }
}
