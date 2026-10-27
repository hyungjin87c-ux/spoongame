import { expect, test, type Page } from '@playwright/test';
import { SPOON_NAME } from '../tests/helpers/standingExpectations';
import {
  KNOWN_SEED,
  chooseGeneration,
  expectedBirth,
  injectSave,
  noHorizontalOverflow,
  pressBegin,
  readSave,
  titleState,
  toBirthReport,
} from './helpers';

/**
 * 출생 룰렛 화면 (SPEC-003 RL1~RL6, QM2-9 외모 원점수 0, DS1 헤더 로고 → SPEC-004 GM4: 세대 판).
 * 룰렛은 **두 릴(지역 · 수저)**뿐이다 — 출생 연도는 룰렛 몰래 뽑히고(GS6) 화면 글자에 나오지 않는다. 「랜덤 세대」로 시작하면 두 릴 앞에 세대 뽑기 단계(한 릴)가 한 번 더 있다(GS3).
 * 확률표는 고른 세대 **전체 기준**의 섞은 값(GS7, 독립 기준값 `tests/fixtures/gm3-mixture-reference.json`)이고 도는 동안 바뀌지 않는다.
 * 연출(가속 → 회전 → 감속, 총 4~6초, 수저 릴이 마지막)은 실제 시간으로 잰다. 흐름 테스트는 「건너뛰기」로 연출을 줄이고 여기서만 끝까지 기다린다.
 * 기대값은 core 순수 함수(개발 서버의 실제 모듈)와 사람이 직접 적은 표(tests/helpers)·시안 생성기가 낸 기준값으로 대조한다.
 */

/** 세대 줄 이름·출생 범위 — SPEC-004 GD1을 직접 적은 표 */
const GENERATIONS = {
  industrial: { name: '산업화 세대 · 전후 세대', from: 1940, to: 1954 },
  boomer: { name: '베이비붐 세대', from: 1955, to: 1963 },
  g86: { name: '86세대', from: 1960, to: 1969 },
  genx: { name: 'X세대', from: 1970, to: 1980 },
  millennial: { name: '밀레니얼 세대', from: 1981, to: 1996 },
  genz: { name: 'Z세대', from: 1997, to: 2012 },
  alpha: { name: '알파 세대', from: 2013, to: 2020 },
} as const;
type GenerationKey = keyof typeof GENERATIONS;
const FIXED: readonly GenerationKey[] = ['industrial', 'alpha'];

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 릴이 멈추는 시각을 브라우저 안에서 기록한다(MutationObserver — 폴링 오차 없이). start = 두 릴 화면(회전 중)이 처음 나타난 시각 */
async function recordReelTimes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __reel: { start: number | null; region: number | null; wealth: number | null; result: number | null } };
    w.__reel = { start: null, region: null, wealth: null, result: null };
    const check = () => {
      const now = performance.now();
      const screen = document.querySelector('[data-testid="roulette-screen"]');
      if (screen !== null && screen.getAttribute('data-state') === 'spinning' && w.__reel.start === null) w.__reel.start = now;
      if (w.__reel.start === null) return;
      if (w.__reel.region === null && document.querySelector('[data-testid="reel-region"][data-state="stopped"]') !== null) w.__reel.region = now;
      if (w.__reel.wealth === null && document.querySelector('[data-testid="reel-wealth"][data-state="stopped"]') !== null) w.__reel.wealth = now;
      if (w.__reel.result === null && screen?.getAttribute('data-state') === 'result') w.__reel.result = now;
    };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  });
}

async function reelTimes(page: Page) {
  return page.evaluate(() => (window as unknown as { __reel: { start: number | null; region: number | null; wealth: number | null; result: number | null } }).__reel);
}

/** 독립 기준값(시안 생성기가 낸 세대별 섞음 비율): 수저 5단계 정수 %, 지역 소수 첫째 자리 % — 개발 서버가 그대로 내어 준다 */
async function mixtureReference(page: Page): Promise<Record<string, { wealth: number[]; region: Array<{ short: string; pct: string }> }>> {
  return page.evaluate(async () => ((await (await fetch('/tests/fixtures/gm3-mixture-reference.json')).json()) as { gens: Record<string, { wealth: number[]; region: Array<{ short: string; pct: string }> }> }).gens);
}

for (const g of FIXED) {
  test(`${GENERATIONS[g].name}: 룰렛 연출 — 지역·수저 두 릴이 나란히 돌고 총 4~6초, 지역 릴이 먼저·수저 릴이 마지막에 멈추며, 멈춘 자리가 저장된 출생 결과다. 연도는 어디에도 나오지 않는다 (RL1·RL2·GS6)`, async ({ page }) => {
    test.setTimeout(60_000);
    await recordReelTimes(page);
    await injectSave(page, titleState(KNOWN_SEED));
    await chooseGeneration(page, g);
    await pressBegin(page);

    const screen = page.getByTestId('roulette-screen');
    await expect(screen).toHaveAttribute('data-state', 'spinning');
    const saved = (await readSave(page)).data;
    expect(saved.phase).toBe('roulette');
    expect(saved.generation).toBe(g);
    expect(saved.fromRandom, '직접 고른 세대에는 「랜덤」 표지가 없다').toBeUndefined();
    const c = saved.character!;
    const r = saved.birthReport!;
    expect(c.birthYear).toBeGreaterThanOrEqual(GENERATIONS[g].from);
    expect(c.birthYear).toBeLessThanOrEqual(GENERATIONS[g].to);

    // 회전 화면: 제목·안내·두 릴(스크린리더가 읽지 않음)·나란히·「건너뛰기」, 세대 줄(이름 + 범위만)
    await expect(page.getByTestId('roulette-heading')).toHaveText('태어날 집과 땅을 고르는 중');
    await expect(page.getByTestId('roulette-gen')).toContainText(GENERATIONS[g].name.replace(' · ', ' · '));
    await expect(page.getByTestId('roulette-gen')).toContainText(`${GENERATIONS[g].from}~${GENERATIONS[g].to}년생 가운데`);
    await expect(page.getByTestId('reel-wealth')).toHaveAttribute('data-state', 'spinning');
    await expect(page.getByTestId('reel-region')).toHaveAttribute('data-state', 'spinning');
    await expect(page.getByTestId('reel-wealth')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('reel-region')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-testid="reel-generation"]'), '연도 릴·세대 릴은 룰렛에 없다').toHaveCount(0);
    await expect(page.locator('[data-testid^="reel-"]'), '릴은 지역·수저 둘뿐').toHaveCount(2);
    const boxes = await page.evaluate(() => {
      const rect = (id: string) => {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return { wealth: rect('reel-wealth'), region: rect('reel-region') };
    });
    expect(Math.abs(boxes.wealth.top - boxes.region.top), '두 릴이 같은 높이에서 나란히').toBeLessThanOrEqual(1);
    expect(boxes.wealth.right <= boxes.region.left + 0.5 || boxes.region.right <= boxes.wealth.left + 0.5, '두 릴이 겹치지 않는다').toBe(true);
    await expect(page.getByTestId('skip-roulette')).toBeVisible();
    await expect(page.getByTestId('to-birth')).toHaveCount(0);
    // 회전 중에는 결과를 알리는 고지가 보이지 않는다(결과 뒤에만, R-132) — 자리는 차지해 길이가 변하지 않는다
    await expect(page.getByTestId('page-foot')).toBeHidden();

    // 연출이 끝나길 기다린다(최대 8초)
    await expect(screen).toHaveAttribute('data-state', 'result', { timeout: 8_000 });
    const t = await reelTimes(page);
    expect(t.start, '시작 시각').not.toBeNull();
    expect(t.region, '지역 릴 정지 시각').not.toBeNull();
    expect(t.wealth, '수저 릴 정지 시각').not.toBeNull();
    const regionSec = (t.region! - t.start!) / 1000;
    const wealthSec = (t.wealth! - t.start!) / 1000;
    expect(wealthSec, `총 연출 ${wealthSec.toFixed(2)}초`).toBeGreaterThanOrEqual(4);
    expect(wealthSec, `총 연출 ${wealthSec.toFixed(2)}초`).toBeLessThanOrEqual(6);
    expect(regionSec, `지역 릴 ${regionSec.toFixed(2)}초 < 수저 릴 ${wealthSec.toFixed(2)}초`).toBeLessThan(wealthSec - 0.5);
    expect(regionSec, '지역 릴도 가속·회전·감속을 거친 뒤 멈춘다').toBeGreaterThan(2);

    // 멈춘 자리 = 저장된 출생 결과 (연출은 결과를 바꾸지 않는다) — 저장은 연출 전후로 같다
    expect((await readSave(page)).data).toEqual(saved);
    await expect(page.getByTestId('roulette-heading')).toHaveText('태어날 곳이 정해졌습니다');
    const wealthResult = page.locator('[data-testid="reel-wealth"] [data-result="true"]');
    await expect(wealthResult).toHaveCount(1);
    expect(await wealthResult.innerText()).toContain(SPOON_NAME[c.parentWealth]);
    const regionResult = page.locator('[data-testid="reel-region"] [data-result="true"]');
    await expect(regionResult).toHaveCount(1);
    expect(squash(await regionResult.innerText())).toBe(r.region);
    // 상태 줄(role="status") = 「흙수저(하위 25% 안쪽) 서울」 — 구간 글은 세대 전체 기준 섞음 비율에서 나오고 연도는 없다
    const status = page.getByTestId('roulette-status');
    await expect(status).toHaveAttribute('role', 'status');
    const statusText = squash(await status.innerText());
    expect(statusText).toContain(r.region);
    expect(statusText).toMatch(new RegExp(`${SPOON_NAME[c.parentWealth]}\\s*\\((?:하위|상위)`));
    // 결과 뒤에만 보이는 작은 글, 「출생신고 보기」(기본 버튼)
    await expect(page.getByTestId('page-foot')).toBeVisible();
    await expect(page.getByTestId('page-foot')).toContainText('돌림판은 연출이고, 결과는 돌기 전에 정해진 값이에요.');
    await expect(page.getByTestId('to-birth')).toBeVisible();
    await expect(page.getByTestId('skip-roulette')).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);

    // GS6: 화면 글자에 출생 연도가 없다 — 네 자리 연도는 세대 범위의 양 끝(「{from}~{to}년생」)뿐
    const text = await screen.innerText();
    const years = [...text.matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));
    for (const y of years) expect([GENERATIONS[g].from, GENERATIONS[g].to, 1981], `화면에 나온 연도 ${y}`).toContain(y); // 1981 = 지역 표 주석의 「1981년 전은 출생 자료가 없어」(고정 문장)
    // R-515 a: 속성(aria-label·data-*·title·style)까지 — 마크업 전체에서도 세대 범위 양 끝·정해진 문구의 1981 밖의 연도는 없다. xmlns(w3.org/2000/svg)는 연도가 아니라 빼고 센다
    const markup = (await screen.evaluate((el) => el.outerHTML)).replace(/ xmlns="[^"]*"/g, '');
    for (const m of markup.matchAll(/(?<!\d)(19[4-9]\d|20[0-2]\d)(?!\d)/g)) expect([GENERATIONS[g].from, GENERATIONS[g].to, 1981], `마크업(속성 포함)에 나온 연도 ${m[1]}`).toContain(Number(m[1]));
  });
}

test('랜덤 세대 (GS3): 「태어나기」에서 한 세대가 뽑히고(세대 뽑기 단계 → 두 릴), 세대 줄 앞에 「랜덤 세대에서 뽑힌」이 붙는다', async ({ page }) => {
  test.setTimeout(60_000);
  await injectSave(page, titleState(KNOWN_SEED)); // 처음 방문 = 랜덤 세대
  const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'random');
  await pressBegin(page);
  const screen = page.getByTestId('roulette-screen');
  await expect(screen).toHaveAttribute('data-state', 'draw');
  await expect(page.getByTestId('roulette-heading')).toHaveText('어느 세대로 살아볼지 뽑는 중');
  await expect(page.getByTestId('reel-generation')).toBeVisible();
  // 세대 뽑기 표: 일곱 세대 모두 1/7 (인구 비례가 아니다)
  const rows = (await page.locator('[data-testid="odds-generation"] tbody tr').allInnerTexts()).map(squash);
  expect(rows).toHaveLength(7);
  for (const row of rows) expect(row.endsWith('1/7'), row).toBe(true);
  // 뽑기가 끝나면 두 릴 단계로 넘어온다
  await expect(screen).toHaveAttribute('data-state', 'spinning', { timeout: 6_000 });
  const saved = (await readSave(page)).data;
  expect(saved).toEqual(oracle.once);
  expect(saved.fromRandom).toBe(true);
  const g = saved.generation as GenerationKey;
  expect(Object.keys(GENERATIONS)).toContain(g);
  await expect(page.getByTestId('roulette-gen')).toContainText('랜덤 세대에서 뽑힌');
  await expect(page.getByTestId('roulette-gen')).toContainText(GENERATIONS[g].name);
  await expect(page.getByTestId('reel-region')).toBeVisible();
  await expect(page.getByTestId('reel-wealth')).toBeVisible();
});

test('확률표 (RL3·GS7): 수저 확률 = 고른 세대 전체 기준의 섞은 값(합 100, 독립 기준값), 지역 확률 합 100.0, 표 머리 「{세대} 전체 기준」·주석 — 도는 동안에도 보이고 바뀌지 않는다', async ({ page }) => {
  test.setTimeout(90_000);
  await injectSave(page, titleState(KNOWN_SEED));
  const ref = await mixtureReference(page);
  for (const g of ['industrial', 'genx', 'alpha'] as const) {
    await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: g });
    await pressBegin(page);
    await expect(page.getByTestId('roulette-screen')).toBeVisible();
    // 확률표는 회전 중에도 보인다(릴 아래 작은 글씨)
    const wealth = (await page.locator('[data-testid="odds-wealth"] tbody tr').allInnerTexts()).map(squash);
    expect(wealth, g).toEqual(ref[g].wealth.map((pct, i) => `${SPOON_NAME[(i + 1) as 1 | 2 | 3 | 4 | 5]} ${pct}%`));
    expect(ref[g].wealth.reduce((a, b) => a + b, 0)).toBe(100);
    await expect(page.locator('[data-testid="odds-wealth"] .odds__head')).toHaveText(`${GENERATIONS[g].name} 전체 기준`);
    await expect(page.locator('[data-testid="odds-region"] .odds__head')).toHaveText(`${GENERATIONS[g].name} 전체 기준`);
    await expect(page.getByTestId('odds-wealth-note')).toContainText(`${GENERATIONS[g].from}~${GENERATIONS[g].to}년생의 설계값을 해마다 섞은 값이에요`);
    const regionRows = (await page.locator('[data-testid="odds-region"] tbody tr').allInnerTexts()).map(squash);
    expect(regionRows, g).toEqual(ref[g].region.map((r) => `${r.short} ${r.pct}%`));
    const tenths = regionRows.map((row) => Math.round(parseFloat(/(\d+\.\d)%$/.exec(row)![1]) * 10));
    expect(tenths.reduce((a, b) => a + b, 0), `${g} 지역 확률 합 100.0`).toBe(1000);
    const note = await page.getByTestId('odds-region-note').innerText();
    expect(note).toContain('이름은 줄여 적었어요');
    if (g === 'industrial' || g === 'genx') expect(note).toContain('1981년 전은 출생 자료가 없어');
    else expect(note).not.toContain('1981년 전은 출생 자료가 없어');
    // 같은 표가 결과 상태에서도 그대로다(도는 동안 바뀌지 않는다)
    await expect(page.getByTestId('skip-roulette')).toBeEnabled();
    await page.getByTestId('skip-roulette').click();
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
    expect((await page.locator('[data-testid="odds-wealth"] tbody tr').allInnerTexts()).map(squash)).toEqual(wealth);
    expect((await page.locator('[data-testid="odds-region"] tbody tr').allInnerTexts()).map(squash)).toEqual(regionRows);
  }
});

test('직접 고른 시도 (RG1·RG2): 고른 시도는 지역 릴이 돌지 않고 그 칸에 멈춰 있으며 지역 표 자리에 「직접 고른 시도」 한 줄이 서고, 결과의 시도가 고른 시도다', async ({ page }) => {
  test.setTimeout(60_000);
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'alpha' });
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 화면 진입 입력 가드(0.4초)가 풀린 뒤에 고른다
  await page.getByTestId('regmode-pick').check();
  await expect(page.getByTestId('region-chips')).toBeVisible();
  await page.getByTestId('sido-부산').check();
  await expect(page.getByTestId('sido-부산')).toBeChecked();
  await pressBegin(page);
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'spinning');
  const saved = (await readSave(page)).data;
  expect(saved.regionPicked).toBe(true);
  expect(saved.birthReport!.region).toBe('부산');
  await expect(page.getByTestId('odds-region')).toHaveText('직접 고른 시도');
  await expect(page.getByTestId('roulette-status')).toContainText('직접 골랐어요');
  await expect(page.getByTestId('reel-region')).not.toHaveAttribute('data-state', 'spinning'); // 지역 릴은 돌지 않는다
  await expect(page.getByTestId('reel-wealth')).toHaveAttribute('data-state', 'spinning'); // 수저 릴은 돈다
  await page.getByTestId('skip-roulette').click();
  await expect(page.getByTestId('roulette-status')).toContainText('부산');
});

test('건너뛰기 (RL1): 누르면 곧바로 결과 상태가 되고, 결과·저장은 연출을 기다렸을 때와 같다. 다시 굴리기는 없다 (RL5)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'genx' });
  const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'genx');
  await pressBegin(page);
  const skip = page.getByTestId('skip-roulette');
  await expect(skip).toBeEnabled(); // 진입 직후 0.4초는 입력 가드
  await skip.click();
  const screen = page.getByTestId('roulette-screen');
  await expect(screen).toHaveAttribute('data-state', 'result');
  await expect(page.getByTestId('reel-wealth')).toHaveAttribute('data-state', 'stopped');
  await expect(page.getByTestId('reel-region')).toHaveAttribute('data-state', 'stopped');
  await expect(page.getByTestId('skip-roulette')).toHaveCount(0);
  expect((await readSave(page)).data).toEqual(oracle.once);
  // 되돌아가 다시 굴리는 길이 없다: 새로고침해도 결과 상태 그대로, 저장 그대로
  await page.reload();
  await expect(screen).toHaveAttribute('data-state', 'result');
  expect((await readSave(page)).data).toEqual(oracle.once);
  await expect(page.getByRole('button', { name: /다시 굴|다시 뽑|다시 돌/ })).toHaveCount(0);
  await toBirthReport(page);
});

test('새로고침 복원 (RL5·R-021): 룰렛 도중 새로고침(연타 포함)해도 다시 돌지 않고 결과가 확정된 모습으로 열리며 저장이 같다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'millennial' });
  await pressBegin(page);
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'spinning');
  const before = (await readSave(page)).data;
  const text = await page.getByTestId('roulette-screen').innerText(); // 회전 중 글자(제목 등)는 결과 상태와 다르다
  for (let i = 0; i < 4; i++) await page.reload();
  const screen = page.getByTestId('roulette-screen');
  await expect(screen).toHaveAttribute('data-state', 'result');
  await expect(page.getByTestId('reel-wealth')).toHaveAttribute('data-state', 'stopped');
  expect(await screen.innerText()).not.toBe(text);
  const after = (await readSave(page)).data;
  expect(after).toEqual(before); // 난수를 더 쓰지도, 결과가 바뀌지도 않았다(rngState 포함)
  // 결과 상태에서 다시 새로고침해도 같은 화면
  const resultText = await screen.innerText();
  await page.reload();
  await expect(screen).toHaveAttribute('data-state', 'result');
  expect(await screen.innerText()).toBe(resultText);
  expect((await readSave(page)).data).toEqual(before);
});

test('움직임 줄이기 (R-171): 회전 화면을 거치지 않고 곧바로 결과 상태 + 안내 한 줄 + 「출생신고 보기」, 「건너뛰기」는 없다 (랜덤 세대도 뽑기 단계를 거치지 않는다)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'random' });
  const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'random');
  await pressBegin(page);
  const screen = page.getByTestId('roulette-screen');
  await expect(screen).toHaveAttribute('data-state', 'result');
  await expect(page.getByTestId('motion-note')).toHaveText('움직임 줄이기가 켜져 있어 돌림판을 돌리지 않고 결과만 보여 드려요.');
  await expect(page.getByTestId('reel-wealth')).toHaveAttribute('data-state', 'stopped');
  await expect(page.getByTestId('reel-region')).toHaveAttribute('data-state', 'stopped');
  await expect(page.getByTestId('skip-roulette')).toHaveCount(0);
  await expect(page.getByTestId('to-birth')).toBeVisible();
  await expect(page.getByTestId('roulette-heading')).toHaveText('태어날 곳이 정해졌습니다');
  expect((await readSave(page)).data).toEqual(oracle.once);
  // RL1 · M3-O09 · R-301: 움직임 줄이기에서도 후보 전체는 릴 아래 확률표로 보인다 — 릴은 결과 칸 앞뒤 2칸(5칸)뿐이다
  const reelRegion = (await page.locator('[data-testid="reel-region"] .reel__item').allInnerTexts()).map((t) => t.trim());
  const oddsRegion = (await page.locator('[data-testid="odds-region"] th[scope="row"]').allInnerTexts()).map((t) => t.trim());
  expect(reelRegion, '지역 릴은 결과 칸 앞뒤 2칸').toHaveLength(5);
  expect(reelRegion[2]).toBe(oracle.once.birthReport!.region);
  expect(oddsRegion.length, '확률표에 지역 후보 전체(릴 5칸보다 많다)').toBeGreaterThan(5);
  for (const name of reelRegion) expect(oddsRegion, `릴의 칸 「${name}」은 확률표에도 있다`).toContain(name);
  await expect(page.locator('[data-testid="reel-wealth"] .reel__item')).toHaveCount(5);
  await expect(page.locator('[data-testid="odds-wealth"] th[scope="row"]')).toHaveCount(5);
  const reelGrades = await page.locator('[data-testid="reel-wealth"] .reel__item .grade').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-grade'))));
  expect(reelGrades, '수저 릴은 5칸').toHaveLength(5);
  expect(reelGrades[2], '가운데 칸이 결과').toBe(oracle.once.character!.parentWealth);
  for (let k = 0; k < 4; k++) expect(Math.abs(reelGrades[k] - reelGrades[k + 1]), `결과 ±2칸이 이웃 단계: ${reelGrades.join('')}`).toBe(1);
  await toBirthReport(page);
});

test('접근성 (RL6): 키보드만으로 건너뛰기·이동 — 제목에 포커스, Tab으로 「건너뛰기」, Enter, 같은 자리의 「출생신고 보기」, Enter, 출생신고 제목에 포커스', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'genz' });
  await pressBegin(page);
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('roulette-heading'); // 화면이 뜨면 제목으로 포커스(R-030)
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('skip-roulette')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  // 결과 상태: 같은 자리의 버튼이 「출생신고 보기」로 바뀐다. 같은 버튼 요소라 키보드 포커스가 그대로 남고, 입력 가드는 다시 닫혔다 풀린다
  await expect(page.getByTestId('to-birth')).toBeFocused();
  await expect(page.getByTestId('to-birth')).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('birth-heading');
});

test('하단 띠: 「건너뛰기」·「출생신고 보기」가 화면 아래에 고정돼 스크롤해도 같은 자리에 있고 눌린다 (360x740 · 1280x800)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'alpha' });
  await pressBegin(page);
  await expect(page.getByTestId('roulette-screen')).toBeVisible(); // 지연 로드 뒤 룰렛이 그려진 다음에 띠를 잰다(그 전에는 첫 화면의 띠가 바뀌는 중이다)
  const barBox = async () => page.getByTestId('bottom-bar').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { position: getComputedStyle(el).position, bottom: r.bottom, vh: window.innerHeight, left: r.left, right: r.right };
  });
  const spinning = await barBox();
  expect(spinning.position).toBe('fixed');
  expect(Math.abs(spinning.bottom - spinning.vh), '띠가 화면 아래에 붙어 있다').toBeLessThanOrEqual(1);
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const scrolled = await barBox();
  expect(scrolled.bottom).toBe(spinning.bottom);
  // 한가운데 점에서 그 버튼이 맞는다 (본문이 가리지 않는다)
  const hit = await page.getByTestId('skip-roulette').evaluate((b) => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el !== null && (b === el || b.contains(el));
  });
  expect(hit).toBe(true);
  await page.getByTestId('skip-roulette').click();
  await expect(page.getByTestId('to-birth')).toBeEnabled();
  const result = await barBox();
  expect(result.position).toBe('fixed');
  expect(result.bottom).toBe(spinning.bottom);
});

for (const screenId of ['roulette', 'birth'] as const) {
  test(`헤더 로고 (DS1): ${screenId === 'roulette' ? '룰렛' : '출생신고'} 화면 헤더에 게임명 워드마크가 있고 글자 높이 ≥ 22px, 화면 폭 안에 든다`, async ({ page }) => {
    await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'alpha' });
    await pressBegin(page);
    await expect(page.getByTestId('skip-roulette')).toBeEnabled();
    await page.getByTestId('skip-roulette').click();
    if (screenId === 'birth') await toBirthReport(page);
    await expect(page.getByTestId('site-head')).toBeVisible();
    // 워드마크 글자 높이 = 도형 상자 높이 + 획 굵기(getBoundingClientRect는 획 두께를 빼고 잰다): 눈에 보이는 글자 높이
    const m = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="header-logo"] svg') as SVGSVGElement;
      const wordmark = svg.querySelector(':scope > g') as SVGGraphicsElement;
      const stroke = parseFloat(getComputedStyle(wordmark).strokeWidth) * (wordmark.getScreenCTM()?.a ?? 0);
      return { logo: svg.getBoundingClientRect().height, word: wordmark.getBoundingClientRect().height + stroke, width: svg.getBoundingClientRect().width, vw: innerWidth, label: svg.getAttribute('aria-label') ?? '' };
    });
    expect(m.word, `워드마크 글자 높이 ${m.word}px`).toBeGreaterThanOrEqual(22);
    expect(m.logo).toBeGreaterThanOrEqual(m.word);
    expect(m.width).toBeLessThanOrEqual(m.vw);
    expect(m.label).toContain('수저 게임');
    await expect(page).toHaveTitle('수저 게임'); // 탭 제목 유지
  });
}

test('글자 점검: 룰렛 화면에 느낌표·이모지·외모 점수·접속자 표현이 없다 (회전 중·결과)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, generation: 'boomer' });
  await pressBegin(page);
  const check = async () => {
    const text = await page.getByTestId('roulette-screen').innerText();
    expect(text).not.toMatch(/!|[\u{1F300}-\u{1FAFF}]/u);
    expect(text).not.toMatch(/외모\s*\d+\s*점|접속자|소득\s*\d\s*분위/);
  };
  await check();
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await page.getByTestId('skip-roulette').click();
  await check();
});
