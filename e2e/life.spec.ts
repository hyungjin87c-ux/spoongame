import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { HOLD_MS } from '../src/data/timingTable';
import {
  KNOWN_SEED,
  evalCore,
  clearGameSave,
  SETTINGS_KEY,
  countKind,
  findPendingState,
  injectSave,
  noHorizontalOverflow,
  oracleAuto,
  oracleDecision,
  oracleLife,
  readSave,
  readSettings,
} from './helpers';

/** 개발 서버 전용 탐침: 연출 시간을 N배 빠르게(실제 30분을 기다리지 않는다) */
const FAST = '/?__timescale=1000';

async function startFromTitle(page: Page, url = '/') {
  await page.goto(url);
  const start = page.getByRole('button', { name: '시작' });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByTestId('era-screen')).toBeVisible();
  const confirm = page.getByTestId('confirm-era');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

test('출생 → 살아가기 → 인생 화면: 이름·나이·단계·스탯 5개+외모·속도 컨트롤이 보이고 자리표시와 "처음으로"는 없다 (R-021)', async ({ page }) => {
  await startFromTitle(page);
  await expect(page.getByTestId('life-name')).toBeVisible();
  await expect(page.getByTestId('life-age')).toContainText('0세');
  await expect(page.getByTestId('life-stage')).toHaveText('영유아');
  for (const key of ['wealth', 'education', 'health', 'happiness', 'relationships', 'looks']) {
    await expect(page.getByTestId(`stat-${key}`)).toBeVisible();
  }
  // 속도 컨트롤 상시 표시: 1배 / 2배 / 4배 / 8배, 다음 결정으로, 자동 모드
  for (const label of ['1배', '2배', '4배', '8배']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1배', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('skip')).toBeVisible();
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'false');
  // M2 자리표시 화면과 처음으로 버튼은 없다
  await expect(page.getByTestId('life-placeholder')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '처음으로' })).toHaveCount(0);
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 사건 로그 첫 줄은 출생
  await expect(page.getByTestId('log')).toContainText('로 태어났다');
  // 사운드·복잡한 애니메이션 없음: audio/video 요소 없음
  expect(await page.locator('audio, video, canvas').count()).toBe(0);
});

test('화면이 바뀔 때마다 새 화면의 제목으로 포커스가 옮겨진다 (R-030)', async ({ page }) => {
  const activeText = () => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`);
  await page.goto('/');
  await expect.poll(activeText).toBe('H1:수저 게임');
  const start = page.getByRole('button', { name: '시작' });
  await expect(start).toBeEnabled();
  await start.click();
  await expect.poll(activeText).toBe('H1:어느 세상에서 태어날까');
  const confirm = page.getByTestId('confirm-era');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(async () => (await activeText()).startsWith('H1:')).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('birth-name');
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('life-name');
});

test('시간이 흐르면 나이가 오르고 선택지 이벤트에서 멈춘다 → 선택하면 이어진다', async ({ page }) => {
  const start = await oracleLifeAt(page);
  await injectSave(page, start, FAST);
  const panel = page.getByTestId('choice-panel');
  await expect(panel).toBeVisible();
  const pending = (await readSave(page)).data.pending!;
  expect(pending.key).toBe(await panel.getAttribute('data-key'));
  const ageWhenStopped = (await readSave(page)).data.age;
  expect(ageWhenStopped).toBeGreaterThan(0); // 0세에서 시작해 선택지까지 시간이 흘렀다
  // 선택지 앞에서는 시간이 멈춘다(연출 시간이 사실상 0이어도 나이가 오르지 않는다)
  await page.waitForTimeout(800);
  expect((await readSave(page)).data.age).toBe(ageWhenStopped);
  expect((await readSave(page)).data.pending).toEqual(pending);

  // 선택 → 연표에 선택 내용이 남고 대기 중인 선택지가 바뀐다/사라진다
  const first = page.getByTestId(`choice-${pending.choiceIds[0]}`);
  await expect(first).toBeEnabled();
  await first.click();
  await expect.poll(async () => (await readSave(page)).data.history.some((h) => h.kind === 'choice' && h.eventId === pending.eventId)).toBe(true);
  const after = await readSave(page);
  const entry = after.data.history.find((h) => h.kind === 'choice' && h.eventId === pending.eventId)!;
  expect(entry.choice).toBeTruthy();
  expect(entry.age).toBe(pending.age);
  expect(after.data.pending?.key).not.toBe(pending.key);
  await expect.poll(async () => (await readSave(page)).data.age).toBeGreaterThan(ageWhenStopped);
});

/** 0세에서 시작해 첫 선택지까지는 시간으로 가는 시드의 0세 상태 */
async function oracleLifeAt(page: Page) {
  await page.goto('/');
  const withDecision = await findPendingState(page, 'present');
  // 같은 시드의 0세 상태를 다시 만든다(시드는 저장된 seed 필드)
  return oracleLife(page, withDecision.seed, 'present');
}

test('선택지 화면에서 새로고침하면 같은 이벤트·같은 선택지가 그대로 보인다 (다시 굴려지거나 건너뛰지 않는다)', async ({ page }) => {
  await page.goto('/');
  const state = await findPendingState(page, 'present');
  await injectSave(page, state, '/');
  const panel = page.getByTestId('choice-panel');
  await expect(panel).toBeVisible();
  const snapshot = async () => ({
    title: await page.getByTestId('choice-title').innerText(),
    text: await page.getByTestId('choice-text').innerText(),
    labels: await panel.getByRole('button').allInnerTexts(),
    key: await panel.getAttribute('data-key'),
    save: await readSave(page),
  });
  const before = await snapshot();
  expect(before.labels.length).toBeGreaterThanOrEqual(2);
  expect(before.save.data).toEqual(state);
  for (let i = 0; i < 4; i++) {
    await page.reload();
    await expect(panel).toBeVisible();
    expect(await snapshot()).toEqual(before);
  }
});

test('배속 전환: 1/2/4/8배가 눌린 상태로 표시되고 설정에 저장되며 새로고침·새 판에서도 유지된다', async ({ page }) => {
  await startFromTitle(page);
  for (const speed of [2, 4, 8]) {
    await page.getByRole('button', { name: `${speed}배`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${speed}배`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '1배', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await readSettings(page)).speed).toBe(speed);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: '8배', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 게임 저장만 지워 "새 판"을 시작해도 속도 설정은 남는다
  await clearGameSave(page);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const settingsRaw = await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
  expect(JSON.parse(settingsRaw!).data.speed).toBe(8);
  await startFromTitle(page);
  await expect(page.getByRole('button', { name: '8배', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('다음 결정으로: 연출을 건너뛰고 첫 선택지에서 정확히 멈춘다 (저장도 core 기대값과 같다)', async ({ page }) => {
  await page.goto('/');
  const found = await findPendingState(page, 'present');
  const start = await oracleLife(page, found.seed, 'present');
  await injectSave(page, start, '/');
  const skip = page.getByTestId('skip');
  await expect(skip).toBeEnabled();
  await skip.click();
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  const expected = await oracleDecision(page, start);
  expect((await readSave(page)).data).toEqual(expected);
  expect(expected.pending).not.toBeNull();
  // 결정 대기 중에는 "다음 결정으로"가 눌리지 않는다
  await expect(skip).toBeDisabled();
});

test('자동 모드로 끝까지 진행해 사망(엔딩 화면)에 도달하고, 저장이 core 자동 진행 결과와 같다', async ({ page }) => {
  await page.goto('/');
  const found = await findPendingState(page, 'present');
  const start = await oracleLife(page, found.seed, 'present');
  await injectSave(page, start, '/?__timescale=2000', { speed: 8, autoMode: true });
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 30_000 });
  const save = await readSave(page);
  expect(save.data.phase).toBe('ending');
  expect(save.data.death).not.toBeNull();
  expect(save.data).toEqual(await oracleAuto(page, start));
  await expect(page.getByTestId('ending-death')).toContainText(`${save.data.death!.age}세`);
  // 엔딩 화면의 버튼은 "다시 태어나기" 하나뿐이다 (엔딩 자체의 검증은 e2e/ending.spec.ts)
  await expect(page.getByRole('button')).toHaveCount(1);
  await expect(page.getByTestId('rebirth')).toHaveText('다시 태어나기');
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(countKind(save, 'death')).toBe(1);
});

test('KNOWN_SEED 상수가 쓸 수 있는 시드다 (출생 → 인생 0세 오라클이 core 검증기를 통과)', async ({ page }) => {
  await page.goto('/');
  const s = await oracleLife(page, KNOWN_SEED, 'future');
  expect(s.phase).toBe('life');
  expect(s.history).toHaveLength(1);
});

// ---------- 360px 레이아웃 ----------

for (const vp of [
  { width: 360, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 740 },
]) {
  test(`${vp.width}x${vp.height}: 선택지 3개와 속도 컨트롤이 모두 화면 안에서 서로 가려지지 않고 가로 넘침이 없다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize(vp);
    await page.goto('/');
    const state = await findPendingState(page, 'present', { minChoices: 3 });
    expect(state.pending!.choiceIds.length).toBe(3);
    await injectSave(page, state, '/');
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId(`choice-${state.pending!.choiceIds[2]}`)).toBeEnabled();
    const boxes = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, covered: !(hit === el || el.contains(hit)), name: (el.textContent ?? '').trim() };
      };
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        choices: [...document.querySelectorAll('[data-testid="choice-panel"] button')].map(rect),
        controls: [...document.querySelectorAll('[data-testid="controls"] button')].map(rect),
      };
    });
    expect(boxes.choices).toHaveLength(3);
    expect(boxes.controls).toHaveLength(6);
    for (const b of [...boxes.choices, ...boxes.controls]) {
      expect(b.left, b.name).toBeGreaterThanOrEqual(0);
      expect(b.right, b.name).toBeLessThanOrEqual(boxes.vw);
      expect(b.top, b.name).toBeGreaterThanOrEqual(0);
      expect(b.bottom, b.name).toBeLessThanOrEqual(boxes.vh);
      expect(b.covered, `${b.name}: 다른 요소에 가려져 눌리지 않는다`).toBe(false);
    }
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

test('사건 로그는 최근 항목 위주로 보이고(최신이 맨 위), 긴 인생 중간 화면도 360px에서 넘치지 않는다', async ({ page }) => {
  await page.goto('/');
  const mid = await evalCore<GameState>(
    page,
    `let s = core.enterLife(core.beginBirth(core.selectEra(core.startGame(core.createInitialState(777)), 'present')));
     while (s.phase === 'life' && s.age < 50) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
     return s;`,
  );
  expect(mid.history.length).toBeGreaterThan(6);
  await injectSave(page, mid, '/');
  const items = page.getByTestId('log').locator('li');
  await expect(items).toHaveCount(6);
  await expect(items.first()).toHaveClass(/latest/);
  const last = mid.history[mid.history.length - 1];
  await expect(items.first()).toContainText(last.text);
  await expect(page.getByTestId('life-age')).toContainText(`${mid.age}세`);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------- 배속이 실제 진행 속도를 바꾼다 (연출 시간 상수 표) ----------

/** 처음 N해가 모두 "조용한 해"인 시드의 0세 상태 (연출 시간이 일정해 시간 측정이 흔들리지 않는다) */
async function quietStart(page: Page, years: number): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 2000; seed++) {
       let s = core.enterLife(core.beginBirth(core.selectEra(core.startGame(core.createInitialState(seed)), 'present')));
       let ok = true;
       for (let i = 0; i < arg.years; i++) { const r = core.stepYear(s); if (r.tick.kind !== 'quiet') { ok = false; break; } s = r.state; }
       if (ok) return core.enterLife(core.beginBirth(core.selectEra(core.startGame(core.createInitialState(seed)), 'present')));
     }
     return null;`,
    { years },
  );
  expect(s).not.toBeNull();
  return s!;
}

test('배속 설정이 실제 진행 간격을 바꾼다: 1배속의 한 해는 8배속의 몇 배로 길고, 매번 정확히 한 해씩만 진행된다 (한 해가 두 번 진행되지 않는다)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const start = await quietStart(page, 7);

  // 페이지 안에서 나이가 바뀔 때마다 시각을 기록한다(렌더 직후, 첫 렌더 포함). 시간 배율 4: 조용한 한 해가 1배속 HOLD_MS.quiet/4, 8배속 HOLD_MS.quiet/8/4.
  // 고정 대기로 "N초 뒤 나이"를 보지 않고 연속한 두 나이 변화 사이의 간격을 잰다 → 부하로 전체가 늦어져도 흔들리지 않는다.
  await page.addInitScript(() => {
    const w = window as unknown as { __ages: { age: number; t: number }[] };
    w.__ages = [];
    const record = () => {
      const strong = document.querySelector('[data-testid="life-age"] strong');
      if (strong === null) return;
      const age = Number((strong.textContent ?? '').split('세')[0]);
      if (w.__ages.length === 0 || w.__ages[w.__ages.length - 1].age !== age) w.__ages.push({ age, t: performance.now() });
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const measure = async (speed: 1 | 8, steps: number): Promise<{ ages: number[]; gaps: number[] }> => {
    await injectSave(page, start, '/?__timescale=4', { speed, autoMode: false });
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __ages: unknown[] }).__ages.length), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(steps + 1);
    const log = await page.evaluate(() => (window as unknown as { __ages: { age: number; t: number }[] }).__ages.slice());
    return { ages: log.map((e) => e.age), gaps: log.slice(1).map((e, i) => e.t - log[i].t) };
  };
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  const slow = await measure(1, 3);
  const fast = await measure(8, 6);
  // 매번 정확히 한 해씩 (StrictMode 이중 효과·겹친 타이머가 한 해를 두 번 진행하면 나이가 2 이상 건너뛴다)
  for (const m of [slow, fast]) m.ages.forEach((age, i) => expect(age, `${m.ages}`).toBe(m.ages[0] + i));
  // 타이머는 설정한 시간보다 일찍 울리지 않는다 → 아래 하한은 부하와 무관하게 안전하다
  expect(Math.min(...slow.gaps), `1배속 간격 ${slow.gaps}`).toBeGreaterThanOrEqual((HOLD_MS.quiet / 4) * 0.9); // HOLD_MS.quiet / 1배 / 시간 배율 4
  expect(Math.min(...fast.gaps), `8배속 간격 ${fast.gaps}`).toBeGreaterThanOrEqual((HOLD_MS.quiet / 8 / 4) * 0.8); // HOLD_MS.quiet / 8배 / 시간 배율 4
  // 8배속이 눈에 띄게 빠르다 (이상적으로 8배, 부하로 늦어져도 2배 넘게는 차이가 난다)
  expect(median(fast.gaps) * 2, `1배속 ${slow.gaps} / 8배속 ${fast.gaps}`).toBeLessThan(median(slow.gaps));
});
