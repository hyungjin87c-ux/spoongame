import { expect, test, type Page } from '@playwright/test';
import { ERA_CONFIG } from '../src/data/birthTable';
import { WEALTH_LABELS, expectedLooksSentence, expectedWealthSentence } from '../tests/helpers/standingExpectations';
import { allowedGivenNames, loadRawNames } from './rawNames';
import {
  KNOWN_SEED,
  birthState,
  RAPID_METHODS,
  chooseEra,
  expectedBirth,
  injectSave,
  noHorizontalOverflow,
  pressBegin,
  rapidInput,
  readSave,
  replaceSaveAndReload,
  titleState,
} from './helpers';

const ERA_NAMES = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' } as const;
const ERAS = ['past', 'present', 'future'] as const;
/** 화면에 나오는 교육방식 이름. src의 상수를 거치지 않고 독립적으로 적는다. */
const PARENTING_LABELS = { neglect: '방임', free: '자유', helicopter: '헬리콥터', strict: '엄격' } as const;

/** 첫 화면의 선택(설정)과 함께 주입하는 재생 설정 */
const settingsFor = (era: (typeof ERAS)[number]) => ({ speed: 1, autoMode: false, era }) as const;

// 세상·인생 길이를 고르는 첫 화면 자체(기본 선택·새로고침 유지)는 e2e/first-screen.spec.ts가 본다 (시대 선택 화면은 없어졌다).

for (const era of ERAS) {
  test(`${ERA_NAMES[era]}: 알려진 시드로 출생 — 화면·저장이 core 기대값과 일치, 외모 상위 %·등급명 노출·가로 넘침 확인`, async ({ page }) => {
    await injectSave(page, titleState(KNOWN_SEED));
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await chooseEra(page, era);

    const oracle = await expectedBirth(page, titleState(KNOWN_SEED), era);
    await pressBegin(page);
    await expect(page.getByTestId('birth-screen')).toBeVisible();

    // 저장 전체가 core의 beginBirth를 한 번 적용한 결과와 같다 (rngState 전진·인생 길이 포함)
    const save = await readSave(page);
    expect(save.data).toEqual(oracle.once);
    const c = save.data.character!;
    expect(save.data.phase).toBe('birth');
    expect(save.data.era).toBe(era);
    expect(save.data.lifeLength).toBe('short30');
    expect(c.birthYear).toBeGreaterThanOrEqual(ERA_CONFIG[era].birthYears.min);
    expect(c.birthYear).toBeLessThanOrEqual(ERA_CONFIG[era].birthYears.max);
    expect(save.data.birthStats).toEqual(save.data.stats);
    expect(save.data.stats.health).toBeGreaterThan(0);

    await expect(page.getByTestId('birth-name')).toHaveText(c.name);
    await expect(page.getByTestId('birth-year')).toContainText(`${c.birthYear}년`);

    // 이름: 성(1글자) 뒤의 이름이 그 출생 연도·성별의 원자료 풀(구현의 풀 함수를 거치지 않고 JSON 파일을 직접 읽음)에 있다
    expect(allowedGivenNames(await loadRawNames(page), c.birthYear, c.gender), `${c.name} (${c.birthYear}년생 ${c.gender})`).toContain(c.name.slice(1));

    // 재력 순위 문장: 시대 × 재력 단계 표(tests/helpers/standingExpectations.ts, 사람이 직접 적은 값)와 같다 (R-018)
    await expect(page.getByTestId('birth-standing')).toHaveText(expectedWealthSentence(era, c.parentWealth));

    // 교육방식 이름과 외모 점수·순위 표현(101^3 전수 열거 기준값)
    await expect(page.getByTestId('birth-parenting')).toContainText(`교육방식: ${PARENTING_LABELS[c.parenting]}.`);
    await expect(page.getByTestId('birth-looks')).toContainText(expectedLooksSentence(c.looks));

    const text = (await page.getByTestId('birth-screen').innerText()) ?? '';
    expect(text).not.toMatch(/[흙동은금]수저|다이아/);
    expect(text).not.toMatch(/!|[\u{1F300}-\u{1FAFF}]/u);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

/** 문구 안의 "N%" 숫자들 */
function percentsIn(text: string): number[] {
  return [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
}

for (const era of ERAS) {
  test(`${ERA_NAMES[era]}: 재력 5단계의 순위 표현이 표와 같고, 어디에도 50%를 넘는 숫자가 없다 (R-018)`, async ({ page }) => {
    test.setTimeout(60_000);
    await injectSave(page, birthState(KNOWN_SEED, era, 1, 50));
    for (const tier of [1, 2, 3, 4, 5] as const) {
      await replaceSaveAndReload(page, birthState(KNOWN_SEED, era, tier, 50));
      const standing = page.getByTestId('birth-standing');
      await expect(standing, `${era} ${tier}단계`).toHaveText(expectedWealthSentence(era, tier));
      const shown = (await standing.innerText()) ?? '';
      for (const n of percentsIn(shown)) expect(n, `${era} ${tier}단계: ${shown}`).toBeLessThanOrEqual(50);
      expect(shown).not.toMatch(/약 (0|100)%/);
      // 중앙에 걸친 단계(전 시대 2단계)는 퍼센트를 말하지 않는다
      if (WEALTH_LABELS[era][tier] === '딱 중간쯤') expect(shown).not.toMatch(/\d/);
    }
  });
}

test('외모 순위 표현: 0·10·23·49·50·51·90·100점이 전수 열거 기준값과 같고 "상위 약 94%" 같은 50 초과 숫자가 없다 (R-018)', async ({ page }) => {
  test.setTimeout(60_000);
  await injectSave(page, birthState(KNOWN_SEED, 'present', 3, 50));
  for (const looks of [0, 10, 23, 49, 50, 51, 90, 100]) {
    await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, looks));
    const el = page.getByTestId('birth-looks');
    await expect(el, `${looks}점`).toContainText(expectedLooksSentence(looks));
    const shown = (await el.innerText()) ?? '';
    for (const n of percentsIn(shown)) expect(n, `${looks}점: ${shown}`).toBeLessThanOrEqual(50);
    expect(shown).not.toMatch(/약 (0|100)%/);
  }
  // 중앙(50점)은 퍼센트 없이 전용 문구, 양 끝은 "N% 안쪽"
  await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, 50));
  await expect(page.getByTestId('birth-looks')).toContainText('외모 50점 (딱 중간쯤).');
  await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, 100));
  await expect(page.getByTestId('birth-looks')).toContainText('외모 100점 (상위 1% 안쪽).');
  await replaceSaveAndReload(page, birthState(KNOWN_SEED, 'present', 3, 0));
  await expect(page.getByTestId('birth-looks')).toContainText('외모 0점 (하위 1% 안쪽).');
});

test('출생 화면에서 새로고침해도 같은 인물 (다시 뽑히지 않는다)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED));
  await pressBegin(page);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const before = await page.getByTestId('birth-screen').innerText();
  const saveBefore = await readSave(page);
  for (let i = 0; i < 4; i++) await page.reload();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect(await page.getByTestId('birth-screen').innerText()).toBe(before);
  expect(await readSave(page)).toEqual(saveBefore);
});

test('알려진 시드: 「태어나기」 더블클릭해도 core가 한 번 뽑은 결과와 저장·화면이 같다 (R-022 b)', async ({ page }) => {
  const before = titleState(KNOWN_SEED);
  await injectSave(page, before, '/', settingsFor('present'));
  const oracle = await expectedBirth(page, before, 'present');
  // 판별력: 이 시드는 두 번 뽑으면 다른 인물이 된다 → 아래 일치는 "정확히 1회 추첨"을 실제로 가른다
  expect(oracle.second).not.toEqual(oracle.once.character);

  const confirm = page.getByTestId('start-birth');
  await expect(confirm).toBeEnabled();
  await confirm.dblclick();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  // 가드가 끝나 버튼이 활성화될 때까지(고정 대기 없이) 기다린 뒤에도 출생 화면에 머문다
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await expect(page.getByTestId('birth-screen')).toBeVisible();

  expect((await readSave(page)).data).toEqual(oracle.once);
  const name = oracle.once.character!.name;
  await expect(page.getByTestId('birth-name')).toHaveText(name);
  await page.reload();
  await expect(page.getByTestId('birth-name')).toHaveText(name);
});

// ---------- R-014: 화면 전환 직후 연타 ----------

/**
 * 실측 결과(가드 없음, 첫 화면 개편 이후의 흐름 = 첫 화면 하단 고정 「태어나기」 → 출생 화면): 하단 고정 「태어나기」의 중심이 출생 화면의 「살아가기」 안에 드는
 * 낮은 화면(360x480)에서만 더블클릭이 출생 화면을 건너뛴다(아래 대조군). 다른 뷰포트(가로 모드 휴대폰 667x375·740x360 포함)는 두 버튼이 겹치지 않아 가드가 없어도 건너뛰지 않았다.
 * 그래도 아래 훑기는 높이가 낮아 화면이 스크롤되는 경우와 그렇지 않은 경우를 모두 돌며, 어느 뷰포트에서든 연타 뒤에 출생 화면에 머무는지(가드가 입력을 막는지)를 같은 방식으로 본다.
 * (옛 시대 선택 화면 시절의 「높이 520 이하·가로 모드 모두 60/60 건너뜀」 실측은 그 화면과 함께 사라졌다.)
 */
const SWEEP_VIEWPORTS = [
  { width: 360, height: 480 }, // 낮은 화면: 가드가 없으면 재현되는 구간
  { width: 360, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 667 },
  { width: 360, height: 740 },
  { width: 360, height: 800 },
  { width: 360, height: 844 },
  { width: 360, height: 915 },
  { width: 667, height: 375 }, // 가로 모드 휴대폰: 겹치지 않는다(측정) — 낮은 가로 화면의 스크롤 배치에서도 머무는지 훑는다
  { width: 740, height: 360 },
];

for (const [i, vp] of SWEEP_VIEWPORTS.entries()) {
  test(`R-014 ${vp.width}x${vp.height}: 연타(더블클릭·빠른 연속 클릭 2~3회·사람 간격 150ms)해도 출생 결과 화면에 머문다`, async ({ page }, testInfo) => {
    // 뷰포트를 직접 지정하므로 프로젝트마다 반복할 필요가 없다(데스크톱 기본 뷰포트는 아래 별도 테스트).
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 훑기는 mobile-360에서만 실행');
    test.setTimeout(60_000);
    await page.setViewportSize(vp);
    await injectSave(page, titleState(KNOWN_SEED));
    const era = ERAS[i % ERAS.length];

    for (const method of RAPID_METHODS) {
      await replaceSaveAndReload(page, titleState(KNOWN_SEED + i), settingsFor(era));
      const confirm = page.getByTestId('start-birth');
      await expect(confirm).toBeEnabled(); // 가드가 풀릴 때까지 고정 대기 없이 기다린다
      await rapidInput(page, method, confirm);
      await expect(page.getByTestId('birth-screen'), `${method}`).toBeVisible();
      // 출생 화면의 가드가 끝난 뒤에도(= 지연된 입력이 없었음을 확인) 여전히 출생 화면이고 저장도 birth
      await expect(page.getByTestId('next-life')).toBeEnabled();
      await expect(page.getByTestId('birth-screen'), `${method}`).toBeVisible();
      await expect(page.getByTestId('life-screen')).toHaveCount(0);
      expect((await readSave(page)).data.phase, `${method}`).toBe('birth');
    }
  });
}

test('R-014 프로젝트 기본 뷰포트에서도 연타해도 출생 결과 화면에 머문다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', settingsFor('future'));
  const confirm = page.getByTestId('start-birth');
  await expect(confirm).toBeEnabled();
  await rapidInput(page, 'mouse3', confirm);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect((await readSave(page)).data.phase).toBe('birth');
});

// 첫 화면의 「태어나기」는 화면 아래에 고정돼 있어, 출생 화면의 「살아가기」와 같은 자리에 놓이는 뷰포트가 예전(시대 선택의 확정 버튼, 667x375 등)과 달라졌다.
// 측정(360폭, 높이 480~844와 가로 모드)으로 겹치는 곳을 찾았다: 360x480에서 「태어나기」 중심(180,446)이 「살아가기」(406~450) 안에 든다. 위 훑기(R-014)는 두 버튼이 겹치지 않는 뷰포트도 함께 돈다.
test('R-014 대조군: 가드를 끄면(?__guard=0) 낮은 화면(360x480)에서 더블클릭이 출생 화면을 건너뛴다 — 위 테스트가 가드를 실제로 가른다는 증거', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 실험은 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 480 });
  await injectSave(page, titleState(KNOWN_SEED), '/?__guard=0', settingsFor('present'));
  const confirm = page.getByTestId('start-birth');
  await expect(confirm).toBeEnabled();
  await confirm.dblclick();
  // 가드가 없으면 둘째 클릭이 같은 좌표의 "살아가기"에 떨어져 출생 결과를 보지도 못하고 넘어간다.
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect((await readSave(page)).data.phase).toBe('life');
});

/** 한 JS 작업 안에서 "확정 → 새 화면의 다음 버튼"을 연달아 누른다. 타이머가 끼어들 수 없어 시간에 의존하지 않는다. */
async function confirmThenImmediatelyNext(page: Page) {
  return page.evaluate(async () => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    q('start-birth')!.click();
    // React는 이벤트 직후(마이크로태스크)에 새 화면을 그린다.
    for (let n = 0; n < 50 && !q('next-life'); n++) await Promise.resolve();
    const next = q('next-life');
    next?.click();
    for (let n = 0; n < 50; n++) await Promise.resolve();
    return { birthShown: next !== null, lifeShown: q('life-screen') !== null, nextGuarded: next?.getAttribute('aria-disabled') === 'true' };
  });
}

test('R-014 결정적 검증: 화면이 바뀐 직후(같은 JS 작업 안)의 진행 버튼 입력은 무시되고, 가드가 풀리면 정상 동작한다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', settingsFor('past'));
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  const r = await confirmThenImmediatelyNext(page);
  expect(r.birthShown).toBe(true);
  expect(r.nextGuarded).toBe(true); // 새 화면의 버튼은 비활성(aria-disabled) 상태로 떴다
  expect(r.lifeShown).toBe(false); // 그리고 곧바로 온 클릭은 무시됐다
  await expect(page.getByTestId('birth-screen')).toBeVisible();

  // 가드가 풀리면(버튼 활성) 정상적으로 누를 수 있다
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
});

test('R-014 결정적 검증 대조군: 가드를 끄면(?__guard=0) 같은 연속 입력이 출생 화면을 건너뛴다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/?__guard=0', settingsFor('past'));
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  const r = await confirmThenImmediatelyNext(page);
  expect(r.birthShown).toBe(true);
  expect(r.nextGuarded).toBe(false);
  expect(r.lifeShown).toBe(true); // 가드가 없으면 이 시나리오는 실제로 화면을 건너뛴다
});

test('R-014 가드가 열리지 않는 동안(?__guard=600000)에는 강제 클릭도 연타도 무시된다', async ({ page }) => {
  const born = await (async () => {
    await page.goto('/');
    return (await expectedBirth(page, titleState(KNOWN_SEED), 'present')).once;
  })();
  await injectSave(page, born, '/?__guard=600000');
  const next = page.getByTestId('next-life');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await next.click({ force: true });
  await next.dblclick({ force: true });
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('life-screen')).toHaveCount(0);
  expect((await readSave(page)).data.phase).toBe('birth');
});

// 예전의 「타이틀 시작 더블클릭이 시대 카드를 고르지 않는다」(R-014)는 시대 선택 화면이 없어지면서 같은 경계를 두 곳에서 지킨다:
//  - 첫 화면의 「태어나기」 더블클릭이 출생 화면의 「살아가기」를 누르지 않는다 → 위의 R-014 훑기·결정적 검증
//  - 엔딩의 「다시 태어나기」 더블탭이 첫 화면의 「태어나기」·세상·인생 길이 카드를 누르지 않는다 → e2e/ending.spec.ts (겹침을 측정)

test('출생 → 살아가기 → 인생 화면, 새로고침해도 유지된다 (자리표시·"처음으로"는 없다, R-021)', async ({ page }) => {
  await page.goto('/');
  await pressBegin(page);
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: '처음으로' })).toHaveCount(0);
});

test('손상된 저장(출생 단계인데 연도가 시대 범위 밖)은 새 게임으로 복구', async ({ page }) => {
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
});
