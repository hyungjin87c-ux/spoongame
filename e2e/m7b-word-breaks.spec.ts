import { expect, test } from '@playwright/test';
import { DASH_TEXT } from '../src/data/dashText';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { CARD_UI_STATES, expandSheet, longestCardStates, openCardIn, startHidden, type CardUiState } from './m7bCards';
import { findCardState } from './m7bStates';
import { setRootFontPercent } from './textResize';
import { openM4Screen } from './m4States';

/**
 * 중대 결정 카드의 낱말 끊김 감사 (SPEC-003 QM3-1, 완료 기준 17①·17② — M7b 마일스톤의 완료 조건, content-M7b 7절·마스터 결정 M-12).
 * 폭 320·360·1280 × 글자 100·150·200% × 카드 3상태(모달 시트 · 접힌 띠 · 인라인 카드) × 「본문 + 라벨 + 인용 + 출처」가 가장 긴 카드 5개:
 *  - 눈에 보이는 모든 낱말(카드 제목·상황·라벨·영향 줄·인용 요약·**출처 줄**의 영문 저자명·원제)에서 한 줄보다 짧은데 중간에서 끊긴 낱말(결함) 0. 한 줄보다 긴 낱말만 예외이고 글자 100%에서는 그것도 0.
 *  - 17②: **카드 제목(h2 `.decision__title`)은 폭 320 · 글자 200%에서도 중간에서 끊기지 않는다**(한 줄보다 긴 낱말 예외도 없다 — 글자 크기 상한).
 *  - `INTENDED_BREAKS`에 새 항목을 더하지 않는다(카드 안의 의도된 끊김은 없다 — 목록 밖 intended 0, 강제 `<br>` 0).
 *  - D-58: 「새 기록 N개 · 맨 위로」 알약(스크롤 영역 위 가장자리의 sticky 슬롯, R-438)이 글자 200% × 폭 320·360에서 한 글자씩 끊기지 않는다.
 * 폭 320·360은 mobile-360, 1280은 desktop 프로젝트.
 */

const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;

function scopeOf(ui: CardUiState): string {
  return ui === 'folded' ? '[data-testid="decision-fold"]' : '[data-testid="choice-panel"]';
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const ui of CARD_UI_STATES) {
      test(`${width}px · 글자 ${percent}% · ${ui}: 가장 긴 카드 5개 — 끊긴 낱말(결함) 0${percent === 100 ? ', 한 줄보다 긴 낱말 0' : ''}${ui !== 'folded' ? ', 카드 제목(h2)은 끊기지 않는다(17②)' : ''}`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === 'mobile-360';
        test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
        test.setTimeout(300_000);
        await page.setViewportSize({ width, height: mobile ? 740 : 800 });
        await startHidden(page);
        const cards = await longestCardStates(page, 5);
        const problems: string[] = [];
        const citeUnavoidable = new Set<string>();
        let totalWords = 0;
        for (const { card, state } of cards) {
          await openCardIn(page, state, ui);
          if (ui === 'sheet') await expandSheet(page); // 시트의 안쪽 스크롤 밖 글자도 재도록 세로 제한을 푼다(폭은 그대로)
          if (percent !== 100) await setRootFontPercent(page, percent);
          const label = `${width}px/${percent}%/${ui}/${card.id}`;
          const words = await measureWordBreaks(page, { scope: scopeOf(ui) });
          totalWords += words.checked;
          for (const b of words.broken) problems.push(`${label}: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
          if (percent === 100) for (const u of words.unavoidable) problems.push(`${label}: 글자 100%인데 한 줄보다 긴 낱말 ${describeWordBreak(u)}`);
          for (const i of words.intended) if (!INTENDED_BREAK_WORDS.includes(i.word)) problems.push(`${label}: 의도 목록 밖 낱말이 intended로 셈 ${describeWordBreak(i)}`);
          for (const f of words.forced) problems.push(`${label}: 카드에는 강제 줄바꿈(<br>) 낱말이 없다 ${describeWordBreak(f)}`);
          if (ui !== 'folded') {
            // 17②: 제목(h2)의 낱말은 한 줄보다 긴 것도 없다 — 어떤 폭·글자 크기에서도 낱말 사이에서만 접힌다
            const title = await measureWordBreaks(page, { scope: '.decision__title' });
            expect(title.checked, `${label}: 제목에서 잰 낱말 수`).toBeGreaterThan(0);
            for (const b of [...title.broken, ...title.unavoidable]) problems.push(`${label}: 제목 낱말 끊김 ${describeWordBreak(b)}`);
            // 인용 출처 줄도 따로 센다(영문 원제): 한 줄보다 긴 영문 낱말만 예외인데 이 길이(최장 약 12글자)는 폭 320 · 글자 200%의 시트 내용 폭 안에 든다
            const src = await measureWordBreaks(page, { scope: '.cite__src' });
            for (const b of src.broken) problems.push(`${label}: 출처 줄 낱말 끊김(결함) ${describeWordBreak(b)}`);
            // 관찰 5(REV-003-M7b-1): 인용 박스 안쪽 폭(FACE_BOXES)보다 긴 낱말은 「불가피」로 분류돼 결함으로 안 잡힌다 — 글자 200%에서 그런 낱말이 조용히 늘지 않게 목록을 남긴다(참고, 단언 아님)
            if (percent === 200) for (const u of (await measureWordBreaks(page, { scope: '.cite' })).unavoidable) citeUnavoidable.add(`${card.id}: ${describeWordBreak(u)}`);
          }
        }
        expect(totalWords, '5장에서 잰 낱말 수(공허 통과 방지)').toBeGreaterThan(ui === 'folded' ? 20 : 150);
        expect(problems).toEqual([]);
        if (citeUnavoidable.size > 0) testInfo.annotations.push({ type: '불가피(참고) — 인용 박스 안쪽 폭보다 긴 낱말', description: [...citeUnavoidable].join(' · ') });
      });
    }
  }
}

test('D-58: 「새 기록 N개 · 맨 위로」 알약의 「위로」가 글자 200% × 폭 320·360에서 한 글자씩 끊기지 않는다 (.log__jump, 새 자리 .log__jump-slot — R-438)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 740 });
    await openM4Screen(page, 'dash-adult');
    // 알약은 새 기록이 있을 때만 뜨므로, 같은 클래스로 만든 표본을 새 자리(스크롤 영역 안, 줄 목록 앞의 슬롯)에 붙여 잰다 (CSS 규칙 자체를 본다). 실제 알약은 e2e/log-order.spec.ts "R-438"이 본다
    await page.evaluate((text) => {
      const list = document.querySelector('[data-testid="log-list"]')!;
      const slot = document.createElement('div');
      slot.className = 'log__jump-slot';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--secondary btn--sm log__jump';
      b.dataset.testid = 'jump-sample';
      b.textContent = text;
      slot.appendChild(b);
      list.insertBefore(slot, list.firstChild);
    }, DASH_TEXT.logJump(12));
    for (const percent of [100, 200]) {
      await setRootFontPercent(page, percent);
      const words = await measureWordBreaks(page, { scope: '[data-testid="jump-sample"]' });
      expect(words.checked, `${width}px/${percent}%: 잰 낱말`).toBeGreaterThanOrEqual(3);
      expect(words.broken.map(describeWordBreak), `${width}px/${percent}%`).toEqual([]);
      expect(words.unavoidable.map(describeWordBreak), `${width}px/${percent}%`).toEqual([]);
    }
  }
});

test('측정기 대조: 카드 제목의 글자 크기 상한을 풀면(font-size 고정 96px) 폭 320 · 글자 200%에서 제목 낱말이 끊긴다 — 17② 시험이 실제로 잡는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 740 });
  await startHidden(page);
  const state = await findCardState(page, 'senior-fall'); // 제목 「미끄러진 겨울날」 — 가장 긴 낱말 5음절
  await openCardIn(page, state, 'sheet');
  await setRootFontPercent(page, 200);
  const before = await measureWordBreaks(page, { scope: '.decision__title' });
  expect([...before.broken, ...before.unavoidable].map(describeWordBreak), '상한이 있을 때는 끊김 0').toEqual([]);
  await page.addStyleTag({ content: '.decision__title { font-size: 96px !important; }' });
  const after = await measureWordBreaks(page, { scope: '.decision__title' });
  expect(after.broken.length + after.unavoidable.length, '상한을 풀면 끊긴다').toBeGreaterThan(0);
});
