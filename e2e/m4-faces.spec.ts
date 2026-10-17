import { expect, test, type Page } from '@playwright/test';
import { openM4Screen } from './m4States';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 얼굴 타일의 크기 (SPEC-003 DS4, R-320·R-329 / REV-003-M4-1):
 *  - 엔딩의 얼굴은 **1:1 정사각 96px**이다. 예전 `.ending__head > div { flex: 1 1 9rem }`이 얼굴 타일(div.face)까지 골라 `.face { flex: none }`을 이기고 정사각을 가로로 늘렸다
 *    (360px에서 약 155×96, 1280px에서 약 358×97 — 시안은 정사각이었다). 이제 늘어나는 것은 이름 칸(.ending__who)뿐이다.
 *  - 프로필 카드의 얼굴도 시안 `face--lg`대로 96px다(72px에서는 50세 중년이 청년과 거의 구별되지 않았다).
 * 조합: 공통 뷰포트 11종 × 글자 100·200%. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface FaceBox {
  width: number;
  height: number;
  right: number;
  left: number;
  vw: number;
  /** 얼굴 안쪽 svg의 크기(상자를 채운다) */
  svgWidth: number;
  svgHeight: number;
}

async function faceBox(page: Page, scope: string): Promise<FaceBox> {
  return page.evaluate((s) => {
    const face = document.querySelector(`${s} [data-testid="face"]`) as HTMLElement | null;
    if (face === null) throw new Error(`얼굴 타일이 없다: ${s}`);
    const r = face.getBoundingClientRect();
    const svg = face.querySelector('svg')!.getBoundingClientRect();
    return { width: r.width, height: r.height, left: r.left, right: r.right, vw: document.documentElement.clientWidth, svgWidth: svg.width, svgHeight: svg.height };
  }, scope);
}

function faceProblems(b: FaceBox, label: string): string[] {
  const out: string[] = [];
  // 테두리 1px를 포함한 상자라 96 안팎이다(box-sizing이 content-box여도 border-box여도 96px 한 변). 허용 오차 0.5px
  if (Math.abs(b.width - 96) > 0.5) out.push(`${label}: 얼굴 폭 ${b.width.toFixed(1)}px (기대 96px)`);
  if (Math.abs(b.height - 96) > 0.5) out.push(`${label}: 얼굴 높이 ${b.height.toFixed(1)}px (기대 96px)`);
  if (Math.abs(b.width - b.height) > 0.5) out.push(`${label}: 정사각이 아니다 ${b.width.toFixed(1)}×${b.height.toFixed(1)}`);
  if (b.left < -0.5 || b.right > b.vw + 0.5) out.push(`${label}: 얼굴이 화면 밖 (${b.left.toFixed(0)}~${b.right.toFixed(0)} / ${b.vw})`);
  if (Math.abs(b.svgWidth - b.svgHeight) > 0.5) out.push(`${label}: 얼굴 그림이 정사각이 아니다 ${b.svgWidth.toFixed(1)}×${b.svgHeight.toFixed(1)}`);
  return out;
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`얼굴 타일 크기 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    test(`${vp.name} · 글자 100·200% · 엔딩의 얼굴은 1:1 정사각 96px이고 이름 칸은 얼굴과 겹치지 않는다 (R-320)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(90_000);
      await openM4Screen(page, 'ending');
      const problems: string[] = [];
      for (const percent of [100, 200] as const) {
        if (percent !== 100) await setRootFontPercent(page, percent);
        problems.push(...faceProblems(await faceBox(page, '[data-testid="ending-screen"]'), `${vp.name}/${percent}%/엔딩`));
        // 이름 칸(.ending__who)은 얼굴과 겹치지 않는다: 한 줄이면 얼굴 오른쪽, 좁으면 얼굴 아래
        const overlap = await page.evaluate(() => {
          const face = document.querySelector('[data-testid="ending-screen"] [data-testid="face"]')!.getBoundingClientRect();
          const who = document.querySelector('.ending__who')!.getBoundingClientRect();
          const w = Math.min(face.right, who.right) - Math.max(face.left, who.left);
          const h = Math.min(face.bottom, who.bottom) - Math.max(face.top, who.top);
          return { w, h };
        });
        if (overlap.w > 0.5 && overlap.h > 0.5) problems.push(`${vp.name}/${percent}%: 이름 칸이 얼굴과 ${overlap.w.toFixed(0)}×${overlap.h.toFixed(0)}px 겹친다`);
      }
      expect(problems).toEqual([]);
    });

    test(`${vp.name} · 글자 100·200% · 프로필 카드의 얼굴은 96px 정사각이다 — 영아·성인 (R-329)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(90_000);
      const problems: string[] = [];
      for (const screen of ['dash-infant', 'dash-adult'] as const) {
        await openM4Screen(page, screen);
        for (const percent of [100, 200] as const) {
          if (percent !== 100) await setRootFontPercent(page, percent);
          problems.push(...faceProblems(await faceBox(page, '[data-testid="profile-card"]'), `${vp.name}/${percent}%/${screen}`));
        }
      }
      expect(problems).toEqual([]);
    });
  });
}

// ---------- 이전 구현 대조 ----------
// 예전 선택자(.ending__head > div { flex: 1 1 9rem })를 되돌리면 같은 측정이 실패한다 — 시험이 실제로 잡는다.

test('이전 구현 대조: 엔딩 머리에 `.ending__head > div { flex: 1 1 9rem }`를 되돌리면 360x740에서 얼굴이 가로로 늘어나 1:1·96px 검사가 실패한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 740 });
  await openM4Screen(page, 'ending');
  expect(faceProblems(await faceBox(page, '[data-testid="ending-screen"]'), '지금'), '지금은 위반 없음').toEqual([]);
  await page.addStyleTag({ content: '.ending__head > div { flex: 1 1 9rem; min-width: min(9rem, 100%); }' });
  const old = await faceBox(page, '[data-testid="ending-screen"]');
  expect(old.width, '예전 규칙에서는 얼굴 폭이 96px을 훌쩍 넘는다').toBeGreaterThan(120);
  expect(faceProblems(old, '예전').length, '예전 규칙은 위반이 난다').toBeGreaterThan(0);
});
