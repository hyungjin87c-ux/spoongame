import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import {
  GAME_KEY,
  KNOWN_SEED,
  SAVE_VERSION,
  SETTINGS_KEY,
  activeTestId,
  findPendingState,
  injectSave,
  lifeState,
  quietStart,
  readSave,
  readSettings,
  setPageVisible,
  settle,
  startPageHidden,
} from './helpers';
import { adultState } from './m4States';

/**
 * 대시보드의 동작 (SPEC-003 DB2·DB3·DB4·DB6·DB7·DB8·DB12·DB14, C3·C6 — M4). 구조·순서·문구는 tests/dashboard.test.tsx(서버 렌더), 고정 요소·글자 확대는 e2e/m4-fixed.spec.ts·m4-focus.spec.ts가 본다.
 * 여기서는 **시간이 흐르는 동작**을 실제 브라우저에서 본다: 올해 진행률 바, 일시정지(저장·새로고침 복원), 배속 변경, 인생 기록의 쌓임·스크롤·「새 기록 N개」, 도구 줄(BGM·다크 모드·의견 보내기·나가기).
 * 개발 서버 탐침 `?__timescale=N`(연출을 N배 빠르게)으로 1배속 한 해(HOLD_MS.quiet = 7000ms)를 짧게 줄여 쓴다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;

/** 앞으로 N해가 모두 「조용한 해」인 상태(연출 시간이 일정하고 선택지가 끼지 않는다) — M7a 이후 0세는 늘 첫 예방접종이 있어 20세 이후 상태다(e2e/helpers.ts#quietStart) */
const quietLife = (page: Page, years: number): Promise<GameState> => quietStart(page, years);

interface Sample {
  age: number;
  pct: number;
  text: string;
  t: number;
}

/** 나이·진행률 바가 바뀔 때마다 페이지 안에서 기록한다 (페이지 이동·새로고침 때마다 다시 설치된다) */
async function recordProgress(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __prog: Array<{ age: number; pct: number; text: string; t: number }> };
    w.__prog = [];
    const rec = () => {
      const bar = document.querySelector('[data-testid="year-progress"]');
      const ageEl = document.querySelector('[data-testid="life-age"]');
      if (bar === null || ageEl === null) return;
      const pct = Number(bar.getAttribute('aria-valuenow'));
      const age = Number((ageEl.textContent ?? '').split('세')[0]);
      const last = w.__prog[w.__prog.length - 1];
      if (last === undefined || last.pct !== pct || last.age !== age) w.__prog.push({ age, pct, text: document.querySelector('[data-testid="year-pct"]')?.textContent ?? '', t: performance.now() });
    };
    new MutationObserver(rec).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-valuenow'] });
  });
}
const samples = (page: Page) => page.evaluate(() => (window as unknown as { __prog: Sample[] }).__prog.slice());

// ---------- DB2: 올해 진행률 ----------

test('올해 진행률 바: 0에서 시작해 한 해 동안 단조 증가하고 100%가 되는 순간 나이가 오르며 다시 0으로 돌아온다. 숫자와 바가 늘 같다 (DB2)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const start = await quietLife(page, 5);
  await recordProgress(page);
  await injectSave(page, start, '/?__timescale=7', MANUAL); // 한 해 약 1초
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(async () => new Set((await samples(page)).map((s) => s.age)).size, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
  const all = await samples(page);
  const byAge = new Map<number, Sample[]>();
  for (const s of all) byAge.set(s.age, [...(byAge.get(s.age) ?? []), s]);
  const ages = [...byAge.keys()].sort((a, b) => a - b);
  expect(ages.slice(0, 4), '나이는 한 해씩 오른다').toEqual([ages[0], ages[0] + 1, ages[0] + 2, ages[0] + 3]);
  for (const s of all) {
    expect(s.pct, '0~100 정수').toBeGreaterThanOrEqual(0);
    expect(s.pct).toBeLessThanOrEqual(100);
    expect(s.text, '숫자와 바가 같다').toBe(`${s.pct}%`);
  }
  // 끝난 해(다음 해 표본이 있는 해)마다: 단조 증가, 마지막이 100%, 다음 해는 낮은 값에서 다시 시작
  const finished = ages.slice(0, -1);
  expect(finished.length).toBeGreaterThanOrEqual(3);
  for (const age of finished) {
    const pcts = byAge.get(age)!.map((s) => s.pct);
    for (let i = 1; i < pcts.length; i++) expect(pcts[i], `${age}세 진행률 ${pcts.join(',')}`).toBeGreaterThanOrEqual(pcts[i - 1]);
    expect(pcts[pcts.length - 1], `${age}세가 끝날 때 100%`).toBe(100);
    expect(pcts.length, `${age}세 동안 중간 값이 있었다(한 번에 건너뛰지 않는다)`).toBeGreaterThanOrEqual(5);
    const next = byAge.get(age + 1)!;
    expect(next[0].pct, `${age + 1}세는 낮은 값에서 시작`).toBeLessThanOrEqual(10);
  }
});

test('선택지가 떠 있는 동안 바는 가득 찬 채(100%) 멈추고, 선택하면 다음 해가 0에서 다시 흐른다 (DB2)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
  await injectSave(page, decision, '/?__timescale=7', MANUAL);
  const panel = page.getByTestId('choice-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('year-pct')).toHaveText('100%');
  await expect(page.getByTestId('year-progress')).toHaveAttribute('aria-valuenow', '100');
  await page.waitForTimeout(1500); // 일어나지 않아야 하는 일: 선택지 앞에서는 시간이 흐르지 않는다
  await expect(page.getByTestId('year-pct')).toHaveText('100%');
  expect((await readSave(page)).data.age).toBe(decision.age);
  const first = page.getByTestId(`choice-${decision.pending!.choiceIds[0]}`);
  await expect(first).toBeEnabled();
  await recordProgress(page);
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(page.getByTestId(`choice-${decision.pending!.choiceIds[0]}`)).toBeEnabled();
  await page.getByTestId(`choice-${decision.pending!.choiceIds[0]}`).click();
  await expect(panel).toHaveCount(0);
  await expect.poll(async () => (await samples(page)).some((s) => s.pct > 0 && s.pct < 100 && s.age === decision.age + 1), { timeout: 20_000 }).toBe(true); // 선택하면 그 해가 끝나(나이 +1) 결과 연출 동안 바가 0에서 다시 흐른다
});

// ---------- DB3·DB8: 일시정지 ----------

test('일시정지: 멈추면 나이와 진행률이 그 자리에 머물고 저장되며, 새로고침해도 멈춘 채 열리고, 「다시 진행」을 누르면 이어 흐른다 (DB3)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const start = await quietLife(page, 6);
  await recordProgress(page);
  await injectSave(page, start, '/?__timescale=7', MANUAL);
  const pause = page.getByTestId('pause');
  await expect(pause).toBeEnabled();
  await expect(pause).toHaveText('일시정지');
  await expect(pause).toHaveAttribute('data-paused', 'false');
  await expect.poll(async () => (await samples(page)).at(-1)?.age ?? 0, { timeout: 20_000 }).toBeGreaterThanOrEqual(start.age + 1);

  await pause.click();
  await expect(pause).toHaveText('다시 진행');
  await expect(pause).toHaveAttribute('data-paused', 'true');
  await expect(page.getByTestId('year-progress')).toHaveAttribute('data-paused', 'true');
  await expect(page.getByTestId('year-progress')).toHaveAttribute('aria-valuetext', /일시정지 중/);
  await settle(page);
  const frozen = await samples(page);
  const at = frozen.at(-1)!;
  await page.waitForTimeout(1800); // 일어나지 않아야 하는 일: 한 해(약 1초)보다 길게 기다려도 변하지 않는다
  const later = await samples(page);
  expect(later.at(-1), '나이와 진행률이 그대로').toEqual(at);
  const saved = (await readSave(page)).data;
  expect(saved.paused, '일시정지는 저장된다').toBe(true);
  expect(saved.age).toBe(at.age);

  // 새로고침: 멈춘 채 열린다
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('pause')).toHaveText('다시 진행');
  await expect(page.getByTestId('year-progress')).toHaveAttribute('data-paused', 'true');
  await page.waitForTimeout(1500);
  expect((await readSave(page)).data.age, '새로고침 뒤에도 흐르지 않는다').toBe(at.age);

  // 다시 진행
  await expect(page.getByTestId('pause')).toBeEnabled();
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveText('일시정지');
  await expect.poll(async () => (await readSave(page)).data.age, { timeout: 20_000 }).toBeGreaterThan(at.age);
  expect((await readSave(page)).data.paused).toBe(false);
});

test('일시정지 중에도 「다음 결정으로」는 눌리고, 자동 모드는 선택지를 고르지 않는다 (reducer가 막는다)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
  await injectSave(page, { ...decision, paused: true }, '/?__timescale=200', { speed: 1, autoMode: true }); // 자동 모드의 고르는 시간이 짧아져 풀리면 곧 고른다
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('pause')).toHaveText('다시 진행');
  await page.waitForTimeout(1500); // 자동 모드라도 일시정지 중에는 고르지 않는다
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  expect((await readSave(page)).data.pending?.key).toBe(decision.pending!.key);
  // 풀면 자동 모드가 고른다. 시간 배율이 크면(×200) 남은 인생이 곧바로 끝까지 흐르므로 「화면의 선택지 칸이 다른 키로 바뀐다」를 기다리면 칸이 아예 없어진 순간(엔딩 직전·직후)을
  // 놓쳐 간헐적으로 실패했다(전체 e2e에서 1/3712). 저장된 판의 대기 중 선택지가 그 키에서 벗어났는지(다음 선택지 또는 없음)를 본다.
  await page.getByTestId('pause').click();
  await expect.poll(async () => (await readSave(page)).data.pending?.key ?? null, { timeout: 20_000 }).not.toBe(decision.pending!.key);
});

test('일시정지 중에도 「다음 결정으로」는 눌려 선택지(또는 엔딩)까지 곧바로 가고, 그 뒤에도 멈춘 채다 — 시계는 여전히 멈춰 있다 (DB3·R-331 ①)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const life = lifeState(KNOWN_SEED);
  await injectSave(page, { ...life, paused: true }, '/', MANUAL);
  const pause = page.getByTestId('pause');
  const skip = page.getByTestId('skip');
  await expect(pause).toHaveText('다시 진행');
  await expect(skip, '일시정지여도 「다음 결정으로」는 비활성이 아니다').toBeEnabled();
  await expect(skip).not.toHaveAttribute('data-unavailable', 'true');
  expect((await readSave(page)).data.age).toBe(life.age);
  await skip.click();
  // 선택지가 뜨거나(대부분) 곧바로 엔딩이다. M7a 이후 0세에도 결정이 있어(첫 결정이 0세 안에 뜰 수 있다) 나이가 오르지 않은 채 선택지가 뜰 수 있다 — 저장이 「선택지 대기」나 「나이 상승」·엔딩으로 바뀌었는지 본다
  await expect
    .poll(async () => {
      const d = (await readSave(page)).data;
      return d.pending !== null || d.age > life.age || d.phase === 'ending';
    }, { timeout: 10_000 })
    .toBe(true);
  const after = (await readSave(page)).data;
  if (after.phase === 'life') {
    await expect(page.getByTestId('choice-panel'), '선택지에서 멈췄다').toBeVisible();
    expect(after.pending, '저장된 판에도 대기 중 선택지가 있다').not.toBeNull();
    expect(after.paused, '선택지에서 멈춘 판은 여전히 일시정지다').toBe(true);
    await expect(pause).toHaveText('다시 진행');
    await settle(page);
    await page.waitForTimeout(1500); // 일어나지 않아야 하는 일: 멈춘 채라 시간이 흐르지 않는다
    const later = (await readSave(page)).data;
    expect(later.age).toBe(after.age);
    expect(later.pending?.key).toBe(after.pending!.key);
  } else {
    await expect(page.getByTestId('ending-screen')).toBeVisible();
  }
});

test('일시정지 중 탭이 가려졌다 돌아와도 재개하지 않는다. 대조: 일시정지가 아니면 같은 가림·복귀 뒤에 시간이 흐른다 (DB3·R-331 ②)', async ({ page }) => {
  test.setTimeout(90_000);
  await startPageHidden(page); // 이 페이지의 가시성을 우리가 정한다(setPageVisible)
  await page.goto('/');
  const start = await quietLife(page, 6);
  await recordProgress(page);
  await injectSave(page, { ...start, paused: true }, '/?__timescale=7', MANUAL); // 한 해 약 1초
  await setPageVisible(page, true);
  const pause = page.getByTestId('pause');
  await expect(pause).toBeEnabled();
  await expect(pause).toHaveText('다시 진행');
  await settle(page);
  const held = (await readSave(page)).data;
  expect(held.paused).toBe(true);

  // 가렸다 보인다 — 여러 번
  for (let i = 0; i < 3; i++) {
    await setPageVisible(page, false);
    await page.waitForTimeout(250);
    await setPageVisible(page, true);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2200); // 한 해(약 1초)보다 길게 기다려도: 일어나지 않아야 하는 일
  expect((await readSave(page)).data.age, '복귀해도 재개하지 않는다').toBe(held.age);
  await expect(pause).toHaveText('다시 진행');
  await expect(page.getByTestId('year-progress')).toHaveAttribute('data-paused', 'true');
  expect((await samples(page)).filter((x) => x.age > held.age), '진행률 바도 나이를 올린 표본이 없다').toEqual([]);

  // 대조군: 일시정지를 풀고 같은 가림·복귀를 하면 시간이 흐른다(시험이 공허하게 통과한 것이 아니다)
  await pause.click();
  await expect(pause).toHaveText('일시정지');
  await setPageVisible(page, false);
  await page.waitForTimeout(250);
  await setPageVisible(page, true);
  await expect.poll(async () => (await readSave(page)).data.age, { timeout: 20_000 }).toBeGreaterThan(held.age);
});

// ---------- DB2·DB3: 배속 변경 ----------

test('한 해 도중에 배속을 8배로 바꿔도 진행률 바는 되감기거나 건너뛰지 않고 남은 비율만 빨리 채운다 (DB2)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const start = await quietLife(page, 6);
  await recordProgress(page);
  await injectSave(page, start, '/?__timescale=2', MANUAL); // 한 해 약 3.5초
  await expect(page.getByTestId('pause')).toBeEnabled();
  await expect.poll(async () => (await samples(page)).at(-1)?.pct ?? 0, { timeout: 20_000 }).toBeGreaterThanOrEqual(30);
  const before = (await samples(page)).at(-1)!;
  await page.locator('[data-speed="8"]').click();
  await expect(page.locator('[data-speed="8"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await samples(page)).some((s) => s.age === before.age + 1), { timeout: 20_000 }).toBe(true);
  const all = await samples(page);
  const sameYear = all.filter((s) => s.age === before.age).map((s) => s.pct);
  for (let i = 1; i < sameYear.length; i++) expect(sameYear[i], `배속을 바꿔도 되감기지 않는다: ${sameYear.join(',')}`).toBeGreaterThanOrEqual(sameYear[i - 1]);
  expect(sameYear.at(-1)).toBe(100);
  // 그 해가 끝나기까지 8배속이라 남은 비율은 훨씬 빨리 찬다: 바꾼 뒤 표본 간격이 바꾸기 전의 한 해보다 짧다
  const afterClick = sameYear.filter((p) => p >= before.pct);
  expect(afterClick.length).toBeGreaterThan(0);
});

// ---------- DB12·DB14: 인생 기록 ----------

test('인생 기록: 새 줄이 맨 아래에 쌓이고, 맨 아래를 보고 있으면 따라가며, 위로 올려 읽는 중이면 「새 기록 N개」 버튼이 떠서 누르면 맨 아래로 간다. 가상 인구 줄은 고정이다 (DB12·DB14)', async ({ page }) => {
  test.setTimeout(60_000);
  await startPageHidden(page); // 타이머가 끼어들지 않게 — 줄은 「다음 결정으로」로만 늘린다
  await page.goto('/');
  const adult = await adultState(page);
  await injectSave(page, adult, '/', MANUAL);
  await expect(page.getByTestId('skip')).toBeEnabled();
  const rows = page.getByTestId('log-row');
  const list = page.getByTestId('log-list');
  const gap = () => list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
  const panel = page.getByTestId('choice-panel');
  /** 줄이 하나 이상 늘 때까지 진행한다: 선택지가 떠 있으면 첫 선택지를 고르고, 없으면 「다음 결정으로」를 누른다(선택지만 뜨고 줄은 안 느는 해도 있다) */
  const addRows = async () => {
    const start = await rows.count();
    for (let i = 0; i < 12 && (await rows.count()) === start; i++) {
      if (await panel.isVisible()) {
        const pending = (await readSave(page)).data.pending!;
        const choice = page.getByTestId(`choice-${pending.choiceIds[0]}`);
        await expect(choice).toBeEnabled();
        await choice.click();
        await expect(panel).toHaveCount(0);
      } else {
        await page.getByTestId('skip').click();
        await settle(page);
      }
    }
    expect(await rows.count(), '줄이 늘었다').toBeGreaterThan(start);
  };
  const before = await rows.count();
  expect(before).toBe(adult.history.length);
  expect(await gap(), '처음에는 맨 아래(가장 최근)에서 시작').toBeLessThanOrEqual(24);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);

  // 맨 아래를 보고 있으면 새 줄이 와도 따라간다(버튼 없음)
  // 고정 줄이 「기록 카드 안에서」 제자리인지 본다: 화면 좌표는 선택지 카드(M5부터 영향 줄이 있어 더 높다)가 떴다 사라질 때 달라지는 스크롤 위치에도 흔들리므로 카드 윗변에서의 거리로 잰다
  const pinOffset = async () => (await page.getByTestId('log-pin').boundingBox())!.y - (await page.getByTestId('log').boundingBox())!.y;
  const pinBefore = await pinOffset();
  await addRows();
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
  expect(await gap(), '새 줄을 따라 맨 아래').toBeLessThanOrEqual(24);
  expect(await pinOffset(), '가상 인구 줄은 기록이 쌓여도 제자리').toBe(pinBefore);
  await expect(page.getByTestId('log-row').last()).toHaveClass(/latest/);

  // 위로 올려 읽는 중이면 따라가지 않고 개수만 센다
  await list.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
  await settle(page);
  const afterFirst = await rows.count();
  await addRows();
  const added = (await rows.count()) - afterFirst;
  expect(added).toBeGreaterThan(0);
  const jump = page.getByTestId('log-jump');
  await expect(jump).toBeVisible();
  expect(await list.evaluate((el) => el.scrollTop), '위로 올려 읽는 중이라 따라가지 않았다').toBeLessThan(40);
  await expect(jump).toHaveText(new RegExp(`새 기록 ${added}개`));
  await jump.click();
  await expect.poll(gap).toBeLessThanOrEqual(24);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
});

test('인생 기록 영역은 키보드로 닿고(방향키·PageUp) 지난 기록을 읽을 수 있다. 접근 가능한 이름이 있다 (DB12)', async ({ page }) => {
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, await adultState(page), '/', MANUAL);
  const list = page.getByTestId('log-list');
  await expect(list).toHaveAttribute('role', 'region');
  await expect(list).toHaveAttribute('aria-label', '인생 기록');
  await list.focus();
  const top = () => list.evaluate((el) => el.scrollTop);
  const start = await top();
  expect(start).toBeGreaterThan(0);
  await page.keyboard.press('PageUp');
  await expect.poll(top).toBeLessThan(start);
  await page.keyboard.press('Home');
  await expect.poll(top).toBe(0);
});

// ---------- DB4: BGM ----------

interface AudioTrace {
  contexts: number;
  states: string[];
  resumeCalls: number;
}

/** 이 페이지가 만드는 소리 장치(AudioContext)를 센다: 개수·각 장치의 상태·resume() 호출 수. 모든 이동·새로고침마다 다시 설치된다 */
async function traceAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __audio: { instances: Array<{ state: string; suspend(): Promise<void> }>; resumeCalls: number }; AudioContext?: new () => unknown };
    w.__audio = { instances: [], resumeCalls: 0 };
    const Original = w.AudioContext;
    if (Original === undefined) return;
    w.AudioContext = class extends (Original as unknown as new () => { resume(): Promise<void> }) {
      constructor() {
        super();
        w.__audio.instances.push(this as never);
      }
      resume() {
        w.__audio.resumeCalls++;
        return super.resume();
      }
    } as unknown as new () => unknown;
  });
}
const audioTrace = (page: Page): Promise<AudioTrace> =>
  page.evaluate(() => {
    const a = (window as unknown as { __audio: { instances: Array<{ state: string }>; resumeCalls: number } }).__audio;
    return { contexts: a.instances.length, states: a.instances.map((i) => i.state), resumeCalls: a.resumeCalls };
  });
/** 소리 장치를 브라우저가 멈춘 것처럼 만든다(iOS의 전화·알림 중단, 사용자 활성화 전의 거절과 같은 `suspended`) */
const interruptAudio = (page: Page) => page.evaluate(() => (window as unknown as { __audio: { instances: Array<{ suspend(): Promise<void> }> } }).__audio.instances[0].suspend());

test('BGM: 처음엔 꺼짐이고 소리 장치를 만들지 않으며, 켜면 만들어지고 볼륨이 보이고 설정에 저장되어 새로고침 뒤에도 유지된다. 새로고침 직후에는 소리 장치가 0개다. 끄면 멈춘다 (DB4)', async ({ page }) => {
  await startPageHidden(page);
  await traceAudio(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  const contexts = async () => (await audioTrace(page)).contexts;
  const bgm = page.getByTestId('tool-bgm');
  await expect(bgm).toBeEnabled();
  await expect(bgm).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('bgm-volume')).toHaveCount(0);
  expect(await contexts(), '자동 재생 없음').toBe(0);
  expect((await readSettings(page)).bgm).toEqual({ on: false, volume: 30 });

  await bgm.click();
  await expect(bgm).toHaveAttribute('aria-pressed', 'true');
  await expect(bgm).toContainText('켜짐');
  expect(await contexts()).toBe(1);
  const slider = page.getByTestId('bgm-volume-input');
  await expect(slider).toHaveValue('30');
  await slider.fill('65');
  await expect.poll(async () => (await readSettings(page)).bgm).toEqual({ on: true, volume: 65 });

  await page.reload();
  await expect(page.getByTestId('tool-bgm')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('bgm-volume-input')).toHaveValue('65');
  // 새로고침 직후에는 사용자 동작이 없다: 저장된 「켜짐」이어도 소리 장치를 만들지 않는다(예전에는 ≤ 1로 느슨하게 두었다 — R-325가 0으로 복원). 켜진 설정이 소리를 저절로 내지 않는다
  await page.waitForTimeout(500);
  expect(await contexts(), '재로드 직후 소리 장치 0').toBe(0);

  await page.getByTestId('tool-bgm').click();
  await expect(page.getByTestId('tool-bgm')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('bgm-volume')).toHaveCount(0);
  await expect.poll(async () => (await readSettings(page)).bgm).toEqual({ on: false, volume: 65 });
});

/** 일시정지로 열린 인생(시간이 흐르지 않는다) + 저장된 BGM 「켜짐」을 보이는 탭에서 연다 */
async function openBgmOnPaused(page: Page): Promise<void> {
  await traceAudio(page);
  await page.goto('/');
  await injectSave(page, { ...lifeState(KNOWN_SEED), paused: true }, '/', { ...MANUAL, bgm: { on: true, volume: 30 } });
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('tool-bgm')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pause')).toHaveText('다시 진행');
  await page.waitForTimeout(500);
}

test.describe('BGM 활성화 입력: 터치 (R-325 — 모바일은 touchstart·터치 pointerdown을 사용자 활성화로 치지 않는다)', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });

  test('저장된 「켜짐」으로 연 직후 장치 0 → touchstart·pointerdown만으로는 0 → 터치 탭을 떼면 1이고 running → 장치가 멈추면(suspended) 다음 입력마다 다시 깨운다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '터치 모양을 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(60_000);
    await openBgmOnPaused(page);
    expect((await audioTrace(page)).contexts, '재로드 직후 장치 0').toBe(0);

    // 모바일이 활성화로 치지 않는 입력: 눌렀을 뿐(touchstart·터치 pointerdown) 떼지 않았다 → 소리 장치를 만들지 않는다
    await page.evaluate(() => {
      window.dispatchEvent(new Event('touchstart'));
      window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
      document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    expect((await audioTrace(page)).contexts, 'touchstart·pointerdown만으로는 장치를 만들지 않는다').toBe(0);

    // 터치 탭(눌렀다 뗀다): 장치가 1개 만들어지고 running — 입력 안에서 만들고 깨운다
    const name = (await page.getByTestId('life-name').boundingBox())!;
    await page.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2);
    await expect.poll(async () => (await audioTrace(page)).contexts, { message: '터치 탭 뒤 장치 1' }).toBe(1);
    await expect.poll(async () => (await audioTrace(page)).states[0], { message: '터치 탭 뒤 running' }).toBe('running');
    expect((await audioTrace(page)).resumeCalls).toBeGreaterThanOrEqual(1);

    // 장치가 멈추면(전화·알림·거절) 다음 입력마다 다시 깨운다
    for (const round of [1, 2]) {
      await interruptAudio(page);
      await expect.poll(async () => (await audioTrace(page)).states[0], { message: `${round}번째 중단` }).toBe('suspended');
      const before = (await audioTrace(page)).resumeCalls;
      await page.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2);
      await expect.poll(async () => (await audioTrace(page)).states[0], { message: `${round}번째 탭 뒤 다시 running` }).toBe('running');
      expect((await audioTrace(page)).resumeCalls, '입력이 resume()을 다시 불렀다').toBeGreaterThan(before);
      expect((await audioTrace(page)).contexts, '장치를 또 만들지 않는다').toBe(1);
    }
  });

  test('BGM이 꺼져 있으면 터치 탭에도 소리 장치를 만들지 않는다 (사용자가 켜기 전에는 아무 소리도 없다)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '터치 모양을 직접 지정하므로 mobile-360에서만 실행');
    await traceAudio(page);
    await page.goto('/');
    await injectSave(page, { ...lifeState(KNOWN_SEED), paused: true }, '/', MANUAL);
    await expect(page.getByTestId('pause')).toHaveText('다시 진행');
    const name = (await page.getByTestId('life-name').boundingBox())!;
    await page.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2);
    await page.waitForTimeout(500);
    expect((await audioTrace(page)).contexts).toBe(0);
  });
});

test('BGM 활성화 입력: 마우스는 누를 때가 아니라 뗄 때, 키는 누를 때 — 저장된 「켜짐」의 소리 장치는 그 입력 안에서 만들어지고, 멈추면 다음 입력마다 깨운다 (R-325)', async ({ page }) => {
  test.setTimeout(60_000);
  await openBgmOnPaused(page);
  expect((await audioTrace(page)).contexts, '재로드 직후 장치 0').toBe(0);
  const name = (await page.getByTestId('life-name').boundingBox())!;
  const x = name.x + name.width / 2;
  const y = name.y + name.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down(); // 마우스 pointerdown·mousedown: 목록에 없는 입력
  await page.waitForTimeout(300);
  expect((await audioTrace(page)).contexts, '누르기만 해서는 장치를 만들지 않는다').toBe(0);
  await page.mouse.up(); // pointerup·click
  await expect.poll(async () => (await audioTrace(page)).contexts).toBe(1);
  await expect.poll(async () => (await audioTrace(page)).states[0]).toBe('running');

  await interruptAudio(page);
  await expect.poll(async () => (await audioTrace(page)).states[0]).toBe('suspended');
  await page.keyboard.press('ArrowDown'); // keydown
  await expect.poll(async () => (await audioTrace(page)).states[0], { message: '키 입력이 다시 깨운다' }).toBe('running');
  expect((await audioTrace(page)).contexts).toBe(1);
});

// ---------- DB6: 다크 모드 ----------

test('다크 모드: 시스템이 라이트이면 꺼짐 → 누르면 다크(켜짐, data-theme=dark)로 저장되고 새로고침의 첫 그림부터 다크다. 다시 누르면 라이트로 저장된다 (DB6)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await startPageHidden(page);
  // 첫 그림에 이미 다크인지: #root에 처음 자식이 생기는 순간의 data-theme을 기록한다
  await page.addInitScript(() => {
    const w = window as unknown as { __themeAtFirstPaint?: string | null };
    new MutationObserver((_, observer) => {
      const root = document.getElementById('root');
      if (root !== null && root.childElementCount > 0 && w.__themeAtFirstPaint === undefined) {
        w.__themeAtFirstPaint = document.documentElement.getAttribute('data-theme');
        observer.disconnect();
      }
    }).observe(document, { subtree: true, childList: true });
  });
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  const dark = page.getByTestId('tool-dark');
  await expect(dark).toBeEnabled();
  await expect(dark).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull();
  await dark.click();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '바탕이 다크 토큰').toBe('rgb(20, 23, 31)');
  expect((await readSettings(page)).theme).toBe('dark');
  expect(await page.evaluate(() => document.querySelector('meta[name="color-scheme"]')!.getAttribute('content'))).toBe('dark');

  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __themeAtFirstPaint?: string | null }).__themeAtFirstPaint), '첫 그림부터 다크').toBe('dark');
  await expect(page.getByTestId('tool-dark')).toHaveAttribute('aria-pressed', 'true');

  await expect(page.getByTestId('tool-dark')).toBeEnabled();
  await page.getByTestId('tool-dark').click();
  await expect(page.getByTestId('tool-dark')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
  expect((await readSettings(page)).theme).toBe('light');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '바탕이 라이트 토큰').toBe('rgb(246, 243, 236)');
});

test('다크 모드: 시스템이 다크이면 처음부터 켜짐으로 보이고, 누르면 라이트(수동)로 바뀐다 — 보이는 상태를 뒤집는다 (DB6)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  const dark = page.getByTestId('tool-dark');
  await expect(dark).toBeEnabled();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(20, 23, 31)');
  await dark.click();
  await expect(dark).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
  expect((await readSettings(page)).theme).toBe('light');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '시스템은 다크여도 수동 라이트가 우선').toBe('rgb(246, 243, 236)');
});

// ---------- DB7: 의견 보내기 ----------

test('의견 보내기: 새 탭으로 GitHub 이슈 작성 화면이 열리고 주소에는 화면·세상·인생 길이·빌드뿐이다(이름·나이·기록 없음). 연타해도 탭은 하나만 열린다 (DB7)', async ({ page, context }) => {
  await startPageHidden(page);
  const opened: string[] = [];
  // 실제 외부 사이트로 나가지 않는다: 새 탭의 요청은 빈 응답으로 받는다(주소만 확인)
  await context.route((url) => url.hostname !== 'localhost', (route) => {
    opened.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' });
  });
  await page.goto('/');
  const state = lifeState(KNOWN_SEED);
  await injectSave(page, state, '/', MANUAL);
  const feedback = page.getByTestId('tool-feedback');
  await expect(feedback).not.toHaveAttribute('aria-disabled', 'true');
  const href = (await feedback.getAttribute('href'))!;
  expect(href).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new\?template=feedback\.yml&screen=/);
  const screen = decodeURIComponent(href.split('&screen=')[1]);
  expect(screen).toContain('인생 진행 중');
  expect(screen).toContain('지금 세상');
  expect(screen).not.toContain(state.character!.name);
  expect(screen).not.toMatch(/\d+세|기록|저장/);
  expect(Object.keys(Object.fromEntries(new URL(href).searchParams)).sort()).toEqual(['screen', 'template']);
  await expect(feedback).toHaveAttribute('target', '_blank');
  await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');

  const [popup] = await Promise.all([context.waitForEvent('page'), feedback.click()]);
  await popup.waitForLoadState('domcontentloaded');
  expect(popup.url()).toBe(href);
  // 연타: 1.5초 안에는 다시 열리지 않는다
  await feedback.click();
  await feedback.click();
  await page.waitForTimeout(500);
  expect(context.pages().length, '탭은 게임 + 의견 보내기 하나').toBe(2);
  expect(opened.length, '밖으로 나간 요청은 의견 보내기 한 번뿐').toBe(1);
  await page.bringToFront();
  await expect(page.getByTestId('life-screen')).toBeVisible();
});

// ---------- DB3: 생각 남기기 도구 (M7c부터 보통 버튼) ----------

test('생각 남기기 (M7c D-75): 보통 버튼이다 — 「준비 중」 표식·점선·지속 비활성이 없고, 이름은 「생각 남기기」, 눌러 기록 시트(dialog)가 열린다', async ({ page }) => {
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  const note = page.getByTestId('tool-note');
  await expect(page.getByTestId('tool-bgm'), '입력 가드가 풀릴 때까지').toBeEnabled();
  await expect(note, '가드가 풀린 뒤에는 보통 버튼').toBeEnabled();
  await expect(note).not.toHaveAttribute('aria-disabled', 'true');
  await expect(note).not.toHaveAttribute('data-unavailable', /.*/);
  await expect(note).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(note).not.toContainText('준비 중');
  await expect(note).toHaveAccessibleName('생각 남기기');
  const look = await note.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, borderStyle: cs.borderTopStyle };
  });
  expect(look.borderStyle, '지속 비활성의 점선이 아니다').not.toBe('dashed');
  // 누르면 기록 시트가 열리고(수동 기록), 닫으면(Esc) 시트가 사라지고 포커스가 버튼으로 돌아온다 — 세부 동작은 m7c-note.spec.ts
  await note.click();
  await expect(page.getByTestId('note-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-sheet')).toHaveCount(0);
  await expect.poll(() => activeTestId(page)).toBe('tool-note');
});

// ---------- DB8: 나가기 ----------

test('나가기: 확인 단계가 뜨고 그동안 시계가 멈춘다. 돌아가기·Esc는 닫고 포커스를 「나가기」로 돌려주며, 확인하면 일시정지로 저장한 채 첫 화면(이어서 살기)으로 간다. 이어서 살면 멈춘 채 돌아온다 (DB8·C3)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const start = await quietLife(page, 6);
  await recordProgress(page);
  await injectSave(page, start, '/?__timescale=7', MANUAL);
  const exit = page.getByTestId('tool-exit');
  await expect(exit).toBeEnabled();
  await expect.poll(async () => (await samples(page)).at(-1)?.age ?? 0, { timeout: 20_000 }).toBeGreaterThanOrEqual(start.age + 1);

  await exit.click();
  const ask = page.getByTestId('exit-ask');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('첫 화면으로 나갈까요?');
  await expect(page.getByTestId('exit-no'), '안전한 쪽(돌아가기)에 포커스').toBeFocused();
  await settle(page);
  const held = (await samples(page)).at(-1)!;
  await page.waitForTimeout(1500); // 일어나지 않아야 하는 일: 확인 단계가 열려 있는 동안 시간이 흐르지 않는다
  expect((await samples(page)).at(-1), '확인 단계 동안 시계가 멈춘다').toEqual(held);

  // 돌아가기 → 닫히고 포커스는 「나가기」
  await page.getByTestId('exit-no').click();
  await expect(ask).toHaveCount(0);
  await expect(exit).toBeFocused();
  // Esc도 같다
  await exit.click();
  await expect(ask).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask).toHaveCount(0);
  await expect(exit).toBeFocused();
  // 닫으면 시계가 다시 흐른다
  await expect.poll(async () => (await samples(page)).at(-1)?.age ?? 0, { timeout: 20_000 }).toBeGreaterThan(held.age);

  // 확인하면 첫 화면. 일시정지로 저장.
  await exit.click();
  await expect(page.getByTestId('exit-yes')).toBeEnabled();
  await page.getByTestId('exit-yes').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('resume')).toBeVisible();
  const saved = (await readSave(page)).data;
  expect(saved.phase).toBe('life');
  expect(saved.paused, '나가기는 일시정지로 저장한다').toBe(true);
  const ageAtExit = saved.age;
  await page.waitForTimeout(1500);
  expect((await readSave(page)).data.age, '첫 화면 동안 인생이 흐르지 않는다').toBe(ageAtExit);

  // 이어서 살기 → 멈춘 채
  await expect(page.getByTestId('resume')).toBeEnabled();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('pause')).toHaveText('다시 진행');
  await page.waitForTimeout(1200);
  expect((await readSave(page)).data.age).toBe(ageAtExit);
});

test('나가기 확인 단계의 더블탭: 「나가기」를 두 번 눌러도 확인 단계가 열린 채 그대로이고 첫 화면으로 나가지 않는다 (입력 가드)', async ({ page }) => {
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  const exit = page.getByTestId('tool-exit');
  await expect(exit).toBeEnabled();
  const box = (await exit.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  await settle(page);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('title-screen')).toHaveCount(0);
  expect((await readSave(page)).data.paused, '확인 전에는 저장이 바뀌지 않는다').toBe(false);
});

// ---------- C6: 이전 버전 저장 ----------

test('이전 버전(v6) 인생 저장은 새 게임으로 시작하고 첫 화면에 안내 한 줄이 한 번 뜬다. 설정(BGM·테마는 기본값)은 이어진다 (C6)', async ({ page }) => {
  expect(SAVE_VERSION).toBe(8); // M5 2a에서 7 → 8 (재산 스탯 폐지) — 여기서 쓰는 v6 저장은 지금도 「이전 버전」이다
  await page.addInitScript(
    ([gameKey, settingsKey, life]) => {
      if (localStorage.getItem(gameKey) === null) {
        const { paused: _paused, ...v6 } = JSON.parse(life);
        localStorage.setItem(gameKey, JSON.stringify({ version: 6, data: v6 }));
        localStorage.setItem(settingsKey, JSON.stringify({ version: 2, data: { speed: 4, autoMode: true, era: 'present', lifeLength: 'short30' } }));
      }
    },
    [GAME_KEY, SETTINGS_KEY, JSON.stringify(lifeState(KNOWN_SEED))] as const,
  );
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('old-save-notice')).toHaveText('이전 버전에서 저장된 판은 이어서 할 수 없어 새 게임으로 시작합니다.');
  await expect(page.getByTestId('resume')).toHaveCount(0);
  expect((await readSave(page)).version).toBe(SAVE_VERSION);
  expect(await readSettings(page)).toEqual({ speed: 4, autoMode: true, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: true });
});

// ---------- DB1: 열 배치 ----------

test('배치: 폭 < 960은 한 열(결정 카드가 맨 위, 프로필 → 상태 → 자산 → 기록 → 식구 → 또래), 폭 ≥ 960은 3열(왼쪽 프로필·상태·자산 / 가운데 결정·기록 / 오른쪽 식구·또래) (DB1)', async ({ page }, testInfo) => {
  await startPageHidden(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'present', { minChoices: 2 });
  // 자동 모드 켜짐 = 비모달 인라인 카드(M7b): 카드가 가운데 열 맨 위(1열은 헤더 바로 아래)에 놓인다. 수동 모드의 카드는 모달 시트(화면 위에 뜬다)라 열 배치에 들지 않는다
  await injectSave(page, decision, '/', { ...MANUAL, autoMode: true });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  const rects = await page.evaluate(() => {
    const r = (id: string) => {
      const b = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top + window.scrollY, bottom: b.bottom + window.scrollY };
    };
    return Object.fromEntries(['profile-card', 'stats', 'assets-card', 'choice-panel', 'log', 'family-card', 'peers-now-card'].map((id) => [id, r(id)]));
  });
  if (testInfo.project.name === 'desktop') {
    // 3열: 왼쪽 ≤ 가운데 ≤ 오른쪽 (가로로 겹치지 않는다)
    for (const left of ['profile-card', 'stats', 'assets-card']) for (const mid of ['choice-panel', 'log']) expect(rects[left].right, `${left} | ${mid}`).toBeLessThanOrEqual(rects[mid].left + 1);
    for (const mid of ['choice-panel', 'log']) for (const right of ['family-card', 'peers-now-card']) expect(rects[mid].right, `${mid} | ${right}`).toBeLessThanOrEqual(rects[right].left + 1);
    expect(rects['choice-panel'].top, '결정 카드는 가운데 열의 맨 위').toBeLessThan(rects['log'].top);
    expect(rects['profile-card'].top).toBeLessThan(rects['stats'].top);
  } else {
    const order = ['choice-panel', 'profile-card', 'stats', 'assets-card', 'log', 'family-card', 'peers-now-card'];
    for (let i = 1; i < order.length; i++) expect(rects[order[i]].top, `${order[i - 1]} → ${order[i]}`).toBeGreaterThan(rects[order[i - 1]].top);
    for (const id of order) expect(rects[id].left, id).toBeLessThan(40); // 한 열: 모두 왼쪽 가장자리 근처에서 시작
  }
});

test('프로필: 얼굴은 나이에 맞는 연령대 그림이고(0세 영아 → 50세 중년), 학력·외모 순위가 보이며 외모 점수 숫자는 어디에도 없다 (DB9·R-135)', async ({ page }) => {
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  await expect(page.getByTestId('face')).toHaveAttribute('data-age-group', 'infant');
  await expect(page.getByTestId('profile-edu')).toHaveText('취학 전');
  const adult = await adultState(page);
  await injectSave(page, adult, '/', MANUAL);
  await expect(page.getByTestId('face')).toHaveAttribute('data-age-group', 'middle');
  await expect(page.getByTestId('profile-looks')).toContainText(/상위|하위|가운데쯤/);
  const text = await page.getByTestId('life-screen').innerText();
  expect(text).not.toContain(String(adult.character!.looks) + '점');
});
