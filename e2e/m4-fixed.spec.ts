import { expect, test, type Page } from '@playwright/test';
import { DASH_SCREENS, M4_SCREENS, isDash, openM4Screen, type M4Screen } from './m4States';
import { dashViolations, measureDash } from './m4Fixed';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 대시보드(와 엔딩·밀린 화면·오류 화면)의 글자 확대·리플로·고정 요소 규칙 (SPEC-003 CM10·CM11, QM2-3, QM2-12 — M4 마일스톤의 완료 조건). M3의 e2e/m3-text-resize.spec.ts와 같은 방식(e2e/textResize.ts) +
 * 대시보드의 고정 요소 둘(위의 sticky 헤더 `dash-head`, 모바일의 하단 고정 진행 줄 `controls`)이 규칙을 지키는지(e2e/m4Fixed.ts):
 *   - 진행 줄은 고정이면 높이 ≤ 작은 뷰포트 높이의 절반이고, 절반을 넘으면 `bar-released`로 풀려 본문 끝에 놓인다.
 *   - 헤더는 (헤더 높이 + 고정된 진행 줄 높이)가 절반을 넘으면 `head-released`로 풀려 본문과 함께 스크롤된다 — 667×375·320×256 같은 낮은 화면에서 고정 요소 둘이 화면 대부분을 덮지 않는다.
 *   - 진행 줄·도구 줄 버튼 12개는 높이 ≥ 44px, 한가운데에서 그 버튼이 눌리고 화면 안으로 닿는다.
 * (가) 글자 100·125·150·175·200% × 320×568·360×740 × 라이트·다크 × 대시보드 3상태.
 * (나) 브라우저 확대 상당 640×400·512×384·320×256, 접이식 폰 280×653.
 * (다) 공통 뷰포트 11종 × 글자 100·200% × 대시보드 3상태 + 엔딩·밀린 화면·오류 화면(가로 넘침·글자 잘림만 본다 — 고정 요소가 없다).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const PERCENTS = [100, 125, 150, 175, 200] as const;
const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;

async function dashProblems(page: Page, label: string): Promise<{ problems: string[]; headFixed: boolean; barFixed: boolean }> {
  const m = await measureDash(page);
  return { problems: dashViolations(m, label), headFixed: m.head !== null && ['fixed', 'sticky'].includes(m.head.position), barFixed: m.bar !== null && ['fixed', 'sticky'].includes(m.bar.position) };
}

async function systemProblems(page: Page, label: string): Promise<string[]> {
  return textResizeViolations(await measureTextResize(page), label);
}

for (const size of SIZES) {
  test.describe(`M4 글자 확대 ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    for (const scheme of ['light', 'dark'] as const) {
      for (const percent of PERCENTS) {
        for (const screen of DASH_SCREENS) {
          test(`(가) ${size.width}x${size.height} · 글자 ${percent}% · ${scheme} · ${screen}: 가로 넘침 0px·글자 잘림 0·고정 헤더/진행 줄 규칙·버튼 ≥ 44px`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
            test.setTimeout(60_000);
            await page.emulateMedia({ colorScheme: scheme });
            await openM4Screen(page, screen);
            await setRootFontPercent(page, percent);
            const r = await dashProblems(page, `${size.width}x${size.height}/${percent}%/${scheme}/${screen}`);
            expect(r.problems).toEqual([]);
            testInfo.annotations.push({ type: 'fixed', description: `헤더 ${r.headFixed ? '고정' : '해제'} · 진행 줄 ${r.barFixed ? '고정' : '해제'}` });
          });
        }
      }
    }
  });
}

/** (나) 브라우저 확대 상당 뷰포트 + 접이식 폰 280px */
for (const [name, width, height] of [
  ['1280 창의 200% = 640x400', 640, 400],
  ['1024 창의 200% = 512x384', 512, 384],
  ['1280 창의 400% = 320x256', 320, 256],
  ['접이식 폰 280x653 (글자 100%)', 280, 653],
] as const) {
  test.describe(`M4 리플로 ${name}`, () => {
    test.use({ viewport: { width, height } });
    for (const screen of DASH_SCREENS) {
      test(`(나) ${name} · ${screen}: 가로 넘침 0px·글자 잘림 0, 고정 헤더/진행 줄 규칙(합이 절반을 넘으면 풀림), 버튼이 눌리고 화면에 닿는다`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(60_000);
        await openM4Screen(page, screen);
        const r = await dashProblems(page, `${width}x${height}/${screen}`);
        expect(r.problems).toEqual([]);
        testInfo.annotations.push({ type: 'fixed', description: `${screen}: 헤더 ${r.headFixed ? '고정' : '해제'} · 진행 줄 ${r.barFixed ? '고정' : '해제'}` });
      });
    }
  });
}

// ---------- 공통 뷰포트 11종 × 글자 100·200% ----------

const FIXED_SEEN = new Map<string, string>();

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M4 고정 요소 규칙 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of [100, 200] as const) {
      for (const screen of M4_SCREENS) {
        test(`${vp.name} · 글자 ${percent}% · ${screen}: ${isDash(screen) ? '헤더·진행 줄이 「합이 절반 이하면 고정, 넘으면 해제」를 지키고 ' : ''}가로 넘침 0·글자 잘림 0 (CM10·CM11·QM2-12)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          test.setTimeout(60_000);
          await openM4Screen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const label = `${vp.name}/${percent}%/${screen}`;
          if (isDash(screen as M4Screen)) {
            const r = await dashProblems(page, label);
            expect(r.problems).toEqual([]);
            FIXED_SEEN.set(label, `헤더 ${r.headFixed ? '고정' : '해제'} · 진행 줄 ${r.barFixed ? '고정' : '해제'}`);
            testInfo.annotations.push({ type: 'fixed', description: FIXED_SEEN.get(label)! });
          } else {
            expect(await systemProblems(page, label)).toEqual([]);
          }
        });
      }
    }
  });
}

test.describe('M4 고정 해제가 실제로 일어나는 곳 (공허 통과 방지)', () => {
  // 규칙 검사가 늘 「고정」만 보고 통과하지 않도록, 낮은 화면·큰 글자에서 헤더·진행 줄 해제가 관측되는지 직접 본다
  test('667x375 가로: 헤더(약 95px) + 고정 진행 줄(약 112px)이 화면의 절반(187px)을 넘어 헤더가 풀리고 진행 줄은 고정이다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 667, height: 375 });
    await openM4Screen(page, 'dash-infant');
    const m = await measureDash(page);
    expect(m.head!.height + m.bar!.height, '헤더 + 진행 줄').toBeGreaterThan(375 * 0.5);
    expect(m.head!.releasedClass, '헤더가 풀렸다').toBe(true);
    expect(m.head!.position).toBe('static');
    expect(m.bar!.position, '진행 줄은 절반 이하라 고정').toBe('fixed');
    testInfo.annotations.push({ type: '측정', description: `헤더 ${Math.round(m.head!.height)}px + 진행 줄 ${Math.round(m.bar!.height)}px / 화면 375px` });
  });

  test('320x256 (1280 창의 400%) 글자 100%: 진행 줄(약 112px)은 절반(128px) 이하라 고정이고 헤더는 합이 절반을 넘어 풀린다. 글자 200%에서는 진행 줄도 절반을 넘어 풀린다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 256 });
    await openM4Screen(page, 'dash-infant');
    const normal = await measureDash(page);
    expect(normal.bar!.ratio, '진행 줄은 절반 이하').toBeLessThanOrEqual(0.5);
    expect(normal.bar!.position).toBe('fixed');
    expect(normal.head!.height + normal.bar!.height, '헤더 + 진행 줄').toBeGreaterThan(256 * 0.5);
    expect(normal.head!.releasedClass, '헤더가 풀렸다').toBe(true);
    expect(normal.head!.position).toBe('static');
    await setRootFontPercent(page, 200);
    const big = await measureDash(page);
    expect(big.bar!.ratio).toBeGreaterThan(0.5);
    expect(big.bar!.releasedClass, '진행 줄이 풀렸다').toBe(true);
    expect(big.bar!.position).toBe('static');
    expect(big.head!.position, '헤더도 본문과 함께 스크롤된다').toBe('static');
    testInfo.annotations.push({ type: '측정', description: `글자 100%: 헤더 ${Math.round(normal.head!.height)}px + 진행 줄 ${Math.round(normal.bar!.height)}px / 256px → 글자 200%: 진행 줄 ${Math.round(big.bar!.height)}px (${(big.bar!.ratio * 100).toFixed(0)}%)` });
  });

  test('360x740 글자 100%: 둘 다 고정이고 본문이 설 자리가 절반 이상 남는다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 360, height: 740 });
    await openM4Screen(page, 'dash-decision');
    const m = await measureDash(page);
    expect(m.head!.position).toBe('sticky');
    expect(m.bar!.position).toBe('fixed');
    expect(m.vh - m.head!.height - m.bar!.height, '본문이 설 자리').toBeGreaterThan(m.vh * 0.5);
  });
});

test('고정 요소 자동 수집: 대시보드를 열면 sticky 헤더(dash-head)와 하단 고정 진행 줄(controls)이 고정 요소로 잡히고, 풀린 요소는 잡히지 않는다 (CM10)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  const fixedNames = () =>
    page.evaluate(() =>
      [...document.body.querySelectorAll('*')]
        .filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position) && el.getBoundingClientRect().height > 0)
        .map((el) => el.getAttribute('data-testid') ?? el.tagName),
    );
  await page.setViewportSize({ width: 360, height: 740 });
  await openM4Screen(page, 'dash-infant');
  expect(await fixedNames()).toEqual(expect.arrayContaining(['dash-head', 'controls']));
  await page.setViewportSize({ width: 320, height: 256 });
  await setRootFontPercent(page, 200); // 진행 줄이 절반을 넘어 풀리는 크기
  await measureDash(page);
  const names = await fixedNames();
  expect(names, '풀린 진행 줄·헤더는 고정 요소가 아니다').not.toContain('controls');
});
