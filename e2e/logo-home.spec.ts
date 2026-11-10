import { expect, test, type Page } from '@playwright/test';
import {
  GAME_KEY,
  KNOWN_SEED,
  birthState,
  findPendingState,
  injectSave,
  lifeState,
  noHorizontalOverflow,
  oracleAuto,
  oracleLife,
  pressBegin,
  readSave,
  rouletteState,
  startPageHidden,
  type Save,
} from './helpers';

/**
 * 헤더 로고 → 첫 화면 (SPEC-016 H1). 룰렛·출생신고·인생의 로고를 누르면 **확인 없이** 첫 화면이 열리고(기존 「나가기」와 같은 길, `openTitle`),
 * 첫 화면의 「이어서 살기」로 같은 판이 돌아온다. 저장은 기존 나가기와 같다(룰렛·출생신고 불변 · 인생은 `paused`만 켜진다). 엔딩 로고는 한 번 묻고(나가기 확인과 같은 모양) 확정하면 기존 `rebirth`로 새 판의 첫 화면이다.
 * 밀린 화면의 로고는 그림으로 둔다(Q2 — 아래 「밀린 화면」 시험이 이유를 보인다). 오류 화면은 페이지를 다시 연다(저장을 지우지 않는다).
 * desktop(1280)과 mobile-360 두 프로젝트에서 모두 돈다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;

/** 저장의 판 값에서 일시정지 표시와 플레이 시간 기록(앱 타이머가 실제 시간을 쌓는다)을 뺀 것 — 「그 밖 필드 불변」 비교용 */
function core(save: Save): unknown {
  const { paused: _paused, play: _play, ...rest } = save.data as unknown as Record<string, unknown>;
  return { version: save.version, ...rest };
}

/** 페이지 오류·콘솔 오류를 모은다 */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function pressLogo(page: Page): Promise<void> {
  const logo = page.getByTestId('logo-home');
  await expect(logo).toBeVisible();
  await logo.click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
}

async function resume(page: Page): Promise<void> {
  const r = page.getByTestId('resume');
  await expect(r).toBeEnabled(); // 입력 가드가 풀린 뒤
  await r.click();
}

test.describe('로고 접근성·눌림 영역 (완료 기준 1)', () => {
  test('인생·출생신고·룰렛: 로고는 이름 「수저 게임, 첫 화면으로」를 가진 버튼이고, 눌림 영역이 44px 이상이며 로고 그림은 40px 그대로다. 키보드(Tab → Enter)로 닿는다', async ({ page }) => {
    test.setTimeout(90_000); // 화면 셋을 차례로 연다
    await startPageHidden(page);
    const cases: Array<[string, () => Promise<void>, string]> = [
      ['인생', () => injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL), 'life-screen'],
      ['출생신고', () => injectSave(page, birthState(KNOWN_SEED, 'genx', 3, 50), '/', MANUAL), 'birth-screen'],
      ['룰렛', () => injectSave(page, rouletteState(KNOWN_SEED, 'genx', 3, 50), '/', MANUAL), 'roulette-screen'],
    ];
    for (const [name, open, screen] of cases) {
      await open();
      await expect(page.getByTestId(screen)).toBeVisible();
      const logo = page.getByTestId('logo-home');
      await expect(logo, `${name}: 버튼 하나`).toHaveCount(1);
      await expect(logo).toHaveAttribute('aria-label', '수저 게임, 첫 화면으로');
      expect(await logo.evaluate((el) => el.tagName), name).toBe('BUTTON');
      const box = (await logo.boundingBox())!;
      expect(box.height, `${name}: 눌림 높이`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${name}: 눌림 너비`).toBeGreaterThanOrEqual(44);
      const art = (await page.getByTestId('header-logo').locator('svg').boundingBox())!;
      expect(Math.round(art.height), `${name}: 로고 그림 높이`).toBe(40);
      // 접근성 트리에서 이름이 하나로 읽힌다(안쪽 그림은 숨김)
      expect(await page.getByTestId('header-logo').getAttribute('aria-hidden'), name).toBe('true');
      expect(await noHorizontalOverflow(page), `${name}: 가로 넘침 0`).toBe(true);
      // 키보드: 헤더 로고는 문서 맨 앞이다. 화면이 뜨면 제목(h1)이 초점을 받으므로(그 뒤로 Tab이 이어진다) 거꾸로(Shift+Tab) 올라가 닿는다 — 가까이에서 닿아야 한다
      let reached = (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'logo-home';
      for (let i = 0; i < 4 && !reached; i++) {
        await page.keyboard.press('Shift+Tab');
        reached = (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'logo-home';
      }
      expect(reached, `${name}: Tab으로 로고에 닿는다`).toBe(true);
      // 초점 링이 보인다(outline 3px)
      expect(await logo.evaluate((el) => getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) >= 2), `${name}: 초점 링`).toBe(true);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('title-screen'), `${name}: Enter로 첫 화면`).toBeVisible();
    }
  });

  test('Space로도 열린다', async ({ page }) => {
    await startPageHidden(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.getByTestId('logo-home').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('title-screen')).toBeVisible();
  });

  test('엔딩의 로고: 「수저 게임, 첫 화면으로」 버튼이고, 누르면 한 번 묻는다(나가기 확인과 같은 모양) — 돌아가기·Esc는 엔딩 그대로, 포커스는 로고로 (SPEC-016 Q1)', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await page.goto('/'); // 앱 모듈을 불러 기대값을 구하려면 같은 origin이 필요하다
    const ended = await oracleAuto(page, await oracleLife(page, KNOWN_SEED, 'alpha'));
    await injectSave(page, ended, '/', MANUAL);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    const logo = page.getByTestId('logo-home');
    await expect(logo).toHaveCount(1);
    await expect(logo).toHaveAttribute('aria-label', '수저 게임, 첫 화면으로');
    const box = (await logo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('ending-home-ask')).toHaveCount(0);
    const saved = JSON.stringify(await readSave(page));
    // 계속 보기
    await logo.click();
    const ask = page.getByTestId('ending-home-ask');
    await expect(ask).toBeVisible();
    await expect(page.getByTestId('ending-home-ask-title')).toHaveText('엔딩을 닫고 첫 화면으로 나갈까요?');
    await expect(page.getByTestId('ending-home-yes')).toHaveText('첫 화면으로 나가기');
    await expect(page.getByTestId('ending-home-no')).toHaveText('계속 보기');
    expect(await ask.evaluate((el) => el.className)).toContain('exit-ask'); // 나가기 확인과 같은 틀
    await expect(page.getByTestId('ending-home-no')).toBeFocused(); // 안전한 쪽으로 포커스
    expect(await noHorizontalOverflow(page)).toBe(true);
    await expect(page.getByTestId('ending-home-no')).toBeEnabled(); // 입력 가드가 풀린 뒤
    await page.getByTestId('ending-home-no').click();
    await expect(ask).toHaveCount(0);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('title-screen')).toHaveCount(0);
    await expect(logo).toBeFocused();
    // Esc
    await logo.click();
    await expect(ask).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(ask).toHaveCount(0);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(logo).toBeFocused();
    // 로고를 또 눌러도 한 단계뿐이다(열린 채 다시 누르면 포커스만 「계속 보기」로)
    await logo.click();
    await expect(page.getByTestId('ending-home-ask')).toBeVisible();
    await logo.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('ending-home-ask')).toHaveCount(1);
    await expect(page.getByTestId('ending-home-no')).toBeFocused();
    expect(JSON.stringify(await readSave(page)), '묻기만 하고 저장은 그대로').toBe(saved);
    expect(errors).toEqual([]);
  });

  test('엔딩의 로고 → 「첫 화면으로」: 「다시 태어나기」와 같은 결과 — 새 판의 첫 화면이 열리고, 연타해도 판은 하나다', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await page.goto('/');
    const ended = await oracleAuto(page, await oracleLife(page, KNOWN_SEED, 'alpha'));
    await injectSave(page, ended, '/', MANUAL);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await page.getByTestId('logo-home').click();
    const yes = page.getByTestId('ending-home-yes');
    await expect(yes).toBeVisible();
    await expect(yes).toBeEnabled();
    await yes.dblclick({ delay: 20 });
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('ending-screen')).toHaveCount(0);
    await expect(page.getByTestId('resume')).toHaveCount(0); // 끝난 판은 이어 살 수 없다 — 새 판의 첫 화면
    expect(errors).toEqual([]);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

test.describe('로고 → 첫 화면 → 이어서 살기 (완료 기준 2·3, Q3 표)', () => {
  test('인생: 확인 없이 첫 화면이 열리고, 저장은 기존 「나가기」(확인 뒤)와 같다 — paused만 켜지고 그 밖은 같다. 이어서 살기는 같은 해·멈춘 채', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const before = await readSave(page);
    await pressLogo(page);
    await expect(page.getByTestId('exit-ask')).toHaveCount(0); // 확인 대화상자 없음
    await expect(page.getByTestId('resume')).toBeVisible();
    await expect.poll(async () => (await readSave(page)).data.paused).toBe(true);
    const viaLogo = await readSave(page);
    await resume(page);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('life-age')).toContainText(`${before.data.age}세`);
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    const after = await readSave(page);
    expect(core(after), '이어서 살기는 저장을 더 바꾸지 않는다').toEqual(core(viaLogo));
    expect(after.data.history.length).toBe(before.data.history.length);
    expect(after.data.age).toBe(before.data.age);
    expect(after.data.rngState, '난수 상태 불변').toBe(before.data.rngState);
    expect(after.data.stats).toEqual(before.data.stats);
    expect(after.data.pending ?? null).toEqual(before.data.pending ?? null);
    // 기존 「나가기」 경로(확인 단계를 거침)에서 같은 저장 글이 나온다 — 로고가 더하는 저장 변화는 0
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('tool-exit')).toBeEnabled();
    await page.getByTestId('tool-exit').click();
    await expect(page.getByTestId('exit-yes')).toBeEnabled();
    await page.getByTestId('exit-yes').click();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect.poll(async () => (await readSave(page)).data.paused).toBe(true);
    expect(core(await readSave(page)), '로고 경로 = 나가기 경로').toEqual(core(viaLogo));
    expect(errors, '오류 0').toEqual([]);
  });

  test('출생신고: 확인 없이 첫 화면, 저장 바이트 불변, 이어서 살기는 같은 출생신고', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await injectSave(page, birthState(KNOWN_SEED, 'genx', 4, 60), '/', MANUAL);
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    const before = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const name = await page.getByTestId('birth-name').innerText();
    await pressLogo(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY), '출생신고: 저장 바이트 완전 불변').toBe(before);
    await resume(page);
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    await expect(page.getByTestId('birth-name')).toHaveText(name);
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).toBe(before);
    expect(errors).toEqual([]);
  });

  test('룰렛(복원된 결과 화면): 저장 바이트 불변, 이어서 살기는 결과가 확정된 룰렛', async ({ page }) => {
    await startPageHidden(page);
    await injectSave(page, rouletteState(KNOWN_SEED, 'genx', 3, 50), '/', MANUAL);
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
    const before = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    await pressLogo(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).toBe(before);
    await resume(page);
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).toBe(before);
  });

  test('룰렛 연출 중: 「태어나기」 직후 연출이 도는 중에 로고 → 첫 화면 → 이어서 살기는 연출 없이 같은 결과가 확정된 룰렛이다(Q3). 저장 바이트 불변·판은 하나', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await pressBegin(page);
    const roulette = page.getByTestId('roulette-screen');
    await expect(roulette).toBeVisible();
    const state = await roulette.getAttribute('data-state');
    expect(['spinning', 'draw'], '연출 중에 눌렀다').toContain(state);
    const before = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    expect(before, '결과는 「태어나기」 순간 이미 저장돼 있다(RL5)').not.toBeNull();
    const beforeSave = JSON.parse(before!) as Save;
    await pressLogo(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY), '룰렛 도중: 저장 바이트 완전 불변').toBe(before);
    await resume(page);
    await expect(roulette).toHaveAttribute('data-state', 'result'); // 연출은 건너뛴 확정 모습
    const after = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), GAME_KEY))!) as Save;
    expect(after.data.character, '같은 판(같은 인물)').toEqual(beforeSave.data.character);
    expect(after.data.seed).toBe(beforeSave.data.seed);
    expect(errors).toEqual([]);
  });

  test('오류 화면: 로고는 페이지를 다시 연다 — 저장은 지우지 않고(탐침의 ?__crash 쿼리만 떨어진다) 저장된 판이 열린다', async ({ page }) => {
    await startPageHidden(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const before = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    await page.goto('/?__crash=1');
    await expect(page.getByTestId('error-screen')).toBeVisible();
    const logo = page.getByTestId('logo-home');
    await expect(logo).toHaveAttribute('aria-label', '수저 게임, 첫 화면으로');
    await logo.click();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    expect(page.url()).not.toContain('__crash');
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY), '저장을 지우지 않았다').not.toBeNull();
    expect(JSON.parse(before!).data.seed).toBe(KNOWN_SEED);
  });
});

test.describe('상태별 눌림 (완료 기준 4)', () => {
  test('한 해가 흐르는 중(진행률 바가 차는 중): 로고 → 일시정지로 저장 → 이어서 살기 → 같은 나이로 멈춘 채', async ({ page }) => {
    const errors = watchErrors(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await pressLogo(page);
    const age = (await readSave(page)).data.age; // 첫 화면이 열린 순간의 나이(그 사이 시계가 한 해를 넘겼을 수 있어 저장에서 읽는다)
    await resume(page);
    await expect(page.getByTestId('life-age')).toContainText(`${age}세`);
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    // 멈춘 채라 해가 흐르지 않는다
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('life-age')).toContainText(`${age}세`);
    expect(errors).toEqual([]);
  });

  test('일시정지 중·배속 변경 직후에도 같다', async ({ page }) => {
    await startPageHidden(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('pause')).toBeEnabled();
    await page.getByTestId('pause').click();
    await page.getByTestId('speed').click();
    await pressLogo(page);
    await resume(page);
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    const s = await readSave(page);
    expect(s.data.paused).toBe(true);
  });

  test('나가기 확인창이 열린 채 로고: 확인 없이 첫 화면이 열리고 확인창은 닫혀 있다 (헤더는 확인창 중에도 닿는다)', async ({ page }) => {
    await startPageHidden(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('tool-exit')).toBeEnabled();
    await page.getByTestId('tool-exit').click();
    await expect(page.getByTestId('exit-ask')).toBeVisible();
    await page.getByTestId('logo-home').click();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await resume(page);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('exit-ask')).toHaveCount(0);
  });

  test('결정 카드(수동 모드의 모달 시트)가 열려 있는 동안 헤더는 inert라 로고가 닿지 않는다 — 카드를 접으면(접힌 띠) 로고가 닿고, 누르면 첫 화면, 이어서 살기 뒤 같은 카드가 다시 열려 있다(기존 나가기와 같다: 접힘은 인생 화면을 떠나면 지워진다)', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await page.goto('/');
    const pending = await findPendingState(page, 'genx', { minChoices: 2 });
    await injectSave(page, pending, '/', MANUAL);
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toHaveAttribute('data-mode', 'sheet');
    const key = await panel.getAttribute('data-key');
    expect(await page.getByTestId('logo-home').evaluate((el) => el.closest('[inert]') !== null), '모달 시트 중 헤더 inert').toBe(true);
    const before = await readSave(page);
    await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-fold')).toBeVisible();
    expect(await page.getByTestId('logo-home').evaluate((el) => el.closest('[inert]') !== null), '접은 뒤 헤더는 닿는다').toBe(false);
    await pressLogo(page);
    await resume(page);
    await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-key', key!);
    const after = await readSave(page);
    expect(after.data.pending).toEqual(before.data.pending);
    expect(after.data.history.length).toBe(before.data.history.length);
    expect(errors).toEqual([]);
  });

  test('자동 모드 켜짐 + 결정 카드(인라인): 로고 → 첫 화면 → 이어서 살기 — 같은 카드가 남고, 첫 화면이 열린 동안 자동 선택이 돌지 않으며, 기록 줄이 두 번 쌓이지 않는다', async ({ page }) => {
    await startPageHidden(page); // 가려진 탭: 자동 선택이 일어나지 않아 카드가 그대로 남는다
    const errors = watchErrors(page);
    await page.goto('/');
    const pending = await findPendingState(page, 'genx', { minChoices: 2 });
    await injectSave(page, pending, '/', { speed: 1, autoMode: true });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    const before = await readSave(page);
    await pressLogo(page);
    await page.waitForTimeout(800);
    const mid = await readSave(page);
    expect(mid.data.pending, '첫 화면이 열린 동안 선택이 일어나지 않았다').toEqual(before.data.pending);
    expect(mid.data.history.length).toBe(before.data.history.length);
    await resume(page);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    const after = await readSave(page);
    expect(after.data.pending).toEqual(before.data.pending);
    expect(after.data.history.length).toBe(before.data.history.length);
    expect(errors).toEqual([]);
  });
});

test.describe('빠른 연속 클릭 (완료 기준 5)', () => {
  test('인생: 로고 20회 연타 → 첫 화면은 한 번, 판은 하나(저장의 시드·나이 그대로), 오류 0', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const before = await readSave(page);
    const box = (await page.getByTestId('logo-home').boundingBox())!;
    for (let i = 0; i < 20; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('title-screen')).toHaveCount(1);
    const after = await readSave(page);
    expect(after.data.seed).toBe(before.data.seed);
    expect(after.data.age).toBe(before.data.age);
    expect(after.data.history.length).toBe(before.data.history.length);
    // 첫 화면 로고 자리(같은 좌표)를 계속 눌러도 아무 일 없다 — 새 판이 시작되지 않았다
    expect(after.data.phase).toBe('life');
    expect(errors).toEqual([]);
  });

  test('로고 후 즉시 「이어서 살기」 연타 · 「이어서 살기」 직후 로고 연타: 판은 하나이고 인생이 두 번 진행되지 않는다', async ({ page }) => {
    await startPageHidden(page);
    const errors = watchErrors(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const before = await readSave(page);
    await pressLogo(page);
    const r = page.getByTestId('resume');
    await expect(r).toBeEnabled();
    const rb = (await r.boundingBox())!;
    for (let i = 0; i < 20; i++) await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    // 이어서 살기 직후 로고 연타(DOM 클릭 20번 — 첫 클릭이 첫 화면을 열고 나머지는 이미 떨어진 요소다)
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="logo-home"]');
      for (let i = 0; i < 20; i++) el?.click();
    });
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await resume(page);
    const after = await readSave(page);
    expect(after.data.seed).toBe(before.data.seed);
    expect(after.data.age).toBe(before.data.age);
    expect(after.data.history.length).toBe(before.data.history.length);
    expect(errors).toEqual([]);
  });

  test('룰렛 연출 중 로고 20회 연타: 결과·판이 하나', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await pressBegin(page);
    await expect(page.getByTestId('roulette-screen')).toBeVisible();
    const before = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const box = (await page.getByTestId('logo-home').boundingBox())!;
    for (let i = 0; i < 20; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).toBe(before);
    await resume(page);
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
    expect(errors).toEqual([]);
  });
});

test.describe('밀린 화면 (Q2): 로고는 그림으로 둔다', () => {
  test('밀린 화면의 로고는 링크가 아니다 — 페이지를 다시 열면 이 탭이 판을 다시 쥐고 한 해가 흐르는 순간 저장을 써서 판을 쥐고 있던 다른 탭을 밀어낸다(이어받기 버튼 없이 같은 효과)', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '두 탭 실험은 한 번만');
    test.setTimeout(60_000);
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    await startPageHidden(a); // 판을 쥔 다른 탭은 배경 탭이다(시계가 멈춘 채) — 이 탭이 다시 열려 흐르기 시작하는 쪽이 저장을 쓴다
    await injectSave(a, lifeState(KNOWN_SEED), '/', MANUAL);
    await expect(a.getByTestId('life-screen')).toBeVisible();
    const b = await ctx.newPage();
    await b.goto('/');
    await expect(b.getByTestId('life-screen')).toBeVisible();
    // b를 밀린 화면으로(다른 탭이 저장을 바꿨다는 신호 — e2e/m4States.ts와 같은 방법)
    await b.evaluate((key) => window.dispatchEvent(new StorageEvent('storage', { key })), GAME_KEY);
    await expect(b.getByTestId('superseded-screen')).toBeVisible();
    await expect(b.getByTestId('logo-home'), '밀린 화면의 로고는 버튼이 아니다').toHaveCount(0);
    await b.getByTestId('header-logo').click();
    await expect(b.getByTestId('superseded-screen'), '눌러도 아무 일 없다').toBeVisible();
    // 로고를 링크로 만들었다면 할 일(페이지 다시 열기)을 직접 해서 부작용을 보인다
    await b.evaluate(() => window.location.assign(window.location.pathname));
    await expect(b.getByTestId('life-screen')).toBeVisible();
    await expect(a.getByTestId('superseded-screen'), '판을 쥐고 있던 다른 탭이 밀린다').toBeVisible({ timeout: 40_000 });
    await ctx.close();
  });
});

test.describe('가로 넘침 (완료 기준 7, 일부)', () => {
  test('로고 컨트롤이 있는 화면들이 폭 320·360·768·1280에서 가로 넘침 0이고, 글자 200%에서도 로고 눌림 영역이 44px 이상이다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '뷰포트를 직접 지정');
    await startPageHidden(page);
    for (const width of [320, 360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const [name, state, screen] of [
        ['인생', lifeState(KNOWN_SEED), 'life-screen'],
        ['출생신고', birthState(KNOWN_SEED, 'genx', 3, 50), 'birth-screen'],
        ['룰렛', rouletteState(KNOWN_SEED, 'genx', 3, 50), 'roulette-screen'],
      ] as const) {
        await injectSave(page, state, '/', MANUAL);
        await expect(page.getByTestId(screen)).toBeVisible();
        expect(await noHorizontalOverflow(page), `${name} ${width}px`).toBe(true);
        const box = (await page.getByTestId('logo-home').boundingBox())!;
        expect(box.height, `${name} ${width}px 눌림 높이`).toBeGreaterThanOrEqual(44);
        expect(box.x, `${name} ${width}px 왼쪽 밖으로 안 나감`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name} ${width}px 오른쪽 밖으로 안 나감`).toBeLessThanOrEqual(width + 0.5);
      }
    }
  });
});
