import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, injectSave, noHorizontalOverflow, withoutPlay } from './helpers';

/**
 * 가족과 삶 카드 개편 (SPEC-009 FM6, FC1~FC10) — 실제 브라우저(Chromium), desktop(1280×800)과 mobile-360 두 프로젝트.
 * 구조·순서·문구·사람 수 일치는 tests/familyCard.test.ts·tests/dashboard.test.tsx(서버 렌더)가 보고, 여기서는 **실제 폭·글자 크기·키보드**를 본다:
 * 가로 넘침 0(360 · 글자 200%), 「더 보기」를 키보드로 여닫기(aria-expanded), 떠난 사람이 글자로 보이는 것, 접이식 근거 칸, 강제 색상에서도 글자가 남는 것, 새로고침을 해도 같은 카드.
 */

const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;

/** 45세까지 첫 선택지로 산 인생에 혼인·자녀·친구 플래그를 켜 둔다(식구가 많이 보이게) — 부모님은 아직 계시거나 떠난 판이 섞여 있다 */
async function adultWithFamily(page: Page, seed: number, gen: string): Promise<GameState> {
  await page.goto('/');
  const s = await evalCore<GameState | null>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.gen)));
     while (s.phase === 'life' && s.age < 45) {
       if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
       else s = core.stepYear(s).state;
     }
     if (s.phase !== 'life' || s.pending !== null) return null;
     const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend'])].sort();
     return { ...s, flags, paused: true };`,
    { seed, gen },
  );
  expect(s, '45세까지 산 인생을 만들지 못했다').not.toBeNull();
  return withoutPlay(s!);
}

async function openCard(page: Page, state: GameState): Promise<void> {
  await injectSave(page, state, '/', MANUAL);
  await expect(page.getByTestId('family-card')).toBeVisible();
}

test('사람 줄: 호칭 · 이름 · 나이 아래에 사이와 직업 줄이 있고 배우자·자녀·친구가 보인다 (FC1·FC5·FC6)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 5, 'genx'));
  const card = page.getByTestId('family-card');
  const text = (await card.innerText()).replace(/\s+/g, ' ');
  expect(text).toMatch(/(아주 가까움|가까움|보통|데면데면함|멀어짐)/);
  await expect(card.getByTestId('family-spouse')).toHaveCount(1);
  expect(await card.getByTestId('family-child').count()).toBeGreaterThanOrEqual(1);
  expect(await card.getByTestId('family-friend').count()).toBeGreaterThanOrEqual(1);
  // 이름은 한글 2~5자 + 「N세」
  const first = await card.getByTestId('family-spouse').locator('.family-who').innerText();
  expect(first).toMatch(/^[가-힣]{2,5} \d+세$/);
  // 신원 카드: 「태어난 곳」과 「지금 사는 곳」이 나뉜다 (FC8)
  const profile = page.getByTestId('profile-card');
  await expect(profile).toContainText('태어난 곳');
  await expect(profile).toContainText('지금 사는 곳');
  await expect(page.getByTestId('profile-now')).toContainText(' · ');
});

test('보이는 사람 줄은 12줄 이하이고 「더 보기」를 키보드(Enter·Space)로 열고 닫는다 — 열면 줄이 늘고 aria-expanded가 바뀐다 (FC1)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 5, 'genx'));
  const card = page.getByTestId('family-card');
  const people = card.locator('dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])');
  const before = await people.count();
  expect(before).toBeLessThanOrEqual(12 + (await card.getByTestId('family-gone').locator('dd').count()));
  const more = card.getByTestId('family-more');
  if ((await more.count()) === 0) test.skip(true, '이 판은 줄이 12줄 이하라 「더 보기」가 없다');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(await people.count()).toBeGreaterThanOrEqual(before);
  await page.keyboard.press('Space');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(await people.count()).toBe(before);
});

test('떠난 가족은 소제목 아래 항상 보이고 「N세에 세상을 떠남」이 글자로 적힌다 — 접지 않는다 (FC4)', async ({ page }) => {
  await page.goto('/');
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed <= 400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'industrial')));
       while (s.phase === 'life' && s.age < 70) {
         if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
         else s = core.stepYear(s).state;
       }
       if (s.phase === 'life' && s.pending === null && core.familyViewOf(s).people.filter((p) => p.state === 'gone').length >= 3) return { ...s, paused: true };
     }
     return null;`,
  );
  expect(s, '떠난 식구가 셋 이상인 70세 인생을 찾지 못했다').not.toBeNull();
  await openCard(page, withoutPlay(s!));
  const gone = page.getByTestId('family-gone');
  await expect(gone).toBeVisible();
  await expect(page.getByTestId('family-card').getByRole('heading', { name: '떠난 가족' })).toBeVisible();
  const text = await gone.innerText();
  expect(text.match(/\d+세에 세상을 떠남|내가 태어나기 전에 세상을 떠남/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  // 취소선·색에만 기대지 않는다: 글자 자체가 정보다
  expect(await gone.locator('dd').first().evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
});

test('접이식 근거 칸 「이 칸은 어떻게 정했나요」: 키보드로 열리고 내부 이름·파일 경로가 없다 (FA0-4)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 11, 'millennial'));
  const basis = page.getByTestId('family-basis');
  const summary = basis.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(basis).toHaveAttribute('open', '');
  const text = await basis.innerText();
  expect(text).toContain('설계값');
  expect(text).not.toMatch(/docs\/|src\/|\.json|\.ts\b|FD\d|FM\d/);
});

test('가로 넘침 0: 지금 폭에서도, 글자 200%에서도, 강제 색상에서도 카드가 넘치지 않고 글자가 남는다 (FC10)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 5, 'genx'));
  expect(await noHorizontalOverflow(page), '기본').toBe(true);
  await page.getByTestId('family-more').click().catch(() => undefined); // 펼친 상태로도 본다(없으면 건너뜀)
  expect(await noHorizontalOverflow(page), '펼침').toBe(true);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await noHorizontalOverflow(page), '글자 200%').toBe(true);
  const card = page.getByTestId('family-card');
  const box = await card.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x + box!.width, '카드가 화면 안에 있다').toBeLessThanOrEqual(vw + 1);
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(card.getByTestId('family-spouse')).toBeVisible();
  expect((await card.innerText()).length).toBeGreaterThan(100);
});

test('새로고침을 여러 번 해도 카드의 이름·나이·사이가 똑같다 (같은 상태 → 같은 식구)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 21, 'g86'));
  const read = async () => (await page.getByTestId('family-card').innerText()).replace(/\s+/g, ' ');
  const first = await read();
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId('family-card')).toBeVisible();
    expect(await read()).toBe(first);
  }
});
