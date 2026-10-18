import { expect, test, type Page } from '@playwright/test';
import { ERA_CONFIG } from '../src/data/birthTable';
import { WEALTH_BAND_LABELS, expectedLooksLabel, expectedWealthLine } from '../tests/helpers/standingExpectations';
import { allowedGivenNames, loadRawNames } from './rawNames';
import {
  KNOWN_SEED,
  RAPID_METHODS,
  SAVE_VERSION,
  birthState,
  chooseEra,
  expectedBirth,
  injectSave,
  noHorizontalOverflow,
  pressBegin,
  pressBeginToBirth,
  rapidInput,
  readSave,
  replaceSaveAndReload,
  skipRoulette,
  titleState,
  toBirthReport,
} from './helpers';

/**
 * 출생신고 화면 (SPEC-003 BR1~BR7, VP3)과 룰렛 → 출생신고 → 인생 흐름의 안전한 이동.
 * 룰렛 화면 자체(연출·확률표·건너뛰기·복원)는 e2e/roulette.spec.ts가 본다. 기대값은 core 순수 함수(개발 서버의 실제 모듈)와 사람이 직접 적은 표(tests/helpers)로 대조한다.
 */

const ERA_NAMES = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' } as const;
const ERAS = ['past', 'present', 'future'] as const;
/** 화면에 나오는 교육방식 이름. src의 상수를 거치지 않고 독립적으로 적는다. */
const PARENTING_LABELS = { neglect: '방임', free: '자유', helicopter: '헬리콥터', strict: '엄격' } as const;
/** 부모 직업 이름(한국표준직업분류 대분류 9종). src의 상수를 거치지 않고 독립적으로 적는다. */
const JOB_LABELS = ['관리직', '전문직', '사무직', '서비스직', '판매직', '농림어업직', '기능직', '기계 조작직', '단순노무직'];
const ORDER_LABELS = ['첫째', '둘째', '셋째', '넷째', '다섯째 이상'];
const HOUSING_LABELS = ['자가', '임차(전세, 월세)', '무상 거주'];

/** 첫 화면의 선택(설정)과 함께 주입하는 재생 설정 */
const settingsFor = (era: (typeof ERAS)[number]) => ({ speed: 1, autoMode: false, era }) as const;

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 격자 한 칸의 화면 글자 */
async function field(page: Page, id: string): Promise<string> {
  return squash((await page.getByTestId(`birth-field-${id}`).locator('dd').innerText()).replace(/ · /g, ' '));
}

// 세상·인생 길이를 고르는 첫 화면 자체(기본 선택·새로고침 유지)는 e2e/first-screen.spec.ts가 본다.

for (const era of ERAS) {
  test(`${ERA_NAMES[era]}: 알려진 시드로 출생 — 룰렛 단계 저장 = core 기대값, 출생신고 화면·저장도 일치, 격자 11칸·서술문·외모 상위 %·집안 형편 구간·가로 넘침 확인`, async ({ page }) => {
    await injectSave(page, titleState(KNOWN_SEED));
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await chooseEra(page, era);

    const oracle = await expectedBirth(page, titleState(KNOWN_SEED), era);
    await pressBegin(page);
    await expect(page.getByTestId('roulette-screen')).toBeVisible();
    // 「태어나기」 시점에 출생 결과 전체가 저장된다(RL5): 룰렛 단계의 저장 전체가 core의 beginBirth를 한 번 적용한 결과와 같다 (rngState 전진·인생 길이·출생신고 상세·또래 시드 포함)
    expect((await readSave(page)).data).toEqual(oracle.once);
    expect(oracle.once.phase).toBe('roulette');

    await skipRoulette(page);
    await toBirthReport(page);
    const save = await readSave(page);
    expect(save.data).toEqual(oracle.born);
    expect(save.data.phase).toBe('birth');
    expect(save.data.era).toBe(era);
    expect(save.data.lifeLength).toBe('short30');
    const c = save.data.character!;
    const r = save.data.birthReport!;
    expect(c.birthYear).toBeGreaterThanOrEqual(ERA_CONFIG[era].birthYears.min);
    expect(c.birthYear).toBeLessThanOrEqual(ERA_CONFIG[era].birthYears.max);
    if (era === 'present') expect(c.birthYear, '지금 세상은 2026년생 고정(SPEC-003 Q1)').toBe(2026);
    expect(save.data.birthStats).toEqual(save.data.stats);
    expect(save.data.stats.health).toBeGreaterThan(0);

    // 헤더·큰 이름·서술문
    await expect(page.getByTestId('site-head')).toBeVisible();
    await expect(page.getByTestId('birth-heading')).toHaveText('출생 신고');
    await expect(page.getByTestId('birth-name')).toHaveText(c.name);
    const sentence = squash(await page.getByTestId('birth-sentence').innerText());
    expect(sentence).toMatch(/^\d{4}년 \d{1,2}월, .+의 .+ 가정에서 \d\.\dkg (남자아이|여자아이)로 태어났습니다\. (첫째|둘째|셋째|넷째|다섯째 이상)입니다\. \(\d\.\dkg은 [^()]+\)$/);
    expect(sentence).toContain(`${c.birthYear}년 ${r.month}월`);
    expect(sentence).toContain(`${r.birthWeightKg.toFixed(1)}kg ${c.gender === 'male' ? '남자아이' : '여자아이'}`);
    expect(sentence).not.toMatch(/수저|다이아|분위|[!！]/); // 서술문에는 등급명·소득 분위가 없다(인생 기록 첫 줄과 같은 문장, C4)

    // 격자 11칸: 값이 저장된 출생 결과 그대로다 (화면은 계산하지 않는다)
    await expect(page.locator('[data-testid^="birth-field-"]')).toHaveCount(11);
    expect(await field(page, 'gender')).toBe(c.gender === 'male' ? '남성' : '여성');
    expect(await field(page, 'month')).toBe(`${c.birthYear}년 ${r.month}월`);
    expect(await field(page, 'place')).toContain(r.sigungu);
    // 「A · B」 쌍은 줄 폭에 따라 한 줄 또는 두 줄이고 가운뎃점은 CSS가 그린다 → 글자만 비교한다
    expect(await field(page, 'mother')).toMatch(new RegExp(`^${r.mother.age}세 (${JOB_LABELS.join('|')})$`));
    expect(await field(page, 'father')).toMatch(new RegExp(`^${r.father.age}세 (${JOB_LABELS.join('|')})$`));
    expect(HOUSING_LABELS).toContain(await field(page, 'housing'));
    expect(await field(page, 'weight')).toMatch(new RegExp(`^${r.birthWeightKg.toFixed(1)}kg \\([^()]+\\)$`));
    expect(ORDER_LABELS).toContain(await field(page, 'order'));
    // 집안 형편: 「흙수저(하위 25% 안쪽)」 형식 = 수저 이름 + 시대별 가중치 표에서 손으로 계산한 구간 (R-170)
    expect((await field(page, 'wealth')).replace(/\s+/g, '')).toBe(expectedWealthLine(era, c.parentWealth).replace(/\s+/g, ''));
    // 외모: 점수가 아니라 「상위/하위 약 N%」 (R-135), 교육방식
    expect(await field(page, 'looks')).toContain(expectedLooksLabel(c.looks));
    expect(await field(page, 'parenting')).toContain(PARENTING_LABELS[c.parenting]);

    // 이름: 성(1글자) 뒤의 이름이 그 출생 연도·성별의 원자료 풀에 있다
    expect(allowedGivenNames(await loadRawNames(page), c.birthYear, c.gender), `${c.name} (${c.birthYear}년생 ${c.gender})`).toContain(c.name.slice(1));

    // 같은 해 태어난 사람들 4명(성별은 「여성/남성」으로 이름 옆, R-269), 하단 표기
    await expect(page.getByTestId('peer')).toHaveCount(4);
    for (const gender of await page.getByTestId('peer-gender').allInnerTexts()) expect(['여성', '남성']).toContain(gender.trim());
    // 비교 표(R-263): 지금 세상에서만 3행(출처·기준 연도 표기)과 기대수명 한 줄 서술, 지난·다가올 세상은 표 자체가 없다
    if (era === 'present') {
      await expect(page.getByTestId('compare-row')).toHaveCount(3);
      for (const row of await page.getByTestId('compare-row').all()) expect(await row.innerText()).toMatch(/\(\d{4}년\)/);
      expect((await page.getByTestId('life-gap').innerText()).replace(/\s+/g, ' ')).toContain('소득 상위 20%와 하위 20%의 기대수명 차이는 6.48세입니다(2017년). 집단의 평균 차이입니다.');
      await expect(page.locator('[data-row-id="income-persistence"]')).toHaveCount(0); // R-260
    } else {
      await expect(page.getByTestId('compare-card')).toHaveCount(0);
      await expect(page.getByTestId('compare-row')).toHaveCount(0);
      await expect(page.getByTestId('life-gap')).toHaveCount(0);
    }
    // 지역 표기(R-264): 지난 세상은 시·군·구가 지금(2025년) 행정구역 이름이라는 한 줄, 그 밖은 2026년 개편 설계값 한 줄
    const regionNote = (await page.getByTestId('report-footnote-region').innerText()).replace(/\s+/g, ' ');
    if (era === 'past') expect(regionNote).toBe('시·군·구 이름은 지금(2025년) 행정구역 이름이며 당시와 다를 수 있습니다.');
    else expect(regionNote).toContain('2026년에 바뀐 시·도와 시·군·구는 인구 비례로 옮긴 설계값');
    await expect(page.getByTestId('page-foot')).toBeVisible();
    if (era !== 'present') await expect(page.getByTestId('report-footnote-era')).toBeVisible();

    const text = await page.getByTestId('birth-screen').innerText();
    expect(text, '외모 원점수(N점)가 없다').not.toMatch(/외모\s*\d+\s*점/);
    expect(text).not.toMatch(/소득\s*\d\s*분위/);
    expect(text).not.toMatch(/!|[\u{1F300}-\u{1FAFF}]/u);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

/** 문구 안의 "N%" 숫자들 */
function percentsIn(text: string): number[] {
  return [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
}

for (const era of ERAS) {
  test(`${ERA_NAMES[era]}: 집안 형편 5단계가 「수저 이름(구간)」 표와 같고(점 5개 중 N개), 어디에도 50%를 넘는 「상위/하위 약 N%」가 없다 (R-018·R-170)`, async ({ page }) => {
    test.setTimeout(60_000);
    await injectSave(page, birthState(KNOWN_SEED, era, 1, 50));
    for (const tier of [1, 2, 3, 4, 5] as const) {
      await replaceSaveAndReload(page, birthState(KNOWN_SEED, era, tier, 50));
      const wealth = page.getByTestId('birth-field-wealth');
      await expect(wealth, `${era} ${tier}단계`).toBeVisible();
      expect(squash(await wealth.locator('dd').innerText()).replace(/\s+/g, ''), `${era} ${tier}단계`).toBe(expectedWealthLine(era, tier).replace(/\s+/g, ''));
      // 점 5개 중 tier개가 켜진다 + 칩에 이름(글자)·아이콘이 함께 있다
      await expect(wealth.locator('i.on')).toHaveCount(tier);
      await expect(wealth.locator('i')).toHaveCount(5);
      // 구간 문구의 숫자는 시대별 가중치 표에서 계산한 값이다(독립 표)
      expect(WEALTH_BAND_LABELS[era][tier]).not.toMatch(/약 (0|100)%/);
      const shown = await wealth.innerText();
      expect(shown).not.toMatch(/소득\s*\d\s*분위/);
    }
  });
}

test('외모 순위 표현: 0·10·23·49·50·51·90·100점이 전수 열거 기준값과 같고, 「N점」·50 초과 숫자(「상위 약 94%」 같은 표현)가 없다 (R-018·R-135)', async ({ page }) => {
  test.setTimeout(60_000);
  await injectSave(page, birthState(KNOWN_SEED, 'present', 3, 50));
  for (const looks of [0, 10, 23, 49, 50, 51, 90, 100]) {
    await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, looks));
    const shown = await field(page, 'looks');
    expect(shown, `${looks}점`).toContain(expectedLooksLabel(looks));
    for (const n of percentsIn(shown)) expect(n, `${looks}점: ${shown}`).toBeLessThanOrEqual(50);
    expect(shown).not.toMatch(/약 (0|100)%/);
    expect(await page.getByTestId('birth-screen').innerText(), `${looks}점`).not.toMatch(/외모\s*\d+\s*점|\b\d+점\b/);
  }
  // 중앙(50점)은 퍼센트 없이 전용 문구, 양 끝은 "N% 안쪽"
  await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, 50));
  expect(await field(page, 'looks')).toBe('또래 사이에서 가운데쯤');
  await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, 100));
  expect(await field(page, 'looks')).toBe('또래 사이에서 상위 1% 안쪽');
  await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, 0));
  expect(await field(page, 'looks')).toBe('또래 사이에서 하위 1% 안쪽');
});

test('출생신고 화면에서 새로고침해도 같은 출생신고 (다시 뽑히지 않는다, 연타 포함)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED));
  await pressBeginToBirth(page);
  const before = await page.getByTestId('birth-screen').innerText();
  const saveBefore = await readSave(page);
  for (let i = 0; i < 4; i++) await page.reload();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect(await page.getByTestId('birth-screen').innerText()).toBe(before);
  expect(await readSave(page)).toEqual(saveBefore);
  // 같은 해 태어난 사람들도 새로고침 전후가 같다 (저장된 또래 시드에서 만든다)
  const peers = await page.getByTestId('peers').innerText();
  await page.reload();
  await expect(page.getByTestId('peers')).toBeVisible();
  expect(await page.getByTestId('peers').innerText()).toBe(peers);
});

test('출생신고의 외부 요청 0: 첫 화면 → 룰렛 → 출생신고 → 인생까지 localhost 밖으로 나가는 요청이 없다 (CM3)', async ({ page, baseURL }) => {
  const outside: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return;
    if (!url.startsWith(origin)) outside.push(url);
  });
  await page.goto('/');
  await pressBeginToBirth(page);
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(outside, '외부로 나간 요청').toEqual([]);
});

// ---------- R-014: 화면 전환 직후 연타 ----------

/**
 * 첫 화면의 하단 「태어나기」, 룰렛의 「건너뛰기」·「출생신고 보기」, 출생신고의 「살아가기」는 모두 같은 하단 띠 자리에 놓인다. 화면이 바뀐 직후의 연타(더블클릭·빠른 연속 클릭·사람 간격 150ms)가
 * 새 화면의 같은 자리 버튼을 누르지 않는지(입력 가드가 막는지)를 낮은 화면과 가로 모드까지 훑는다. 대조군은 아래에 따로 있다.
 */
const SWEEP_VIEWPORTS = [
  { width: 360, height: 480 }, // 낮은 화면
  { width: 360, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 740 },
  { width: 360, height: 844 },
  { width: 667, height: 375 }, // 가로 모드 휴대폰
  { width: 740, height: 360 },
];

for (const [i, vp] of SWEEP_VIEWPORTS.entries()) {
  test(`R-014 ${vp.width}x${vp.height}: 「태어나기」를 연타해도 룰렛 연출이 건너뛰어지지 않고, 「건너뛰기」를 연타해도 출생신고로 넘어가지 않으며, 「출생신고 보기」를 연타해도 인생으로 넘어가지 않는다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 훑기는 mobile-360에서만 실행');
    test.setTimeout(90_000);
    await page.setViewportSize(vp);
    await injectSave(page, titleState(KNOWN_SEED));
    const era = ERAS[i % ERAS.length];

    for (const method of RAPID_METHODS) {
      await replaceSaveAndReload(page, titleState(KNOWN_SEED + i), settingsFor(era));
      // 1) 첫 화면 「태어나기」 연타 → 룰렛에 머문다. 둘째 입력이 같은 자리의 「건너뛰기」를 눌렀다면 곧바로 결과 상태가 된다
      const begin = page.getByTestId('start-birth');
      await expect(begin).toBeEnabled();
      await rapidInput(page, method, begin);
      await expect(page.getByTestId('roulette-screen'), `${method}`).toBeVisible();
      await expect(page.getByTestId('skip-roulette')).toBeEnabled(); // 가드가 풀린 뒤에도(= 지연된 입력이 없었음을 확인)
      await expect(page.getByTestId('roulette-screen'), `${method} 연타 뒤`).toHaveAttribute('data-state', 'spinning');
      expect((await readSave(page)).data.phase, `${method}`).toBe('roulette');
      // 2) 「건너뛰기」 연타 → 결과 상태에 머문다(둘째 입력이 같은 자리의 「출생신고 보기」를 누르지 않는다)
      await rapidInput(page, method, page.getByTestId('skip-roulette'));
      await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
      await expect(page.getByTestId('to-birth')).toBeEnabled();
      await expect(page.getByTestId('birth-screen'), `${method} 건너뛰기 뒤`).toHaveCount(0);
      // 3) 「출생신고 보기」 연타 → 출생신고에 머문다(둘째 입력이 같은 자리의 「살아가기」를 누르지 않는다)
      await rapidInput(page, method, page.getByTestId('to-birth'));
      await expect(page.getByTestId('birth-screen'), `${method}`).toBeVisible();
      await expect(page.getByTestId('next-life')).toBeEnabled();
      await expect(page.getByTestId('birth-screen'), `${method} 출생신고 보기 뒤`).toBeVisible();
      await expect(page.getByTestId('life-screen')).toHaveCount(0);
      expect((await readSave(page)).data.phase, `${method}`).toBe('birth');
    }
  });
}

test('R-014 프로젝트 기본 뷰포트에서도 세 번 연타해도 화면이 하나씩만 넘어간다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', settingsFor('future'));
  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await rapidInput(page, 'mouse3', begin);
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'spinning');
  await rapidInput(page, 'mouse3', page.getByTestId('skip-roulette'));
  await expect(page.getByTestId('to-birth')).toBeEnabled();
  await expect(page.getByTestId('birth-screen')).toHaveCount(0);
  await rapidInput(page, 'mouse3', page.getByTestId('to-birth'));
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect((await readSave(page)).data.phase).toBe('birth');
});

test('알려진 시드: 「태어나기」 더블클릭해도 core가 한 번 뽑은 결과와 저장·화면이 같다 — 룰렛에서 새로고침해도 (R-022 b)', async ({ page }) => {
  const before = titleState(KNOWN_SEED);
  await injectSave(page, before, '/', settingsFor('present'));
  const oracle = await expectedBirth(page, before, 'present');
  // 판별력: 이 시드는 두 번 뽑으면 다른 인물이 된다 → 아래 일치는 "정확히 1회 추첨"을 실제로 가른다
  expect(oracle.second).not.toEqual(oracle.once.character);

  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await begin.dblclick();
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  expect((await readSave(page)).data).toEqual(oracle.once);
  // 룰렛 도중 새로고침: 다시 굴리지 않고 결과가 확정된 모습으로 복원되며 저장은 그대로다 (RL5)
  await page.reload();
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  expect((await readSave(page)).data).toEqual(oracle.once);
  await toBirthReport(page);
  expect((await readSave(page)).data).toEqual(oracle.born);
  const name = oracle.once.character!.name;
  await expect(page.getByTestId('birth-name')).toHaveText(name);
  await page.reload();
  await expect(page.getByTestId('birth-name')).toHaveText(name);
});

/** 한 JS 작업 안에서 「버튼 → 새 화면의 같은 자리 버튼」을 연달아 누른다. 타이머가 끼어들 수 없어 시간에 의존하지 않는다. */
async function pressThenImmediately(page: Page, first: string, second: string) {
  return page.evaluate(
    async ([a, b]) => {
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      q(a)!.click();
      // React는 이벤트 직후(마이크로태스크)에 새 화면을 그린다.
      for (let n = 0; n < 50 && !q(b); n++) await Promise.resolve();
      const next = q(b);
      next?.click();
      for (let n = 0; n < 50; n++) await Promise.resolve();
      return { shown: next !== null, guarded: next?.getAttribute('aria-disabled') === 'true' };
    },
    [first, second] as const,
  );
}

test('R-014 결정적 검증: 화면이 바뀐 직후(같은 JS 작업 안)의 다음 버튼 입력은 무시되고, 가드가 풀리면 정상 동작한다 — 태어나기 → 건너뛰기 → 출생신고 보기 → 살아가기', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', settingsFor('past'));
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  // 태어나기 직후의 같은 작업 안 클릭은 룰렛의 「건너뛰기」(같은 자리)를 누르지 않는다
  let r = await pressThenImmediately(page, 'start-birth', 'skip-roulette');
  expect(r.shown).toBe(true);
  expect(r.guarded).toBe(true);
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'spinning');
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  // 건너뛰기 직후의 클릭은 「출생신고 보기」를 누르지 않는다
  r = await pressThenImmediately(page, 'skip-roulette', 'to-birth');
  expect(r.shown).toBe(true);
  expect(r.guarded).toBe(true);
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  await expect(page.getByTestId('birth-screen')).toHaveCount(0);
  await expect(page.getByTestId('to-birth')).toBeEnabled();
  // 출생신고 보기 직후의 클릭은 「살아가기」를 누르지 않는다
  r = await pressThenImmediately(page, 'to-birth', 'next-life');
  expect(r.shown).toBe(true);
  expect(r.guarded).toBe(true);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('life-screen')).toHaveCount(0);
  // 가드가 풀리면(버튼 활성) 정상적으로 누를 수 있다
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
});

test('R-014 결정적 검증 대조군: 가드를 끄면(?__guard=0) 같은 연속 입력이 룰렛의 연출과 출생신고를 건너뛴다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/?__guard=0', settingsFor('past'));
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  // 「태어나기」 직후의 클릭이 같은 자리의 「건너뛰기」를 눌러 연출이 곧바로 결과 상태가 된다
  let r = await pressThenImmediately(page, 'start-birth', 'skip-roulette');
  expect(r.shown).toBe(true);
  expect(r.guarded).toBe(false);
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  // 「출생신고 보기」 직후의 클릭이 같은 자리의 「살아가기」를 눌러 출생신고를 보지도 못하고 인생이 시작된다
  r = await pressThenImmediately(page, 'to-birth', 'next-life');
  expect(r.shown).toBe(true);
  expect(r.guarded).toBe(false);
  await expect(page.getByTestId('life-screen')).toBeVisible();
});

test('R-014 낮은 화면(360x480) 대조군: 가드를 끄면(?__guard=0) 「태어나기」 더블클릭이 룰렛의 「건너뛰기」까지 눌러 연출이 곧바로 결과가 된다 — 위 훑기가 가드를 실제로 가른다는 증거', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 실험은 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 480 });
  await injectSave(page, titleState(KNOWN_SEED), '/?__guard=0', settingsFor('present'));
  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await begin.dblclick();
  // 가드가 없으면 둘째 클릭이 같은 좌표의 「건너뛰기」에 떨어져 연출을 보지도 못하고 결과가 된다.
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
});

test('R-014 가드가 열리지 않는 동안(?__guard=600000)에는 강제 클릭도 연타도 무시된다 — 룰렛의 「출생신고 보기」·출생신고의 「살아가기」', async ({ page }) => {
  await page.goto('/');
  const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'present');
  await injectSave(page, oracle.born, '/?__guard=600000');
  const next = page.getByTestId('next-life');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await next.click({ force: true });
  await next.dblclick({ force: true });
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('life-screen')).toHaveCount(0);
  expect((await readSave(page)).data.phase).toBe('birth');
  // 룰렛(결과 상태로 복원)도 같다
  await injectSave(page, oracle.once, '/?__guard=600000');
  const toBirth = page.getByTestId('to-birth');
  await expect(toBirth).toHaveAttribute('aria-disabled', 'true');
  await toBirth.click({ force: true });
  await toBirth.dblclick({ force: true });
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect(page.getByTestId('birth-screen')).toHaveCount(0);
  expect((await readSave(page)).data.phase).toBe('roulette');
});

// 예전의 「타이틀 시작 더블클릭이 시대 카드를 고르지 않는다」(R-014)는 시대 선택 화면이 없어지면서 같은 경계를 여러 곳에서 지킨다:
//  - 첫 화면의 「태어나기」 더블클릭이 룰렛의 「건너뛰기」를 누르지 않는다 → 위의 R-014 훑기·결정적 검증
//  - 엔딩의 「다시 태어나기」 더블탭이 첫 화면의 「태어나기」·세상·인생 길이 카드를 누르지 않는다 → e2e/ending.spec.ts (겹침을 측정)

test('출생 → 살아가기 → 인생 화면, 새로고침해도 유지된다 (자리표시·"처음으로"는 없다, R-021)', async ({ page }) => {
  await page.goto('/');
  await pressBeginToBirth(page);
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 인생 기록 첫 줄 = 출생신고 서술문 (같은 문장, 합쇼체)
  const save = await readSave(page);
  expect(save.data.phase).toBe('life');
  expect(save.data.history[0].text).toMatch(/^\d{4}년 \d{1,2}월, .+의 .+ 가정에서 \d\.\dkg (남자아이|여자아이)로 태어났습니다\./);
  expect(save.data.history[0].text).not.toMatch(/수저|다이아|분위/);
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: '처음으로' })).toHaveCount(0);
});

test('손상된 저장(출생 단계인데 출생 연도가 시대 범위 밖·출생신고 상세가 비어 있음)은 새 게임으로 복구', async ({ page }) => {
  const stats = { wealth: 1, education: 1, health: 50, happiness: 1, relationships: 1 };
  const bad = {
    ...titleState(1),
    era: 'past' as const,
    lifeLength: 'short30' as const,
    phase: 'birth' as const,
    character: { name: '김민준', gender: 'male' as const, birthYear: 2010, parentWealth: 3 as const, parenting: 'free' as const, looks: 50 },
    stats,
    birthStats: stats,
  };
  await injectSave(page, bad);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  // 출생신고 상세가 없는 출생 단계 저장도 같다
  const noReport = { ...birthState(KNOWN_SEED, 'present', 3, 50), birthReport: null };
  await injectSave(page, noReport);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  // 체중이 0.1kg 격자 밖인 저장 (변조)
  const badWeight = birthState(KNOWN_SEED, 'present', 3, 50, { birthWeightKg: 3.25 });
  await injectSave(page, badWeight);
  await expect(page.getByTestId('title-screen')).toBeVisible();
});

test('R-213: M2 시기의 v5 저장(지금 세상 2008~2025년생)은 「손상」이 아니라 이전 버전 안내와 함께 새 게임으로 시작한다', async ({ page }) => {
  await page.addInitScript(
    ([gameKey]) => {
      if (localStorage.getItem(gameKey) === null) {
        const stats = { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 };
        const v5 = { phase: 'life', era: 'present', lifeLength: 'short30', character: { name: '김민준', gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50 }, stats, birthStats: stats, age: 0, history: [], flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null, seed: 5, rngState: 5 };
        localStorage.setItem(gameKey, JSON.stringify({ version: 5, data: v5 }));
      }
    },
    ['suzeo-game:save'] as const,
  );
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('old-save-notice')).toHaveText('이전 버전에서 저장된 판은 이어서 할 수 없어 새 게임으로 시작합니다.');
  await expect(page.getByTestId('resume')).toHaveCount(0);
  const save = await readSave(page);
  expect(save.version).toBe(SAVE_VERSION); // M4: 저장 스키마 6 → 7(일시정지 paused 추가)이라 새 게임의 저장 버전도 7이다. 버전 숫자는 e2e/saves.ts의 SAVE_VERSION(tests/e2eHelpers.test.ts가 core와 대조)
  expect(save.data.phase).toBe('title');
  expect(save.data.seed).not.toBe(5);
});
