import { expect, test, type Page } from '@playwright/test';
import { openM4Screen, type M4Screen } from './m4States';
import { setRootFontPercent } from './textResize';

/**
 * 새 화면 헤더의 게임명 로고 (SPEC-003 DS1, R-324 / REV-003-M4-1): 룰렛·출생신고(e2e/roulette.spec.ts)처럼 **네 화면(대시보드·엔딩·밀린 화면·오류 화면)** 의 헤더 로고도
 * 워드마크 글자 높이 ≥ 22px · 화면 폭 안 · 이름 있는 이미지(스크린리더가 「수저 게임 로고 …」를 읽는다)임을 잰다. 예전에는 이 화면들이 `toBeVisible()`만 봤다.
 * 조합: 폭 360·320 × 글자 100·200%. 글자 200%에서도 로고는 px 고정(40px)이라 줄어들지 않아야 하고, 헤더가 좁아져도 화면 밖으로 나가지 않아야 한다.
 * 워드마크 글자 높이 = 도형 상자 높이 + 획 굵기(getBoundingClientRect는 획 두께를 빼고 잰다): 눈에 보이는 글자 높이 — e2e/roulette.spec.ts와 같은 식.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface LogoMeasure {
  /** 로고 svg 상자 높이 */
  logo: number;
  /** 워드마크 글자 높이 */
  word: number;
  left: number;
  right: number;
  vw: number;
  role: string | null;
  label: string;
  /** 로고를 품은 헤더 안에 있다 */
  inHeader: boolean;
}

async function measureLogo(page: Page): Promise<LogoMeasure> {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="header-logo"] svg') as SVGSVGElement | null;
    if (svg === null) throw new Error('헤더 로고가 없다');
    const wordmark = svg.querySelector(':scope > g') as SVGGraphicsElement;
    const stroke = parseFloat(getComputedStyle(wordmark).strokeWidth) * (wordmark.getScreenCTM()?.a ?? 0);
    const r = svg.getBoundingClientRect();
    return {
      logo: r.height,
      word: wordmark.getBoundingClientRect().height + stroke,
      left: r.left,
      right: r.right,
      vw: document.documentElement.clientWidth,
      role: svg.getAttribute('role'),
      label: svg.getAttribute('aria-label') ?? '',
      inHeader: svg.closest('header') !== null,
    };
  });
}

const SCREENS: ReadonlyArray<{ id: string; screen: M4Screen }> = [
  { id: '대시보드', screen: 'dash-adult' },
  { id: '엔딩', screen: 'ending' },
  { id: '밀린 화면', screen: 'superseded' },
  { id: '오류 화면', screen: 'error' },
];

for (const width of [360, 320] as const) {
  test.describe(`헤더 로고 ${width}px`, () => {
    test.use({ viewport: { width, height: 740 } });

    test(`${width}px · 글자 100·200% · 대시보드·엔딩·밀린 화면·오류 화면: 헤더 로고의 워드마크 글자 높이 ≥ 22px, 화면 폭 안, 이름 있는 이미지다 (DS1·R-324)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      const problems: string[] = [];
      for (const { id, screen } of SCREENS) {
        await openM4Screen(page, screen);
        await expect(page.getByTestId('header-logo'), `${id}: 헤더 로고`).toBeVisible();
        for (const percent of [100, 200] as const) {
          if (percent !== 100) await setRootFontPercent(page, percent);
          const m = await measureLogo(page);
          const label = `${width}px/${percent}%/${id}`;
          if (m.word < 22) problems.push(`${label}: 워드마크 글자 높이 ${m.word.toFixed(1)}px < 22px`);
          if (m.logo < m.word) problems.push(`${label}: 로고 상자 ${m.logo.toFixed(1)}px < 글자 높이 ${m.word.toFixed(1)}px`);
          if (m.left < -0.5 || m.right > m.vw + 0.5) problems.push(`${label}: 로고가 화면 밖 (${m.left.toFixed(0)}~${m.right.toFixed(0)} / ${m.vw})`);
          if (m.role !== 'img') problems.push(`${label}: 로고 role=${m.role} (img여야 이름 있는 이미지다)`);
          if (!m.label.includes('수저 게임')) problems.push(`${label}: 접근 가능한 이름에 게임명이 없다 「${m.label}」`);
          if (!m.inHeader) problems.push(`${label}: 로고가 헤더(<header>) 안에 있지 않다`);
        }
      }
      expect(problems).toEqual([]);
    });
  });
}

test('이전 구현 대조: 로고 높이를 줄이면(--logo-h-header 28px) 워드마크 글자 높이가 22px 아래로 떨어져 검사가 실패한다 — 시험이 실제로 잡는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 740 });
  await openM4Screen(page, 'ending');
  expect((await measureLogo(page)).word, '지금').toBeGreaterThanOrEqual(22);
  await page.addStyleTag({ content: ':root { --logo-h-header: 28px !important; }' });
  expect((await measureLogo(page)).word, '로고를 28px로 줄이면').toBeLessThan(22);
});
