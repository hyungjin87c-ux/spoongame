import { expect, test, type Page } from '@playwright/test';
import type { GameState, PlaySettings } from '../src/core/types';
import {
  CONTROL_TAB_ORDER,
  activeTestId,
  controlFocusables,
  countKind,
  evalCore,
  findPendingState,
  injectSave,
  oracleDecision,
  oracleLife,
  readSave,
  readSettings,
  setPageVisible,
  settle,
  startPageHidden,
  tabWalk,
} from './helpers';

/**
 * R-036: 인생 화면의 포커스 규칙 (src/ui/useFocus.ts#decideLifeFocus / useLifeFocus)
 *  - 컨트롤 그룹(1·2·4·8배, 다음 결정으로, 자동 모드)의 Tab 순서는 선택지가 뜨든 사라지든 변하지 않는다. "다음 결정으로"는 누를 수 없을 때
 *    disabled가 아니라 aria-disabled(포커스는 받고 입력은 무시)다 — disabled면 Tab 순서에서 빠져, 포커스가 8배 버튼에 있다가 선택지가 뜨면 다음 Tab이
 *    "자동 모드"에 닿고 Space가 자동 모드를 켜 버렸다.
 *  - 자동 모드에서는 선택지가 떠도 포커스를 옮기지 않는다 (키보드로 자동 모드 버튼까지 가서 끌 수 있어야 한다 — SPEC "언제든 해제 가능")
 *  - 수동 모드에서 포커스가 컨트롤 그룹 안에 있으면 옮기지 않고 aria-live로 알린다. 그 밖에는 선택지 제목으로 — 복원된 선택지와 플레이 중 뜬 선택지가 같은 대상이다
 *  - 사용자가 "다음 결정으로"를 직접 눌러 뜬 선택지는 선택지 제목으로 옮긴다
 *  - 키보드로 선택한 뒤 패널이 사라지면 포커스는 body가 아니라 인생 화면 제목으로 간다
 * R-048: 선택지가 대기 중인 채 자동 모드를 끄는 순간에도 같은 규칙을 다시 적용한다.
 * 시간 경쟁을 없애려고 "가려진 탭"(startPageHidden)으로 앱 타이머를 멈춘 채 화면을 준비한 뒤 풀어 준다. 고정 대기는 "일어나지 않아야 하는 일"을 지켜볼 때만 쓴다.
 */

const SETTINGS_MANUAL: PlaySettings = { speed: 1, autoMode: false };
const SETTINGS_AUTO: PlaySettings = { speed: 1, autoMode: true };

/** 첫 선택지가 나오기까지 시간이 걸리는(0세에서 시작하는) 시드의 인생 시작 상태와 그 결정 상태 */
async function lifeWithDecision(page: Page): Promise<{ start: GameState; decision: GameState }> {
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
  const start = await oracleLife(page, decision.seed, 'present');
  return { start, decision };
}

/** 컨트롤 가드가 풀릴 때까지 기다린다 (Playwright는 aria-disabled=true를 비활성으로 본다) */
async function controlsReady(page: Page): Promise<void> {
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('auto')).toBeEnabled();
  await expect(page.locator('[data-speed="8"]')).toBeEnabled();
}

/** 저장된 설정·진행이 그대로인지(자동 모드 안 켜짐, 같은 선택지가 대기 중, 선택 기록 없음) */
async function expectUntouched(page: Page, pendingKey: string): Promise<void> {
  await settle(page);
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'false');
  expect((await readSettings(page)).autoMode, '자동 모드가 켜졌다').toBe(false);
  const save = await readSave(page);
  expect(save.data.pending?.key, '대기 중인 선택지가 바뀌었다').toBe(pendingKey);
  expect(countKind(save, 'choice'), '선택이 연표에 기록됐다').toBe(0);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-key', pendingKey);
}

test('수동 모드: 속도 버튼에 포커스를 둔 채 선택지가 뜨면 포커스는 그대로이고 aria-live로만 알린다. Space는 선택을 확정하지 않는다 (R-036 a)', async ({ page }) => {
  await startPageHidden(page);
  const { start } = await lifeWithDecision(page);
  await injectSave(page, start, '/?__timescale=200', SETTINGS_MANUAL); // 풀리면 선택지가 곧바로 뜬다
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('life-name'); // 화면이 뜬 직후의 포커스(R-030)

  // 키보드 사용자가 속도 버튼 사이를 이동 중이다
  const four = page.locator('[data-speed="4"]');
  await expect(four).toBeEnabled();
  await four.focus();
  expect(await activeTestId(page)).toBe('speed-4');

  await setPageVisible(page, true); // 시간이 흐른다 → 선택지가 뜬다
  const panel = page.getByTestId('choice-panel');
  await expect(panel).toBeVisible();
  const key = (await panel.getAttribute('data-key'))!;
  await settle(page);
  expect(await activeTestId(page), '포커스가 선택지 제목으로 튀지 않는다').toBe('speed-4');
  await expect(page.getByTestId('choice-announce'), '대신 aria-live 영역으로 알린다').toContainText(await page.getByTestId('choice-title').innerText());

  // 이때 누른 Space는 속도 버튼을 누른 것이다 — 선택을 확정하지 않는다
  await page.keyboard.press('Space');
  await expect(four).toHaveAttribute('aria-pressed', 'true');
  await settle(page);
  await expect(panel).toHaveAttribute('data-key', key);
  const save = await readSave(page);
  expect(save.data.pending?.key).toBe(key);
  expect(countKind(save, 'choice')).toBe(0);
});

// (e1) 재현 경로가 닫혔는지: 포커스가 속도 버튼에 있다가 선택지가 뜬 뒤 Tab → Space
for (const speed of [2, 4, 8] as const) {
  test(`수동 모드: 포커스가 ${speed}배 버튼에 있을 때 선택지가 뜬 뒤 Tab은 비활성 "다음 결정으로"에 닿고(자동 모드를 건너뛰지 않는다) Space·Enter는 무시된다 — 자동 모드·선택지·연표 불변 (R-036 e1)`, async ({ page }) => {
    await startPageHidden(page);
    const { start } = await lifeWithDecision(page);
    await injectSave(page, start, '/?__timescale=200', SETTINGS_MANUAL);
    await controlsReady(page);
    await page.locator(`[data-speed="${speed}"]`).focus();
    expect(await activeTestId(page)).toBe(`speed-${speed}`);

    await setPageVisible(page, true); // 선택지가 뜬다
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toBeVisible();
    const key = (await panel.getAttribute('data-key'))!;
    await settle(page);
    expect(await activeTestId(page), '포커스는 속도 버튼에 그대로').toBe(`speed-${speed}`);

    // Tab: 같은 순서로 남은 속도 버튼들을 지나 "다음 결정으로"에 닿는다 (자동 모드 버튼으로 건너뛰지 않는다)
    const speedsAfter = [4, 8].filter((s) => s > speed).map((s) => `speed-${s}`);
    const toSkip = await tabWalk(page, speedsAfter.length + 1);
    expect(toSkip).toEqual([...speedsAfter, 'skip']);
    const skip = page.getByTestId('skip');
    await expect(skip, '누를 수 없는 "다음 결정으로"는 비활성으로 표시된다').toHaveAttribute('aria-disabled', 'true');
    expect(await skip.evaluate((el: HTMLButtonElement) => el.disabled), 'disabled 속성이 아니다(포커스를 받는다)').toBe(false);

    // Space와 Enter는 무시된다
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expectUntouched(page, key);
    expect(await activeTestId(page), '눌러도 포커스는 그대로').toBe('skip');

    // 다음 Tab이 자동 모드에 닿는다 (그리고 그 앞에 "다음 결정으로"가 항상 끼어 있다)
    expect(await tabWalk(page, 1)).toEqual(['auto']);
    await expectUntouched(page, key);
  });
}

// (e3) 컨트롤 그룹의 Tab 순서(포커스 가능한 요소 목록)는 선택지 등장 전후·자동 모드에서도 같다
test('컨트롤 그룹의 Tab 순서(포커스 가능한 요소 목록과 실제 Tab 이동)는 선택지가 뜨기 전·뜬 뒤·사라진 뒤에 모두 같다 (R-036 e3)', async ({ page }) => {
  await startPageHidden(page);
  const { start } = await lifeWithDecision(page);
  await injectSave(page, start, '/?__timescale=200', SETTINGS_MANUAL);
  await controlsReady(page);
  const expectedWalk = CONTROL_TAB_ORDER.slice(1); // speed-1에서 시작해 Tab 5번
  const walk = async () => {
    await page.locator('[data-speed="1"]').focus();
    return tabWalk(page, expectedWalk.length);
  };

  // 선택지가 뜨기 전
  expect(await controlFocusables(page), '선택지 없음').toEqual([...CONTROL_TAB_ORDER]);
  expect(await walk()).toEqual(expectedWalk);
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);

  // 선택지가 뜬 뒤 (다음 결정으로는 aria-disabled지만 목록에 그대로 있다)
  await setPageVisible(page, true);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await settle(page);
  await setPageVisible(page, false); // 이후 타이머가 끼어들지 않게
  expect(await controlFocusables(page), '선택지 대기 중').toEqual([...CONTROL_TAB_ORDER]);
  expect(await walk()).toEqual(expectedWalk);
  await expect(page.getByTestId('skip')).toHaveAttribute('aria-disabled', 'true');

  // 선택지가 사라진 뒤
  const first = page.getByTestId(`choice-${(await readSave(page)).data.pending!.choiceIds[0]}`);
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  expect(await controlFocusables(page), '선택지 해결 뒤').toEqual([...CONTROL_TAB_ORDER]);
  expect(await walk()).toEqual(expectedWalk);
  await expect(page.getByTestId('skip'), '선택지가 없고 수동이면 "다음 결정으로"를 누를 수 있다').not.toHaveAttribute('aria-disabled', 'true');
});

test('컨트롤 그룹의 Tab 순서는 (수동·자동) × (선택지 없음·있음) 네 상태에서 모두 같다. 자동 모드가 켜지고 꺼져도 목록이 변하지 않는다 (R-036 e3)', async ({ page }) => {
  await startPageHidden(page);
  const { start, decision } = await lifeWithDecision(page);
  const states: Array<[string, GameState, PlaySettings]> = [
    ['수동 / 선택지 없음', start, SETTINGS_MANUAL],
    ['수동 / 선택지 있음', decision, SETTINGS_MANUAL],
    ['자동 / 선택지 없음', start, SETTINGS_AUTO],
    ['자동 / 선택지 있음', decision, SETTINGS_AUTO],
  ];
  for (const [label, state, settings] of states) {
    await injectSave(page, state, '/', settings);
    await controlsReady(page);
    expect(await controlFocusables(page), label).toEqual([...CONTROL_TAB_ORDER]);
    await page.locator('[data-speed="1"]').focus();
    expect(await tabWalk(page, 5), label).toEqual(CONTROL_TAB_ORDER.slice(1));
    // "다음 결정으로"가 누를 수 없는 때는 정확히 (자동 모드 또는 선택지 있음)
    const blocked = settings.autoMode || state.pending !== null;
    const skip = page.getByTestId('skip');
    if (blocked) await expect(skip, label).toHaveAttribute('aria-disabled', 'true');
    else await expect(skip, label).not.toHaveAttribute('aria-disabled', 'true');
  }

  // 같은 화면에서 자동 모드를 켜고 끄는 사이에도 목록이 변하지 않는다
  await injectSave(page, start, '/', SETTINGS_MANUAL);
  await controlsReady(page);
  const auto = page.getByTestId('auto');
  await auto.click();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  expect(await controlFocusables(page), '자동 모드 켬').toEqual([...CONTROL_TAB_ORDER]);
  await auto.click();
  await expect(auto).toHaveAttribute('aria-pressed', 'false');
  expect(await controlFocusables(page), '자동 모드 끔').toEqual([...CONTROL_TAB_ORDER]);
});

// (e2) 키보드로 "다음 결정으로"를 눌러 선택지가 뜨면 포커스는 선택지 제목, 재입력·연타가 선택을 확정하지 않는다
for (const key of ['Enter', 'Space'] as const) {
  test(`키보드로 "다음 결정으로"를 ${key}로 누르면 선택지 제목으로 포커스가 가고, Space·Enter를 다시 누르거나 연타해도 선택이 확정되지 않는다 (R-036 e2)`, async ({ page }) => {
    await startPageHidden(page);
    const { start } = await lifeWithDecision(page);
    const expected = await oracleDecision(page, start);
    await injectSave(page, start, '/', SETTINGS_MANUAL);
    await controlsReady(page);
    // 인생 화면 제목에서 시작해 Tab으로 "다음 결정으로"까지 간다
    expect(await activeTestId(page)).toBe('life-name');
    expect(await tabWalk(page, 5)).toEqual(['speed-1', 'speed-2', 'speed-4', 'speed-8', 'skip']);
    await expect(page.getByTestId('skip')).not.toHaveAttribute('aria-disabled', 'true');

    await page.keyboard.press(key);
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-key', expected.pending!.key); // 연출 없이 core의 "다음 결정"과 같은 곳에서 멈췄다
    await expect.poll(() => activeTestId(page), '버튼이 아니라 선택지 제목으로 옮겨진다').toBe('choice-title');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H2');
    await expect(page.getByTestId('choice-announce'), '제목으로 직접 옮겼으므로 별도 알림은 없다').toHaveText('');

    // 재입력·연타: 포커스가 제목에 있으므로 Space·Enter는 아무 선택도 확정하지 않는다
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
    }
    for (let i = 0; i < 5; i++) await page.keyboard.down('Enter'); // 누르고 있기(키 반복)
    await page.keyboard.up('Enter');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await expectUntouched(page, expected.pending!.key);
    expect(await activeTestId(page)).toBe('choice-title');
    expect((await readSave(page)).data).toEqual(expected);
  });
}

test('마우스로 "다음 결정으로"를 눌러도 선택지 제목으로 포커스가 가고, 곧바로 Space·Enter를 눌러도 선택이 확정되지 않는다 (R-036 e2)', async ({ page }) => {
  await startPageHidden(page);
  const { start } = await lifeWithDecision(page);
  const expected = await oracleDecision(page, start);
  await injectSave(page, start, '/', SETTINGS_MANUAL);
  await controlsReady(page);
  await page.getByTestId('skip').click(); // 마우스 클릭은 버튼에 포커스를 준다
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expectUntouched(page, expected.pending!.key);
});

test('수동 모드: 인생 화면 제목이나 body에 포커스가 있다가 선택지가 뜨면 선택지 제목으로 옮긴다. 복원 경로와 플레이 경로의 대상이 같다 (R-036 c)', async ({ page }) => {
  // 복원 경로: 새로고침으로 선택지가 이미 떠 있는 채 화면이 열린다
  await startPageHidden(page);
  const { start, decision } = await lifeWithDecision(page);
  await injectSave(page, decision, '/', SETTINGS_MANUAL);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
  const restoredTarget = await activeTestId(page);

  // 플레이 경로 1: 인생 화면 제목(h1)에 포커스가 있다가 시간이 흘러 선택지가 뜬다
  await injectSave(page, start, '/?__timescale=200', SETTINGS_MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('life-name');
  await setPageVisible(page, true);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
  const playedTarget = await activeTestId(page);
  expect(playedTarget).toBe(restoredTarget);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H2');

  // 플레이 경로 2: 포커스가 어디에도 없을 때(body)도 같은 대상이다
  await injectSave(page, start, '/?__timescale=200', SETTINGS_MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('life-name');
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await setPageVisible(page, true);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe(restoredTarget);
});

test('자동 모드: 새로고침으로 선택지가 복원돼도 선택지 제목으로 가지 않는다 (인생 화면 제목에만 둔다) (R-036 b)', async ({ page }) => {
  await startPageHidden(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
  await injectSave(page, decision, '/', SETTINGS_AUTO);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('auto-note')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('life-name');
  await settle(page);
  expect(await activeTestId(page)).toBe('life-name');
});

test('8배속 + 자동 모드: 선택지가 몇 번 떠도 포커스는 자동 모드 버튼에서 떠나지 않는다. 8배 버튼에서 Tab으로 "다음 결정으로"(비활성)를 지나 자동 모드 버튼에 닿는다 (R-036 b)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  // 자동으로 끝까지 가는 동안 선택지가 12번 이상 나오는 시드를 찾는다(여러 번 뜨는 상황을 보려는 것. 컨트롤 가드가 풀릴 때까지의 0.4초 동안 몇 번이 지나가도 3번 더 볼 여유가 남는다)
  const start = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 400; seed++) {
       const s = core.enterLife(core.beginBirth(core.createInitialState(seed), 'present'));
       if (core.playToEnd(s, null).counts.choice >= 12) return s;
     }
     return null;`,
  );
  expect(start, '선택지가 12번 이상 나오는 시드').not.toBeNull();
  // 시간 배율 4: 8배속에서 한 해 약 0.13초, 자동 선택은 약 0.09초 후 → 몇 초 동안 선택지가 여러 번 뜬다.
  await injectSave(page, start!, '/?__timescale=4', { speed: 8, autoMode: true });
  await controlsReady(page);

  // 키보드 사용자: 8배 버튼에서 Tab → 자동 모드에서는 누를 수 없는 "다음 결정으로"(aria-disabled, 순서에는 그대로) → 자동 모드 버튼
  await page.locator('[data-speed="8"]').focus();
  expect(await tabWalk(page, 2)).toEqual(['skip', 'auto']);
  await expect(page.getByTestId('skip')).toHaveAttribute('aria-disabled', 'true');

  // 이후 포커스가 한 번이라도 다른 곳으로 가면 기록한다
  await page.evaluate(() => {
    const w = window as unknown as { __focusLog: string[] };
    w.__focusLog = [];
    document.addEventListener('focusin', (e) => {
      const t = e.target as HTMLElement;
      w.__focusLog.push(t.getAttribute('data-testid') ?? t.tagName);
    });
  });
  const baseline = countKind(await readSave(page), 'choice');
  await expect.poll(async () => countKind(await readSave(page), 'choice'), { timeout: 30_000 }).toBeGreaterThanOrEqual(baseline + 3);
  expect(await page.evaluate(() => (window as unknown as { __focusLog: string[] }).__focusLog), '자동 모드에서 선택지가 3번 이상 떴는데 포커스가 움직였다').toEqual([]);
  expect(await activeTestId(page)).toBe('auto');
});

// R-048: 자동 모드를 끄는 순간에도 "선택지 대기 중"이면 같은 규칙. 시간 경쟁이 없도록 "대기 중에 끈 경우"와 "끈 뒤에 선택지가 뜬 경우"를 가려진 탭으로 나눠 본다.
test.describe('자동 모드를 끄는 순간 (R-048)', () => {
  test('선택지가 대기 중일 때 키보드(Space)로 자동 모드를 끄면 포커스는 자동 모드 버튼에 두고 aria-live로 알린다. 자동 선택은 취소된다', async ({ page }) => {
    await startPageHidden(page);
    const { decision } = await lifeWithDecision(page);
    await injectSave(page, decision, '/?__timescale=200', SETTINGS_AUTO); // 가려진 탭이라 자동 선택 타이머는 아직 걸리지 않는다
    await controlsReady(page);
    await expect(page.getByTestId('auto-note')).toBeVisible();
    const key = decision.pending!.key;
    await expect.poll(() => activeTestId(page), '자동 모드의 복원: 선택지 제목으로 가지 않는다').toBe('life-name');
    await expect(page.getByTestId('choice-announce')).toHaveText('');

    const auto = page.getByTestId('auto');
    await auto.focus();
    await page.keyboard.press('Space'); // 자동 모드 끔 → 선택지가 대기 중인 채 수동으로 바뀐다
    await expect(auto).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('auto-note')).toHaveCount(0);
    expect(await activeTestId(page), '포커스는 자동 모드 버튼에 그대로').toBe('auto');
    await expect(page.getByTestId('choice-announce')).toContainText(await page.getByTestId('choice-title').innerText());
    await expect(page.getByTestId('choice-announce')).toContainText('선택지가 나왔습니다');

    // 이제 시간이 흘러도(자동 선택 지연은 시간 배율 200에서 약 15ms) 선택이 일어나지 않는다
    await setPageVisible(page, true);
    await page.waitForTimeout(400);
    await expectUntouched(page, key);
    expect(await activeTestId(page)).toBe('auto');
  });

  test('대조: 같은 조건에서 자동 모드를 끄지 않으면 자동 선택이 곧 일어난다 (위 테스트가 지켜보는 시간이 충분하다는 증거)', async ({ page }) => {
    await startPageHidden(page);
    const { decision } = await lifeWithDecision(page);
    await injectSave(page, decision, '/?__timescale=200', SETTINGS_AUTO);
    await controlsReady(page);
    await setPageVisible(page, true);
    await expect.poll(async () => countKind(await readSave(page), 'choice')).toBeGreaterThanOrEqual(1);
  });

  test('선택지가 대기 중일 때 포커스가 컨트롤 밖(body)에서 자동 모드가 꺼지면 선택지 제목으로 옮긴다', async ({ page }) => {
    await startPageHidden(page);
    const { decision } = await lifeWithDecision(page);
    await injectSave(page, decision, '/?__timescale=200', SETTINGS_AUTO);
    await controlsReady(page);
    await expect.poll(() => activeTestId(page)).toBe('life-name');
    await page.evaluate(() => (document.activeElement as HTMLElement).blur()); // 포커스를 body로
    await page.getByTestId('auto').evaluate((el: HTMLButtonElement) => el.click()); // 프로그램으로 눌러 버튼에 포커스가 가지 않게 한다(터치·일부 브라우저의 클릭과 같다)
    await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => activeTestId(page)).toBe('choice-title');
    await expect(page.getByTestId('choice-announce'), '제목으로 직접 옮겼으므로 별도 알림은 없다').toHaveText('');
  });

  test('자동 모드를 끈 뒤에 선택지가 뜨면 (포커스가 자동 모드 버튼에 있으므로) 옮기지 않고 aria-live로 알린다. 다시 켜면 알림이 지워진다', async ({ page }) => {
    await startPageHidden(page);
    const { start } = await lifeWithDecision(page);
    await injectSave(page, start, '/?__timescale=200', SETTINGS_AUTO);
    await controlsReady(page);
    const auto = page.getByTestId('auto');
    await auto.focus();
    await page.keyboard.press('Space'); // 선택지가 아직 없을 때 끈다
    await expect(auto).toHaveAttribute('aria-pressed', 'false');
    expect(await activeTestId(page)).toBe('auto');

    await setPageVisible(page, true); // 이제 시간이 흘러 선택지가 뜬다
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toBeVisible();
    const key = (await panel.getAttribute('data-key'))!;
    await settle(page);
    expect(await activeTestId(page), '선택지가 떠도 포커스는 자동 모드 버튼에 그대로').toBe('auto');
    await expect(page.getByTestId('choice-announce')).toContainText(await page.getByTestId('choice-title').innerText());
    await page.waitForTimeout(400); // 자동 선택은 취소된 채다(지연 약 15ms)
    await expectUntouched(page, key);

    // 다시 켜면 이전 알림은 지워지고 포커스는 그대로이다 (이 선택지는 자동 모드가 곧 고른다)
    await setPageVisible(page, false);
    await page.keyboard.press('Space');
    await expect(auto).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('choice-announce')).toHaveText('');
    expect(await activeTestId(page)).toBe('auto');
  });
});

test('키보드로 선택지를 고른 뒤 패널이 사라져도 포커스는 body로 떨어지지 않고 인생 화면 제목에 있으며, Tab은 컨트롤 그룹을 같은 순서로 지난다 (R-036 d)', async ({ page }) => {
  await startPageHidden(page); // 선택 뒤 다음 해가 저절로 진행되지 않게 멈춰 둔다
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
  await injectSave(page, decision, '/', SETTINGS_MANUAL);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('choice-title');

  const firstId = decision.pending!.choiceIds[0];
  await expect(page.getByTestId(`choice-${firstId}`)).toBeEnabled(); // 입력 가드가 풀릴 때까지
  await page.keyboard.press('Tab');
  expect(await activeTestId(page)).toBe(`choice-${firstId}`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect.poll(() => activeTestId(page), '선택한 버튼이 사라진 뒤 포커스').toBe('life-name');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  // 인생 화면 제목 다음 Tab은 컨트롤 그룹으로 이어지고, 그 순서는 선택지가 있을 때와 같다
  expect(await tabWalk(page, 6)).toEqual([...CONTROL_TAB_ORDER]);
});
