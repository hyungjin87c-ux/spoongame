import { expect, test, type Page } from '@playwright/test';
import { GAME_KEY } from './saves';
import { openBarState } from './titleStates';
import { measureTextResize, setRootFontPercent } from './textResize';

/**
 * 확인 단계 확정 버튼 (SPEC-003 QM2-6, 마스터 결정 A 「이전 판 지우고 태어나기」). 단위 테스트(tests/titleScreen.test.tsx)가 문구를 보고, 여기서는 실제 화면에서:
 *  - 확인 단계에서 접근 가능한 이름이 「이전 판 지우고 태어나기」이고 「새로 태어나기」라는 이름의 버튼은 없다(방금 누른 버튼과 같은 이름이 남지 않는다).
 *  - 360×740·글자 200%에서 글자가 잘리지 않고 두 줄 이내로 줄바꿈한다.
 * 더블탭 가드(R-204)·포커스 복귀(R-212)는 e2e/first-screen.spec.ts의 기존 테스트가 이 문구로도 계속 본다.
 */

const SHOTS = 'qa/screenshots/003';

/** 버튼 글자가 몇 줄인가(글자 상자 세로 위치의 가짓수)와 잘리는가 */
async function buttonLines(page: Page, testId: string): Promise<{ lines: number; clipped: boolean; text: string }> {
  return page.getByTestId(testId).evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top / 4)));
    const box = el.getBoundingClientRect();
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    // 글자 상자는 글꼴의 줄 높이보다 위아래로 조금 더 커서(약 2px) 세로는 상자 밖으로 보이는 것이 정상이다 — 가로로 나가거나 버튼 안쪽 스크롤 영역이 넘치는 것만 잘림으로 본다
    const outside = rects.some((r) => r.left < box.left - 0.5 || r.right > box.right + 0.5);
    return { lines: tops.size, clipped: outside || el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 4, text: (el.textContent ?? '').trim() };
  });
}

for (const [width, height] of [
  [360, 740],
  [320, 568],
] as const) {
  test.describe(`확정 버튼 ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });
    for (const percent of [100, 200] as const) {
      test(`글자 ${percent}%: 이름 「이전 판 지우고 태어나기」, 「새로 태어나기」 이름의 버튼 없음, 글자 잘림 0·두 줄 이내, 띠 ≤ 화면 절반`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await openBarState(page, 'confirm');
        if (percent !== 100) await setRootFontPercent(page, percent);
        await expect(page.getByRole('button', { name: '이전 판 지우고 태어나기', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '돌아가기', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '새로 태어나기', exact: true }), '확인 단계에는 「새로 태어나기」라는 이름의 버튼이 없다').toHaveCount(0);
        await expect(page.getByTestId('confirm-new-yes')).toHaveAccessibleName('이전 판 지우고 태어나기');
        const yes = await buttonLines(page, 'confirm-new-yes');
        expect(yes.text).toBe('이전 판 지우고 태어나기');
        expect(yes.clipped, '확정 버튼 글자가 잘리지 않는다').toBe(false);
        expect(yes.lines, `확정 버튼 글자 줄 수 ${yes.lines}`).toBeLessThanOrEqual(2);
        const m = await measureTextResize(page);
        expect(m.bar!.ratio, `띠 ${Math.round(m.bar!.height)}px / 화면 ${height}px`).toBeLessThanOrEqual(0.5);
        for (const b of m.buttons) {
          expect(b.height, `${b.id} 높이`).toBeGreaterThanOrEqual(44);
          expect(b.hit, `${b.id} 한가운데에서 눌린다`).toBe(true);
        }
        await expect(page.getByTestId('confirm-new-yes')).toBeEnabled(); // 입력 가드가 풀린 뒤의 모습으로 찍는다
        if (percent === 200) await page.screenshot({ path: `${SHOTS}/dev-M2-r4-qm26-confirm-${width}x${height}-200pct.png` });
        if (percent === 100 && width === 360) await page.screenshot({ path: `${SHOTS}/dev-M2-r4-qm26-confirm-${width}x${height}.png` });
      });
    }
  });
}

test('확정 버튼 「이전 판 지우고 태어나기」를 누르면 이전 판이 지워지고 새 판의 출생 화면으로 간다 (이름이 바뀌어도 동작은 그대로)', async ({ page }, testInfo) => {
  // 이름 점검(REV-003-M2-3 R-235 ①): 예전 이름 「…연타해도 새 판은 하나」는 클릭 한 번만 하는 시험이라 실제와 맞지 않았다. 연타 방어(입력 가드)는 e2e/first-screen.spec.ts의 더블탭 가드(R-204) 테스트가 본다.
  test.skip(testInfo.project.name !== 'desktop', 'desktop에서만 실행');
  await openBarState(page, 'confirm');
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as { data: { phase: string; age: number } } | null, GAME_KEY);
  expect(before?.data.phase, '확정 전에는 진행 중인 판(인생 단계)이 저장돼 있다').toBe('life');
  const yes = page.getByRole('button', { name: '이전 판 지우고 태어나기', exact: true });
  await expect(yes).toBeEnabled();
  await yes.click();
  await expect(page.getByTestId('roulette-screen')).toBeVisible(); // 새 판은 룰렛에서 시작한다(M3)
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as { data: { phase: string; age: number } } | null, GAME_KEY);
  expect(after?.data.phase, '확정하면 새 판(룰렛 단계 — 출생 결과가 정해져 저장된다)으로 바뀌어 저장된다').toBe('roulette');
  expect(after?.data.age).toBe(0);
});
