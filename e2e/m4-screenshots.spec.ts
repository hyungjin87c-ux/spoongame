import { expect, test, type Page } from '@playwright/test';
import { M4_SCREENS, openM4Screen, type M4Screen } from './m4States';
import { measureDash } from './m4Fixed';
import { noHorizontalOverflow } from './helpers';
import { setRootFontPercent } from './textResize';

/**
 * M4 증거 스크린샷 (SPEC-003 M4, qa/screenshots/003/dev-M4-*.png): 대시보드(영아·결정 카드·성인)를 모바일 360·데스크톱 1280·320에서, 다크·강제 색상·글자 200%로,
 * 그리고 엔딩·밀린 화면·오류 화면. 화면이 가로로 넘치지 않는지도 같이 본다. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 * 파일 이름: dev-M4-<화면>-<뷰포트>[-상태].png
 */

const SHOTS = 'qa/screenshots/003';

async function shot(page: Page, name: string, full = false): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/dev-M4-${name}.png`, fullPage: full });
}

/** 증거용: 고정 요소(머리·진행 줄)가 전체 화면 스크린샷에서 본문을 가리지 않게 흐름 안에 둔다 */
async function flowFixed(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.dash-head, .controls-fixed { position: static !important; }' });
}

const VIEWPORTS = [
  { name: 'mobile-360x740', width: 360, height: 740 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'narrow-320x568', width: 320, height: 568 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`증거 스크린샷 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const screen of ['dash-infant', 'dash-decision', 'dash-adult'] as const) {
      test(`${vp.name}: ${screen} 첫 화면(고정 머리·진행 줄 그대로)과 전체`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(60_000);
        await openM4Screen(page, screen);
        await page.waitForTimeout(300); // 얼굴·진행률 바가 자리를 잡은 뒤
        await shot(page, `${screen}-${vp.name}`);
        expect(await noHorizontalOverflow(page)).toBe(true);
        await flowFixed(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, `${screen}-${vp.name}-full`, true);
      });
    }

    for (const screen of ['ending', 'superseded', 'error'] as const) {
      test(`${vp.name}: ${screen}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await openM4Screen(page, screen);
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, `${screen}-${vp.name}`, screen === 'ending');
        expect(await noHorizontalOverflow(page)).toBe(true);
      });
    }
  });
}

test.describe('증거 스크린샷 테마·접근성', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const screen of ['dash-infant', 'dash-adult', 'ending'] as const) {
    test(`다크: ${screen}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.emulateMedia({ colorScheme: 'dark' });
      await openM4Screen(page, screen);
      await page.waitForTimeout(300);
      await shot(page, `${screen}-mobile-360x740-dark`);
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  }

  test('수동 다크(OS 라이트): 대시보드에서 다크 모드 버튼을 누른 뒤', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.emulateMedia({ colorScheme: 'light' });
    await openM4Screen(page, 'dash-adult');
    await page.getByTestId('tool-dark').click();
    await expect(page.getByTestId('tool-dark')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(200);
    await shot(page, 'dash-adult-mobile-360x740-manual-dark');
  });

  for (const screen of ['dash-infant', 'dash-adult', 'dash-decision', 'ending'] as const) {
    test(`강제 색상(고대비): ${screen}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
      await openM4Screen(page, screen);
      await page.waitForTimeout(300);
      await shot(page, `${screen}-mobile-360x740-forced-colors`);
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  }

  test('글자 200%: 대시보드(영아·결정 카드) — 고정 헤더·진행 줄이 풀리는 모습', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    for (const screen of ['dash-infant', 'dash-decision'] as const) {
      await openM4Screen(page, screen as M4Screen);
      await setRootFontPercent(page, 200);
      await measureDash(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `${screen}-mobile-360x740-font200`);
      expect(await noHorizontalOverflow(page)).toBe(true);
    }
  });

  test('나가기 확인 단계·BGM 켜짐(볼륨)이 열린 도구 줄 (생각 남기기는 M7c부터 보통 버튼)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await openM4Screen(page, 'dash-infant');
    await page.getByTestId('tool-bgm').click();
    await expect(page.getByTestId('bgm-volume')).toBeVisible();
    await expect(page.getByTestId('tool-note')).not.toContainText('준비 중'); // M7c: 보통 버튼 (D-75)
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'dash-infant-mobile-360x740-tools-open');
    await page.getByTestId('tool-exit').click();
    await expect(page.getByTestId('exit-ask')).toBeVisible();
    // 확인 단계가 열린 직후 0.4초는 입력 가드로 두 버튼이 흐린 비활성이다(R-340) — 가드가 풀려 「돌아가기」가 활성이 된 뒤에 찍어야 실제 모습의 증거다
    await expect(page.getByTestId('exit-no')).toBeEnabled();
    await expect(page.getByTestId('exit-yes')).toBeEnabled();
    await shot(page, 'dash-infant-mobile-360x740-exit-ask');
  });

  test('비활성 버튼(R-337): 자동 모드의 「다음 결정으로」 — 불투명도가 아니라 점선 + 옅은 글자 (라이트·다크). 「생각 남기기」는 M7c부터 보통 버튼', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await openM4Screen(page, 'dash-infant');
      await page.getByTestId('auto').click(); // 자동 모드 켜짐 → 「다음 결정으로」가 게임 내내 비활성
      await expect(page.getByTestId('skip')).toHaveAttribute('data-unavailable', 'true');
      await page.evaluate(() => window.scrollTo(0, 0));
      await flowFixed(page);
      await page.getByTestId('controls').screenshot({ path: `${SHOTS}/dev-M4-unavailable-controls-mobile-360x740-${scheme}.png` });
      await page.getByTestId('tools').screenshot({ path: `${SHOTS}/dev-M4-unavailable-tools-mobile-360x740-${scheme}.png` });
    }
  });

  test('프로필 얼굴 96px(R-329)과 엔딩 얼굴 1:1(R-320): 카드·머리 확대 샷', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await openM4Screen(page, 'dash-adult');
    await page.getByTestId('profile-card').screenshot({ path: `${SHOTS}/dev-M4-profile-card-96px-adult-mobile-360x740.png` });
    await openM4Screen(page, 'ending');
    await page.locator('.ending__head').screenshot({ path: `${SHOTS}/dev-M4-ending-head-face-mobile-360x740.png` });
    await page.setViewportSize({ width: 1280, height: 800 });
    await openM4Screen(page, 'ending');
    await page.locator('.ending__head').screenshot({ path: `${SHOTS}/dev-M4-ending-head-face-desktop-1280x800.png` });
  });

  test('나가기 확인 단계 · 폭 320 · 글자 200%: 버튼 이름이 낱말 단위로 줄바꿈되고 문서가 넘치지 않는다 (R-336)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 568 });
    await openM4Screen(page, 'dash-exit-ask');
    await setRootFontPercent(page, 200);
    await measureDash(page);
    await page.getByTestId('exit-ask').scrollIntoViewIfNeeded();
    await shot(page, 'dash-exit-ask-narrow-320x568-font200'); // 고정 머리·진행 줄 그대로(실제 화면)
    await flowFixed(page); // 증거용 상자 샷: 하단 고정 진행 줄이 상자를 덮지 않게 흐름 안에 둔다
    await page.getByTestId('exit-ask').screenshot({ path: `${SHOTS}/dev-M4-exit-ask-box-narrow-320x568-font200.png` });
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('낮은 가로 화면 667x375: 고정 헤더가 풀린 대시보드', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 667, height: 375 });
    await openM4Screen(page, 'dash-decision');
    await measureDash(page);
    await shot(page, 'dash-decision-landscape-667x375');
  });
});

test('모든 새 화면이 같은 증거 목록에 있다 (공허 방지)', () => {
  expect(M4_SCREENS).toEqual(['dash-infant', 'dash-decision', 'dash-adult', 'dash-exit-ask', 'dash-tools-open', 'ending', 'superseded', 'error']);
});
