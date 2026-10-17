import { expect, test, type Page } from '@playwright/test';
import { M3_SCREENS, mainButtonOf, openM3Screen, stillSpinning, type M3Screen } from './m3States';
import { barViolations, measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 룰렛·출생신고 화면의 글자 확대·리플로 (SPEC-003 CM11, QM2-3 완료 기준 a·c, QM2-12 — M3 마일스톤의 완료 조건). e2e/text-resize.spec.ts와 같은 측정(e2e/textResize.ts)을 새 화면에 적용한다.
 * (가) 루트 글자 100·125·150·175·200% × 폭·높이 320×568·360×740 × 라이트·다크 × 화면 3상태(룰렛 회전 중·룰렛 결과·출생신고): 가로 넘침 0px, 글자 잘림 0,
 *      하단 띠 버튼 높이 ≥ 44px·눌림, 고정된 띠 ≤ 화면 높이의 50%(넘으면 고정이 풀려 본문 끝에 놓인다 — QM2-12).
 * (나) 브라우저 확대 상당 뷰포트 640×400·512×384·320×256과 접이식 폰 280×653: 가로 넘침 0, 띠 규칙.
 * QM2-12: 공통 뷰포트 11종 × 글자 100·200% × 3상태에서 띠가 「고정이면 ≤ 절반, 절반을 넘으면 해제」 규칙을 지킨다.
 * 출생신고는 가장 긴 내용 표본(흙수저·다이아몬드수저·지난 세상·다가올 세상, e2e/m3Variants.ts)도 같은 조합으로 잰다(REV-003-M3-1 R-262) — 폭 320·글자 200%에서 가장 긴 장소·직업·주거·형제 순서·하단 표기가 넘치거나 잘리지 않는다.
 * 룰렛 회전 중은 연출이 5.4초에 끝나므로 측정 앞뒤에 아직 회전 중인지 확인한다(끝났으면 거짓 통과를 막으려 실패시킨다).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const PERCENTS = [100, 125, 150, 175, 200] as const;
const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;

/** 한 화면 상태를 재고 위반 목록을 돌려준다 */
async function violationsOf(page: Page, screen: M3Screen, label: string): Promise<{ problems: string[]; fixed: boolean; ratio: number }> {
  const m = await measureTextResize(page);
  if (screen === 'roulette-spin') expect(await stillSpinning(page), `${label}: 측정 중에 연출이 끝났다(느린 환경) — 거짓 통과를 막기 위해 실패`).toBe(true);
  const main = m.buttons.find((b) => b.id === mainButtonOf(screen));
  expect(main, `${mainButtonOf(screen)}가 띠에 있다`).toBeDefined();
  return { problems: [...textResizeViolations(m, label), ...barViolations(m, label)], fixed: m.bar?.fixed ?? false, ratio: m.bar?.ratio ?? 0 };
}

for (const size of SIZES) {
  test.describe(`M3 글자 확대 ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    for (const scheme of ['light', 'dark'] as const) {
      for (const percent of PERCENTS) {
        for (const screen of M3_SCREENS) {
          test(`(가) ${size.width}x${size.height} · 글자 ${percent}% · ${scheme} · ${screen}: 가로 넘침 0px·글자 잘림 0·띠 버튼 ≥ 44px·띠 ≤ 화면 절반`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
            await page.emulateMedia({ colorScheme: scheme });
            await openM3Screen(page, screen);
            await setRootFontPercent(page, percent);
            const label = `${size.width}x${size.height}/${percent}%/${scheme}/${screen}`;
            const r = await violationsOf(page, screen, label);
            expect(r.problems).toEqual([]);
            testInfo.annotations.push({ type: 'bar', description: `${r.fixed ? '고정' : '해제'} ${(r.ratio * 100).toFixed(0)}%` });
          });
        }
      }
    }
  });
}

/** (나) 브라우저 확대 상당 뷰포트 + 접이식 폰 280px */
for (const [name, width, height] of [
  ['1280 창의 200% = 640x400', 640, 400],
  ['1024 창의 200% = 512x384', 512, 384],
  ['1280 창의 400% = 320x256', 320, 256],
  ['접이식 폰 280x653 (글자 100%)', 280, 653],
] as const) {
  test.describe(`M3 리플로 ${name}`, () => {
    test.use({ viewport: { width, height } });
    for (const screen of M3_SCREENS) {
      test(`(나) ${name} · ${screen}: 가로 넘침 0px·글자 잘림 0, 띠 규칙(고정이면 ≤ 절반, 넘으면 해제), 「${mainButtonOf(screen)}」가 화면에 보이고 눌린다`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await openM3Screen(page, screen);
        const r = await violationsOf(page, screen, `${width}x${height}/${screen}`);
        expect(r.problems).toEqual([]);
        const m = await measureTextResize(page);
        const main = m.buttons.find((b) => b.id === mainButtonOf(screen))!;
        expect(main.hit).toBe(true);
        expect(main.inViewport).toBe(true);
        expect(main.height).toBeGreaterThanOrEqual(44);
        testInfo.annotations.push({ type: 'bar', description: `${screen}: 띠 ${Math.round(m.bar!.height)}px / 화면 ${height}px — ${m.bar!.fixed ? '고정' : '해제'}` });
      });
    }
  });
}

// ---------- QM2-12: 낮은 화면에서 하단 띠 — 절반을 넘으면 고정을 푼다 ----------

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M3 하단 띠 규칙 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of [100, 200] as const) {
      for (const screen of M3_SCREENS) {
        test(`${vp.name} · 글자 ${percent}% · ${screen}: 띠가 고정이면 높이 ≤ 화면 절반이고, 절반을 넘으면 고정이 풀려 본문 끝에 겹침 없이 놓인다 (QM2-12)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          await openM3Screen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const r = await violationsOf(page, screen, `${vp.name}/${percent}%/${screen}`);
          expect(r.problems).toEqual([]);
          // 판정 일치: 띠가 화면 절반을 넘으면 해제, 아니면 고정 (barViolations가 같은 규칙을 양방향으로 본다 — 여기서는 주석으로 결과를 남긴다)
          expect(r.fixed, `띠 ${(r.ratio * 100).toFixed(0)}%`).toBe(r.ratio <= 0.5 + 1e-6);
          testInfo.annotations.push({ type: 'bar', description: `${r.fixed ? '고정' : '해제'} ${(r.ratio * 100).toFixed(0)}%` });
        });
      }
    }
  });
}
