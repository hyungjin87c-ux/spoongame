import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { ASK_UNKNOWN_IMPACT_TEXT } from '../src/data/askTable';
import { evalCore, injectSave, readSave, withoutPlay } from './helpers';
import { CARD_UI_STATES, openCardIn, startHidden } from './m7bCards';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 조르기 카드 화면 (SPEC-011 AK8, 완료 기준 9·11): 지금의 선택 카드(모달 시트 · 자동 모드 인라인)를 그대로 쓴다.
 *  - 조른다·떼를 쓴다에는 영향 줄 대신 고정 한 줄 「들어주실지는 알 수 없습니다」, 참는다에는 지금의 영향 줄(행복 ▼). 새 화면·새 줄 종류 없음.
 *  - 360·320px × 글자 100·200%에서 겹침·넘침 0 (고정 한 줄이 선택지 상자 안에 있고 라벨과 겹치지 않는다).
 *  - 선택 한 번이 한 번만 해결되고 새로고침 뒤에도 같은 카드·같은 결과다(완료 기준 4).
 * 실제 사건 7개(src/data/events/ask.json)를 쓴다 — 시대마다 한 장이 걸리도록 여러 세대에서 찾는다. 반려동물 사건은 스위치가 꺼져 없다.
 */

const ERAS = ['industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha'] as const;

/** 조르기 카드가 대기 중인 실제 상태를 사건 id마다 하나씩 (앱 페이지가 열려 있어야 한다) */
async function askStates(page: Page): Promise<Array<{ id: string; state: GameState }>> {
  const found = await evalCore<Record<string, GameState>>(
    page,
    `const out = {};
     for (const era of arg.eras) {
       for (let seed = 1; seed < 160; seed++) {
         const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), era)));
         const s = core.advanceUntilDecision(s0, undefined, 'consume').state;
         if (s.phase === 'life' && s.pending && s.pending.eventId.startsWith('ask-') && out[s.pending.eventId] === undefined) out[s.pending.eventId] = s;
       }
     }
     return out;`,
    { eras: [...ERAS] },
  );
  return Object.entries(found).map(([id, state]) => ({ id, state: withoutPlay(state) }));
}

test('조르기 카드는 시트·인라인 모두 라벨 셋 + 고정 한 줄(조른다·떼를 쓴다) + 영향 줄(참는다)이다 — 사건 7개 전부', async ({ page }) => {
  test.setTimeout(240_000);
  await startHidden(page);
  const states = await askStates(page);
  expect(states.map((s) => s.id).sort(), '장난감 4 + 예체능 3 (반려동물은 꺼짐)').toEqual(['ask-lessons-a', 'ask-lessons-b', 'ask-lessons-c', 'ask-toy-a', 'ask-toy-b', 'ask-toy-c', 'ask-toy-d']);
  for (const { id, state } of states) {
    for (const ui of ['sheet', 'inline'] as const) {
      await openCardIn(page, state, ui);
      const where = `${id}/${ui}`;
      await expect(page.getByTestId('choice-beg'), where).toContainText('조른다');
      await expect(page.getByTestId('choice-tantrum'), where).toContainText('떼를 쓴다');
      await expect(page.getByTestId('choice-endure'), where).toContainText('참는다');
      for (const c of ['beg', 'tantrum']) {
        await expect(page.getByTestId(`choice-${c}`).getByTestId('impact-fixed'), `${where}/${c}`).toHaveText(ASK_UNKNOWN_IMPACT_TEXT);
        await expect(page.getByTestId(`choice-${c}`).getByTestId('impact'), `${where}/${c} 영향 줄 없음`).toHaveCount(0);
      }
      await expect(page.getByTestId('choice-endure').getByTestId('impact-fixed')).toHaveCount(0);
      await expect(page.getByTestId('choice-endure').getByTestId('impact')).toHaveCount(1);
      await expect(page.getByTestId('choice-endure').locator('[data-key="happiness"][data-direction="down"]')).toHaveCount(1);
    }
  }
});

test('선택 한 번은 한 번만 해결된다: 조른다를 더블클릭해도 연표에 조르기 결과 줄이 하나이고 새로고침 뒤에도 같다 (결정론 — 해시)', async ({ page }) => {
  test.setTimeout(120_000);
  await startHidden(page);
  const [first] = await askStates(page);
  await openCardIn(page, first.state, 'sheet');
  const key = (await page.getByTestId('choice-panel').getAttribute('data-key'))!;
  await page.getByTestId('choice-beg').dblclick();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  const save = (await readSave(page)).data;
  const lines = save.history.filter((h) => h.kind === 'choice' && h.eventId === first.id);
  expect(lines, '조르기 결과 줄 한 줄').toHaveLength(1);
  expect(lines[0].choice).toBe('조른다');
  expect(lines[0].by).toBeUndefined();
  // 코어 기대값과 같은 결과 (같은 상태 · 같은 선택 → 같은 결과)
  const expected = await evalCore<GameState>(page, 'return core.resolveChoice(arg.state, arg.key, "beg");', { state: first.state, key });
  expect(lines[0].text).toBe(expected.history.filter((h) => h.kind === 'choice' && h.eventId === first.id)[0].text);
});

test('새로고침을 연타해도 같은 조르기 카드가 같은 키로 다시 뜬다 (pending 저장 · 완료 기준 4·12)', async ({ page }) => {
  test.setTimeout(120_000);
  await startHidden(page);
  const [first] = await askStates(page);
  await openCardIn(page, first.state, 'sheet');
  const key = (await page.getByTestId('choice-panel').getAttribute('data-key'))!;
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-key', key);
    await expect(page.getByTestId('choice-beg').getByTestId('impact-fixed')).toBeVisible();
  }
  const save = (await readSave(page)).data;
  expect(save.pending?.key).toBe(key);
  expect(save.history.some((h) => h.kind === 'choice' && h.eventId === first.id)).toBe(false);
});

/** 고정 한 줄이 선택지 상자 안에 있고 라벨·번호와 겹치지 않으며 가로로 넘치지 않는지 잰다 */
async function fixedLineGeometry(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const id of ['beg', 'tantrum']) {
      const choice = document.querySelector(`[data-testid="choice-${id}"]`) as HTMLElement | null;
      const fixed = choice?.querySelector('[data-testid="impact-fixed"]') as HTMLElement | null;
      const label = choice?.querySelector('.choice__label') as HTMLElement | null;
      if (choice === null || fixed === null || label === null) {
        problems.push(`${id}: 선택지·고정 한 줄·라벨이 없다`);
        continue;
      }
      const c = choice.getBoundingClientRect();
      const f = fixed.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      if (f.left < c.left - 0.5 || f.right > c.right + 0.5 || f.bottom > c.bottom + 0.5 || f.top < c.top - 0.5) problems.push(`${id}: 고정 한 줄이 선택지 상자 밖이다 (${Math.round(f.left)}~${Math.round(f.right)} / ${Math.round(c.left)}~${Math.round(c.right)})`);
      if (f.top < l.bottom - 0.5) problems.push(`${id}: 고정 한 줄이 라벨과 겹친다 (줄 top ${Math.round(f.top)} < 라벨 bottom ${Math.round(l.bottom)})`);
      if (fixed.scrollWidth > fixed.clientWidth + 1) problems.push(`${id}: 고정 한 줄이 가로로 잘린다 (${fixed.scrollWidth} > ${fixed.clientWidth})`);
    }
    return problems;
  });
}

for (const width of [320, 360] as const) {
  for (const percent of [100, 200] as const) {
    for (const ui of CARD_UI_STATES.filter((u) => u !== 'folded')) {
      test(`${width}px · 글자 ${percent}% · ${ui}: 조르기 카드 — 가로 넘침 0·글자 잘림 0, 고정 한 줄이 선택지 안에서 라벨과 겹치지 않는다 (본문이 가장 긴 사건 포함)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(240_000);
        await page.setViewportSize({ width, height: width === 320 ? 568 : 740 });
        await startHidden(page);
        const states = await askStates(page);
        // 본문이 가장 긴 사건(ask-lessons-a 70자)과 이름이 긴 사건 둘, 짧은 사건 하나
        const picks = ['ask-lessons-a', 'ask-lessons-c', 'ask-toy-d', 'ask-toy-a'].map((id) => states.find((s) => s.id === id)).filter((s): s is { id: string; state: GameState } => s !== undefined);
        expect(picks.length, '고른 사건 상태').toBeGreaterThanOrEqual(3);
        const problems: string[] = [];
        for (const { id, state } of picks) {
          await openCardIn(page, state, ui);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const label = `${width}px/${percent}%/${ui}/${id}`;
          problems.push(...textResizeViolations(await measureTextResize(page), label));
          problems.push(...(await fixedLineGeometry(page)).map((p) => `${label}: ${p}`));
        }
        expect(problems).toEqual([]);
      });
    }
  }
}

test('화면 밖 입력: 조르기 카드가 뜬 채 자동 모드를 켜면 인라인으로 풀리고 연표에 조르기 줄이 남는다 (자동 모드 — 기대 효과 가중)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const [first] = await askStates(page);
  await injectSave(page, first.state, '/?__timescale=200', { speed: 1, autoMode: true, noteCards: false });
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(async () => (await readSave(page)).data.history.some((h) => h.kind === 'choice' && h.eventId === first.id), { timeout: 60_000 }).toBe(true);
});
