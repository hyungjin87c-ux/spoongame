import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { findPendingState, injectSave, noHorizontalOverflow, oracleAuto, oracleLife, quietStart, withPlay } from './helpers';
import { measureLineBreaks, type LineReport } from './lineBreaks';
import { setRootFontPercent } from './textResize';

/**
 * 지시 관형사 「이」「그」「저」가 줄 끝에 홀로 남지 않는다 (REV-003-M8-1 관찰 4, designer diff-003 1-7절 D-97·D-98). 줄 끝의 어절이 정확히 「이」「그」「저」인 줄 0을
 * Glue를 거치는 고정 문장 여섯 곳에서 잰다: 첫 화면 FS5 설명(`life-length-hint`)·가상 인구 주석(`population-note`) · 엔딩 플레이 시간 보조 문장(`ending-playtime-note`)·다시 태어나기 안내(`.rebirth p`) ·
 * 나가기 확인 보조 문장(`exit-ask`의 `p.t-sm`) · 영향 안내(`choice-hint`). 폭 320·360 × 글자 100·200%, 넘침 0.
 * 이벤트 서술 줄(D-99 — `log__text`·`tl-text`·결정 시트 결과 문구)은 2차라 이 시험이 보지 않는다. 폭을 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;
const WIDTHS = [320, 360] as const;
const PERCENTS = [100, 200] as const;

/** 한 곳을 재서 위반을 모은다 (공허 통과 방지: 줄이 하나 이상 있어야 한다) */
async function audit(page: Page, label: string, selector: string, problems: string[], tally: { lines: number }): Promise<LineReport> {
  const r = await measureLineBreaks(page, selector, { separators: false, keeps: false, determiners: true });
  expect(r.lineCount, `${label}: 잰 줄이 있다`).toBeGreaterThan(0);
  tally.lines += r.lineCount;
  for (const v of r.violations) problems.push(`${label}: ${v}`);
  if (!(await noHorizontalOverflow(page))) problems.push(`${label}: 가로 넘침`);
  return r;
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    test(`관형사가 줄 끝에 홀로 남지 않는다 — ${width}px · 글자 ${percent}%: 첫 화면 FS5·가상 인구 주석 / 엔딩 플레이 시간 보조·다시 태어나기 안내 / 나가기 확인 보조 / 영향 안내`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '폭을 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 740 });
      const problems: string[] = [];
      const tally = { lines: 0 };
      const at = (name: string) => `${width}px/${percent}% ${name}`;

      // 1. 첫 화면: FS5 설명 · 가상 인구 주석
      await page.goto('/');
      await expect(page.getByTestId('title-screen')).toBeVisible();
      await expect(page.getByTestId('life-length-hint')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await audit(page, at('첫 화면 FS5'), '[data-testid="life-length-hint"]', problems, tally);
      await audit(page, at('가상 인구 주석'), '[data-testid="population-note"]', problems, tally);

      // 2. 엔딩: 플레이 시간 보조 문장(깨끗하지 않은 판 문장까지 길게) · 다시 태어나기 안내
      const ended = await oracleAuto(page, await oracleLife(page, 20261013, 'present'));
      expect(ended.phase).toBe('ending');
      const timed: GameState = withPlay(ended, { hold: 1_800_000, decide: 1_200_000, offSpeed: 5000, skips: 2 });
      await injectSave(page, timed, '/', MANUAL);
      await expect(page.getByTestId('ending-playtime-note')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await audit(page, at('엔딩 플레이 시간 보조'), '[data-testid="ending-playtime-note"]', problems, tally);
      await audit(page, at('다시 태어나기 안내'), '.rebirth p', problems, tally);

      // 3. 인생 화면: 나가기 확인 보조 문장
      await injectSave(page, await quietStart(page, 6), '/', MANUAL);
      await expect(page.getByTestId('life-screen')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await page.getByTestId('tool-exit').click();
      await expect(page.getByTestId('exit-ask')).toBeVisible();
      await audit(page, at('나가기 확인 보조'), '[data-testid="exit-ask"] p.t-sm', problems, tally);

      // 4. 결정 카드: 영향 안내
      await injectSave(page, await findPendingState(page, 'present'), '/', MANUAL);
      await expect(page.getByTestId('choice-hint')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await audit(page, at('영향 안내'), '[data-testid="choice-hint"]', problems, tally);

      expect(tally.lines, '잰 줄 수').toBeGreaterThan(10);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
}
