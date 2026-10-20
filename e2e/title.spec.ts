import { expect, test } from '@playwright/test';
import { GAME_KEY, SAVE_VERSION, chooseEra, injectSave, lifeState, noHorizontalOverflow, pressBegin, readSave, readSettings, toBirthReport } from './helpers';
import { loadRawNames } from './rawNames';

test('첫 화면과 탭 제목이 "수저 게임", 「태어나기」 버튼이 있다 (이전의 「시작」 버튼은 없다)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('수저 게임');
  await expect(page.getByRole('heading', { name: '수저 게임' })).toBeVisible();
  await expect(page.getByRole('button', { name: '태어나기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '시작', exact: true })).toHaveCount(0);
});

test('가로 스크롤 없이 화면에 맞는다 (타이틀)', async ({ page }) => {
  await page.goto('/');
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('태어나기를 누른 뒤 새로고침하면 출생 화면이 그대로 복원된다 (저장된 화면 복원, C3)', async ({ page }) => {
  await page.goto('/');
  await pressBegin(page);
  // 룰렛: 새로고침하면 다시 돌지 않고 결과가 확정된 모습으로 복원된다(RL5)
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  await expect(page.getByTestId('title-screen')).toHaveCount(0);
  await toBirthReport(page);
  const before = await page.getByTestId('birth-name').innerText();
  await page.reload();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('birth-name')).toHaveText(before);
  await expect(page.getByTestId('title-screen')).toHaveCount(0);
});

test('새로고침 연타(로드 도중 중단 포함) 후에도 저장이 복원된다 (R-004)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀린 뒤(선택이 바뀌는 때)
  await chooseEra(page, 'future');
  await expect.poll(async () => (await readSettings(page)).era).toBe('future'); // 설정 저장이 끝난 뒤
  // 로드가 끝나기를 기다리지 않고 다시 새로고침한다 — 이전 로드/저장이 중간에 끊긴다.
  for (const gap of [0, 0, 5, 10, 20, 40, 0, 80]) {
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(gap);
  }
  await page.reload();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('era-future')).toBeChecked();
  expect((await readSettings(page)).era).toBe('future');
  expect((await readSave(page)).data.phase).toBe('title');
});

test('손상된 localStorage 값이 있어도 앱이 뜬다', async ({ page }) => {
  await page.addInitScript(([key, version]) => {
    localStorage.setItem(key, `{"version":${version},"data":{`);
    localStorage.setItem('suzeo-game:settings', 'not json');
  }, [GAME_KEY, SAVE_VERSION] as const);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '수저 게임' })).toBeVisible();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('형태가 틀린 저장 데이터도 새 게임으로 시작', async ({ page }) => {
  await page.addInitScript(([key, version]) => {
    localStorage.setItem(key, JSON.stringify({ version, data: { phase: 'life' } }));
  }, [GAME_KEY, SAVE_VERSION] as const);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
});

test('필드 간 정합성이 깨진 저장(life인데 character 없음)은 크래시 없이 새 게임 (R-001)', async ({ page }) => {
  await page.addInitScript(([key, version]) => {
    const data = {
      phase: 'life',
      era: 'present',
      character: null,
      stats: { wealth: 1, education: 1, health: 1, happiness: 1, relationships: 1 },
      birthStats: null,
      age: 0,
      history: [],
      seed: 1,
      rngState: 1,
    };
    localStorage.setItem(key, JSON.stringify({ version, data }));
  }, [GAME_KEY, SAVE_VERSION] as const);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('렌더 중 예외가 나면 "저장 지우고 새로 시작"이 유효한 저장을 실제로 지우고 타이틀로 돌아간다 (R-001, R-022 a)', async ({ page }) => {
  // 유효한 "인생 진행 중" 저장을 심는다. 무효 저장이면 앱의 검증기가 알아서 버려서 clearGame을 검증할 수 없다.
  const SEED = 424242;
  await injectSave(page, lifeState(SEED));
  await expect(page.getByTestId('life-screen')).toBeVisible(); // 저장이 실제로 유효함을 확인
  expect((await readSave(page)).data.seed).toBe(SEED);

  // 개발 서버 전용 탐침(?__crash=1)으로 렌더 예외를 강제한다.
  await page.goto('/?__crash=1');
  await expect(page.getByTestId('error-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 탈출구를 누르기 전까지 유효한 저장은 그대로 남아 있다
  const stillThere = await readSave(page);
  expect(stillThere.data.phase).toBe('life');
  expect(stillThere.data.seed).toBe(SEED);

  await page.getByRole('button', { name: '저장 지우고 새로 시작' }).click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(page.url()).not.toContain('__crash');

  // 새로 열린 앱의 저장은 이전 판이 아니라 새 게임(타이틀·캐릭터 없음·다른 시드)이다 → 이전 저장이 실제로 지워졌다
  // (앱은 첫 렌더 뒤 효과로 저장하므로 잠깐 기다릴 수 있다)
  await expect.poll(async () => (await readSave(page)).data.phase).toBe('title');
  const after = (await readSave(page)).data;
  expect(after.character).toBeNull();
  expect(after.birthStats).toBeNull();
  expect(after.seed).not.toBe(SEED);
  // 새로고침해도 타이틀(이전 인생이 되살아나지 않는다)
  await page.reload();
  await expect(page.getByTestId('title-screen')).toBeVisible();
});

// ---------- 이름 통계 출처 표기 (법원 자료 이용 조건) ----------

test('타이틀 하단에 법원 통계 출처가 표기되고 원자료의 권장 표기와 같은 출처를 가리킨다', async ({ page }) => {
  await page.goto('/');
  const { scourt } = await loadRawNames(page);
  const credit = page.getByTestId('names-credit');
  await expect(credit).toBeVisible();
  const text = (await credit.innerText()) ?? '';
  // 원자료가 제안한 표기(meta.suggestedAttribution)의 핵심 요소가 모두 들어 있다
  for (const part of ['대한민국 법원 전자가족관계등록시스템', '통계서비스', '상위 출생신고 이름 현황', '등록일 기준 잠정치', '2026-10-13']) {
    expect(scourt.meta.suggestedAttribution, `원자료 표기에 "${part}"`).toContain(part);
    expect(text, `화면 표기에 "${part}"`).toContain(part);
  }
  // 출처 링크는 원자료가 기록한 주소다
  const link = credit.getByRole('link');
  await expect(link).toHaveAttribute('href', scourt.meta.url);
  await expect(link).toHaveAttribute('rel', /noopener/);
  // 첫 화면의 본문(세상·인생 길이 선택과 캐러셀) 아래, 푸터에 있고 작게 표시된다
  const carouselBox = (await page.getByTestId('carousel').boundingBox())!;
  const eraBox = (await page.getByTestId('life-length-group').boundingBox())!;
  const creditBox = (await credit.boundingBox())!;
  expect(creditBox.y).toBeGreaterThan(eraBox.y + eraBox.height);
  // 좁은 화면(한 칸)은 캐러셀 다음에 푸터가 온다. 넓은 화면(폭 ≥ 960)에서는 캐러셀이 오른쪽 열이라 푸터(왼쪽 열)와 세로로 겹쳐도 된다 — SPEC-005에서 오른쪽 열 맨 위에 일러스트가 들어와 카드가 왼쪽 열 끝보다 아래까지 이어진다(열 안쪽 스크롤)
  if ((page.viewportSize()?.width ?? 0) < 960) expect(creditBox.y).toBeGreaterThan(carouselBox.y + carouselBox.height);
  else expect(creditBox.x, '푸터는 왼쪽 열, 캐러셀은 오른쪽 열').toBeLessThan(carouselBox.x);
  const fontSize = await credit.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeLessThan(14);
});

for (const width of [360, 320]) {
  test(`타이틀 출처 표기가 ${width}px 폭에서 넘치거나 잘리지 않는다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    const credit = page.getByTestId('names-credit');
    await expect(credit).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    const fits = await credit.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const a = el.querySelector('a')!.getBoundingClientRect();
      return { left: r.left, right: r.right, linkRight: a.right, scrollW: el.scrollWidth, clientW: el.clientWidth, vw: document.documentElement.clientWidth };
    });
    expect(fits.left).toBeGreaterThanOrEqual(0);
    expect(fits.right).toBeLessThanOrEqual(fits.vw);
    expect(fits.linkRight).toBeLessThanOrEqual(fits.vw);
    expect(fits.scrollW).toBeLessThanOrEqual(fits.clientW);
  });
}

test('구 저장(스키마 v2, 지금 세상 1995년생)은 새 게임으로 시작한다 — 지금 세상 출생 연도가 2008~2025로 바뀌었다 (R-012)', async ({ page }) => {
  const stats = { wealth: 45, education: 45, health: 70, happiness: 52, relationships: 54 };
  await page.addInitScript(
    ([key, stats]) => {
      const data = {
        phase: 'life',
        era: 'present',
        character: { name: '김민준', gender: 'male', birthYear: 1995, parentWealth: 3, parenting: 'free', looks: 50 },
        stats,
        birthStats: stats,
        age: 0,
        history: [],
        seed: 7,
        rngState: 8,
      };
      localStorage.setItem(key, JSON.stringify({ version: 2, data }));
    },
    [GAME_KEY, stats] as const,
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});
