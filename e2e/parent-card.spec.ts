import { expect, test } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { holdMsFor } from '../src/core/timing';
import { activeTestId, evalCore, injectSave, oracleDecision, readSave, withoutPlay, type InjectedSettings } from './helpers';
import { MANUAL, findDelegatedYear, focusPauseAfterEntry } from './parentStates';

/**
 * T8 화면 (SPEC-005 PD5·PD7, 설계 문서 3-2·5절): 부모님이 정한·아이의 일로 흘러간 해의 비모달 카드.
 * 카드는 그 해의 결과 연출 대기 동안만 인생 기록 바로 위에 뜨고, 버튼·시트·낭독 영역이 없고 포커스를 가져가지 않는다. 일시정지하면 그 자리에 머물고, 8배속에서는 스치며 기록 줄이 남고,
 * 새로고침(연타 포함)하면 카드는 다시 뜨지 않고 같은 인생·같은 기록 줄 하나만 남는다. 「다음 결정으로」는 부모·흘러감 해를 지나 다음 본인 결정 앞에서 멈춘다.
 * 개발 서버 전용 탐침 `?__timescale=N`으로 연출을 N배 빠르게 한다(카드는 1배속에서 22~44초 — 기본 결과 대기 21.94초(계수 1.6875, SPEC-005 LM7b) 이상 — N = 5면 4.4~8.8초라 단언할 틈이 있다).
 */

const TS = '/?__timescale=5';

// 카드 한 장의 연출 대기는 1배속에서 22~44초(기본 결과 대기 21.94초와 느린 독자 기준 필요량 중 긴 쪽)라 `__timescale=5`여도 4.4~8.8초가 걸린다 — 시작·주입·단언을 합치면 기본 30초 제한을 넘는다
test.describe.configure({ timeout: 120_000 });

test.describe('부모님이 정한 해: 비모달 카드 (PD5·PD7)', () => {
  test('카드가 인생 기록 바로 위에 뜬다: 칩·제목·고른 길·도장·영향 줄, 버튼·시트·낭독 영역이 없고 포커스가 움직이지 않으며 기록 줄(부모님이 이렇게 정했습니다)이 같은 해에 남는다', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'parent' });
    await injectSave(page, y.start, TS, MANUAL);
    // 조용한 해 연출 동안 도구 줄의 일시정지에 포커스를 둔다 — 카드가 떠도 포커스는 그대로여야 한다
    await focusPauseAfterEntry(page);
    const card = page.getByTestId('parent-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute('data-by', 'parent');
    await expect(card).toHaveAttribute('data-key', `${y.tick.eventId}@${y.tick.fromAge}`);
    await expect(page.getByTestId('parent-chip')).toHaveText('부모님의 결정');
    await expect(page.getByTestId('parent-stamp')).toHaveText('부모님이 이렇게 정했습니다');
    await expect(page.getByTestId('parent-title')).toHaveText(y.title);
    await expect(page.getByTestId('parent-label')).toHaveText(y.label);
    // 영향 줄: 틱의 impact 항목 수와 같다 (표기 = 실제 효과)
    await expect(card.locator('.impact__item')).toHaveCount(y.tick.impact!.length);
    // 비모달: 버튼·링크·입력 없음, 시트·낭독 영역 없음, 화면은 inert가 아니다
    expect(await card.locator('button, a, input, select, textarea').count()).toBe(0);
    expect(await card.locator('[role="dialog"], [role="status"], [role="alert"], [aria-live], [aria-modal]').count()).toBe(0);
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    // 포커스는 움직이지 않았다
    expect(await activeTestId(page)).toBe('pause');
    // 위치: 인생 기록 바로 위(같은 가운데 열)
    const cardBox = (await card.boundingBox())!;
    const logBox = (await page.getByTestId('log').boundingBox())!;
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(logBox.y + 1);
    // 기록 줄은 같은 해에 남는다 (줄 형식: {결과 문장} (부모님이 이렇게 정했습니다: {고른 길}))
    const row = page.getByTestId('log').getByText(`부모님이 이렇게 정했습니다: ${y.label}`);
    await expect(row.first()).toBeVisible();
    // 가로 넘침 없음
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // 해가 넘어가면 카드는 사라진다
    await expect(card).toHaveCount(0, { timeout: 30_000 });
    // 저장된 인생은 core 기대값과 같다 (이 해 끝 상태까지)
    await expect.poll(async () => (await readSave(page)).data.age).toBeGreaterThanOrEqual(y.after.age);
    const save = (await readSave(page)).data;
    expect(save.history.slice(0, y.after.history.length)).toEqual(y.after.history);
    expect(save.pending ?? null).toBe(null);
  });

  test('일시정지하면 카드가 그 자리에 머문다: 한참 지나도 사라지지 않고 나이도 그대로이며, 다시 재생하면 사라진다', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'parent' });
    await injectSave(page, y.start, TS, MANUAL);
    const card = page.getByTestId('parent-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    // 카드의 연출 대기(1배속 20~38초 ÷ 5 = 4~8초)보다 길게 기다려도 그대로
    await page.waitForTimeout(10_000);
    await expect(card).toBeVisible();
    expect((await readSave(page)).data.age).toBe(y.after.age);
    await page.getByTestId('pause').click();
    await expect(card).toHaveCount(0, { timeout: 30_000 });
  });

  test('새로고침 연타: 카드는 다시 뜨지 않고(틱은 저장하지 않는다) 같은 인생·같은 기록 줄 하나만 남는다', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'parent' });
    await injectSave(page, y.start, TS, MANUAL);
    await expect(page.getByTestId('parent-card')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('pause').click(); // 더 진행하지 않게 멈춘 채로 저장을 확인한다
    await expect.poll(async () => (await readSave(page)).data.age).toBe(y.after.age);
    const before = (await readSave(page)).data;
    for (let i = 0; i < 4; i++) {
      await page.reload();
      await expect(page.getByTestId('life-screen')).toBeVisible();
      await expect(page.getByTestId('parent-card')).toHaveCount(0);
    }
    const after = (await readSave(page)).data;
    expect(after.age).toBe(before.age);
    expect(after.history).toEqual(before.history);
    expect(after.history.filter((h) => h.eventId === y.tick.eventId && h.kind === 'choice')).toHaveLength(1);
    expect(after.history.find((h) => h.eventId === y.tick.eventId && h.kind === 'choice')!.by).toBe('parent');
    // 기록 줄은 화면에 그대로 있다
    await expect(page.getByTestId('log').getByText(`부모님이 이렇게 정했습니다: ${y.label}`).first()).toBeVisible();
  });

  test('8배속: 카드가 스쳐 지나가도 기록 줄이 남고 인생은 core 기대값과 같다', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'parent' });
    await injectSave(page, y.start, '/?__timescale=40', { ...MANUAL, speed: 8 });
    await expect.poll(async () => (await readSave(page)).data.age, { timeout: 20_000 }).toBeGreaterThanOrEqual(y.after.age);
    await page.getByTestId('pause').click();
    const save = (await readSave(page)).data;
    expect(save.history.slice(0, y.after.history.length)).toEqual(y.after.history);
    await expect(page.getByTestId('log').getByText(`부모님이 이렇게 정했습니다: ${y.label}`).first()).toBeVisible();
  });
});

test.describe('아이의 일로 흘러간 해 (PD8)', () => {
  test('칩 「아이의 일」·도장 「이렇게 흘러갔습니다」, 기록 줄 (이렇게 흘러갔습니다: …), 안내 한 줄 없음 · 포커스 이동 없음', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'child' });
    await injectSave(page, y.start, TS, MANUAL);
    await focusPauseAfterEntry(page);
    const card = page.getByTestId('parent-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute('data-by', 'child');
    await expect(page.getByTestId('parent-chip')).toHaveText('아이의 일');
    await expect(page.getByTestId('parent-stamp')).toHaveText('이렇게 흘러갔습니다');
    await expect(page.getByTestId('parent-label')).toHaveText(y.label);
    await expect(page.getByTestId('parent-hint')).toHaveCount(0);
    expect(await card.locator('button, a, input').count()).toBe(0);
    expect(await activeTestId(page)).toBe('pause');
    await expect(page.getByTestId('log').getByText(`이렇게 흘러갔습니다: ${y.label}`).first()).toBeVisible();
  });
});

test.describe('다음 결정으로 (PD3·PD7)', () => {
  test('부모·흘러감 해를 지나 다음 본인 결정 앞에서 멈춘다: 저장이 core 기대값(advanceUntilDecision)과 같고 사이의 해마다 by 표지 줄이 남았다', async ({ page }) => {
    await page.goto('/');
    // 첫 본인 결정 앞에 부모·흘러감 해가 둘 이상 있는 시드
    const start = await evalCore<GameState | null>(
      page,
      `for (let seed = 1; seed < 800; seed++) {
         const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
         const s = core.advanceUntilDecision(s0, undefined, 'consume').state;
         if (s.phase === 'life' && s.pending && s.history.filter((h) => h.by).length >= 2) return s0;
       }
       return null;`,
      { era: 'present' },
    );
    expect(start, '부모·흘러감 해가 둘 이상 앞서는 시드를 찾지 못했다').not.toBeNull();
    const s0 = withoutPlay(start!);
    const expected = await oracleDecision(page, s0);
    await injectSave(page, s0, TS, MANUAL);
    const skip = page.getByTestId('skip');
    await expect(skip).toBeEnabled();
    await skip.click();
    await expect(page.getByTestId('choice-panel')).toBeVisible({ timeout: 60_000 });
    const save = (await readSave(page)).data;
    expect(save.pending?.key).toBe(expected.pending?.key);
    expect(save.age).toBe(expected.age);
    expect(save.history).toEqual(expected.history);
    // 사이의 해마다 by 표지 줄이 남았다 (부모 줄이 있고, 본인 줄은 by가 없다)
    expect(save.history.filter((h) => h.by === 'parent').length).toBeGreaterThanOrEqual(1);
    expect(save.history.filter((h) => h.kind === 'choice' && h.by === undefined)).toHaveLength(0); // 아직 본인이 고른 선택은 없다
    // 멈춘 카드는 본인 결정(선택지 버튼이 있는 시트)이고 부모 카드가 아니다
    await expect(page.getByTestId('parent-card')).toHaveCount(0);
    expect(await page.getByTestId('choice-panel').getByRole('button').count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe('다음 결정으로 + 기록 카드 (R-451, PD7-3)', () => {
  // 기록 카드를 켠 기본 설정(수동, noteCards: true)에서 「다음 결정으로」는 5세 첫머리의 기록 카드 앞에서 멈춘다. 직전(4세) 해가 부모님이 정한·흘러간 해여도 그 카드는 화면에 뜨지 않는다.
  const NOTES_ON: InjectedSettings = { speed: 1, autoMode: false, noteCards: true };

  for (const by of ['parent', 'child'] as const) {
    test(`4세가 ${by === 'parent' ? '부모님이 정한' : '아이의 일로 흘러간'} 해이고 5세에 기록 카드: 건너뛰면 기록 시트만 뜨고 ${by === 'parent' ? '부모' : '흘러감'} 카드는 시트 뒤에도, 시트를 닫은 뒤에도 없다 — 기록 줄은 남는다`, async ({ page }) => {
      await page.goto('/');
      // 시드 탐색 (R-459): 4세가 `by` 해이고 5세 첫머리에 기록 카드가 뜨는 판 가운데, 시트를 닫은 뒤의 **5세 해가 위임 해가 아닌** 판만 쓴다 — 5세가 위임 해면 6세가 된 뒤 5세 카드(`${eventId}@5`)가
      // 뜨는 것이 PD5상 정상이라 아래의 「화면에 카드 없음」 단언이 거짓으로 실패한다. 시트를 닫는 길(`dismissNote` = `consumeNote`)과 그 해 걸음(`stepYear`)을 core로 한 번 미리 돌려 5세 해의 틱을 본다.
      const found = await evalCore<{ start: GameState; expected: GameState; eventId: string } | null>(
        page,
        `for (let seed = 1; seed < 800; seed++) {
           const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
           const r = core.advanceUntilDecision(s0, undefined, 'stop');
           if (r.stoppedForNote && r.stoppedForNote.id === 'note-infant-memory' && r.state.age === 5 && r.last.fromAge === 4 && r.last.by === arg.by && r.last.eventId !== undefined) {
             const year5 = core.stepYear(core.consumeNote(r.state, r.stoppedForNote));
             if (year5.tick.by !== undefined || year5.state.age !== 6) continue; // 5세가 위임 해이거나 본인 결정 앞에서 멈추면(나이가 안 넘어간다) 이 시험의 대상이 아니다
             return { start: s0, expected: r.state, eventId: r.last.eventId };
           }
         }
         return null;`,
        { era: 'present', by },
      );
      expect(found, `4세가 ${by} 해이고 5세에 기록 카드가 뜨며 5세 해는 위임 해가 아닌 시드를 찾지 못했다`).not.toBeNull();
      // 건너뛴 4세 해의 카드: 어떤 상황에서도 뜨지 않는다 (키 = `{이벤트 id}@{나이}`, ParentCard의 data-key)
      const card4 = page.locator(`[data-testid="parent-card"][data-key="${found!.eventId}@4"]`);
      await injectSave(page, withoutPlay(found!.start), TS, NOTES_ON);
      const skip = page.getByTestId('skip');
      await expect(skip).toBeEnabled();
      await skip.click();
      // 기록 시트가 5세 첫머리에서 열린다 (카드는 없다)
      await expect(page.getByTestId('note-sheet')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('note-sheet')).toHaveAttribute('data-card', 'note-infant-memory');
      await expect(page.getByTestId('parent-card')).toHaveCount(0);
      await expect(card4).toHaveCount(0);
      // 저장된 인생은 core 기대값(advanceUntilDecision 'stop')과 같고, 위임 해의 기록 줄이 남아 있다
      const save = (await readSave(page)).data;
      expect(save.age).toBe(5);
      expect(save.history).toEqual(found!.expected.history);
      expect(save.history.filter((h) => h.by === by).length).toBeGreaterThanOrEqual(1);
      await expect(page.getByTestId('log').getByText(by === 'parent' ? '부모님이 이렇게 정했습니다' : '이렇게 흘러갔습니다').first()).toBeAttached();
      // 시트를 닫아도 카드는 뜨지 않고(필요량 18~44초를 기다리지 않는다) 해가 이어진다
      await page.waitForTimeout(1500);
      await expect(page.getByTestId('parent-card')).toHaveCount(0);
      await page.getByTestId('note-skip').click();
      await expect(page.getByTestId('note-sheet')).toHaveCount(0);
      await expect(page.getByTestId('parent-card')).toHaveCount(0);
      await expect(card4).toHaveCount(0);
      // 기본 연출로 5세가 끝난다 (R-459 시간 상한): 틱이 없는 해(새로고침 직후와 같다)는 조용한 해 대기 = HOLD_MS.quiet 7초 × 연출 계수 1.6875 = 11.81초(1배속, LM7b) ÷ 배속 5 = 2.4초 뒤에 넘어간다.
      // 4세 카드가 떴다면 결과 해 대기(13초 × 1.6875 = 21.94초, 카드 필요량이 더 길면 그 이상) ÷ 5 = 4.4초 이상을 기다렸을 것이다. 두 값의 한가운데(3.4초)로 상한을 둬 — 앞쪽 2.4초에는 1초, 뒤쪽 4.4초에는 1초의 여유 —
      // 카드를 기다렸다면 실패하고 부하로 조금 늦어도 통과하게 한다. 값은 모드 표(`holdMsFor`)에서 가져온다(계수가 바뀔 때마다 이 줄을 고치지 않는다).
      const quietWaitMs = (holdMsFor('quiet', { mode: 'short30' }) as number) / 5; // 2362.6
      const cardWaitMs = (holdMsFor('resolved', { mode: 'short30' }) as number) / 5; // 4387.6
      await expect.poll(async () => (await readSave(page)).data.age, { timeout: Math.round((quietWaitMs + cardWaitMs) / 2), intervals: [100, 200, 300, 500] }).toBeGreaterThan(5);
      // 6세가 된 뒤에도 건너뛴 4세 해의 카드는 없다. 5세 해는 시드 탐색에서 위임 해가 아닌 판만 골랐으므로 화면 전체에도 부모·흘러감 카드가 없다.
      await expect(card4).toHaveCount(0);
      await expect(page.getByTestId('parent-card')).toHaveCount(0);
    });
  }
});
