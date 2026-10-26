import { expect, test, type Page } from '@playwright/test';
import type { GameState, PlayTime } from '../src/core/types';
import { holdMsFor } from '../src/core/timing';
import { findPendingState, injectSave, oracleAuto, oracleLife, pressBegin, pressBeginToLife, quietStart, readSave, setPageVisible, skipRoulette, titleState, toBirthReport, withPlay, withoutPlay, evalCore } from './helpers';

/**
 * M8 플레이 시간 타이머와 인생 길이 모드 연출 (SPEC-003 LM2·LM3·LM5·LM6, docs/data/content-M8.md 5절·8-4절, designer 8절 D-93~D-95).
 * 실제 브라우저의 **실제 시계**로 짧게(3초 안팎) 잰다 — 타이머가 연출(hold)·결정 읽기(decide)만 표시 시간으로 세고, 일시정지·탭 가림·나가기 확인(idle)·카드 접기(fold)·기록 시트(note)는 따로 쌓는지,
 * 새로고침 뒤 이어서 쌓이는지(이어하기 횟수 포함), 배속·자동 모드·「다음 결정으로」가 깨끗한 판 표시를 바꾸는지, 연출 대기가 판의 인생 길이 모드·한 해 줄 수를 따르는지, 엔딩 블록이 저장된 기록을 그대로 보이는지.
 * 지금 값은 개발 서버 전용 탐침 `window.__playTime()`으로 저장 없이 읽는다(App.tsx) — 예전에는 pagehide 이벤트로 flush한 저장을 읽었는데, 수동적인 시간(idle)만 바뀐 기록은 쓰지 않게 되어(REV-003-M8-1 R-417) 저장으로는 idle을 읽을 수 없다.
 * 저장에 담기는 것(사람이 한 일이 있을 때만 쓰인다)과 탭 가림은 e2e/m8-playtime-save.spec.ts가 본다.
 * 연출 시간 실측(조용한 해 11.81 / 서술 해 28.69 / 결과 21.94 / 세 줄 해 45.56초 — 연출 계수 1.6875, SPEC-005 LM7b 형진 님 결정 2026-10-26: 1배속을 80% 속도로)은 배포 번들의 실제 시계를 쓰는 QA(Q1)가 맡고, 여기서는 개발 서버의 ?__timescale로 줄여 하한을 본다. 기대값은 `holdMsFor`(모드 표의 계수 한 곳)에서 가져온다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;

/** 앱의 타이머가 지금까지 쌓은 기록 (개발 전용 탐침 window.__playTime — 저장하지 않고 읽는다) */
async function playNow(page: Page): Promise<PlayTime> {
  const play = await page.evaluate(() => (window as unknown as { __playTime?: () => PlayTime | null }).__playTime?.() ?? null);
  expect(play, '시간을 재는 판은 타이머 기록이 있다').not.toBeNull();
  return play!;
}

const grew = (after: PlayTime, before: PlayTime, key: keyof PlayTime): number => after[key] - before[key];

test.describe('플레이 시간 타이머: 어느 버킷에 쌓이는가 (LM5)', () => {
  test('연출은 hold에 쌓이고, 일시정지·탭 가림·나가기 확인 동안에는 hold·decide가 늘지 않고 idle만 는다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const start = withPlay(await quietStart(page, 6));
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(3000);
    const a = await playNow(page);
    expect(a.hold, '1배속 연출이 흐르는 3초').toBeGreaterThan(2000);
    expect(a.hold).toBeLessThan(5500);
    expect(a.decide).toBe(0);
    expect(a.resumes, '새로고침(주입 뒤 열기)으로 들어온 판은 이어하기 1회').toBe(1);

    // 일시정지: 3초 동안 hold 증가 ≤ 0.3초, idle 증가
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    const p0 = await playNow(page);
    await page.waitForTimeout(3000);
    const p1 = await playNow(page);
    expect(grew(p1, p0, 'hold')).toBeLessThanOrEqual(300);
    expect(grew(p1, p0, 'decide')).toBe(0);
    expect(grew(p1, p0, 'idle')).toBeGreaterThan(2000);
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'false');

    // 탭 가림 (visibilityState를 속일 수 있게 getter를 건다 — helpers.ts#startPageHidden과 같은 방식인데 보이는 채로 시작한다)
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const w = window as unknown as { __vis: string };
      w.__vis = 'visible';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => w.__vis });
    });
    await setPageVisible(page, false);
    const h0 = await playNow(page);
    await page.waitForTimeout(3000);
    const h1 = await playNow(page);
    expect(grew(h1, h0, 'hold')).toBeLessThanOrEqual(300);
    expect(grew(h1, h0, 'idle')).toBeGreaterThan(2000);
    await setPageVisible(page, true);

    // 나가기 확인 단계
    await page.waitForTimeout(500);
    await page.getByTestId('tool-exit').click();
    await expect(page.getByTestId('exit-ask')).toBeVisible();
    const e0 = await playNow(page);
    await page.waitForTimeout(3000);
    const e1 = await playNow(page);
    expect(grew(e1, e0, 'hold')).toBeLessThanOrEqual(300);
    expect(grew(e1, e0, 'idle')).toBeGreaterThan(2000);
    await page.getByTestId('exit-no').click();
    await page.waitForTimeout(1500);
    const back = await playNow(page);
    expect(grew(back, e1, 'hold'), '확인 단계를 닫으면 다시 흐른다').toBeGreaterThan(800);
  });

  test('결정 카드를 읽는 시간은 decide, 카드를 접어 둔 시간은 fold에 쌓인다 (표시 시간에는 decide만)', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const decision = withPlay(await findPendingState(page, 'present'));
    await injectSave(page, decision, '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(3000);
    const d1 = await playNow(page);
    expect(d1.decide, '카드가 열려 있는 3초').toBeGreaterThan(2000);
    expect(d1.hold).toBeLessThanOrEqual(300);
    expect(d1.fold).toBe(0);

    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-fold')).toBeVisible();
    const f0 = await playNow(page);
    await page.waitForTimeout(3000);
    const f1 = await playNow(page);
    expect(grew(f1, f0, 'fold'), '접어 둔 3초').toBeGreaterThan(2000);
    expect(grew(f1, f0, 'decide')).toBeLessThanOrEqual(300);
    expect(grew(f1, f0, 'hold')).toBe(0);

    await page.getByTestId('decision-reopen').click();
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await page.waitForTimeout(1500);
    const r1 = await playNow(page);
    expect(grew(r1, f1, 'decide'), '다시 열면 decide가 이어진다').toBeGreaterThan(800);
    expect(grew(r1, f1, 'fold')).toBeLessThanOrEqual(600);
  });

  test('기록 시트(생각 남기기)가 열려 있는 동안은 note에만 쌓이고 hold는 늘지 않는다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const start = withPlay(await quietStart(page, 6));
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByTestId('tool-note').click();
    await expect(page.getByTestId('note-sheet')).toBeVisible();
    const n0 = await playNow(page);
    await page.waitForTimeout(3000);
    const n1 = await playNow(page);
    expect(grew(n1, n0, 'note'), '시트가 열린 3초').toBeGreaterThan(2000);
    expect(grew(n1, n0, 'hold')).toBeLessThanOrEqual(300);
    expect(grew(n1, n0, 'decide')).toBe(0);
  });

  test('새로고침 뒤에도 이어서 쌓이고(누적) 이어하기 횟수가 하나 오른다 — 닫을 때 직전까지의 시간이 저장에 담긴다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const start = withPlay(await quietStart(page, 6));
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(2500);
    const before = await playNow(page);
    await page.reload();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(2000);
    const after = await playNow(page);
    expect(after.hold, '새로고침 전에 쌓은 시간이 남아 있다').toBeGreaterThanOrEqual(before.hold);
    expect(after.hold - before.hold, '새로고침 뒤 2초가 이어서 쌓인다').toBeGreaterThan(1000);
    expect(after.hold - before.hold, '그 사이 시간이 한꺼번에 들어오지 않는다').toBeLessThan(6000);
    expect(after.resumes).toBe(before.resumes + 1);
  });
});

test.describe('깨끗한 판 표시: 배속 · 자동 모드 · 「다음 결정으로」 (D-95)', () => {
  test('1배속이 아닌 배속의 연출은 offSpeed에, 자동 모드 중의 시간은 auto에 쌓이고 1배속 수동은 둘 다 0이다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const start = withPlay(await quietStart(page, 6));
    await injectSave(page, start, '/', { speed: 8, autoMode: false });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(2500);
    const fast = await playNow(page);
    expect(fast.offSpeed, '8배속으로 흐른 연출').toBeGreaterThan(1500);
    expect(fast.auto).toBe(0);

    await injectSave(page, start, '/', { speed: 1, autoMode: true });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(2500);
    const auto = await playNow(page);
    expect(auto.auto, '자동 모드로 흐른 시간').toBeGreaterThan(1500);
    expect(auto.offSpeed).toBe(0);

    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.waitForTimeout(2000);
    const manual = await playNow(page);
    expect(manual.offSpeed).toBe(0);
    expect(manual.auto).toBe(0);
    expect(manual.skips).toBe(0);
  });

  test('「다음 결정으로」를 누르면 skips가 하나 오른다 (그 판은 깨끗하지 않다)', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const start = withPlay(await quietStart(page, 6));
    await injectSave(page, start, '/', MANUAL);
    await expect(page.getByTestId('skip')).toBeEnabled();
    await page.waitForTimeout(600);
    await page.getByTestId('skip').click();
    await expect(page.getByTestId('choice-panel')).toBeVisible({ timeout: 15_000 });
    const play = await playNow(page);
    expect(play.skips).toBe(1);
  });
});

/** 나이가 바뀔 때마다 시각을 기록한다(life.spec.ts와 같은 방식) */
async function trackAges(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __ages: { age: number; t: number }[] };
    w.__ages = [];
    const record = () => {
      const strong = document.querySelector('[data-testid="life-age"] b');
      if (strong === null) return;
      const age = Number((strong.textContent ?? '').split('세')[0]);
      if (w.__ages.length === 0 || w.__ages[w.__ages.length - 1].age !== age) w.__ages.push({ age, t: performance.now() });
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true });
  });
}
const agesLog = (page: Page) => page.evaluate(() => (window as unknown as { __ages: { age: number; t: number }[] }).__ages.slice());

test.describe('연출 대기: 판의 인생 길이 모드 계수와 한 해 줄 수 (LM2·LM3)', () => {
  test('연출 대기는 설정이 아니라 판의 인생 길이를 따른다: 판이 long60이면 설정이 short30이어도 한 해가 더 오래 걸린다 (조용한 해 14.0초 대 11.81초 — LM7b 이후 비는 1.19)', async ({ page }) => {
    test.setTimeout(120_000);
    await trackAges(page);
    await page.goto('/');
    const base = await quietStart(page, 7);
    const gaps = async (state: GameState): Promise<number[]> => {
      await injectSave(page, state, '/?__timescale=7', MANUAL); // 설정의 인생 길이는 둘 다 기본(short30)이다
      await expect.poll(async () => (await agesLog(page)).length, { timeout: 40_000 }).toBeGreaterThanOrEqual(4);
      const log = await agesLog(page);
      return log.slice(1).map((e, i) => e.t - log[i].t);
    };
    const shortGaps = await gaps({ ...base, lifeLength: 'short30' });
    const longGaps = await gaps({ ...base, lifeLength: 'long60' });
    const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    // 타이머는 일찍 울리지 않는다 → 하한은 부하와 무관하게 안전하다: 모드 표의 값에서 가져온다 — 30분 판 11813 / 7 = 1687.6ms, 1시간 판 14000 / 7 = 2000ms (LM7b: 30분 판의 계수가 1.25 → 1.35 → 1.6875로 올랐다)
    const shortMs = holdMsFor('quiet', { mode: 'short30' }) as number;
    const longMs = holdMsFor('quiet', { mode: 'long60' }) as number;
    expect(Math.min(...shortGaps), `30분 판 간격 ${shortGaps}`).toBeGreaterThanOrEqual((shortMs / 7) * 0.9);
    expect(Math.min(...longGaps), `1시간 판 간격 ${longGaps}`).toBeGreaterThanOrEqual((longMs / 7) * 0.9);
    // 계수 비 2.0 / 1.6875 = 1.185 — 이상적인 비의 절반 지점(= 1.09, 이전 시험의 기준 1.3은 이상 1.6의 절반 지점이었다)보다 커야 한다
    const ideal = longMs / shortMs;
    expect(median(longGaps) / median(shortGaps), `계수 비 ${(longMs / shortMs).toFixed(3)} — 이상적인 비의 절반 지점 ${(1 + (ideal - 1) / 2).toFixed(3)}보다 크다`).toBeGreaterThan(1 + (ideal - 1) / 2);
    // 판의 인생 길이는 그대로 저장돼 있다 (LM3)
    expect((await readSave(page)).data.lifeLength).toBe('long60');
  });

  test('한 해에 줄이 셋(1세의 걸음마 + 첫 말 + 일반 사건)이면 서술 해 대기가 줄 대기만큼 길다: 28.69 + 2 × 8.44 = 45.56초 (계수 1.6875, LM7b) / 시간 배율', async ({ page }) => {
    test.setTimeout(120_000);
    await trackAges(page);
    await page.goto('/');
    // 1세 첫머리에서 시작해, 그 해가 세 줄 서술 해이고 다음 해가 선택지가 아닌 판을 찾는다
    const found = await evalCore<GameState | null>(
      page,
      `for (let seed = 1; seed < 3000; seed++) {
         let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
         for (let guard = 0; guard < 20 && s.phase === 'life' && s.age < 1; guard++) {
           if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
           s = core.stepYear(s).state;
         }
         if (s.phase !== 'life' || s.age !== 1 || s.pending !== null) continue;
         const first = core.stepYear(s);
         if (first.tick.kind !== 'narrative' || first.tick.lines !== 3 || first.state.phase !== 'life') continue;
         const second = core.stepYear(first.state);
         if (second.tick.kind === 'choice') continue;
         return s;
       }
       return null;`,
    );
    expect(found, '세 줄 서술 해가 나오는 1세 시작 상태').not.toBeNull();
    await injectSave(page, withoutPlay(found!), '/?__timescale=20', MANUAL);
    // 나이 1(복원 직후 조용한 해 대기 11.81초 / 20) → 2(세 줄 서술 해 대기 45.56초 / 20 = 2278ms) → 3
    await expect.poll(async () => (await agesLog(page)).length, { timeout: 40_000 }).toBeGreaterThanOrEqual(3);
    const log = await agesLog(page);
    const restored = log[1].t - log[0].t;
    const threeLines = log[2].t - log[1].t;
    const quietMs = holdMsFor('quiet', { mode: 'short30' }) as number; // 11813
    const threeLineMs = holdMsFor('narrative', { mode: 'short30', lines: 3 }) as number; // 45564
    expect(restored, `복원 직후 조용한 해 간격 ${restored}`).toBeGreaterThanOrEqual((quietMs / 20) * 0.9);
    expect(threeLines, `세 줄 해 간격 ${threeLines}`).toBeGreaterThanOrEqual((threeLineMs / 20) * 0.9); // 2278ms: 한 줄 서술 해(28.69초 / 20 = 1434ms)보다 확실히 길다
  });
});

test.describe('엔딩 플레이 시간 블록 (D-93~D-95)', () => {
  const PLAY = { hold: 2_400_000, decide: 1_265_900, fold: 12_000, note: 20_000, idle: 31_000, offSpeed: 0, auto: 0, skips: 0, resumes: 3 };

  async function endedWith(page: Page, over: Partial<PlayTime> | null): Promise<GameState> {
    await page.goto('/');
    const ended = await oracleAuto(page, await oracleLife(page, 20261013, 'present'));
    expect(ended.phase).toBe('ending');
    return over === null ? ended : withPlay(ended, { ...PLAY, ...over });
  }

  test('저장된 기록 그대로 보인다: 2400.0초 + 1265.9초 → 61:05(분해 40:00 / 21:05), 새로고침 뒤에도 같은 값, 이어하기 횟수·접기·기록 시간은 화면에 없다', async ({ page }) => {
    const ended = await endedWith(page, {});
    await injectSave(page, ended, '/', MANUAL);
    const value = page.getByTestId('ending-playtime-value');
    await expect(value).toBeVisible();
    await expect(value.locator('[aria-hidden="true"]')).toHaveText('61:05');
    await expect(value.locator('.sr-only')).toHaveText('61분 5초');
    await expect(value).toHaveAttribute('datetime', 'PT61M5S');
    await expect(page.getByTestId('ending-playtime-hold').locator('[aria-hidden="true"]')).toHaveText('40:00');
    await expect(page.getByTestId('ending-playtime-decide').locator('[aria-hidden="true"]')).toHaveText('21:05');
    const block = page.getByTestId('ending-playtime');
    await expect(block).toContainText('이 판의 플레이 시간');
    await expect(block).toContainText('그 밖에 멈춰 있던 시간과 생각을 적은 시간은 넣지 않았습니다.');
    await expect(block).toContainText('이 기기에만 저장됩니다.');
    await expect(block).not.toContainText('짧게 잡힙니다');
    await expect(block).not.toContainText(/이어|일시정지/);
    await page.reload();
    await expect(page.getByTestId('ending-playtime-value').locator('[aria-hidden="true"]')).toHaveText('61:05');
    // 엔딩에서는 더 쌓이지 않는다: 몇 초 뒤에도 저장의 기록이 그대로다
    await page.waitForTimeout(2500);
    expect((await readSave(page)).data.play).toEqual({ ...PLAY });
  });

  test('1배속 수동이 아니면(배속 · 자동 모드 · 「다음 결정으로」 각각) 짧게 잡힌다는 문장이 뜬다', async ({ page }) => {
    for (const patch of [{ offSpeed: 5000 }, { auto: 5000 }, { skips: 2 }] as const) {
      const ended = await endedWith(page, patch);
      await injectSave(page, ended, '/', MANUAL);
      await expect(page.getByTestId('ending-playtime-note'), JSON.stringify(patch)).toContainText('배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라 1배속으로 직접 고른 판보다 짧게 잡힙니다.');
    }
  });

  test('시간 기록이 없는 판(M8 이전 저장)은 블록이 없고 엔딩의 나머지는 그대로다', async ({ page }) => {
    const ended = await endedWith(page, null);
    expect(ended.play).toBeUndefined();
    await injectSave(page, ended, '/', MANUAL);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('ending-death')).toBeVisible();
    await expect(page.getByTestId('ending-playtime')).toHaveCount(0);
  });

  test('값이 이상한 play(음수 · 문자열 · 1e308 · 배열 · null)는 그 필드만 버려 판은 열리고 블록만 없다', async ({ page }) => {
    for (const bad of [{ ...PLAY, hold: -5 }, { ...PLAY, decide: '12' }, { ...PLAY, idle: 1e308 }, [1, 2, 3], null]) {
      const ended = await endedWith(page, {});
      await injectSave(page, { ...ended, play: bad as unknown as PlayTime }, '/', MANUAL);
      await expect(page.getByTestId('ending-screen'), JSON.stringify(bad)).toBeVisible();
      await expect(page.getByTestId('ending-playtime')).toHaveCount(0);
    }
  });

  test('다시 태어나기 → 새 판은 0에서 시작한다: 인생이 시작되면 저장의 play가 0(이어하기 0)이고 이전 판의 값을 이어받지 않는다', async ({ page }) => {
    const ended = await endedWith(page, {});
    await injectSave(page, ended, '/', MANUAL);
    await expect(page.getByTestId('ending-playtime-value')).toBeVisible();
    await page.getByTestId('rebirth').click();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await pressBeginToLife(page);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const play = (await readSave(page)).data.play;
    expect(play, '새 판은 시간을 잰다').toBeDefined();
    expect(play!.hold).toBeLessThan(1500); // 인생이 막 시작됐다
    expect(play!.decide).toBe(0);
    expect(play!.skips).toBe(0);
    expect(play!.resumes).toBe(0);
    expect((await readSave(page)).data.seed, '새 판의 시드').not.toBe(ended.seed);
  });
});

test('첫 화면 → 태어나기 → 인생: 새 판은 play가 0으로 생기고 타이머가 돈다 (룰렛·출생신고 동안은 재지 않는다)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await injectSave(page, titleState(777), '/', MANUAL);
  await pressBegin(page);
  await skipRoulette(page);
  await toBirthReport(page);
  const born = (await readSave(page)).data;
  expect(born.phase).toBe('birth');
  expect(born.play, '출생신고까지는 play가 없다').toBeUndefined();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await page.waitForTimeout(2000);
  const play = await playNow(page);
  expect(play.hold).toBeGreaterThan(1000);
  expect(play.resumes).toBe(0);
});
