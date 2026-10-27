import { expect, test, type Page } from '@playwright/test';
import { KNOWN_SEED, birthState, injectSave, noHorizontalOverflow, pressBegin, rouletteState, titleState } from './helpers';
import { BIRTH_VARIANT_IDS, birthVariantState } from './m3Variants';
import { setRootFontPercent } from './textResize';

/**
 * M3 증거 스크린샷 (SPEC-003 M3, qa/screenshots/003/dev-M3-*.png). 룰렛(회전 중·결과·움직임 줄이기)과 출생신고(위·아래)를 모바일 360·데스크톱 1280·320에서,
 * 그리고 다크·강제 색상으로 남긴다. 화면이 가로로 넘치지 않는지도 같이 본다. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SHOTS = 'qa/screenshots/003';

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/dev-M3-${name}.png` });
}

async function fullShot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/dev-M3-${name}.png`, fullPage: true });
}

for (const vp of [
  { name: 'mobile-360x740', width: 360, height: 740 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'narrow-320x568', width: 320, height: 568 },
] as const) {
  test.describe(`증거 스크린샷 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`${vp.name}: 룰렛 회전 중(수저 릴이 아직 도는 중)·결과`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(30_000);
      await injectSave(page, titleState(KNOWN_SEED));
      await pressBegin(page);
      const screen = page.getByTestId('roulette-screen');
      await expect(screen).toHaveAttribute('data-state', 'spinning');
      await expect(page.getByTestId('skip-roulette')).toBeEnabled();
      await page.waitForTimeout(1500); // 가속을 지난 회전 중
      await shot(page, `roulette-spinning-${vp.name}`);
      // 지역 릴이 멈추고 수저 릴만 도는 순간(약 4.2~5.4초)
      await page.waitForTimeout(3000);
      if ((await screen.getAttribute('data-state')) === 'spinning') await shot(page, `roulette-region-stopped-${vp.name}`);
      await expect(screen).toHaveAttribute('data-state', 'result', { timeout: 8000 });
      await expect(page.getByTestId('to-birth')).toBeEnabled(); // 입력 가드가 풀려 버튼이 흐리지 않은 모습으로 찍는다
      await shot(page, `roulette-result-${vp.name}`);
      expect(await noHorizontalOverflow(page)).toBe(true);
    });

    test(`${vp.name}: 출생신고 위·아래`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await injectSave(page, birthState(KNOWN_SEED, 'alpha', 3, 70));
      await expect(page.getByTestId('birth-screen')).toBeVisible();
      await expect(page.getByTestId('next-life')).toBeEnabled();
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `birth-top-${vp.name}`);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await shot(page, `birth-bottom-${vp.name}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await fullShot(page, `birth-full-${vp.name}`);
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  });
}

test.describe('증거 스크린샷 움직임 줄이기', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test('360x740: 움직임 줄이기(회전 없이 결과 + 안내 한 줄)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await injectSave(page, titleState(KNOWN_SEED));
    await pressBegin(page);
    await expect(page.getByTestId('motion-note')).toBeVisible();
    await expect(page.getByTestId('to-birth')).toBeEnabled();
    await shot(page, 'roulette-reduced-mobile-360x740');
  });
});

for (const scheme of [
  { name: 'dark', colorScheme: 'dark', forced: false },
  { name: 'forced-colors', colorScheme: 'light', forced: true },
  { name: 'forced-colors-dark', colorScheme: 'dark', forced: true },
] as const) {
  test.describe(`증거 스크린샷 ${scheme.name}`, () => {
    test.use({ viewport: { width: 360, height: 740 } });
    test(`360x740 ${scheme.name}: 룰렛 결과·출생신고`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.emulateMedia({ colorScheme: scheme.colorScheme, forcedColors: scheme.forced ? 'active' : 'none' });
      await injectSave(page, rouletteState(KNOWN_SEED, 'alpha', 4, 80));
      await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
      await expect(page.getByTestId('to-birth')).toBeEnabled();
      await shot(page, `roulette-result-${scheme.name}-360x740`);
      await injectSave(page, birthState(KNOWN_SEED, 'alpha', 4, 80));
      await expect(page.getByTestId('next-life')).toBeEnabled();
      await shot(page, `birth-top-${scheme.name}-360x740`);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await shot(page, `birth-bottom-${scheme.name}-360x740`);
    });
  });
}

test.describe('증거 스크린샷 지난·다가올 세상', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const era of ['industrial', 'genz'] as const) {
    test(`360x740 ${era}: 룰렛 결과·출생신고 (시대 보정 표기)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await injectSave(page, rouletteState(KNOWN_SEED, era, 2, 40));
      await expect(page.getByTestId('to-birth')).toBeEnabled();
      await shot(page, `roulette-result-${era}-360x740`);
      await injectSave(page, birthState(KNOWN_SEED, era, 2, 40));
      await expect(page.getByTestId('next-life')).toBeEnabled();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await shot(page, `birth-bottom-${era}-360x740`);
    });
  }
});

// ---------- 가장 긴 내용 표본 (REV-003-M3-1 R-262): 흙수저·다이아몬드수저·지난 세상·다가올 세상 출생신고 ----------

test.describe('증거 스크린샷 가장 긴 내용 표본', () => {
  for (const id of BIRTH_VARIANT_IDS) {
    if (id === 'birth') continue; // 기준선은 위에서 찍었다
    for (const vp of [
      { name: 'mobile-360x740', width: 360, height: 740 },
      { name: 'narrow-320x568', width: 320, height: 568 },
    ] as const) {
      test(`${id} ${vp.name}: 출생신고 위·전체`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await injectSave(page, birthVariantState(id));
        await expect(page.getByTestId('birth-screen')).toBeVisible();
        await expect(page.getByTestId('next-life')).toBeEnabled();
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, `${id}-top-${vp.name}`);
        await fullShot(page, `${id}-full-${vp.name}`);
        expect(await noHorizontalOverflow(page)).toBe(true);
      });
    }
  }

  test('birth-dirt 320x568 글자 200%: 출생신고 위·전체 (가장 긴 내용이 가장 좁은 폭·가장 큰 글자에서)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 568 });
    await injectSave(page, birthVariantState('birth-dirt'));
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    await expect(page.getByTestId('next-life')).toBeEnabled();
    await setRootFontPercent(page, 200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'birth-dirt-top-narrow-320x568-text200');
    await fullShot(page, 'birth-dirt-full-narrow-320x568-text200');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  // R-281: 넓은 화면(3열 격자)에서 「태어난 곳」이 두 칸을 쓴다 — 가장 긴 낱말(9글자)이 글자 150%에서도 한 줄에 있는 모습
  test('birth-dirt 1280x800 글자 150%: 출생신고 위·전체 (「태어난 곳」 두 칸, 「전남광주통합특별시」가 한 줄)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 1280, height: 800 });
    await injectSave(page, birthVariantState('birth-dirt'));
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    await expect(page.getByTestId('next-life')).toBeEnabled();
    await setRootFontPercent(page, 150);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'birth-dirt-top-desktop-1280x800-text150');
    await fullShot(page, 'birth-dirt-full-desktop-1280x800-text150');
    expect(await noHorizontalOverflow(page)).toBe(true);
    // 「태어난 곳」 칸이 3열 격자의 두 칸(3분의 2) 폭이고, 가장 긴 낱말이 한 줄에 있다
    const place = await page.getByTestId('birth-field-place').evaluate((el) => {
      const grid = el.parentElement!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const dd = el.querySelector('dd')!;
      const range = document.createRange();
      range.selectNodeContents(dd);
      const lines = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top / 4)));
      return { ratio: box.width / grid.width, lines: lines.size };
    });
    expect(place.ratio, '「태어난 곳」 칸 폭 / 격자 폭').toBeGreaterThan(0.6);
    expect(place.ratio).toBeLessThan(0.7);
    expect(place.lines, '「전남광주통합특별시 광산구」는 두 줄 이하(낱말은 끊기지 않는다 — 줄바꿈 감사가 따로 본다)').toBeLessThanOrEqual(2);
  });
});
