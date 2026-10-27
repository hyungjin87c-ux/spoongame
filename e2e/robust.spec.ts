import { expect, test, type Page } from '@playwright/test';
import type { GameState, GenerationId } from '../src/core/types';
import {
  GAME_KEY,
  SAVE_VERSION,
  SETTINGS_KEY,
  evalCore,
  findPendingState,
  injectSave,
  noHorizontalOverflow,
  oracleAuto,
  oracleDecision,
  oracleLife,
  rapidInput,
  readSave,
  readSettings,
  settingsEnvelope,
  settle,
  startPageHidden,
} from './helpers';

/**
 * 수동·1배속·기록 카드 꺼짐. SPEC-005 QI5부터 첫 본인 결정이 13세 이후라(그 앞은 부모님이 정하거나 흘러간다) 설정 없이 0세부터 시작하면 5세의 기록 카드 시트가 먼저 시계를 멈춘다 —
 * 이 묶음은 선택 처리·연타·키보드 흐름을 보므로 기록 카드를 끈다(기록 카드 자체는 e2e/m7c-note.spec.ts). 기대값은 기록 카드를 시트 없이 소비하는 길(`'consume'`)로 계산한다.
 */
const NO_NOTES = { speed: 1, autoMode: false, noteCards: false } as const;

/**
 * 공격·견고성 시나리오 (QA가 사람 손으로 하는 것과 같은 상황을 자동화): 새로고침 연타(로드·저장 도중 중단),
 * 선택 버튼 연타, 다중 탭, 저장 실패, 가려진 탭, 자동 모드 해제, 키보드만으로 진행.
 * 연출 시간은 개발 서버 전용 탐침 ?__timescale=N 으로 줄인다.
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** 첫 결정(선택지)이 있는 시드의 0세 상태와 그 결정 상태 */
async function lifeWithDecision(page: Page, era: GenerationId = 'alpha') {
  await page.goto('/');
  const decision = await findPendingState(page, era);
  const start = await oracleLife(page, decision.seed, era);
  return { start, decision };
}

// ---------- 새로고침 연타 (R-004) ----------

test('진행 중 새로고침을 로드가 끝나기 전에 연타해도 저장이 깨지지 않고 이어져, 최종 결과가 core 자동 진행과 같다 (R-004)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const { start } = await lifeWithDecision(page);
  await injectSave(page, start, '/?__timescale=8', { speed: 8, autoMode: true });
  await expect.poll(async () => (await readSave(page)).data.age).toBeGreaterThan(0); // 진행이 실제로 시작됐다

  for (const gap of [0, 3, 10, 25, 60, 120, 0, 40, 200, 15, 5, 80]) {
    await page.reload({ waitUntil: 'commit' }); // 이전 로드가 끝나기 전에 다시 새로고침 → 로드·저장이 중간에 끊긴다
    await page.waitForTimeout(gap);
  }
  expect((await readSave(page)).data.phase, '연타가 끝났을 때 아직 인생 도중이었다(중단이 실제로 진행 중에 일어났다)').toBe('life');
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 60_000 });
  const save = await readSave(page);
  expect(save.data).toEqual(await oracleAuto(page, start)); // 한 해가 두 번 진행되거나 건너뛰지 않았다
  expect(errors).toEqual([]);

  // 엔딩 상태에서 새로고침해도 유지된다
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  expect((await readSave(page)).data).toEqual(save.data);
});

test('저장 쓰기 직전에 문서가 죽어도(이후 쓰기 전부 유실) 이전 저장으로 이어지고 최종 결과가 같다 (R-004: 저장 도중 중단)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.addInitScript((key) => {
    // 7번째 게임 저장 직전에 새로고침하고, 그 문서의 이후 쓰기를 모두 버린다(프로세스가 죽은 것과 같다). 한 번만 일어난다.
    const original = Storage.prototype.setItem;
    let writes = 0;
    let dead = false;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (this === window.localStorage && k === key) {
        if (dead) return;
        writes++;
        if (writes === 7 && sessionStorage.getItem('killed') === null) {
          sessionStorage.setItem('killed', String(Date.now()));
          dead = true;
          location.reload();
          return;
        }
      }
      return original.call(this, k, v);
    };
  }, GAME_KEY);
  const { start } = await lifeWithDecision(page);
  await injectSave(page, start, '/?__timescale=8', { speed: 8, autoMode: true });
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => sessionStorage.getItem('killed')), '중단이 실제로 일어났다').not.toBeNull();
  expect((await readSave(page)).data).toEqual(await oracleAuto(page, start));
  expect(errors).toEqual([]);
});

// ---------- 선택 버튼 연타 ----------

test('선택 버튼을 연타해도 첫 클릭만 반영되고, 바로 다음에 뜨는 선택지는 자동으로 눌리지 않는다', async ({ page }) => {
  await page.goto('/');
  // A를 첫 번째 선택지로 고른 뒤 곧바로 다음 결정 B가 있는 시드
  const a = await evalCore<GameState | null>(
    page,
    `for (let seed = 3000; seed < 3400; seed++) {
       const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       const s = core.advanceUntilDecision(start, undefined, 'consume').state;
       if (s.phase !== 'life' || !s.pending) continue;
       const t = core.advanceUntilDecision(core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]), undefined, 'consume').state;
       if (t.phase === 'life' && t.pending) return s;
     }
     return null;`,
  );
  expect(a).not.toBeNull();
  const firstId = a!.pending!.choiceIds[0];
  const expected = await evalCore<GameState>(
    page,
    "return core.advanceUntilDecision(core.resolveChoice(arg, arg.pending.key, arg.pending.choiceIds[0]), undefined, 'consume').state;",
    a,
  );
  expect(expected.pending).not.toBeNull();
  expect(expected.pending!.key).not.toBe(a!.pending!.key);

  await injectSave(page, a!, '/?__timescale=100000', NO_NOTES); // 연출이 사실상 0ms → B가 곧바로 뜬다
  const first = page.locator(`button[data-testid="choice-${firstId}"]`);
  await expect(first).toBeEnabled();
  await rapidInput(page, 'mouse3', first); // 같은 자리를 3번 연속 클릭
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-key', expected.pending!.key);
  await page.waitForTimeout(800); // 입력 가드(400ms)보다 길게: 늦게 처리되는 입력이 없었음을 확인
  expect((await readSave(page)).data).toEqual(expected); // A는 정확히 한 번 해결됐고 B는 대기 중이다
  expect((await readSave(page)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined)).toHaveLength(1);
});

// ---------- 키보드만으로 한 판 ----------

test('키보드만으로 타이틀부터 사망까지 진행할 수 있다 (Tab·Enter·Space)', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  // 기록 카드를 끈 설정으로 시작한다(위 NO_NOTES 설명) — 저장된 설정이 없을 때만 심어, 새로고침해도 사용자가 바꾼 값을 덮지 않는다
  await page.addInitScript(([k, v]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, settingsEnvelope(NO_NOTES)] as const);
  await page.goto('/?__timescale=500');
  const focusedId = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.textContent?.trim() ?? '');
  const tabTo = async (matches: (id: string) => boolean, max = 40) => { // 첫 화면에는 세상·인생 길이·캐러셀(이전·다음·일시정지·슬라이드)·출처 링크가 있어 「태어나기」까지 Tab이 더 필요하다
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      if (matches(await focusedId())) return;
    }
    throw new Error('Tab으로 원하는 요소에 도달하지 못했다');
  };

  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await tabTo((id) => id === 'start-birth');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('roulette-screen')).toBeVisible(); // 룰렛(M3): 키보드로 건너뛴다
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await tabTo((id) => id === 'skip-roulette');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('to-birth')).toBeEnabled(); // 같은 버튼 요소가 「출생신고 보기」가 된다
  await tabTo((id) => id === 'to-birth');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await tabTo((id) => id === 'next-life');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('life-screen')).toBeVisible();

  // 인생 화면: 연출이 빠르게 흐르다가 첫 선택지에서 멈춘다. 수동 모드에서 포커스가 컨트롤 밖(제목 등)에 있을 때 새 선택지가 뜨면
  // 앱이 포커스를 선택지 제목으로 옮기므로(R-036), 그 순간이 지나기 전에 Tab을 누르면 포커스가 갑자기 움직여 입력이 어긋난다
  // (부하가 큰 실행에서 드물게 재현됨). 그래서 화면이 안정된 때(선택지가 떠서 시간이 멈추고 포커스가 제목에 놓인 때)를 기다린 뒤 키보드로 이동한다.
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(focusedId).toBe('choice-title');
  // 인생 화면 컨트롤은 화면이 뜬 직후 입력 가드가 걸려 있다(R-035): 풀린 뒤에 눌러야 한다.
  await expect(page.getByTestId('auto')).toBeEnabled();
  // 자동 모드 토글까지 Tab으로 간다(선택지 제목 → 선택지 버튼들 → 속도 4개 → 다음 결정으로(대기 중이라 aria-disabled지만 Tab 순서에는 그대로 있다, R-036) → 자동 모드 순서) → Space로 켠다
  // 수동 모드의 카드는 모달 시트라 컨트롤이 inert다(M7b) — Esc로 카드를 접으면 포커스가 「결정 다시 열기」로 가고 컨트롤에 닿는다. 접은 동안은 자동 선택도 멈추므로(U3(a)) 자동 모드를 켠 뒤 다시 열어야 이어진다
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await expect.poll(focusedId).toBe('decision-reopen');
  await page.getByTestId('life-name').focus();
  await tabTo((id) => id === 'auto', 20);
  await expect(page.getByTestId('auto')).toBeEnabled(); // 카드를 접은 직후 0.4초는 컨트롤의 입력 가드가 눌림을 삼킨다 (M7b U9)
  await page.keyboard.press('Space');
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('decision-reopen')).toBeEnabled();
  await page.getByTestId('decision-reopen').focus();
  await page.keyboard.press('Enter'); // 다시 열기 — 이제 자동 모드의 인라인 카드이고 곧 스스로 고른다
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 60_000 });
  expect((await readSave(page)).data.phase).toBe('ending');
  expect(errors).toEqual([]);
});

test('키보드로 선택지를 고른다: 복원된 선택지도 선택지 제목에 포커스가 있고 Tab 한 번에 첫 선택지로 간다 (플레이 중 뜬 선택지와 같은 대상, R-036)', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/');
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  const first = page.locator(`button[data-testid="choice-${decision.pending!.choiceIds[0]}"]`);
  await expect(first).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('choice-title');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H2');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(`choice-${decision.pending!.choiceIds[0]}`);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined).length).toBe(1);
});

// ---------- 자동 모드 해제 / 가려진 탭 ----------

test('자동 모드는 언제든 해제할 수 있다: 해제하면 대기 중인 자동 선택이 취소되고 선택지에서 멈춘다', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  // 자동 선택 지연을 시간 배율 0.4로 늘린다(3초 → 7.5초): 부하로 클릭이 늦어져도 해제가 선택보다 먼저 일어난다. 해제는 그 지연이 다 지나도록 지켜본다.
  const AUTO_DELAY_MS = 3000 / 0.4;
  await injectSave(page, decision, '/?__timescale=0.4', { speed: 1, autoMode: true });
  const panel = page.getByTestId('choice-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('auto-note')).toBeVisible();
  await page.getByTestId('auto').click(); // 입력 가드가 풀릴 때까지 Playwright가 기다린다
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'false');
  expect((await readSettings(page)).autoMode).toBe(false);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet'); // 인라인 카드가 그 자리에서 모달 시트로 바뀐다
  await expect(page.getByTestId('auto-note')).toHaveText('자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.');
  await page.waitForTimeout(AUTO_DELAY_MS + 500); // 취소됐다면 지연이 다 지나도 선택지가 그대로 남는다
  await expect(panel).toHaveAttribute('data-key', decision.pending!.key);
  expect((await readSave(page)).data).toEqual(decision);
  await expect(page.getByTestId('skip')).toBeDisabled();
});

test('자동 모드가 켜져 있으면 선택지를 잠깐 보여 준 뒤 성향대로 스스로 고르고 이어간다', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/?__timescale=5', { speed: 8, autoMode: true });
  await expect.poll(async () => (await readSave(page)).data.history.filter((h) => h.kind === 'choice' && h.eventId === decision.pending!.eventId).length).toBe(1);
  const auto = await evalCore<GameState>(page, 'return core.autoResolveStep(arg, arg.pending.key).state;', decision);
  const entry = (await readSave(page)).data.history.find((h) => h.kind === 'choice' && h.eventId === decision.pending!.eventId)!;
  expect(entry).toEqual(auto.history[auto.history.length - 1]); // core의 자동 선택과 같은 선택지를 골랐다
});

test('탭이 가려져 있는 동안은 진행이 멈추고, 다시 보이면 이어진다', async ({ page }) => {
  const { start } = await lifeWithDecision(page);
  await injectSave(page, start, '/?__timescale=20', { speed: 1, autoMode: true }); // 자동 모드라 선택지에서 멈추지 않고 계속 흐른다
  await expect.poll(async () => (await readSave(page)).data.age).toBeGreaterThan(0);
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  await page.waitForTimeout(150); // 이미 걸린 타이머가 있었다면 그 한 걸음은 끝날 수 있다
  const frozen = (await readSave(page)).data;
  await page.waitForTimeout(600);
  expect((await readSave(page)).data).toEqual(frozen);
  await setVisibility('visible');
  await expect.poll(async () => JSON.stringify((await readSave(page)).data)).not.toBe(JSON.stringify(frozen));
});

// ---------- 다중 탭 (R-011) ----------

test('다중 탭: 다른 탭이 저장을 바꾸면 이 탭은 멈추고(덮어쓰지 않음), "이 탭에서 이어하기"로 최신 상태를 이어받는다 (R-011)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  // 시간 배율 0.25: 두 탭이 선택 뒤 저절로 한 해를 진행하는 시각(8초 → 32초)을 늦춘다. 아래 단계가 부하로 늦어져도 진행 타이머가 끼어들어
  // 밀린 탭을 다시 밀어내지 않는다. 이 탭의 진행은 마지막에 "다음 결정으로"를 눌러 직접 일으킨다(타이머를 기다리지 않는다).
  const SLOW = '/?__timescale=0.25';
  await injectSave(page, decision, SLOW, NO_NOTES);
  await expect(page.getByTestId('choice-panel')).toBeVisible();

  // 같은 저장을 연 두 번째 탭에서 선택한다
  const page2 = await context.newPage();
  const errors2 = trackErrors(page2);
  await page2.goto(SLOW);
  await expect(page2.getByTestId('choice-panel')).toBeVisible();
  const firstId = decision.pending!.choiceIds[0];
  const first2 = page2.locator(`button[data-testid="choice-${firstId}"]`);
  await expect(first2).toBeEnabled();
  await first2.click();
  await expect.poll(async () => (await readSave(page2)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined).length).toBe(1);

  // 첫 탭은 "다른 탭에서 저장이 바뀜" 화면으로 바뀌고 선택지 화면을 더 이상 보이지 않는다
  await expect(page.getByTestId('superseded-screen')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  const afterChoose = (await readSave(page2)).data;
  // 멈춰 있는 동안 첫 탭이 옛 상태(선택 전)로 되돌려 쓰지 않는다 (오래 기다릴수록 안전한 방향의 부정 확인)
  await page.waitForTimeout(800);
  expect((await readSave(page2)).data.history.length).toBeGreaterThanOrEqual(afterChoose.history.length);
  expect((await readSave(page2)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined)).toHaveLength(1);

  // 첫 탭에서 이어받으면 저장된 최신 상태를 보여 주고(선택 내용이 연표에 있다), 이 탭이 진행하면 이제 두 번째 탭이 멈춘다
  const takeOver = page.getByTestId('take-over');
  await expect(takeOver).toBeEnabled();
  await takeOver.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('log')).toContainText('선택:');
  expect((await readSave(page)).data).toEqual((await readSave(page2)).data);
  // 이 탭이 진행한다: "다음 결정으로"(컨트롤 가드가 풀리면 눌린다) → 저장이 바뀌어 두 번째 탭이 밀린다
  const skip = page.getByTestId('skip');
  await expect(skip).toBeEnabled();
  await skip.click();
  await expect(page2.getByTestId('superseded-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(await noHorizontalOverflow(page2)).toBe(true);
  expect(errors).toEqual([]);
  expect(errors2).toEqual([]);
});

test('다중 탭: 새 탭이 마운트 직후 읽은 값을 그대로 다시 쓰지 않는다 — 열기만 한 탭은 저장소에 한 번도 쓰지 않아 활성 탭을 밀어내지 못한다 (R-047)', async ({ page, context }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/');
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  const before = await readSave(page);
  const settingsBefore = await readSettings(page);

  // 두 번째 탭은 열기만 한다. 같은 값을 다시 쓰면 storage 이벤트는 생기지 않지만(값이 같으므로) 읽은 뒤 활성 탭이 진행했다면
  // 옛 값으로 되돌리게 된다 → 쓰기 자체가 없어야 한다. 이 탭의 localStorage.setItem 호출을 센다.
  const page2 = await context.newPage();
  await page2.addInitScript(() => {
    const w = window as unknown as { __writes: string[] };
    w.__writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (this === window.localStorage) w.__writes.push(k);
      return original.call(this, k, v);
    };
  });
  await page2.goto('/');
  await expect(page2.getByTestId('choice-panel')).toBeVisible();
  await settle(page2);
  expect(await page2.evaluate(() => (window as unknown as { __writes: string[] }).__writes), '열기만 한 탭이 저장소에 썼다').toEqual([]);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('superseded-screen')).toHaveCount(0);
  expect(await readSave(page)).toEqual(before);
  expect(await readSettings(page)).toEqual(settingsBefore);
});

// ---------- 저장 실패 (R-006) ----------

test('저장이 실패해도(쿼터/차단) 가벼운 안내만 띄우고 앱은 계속 동작한다 (R-006)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/');
  const savedBefore = (await readSave(page)).data;
  await expect(page.getByTestId('save-notice')).toHaveCount(0); // 평소에는 안내가 없다

  await page.goto('/?__quota'); // 개발 서버 전용: 저장이 항상 실패하는 저장소
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  // 저장소에 있던 값이 그대로면 다시 쓰지 않으므로(R-047) 아직 저장을 시도하지 않았고 잃을 것도 없다 → 이 시점에는 안내가 없다.
  // 안내는 진행이 생겨 저장을 시도하다 실패할 때 뜬다. (저장소가 비어 있었다면 첫 상태를 쓰려다 실패해 곧바로 뜬다 — 아래 별도 테스트.)
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  // 선택하면 저장을 시도하다 실패해 안내가 뜬다. 안내가 떠 있어도 선택·화면은 계속 동작한다
  const first = page.locator(`button[data-testid="choice-${decision.pending!.choiceIds[0]}"]`);
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.getByTestId('log')).toContainText('선택:');
  await expect(page.getByTestId('save-notice')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toContainText('저장하지 못했습니다');
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect((await readSave(page)).data).toEqual(savedBefore); // 실패했으므로 저장은 그대로
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('저장소가 비어 있고 쓰기가 막혀 있으면(처음 연 사용자, 쿼터/차단) 안내가 곧바로 뜨고, 안내가 떠 있어도 시작할 수 있다 (R-006, R-052)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?__quota'); // 새 브라우저 컨텍스트라 저장소가 비어 있다
  await expect(page.getByTestId('title-screen')).toBeVisible();
  // 읽은 값(없음)과 지금 상태가 달라 첫 상태를 쓰려고 하고, 그 쓰기가 실패한다 → 진행이 없어도 곧바로 안내한다
  await expect(page.getByTestId('save-notice')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toContainText('저장하지 못했습니다');
  await page.getByTestId('start-birth').click();
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY), '저장은 실제로 일어나지 않았다').toBeNull();
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

// ---------- 저장 직전 비교 (R-052) ----------

test('저장소를 읽은 직후, 다른 탭 변경을 알리는 storage 리스너를 붙이는 순간에 그 탭이 저장을 바꿔도 덮어쓰지 않고 밀린 화면이 뜬다 — "이어하기"로 그 탭의 진행을 이어받는다 (결정적: 리스너 등록 순간에 쓰기를 끼워 넣는다, R-052·R-053)', async ({ page, browser }) => {
  // 다른 탭이 쓸 값: 알려진 시드의 다른 인생
  await page.goto('/');
  const other = await oracleLife(page, 4242, 'industrial');
  const otherRaw = JSON.stringify({ version: SAVE_VERSION, data: other });

  // 새 컨텍스트(저장소가 비어 있다)에서, 앱이 저장소를 읽은 뒤 `storage` 리스너를 붙이는 바로 그 순간 "다른 탭"이 저장을 쓴 것처럼 한다.
  // 앱이 읽은 값은 비어 있었고(= 새 게임을 만든다) 저장소에는 이미 다른 인생이 있다. 예전에는 이 새 게임의 첫 저장이 다른 탭의 인생을 덮어썼다.
  // 결정적인 이유(R-053): 저장소 읽기는 렌더 중(useState 초기값)에 끝나고, 리스너는 그다음 passive effect에서 붙으며, 저장 effect는 리스너 effect 뒤에 선언돼 같은 단계에서 이어 돈다.
  // 그래서 `addEventListener('storage')` 호출은 항상 "읽은 뒤, 첫 저장 전"에 일어난다. 이전 테스트는 MutationObserver 콜백이 passive effect보다 먼저 온다는 타이밍 가정에 기댔다.
  // 같은 문서의 localStorage 쓰기는 storage 이벤트를 일으키지 않는다 — 리스너가 붙기 전 다른 탭의 쓰기가 일어난 것과 같다. 개발 서버의 StrictMode는 effect를 두 번 돌리므로 한 번만 쓰도록 막는다.
  const context = await browser.newContext();
  const page2 = await context.newPage();
  const errors = trackErrors(page2);
  await page2.addInitScript(
    ({ key, value }) => {
      const w = window as unknown as { __otherTabWrote: boolean; __storageListenerAdds: number };
      w.__otherTabWrote = false;
      w.__storageListenerAdds = 0;
      const original = window.addEventListener.bind(window) as (type: string, listener: unknown, options?: unknown) => void;
      (window as unknown as { addEventListener: typeof original }).addEventListener = (type, listener, options) => {
        if (type === 'storage') {
          w.__storageListenerAdds++;
          if (!w.__otherTabWrote) {
            w.__otherTabWrote = true;
            window.localStorage.setItem(key, value);
          }
        }
        original(type, listener, options);
      };
    },
    { key: GAME_KEY, value: otherRaw },
  );
  await page2.goto('/');
  await expect(page2.getByTestId('superseded-screen')).toBeVisible();
  await settle(page2);
  expect(await page2.evaluate(() => (window as unknown as { __otherTabWrote: boolean }).__otherTabWrote), '다른 탭의 쓰기를 흉내 냈다').toBe(true);
  expect(await page2.evaluate(() => (window as unknown as { __storageListenerAdds: number }).__storageListenerAdds), 'storage 리스너가 실제로 붙었다').toBeGreaterThanOrEqual(1);
  expect(await page2.evaluate((k) => localStorage.getItem(k), GAME_KEY), '다른 탭의 저장이 이 탭의 새 게임으로 덮어써졌다').toBe(otherRaw);

  // 이어받으면 그 인생이 열린다
  await page2.getByTestId('take-over').click();
  await expect(page2.getByTestId('life-screen')).toBeVisible();
  expect((await readSave(page2)).data.seed).toBe(4242);
  expect(errors).toEqual([]);
  await context.close();
});

test('저장이 막힌 동안 다른 탭이 저장을 바꿔 "이 탭에서 이어하기"로 저장된 최신 상태를 이어받으면 저장 실패 안내가 사라진다 — 쓸 것이 없으니 잃을 것도 없다 (R-052)', async ({ page, context }) => {
  await startPageHidden(page); // 타이머를 멈춰 둔다: 상태는 눌러서만 바뀐다
  // 이 탭의 게임 저장만 실패시키는 스위치(__failGame). 설정 저장은 그대로라 설정 쪽 안내가 섞이지 않는다.
  await page.addInitScript((key) => {
    const w = window as unknown as { __failGame: boolean };
    w.__failGame = false;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (this === window.localStorage && k === key && w.__failGame) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, k, v);
    };
  }, GAME_KEY);
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/');
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toHaveCount(0);

  // 1) 저장이 막힌 채 선택한다 → 저장을 시도하다 실패해 안내가 뜬다
  await page.evaluate(() => ((window as unknown as { __failGame: boolean }).__failGame = true));
  const firstId = decision.pending!.choiceIds[0];
  const first = page.locator(`button[data-testid="choice-${firstId}"]`);
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.getByTestId('save-notice')).toBeVisible();

  // 2) 다른 탭이 저장소(여전히 선택 전 상태)를 열어 같은 선택을 하고 저장한다
  const page2 = await context.newPage();
  await startPageHidden(page2);
  await page2.goto('/');
  await expect(page2.getByTestId('choice-panel')).toBeVisible();
  const first2 = page2.locator(`button[data-testid="choice-${firstId}"]`);
  await expect(first2).toBeEnabled();
  await first2.click();
  await expect.poll(async () => (await readSave(page2)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined).length).toBe(1);

  // 3) 첫 탭은 밀렸다 → 이어받으면 저장된 최신 상태를 보여 주고 실패 안내는 사라진다 (저장은 아직 막혀 있어도 쓸 것이 없다)
  await expect(page.getByTestId('superseded-screen')).toBeVisible();
  await page.getByTestId('take-over').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  await settle(page);
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  expect((await readSave(page)).data).toEqual((await readSave(page2)).data);
});

// ---------- 손상된 저장 ----------

test('대기 중인 선택지가 실제 이벤트와 맞지 않는 저장: 모양이 어긋난 것(손상)은 크래시 없이 새 게임, 풀과만 어긋난 것(콘텐츠 갱신)은 대기만 풀고 같은 인생으로 이어진다 (R-046)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  const pending = decision.pending!;
  // 1) 모양이 어긋난 저장(손상·변조): 새 게임
  const shapeBroken: GameState[] = [
    // 이벤트 id만 바꾸고 본 이벤트 기록(seen)은 그대로 — 저장 안에서 서로 맞지 않는다
    { ...decision, pending: { ...pending, eventId: 'no-such-event', key: `no-such-event@${decision.age}` } },
    // 선택지가 1개
    { ...decision, pending: { ...pending, choiceIds: [pending.choiceIds[0]] } },
  ];
  for (const v of shapeBroken) {
    await injectSave(page, v, '/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  }
  // 2) 모양은 멀쩡하고 풀과만 어긋난 저장(이벤트가 사라졌거나 선택지가 바뀐 콘텐츠 갱신): 인생을 버리지 않고 대기만 푼다
  const stale: GameState[] = [
    { ...decision, pending: { ...pending, choiceIds: ['no-such-choice', pending.choiceIds[0]] } },
    { ...decision, pending: { ...pending, eventId: 'no-such-event', key: `no-such-event@${decision.age}` }, seen: { ...decision.seen, 'no-such-event': decision.age } },
  ];
  for (const v of stale) {
    await injectSave(page, v, '/', NO_NOTES); // 기록 카드가 뜰 나이라 시트가 「다음 결정으로」를 가리지 않게(NO_NOTES 설명)
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('choice-panel')).toHaveCount(0); // 대기는 풀렸다
    await expect(page.getByTestId('life-name')).toHaveText(decision.character!.name); // 같은 인물
    await expect(page.getByTestId('life-age')).toContainText(`${decision.age}세`);
    // 이어서 진행된다 (R-066: 예전 단언 `age >= decision.age`는 항상 참이었다). 컨트롤의 입력 가드(0.4초)가 풀린 것을 확인한 뒤 "다음 결정으로"를 누르면
    // 풀린 해가 다시 진행된다. 선택지는 최소 2년 간격이라 같은 해에는 다시 뜨지 않으므로 저장의 나이가 실제로 오르거나(새 선택지가 뜨면 다른 key), 그 사이 사망해 엔딩이 된다.
    // 클릭이 가드에 먹히거나 진행이 멈춰 있으면 나이가 그대로라 이 단언이 실패한다.
    const skip = page.getByTestId('skip');
    await expect(skip).not.toHaveAttribute('aria-disabled', 'true');
    await skip.click();
    await expect
      .poll(async () => {
        const d = (await readSave(page)).data;
        return d.phase === 'ending' || d.age > decision.age;
      })
      .toBe(true);
    const save = (await readSave(page)).data;
    expect(save.character).toEqual(decision.character);
    expect(save.pending?.key).not.toBe(pending.key);
  }
  expect(errors).toEqual([]);
});

test('첫 결정 상태에서 자동 모드로 이어도 core 자동 진행과 같은 결과가 나온다 (중간에서 시작한 판)', async ({ page }) => {
  const { start } = await lifeWithDecision(page, 'industrial');
  const decision = await oracleDecision(page, start);
  await injectSave(page, decision, '/?__timescale=3000', { speed: 8, autoMode: true });
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 30_000 });
  expect((await readSave(page)).data).toEqual(await oracleAuto(page, decision));
});

// ---------- 같은 탭에서 저장을 직접 지우거나 바꾼 뒤 새로고침 (QA가 흔히 하는 조작) ----------

test('개발자 도구로 같은 탭의 저장을 지우고 새로고침하면 새 게임이다 (떠나는 앱이 지워진 저장을 되살리지 않는다)', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/');
  await expect(page.getByTestId('choice-panel')).toBeVisible();

  // 이 탭의 앱은 살아 있는 채로 저장만 지운다(앱을 멈추는 헬퍼를 쓰지 않는다: localStorage.clear() 후 reload와 같은 조작)
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect((await readSave(page)).data.phase).toBe('title');

  // 같은 탭에서 저장을 다른 인생으로 바꿔도 그 변경이 존중된다
  const other = await oracleLife(page, 4242, 'industrial');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: other })],
  );
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect((await readSave(page)).data.seed).toBe(4242);
});

test('저장 쓰기 없이 곧바로 떠나도 마지막 상태는 남는다: 선택 직후 바로 새로고침해도 그 선택이 저장돼 있다', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/');
  const first = page.locator(`button[data-testid="choice-${decision.pending!.choiceIds[0]}"]`);
  await expect(first).toBeEnabled();
  await first.click();
  await page.reload({ waitUntil: 'commit' }); // 효과(저장)가 돌기 전에 떠날 수도 있다
  await page.waitForLoadState();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect((await readSave(page)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined)).toHaveLength(1);
});

test('이름·연표 글에 방향 제어·제로폭 문자가 든 저장은 손상으로 보고 크래시 없이 첫 화면으로 시작한다 (QA-003-M7b A12b)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  const ch = (cp: number) => String.fromCodePoint(cp);
  const name = decision.character!.name;
  const tampered: Array<[string, GameState]> = [
    ['이름 끝 RLO(U+202E)', { ...decision, character: { ...decision.character!, name: `${name}${ch(0x202e)}` } }],
    ['이름 앞 제로폭 공백(U+200B)', { ...decision, character: { ...decision.character!, name: `${ch(0x200b)}${name}` } }],
    ['이름 가운데 RLI(U+2067)', { ...decision, character: { ...decision.character!, name: `${name.slice(0, 1)}${ch(0x2067)}${name.slice(1)}` } }],
    ['이름 BOM(U+FEFF)', { ...decision, character: { ...decision.character!, name: `${name}${ch(0xfeff)}` } }],
    ['연표 글 LRM(U+200E)', { ...decision, history: decision.history.map((h, i) => (i === 0 ? { ...h, text: `${h.text}${ch(0x200e)}` } : h)) }],
  ];
  for (const [label, state] of tampered) {
    await injectSave(page, state, '/');
    await expect(page.getByTestId('title-screen'), label).toBeVisible();
    await expect(page.getByTestId('life-screen'), label).toHaveCount(0);
  }
  // 대조: 고치지 않은 저장은 인생 화면으로 이어진다 — 위 거부가 문자 때문이지 다른 변조 때문이 아니다
  await injectSave(page, decision, '/');
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('life-name')).toHaveText(name);
  expect(errors).toEqual([]);
});
