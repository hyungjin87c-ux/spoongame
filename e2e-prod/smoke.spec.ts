import { expect, test, type Page } from '@playwright/test';
import { HOLD_MS } from '../src/data/timingTable';

/**
 * 프로덕션 번들 스모크 (R-043). `npm run e2e:prod`가 빌드한 dist를 vite preview로 띄운 서버에서 돈다.
 * 개발 서버 e2e가 못 보는 것: 번들이 실제로 실행되는가(이벤트 데이터 검증 포함), 개발 전용 탐침이 제품에서 꺼져 있는가.
 */

const GAME_KEY = 'suzeo-game:save';
/** 개발 전용 탐침 쿼리 이름. 제품 번들에는 문자열째 없어야 한다. */
const PROBES = ['__timescale', '__guard', '__crash', '__quota'] as const;
/** 개발 전용 하니스가 window에 다는 이름(harness/layout.tsx). 하니스가 번들에 섞이면 이 문자열이 보인다 (R-071). */
const HARNESS_GLOBALS = ['__layout'] as const;
/** 하니스 페이지에만 있는 문구 (harness/guard.html · harness/layout.html의 title) */
const HARNESS_MARKERS = ['GuardedButton 하니스', '선택지 레이아웃 하니스', '/harness/guard.tsx', '/harness/layout.tsx'] as const;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

async function toLifeScreen(page: Page): Promise<void> {
  await page.getByRole('button', { name: '시작' }).click(); // 가드가 풀릴 때까지 Playwright가 기다린다
  await expect(page.getByTestId('era-screen')).toBeVisible();
  await page.getByTestId('confirm-era').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

test('프로덕션 번들: 타이틀 → 시대 선택 → 출생 → 인생 화면까지 오류 없이 간다 (이벤트 데이터 검증 통과 후의 번들이 실제로 뜬다)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle('수저 게임');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await toLifeScreen(page);
  await expect(page.getByTestId('life-age')).toContainText('0세');
  for (const label of ['1배', '2배', '4배', '8배']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.getByTestId('auto')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  // 인생 화면으로 넘어가면 저장이 남는다
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('life');
  expect(errors).toEqual([]);
});

test('프로덕션 번들: "다음 결정으로" → 첫 선택지 선택을 되풀이해 사망(엔딩 화면)까지 가고, 다시 태어나기로 새 판의 시대 선택까지 간다 — 타이머를 기다리지 않고 제품 번들에서 엔진 전체가 돈다 (R-051, M5)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/');
  await toLifeScreen(page);

  const ending = page.getByTestId('ending-screen');
  // 마지막으로 쓴 속도는 다음 판에도 유지된다(SPEC): 8배로 바꿔 두고 끝까지 간다
  await page.getByRole('button', { name: '8배', exact: true }).click();
  const panel = page.getByTestId('choice-panel');
  const skip = page.getByTestId('skip');
  let choices = 0;
  let skips = 0;
  // 선택지가 떠 있으면 첫 선택지를 고르고, 없으면 "다음 결정으로"를 누른다. 연출 타이머가 끼어들어 상태가 바뀌면(드물다) 다시 판단한다.
  for (let step = 0; step < 400 && !(await ending.isVisible()); step++) {
    try {
      if (await panel.isVisible()) {
        await panel.getByRole('button').first().click({ timeout: 5_000 }); // 선택지 가드가 풀릴 때까지 기다린다
        choices++;
      } else {
        await skip.click({ timeout: 5_000 }); // 컨트롤 가드가 풀리고 선택지가 없을 때 눌린다
        skips++;
      }
    } catch {
      // 판단과 클릭 사이에 화면이 바뀌었다(타이머로 선택지가 뜨거나 엔딩으로 감) → 다음 반복에서 다시 본다
    }
  }
  await expect(ending).toBeVisible();
  expect(choices, '선택지를 한 번 이상 골랐다').toBeGreaterThan(0);
  expect(skips, '"다음 결정으로"를 한 번 이상 눌렀다').toBeGreaterThan(0);

  // 저장: 엔딩 단계, 사망 정보가 있고, 고른 선택이 연표에 남아 있다
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('ending');
  expect(saved?.data?.death, '사망 정보가 저장돼 있다').toBeTruthy();
  const history = saved.data.history as Array<{ kind: string; age: number }>;
  expect(history.filter((h) => h.kind === 'choice').length, '연표의 선택 기록 수').toBe(choices);
  expect(history.some((h) => h.kind === 'death')).toBe(true);
  // 새로고침해도 엔딩에 머무른다
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);

  // 엔딩 회고(제품 번들): 사망 한 줄·출발선 대비(같은 세상 안의 자리)·최종 스탯·연표(선택한 순간이 빠짐없이)
  await expect(page.getByTestId('ending-death')).toContainText(`${saved.data.death.age}세에 세상을 떠났다`);
  await expect(page.getByTestId('ending-journey')).toContainText('의 집에서 태어');
  await expect(page.getByTestId('ending-movement')).toBeVisible();
  for (const key of ['wealth', 'education', 'health', 'happiness', 'relationships', 'looks']) await expect(page.getByTestId(`final-${key}`)).toBeVisible();
  await expect(page.getByTestId('timeline-entry')).toHaveCount(history.length);
  await expect(page.getByTestId('timeline-picked')).toHaveCount(choices);
  const endingText = (await page.getByTestId('ending-screen').innerText()).replace(/\s+/g, ' ');
  expect(endingText).not.toMatch(/(흙|동|은|금|다이아)\s*수저|다이아|!/);

  // 다시 태어나기: 새 시드의 새 판, 시대 선택 화면(기본 지금 세상), 설정(8배) 유지, 포커스는 새 화면 제목
  const settingsBefore = await page.evaluate(() => localStorage.getItem('suzeo-game:settings'));
  expect(JSON.parse(settingsBefore!).data.speed).toBe(8);
  await page.getByTestId('rebirth').click(); // 가드가 풀릴 때까지 Playwright가 기다린다
  await expect(page.getByTestId('era-screen')).toBeVisible();
  await expect(page.locator('[data-era="present"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`)).toBe('H1:어느 세상에서 태어날까');
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.data?.phase, GAME_KEY)).toBe('eraSelect');
  const fresh = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(fresh.data.seed, '새 시드').not.toBe(saved.data.seed);
  expect(fresh.data.history).toEqual([]);
  expect(fresh.data.character).toBeNull();
  expect(fresh.data.death).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('suzeo-game:settings'))).toBe(settingsBefore);
  // 새 판도 끝까지 시작할 수 있다: 시대를 확정하면 새 인물의 출생 화면
  await page.getByTestId('confirm-era').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('개발 탐침 쿼리(?__timescale·__guard·__crash·__quota)는 프로덕션에서 아무 효과가 없다', async ({ page }) => {
  const errors = trackErrors(page);
  // 첫 렌더에 입력 가드(aria-disabled)가 한 번이라도 걸렸는지 기록한다 — ?__guard=0이 먹혔다면 가드가 한 번도 안 걸린다.
  await page.addInitScript(() => {
    const w = window as unknown as { __sawGuard: boolean };
    w.__sawGuard = false;
    new MutationObserver(() => {
      if (document.querySelector('[aria-disabled="true"]')) w.__sawGuard = true;
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await page.goto('/?__timescale=1000&__guard=0&__crash=1&__quota=1');

  // __crash: 렌더 중 예외로 ErrorBoundary가 뜨면 안 된다
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  // __guard=0: 가드가 실제로 걸렸다
  expect(await page.evaluate(() => (window as unknown as { __sawGuard: boolean }).__sawGuard), '입력 가드가 걸렸다 (?__guard=0 무시)').toBe(true);

  await toLifeScreen(page);
  // __timescale=1000: 1배속의 첫 한 해(0세는 이벤트가 없는 조용한 해, HOLD_MS.quiet)가 실제로 그만큼 걸린다. 탐침이 먹혔다면 수 ms 만에 나이가 오르거나 선택지가 뜬다.
  const shownAt = Date.now();
  await expect
    .poll(() => page.evaluate(() => !document.querySelector('[data-testid="life-age"]')?.textContent?.includes('0세') || document.querySelector('[data-testid="choice-panel"]') !== null), {
      timeout: 15_000,
    })
    .toBe(true);
  const firstYearMs = Date.now() - shownAt;
  expect(firstYearMs, `첫 한 해가 ${firstYearMs}ms 만에 지났다 — 1배속의 조용한 한 해는 약 ${HOLD_MS.quiet}ms여야 한다 (?__timescale 무시)`).toBeGreaterThanOrEqual(HOLD_MS.quiet * 0.75);

  // __quota: 저장이 실패하는 저장소가 되면 안 된다 — 저장 안내가 없고 저장이 실제로 남아 있다
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k) !== null, GAME_KEY)).toBe(true);
  expect(errors).toEqual([]);
});

test('제품 번들 파일에 개발 탐침 문자열이 없고, 개발 전용 하니스 페이지는 제공되지 않는다', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  expect(scripts.length, 'index.html에 번들 스크립트가 있다').toBeGreaterThan(0);
  for (const src of scripts) {
    expect(src, '개발 서버(/src/main.tsx)가 아니라 빌드 산출물을 가리킨다').toMatch(/^\/assets\/.+\.js$/);
    const body = await (await request.get(src)).text();
    expect(body.length).toBeGreaterThan(10_000);
    for (const probe of PROBES) expect(body, `${src}에 ${probe}가 있다`).not.toContain(probe);
    for (const name of HARNESS_GLOBALS) expect(body, `${src}에 개발 하니스의 ${name}가 있다 (R-071)`).not.toContain(name);
  }
  // R-071: 하니스 두 페이지(guard.html · layout.html) 모두 제공되지 않는다. vite preview는 없는 경로에 index.html을 돌려주므로,
  // 404이거나 앱의 index.html과 똑같은 내용이면 "제공되지 않음"이다 — 하니스 문구·스크립트 경로는 어디에도 없어야 한다.
  for (const path of ['/harness/guard.html', '/harness/layout.html']) {
    const res = await request.get(path);
    const text = await res.text();
    for (const marker of HARNESS_MARKERS) expect(text, `${path}에 하니스 문구 "${marker}"가 있다`).not.toContain(marker);
    expect(res.status() === 404 || text === html, `${path}: 404이거나 앱의 index.html이어야 한다 (지금 ${res.status()})`).toBe(true);
  }
});
