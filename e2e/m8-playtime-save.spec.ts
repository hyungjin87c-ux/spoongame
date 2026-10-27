import { expect, test, type Page } from '@playwright/test';
import type { GameState, PlayTime } from '../src/core/types';
import { findPendingState, injectSave, quietStart, readSave, setPageVisible, startPageHidden, withPlay } from './helpers';
import { infantDue, sheetReady } from './m7cStates';

/**
 * M8 플레이 시간의 저장 규칙과 탭 가림 (SPEC-003 LM5·LM6, REV-003-M8-1 R-417·R-422).
 *
 * R-417 — 시간을 재는 판(withPlay)에서 열기만 한 탭이 저장소에 쓰면 활성 탭이 밀린 화면으로 가고(R-047), 저장이 막힌 기기에서 열자마자 실패 안내가 뜬다(R-006·NC-11).
 * 오라클 상태를 주입하는 e2e는 play를 빼서(withoutPlay) 시간을 재지 않는 판으로만 돌았기에 이 변화를 보지 못했다 — 같은 시험을 withPlay 판으로 한 번 더 건다(원래 시험은 그대로 둔다).
 * 쓰는 규칙(App.tsx#flush, core/storage.ts#isIdleOnlyChange): hold·decide·fold·note·skips가 마지막 쓰기 뒤에 늘었거나 인생 상태가 다를 때만 쓴다. idle(일시정지·탭 가림·나가기 확인)과 이어하기 횟수만 달라지면 쓰지 않는다.
 * 이어하기 횟수는 앱이 뜰 때가 아니라 그 탭에서 hold·decide가 처음 쌓일 때 오른다(core/playTimer.ts).
 *
 * R-422 — 타이머가 렌더를 기다리지 않고 탭 가림을 직접 안다: 모바일에서 앱을 벗어나면 렌더가 버킷을 idle로 바꾸기 전에 페이지가 멈출 수 있고, 돌아왔을 때 멈춘 시간이 렌더 전 버킷(hold)에 들어가던 것을 막는다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;
const NOTE_MANUAL = { speed: 1, autoMode: false, noteCards: true } as const;
const GAME = 'suzeo-game:save';

/** 앱의 타이머가 지금까지 쌓은 기록 (개발 전용 탐침 window.__playTime — 저장하지 않고 읽는다) */
async function playNow(page: Page): Promise<PlayTime> {
  const play = await page.evaluate(() => (window as unknown as { __playTime?: () => PlayTime | null }).__playTime?.() ?? null);
  expect(play, '시간을 재는 판은 타이머 기록이 있다').not.toBeNull();
  return play!;
}

/** 이 탭이 앱이 뜬 뒤 localStorage에 쓴 키 목록을 센다. addInitScript라 문서가 새로 열릴 때마다 0에서 시작한다 — injectSave가 심는 쓰기는 앞 문서의 것이라 세지 않는다. goto보다 먼저 부른다. */
async function countWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __writes: string[] };
    w.__writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (this === window.localStorage) w.__writes.push(k);
      return original.call(this, k, v);
    };
  });
}
const writesOf = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __writes: string[] }).__writes.slice());

/** visibilityState를 속일 수 있게 getter를 건다(보이는 채로 시작) — setPageVisible로 가림·보임을 바꾼다 */
async function fakeVisibility(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __vis: string };
    w.__vis = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => w.__vis });
  });
}

test.describe('R-417 시간을 재는 판: 수동적인 시간만 바뀐 탭은 쓰지 않는다', () => {
  test('일시정지해 둔 채 열린 탭은 열기 · 몇 초 기다리기 · 탭 가림 · 닫힘(pagehide) 어디서도 저장소에 쓰지 않는다 — idle만 쌓이고 이어하기도 오르지 않는다', async ({ page }) => {
    test.setTimeout(60_000);
    await countWrites(page);
    await page.goto('/');
    const start: GameState = { ...withPlay(await quietStart(page, 6)), paused: true };
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    await page.waitForTimeout(2500);
    // 탭이 가려졌다가 닫힌다
    await fakeVisibility(page);
    await setPageVisible(page, false);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(500);
    // 게임 저장만 센다 — 주입한 설정 원문이 앱의 표준 모양과 달라 앱이 뜰 때 설정을 한 번 다시 쓰는 것은 이 시험과 무관한 기존 동작이다
    expect((await writesOf(page)).filter((k) => k === GAME), '아무것도 하지 않은 탭이 게임 저장에 썼다').toEqual([]);
    const play = await playNow(page);
    expect(play.idle, '일시정지 · 탭 가림 시간이 idle에 쌓였다').toBeGreaterThan(2500);
    expect(play.hold).toBe(0);
    expect(play.resumes, '아무것도 하지 않았으니 이어하기도 오르지 않는다').toBe(0);
    expect((await readSave(page)).data.play, '저장은 심은 그대로').toEqual(start.play);
  });

  test('반대로 사람이 한 일(연출이 흐른 시간)이 있으면 pagehide에서 쓰이고 이어하기가 하나 오른다 — 일시정지를 풀어 2.5초 흘린 뒤', async ({ page }) => {
    test.setTimeout(60_000);
    await countWrites(page);
    await page.goto('/');
    const start: GameState = { ...withPlay(await quietStart(page, 6)), paused: true };
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.getByTestId('pause').click(); // 일시정지 해제 — 상태가 바뀌어 저장된다
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'false');
    await page.waitForTimeout(2500);
    await page.evaluate(() => ((window as unknown as { __writes: string[] }).__writes = []));
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // hold가 늘었으니 쓴다
    expect(await writesOf(page), '연출이 흐른 시간은 저장소에 쓰인다').toContain(GAME);
    const saved = (await readSave(page)).data.play!;
    expect(saved.hold).toBeGreaterThan(1500);
    expect(saved.resumes, '이 탭에서 hold가 처음 쌓일 때 이어하기 한 번').toBe(1);
  });

  // R-047 / QA TB01 (content-M8 13-3 (가)): 열기만 한 탭은 저장소에 쓰지 않아 활성 탭을 밀어내지 못한다. 관찰 창은 7초(첫 해 연출 11.81초(계수 1.6875, LM7b)·10초 주기 저장 이전)이고 게임 키·설정 키 모두 센다.
  type Kind = 'pending' | 'running' | 'paused';
  const startOf = async (page: Page, kind: Kind): Promise<GameState> => {
    if (kind === 'pending') return withPlay(await findPendingState(page, 'alpha'));
    const quiet = withPlay(await quietStart(page, 6));
    return kind === 'paused' ? { ...quiet, paused: true } : quiet;
  };
  const readyOf = (p: Page, kind: Kind) => (kind === 'pending' ? p.getByTestId('choice-panel') : p.getByTestId('life-screen'));

  for (const kind of ['pending', 'running', 'paused'] as const) {
    test(`R-047 · TB01-${kind} (시간을 재는 판): 같은 저장을 두 번째 탭으로 열기만 하면 7초 동안 setItem을 한 번도 부르지 않고(게임 키·설정 키) 첫 탭은 밀리지 않는다`, async ({ page, context }) => {
      test.setTimeout(60_000);
      await page.goto('/');
      await injectSave(page, await startOf(page, kind), '/', MANUAL);
      await expect(readyOf(page, kind)).toBeVisible();
      await page.waitForTimeout(500); // 첫 탭이 주입한 설정 원문을 앱의 표준 모양으로 다시 쓸 시간 — 이후 두 번째 탭은 표준 모양의 저장을 읽는다
      const before = (await readSave(page)).data;

      const page2 = await context.newPage();
      await countWrites(page2);
      await page2.goto('/');
      await expect(readyOf(page2, kind)).toBeVisible();
      await page2.waitForTimeout(7000); // 열자마자 쓰는 쓰기(이어하기 횟수를 앱이 뜰 때 올리던 때)가 있었다면 이 안에 일어난다
      expect(await writesOf(page2), '열기만 한 탭이 저장소에 썼다').toEqual([]);
      await expect(readyOf(page, kind)).toBeVisible();
      await expect(page.getByTestId('superseded-screen')).toHaveCount(0);
      if (kind !== 'running') {
        // 연출이 흐르지 않는 상태는 첫 탭의 인생 상태가 그대로다(첫 탭의 10초 flush가 끼었을 수 있어 play는 빼고 본다)
        expect({ ...(await readSave(page)).data, play: undefined }).toEqual({ ...before, play: undefined });
      }
    });
  }

  test('TB01-bg (시간을 재는 판): 가려진 채 열린 두 번째 탭은 7초 동안 쓰지 않고 첫 탭은 밀리지 않는다', async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await injectSave(page, withPlay(await findPendingState(page, 'alpha')), '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(500);
    const page2 = await context.newPage();
    await startPageHidden(page2);
    await countWrites(page2);
    await page2.goto('/');
    await expect(page2.getByTestId('choice-panel')).toBeVisible();
    await page2.waitForTimeout(7000);
    expect(await writesOf(page2), '가려진 채 열린 탭이 저장소에 썼다').toEqual([]);
    await expect(page.getByTestId('superseded-screen')).toHaveCount(0);
    const play = await playNow(page2);
    expect(play.idle, '가려진 시간은 idle').toBeGreaterThan(5000);
    expect(play.decide).toBe(0);
  });

  test('TB01-close (시간을 재는 판): 열자마자 곧바로 닫은 두 번째 탭(pagehide · 가림)은 쓰지 않아 첫 탭을 밀어내지 못한다 — 마지막 쓰기 뒤 1.5초 미만의 시간은 쓸 만큼이 아니다', async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await injectSave(page, withPlay(await findPendingState(page, 'alpha')), '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(500);
    for (const how of ['pagehide', 'hidden'] as const) {
      const page2 = await context.newPage();
      await countWrites(page2);
      await page2.goto('/');
      await expect(page2.getByTestId('choice-panel')).toBeVisible();
      const open = await playNow(page2);
      expect(open.decide, '열고 곧바로 — 사람의 시간이 1.5초에 못 미친다').toBeLessThan(1500);
      if (how === 'pagehide') await page2.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      else {
        await fakeVisibility(page2);
        await setPageVisible(page2, false);
      }
      expect(await writesOf(page2), `${how}로 닫은 탭이 저장소에 썼다`).toEqual([]);
      await page2.close();
      await page.waitForTimeout(300);
      await expect(page.getByTestId('superseded-screen'), `${how}`).toHaveCount(0);
    }
  });

  test('TB01-pausedA (시간을 재는 판): 첫 탭을 일시정지해 둔 채 배경 탭을 열었다 닫기만 해도 쓰이지 않고 첫 탭은 밀리지 않는다', async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    const paused: GameState = { ...withPlay(await quietStart(page, 6)), paused: true };
    await injectSave(page, paused, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(500);
    const page2 = await context.newPage();
    await startPageHidden(page2);
    await countWrites(page2);
    await page2.goto('/');
    await expect(page2.getByTestId('life-screen')).toBeVisible();
    await page2.waitForTimeout(2500);
    await page2.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await writesOf(page2)).toEqual([]);
    await page2.close();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('superseded-screen')).toHaveCount(0);
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
  });

  test('R-006 (시간을 재는 판): 저장이 막힌 기기(?__quota)에서 열자마자 실패 안내가 뜨지 않는다 — 진행이 있어야(선택) 저장을 시도하고 그때 안내가 뜬다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    const decision = withPlay(await findPendingState(page, 'alpha'));
    await injectSave(page, decision, '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(500); // 앱이 주입된 설정 원문을 표준 모양으로 다시 쓸 시간 — 막힌 페이지는 표준 모양을 읽어 설정을 다시 쓰려 하지 않는다
    await page.goto('/?__quota'); // 떠나는 앱의 pagehide flush가 쌓인 시간(decide)을 쓰는 것은 정상이다 — 기준은 막힌 페이지가 뜬 뒤의 저장이다
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(1500); // 앱이 뜬 직후의 첫 저장 effect가 돌 시간
    const savedBefore = (await readSave(page)).data;
    await expect(page.getByTestId('save-notice'), '진행이 없으면 아직 저장을 시도하지 않는다').toHaveCount(0);
    const first = page.locator(`button[data-testid="choice-${decision.pending!.choiceIds[0]}"]`);
    await expect(first).toBeEnabled();
    await first.click();
    await expect(page.getByTestId('log')).toContainText('선택:');
    await expect(page.getByTestId('save-notice')).toBeVisible();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    expect((await readSave(page)).data, '저장은 그대로(쓰기가 실패했다)').toEqual(savedBefore);
  });

  test('NC-11 (시간을 재는 판): 저장이 막힌 기기에서 기록 시트가 떠 있어도 진행이 없으면 실패 안내가 없고, 글을 담으면 안내가 뜬다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    const due = await infantDue(page);
    await injectSave(page, withPlay(due.state), '/', NOTE_MANUAL);
    await sheetReady(page);
    await page.goto('/?__quota'); // 떠나는 앱의 pagehide flush가 쌓인 시간(기록 시트를 연 note)을 쓰는 것은 정상이다 — 기준은 막힌 페이지가 뜬 뒤의 저장이다
    await sheetReady(page);
    await page.waitForTimeout(1500);
    const savedBefore = JSON.stringify((await readSave(page)).data);
    await expect(page.getByTestId('save-notice'), '진행이 없으면 아직 저장을 시도하지 않는다').toHaveCount(0);
    await page.getByTestId('note-input').fill('저장이 막힌 곳에서 쓴 글');
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('note-sheet')).toHaveCount(0);
    await expect(page.getByTestId('save-notice')).toBeVisible();
    expect(JSON.stringify((await readSave(page)).data), '저장소는 그대로(쓰기가 실패했다)').toBe(savedBefore);
  });

  test('R-011 (시간을 재는 판): 다른 탭이 저장을 바꾸면 이 탭은 멈추고 "이 탭에서 이어하기"로 최신 상태를 이어받는다 — 이어받은 판도 타이머가 다시 쌓는다', async ({ page, context }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const decision = withPlay(await findPendingState(page, 'alpha'));
    const SLOW = '/?__timescale=0.25';
    await injectSave(page, decision, SLOW, MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    const page2 = await context.newPage();
    await page2.goto(SLOW);
    await expect(page2.getByTestId('choice-panel')).toBeVisible();
    const first2 = page2.locator(`button[data-testid="choice-${decision.pending!.choiceIds[0]}"]`);
    await expect(first2).toBeEnabled();
    await first2.click();
    await expect.poll(async () => (await readSave(page2)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined).length).toBe(1);
    await expect(page.getByTestId('superseded-screen')).toBeVisible();
    await expect(page.getByTestId('choice-panel')).toHaveCount(0);
    await page.waitForTimeout(800);
    expect((await readSave(page2)).data.history.filter((h) => h.kind === 'choice' && h.by === undefined)).toHaveLength(1);
    // 첫 탭에서 이어받으면 저장된 최신 상태(선택이 연표에 있다)를 보여 주고, 이 탭이 진행하면 두 번째 탭이 멈춘다
    const takeOver = page.getByTestId('take-over');
    await expect(takeOver).toBeEnabled();
    await takeOver.click();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('log')).toContainText('선택:');
    await page.waitForTimeout(1500);
    const adopted = await playNow(page);
    expect(adopted.hold + adopted.decide, '이어받은 판을 이 탭의 타이머가 다시 쌓는다').toBeGreaterThan(0);
    const skip = page.getByTestId('skip');
    await expect(skip).toBeEnabled();
    await skip.click();
    await expect(page2.getByTestId('superseded-screen')).toBeVisible();
  });

  test('M-2 (시간을 재는 판): 저장이 막힌 기기에서 결정 카드를 13.5초 열어 두어도(10초 주기 저장이 실패해도) · 탭 가림 · pagehide에서도 실패 안내가 없다 — 안내는 인생 상태를 담는 저장이 실패할 때만 뜬다 (마스터 결정 M-2, QA TB02-13s)', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const decision = withPlay(await findPendingState(page, 'alpha'));
    await injectSave(page, decision, '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(500);
    await page.goto('/?__quota');
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('save-notice'), '열자마자 안내 없음').toHaveCount(0);
    await page.waitForTimeout(13_500); // 10초 주기 저장이 한 번 돌고 실패한다
    const play = await playNow(page);
    expect(play.decide, '10초 주기 저장이 돌 만큼 카드를 읽었다(사람의 시간이 쌓였으니 flush는 쓰려 한다)').toBeGreaterThan(12_000);
    await expect(page.getByTestId('save-notice'), '주기 저장의 실패는 안내하지 않는다').toHaveCount(0);
    // 탭 가림·pagehide flush의 실패도 안내하지 않는다
    await fakeVisibility(page);
    await setPageVisible(page, false);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(500);
    await expect(page.getByTestId('save-notice'), '가림·pagehide 저장의 실패는 안내하지 않는다').toHaveCount(0);
    await setPageVisible(page, true);
    // 대조: 인생 상태를 담는 저장(선택)이 실패하면 안내가 뜨고 앱은 계속 동작한다
    const first = page.locator(`button[data-testid="choice-${decision.pending!.choiceIds[0]}"]`);
    await expect(first).toBeEnabled();
    await first.click();
    await expect(page.getByTestId('log')).toContainText('선택:');
    await expect(page.getByTestId('save-notice')).toBeVisible();
    await expect(page.getByTestId('life-screen')).toBeVisible();
  });

  test('M-1 허용한 경우: 다른 탭이 가려져 있고 이 탭이 결정 카드를 10초 넘게 보이게 띄워 두면(decide가 쌓이면) 이 탭이 저장소에 쓴다 — 쓰면 가려진 탭이 밀린 화면이 된다 (마지막 쓰기 우선, R-011)', async ({ page, context }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const decision = withPlay(await findPendingState(page, 'alpha'));
    await injectSave(page, decision, '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    // 첫 탭은 가려진 탭(배경 탭)이 된다: 가려진 동안 시간은 idle이라 이 탭은 쓰지 않는다
    await fakeVisibility(page);
    await setPageVisible(page, false);
    const page2 = await context.newPage();
    await countWrites(page2);
    await page2.goto('/');
    await expect(page2.getByTestId('choice-panel')).toBeVisible();
    await page2.waitForTimeout(3000);
    expect(await writesOf(page2), '10초 전에는 쓰지 않는다').toEqual([]);
    await expect.poll(async () => (await writesOf(page2)).includes(GAME), { timeout: 20_000, message: '보이는 탭이 결정 카드를 10초 넘게 띄우면 쓴다' }).toBe(true);
    expect((await readSave(page2)).data.play!.decide, '실제로 읽은 시간이 저장됐다').toBeGreaterThan(8000);
    await expect(page.getByTestId('superseded-screen'), '가려져 있던 첫 탭은 밀린다').toBeVisible();
  });
});

test.describe('R-422 탭 가림: 타이머가 렌더를 기다리지 않고 가려짐을 직접 안다', () => {
  async function playing(page: Page): Promise<void> {
    await page.goto('/');
    const start = withPlay(await quietStart(page, 6));
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await fakeVisibility(page);
  }

  test('가려짐 이벤트 직후 메인 스레드가 7초 멈춰(렌더도 타이머도 못 돈다 — 앱 전환 · 절전의 모사) 렌더가 늦게 따라와도, 멈춘 시간은 hold가 아니라 idle이다', async ({ page }) => {
    test.setTimeout(90_000);
    await playing(page);
    await page.waitForTimeout(1500);
    const before = await playNow(page);
    expect(before.hold).toBeGreaterThan(1000);
    // 가려짐 이벤트를 보낸 같은 작업에서 7초 동안 메인 스레드를 붙잡는다 → React의 렌더(버킷을 idle로 바꾸는 일)는 그 뒤에야 온다
    await page.evaluate(() => {
      const w = window as unknown as { __vis: string };
      w.__vis = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      const t0 = performance.now();
      while (performance.now() - t0 < 7000) {
        /* 멈춘 페이지 */
      }
    });
    await page.waitForTimeout(800); // 늦게 따라오는 렌더·타이머
    const hidden = await playNow(page);
    expect(hidden.hold - before.hold + (hidden.decide - before.decide), '멈추기 전 보이던 시간만 더해진다(QA TB04-a: hold + decide 증가 ≤ 1초) — 멈춘 5초가 새면 5초 이상이다').toBeLessThanOrEqual(1000);
    expect(hidden.idle - before.idle, '멈춘 시간은 idle로 (한 번에 5초 클램프)').toBeGreaterThan(3500);
    // 다시 보이면 hold가 이어진다
    await setPageVisible(page, true);
    await page.waitForTimeout(1500);
    const back = await playNow(page);
    expect(back.hold - hidden.hold, '다시 보인 뒤 1.5초').toBeGreaterThan(800);
    expect(back.hold - hidden.hold).toBeLessThan(2600);
  });

  test('실제 브라우저의 페이지 수명주기 동결(CDP Page.setWebLifecycleState frozen) 7초 뒤에도 hold가 늘지 않는다 — 가려진 탭이 동결됐다 풀린 경우', async ({ page }) => {
    test.setTimeout(90_000);
    await playing(page);
    await page.waitForTimeout(1500);
    const cdp = await page.context().newCDPSession(page);
    await setPageVisible(page, false);
    await page.waitForTimeout(400); // 렌더가 버킷을 idle로 옮길 시간 (이 시험은 렌더 뒤 동결 — 렌더 전 동결은 위 시험)
    const before = await playNow(page);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await new Promise((resolve) => setTimeout(resolve, 7000));
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await page.waitForTimeout(800);
    const after = await playNow(page);
    expect(after.hold - before.hold, '동결 동안 hold가 늘지 않는다').toBeLessThanOrEqual(300);
    expect(after.idle - before.idle, '동결된 시간은 idle (5초 클램프)').toBeGreaterThan(3500);
    await setPageVisible(page, true);
    await page.waitForTimeout(1200);
    const back = await playNow(page);
    expect(back.hold - after.hold).toBeGreaterThan(600);
  });
});
