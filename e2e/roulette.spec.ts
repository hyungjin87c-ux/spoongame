import { expect, test, type Page } from '@playwright/test';
import { ERA_CONFIG } from '../src/data/birthTable';
import { SPOON_NAME, expectedWealthLine } from '../tests/helpers/standingExpectations';
import {
  KNOWN_SEED,
  chooseEra,
  expectedBirth,
  injectSave,
  noHorizontalOverflow,
  pressBegin,
  readSave,
  titleState,
  toBirthReport,
} from './helpers';

/**
 * 출생 룰렛 화면 (SPEC-003 RL1~RL6, QM2-9 외모 원점수 0, DS1 헤더 로고).
 * 연출(가속 → 회전 → 감속, 총 4~6초, 수저 릴이 마지막)은 실제 시간으로 잰다. 흐름 테스트는 「건너뛰기」로 연출을 줄이고 여기서만 끝까지 기다린다.
 * 기대값은 core 순수 함수(개발 서버의 실제 모듈)와 사람이 직접 적은 표(tests/helpers)로 대조한다.
 */

const ERAS = ['past', 'present', 'future'] as const;
const ERA_NAMES = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' } as const;
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
/** 「A · B」 쌍은 줄 폭에 따라 한 줄 또는 두 줄이고 가운뎃점은 CSS가 그린다 → 글자만 비교한다 */
const pairText = (s: string) => squash(s.replace(/ · /g, ' '));

/** 릴이 멈추는 시각을 브라우저 안에서 기록한다(MutationObserver — 폴링 오차 없이). start = 룰렛 화면이 처음 나타난 시각 */
async function recordReelTimes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __reel: { start: number | null; region: number | null; wealth: number | null; result: number | null } };
    w.__reel = { start: null, region: null, wealth: null, result: null };
    const check = () => {
      const now = performance.now();
      const screen = document.querySelector('[data-testid="roulette-screen"]');
      if (screen !== null && w.__reel.start === null) w.__reel.start = now;
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

for (const era of ERAS) {
  test(`${ERA_NAMES[era]}: 룰렛 연출 — 수저·지역 릴이 나란히 돌고 총 4~6초, 지역 릴이 먼저·수저 릴이 마지막에 멈추며, 멈춘 자리가 저장된 출생 결과다 (RL1·RL2)`, async ({ page }) => {
    test.setTimeout(60_000);
    await recordReelTimes(page);
    await injectSave(page, titleState(KNOWN_SEED));
    await chooseEra(page, era);
    await pressBegin(page);

    const screen = page.getByTestId('roulette-screen');
    await expect(screen).toHaveAttribute('data-state', 'spinning');
    const saved = (await readSave(page)).data;
    expect(saved.phase).toBe('roulette');
    const c = saved.character!;
    const r = saved.birthReport!;

    // 회전 화면: 제목·안내·두 릴(스크린리더가 읽지 않음)·나란히·「건너뛰기」
    await expect(page.getByTestId('roulette-heading')).toHaveText('태어날 집과 땅을 고르는 중');
    await expect(page.getByTestId('reel-wealth')).toHaveAttribute('data-state', 'spinning');
    await expect(page.getByTestId('reel-region')).toHaveAttribute('data-state', 'spinning');
    await expect(page.getByTestId('reel-wealth')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('reel-region')).toHaveAttribute('aria-hidden', 'true');
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
    // 상태 줄(role="status") = 「흙수저(하위 25% 안쪽) · 서울」
    const status = page.getByTestId('roulette-status');
    await expect(status).toHaveAttribute('role', 'status');
    expect(pairText(await status.innerText())).toBe(pairText(`${expectedWealthLine(era, c.parentWealth)} ${r.region}`));
    // 결과 뒤에만 보이는 작은 글, 「출생신고 보기」(기본 버튼)
    await expect(page.getByTestId('page-foot')).toBeVisible();
    await expect(page.getByTestId('page-foot')).toContainText('돌림판은 연출이고, 결과는 돌기 전에 정해진 값이에요.');
    await expect(page.getByTestId('to-birth')).toBeVisible();
    await expect(page.getByTestId('skip-roulette')).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

test('확률표 (RL3): 수저 확률 = 세상의 설계값(합 100), 지역 확률 합 100.0, 주석(설계값·출처) — 세 시대', async ({ page }) => {
  test.setTimeout(60_000);
  for (const era of ERAS) {
    await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, era });
    await pressBegin(page);
    await expect(page.getByTestId('roulette-screen')).toBeVisible();
    // 확률표는 회전 중에도 보인다(릴 아래 작은 글씨)
    const wealth = (await page.locator('[data-testid="odds-wealth"] tbody tr').allInnerTexts()).map((row) => row.replace(/\s+/g, ' ').trim());
    expect(wealth, era).toEqual([1, 2, 3, 4, 5].map((tier) => `${SPOON_NAME[tier as 1 | 2 | 3 | 4 | 5]} ${ERA_CONFIG[era].wealthWeights[tier - 1]}%`));
    expect(ERA_CONFIG[era].wealthWeights.reduce((a, b) => a + b, 0)).toBe(100);
    await expect(page.getByTestId('odds-wealth-note')).toHaveText('게임의 설계값이에요(통계가 아님).');
    const regionRows = (await page.locator('[data-testid="odds-region"] tbody tr').allInnerTexts()).map((row) => row.replace(/\s+/g, ' ').trim());
    expect(regionRows.length, era).toBeGreaterThanOrEqual(10);
    expect(regionRows.length, era).toBeLessThanOrEqual(17);
    const tenths = regionRows.map((row) => Math.round(parseFloat(/(\d+\.\d)%$/.exec(row)![1]) * 10));
    expect(tenths.reduce((a, b) => a + b, 0), `${era} 지역 확률 합 100.0`).toBe(1000);
    const note = await page.getByTestId('odds-region-note').innerText();
    if (era === 'present') {
      expect(note).toContain('국가데이터처');
      expect(note).toMatch(/\d{4}년 시·도별 출생아 수 비율/);
    } else {
      expect(note).toContain('지금 통계를 바탕으로 한 설계값');
    }
  }
});

test('건너뛰기 (RL1): 누르면 곧바로 결과 상태가 되고, 결과·저장은 연출을 기다렸을 때와 같다. 다시 굴리기는 없다 (RL5)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, era: 'present' });
  const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'present');
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
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, era: 'future' });
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

test('움직임 줄이기 (R-171): 회전 화면을 거치지 않고 곧바로 결과 상태 + 안내 한 줄 + 「출생신고 보기」, 「건너뛰기」는 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, era: 'present' });
  const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'present');
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
  // 결과가 저장된 출생 결과다
  const c = oracle.once.character!;
  const status = pairText(await page.getByTestId('roulette-status').innerText());
  expect(status).toBe(pairText(`${expectedWealthLine('present', c.parentWealth)} ${oracle.once.birthReport!.region}`));
  // RL1 · M3-O09 · R-301: 움직임 줄이기에서도 후보 전체는 릴 아래 확률표로 보인다 — 릴은 결과 칸 앞뒤 2칸(5칸)뿐이고(지역은 확률표 순서의 이웃 칸, 수저는 왕복 순서의 이웃 단계),
  // 수저·지역 후보 전체는 확률표 행이다(수저 5행, 지역 14~16행)
  const reelRegion = (await page.locator('[data-testid="reel-region"] .reel__item').allInnerTexts()).map((t) => t.trim());
  const oddsRegion = (await page.locator('[data-testid="odds-region"] th[scope="row"]').allInnerTexts()).map((t) => t.trim());
  expect(reelRegion, '지역 릴은 결과 칸 앞뒤 2칸').toHaveLength(5);
  expect(reelRegion[2]).toBe(oracle.once.birthReport!.region);
  expect(oddsRegion.length, '확률표에 지역 후보 전체(릴 5칸보다 많다)').toBeGreaterThan(5);
  for (const name of reelRegion) expect(oddsRegion, `릴의 칸 「${name}」은 확률표에도 있다`).toContain(name);
  await expect(page.locator('[data-testid="reel-wealth"] .reel__item')).toHaveCount(5); // 수저 릴도 결과 칸 앞뒤 2칸(5칸) — 후보 5단계 전체는 아래 확률표 5행
  await expect(page.locator('[data-testid="odds-wealth"] th[scope="row"]')).toHaveCount(5);
  const reelGrades = await page.locator('[data-testid="reel-wealth"] .reel__item .grade').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-grade'))));
  expect(reelGrades, '수저 릴은 5칸').toHaveLength(5);
  expect(reelGrades[2], '가운데 칸이 결과').toBe(oracle.once.character!.parentWealth);
  for (let k = 0; k < 4; k++) expect(Math.abs(reelGrades[k] - reelGrades[k + 1]), `결과 ±2칸이 이웃 단계: ${reelGrades.join('')}`).toBe(1);
  // 움직임 줄이기가 아닐 때는 안내가 없다 (다른 테스트가 회전 화면을 본다)
  await toBirthReport(page);
});

test('접근성 (RL6): 키보드만으로 건너뛰기·이동 — 제목에 포커스, Tab으로 「건너뛰기」, Enter, 다시 Tab으로 「출생신고 보기」, Enter, 출생신고 제목에 포커스', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, era: 'present' });
  await pressBegin(page);
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('roulette-heading'); // 화면이 뜨면 제목으로 포커스(R-030)
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('skip-roulette')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  // 결과 상태: 같은 자리의 버튼이 「출생신고 보기」로 바뀐다. 같은 버튼 요소라 키보드 포커스가 그대로 남고, 입력 가드는 다시 닫혔다 풀린다(Enter 연타가 곧바로 넘어가지 않는다)
  await expect(page.getByTestId('to-birth')).toBeFocused();
  await expect(page.getByTestId('to-birth')).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('birth-heading');
});

test('하단 띠: 「건너뛰기」·「출생신고 보기」가 화면 아래에 고정돼 스크롤해도 같은 자리에 있고 눌린다 (360x740 · 1280x800)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 1, autoMode: false, era: 'present' });
  await pressBegin(page);
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
    await injectSave(page, titleState(KNOWN_SEED));
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
  await injectSave(page, titleState(KNOWN_SEED));
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
