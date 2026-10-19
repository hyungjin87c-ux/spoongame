import { expect, test } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, startPageHidden } from './helpers';
import { sheetReady } from './m7cStates';

/**
 * T1 (e) 스크롤바 폭 밀림 0 (SPEC-003 M7c, content-M7c 7-1절): 데스크톱의 고전 스크롤바(15px)가 시트를 열 때 사라지며 본문이 옆으로 밀리지 않는다 —
 * 훅이 잠그기 **전에 잰** 스크롤바 폭을 `--scrollbar-w`로 걸고 `html.sheet-open { padding-right: var(--scrollbar-w) }`가 그만큼 비운다.
 * Playwright의 헤드리스 크로뮴은 기본으로 `--hide-scrollbars`를 붙여 스크롤바가 없다(폭 0) — 이 파일만 그 인자를 빼서 **진짜 고전 스크롤바**로 잰다.
 * 그래도 폭이 0이면 시험이 공허하므로 실패시킨다(환경이 바뀌었다는 뜻이다).
 */

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const OFF = { speed: 1, autoMode: false, noteCards: false } as const;

test('(e) 시트를 열고 닫는 동안 본문의 위치·폭이 변하지 않는다(1280×800, 고전 스크롤바). 보정(padding-right)을 빼면 밀린다 — 시험이 실제로 잡는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '데스크톱 폭에서만 의미가 있다');
  await page.goto('/');
  await startPageHidden(page);
  await injectSave(page, lifeState(KNOWN_SEED), '/', OFF);
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.style.minHeight = '5000px';
    window.scrollTo(0, 0);
  });
  const metrics = () =>
    page.evaluate(() => {
      const main = document.querySelector('[data-testid="life-screen"] main') as HTMLElement;
      const r = main.getBoundingClientRect();
      return { clientWidth: document.documentElement.clientWidth, innerWidth: window.innerWidth, left: Math.round(r.left * 10) / 10, width: Math.round(r.width * 10) / 10 };
    });
  const before = await metrics();
  const bar = before.innerWidth - before.clientWidth;
  expect(bar, '고전 스크롤바가 폭을 차지한다(공허 통과 방지)').toBeGreaterThan(8);
  await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
  await sheetReady(page);
  const during = await metrics();
  expect(during.left, '열린 동안 본문 왼쪽 위치 불변').toBe(before.left);
  expect(during.width, '열린 동안 본문 폭 불변').toBe(before.width);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-w').trim()), '잠그기 전에 잰 스크롤바 폭').toBe(`${bar}px`);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-sheet')).toHaveCount(0);
  const after = await metrics();
  expect(after, '닫은 뒤 원래대로').toEqual(before);
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '닫으면 잠금이 풀린다').toBe(false);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-w').trim()), '변수도 지운다').toBe('');
  // 변이: 패딩 보정을 빼면 본문이 스크롤바 폭만큼 밀린다
  await page.addStyleTag({ content: 'html.sheet-open { padding-right: 0 !important; }' });
  await expect(page.getByTestId('tool-note'), '시트를 닫은 직후 400ms는 컨트롤 입력 가드(M7c r2 F-1) — 풀린 뒤에 다시 연다').not.toHaveAttribute('aria-disabled', 'true');
  await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
  await sheetReady(page);
  const shifted = await metrics();
  expect(Math.abs(shifted.left - before.left) + Math.abs(shifted.width - before.width), '보정을 빼면 밀린다').toBeGreaterThanOrEqual(bar / 2 - 1);
});
