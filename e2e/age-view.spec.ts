import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, injectSave, noHorizontalOverflow, readSettings, withoutPlay } from './helpers';

/**
 * 나이 표시 (SPEC-019 r2): 사람 나이는 모든 화면에서 한국 나이(게임 나이 + 1)이고, 인생 화면 헤더의 알약(「24세」) 옆에만 작은 글자 「만 23세」가 늘 붙는다.
 * 전환 버튼도 설정도 없다 — 새로고침해도 같다. desktop(1280×800)과 mobile-360 두 프로젝트에서 돈다. 360px에서 헤더가 넘치지 않는지(이름이 긴 경우 포함)도 본다.
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


test('헤더: 알약은 한국 나이 「N+1세」, 옆에 작은 「만 N세」, 읽기 이름은 한 번에 「한국 나이 N+1세, 만 N세」 · 전환 버튼 없음 · 가로 넘침 0', async ({ page }) => {
  const game = await openLife(page);
  await expect(page.getByTestId('life-age')).toHaveText(`${game.age + 1}세`);
  const man = page.getByTestId('life-age-man');
  await expect(man).toHaveText(`만 ${game.age}세`);
  const group = page.locator('.who__ages');
  await expect(group).toHaveAccessibleName(`한국 나이 ${game.age + 1}세, 만 ${game.age}세`);
  // 버튼이 아니다: 머리글 안에 나이 전환 버튼·링크가 없고, 누른다고 바뀌는 것이 없다
  await expect(page.getByTestId('age-switch')).toHaveCount(0);
  await expect(page.getByTestId('dash-head').getByRole('button', { name: /나이/ })).toHaveCount(0);
  await man.click({ force: true });
  await expect(page.getByTestId('life-age')).toHaveText(`${game.age + 1}세`);
  await expect(man).toHaveText(`만 ${game.age}세`);
  // 작은 글자(보조 글): 알약 숫자보다 작다
  const sizes = await page.evaluate(() => {
    const px = (id: string) => parseFloat(getComputedStyle(document.querySelector(`[data-testid="${id}"] b, [data-testid="${id}"]`)!).fontSize);
    return { pill: px('life-age'), man: px('life-age-man') };
  });
  expect(sizes.man).toBeLessThan(sizes.pill);
  // 화면 안, 가로 넘침 0
  const box = (await man.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('목록의 나이는 모두 한국 나이이고 「만」이 붙지 않는다: 인생 기록 줄 · 가족 카드', async ({ page }) => {
  const game = await openLife(page);
  const lastHist = game.history[game.history.length - 1];
  await expect(page.getByTestId('log-row').first().locator('.log__age')).toHaveText(`${lastHist.age + 1}세`);
  expect((await ageNumbers(page)).length, '가족 카드에 나이가 보이는 사람이 있다').toBeGreaterThan(0);
  const body = await page.getByTestId('life-screen').innerText();
  expect(body.match(/만\s*\d+세/g) ?? [], '「만 N세」는 헤더 한 곳뿐').toHaveLength(1);
});

test('새로고침해도 같다: 한국 나이 + 작은 만 나이, 설정에는 나이 칸이 없다', async ({ page }) => {
  const game = await openLife(page);
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('life-age')).toHaveText(`${game.age + 1}세`);
  await expect(page.getByTestId('life-age-man')).toHaveText(`만 ${game.age}세`);
  expect('ageView' in (await readSettings(page))).toBe(false);
});

test('이름이 길어도 헤더가 넘치지 않는다: 알약 묶음이 이름 아래로 내려가거나 한 줄에 놓인다', async ({ page }) => {
  await openLife(page);
  // 가장 긴 이름을 흉내 낸다: 이름 글자만 바꾼다(저장 검증이 이름 풀을 보므로 저장은 건드리지 않는다)
  await page.getByTestId('life-name').evaluate((el) => {
    el.textContent = '가나다라마바사아자차';
  });
  expect(await noHorizontalOverflow(page)).toBe(true);
  const head = (await page.getByTestId('dash-head').boundingBox())!;
  for (const id of ['life-name', 'life-age', 'life-age-man']) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.x, id).toBeGreaterThanOrEqual(head.x - 1);
    expect(b.x + b.width, id).toBeLessThanOrEqual(head.x + head.width + 1);
  }
});
