import { expect, test, type Page } from '@playwright/test';
import type { GameState, GenerationId, HistoryEntry } from '../src/core/types';
import { isCreditsDecision } from '../src/credits/allowlist';
import { GAME_KEY, injectSave, noHorizontalOverflow, oracleAuto, oracleLife, readSave, settle } from './helpers';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 「이 삶의 이름들」 (SPEC-022 EC1 · 완료 기준 12~17·19~22): 회고에서 버튼으로 열고 닫는 한 장의 문서. 줄 모델의 규칙은 tests/credits.model.test.ts가, 정적 마크업은 tests/credits.screen.test.tsx가 본다 —
 * 여기서는 실제 브라우저에서 ① 열기·닫기 네 길(단추·Escape·뒤로가기·헤더 로고)과 초점·스크롤 복원·history 한 걸음 ② 저장 불변 ③ 받는 중·실패·다시 시도·연타 ④ 자동 흐름의 멈춤·이어 보기·목록으로 보기 ·
 * 움직임 줄이기·글자 확대 ⑤ 320·360·1280 넘침 ⑥ 가림(닫힌 원문이 DOM에 없다)을 본다. 개발 서버 전용 탐침 `?__creditsThrow`로 오류 경계도 본다.
 * desktop(1280)·mobile-360 두 프로젝트에서 돈다. 자동 흐름은 판의 길이·이동거리에 따라 정해지므로 시험은 「자동으로 열린 판」을 찾아 쓴다(`findAutoState`).
 */

const SETTINGS = { speed: 8, autoMode: true } as const;
const OPEN = 'ending-credits-open';

const ended = new Map<string, GameState>();
async function endedOf(page: Page, seed: number, era: GenerationId): Promise<GameState> {
  const key = `${seed}-${era}`;
  const hit = ended.get(key);
  if (hit !== undefined) return hit;
  await page.goto('/');
  const s = await oracleAuto(page, await oracleLife(page, seed, era));
  expect(s.phase).toBe('ending');
  ended.set(key, s);
  return s;
}

/** 엔딩 화면을 연다(저장을 심고 연다) */
async function openEnding(page: Page, state: GameState, settings: Record<string, unknown> = {}): Promise<void> {
  await injectSave(page, state, '/', { ...SETTINGS, ...settings });
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId(OPEN)).toBeEnabled(); // 입력 가드가 풀린 뒤
}

async function openCredits(page: Page): Promise<void> {
  await page.getByTestId(OPEN).click();
  await expect(page.getByTestId('credits-screen')).toBeVisible();
  await expect(page.getByTestId('credits-name')).toBeFocused();
  await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-flow', /auto|list/);
}

const flowOf = (page: Page): Promise<string | null> => page.getByTestId('credits-bar').getAttribute('data-flow');

/** 자동 흐름으로 열리는 판을 찾는다 — 후보를 차례로 열어 보고 `data-flow="auto"`가 되는 첫 판을 돌려준다(없으면 null) */
async function findAutoState(page: Page, settings: Record<string, unknown> = {}): Promise<GameState | null> {
  for (const [seed, era] of [[7, 'millennial'], [3, 'genx'], [11, 'millennial'], [5, 'industrial'], [21, 'genx'], [2, 'millennial'], [9, 'industrial'], [31, 'millennial']] as const) {
    const s = await endedOf(page, seed, era);
    await openEnding(page, s, settings);
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    if ((await flowOf(page)) === 'auto') return s;
  }
  return null;
}

/** 보이는 크레딧 본문에서 EC1 7항 규칙으로 센 N (조작 단추·머리 띠 화면 이름 제외, 줄바꿈 제외, 명단은 화면에 가운뎃점이 없으므로 석 자를 더한다) */
async function visibleN(page: Page): Promise<number> {
  return page.evaluate(() => {
    const sel = '.credits-kicker, .credits-name, .credits-years, .credits-born, .credits-gentle, .credits-chapter > h2, .credits-role, .credits-person-name, .credits-meta, .credits-veil-lead, .credits-q, .credits-pick, .credits-result, .credits-end-name, .credits-end-line';
    let n = 0;
    for (const el of document.querySelectorAll('[data-testid="credits-screen"] ' + sel)) n += [...(el.textContent ?? '').trim()].length;
    for (const li of document.querySelectorAll('.credits-person')) if (li.querySelector('.credits-person-name') !== null) n += 3;
    return n;
  });
}

test.describe.configure({ mode: 'parallel' });

test.describe('열기 (완료 기준 12)', () => {
  test('진입부(제목 · 설명 · 버튼)가 사망·선택 카드 아래 · 최종 스탯 위에 있고, 누르기 전·새로고침·이어하기에도 크레딧이 시작하지 않는다. 열면 초점이 첫 제목(이름)이다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    const tops = await page.evaluate(() => ['ending-death', 'ending-names-title', 'ending-credits-open', 'ending-stats'].map((id) => (document.querySelector(`[data-testid="${id}"], #${id}`) as HTMLElement).getBoundingClientRect().top));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    await expect(page.locator('.ending__names p.t-muted')).toHaveText('이름과 시간을 다시 펼칩니다.');
    await expect(page.locator('.ending__names h2')).toHaveText('이 삶의 이름들');
    await expect(page.getByTestId(OPEN)).toHaveText(/이 삶의 이름들 보기/);
    await expect(page.getByRole('button', { name: '이 삶의 이름들 보기' })).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await openCredits(page);
    await expect(page.locator('main.ending')).toBeHidden(); // 회고 본문은 접근성 트리에서도 빠진다
    await expect(page.locator('.site-head__name')).toHaveText('이름과 시간');
    await expect(page.locator('h1:visible')).toHaveCount(1);
  });
});

test.describe('닫는 길 넷 = 회고로 (완료 기준 13)', () => {
  type Way = 'button' | 'escape' | 'back' | 'logo' | 'end-button';
  const ways: Way[] = ['button', 'escape', 'back', 'logo', 'end-button'];
  for (const way of ways) {
    test(`${way}: 회고로 돌아오고(사이트를 떠나지 않음) 호출 버튼에 초점이 가며 스크롤 위치가 열기 전과 같고 history는 한 걸음이다 — 새 판이 시작되지 않는다`, async ({ page }) => {
      const s = await endedOf(page, 7, 'millennial');
      await openEnding(page, s);
      await page.evaluate(() => window.scrollTo(0, 260));
      await settle(page);
      const before = await page.evaluate(() => ({ y: Math.round(window.scrollY), len: history.length, url: location.href }));
      expect(before.y).toBeGreaterThan(100);
      await page.getByTestId(OPEN).click({ position: { x: 8, y: 8 } }).catch(() => undefined);
      if (!(await page.getByTestId('credits-screen').isVisible())) {
        await page.getByTestId(OPEN).focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.getByTestId('credits-screen')).toBeVisible();
      const during = await page.evaluate(() => history.length);
      expect(during).toBe(before.len + 1); // 열릴 때 history 항목 하나
      if (way === 'button') await page.getByTestId('credits-close').click();
      else if (way === 'end-button') await page.getByTestId('credits-end-close').click();
      else if (way === 'escape') await page.keyboard.press('Escape');
      else if (way === 'back') await page.goBack();
      else await page.getByTestId('logo-home').click();
      await expect(page.getByTestId('credits-screen')).toHaveCount(0);
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      await expect(page.getByTestId('ending-home-ask')).toHaveCount(0); // 크레딧 중 로고·Escape는 확인 단계를 열지 않는다
      await expect(page.getByTestId(OPEN)).toBeFocused();
      await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(before.y);
      const after = await page.evaluate(() => ({ len: history.length, url: location.href }));
      await page.waitForTimeout(700); // history.back의 popstate 뒤 정착
      const settled = await page.evaluate(() => ({ url: location.href, idx: (history.state ?? {}) as Record<string, unknown> }));
      expect(settled.url).toBe(before.url);
      expect(after.url).toBe(before.url);
      expect(Object.keys(settled.idx).some((k) => k === 'suzeoInfoPanel')).toBe(false);
      const save = await readSave(page);
      expect(save.data.phase).toBe('ending'); // 새 판이 시작되지 않았다
    });
  }

  test('닫기 연타(Escape 세 번 · 단추 두 번)에도 빈 history 항목이 남지 않고 한 걸음만 돌아간다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    const len = await page.evaluate(() => history.length);
    await openCredits(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => location.pathname)).toBe('/'); // 사이트 안
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await openCredits(page);
    await page.getByTestId('credits-close').dblclick();
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await page.waitForTimeout(700);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(len + 1);
    // 뒤로가기를 한 번 더 눌러도 크레딧이 되살아나지 않는다(빈 항목이 아니다)
    await page.goBack();
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
  });

  test('「처음부터 보기」는 같은 문장을 처음부터 다시 열고 history 항목을 더하지 않으며, 끝에 도착해도 자동으로 닫히거나 초점이 움직이지 않는다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    await openCredits(page);
    const before = await page.evaluate(() => history.length);
    const linesBefore = await page.getByTestId('credits-screen').innerText();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.getByTestId('credits-end-restart').click();
    await expect(page.getByTestId('credits-name')).toBeFocused();
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    expect(await page.evaluate(() => history.length)).toBe(before);
    expect(await page.getByTestId('credits-screen').innerText()).toBe(linesBefore);
    // 끝까지 내려가도 닫히지 않는다
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    const active = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? document.activeElement?.tagName);
    expect(active).toBe('credits-name');
  });
});

test.describe('저장·소리·외부 요청 불변 (완료 기준 22)', () => {
  test('저장 바이트가 열기 전·닫은 뒤·새로고침한 뒤 같고, 여닫고 조작하는 동안 localStorage.setItem 호출이 0이며, 음원·그림·글꼴·다른 출처 요청이 0이다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    await page.waitForTimeout(500);
    const requests: string[] = [];
    const base = new URL(page.url()).origin;
    let collecting = false;
    page.on('request', (r) => {
      if (collecting) requests.push(r.url());
    });
    await page.evaluate(() => {
      const w = window as unknown as { __sets: string[] };
      w.__sets = [];
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        w.__sets.push(k);
        return orig.call(this, k, v);
      };
    });
    const raw = () => page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const a = await raw();
    collecting = true;
    await openCredits(page);
    await page.getByTestId('credits-restart').click();
    await page.keyboard.press('PageDown');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    collecting = false;
    const b = await raw();
    expect(b).toBe(a);
    expect(await page.evaluate(() => (window as unknown as { __sets: string[] }).__sets)).toEqual([]);
    await page.reload();
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    expect(await raw()).toBe(a);
    const other = requests.filter((u) => new URL(u).origin !== base);
    expect(other).toEqual([]);
    // 열고 여닫는 동안 음원·그림·글꼴 요청이 0이다(코드·CSS 덩어리와 시대의 창 데이터만 받는다)
    expect(requests.filter((u) => /\.(mp3|ogg|wav|m4a|webp|png|jpe?g|svg|woff2?)(\?|$)/.test(new URL(u).pathname + new URL(u).search))).toEqual([]);
    expect((await readSave(page)).version).toBe(9);
  });
});

test.describe('받는 중 · 실패 · 다시 시도 · 연타 (완료 기준 19·20)', () => {
  test('덩어리를 받는 중에는 버튼이 「불러오는 중」(aria-busy)으로 바뀌되 자리·크기가 같고, 그동안 로고 확인 단계를 열면 도착해도 크레딧이 열리지 않는다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    const button = page.getByTestId(OPEN);
    const boxBefore = await button.boundingBox();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/src\/credits\/CreditsScreen\.tsx/, async (route) => {
      await gate;
      await route.continue();
    });
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: '불러오는 중' })).toHaveCount(1);
    const boxBusy = await button.boundingBox();
    expect(Math.abs(boxBusy!.width - boxBefore!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxBusy!.height - boxBefore!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxBusy!.y - boxBefore!.y)).toBeLessThanOrEqual(1);
    // 받는 동안 회고의 다른 조작은 그대로 쓸 수 있다 — 로고 확인 단계가 열린다
    await page.getByTestId('logo-home').click();
    await expect(page.getByTestId('ending-home-ask')).toBeVisible();
    release();
    await page.waitForTimeout(800);
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await expect(page.getByTestId('ending-home-ask')).toBeVisible();
    await page.getByTestId('ending-home-no').click();
    await expect(button).toHaveText(/이 삶의 이름들 보기/);
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('화면 덩어리를 막으면 오류 문구 · 「다시 시도」가 보이고 회고·다시 태어나기가 동작하며 저장이 변하지 않는다 — 연결을 되살려 다시 시도하면 열린다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    const raw = () => page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const a = await raw();
    await page.route(/\/src\/credits\/CreditsScreen\.tsx/, (route) => route.abort());
    await page.getByTestId(OPEN).click();
    const alert = page.locator('.ending__names-fail');
    await expect(alert).toHaveText('이 삶의 이름들을 펼치지 못했습니다. 생애 기록은 그대로 있습니다.');
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(1);
    await expect(page.getByTestId('rebirth')).toBeEnabled();
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    expect(await raw()).toBe(a);
    await page.unroute(/\/src\/credits\/CreditsScreen\.tsx/);
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    await expect(page.getByTestId('credits-name')).toBeFocused();
    expect(await raw()).toBe(a);
  });

  test('시대의 창 10년 덩어리 하나를 막아도 같다(오류 문구·다시 시도) — 받은 것만으로 줄을 고르지 않는다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    await page.route(/\/src\/data\/eraWindows\/d\d{4}\.ts/, (route) => route.abort());
    await page.getByTestId(OPEN).click();
    await expect(page.locator('.ending__names-fail')).toBeVisible();
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await page.unroute(/\/src\/data\/eraWindows\/d\d{4}\.ts/);
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-screen')).toBeVisible();
  });

  test('연타해도 화면 덩어리는 한 번만 받는다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    const hits: string[] = [];
    page.on('request', (r) => {
      if (/\/src\/credits\/CreditsScreen\.tsx/.test(r.url())) hits.push(r.url());
    });
    await page.getByTestId(OPEN).dblclick();
    await page.getByTestId(OPEN).click({ force: true }).catch(() => undefined);
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await page.getByTestId(OPEN).click(); // 다시 열어도 다시 받지 않는다
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  test('개발 서버 전용 탐침 ?__creditsThrow: 줄 모델 예외가 오류 화면(error-screen)으로 올라가지 않고 오류 문구 · 다시 시도 · 기록으로 돌아가기가 보이며 회고·다시 태어나기가 동작하고 저장 바이트가 같다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await injectSave(page, s, '/?__creditsThrow', SETTINGS);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    const raw = () => page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const a = await raw();
    await expect(page.getByTestId(OPEN)).toBeEnabled();
    await page.getByTestId(OPEN).click();
    const fail = page.getByTestId('credits-fail');
    await expect(fail).toBeVisible();
    await expect(page.getByTestId('error-screen')).toHaveCount(0);
    await expect(fail.getByRole('alert')).toHaveText('이 삶의 이름들을 펼치지 못했습니다. 생애 기록은 그대로 있습니다.');
    await expect(fail.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await expect(fail.getByRole('button', { name: '기록으로 돌아가기' })).toBeVisible();
    await fail.getByRole('button', { name: '다시 시도' }).click();
    await expect(fail).toBeVisible(); // 같은 입력이라 다시 실패한다 — 그래도 최상위 오류 화면은 아니다
    await expect(page.getByTestId('error-screen')).toHaveCount(0);
    await fail.getByRole('button', { name: '기록으로 돌아가기' }).click();
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await expect(page.getByTestId('rebirth')).toBeEnabled();
    expect(await raw()).toBe(a);
  });
});

test.describe('자동 흐름 · 정지 · 목록 (완료 기준 14·15)', () => {
  test.setTimeout(120_000);

  test('자동 후보 판은 실제로 이동하고(처음 4초 정지 뒤), 수동 스크롤·방향키·PageDown·Home/End·다른 단추에 초점에서 멈추며 임의로 다시 시작하지 않는다. 「이어 보기」는 멈춘 자리에서 잇는다', async ({ page }) => {
    const s = await findAutoState(page);
    test.skip(s === null, '이 뷰포트에서 자동 후보 판이 없다(이동 속도 상한 초과) — 정지 목록 시험이 대신 본다');
    const y = () => page.evaluate(() => window.scrollY);
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    expect(await y()).toBeLessThan(2); // 처음 4초 정지
    await expect.poll(y, { timeout: 20_000 }).toBeGreaterThan(30);
    // 멈춤 ① PageDown
    await page.keyboard.press('PageDown');
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
    await page.waitForTimeout(900); // 브라우저의 PageDown 스크롤이 끝난 뒤
    const stopped = await y();
    await page.waitForTimeout(1200);
    expect(Math.abs((await y()) - stopped)).toBeLessThanOrEqual(2); // 임의로 다시 시작하지 않는다
    // 이어 보기 — 멈춘 자리에서
    await page.getByTestId('credits-toggle').click();
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    await expect.poll(y, { timeout: 10_000 }).toBeGreaterThan(stopped + 8);
    expect(await y()).toBeLessThan(stopped + 600);
    // 멈춤 ② 휠
    await page.mouse.wheel(0, 40);
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
    await page.getByTestId('credits-toggle').click();
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    // 멈춤 ③ 방향키, ④ Home/End
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
    await page.getByTestId('credits-toggle').click();
    await page.keyboard.press('End');
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
    await page.getByTestId('credits-toggle').click();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
    // 멈춤 ⑤ 다른 조작 요소에 초점
    await page.getByTestId('credits-toggle').click();
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    await page.getByTestId('credits-restart').focus();
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
  });

  test('탭 숨김·창 폭 변경에서 멈춘다(탭 숨김은 visibilitychange로 흉내)', async ({ page }) => {
    const s = await findAutoState(page);
    test.skip(s === null, '자동 후보 판이 없다');
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    });
    await page.getByTestId('credits-toggle').click();
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width + 40, height: vp.height });
    await expect(page.getByTestId('credits-restart')).toBeVisible();
    const toggle = page.getByTestId('credits-toggle');
    if (await toggle.count()) await expect(toggle).toHaveText('이어 보기');
  });

  test('「목록으로 보기」를 누르면 자동 이동이 멈추고 정지 목록이 되며 일시정지/이어 보기·목록 단추가 사라진다 — 「처음부터 보기」도 그 진입에서는 정지 목록으로 연다', async ({ page }) => {
    const s = await findAutoState(page);
    test.skip(s === null, '자동 후보 판이 없다');
    await page.getByTestId('credits-list').click();
    await expect(page.getByTestId('credits-toggle')).toHaveCount(0);
    await expect(page.getByTestId('credits-list')).toHaveCount(0);
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-flow', 'list');
    const y0 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    await page.getByTestId('credits-restart').click();
    await expect(page.getByTestId('credits-name')).toBeFocused();
    await expect(page.getByTestId('credits-toggle')).toHaveCount(0); // 목록을 누른 진입이라 정지 목록으로 열린다
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // 닫았다 다시 열면 새 진입이라 판정을 다시 한다
    await page.getByTestId('credits-close').click();
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-flow', 'auto');
  });

  test('움직임 줄이기(OS 설정)는 정지 목록이다 — 자동 이동·자동 닫힘이 0이고 흐름 단추가 없다. 재생 중 켜면 즉시 멈추고 정지 목록이 된다', async ({ page }) => {
    const s = await findAutoState(page);
    test.skip(s === null, '자동 후보 판이 없다');
    // 재생 중 움직임 줄이기를 켠다
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-flow', 'list');
    await expect(page.getByTestId('credits-toggle')).toHaveCount(0);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    // 처음부터 열 때도(OS 설정이 켜져 있는 채) 정지 목록이다
    await page.getByTestId('credits-close').click();
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-flow', 'list');
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-reason', 'reduced');
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('앱의 움직임 줄이기(data-motion=reduce)도 정지 목록이다', async ({ page }) => {
    const s = await findAutoState(page);
    test.skip(s === null, '자동 후보 판이 없다');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('credits-screen')).toHaveCount(0);
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
    await openCredits(page);
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-reason', 'reduced');
    await expect(page.getByTestId('credits-toggle')).toHaveCount(0);
  });

  for (const percent of [150, 200]) {
    test(`글자 확대 ${percent}%(루트 글자 크기 24px 이상)에서는 정지 목록이다 — 자동 이동 0 · 흐름 단추 없음 · 가로 넘침 0`, async ({ page }) => {
      const s = await findAutoState(page);
      test.skip(s === null, '자동 후보 판이 없다');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('credits-screen')).toHaveCount(0);
      await setRootFontPercent(page, percent);
      await openCredits(page);
      await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-reason', 'large');
      await expect(page.getByTestId('credits-toggle')).toHaveCount(0);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  }

  test('재생 중 루트 글자 크기를 150%로 올리면 즉시 멈추고 정지 목록이 된다', async ({ page }) => {
    const s = await findAutoState(page);
    test.skip(s === null, '자동 후보 판이 없다');
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    await setRootFontPercent(page, 150);
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-flow', 'list');
    await expect(page.getByTestId('credits-toggle')).toHaveCount(0);
  });

  test('이동거리가 0 이하인 짧은 판(한 화면에 다 들어옴)은 정지 목록이고 전체 재생 단추가 없다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    const tiny = { ...s, family: undefined, history: s.history.filter((h) => h.kind === 'stage' || h.kind === 'death'), birthReport: s.birthReport } as GameState;
    await openEnding(page, tiny);
    await page.setViewportSize({ width: 1280, height: 3600 });
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    await expect(page.getByTestId('credits-bar')).toHaveAttribute('data-reason', 'short');
    await expect(page.getByTestId('credits-toggle')).toHaveCount(0);
  });
});

test.describe('길이 N과 읽기 순서 (완료 기준 10·17)', () => {
  test('화면의 보이는 본문을 EC1 7항 규칙으로 센 값이 줄 모델의 N(data-n)과 같다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s, { gentle: false });
    await openCredits(page);
    const n = Number(await page.getByTestId('credits-bar').getAttribute('data-n'));
    expect(n).toBeGreaterThan(100);
    expect(await visibleN(page)).toBe(n);
  });

  test('읽기 순서가 한 문서다: h1(이름) → h2(가족과 친구 → 기록에 남은 선택 → 그 시절의 기록 → 생애 기록), 줄별 aria-live가 없고, 크레딧이 열려 있는 동안 회고 본문은 접근성 트리에 없다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    await openCredits(page);
    const heads = await page.locator('[data-testid="credits-screen"] h1, [data-testid="credits-screen"] h2').allTextContents();
    expect(heads[0]).toBe((s.character as { name: string }).name);
    expect(heads.at(-1)).toBe('생애 기록');
    const order = ['가족과 친구', '기록에 남은 선택', '그 시절의 기록', '생애 기록'].filter((t) => heads.includes(t));
    expect(heads.slice(1)).toEqual(order);
    expect(await page.locator('[data-testid="credits-screen"] [aria-live]').count()).toBe(0);
    await expect(page.locator('main.ending')).toBeHidden();
    const snap = await page.locator('body').ariaSnapshot();
    expect(snap).not.toContain('다시 태어나기'); // 회고 본문이 접근성 트리에서 빠진다
    expect(snap).toContain('기록으로 돌아가기');
  });
});

test.describe('가림 (완료 기준 8)', () => {
  /** 허용 목록의 무거운 사건(건강 위기, 중년)을 본인 선택으로 심은 판 */
  function withHeavy(base: GameState): GameState {
    const history: HistoryEntry[] = base.history.filter((h) => !(h.kind === 'choice' && h.age >= 40 && h.age < 65 && isCreditsDecision(h.eventId)));
    const entry: HistoryEntry = { age: 50, kind: 'choice', eventId: 'middle-health-crisis', title: '가려질제목', question: '가려질질문?', choice: '가려질선택', text: '가려질결과문장입니다.' };
    const at = history.findIndex((h) => h.age > 50);
    history.splice(at === -1 ? history.length : at, 0, entry);
    return { ...base, history, death: { ...base.death!, age: Math.max(base.death!.age, 70) } } as GameState;
  }

  test('gentle 켬: 닫힌 줄의 원문이 크레딧 안 DOM·접근성 이름에 0이고 단추 이름에는 나이·분류뿐이다. 펼치면 그 한 건만 열리고 접으면 닫히며, 재진입·새로고침 뒤에는 닫혀 있다', async ({ page }) => {
    const base = await endedOf(page, 7, 'millennial');
    const s = withHeavy({ ...base, gentleUsed: true } as GameState);
    await openEnding(page, s, { gentle: true });
    await openCredits(page);
    const screen = page.getByTestId('credits-screen');
    expect(await screen.innerHTML()).not.toContain('가려질');
    expect(await screen.innerText()).not.toContain('가려질');
    await expect(screen.getByText('이 판은 무거운 장면을 가린 채 살았습니다.')).toBeVisible();
    const btn = screen.getByTestId('credits-veil-btn').first();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    const label = (await btn.getAttribute('aria-label'))!;
    expect(label).toMatch(/^펼쳐 보기 51세 /);
    expect(label).not.toContain('가려질');
    await expect(btn).toHaveAttribute('title', '').catch(() => undefined);
    expect(await btn.getAttribute('title')).toBeNull();
    const ariaClosed = await screen.ariaSnapshot();
    expect(ariaClosed).not.toContain('가려질');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(btn).toHaveAttribute('aria-controls', /credits-choice-\d+-body/);
    await expect(screen.getByText('가려질결과문장입니다.')).toBeVisible();
    await expect(screen.getByText('가려질질문?')).toBeVisible();
    // 다른 가림 줄은 그대로 닫혀 있다(그 한 건에만 적용)
    expect(await screen.getByTestId('credits-veil-btn').evaluateAll((els) => els.filter((e) => e.getAttribute('aria-expanded') === 'true').length)).toBe(1);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.innerHTML()).not.toContain('가려질');
    // 다시 펼친 뒤 닫고 재진입
    await btn.click();
    await page.getByTestId('credits-close').click();
    await page.getByTestId(OPEN).click();
    expect(await page.getByTestId('credits-screen').innerHTML()).not.toContain('가려질');
    await page.getByTestId('credits-close').click();
    await page.reload();
    await page.getByTestId(OPEN).click();
    expect(await page.getByTestId('credits-screen').innerHTML()).not.toContain('가려질');
  });

  test('펼침은 자동 이동을 멈춘다(자동 후보 판)', async ({ page }) => {
    test.setTimeout(90_000);
    const base = await endedOf(page, 7, 'millennial');
    const s = withHeavy({ ...base, gentleUsed: true } as GameState);
    await openEnding(page, s, { gentle: true });
    await openCredits(page);
    test.skip((await flowOf(page)) !== 'auto', '이 판은 정지 목록으로 열린다');
    await expect(page.getByTestId('credits-toggle')).toHaveText('일시정지');
    await page.getByTestId('credits-veil-btn').first().click();
    await expect(page.getByTestId('credits-toggle')).toHaveText('이어 보기');
  });

  test('개발 하니스(harness/credits.html)에서 가림 설정을 바꾸면: 끔→켬은 열린 건 없이 가려지고, 켬→끔은 원문이 된다 — 열린 채로 바꾸는 유일한 길(엔딩 화면 안에는 스위치가 없다)', async ({ page }) => {
    const base = await endedOf(page, 7, 'millennial');
    const s = withHeavy({ ...base, gentleUsed: true } as GameState);
    await injectSave(page, s, '/harness/credits.html', { ...SETTINGS });
    const screen = page.getByTestId('credits-screen');
    await expect(screen).toBeVisible();
    await expect(page.getByTestId('gentle-state')).toHaveText('off');
    await expect(screen.getByText('가려질결과문장입니다.')).toBeVisible(); // 끔: 원문
    await page.getByTestId('gentle-on').click();
    await expect(page.getByTestId('gentle-state')).toHaveText('on');
    expect(await screen.innerHTML()).not.toContain('가려질');
    const btn = screen.getByTestId('credits-veil-btn').first();
    await expect(btn).toHaveAttribute('aria-expanded', 'false'); // 열린 건 없이 가려진다
    await btn.click();
    await expect(screen.getByText('가려질결과문장입니다.')).toBeVisible();
    await page.getByTestId('gentle-off').click(); // 켬→끔: 원문
    await expect(screen.getByTestId('credits-veil-btn')).toHaveCount(0);
    await expect(screen.getByText('가려질결과문장입니다.')).toBeVisible();
    await page.getByTestId('gentle-on').click(); // 다시 켜면 그 전에 열어 둔 줄도 다시 가려진다
    await expect(page.getByTestId('gentle-state')).toHaveText('on');
    await expect(screen.getByTestId('credits-veil-btn').first()).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.innerHTML()).not.toContain('가려질');
  });

  test('gentle 끔: 같은 기록이 원문으로 나오고 가림 단추가 없다. gentleUsed만 켜진 판은 안내 줄이 설정과 무관하게 보인다', async ({ page }) => {
    const base = await endedOf(page, 7, 'millennial');
    const s = withHeavy({ ...base, gentleUsed: true } as GameState);
    await openEnding(page, s, { gentle: false });
    await openCredits(page);
    const screen = page.getByTestId('credits-screen');
    await expect(screen.getByTestId('credits-veil-btn')).toHaveCount(0);
    await expect(screen.getByText('가려질결과문장입니다.')).toBeVisible();
    await expect(screen.getByText('이 판은 무거운 장면을 가린 채 살았습니다.')).toBeVisible();
  });
});

test.describe('화면 규격: 320·360·1280 × 글자 100·200% (완료 기준 16)', () => {
  const sizes = [
    { width: 320, height: 568 },
    { width: 360, height: 740 },
    { width: 1280, height: 800 },
  ];
  for (const size of sizes) {
    for (const percent of [100, 200]) {
      test(`${size.width}×${size.height} · 글자 ${percent}%: 가로 넘침·잘림 0, 모든 단추 44px 이상, 끝 장 단추가 띠 위에 다 보이고 초점 링이 보인다`, async ({ page }) => {
        test.setTimeout(90_000);
        const s = await endedOf(page, 7, 'millennial');
        await page.setViewportSize(size);
        await openEnding(page, s);
        if (percent !== 100) await setRootFontPercent(page, percent);
        await page.getByTestId(OPEN).click();
        await expect(page.getByTestId('credits-screen')).toBeVisible();
        await settle(page);
        const m = await measureTextResize(page);
        expect(textResizeViolations(m, `${size.width}×${size.height} ${percent}%`)).toEqual([]);
        expect(await noHorizontalOverflow(page)).toBe(true);
        const buttons = await page.getByTestId('credits-screen').getByRole('button').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-testid'), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })));
        expect(buttons.length).toBeGreaterThanOrEqual(4);
        for (const b of buttons) expect(b.h, `${b.id} 높이`).toBeGreaterThanOrEqual(43.5);
        // 문서 끝: 끝 장 단추가 조작 띠에 가리지 않는다
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await settle(page);
        const gap = await page.evaluate(() => {
          const bar = document.querySelector('.credits-bar') as HTMLElement;
          const restart = document.querySelector('[data-testid="credits-end-restart"]') as HTMLElement;
          const bt = bar.getBoundingClientRect();
          const rt = restart.getBoundingClientRect();
          const fixed = getComputedStyle(bar).position === 'fixed';
          return { fixed, gap: fixed ? bt.top - rt.bottom : 99, ratio: bt.height / window.innerHeight };
        });
        if (gap.fixed) {
          expect(gap.gap).toBeGreaterThanOrEqual(8);
          expect(gap.ratio).toBeLessThanOrEqual(0.5 + 1e-6);
        }
        // 초점 링: 키보드로 단추에 닿으면 3px 윤곽선
        await page.getByTestId('credits-end-restart').focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const outline = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const cs = getComputedStyle(el);
          return { w: parseFloat(cs.outlineWidth), style: cs.outlineStyle };
        });
        expect(outline.style).not.toBe('none');
        expect(outline.w).toBeGreaterThanOrEqual(2.9);
      });
    }
  }

  for (const mode of ['dark', 'forced'] as const) {
    for (const width of [320, 1280]) {
      test(`${mode === 'dark' ? '다크' : '강제 색상'} · 폭 ${width}: 가로 넘침 0, 단추 44px 이상, 초점 링이 보인다`, async ({ page }) => {
        const s = await endedOf(page, 7, 'millennial');
        await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
        if (mode === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
        else await page.emulateMedia({ forcedColors: 'active' });
        await openEnding(page, s);
        await page.getByTestId(OPEN).click();
        await expect(page.getByTestId('credits-screen')).toBeVisible();
        await settle(page);
        expect(await noHorizontalOverflow(page)).toBe(true);
        const heights = await page.getByTestId('credits-screen').getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        for (const h of heights) expect(h).toBeGreaterThanOrEqual(43.5);
        await page.getByTestId('credits-close').focus();
        await page.keyboard.press('Shift+Tab');
        const outline = await page.evaluate(() => {
          const cs = getComputedStyle(document.activeElement as HTMLElement);
          return { w: parseFloat(cs.outlineWidth), style: cs.outlineStyle };
        });
        expect(outline.style).not.toBe('none');
        expect(outline.w).toBeGreaterThanOrEqual(2.9);
      });
    }
  }

  test('엔딩에서 새로고침한 뒤 연 크레딧의 전문과 N이 새로고침 전과 글자 그대로 같고, 새로고침 뒤 진입에서는 필요한 시대 10년 덩어리를 주소당 한 번 요청한다', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await openEnding(page, s);
    await openCredits(page);
    const text = await page.getByTestId('credits-screen').innerText();
    const n = await page.getByTestId('credits-bar').getAttribute('data-n');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId(OPEN)).toBeEnabled();
    const hits: string[] = [];
    page.on('request', (r) => {
      if (/\/src\/data\/eraWindows\/d\d{4}\.ts/.test(r.url())) hits.push(new URL(r.url()).pathname);
    });
    await openCredits(page);
    expect(await page.getByTestId('credits-screen').innerText()).toBe(text);
    expect(await page.getByTestId('credits-bar').getAttribute('data-n')).toBe(n);
    expect(hits.length).toBeGreaterThan(0);
    expect(new Set(hits).size).toBe(hits.length);
    expect(hits.length).toBeLessThanOrEqual(7);
  });

  test('조작 띠가 작은 뷰포트 높이의 절반을 넘으면 고정을 풀고(머리 띠 아래 DOM 자리) 끝 여백이 사라진다 — 320×256 × 글자 200%', async ({ page }) => {
    const s = await endedOf(page, 7, 'millennial');
    await page.setViewportSize({ width: 320, height: 256 });
    await openEnding(page, s);
    await setRootFontPercent(page, 200);
    await page.getByTestId(OPEN).click();
    await expect(page.getByTestId('credits-screen')).toBeVisible();
    await expect(page.getByTestId('credits-screen')).toHaveAttribute('data-bar', 'released');
    expect(await page.getByTestId('credits-bar').evaluate((el) => getComputedStyle(el).position)).toBe('static');
    expect(await page.locator('.credits-end-space').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});
