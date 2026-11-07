import { expect, test } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { injectSave } from './helpers';
import { MANUAL, findDelegatedYear, showParentCard } from './parentStates';

/**
 * 부모 결정 도장의 주어 (SPEC-011 DS1·DS2, 완료 기준 19·20·22): 한 분만 함께 사는 해에는 「부모님이」 대신 「어머니가/아버지가」 — 카드의 칩·도장·첫 카드 안내, 인생 기록 줄, 엔딩 연표.
 * 줄마다 **그 줄 나이**에 함께 사는 부모가 주어다(두 분이었다가 한 분이 된 판의 옛 줄은 「부모님이」). v0.4.0이 낸 실제 저장 원문(tests/fixtures/save-v040-*.json — `scripts/genSaveFixtures040.ts`)을 열어도 같다.
 * 엔딩의 「어린 시절의 큰 결정 가운데 N번은 …」 요약 문장은 형진 님 요청으로 없앴다(2026-11-08).
 */

test.describe.configure({ timeout: 120_000 });

/** v0.4.0 저장 원문 고정 파일(tests/fixtures/save-v040-*.json)의 게임 상태 — e2e 타입 설정에는 Node 타입이 없어 `node:fs`를 동적으로 불러 읽는다(m3-css-fallback.spec.ts와 같다) */
async function fixture(name: string): Promise<GameState> {
  const nodeFs = 'node:fs';
  const fs = (await import(nodeFs)) as { readFileSync(path: string, encoding: 'utf-8'): string };
  return (JSON.parse(fs.readFileSync(`tests/fixtures/save-v040-${name}.json`, 'utf-8')) as { data: GameState }).data;
}
const WHO = { mother: '어머니가', father: '아버지가', both: '부모님이' } as const;

test.describe('한 분만 함께 사는 해의 부모 결정 카드 (DS2 ① ⑤)', () => {
  for (const subject of ['mother', 'father'] as const) {
    test(`${subject === 'mother' ? '어머니만' : '아버지만'}: 칩 · 도장 · 첫 카드 안내가 「${WHO[subject]}」이고 「부모님이」 도장은 없다`, async ({ page }) => {
      await page.goto('/');
      const y = await findDelegatedYear(page, { by: 'parent', subject, era: 'alpha', minAge: 3 });
      // 안내 한 줄은 판의 첫 부모 카드에만 붙는다 — 앞선 부모 결정 줄을 빼고 심어 이 카드가 첫 카드가 되게 한다(주어는 가족 계획과 나이가 정하므로 같다)
      const start: GameState = { ...y.start, history: y.start.history.filter((h) => h.by !== 'parent') };
      await showParentCard(page, { ...y, start }, { timescale: 8 });
      const who = WHO[subject];
      const noun = who.slice(0, 3);
      await expect(page.getByTestId('parent-chip')).toHaveText(`${noun}의 결정`);
      await expect(page.getByTestId('parent-stamp')).toHaveText(`${who} 이렇게 정했습니다`);
      await expect(page.getByTestId('parent-hint')).toHaveText(`어린 시절의 큰 결정은 ${who} 내립니다. 열세 살부터는 공부·친구·취미를 직접 고릅니다.`);
      const card = page.getByTestId('parent-card');
      await expect(card).not.toContainText('부모님이 이렇게');
      await expect(card).not.toContainText('부모님의 결정');
      // 기록 줄도 같은 주어
      await expect(page.getByTestId('log').getByText(`${who} 이렇게 정했습니다: ${y.label}`).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  }
});

test.describe('v0.4.0 저장을 열면 줄의 나이로 바른 주어 (DS4)', () => {
  test('어머니만 계신 판(아버지가 5세에 떠남): 1·5세 줄은 「부모님이」(떠난 해까지 두 분), 12·18세 줄은 「어머니가」', async ({ page }) => {
    const save = await fixture('mother-age20');
    await injectSave(page, save, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const stamps = await page.locator('[data-testid="log-by"][data-by="parent"]').allInnerTexts();
    const lines = save.history.filter((h) => h.kind === 'choice' && h.by === 'parent');
    expect(stamps).toHaveLength(lines.length);
    const golden: Record<number, keyof typeof WHO> = { 1: 'both', 5: 'both', 12: 'mother', 18: 'mother' };
    for (const h of lines) {
      await expect(page.getByTestId('log').getByText(`${WHO[golden[h.age]]} 이렇게 정했습니다: ${h.choice}`).first()).toBeVisible();
    }
    expect(stamps.filter((t) => t.includes('어머니가 이렇게 정했습니다')).length).toBe(2);
    expect(stamps.filter((t) => t.includes('부모님이 이렇게 정했습니다')).length).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('무거운 장면 가리기를 켜도 가린 줄의 도장이 그 해의 주어다 (5세 입원 줄은 떠난 해라 「부모님이」)', async ({ page }) => {
    await injectSave(page, await fixture('mother-age20'), '/', { ...MANUAL, gentle: true });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const veiled = await page.locator('[data-testid="veil-by"][data-by="parent"]:visible').allInnerTexts();
    expect(veiled.length).toBeGreaterThan(0);
    for (const t of veiled) expect(t).toMatch(/부모님이 이렇게 정했습니다|어머니가 이렇게 정했습니다/);
    expect(veiled.some((t) => t.includes('부모님이'))).toBe(true);
  });

  test('아버지만 계신 판의 엔딩(어머니가 3세에 별세, parents_gone 켜짐): 연표 줄은 줄마다 그 해의 주어이고 요약 문장은 없다', async ({ page }) => {
    const save = await fixture('father-ended');
    await injectSave(page, save, '/', MANUAL);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    const golden: Record<number, keyof typeof WHO> = { 0: 'both', 3: 'both', 7: 'father', 12: 'father' };
    const lines = save.history.filter((h) => h.kind === 'choice' && h.by === 'parent');
    const picked = await page.locator('[data-testid="timeline-picked"][data-by="parent"]').allInnerTexts();
    expect(picked).toEqual(lines.map((h) => `${WHO[golden[h.age]]} 이렇게 정했습니다: ${h.choice}`));
    await expect(page.getByTestId('ending-delegated')).toHaveCount(0);
    await expect(page.getByTestId('ending-screen')).not.toContainText('큰 결정 가운데');
    await expect(page.getByTestId('ending-choices')).toContainText('번의 선택을 했습니다');
  });
});
