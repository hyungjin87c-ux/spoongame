import { expect, test, type Page } from '@playwright/test';
import { ERA_CONFIG } from '../src/data/birthTable';
import { WEALTH_LABELS, expectedLooksSentence, expectedWealthSentence } from '../tests/helpers/standingExpectations';
import { allowedGivenNames, loadRawNames } from './rawNames';
import {
  KNOWN_SEED,
  birthState,
  RAPID_METHODS,
  eraSelectState,
  expectedBirth,
  injectSave,
  noHorizontalOverflow,
  rapidInput,
  readSave,
  replaceSaveAndReload,
} from './helpers';

const ERA_NAMES = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' } as const;
const ERAS = ['past', 'present', 'future'] as const;
/** 화면에 나오는 교육방식 이름. src의 상수를 거치지 않고 독립적으로 적는다. */
const PARENTING_LABELS = { neglect: '방임', free: '자유', helicopter: '헬리콥터', strict: '엄격' } as const;

async function toEraScreen(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.getByTestId('era-screen')).toBeVisible();
}

test('시대 선택 화면: 기본 선택은 "지금 세상", 세 시대가 모두 보인다', async ({ page }) => {
  await toEraScreen(page);
  for (const name of Object.values(ERA_NAMES)) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /지금 세상/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /지난 세상/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /다가올 세상/ })).toHaveAttribute('aria-pressed', 'false');
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('시대 선택은 새로고침해도 유지된다', async ({ page }) => {
  await toEraScreen(page);
  await page.getByRole('button', { name: /지난 세상/ }).click();
  await expect(page.getByRole('button', { name: /지난 세상/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /지난 세상/ })).toHaveAttribute('aria-pressed', 'true');
});

for (const era of ERAS) {
  test(`${ERA_NAMES[era]}: 알려진 시드로 출생 — 화면·저장이 core 기대값과 일치, 외모 상위 %·등급명 노출·가로 넘침 확인`, async ({ page }) => {
    await injectSave(page, eraSelectState(KNOWN_SEED));
    await expect(page.getByTestId('era-screen')).toBeVisible();
    const card = page.getByRole('button', { name: new RegExp(ERA_NAMES[era]) });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');

    const oracle = await expectedBirth(page, eraSelectState(KNOWN_SEED, era));
    await page.getByTestId('confirm-era').click();
    await expect(page.getByTestId('birth-screen')).toBeVisible();

    // 저장 전체가 core의 beginBirth를 한 번 적용한 결과와 같다 (rngState 전진 포함)
    const save = await readSave(page);
    expect(save.data).toEqual(oracle.once);
    const c = save.data.character!;
    expect(save.data.phase).toBe('birth');
    expect(save.data.era).toBe(era);
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
  await injectSave(page, eraSelectState(KNOWN_SEED));
  await page.getByTestId('confirm-era').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const before = await page.getByTestId('birth-screen').innerText();
  const saveBefore = await readSave(page);
  for (let i = 0; i < 4; i++) await page.reload();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect(await page.getByTestId('birth-screen').innerText()).toBe(before);
  expect(await readSave(page)).toEqual(saveBefore);
});

test('알려진 시드: "이 세상에서 태어나기" 더블클릭해도 core가 한 번 뽑은 결과와 저장·화면이 같다 (R-022 b)', async ({ page }) => {
  const before = eraSelectState(KNOWN_SEED, 'present');
  await injectSave(page, before);
  const oracle = await expectedBirth(page, before);
  // 판별력: 이 시드는 두 번 뽑으면 다른 인물이 된다 → 아래 일치는 "정확히 1회 추첨"을 실제로 가른다
  expect(oracle.second).not.toEqual(oracle.once.character);

  const confirm = page.getByTestId('confirm-era');
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
 * 실측 결과(가드 없음): 높이 568 이상에서는 연타가 출생 화면을 건너뛰지 않았지만,
 * 높이가 낮아 화면이 스크롤되는 경우(360폭 높이 520 이하, 가로 모드 휴대폰 667x375·740x360 등)에서는
 * 4가지 입력 방식 모두 60/60으로 건너뛰었다. 아래 뷰포트 훑기는 그 둘을 모두 포함한다.
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
  { width: 667, height: 375 }, // 가로 모드 휴대폰: 가드가 없으면 재현
  { width: 740, height: 360 },
];

for (const [i, vp] of SWEEP_VIEWPORTS.entries()) {
  test(`R-014 ${vp.width}x${vp.height}: 연타(더블클릭·빠른 연속 클릭 2~3회·사람 간격 150ms)해도 출생 결과 화면에 머문다`, async ({ page }, testInfo) => {
    // 뷰포트를 직접 지정하므로 프로젝트마다 반복할 필요가 없다(데스크톱 기본 뷰포트는 아래 별도 테스트).
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 훑기는 mobile-360에서만 실행');
    test.setTimeout(60_000);
    await page.setViewportSize(vp);
    await injectSave(page, eraSelectState(KNOWN_SEED));
    const era = ERAS[i % ERAS.length];

    for (const method of RAPID_METHODS) {
      await replaceSaveAndReload(page, eraSelectState(KNOWN_SEED + i, era));
      const confirm = page.getByTestId('confirm-era');
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
  await injectSave(page, eraSelectState(KNOWN_SEED, 'future'));
  const confirm = page.getByTestId('confirm-era');
  await expect(confirm).toBeEnabled();
  await rapidInput(page, 'mouse3', confirm);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect((await readSave(page)).data.phase).toBe('birth');
});

test('R-014 대조군: 가드를 끄면(?__guard=0) 낮은 화면(667x375)에서 더블클릭이 출생 화면을 건너뛴다 — 위 테스트가 가드를 실제로 가른다는 증거', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 실험은 mobile-360에서만 실행');
  await page.setViewportSize({ width: 667, height: 375 });
  await injectSave(page, eraSelectState(KNOWN_SEED, 'present'), '/?__guard=0');
  const confirm = page.getByTestId('confirm-era');
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
    q('confirm-era')!.click();
    // React는 이벤트 직후(마이크로태스크)에 새 화면을 그린다.
    for (let n = 0; n < 50 && !q('next-life'); n++) await Promise.resolve();
    const next = q('next-life');
    next?.click();
    for (let n = 0; n < 50; n++) await Promise.resolve();
    return { birthShown: next !== null, lifeShown: q('life-screen') !== null, nextGuarded: next?.getAttribute('aria-disabled') === 'true' };
  });
}

test('R-014 결정적 검증: 화면이 바뀐 직후(같은 JS 작업 안)의 진행 버튼 입력은 무시되고, 가드가 풀리면 정상 동작한다', async ({ page }) => {
  await injectSave(page, eraSelectState(KNOWN_SEED, 'past'));
  await expect(page.getByTestId('confirm-era')).toBeEnabled();
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
  await injectSave(page, eraSelectState(KNOWN_SEED, 'past'), '/?__guard=0');
  await expect(page.getByTestId('confirm-era')).toBeEnabled();
  const r = await confirmThenImmediatelyNext(page);
  expect(r.birthShown).toBe(true);
  expect(r.nextGuarded).toBe(false);
  expect(r.lifeShown).toBe(true); // 가드가 없으면 이 시나리오는 실제로 화면을 건너뛴다
});

test('R-014 가드가 열리지 않는 동안(?__guard=600000)에는 강제 클릭도 연타도 무시된다', async ({ page }) => {
  const born = await (async () => {
    await page.goto('/');
    return (await expectedBirth(page, eraSelectState(KNOWN_SEED, 'present'))).once;
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

test('R-014 타이틀 "시작" 더블클릭이 시대 카드 선택을 바꾸지 않는다 (낮은 화면 360x360 포함)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 실험은 mobile-360에서만 실행');
  for (const vp of [
    { width: 360, height: 360 },
    { width: 360, height: 740 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(vp);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const start = page.getByRole('button', { name: '시작' });
    await expect(start).toBeEnabled();
    await start.dblclick();
    await expect(page.getByTestId('era-screen')).toBeVisible();
    // 시대 선택 화면의 버튼이 활성화될 때까지 기다린 뒤에도 카드는 고르지 않은 상태(era=null)
    await expect(page.getByTestId('confirm-era')).toBeEnabled();
    const d = (await readSave(page)).data;
    expect(d.phase, `${vp.width}x${vp.height}`).toBe('eraSelect');
    expect(d.era, `${vp.width}x${vp.height}`).toBeNull();
    await expect(page.getByRole('button', { name: /지금 세상/ })).toHaveAttribute('aria-pressed', 'true'); // 화면 기본값 그대로
  }
});

test('R-014 대조군: 가드를 끄면(?__guard=0) 360x360에서 "시작" 더블클릭이 시대 카드를 골라 버린다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하는 실험은 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 360 });
  await page.goto('/?__guard=0');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '시작' }).dblclick();
  await expect(page.getByTestId('era-screen')).toBeVisible();
  await expect.poll(async () => (await readSave(page)).data.era).not.toBeNull();
});

test('출생 → 살아가기 → 인생 화면, 새로고침해도 유지된다 (자리표시·"처음으로"는 없다, R-021)', async ({ page }) => {
  await toEraScreen(page);
  await page.getByTestId('confirm-era').click();
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
    ...eraSelectState(1, 'past'),
    phase: 'birth' as const,
    character: { name: '김민준', gender: 'male' as const, birthYear: 2010, parentWealth: 3 as const, parenting: 'free' as const, looks: 50 },
    stats,
    birthStats: stats,
  };
  await injectSave(page, bad);
  await expect(page.getByTestId('title-screen')).toBeVisible();
});
