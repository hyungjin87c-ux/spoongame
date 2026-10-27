import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, injectSave, noHorizontalOverflow, startPageHidden } from './helpers';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 은퇴 뒤 다시 일하는 또래의 라벨 「다시 일하는 사람」 (SPEC-003 M7e-3, 마스터 결정 E-7, planner content-M7e.md 3-3절): 상태 키는 working 그대로이고 표시만 나뉜다.
 * 대시보드 「같은 해 태어난 사람들」 칸의 라벨 칩이 360×740·320×568 × 글자 100·150·200%에서 잘리지 않고, 낱말 중간에서 끊기지 않는지 본다.
 * 수저별 복귀 비율 측정은 dev 로그(ai-log/2026-10-18_SPEC-003_dev-M7e-3.md)에 있다 — 이 파일은 화면을 본다.
 */

const RETURN = '다시 일하는 사람';
const SHOT = 'qa/screenshots/003/dev-M7e-3-peers-return';

/** 나이 age(≥ 70)까지 자동 진행한 판 중 또래 넷 가운데 「다시 일하는 사람」이 있는 상태를 찾는다 (앱 페이지가 열려 있어야 한다) */
async function findReturnState(page: Page): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       for (let g = 0; s.phase === 'life' && g < 4000; g++) {
         if (s.age >= 76 && s.pending === null) break;
         s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
       }
       if (s.phase !== 'life' || s.age < 76) continue;
       const peers = core.peersNow(s);
       if (peers.some((p) => p.label === arg.label) && peers.some((p) => p.label !== arg.label)) return s;
     }
     return null;`,
    { label: RETURN },
  );
  expect(found, '또래 가운데 「다시 일하는 사람」과 다른 모습이 함께 있는 76세 상태를 찾지 못했다').not.toBeNull();
  return found!;
}

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;

test('다시 일하는 사람: 또래 칸의 라벨이 core의 peersNow와 같고(상태 키 working), 320×568·360×740 × 글자 100·150·200%에서 잘림·가로 넘침·낱말 끊김이 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(180_000);
  await startPageHidden(page);
  await page.goto('/');
  const state = await findReturnState(page);
  const expected = await page.evaluate<Array<{ label: string; status: string }>>(`(async () => {
    const core = await import('/src/core/index.ts');
    await (await import('/src/data/gameData.ts')).loadGameData(); // MG8: 지연 로드 덩어리를 먼저 불러온다
    return core.peersNow(${JSON.stringify(state)}).map((p) => ({ label: p.label, status: p.status }));
  })()`);
  expect(expected.map((p) => p.label)).toContain(RETURN);
  // 라벨만 바뀌고 상태 키는 working 그대로다
  for (const p of expected) if (p.label === RETURN) expect(p.status).toBe('working');

  for (const size of SIZES) {
    for (const percent of [100, 150, 200] as const) {
      const label = `${size.width}x${size.height}/${percent}%`;
      await page.setViewportSize(size);
      await injectSave(page, state, '/', { speed: 1, autoMode: false });
      await expect(page.getByTestId('peers-now-card')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      await expect(page.getByTestId('peer-now-label'), label).toHaveText(expected.map((p) => p.label));
      expect(textResizeViolations(await measureTextResize(page), label), label).toEqual([]);
      expect(await noHorizontalOverflow(page), `${label} 가로 넘침`).toBe(true);
      // 라벨 칩이 칸 안에 온전히 들어간다
      const chip = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="peers-now-card"]')!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>('[data-testid="peer-now-label"]')].map((el) => {
          const b = el.getBoundingClientRect();
          return { text: el.textContent ?? '', overflow: el.scrollWidth - el.clientWidth, outside: b.right > card.right + 0.5 || b.left < card.left - 0.5 };
        });
      });
      for (const c of chip) {
        expect(c.overflow, `${label} 「${c.text}」 잘림`).toBeLessThanOrEqual(1);
        expect(c.outside, `${label} 「${c.text}」 칸 밖`).toBe(false);
      }
      const words = await measureWordBreaks(page, { scope: '[data-testid="peers-now-card"]' });
      expect(words.checked, `${label} 잰 낱말 수`).toBeGreaterThan(10);
      expect(words.broken.map(describeWordBreak), `${label} 낱말 끊김`).toEqual([]);
      if (size.width === 360 && (percent === 200 || percent === 100)) await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' }); // 증거 화면에서 고정 띠가 칸을 가리지 않게
      if (size.width === 360 && percent === 200) {
        await page.getByTestId('peers-now-card').scrollIntoViewIfNeeded();
        await page.getByTestId('peers-now-card').screenshot({ path: `${SHOT}-360-200.png` });
      }
      if (size.width === 360 && percent === 100) {
        await page.getByTestId('peers-now-card').scrollIntoViewIfNeeded();
        await page.getByTestId('peers-now-card').screenshot({ path: `${SHOT}-360.png` });
      }
    }
  }
});

test('다시 일하는 사람: 넓은 화면에서도 칩이 한 줄로 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop에서만 실행');
  test.setTimeout(120_000);
  await startPageHidden(page);
  await page.goto('/');
  const state = await findReturnState(page);
  await injectSave(page, state, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('peers-now-card')).toBeVisible();
  await expect(page.getByTestId('peer-now-label').filter({ hasText: RETURN }).first()).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});
