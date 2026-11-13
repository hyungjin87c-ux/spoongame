import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, injectSave, noHorizontalOverflow, readSettings, withoutPlay } from './helpers';

/**
 * 나이 보기 전환 (SPEC-019): 한국 나이가 기본이고(헤더 「24세」), 알약 오른쪽 글자 버튼으로 만 나이(「만 23세」)로 바꾼다.
 * 한 번 누르면 헤더·인생 기록 줄·가족 카드가 함께 바뀌고, 새로고침해도 유지되며, 키보드로도 조작된다. 통계·게임 결과는 그대로다.
 * desktop(1280×800)과 mobile-360 두 프로젝트에서 돈다 — 360px에서 헤더가 넘치지 않는지도 본다.
 */

const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;

// 45세까지 판을 계산하는 준비가 느려 부하가 있을 때 기본 30초를 넘길 수 있다(준비만 느리고 단언은 짧다)
test.describe.configure({ timeout: 120_000 });

/** 45세까지 첫 선택지로 산 인생에 혼인·자녀·친구 플래그를 켜 둔다(가족 카드에 사람이 많이 보이게 — e2e/family-card.spec.ts와 같은 방법) */
async function adultWithFamily(page: Page): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(5), 'genx')));
     while (s.phase === 'life' && s.age < 45) {
       if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
       else s = core.stepYear(s).state;
     }
     if (s.phase !== 'life' || s.pending !== null) return null;
     const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend'])].sort();
     return { ...s, flags, paused: true };`,
  );
  expect(s, '45세까지 산 인생을 만들지 못했다').not.toBeNull();
  return withoutPlay(s!);
}

async function openLife(page: Page): Promise<GameState> {
  await page.goto('/');
  const start = await adultWithFamily(page);
  const paused: GameState = { ...start, paused: true };
  await injectSave(page, paused, '/', MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  return paused;
}

const ageNumbers = async (page: Page): Promise<number[]> => {
  const texts = await page.locator('.family-who').allTextContents();
  return texts.flatMap((t) => {
    const m = /(\d+)세$/.exec(t.trim());
    return m === null ? [] : [Number(m[1])];
  });
};

test('기본은 한국 나이: 헤더 「N+1세」 · 읽기 이름 「한국 나이 N+1세」 · 전환 버튼 「만 나이」(이름 「만 나이로 보기」) · 누르는 영역 44px · 가로 넘침 0', async ({ page }) => {
  const game = await openLife(page);
  const pill = page.getByTestId('life-age');
  await expect(pill).toHaveText(`${game.age + 1}세`);
  await expect(pill).toHaveAccessibleName(`한국 나이 ${game.age + 1}세`);
  const sw = page.getByTestId('age-switch');
  await expect(sw).toHaveText('만 나이');
  await expect(sw).toHaveAccessibleName('만 나이로 보기');
  // 누르는 영역: 보이는 글자는 작아도 ::before가 위아래로 넓혀 44px (거친 포인터와 상관없이 항상)
  const hit = await sw.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const before = getComputedStyle(el, '::before');
    return { w: r.width, h: Math.max(r.height, parseFloat(before.height) || 0) };
  });
  expect(hit.h).toBeGreaterThanOrEqual(44);
  expect(hit.w).toBeGreaterThanOrEqual(44);
  // 알약 오른쪽(같은 줄이면) 또는 줄바꿈으로 함께 내려간다 — 어느 쪽이든 화면 안이고 넘치지 않는다
  const box = (await sw.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect((await readSettings(page)).ageView).toBe('korean');
});

test('한 번 누르면 헤더·기록 줄·가족 카드가 함께 만 나이로 바뀌고, 새로고침해도 유지되며, 다시 누르면 한국 나이로 돌아온다', async ({ page }) => {
  const game = await openLife(page);
  const lastRowAge = page.getByTestId('log-row').first().locator('.log__age');
  const lastHist = game.history[game.history.length - 1];
  await expect(lastRowAge).toHaveText(`${lastHist.age + 1}세`);
  const koreanFamily = await ageNumbers(page);
  expect(koreanFamily.length, '가족 카드에 나이가 보이는 사람이 있다').toBeGreaterThan(0);

  await page.getByTestId('age-switch').click();
  const pill = page.getByTestId('life-age');
  await expect(pill).toHaveText(`만 ${game.age}세`);
  await expect(pill).toHaveAccessibleName(`만 나이 ${game.age}세`);
  const sw = page.getByTestId('age-switch');
  await expect(sw).toHaveText('한국 나이');
  await expect(sw).toHaveAccessibleName('한국 나이로 보기');
  await expect(lastRowAge).toHaveText(`${lastHist.age}세`); // 목록에는 「만」을 붙이지 않는다
  expect(await ageNumbers(page), '가족 카드의 나이가 모두 한 살씩 줄었다').toEqual(koreanFamily.map((n) => n - 1));
  await expect.poll(async () => (await readSettings(page)).ageView).toBe('man');
  expect(await noHorizontalOverflow(page)).toBe(true);

  // 새로고침 후에도 만 나이
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('life-age')).toHaveText(`만 ${game.age}세`);
  await expect(page.getByTestId('age-switch')).toHaveText('한국 나이');
  expect(await ageNumbers(page)).toEqual(koreanFamily.map((n) => n - 1));

  // 다시 누르면 한국 나이
  await page.getByTestId('age-switch').click();
  await expect(page.getByTestId('life-age')).toHaveText(`${game.age + 1}세`);
  await expect.poll(async () => (await readSettings(page)).ageView).toBe('korean');
});

test('키보드로 조작된다: 버튼에 포커스를 두고 Enter · Space로 전환하고, 전환 뒤에도 포커스가 버튼에 남으며 포커스 표시가 보인다', async ({ page }) => {
  const game = await openLife(page);
  const sw = page.getByTestId('age-switch');
  await sw.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('life-age')).toHaveText(`만 ${game.age}세`);
  await expect(sw).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('life-age')).toHaveText(`${game.age + 1}세`);
  await expect(sw).toBeFocused();
  const outline = await sw.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

test('이름이 길어도 헤더가 넘치지 않는다: 알약과 버튼이 이름 아래로 함께 내려가거나 한 줄에 놓이고, 두 기준 모두 가로 넘침 0', async ({ page }) => {
  await openLife(page);
  // 가장 긴 이름을 흉내 낸다: 이름 글자만 바꾼다(저장 검증이 이름 풀을 보므로 저장은 건드리지 않는다). 전환으로 헤더가 다시 그려져도 이름 글자는 React가 건드리지 않는다
  await page.getByTestId('life-name').evaluate((el) => {
    el.textContent = '가나다라마바사아자차';
  });
  expect(await noHorizontalOverflow(page)).toBe(true);
  await page.getByTestId('age-switch').click(); // 「한국 나이」 글자가 더 길고 알약은 「만 N세」가 된다
  await expect(page.getByTestId('age-switch')).toHaveText('한국 나이');
  expect(await noHorizontalOverflow(page)).toBe(true);
  const head = (await page.getByTestId('dash-head').boundingBox())!;
  for (const id of ['life-name', 'life-age', 'age-switch']) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.x, id).toBeGreaterThanOrEqual(head.x - 1);
    expect(b.x + b.width, id).toBeLessThanOrEqual(head.x + head.width + 1);
  }
});
