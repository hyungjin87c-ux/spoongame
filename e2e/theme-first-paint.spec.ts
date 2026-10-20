import { expect, test, type Page } from '@playwright/test';
import { SETTINGS_KEY, settingsEnvelope } from './saves';

/**
 * 수동 테마 사전 적용 (QA-003-M4 O02): 다크·라이트를 직접 고른 사용자는 JS 번들이 늦게 와도 첫 그림부터 고른 테마다.
 * `index.html`의 인라인 스크립트가 저장된 설정의 theme을 `<html data-theme>`에 미리 건다(번들 `main.tsx`의 applyTheme보다 먼저).
 * 개발 서버는 CSS도 번들(JS)이 넣으므로 여기서는 **번들이 아직 안 왔을 때(#root가 빈 채)의 data-theme 속성**을 본다 — 바탕색 실측은 제품 번들의 e2e-prod/smoke.spec.ts.
 * 같은 입력으로 parseSettings와 결과가 같은지는 단위 시험 tests/themeInline.test.ts가 수백 건으로 대조한다.
 * 번들 지연은 진입 모듈(/src/main.tsx) 응답을 붙잡아 만든다. 뷰포트와 상관없으므로 mobile-360 프로젝트에서만 돈다.
 */

const DELAY_MS = 2_500;

/** 진입 모듈 응답을 DELAY_MS 붙잡는다 — 그 사이가 「JS가 아직 안 온」 첫 그림이다. 풀어 주는 함수를 돌려준다. */
async function holdBundle(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
    setTimeout(resolve, DELAY_MS);
  });
  await page.route(/\/src\/main\.tsx(\?|$)/, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

/** 번들 전 상태: React가 안 떴고(#root가 빔) 지금 문서에 걸린 data-theme */
const beforeBundle = (page: Page) => page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), rootEmpty: document.getElementById('root')?.childElementCount === 0 }));

async function seed(page: Page, raw: string): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, raw] as const);
}

test.describe('JS가 오기 전(번들 지연)의 data-theme', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트와 상관없어 mobile-360에서만 실행');
  });

  for (const [saved, os] of [
    ['dark', 'light'],
    ['dark', 'dark'],
    ['light', 'dark'],
    ['light', 'light'],
  ] as const) {
    test(`수동 ${saved} 저장 · OS ${os}: 번들이 오기 전에 이미 data-theme="${saved}"이고, 번들이 뜬 뒤에도 같다`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.emulateMedia({ colorScheme: os });
      await seed(page, settingsEnvelope({ speed: 1, autoMode: false, theme: saved }));
      const release = await holdBundle(page);
      await page.goto('/', { waitUntil: 'commit' });
      await expect.poll(async () => (await beforeBundle(page)).theme, { message: '인라인 스크립트가 번들보다 먼저 건다' }).toBe(saved);
      expect((await beforeBundle(page)).rootEmpty, '아직 React가 뜨기 전이다(번들 지연 중)').toBe(true);
      release();
      await expect(page.getByTestId('title-screen')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), '번들이 뜬 뒤에도 같은 테마').toBe(saved);
      expect(errors).toEqual([]);
    });
  }

  for (const [label, init] of [
    ['저장된 테마가 system', settingsEnvelope({ speed: 1, autoMode: false, theme: 'system' })],
    ['저장이 없음', null],
    ['깨진 JSON', '{"version":3,"data":'],
    ['모르는 버전(6)', JSON.stringify({ version: 6, data: { speed: 1, autoMode: false, theme: 'dark' } })], // 설정 v5(SPEC-005 QI6·QI7)부터 5는 읽을 수 있는 버전이다 — 아직 없는 다음 버전으로 올렸다 (tests/themeInline.test.ts와 같은 경계)
    ['형식이 어긋난 설정(배속 3)', JSON.stringify({ version: 3, data: { speed: 3, autoMode: false, theme: 'dark' } })],
    ['theme 값이 이상함(Dark)', JSON.stringify({ version: 3, data: { speed: 1, autoMode: false, theme: 'Dark' } })],
  ] as const) {
    test(`${label}: 번들이 오기 전에 아무것도 안 건다(시스템 설정을 따른다) — 오류 0, 번들이 뜬 뒤에도 정상`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (init !== null) await seed(page, init);
      const release = await holdBundle(page);
      await page.goto('/', { waitUntil: 'commit' });
      // 인라인 스크립트가 돈 뒤여야 「안 걸었다」가 의미 있다 — 문서가 파싱된 것(head의 메타가 보임)을 먼저 확인한다
      await expect.poll(() => page.evaluate(() => document.querySelector('meta[name="color-scheme"]') !== null)).toBe(true);
      const state = await beforeBundle(page);
      expect(state.theme, '건 값 없음').toBeNull();
      expect(state.rootEmpty).toBe(true);
      release();
      await expect(page.getByTestId('title-screen')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), '번들이 뜬 뒤에도 수동 선택이 없다').toBeNull();
      expect(errors).toEqual([]);
    });
  }

  test('저장소 접근이 막힌 환경(localStorage 접근이 예외): 인라인 스크립트가 오류를 내지 않는다 — 번들 전 data-theme 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const release = await holdBundle(page);
    await page.goto('/', { waitUntil: 'commit' });
    await expect.poll(() => page.evaluate(() => document.querySelector('meta[name="color-scheme"]') !== null)).toBe(true);
    expect((await beforeBundle(page)).theme).toBeNull();
    expect(errors, '번들이 오기 전까지 페이지 오류 0').toEqual([]);
    release();
    await expect(page.getByTestId('title-screen')).toBeVisible();
  });

  test('요청을 만들지 않는다: 인라인 스크립트 때문에 늘어난 요청이 없다(문서 하나 + 번들 요청뿐, 외부 주소 0)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const host = new URL(r.url()).hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') external.push(r.url());
    });
    await seed(page, settingsEnvelope({ speed: 1, autoMode: false, theme: 'dark' }));
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    expect(external).toEqual([]);
  });

  test('대조: 저장은 dark인데 인라인 스크립트를 뺀 문서(HTML 응답에서 제거)는 번들 전 data-theme이 없다 — 이 시험이 스크립트의 부재를 실제로 잡는다', async ({ page }) => {
    await seed(page, settingsEnvelope({ speed: 1, autoMode: false, theme: 'dark' }));
    await page.route(/\/$/, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(/<script>[\s\S]*?<\/script>/, '');
      await route.fulfill({ response: res, body: html });
    });
    const release = await holdBundle(page);
    await page.goto('/', { waitUntil: 'commit' });
    await expect.poll(() => page.evaluate(() => document.querySelector('meta[name="color-scheme"]') !== null)).toBe(true);
    const state = await beforeBundle(page);
    expect(state.rootEmpty).toBe(true);
    expect(state.theme, '스크립트가 없으면 번들 전에는 아무것도 걸리지 않는다').toBeNull();
    release();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), '번들이 뜬 뒤에야 걸린다(옛 동작)').toBe('dark');
  });
});
