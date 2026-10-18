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
  quietStart,
  readSave,
  readSettings,
  skipRoulette,
  toBirthReport,
} from './helpers';

/** 개발 서버 전용 탐침: 연출 시간을 N배 빠르게(실제 30분을 기다리지 않는다) */
const FAST = '/?__timescale=1000';

async function startFromTitle(page: Page, url = '/') {
  await page.goto(url);
  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await begin.click();
  await skipRoulette(page); // 룰렛(M3): 연출은 건너뛴다
  await toBirthReport(page);
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

test('출생 → 살아가기 → 인생 화면(대시보드): 이름·나이·학력·상태 4개·외모 순위·진행 컨트롤이 보이고 자리표시와 "처음으로"는 없다 (R-021, M4)', async ({ page }) => {
  await startFromTitle(page);
  await expect(page.getByTestId('life-name')).toBeVisible();
  await expect(page.getByTestId('life-age')).toContainText('0세');
  // 바뀐 기대(M4): 옛 「단계」 줄(life-stage 「영유아」)은 프로필 카드의 학력(0세는 「취학 전」)으로, 스탯 5개+외모 줄은 상태 바 4개(건강·행복·지식·관계)로 바뀌었다.
  // 재산은 자산 현황 자리(경제 모델 M5)로, 외모는 점수 줄이 아니라 얼굴 그림과 「상위/하위 약 N%」 한 가지로만 드러난다(R-135).
  await expect(page.getByTestId('profile-edu')).toHaveText('취학 전');
  for (const key of ['health', 'happiness', 'education', 'relationships']) {
    await expect(page.getByTestId(`stat-${key}`)).toBeVisible();
  }
  for (const key of ['wealth', 'looks']) await expect(page.getByTestId(`stat-${key}`)).toHaveCount(0);
  await expect(page.getByTestId('profile-looks')).toContainText(/상위|하위|가운데쯤/);
  await expect(page.getByTestId('assets-card')).toBeVisible();
  // 진행 줄 상시 표시: 일시정지 / 1배 / 2배 / 4배 / 8배, 다음 결정으로, 자동 모드 (M4: 일시정지가 더해졌다)
  await expect(page.getByTestId('pause')).toBeVisible();
  for (const label of ['1배', '2배', '4배', '8배']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1배', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('skip')).toBeVisible();
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'false');
  // M2 자리표시 화면과 처음으로 버튼은 없다
  await expect(page.getByTestId('life-placeholder')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '처음으로' })).toHaveCount(0);
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 사건 로그 첫 줄은 출생신고의 한 줄 서술문(합쇼체, SPEC-003 BR3)
  await expect(page.getByTestId('log')).toContainText('로 태어났습니다');
  // 사운드·복잡한 애니메이션 없음: audio/video 요소 없음
  expect(await page.locator('audio, video, canvas').count()).toBe(0);
});

test('화면이 바뀔 때마다 새 화면의 제목으로 포커스가 옮겨진다 (R-030)', async ({ page }) => {
  const activeText = () => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`);
  await page.goto('/');
  await expect.poll(activeText).toBe('H1:수저 게임'); // 첫 화면의 제목(읽히는 글자는 게임명, 로고는 장식)
  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await begin.click();
  await expect.poll(async () => (await activeText()).startsWith('H1:')).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('roulette-heading');
  await skipRoulette(page);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('to-birth'); // 같은 자리의 같은 버튼 요소라 포커스가 그대로 남는다(키보드로 건너뛰어도 포커스를 잃지 않는다)
  await toBirthReport(page);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('birth-heading');
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
  test(`${vp.width}x${vp.height}: 선택지 3개는 스크롤로 모두 닿고 진행 줄 7개는 늘 화면 안에서 가려지지 않으며 가로 넘침이 없다 (M4: 전수 측정은 e2e/layout.spec.ts)`, async ({ page }, testInfo) => {
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
      // 바뀐 기대(M4): 선택지 카드는 고정 머리(약 95px) 아래에서 시작해 360×568에서는 셋째 선택지가 하단 진행 줄 밑에 있을 수 있다 — 각 선택지를 화면 가운데로 스크롤해 닿는지 본다(첫 화면 전체 적합은 layout.spec.ts가 따로 잰다).
      const choices = [...document.querySelectorAll('[data-testid="choice-panel"] button')].map((b) => {
        b.scrollIntoView({ block: 'center' });
        return rect(b);
      });
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        choices,
        controls: [...document.querySelectorAll('[data-testid="controls"] button')].map(rect),
      };
    });
    expect(boxes.choices).toHaveLength(3);
    expect(boxes.controls, '일시정지·1·2·4·8배·다음 결정으로·자동 모드').toHaveLength(7);
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

test('인생 기록(M4): 줄이 시간순으로 쌓여 맨 아래가 가장 최근이고 영역 안에서 스크롤되며, 긴 인생 중간 화면도 360px에서 넘치지 않는다', async ({ page }) => {
  // 바뀐 기대(M4): 예전에는 사건 로그가 「최근 6개, 최신이 맨 위」였다. 인생 기록 카드(DB12)는 모든 줄을 시간순으로 쌓고(연표 상한 300) 맨 아래가 최신이며,
  // 맨 아래를 보고 있으면 자동으로 따라가고 위로 올려 읽을 수 있다. 줄 수는 연표(history) 길이와 같다.
  await page.goto('/');
  const mid = await evalCore<GameState>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'present')));
     while (s.phase === 'life' && s.age < 50) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
     return s;`,
  );
  expect(mid.history.length).toBeGreaterThan(6);
  await injectSave(page, mid, '/');
  const rows = page.getByTestId('log-row');
  await expect(rows).toHaveCount(mid.history.length);
  const last = mid.history[mid.history.length - 1];
  await expect(rows.last()).toHaveClass(/latest/);
  await expect(rows.last()).toContainText(last.text);
  await expect(rows.first()).toContainText('로 태어났습니다');
  // 화면이 막 떴을 때 맨 아래(가장 최근)에서 시작한다
  const atBottom = await page.getByTestId('log-list').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
  expect(atBottom).toBeLessThanOrEqual(24);
  // 위로 올려 첫 줄(출생)까지 읽을 수 있다
  await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
  const firstVisibleInList = await page.getByTestId('log-list').evaluate((el) => {
    const row = el.querySelector('[data-testid="log-row"]')!.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return row.top >= box.top - 1 && row.bottom <= box.bottom + 1; // 기록 영역 안에서 첫 줄이 보인다(영역 자체가 쪽 화면에 있는지는 상관없다)
  });
  expect(firstVisibleInList).toBe(true);
  await expect(page.getByTestId('life-age')).toContainText(`${mid.age}세`);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------- 배속이 실제 진행 속도를 바꾼다 (연출 시간 상수 표) ----------

/** 앞으로 N해가 모두 "조용한 해"인 상태 (연출 시간이 일정해 시간 측정이 흔들리지 않는다) — M7a 이후 0세는 늘 첫 예방접종이 있어 20세 이후 상태다(e2e/helpers.ts#quietStart) */
const quietStartOf = (page: Page, years: number): Promise<GameState> => quietStart(page, years);

test('배속 설정이 실제 진행 간격을 바꾼다: 1배속의 한 해는 8배속의 몇 배로 길고, 매번 정확히 한 해씩만 진행된다 (한 해가 두 번 진행되지 않는다)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const start = await quietStartOf(page, 7);

  // 페이지 안에서 나이가 바뀔 때마다 시각을 기록한다(렌더 직후, 첫 렌더 포함). 시간 배율 4: 조용한 한 해가 1배속 HOLD_MS.quiet/4, 8배속 HOLD_MS.quiet/8/4.
  // 고정 대기로 "N초 뒤 나이"를 보지 않고 연속한 두 나이 변화 사이의 간격을 잰다 → 부하로 전체가 늦어져도 흔들리지 않는다.
  await page.addInitScript(() => {
    const w = window as unknown as { __ages: { age: number; t: number }[] };
    w.__ages = [];
    const record = () => {
      const strong = document.querySelector('[data-testid="life-age"] b'); // M4: 헤더의 나이 알약은 <b>31</b>세 (예전에는 <strong>)
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
