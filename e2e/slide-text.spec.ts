import { expect, test } from '@playwright/test';
import { slideCount } from './carouselHelpers';
import { checkSlideDom, collectSlideDom, fetchExpected, type SlideDom } from './slideText';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 캐러셀 14장의 **화면 글자**를 같은 금지 패턴·형식표로 판정한다 (SPEC-003 QM2-4 완료 기준 c, QM2-11 완료 기준 c, REV-003-M2-3 R-230·R-231).
 * 단위 테스트(tests/carousel.test.ts)는 모델의 글자를 보지만 실제 화면이 그 글자를 그리는지는 DOM으로만 안다 — 범례가 그려지는지, 값 줄 아래 줄이 그려지는지,
 * 폭·글자 크기에 따라 기준 줄이 나뉘어도 형식이 지켜지는지. 폭 320·360·1280 × 글자 100·200%에서 14장 전부, 눈에 보이는 글자(e2e/slideText.ts: 계산된 display·visibility·opacity가 보이고
 * 글자 상자 폭·높이 > 0, `.sr-only`·대체 텍스트 제외)를 모아 판정한다:
 *   · 금지 패턴 0(「명당 명」·같은 단위 연속) · 형식표 A·B·C·D · 기준 연도가 한 값 · **제목에 이름이 든 지표의 값이 눈에 보이는 글자에 있다**(혼인 건수 슬라이드의 「조혼인율 인구 1천 명당 4.7건」) · 가로 넘침·글자 잘림 0.
 * 이전 구현에서 실패함을 확인했다 — 혼인 건수 슬라이드에 조혼인율 값이 없던 때(QA-003-M2 M2-C03, R-230). 결과는 ai-log 「변이 점검」.
 */

const SHOTS = 'qa/screenshots/003';
const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 200] as const;

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    test(`${width}px · 글자 ${percent}%: 14장 전부 화면 글자가 금지 패턴 0·형식표 A~D·기준 연도 한 값이고, 제목에 이름이 든 지표의 값이 눈에 보인다 (QM2-4 c, QM2-11 c)`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile-360';
      test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: mobile ? 740 : 800 });
      await page.goto('/');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      await page.getByTestId('carousel-pause').click();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const expected = await fetchExpected(page);
      const n = await slideCount(page);
      expect(n).toBe(14);
      expect(expected).toHaveLength(14);

      const label = `${width}px/${percent}%`;
      const problems: string[] = [];
      const doms: SlideDom[] = [];
      let titleChecked = 0;
      let sideChecked = 0;
      for (let i = 0; i < n; i++) {
        const dom = await collectSlideDom(page);
        doms.push(dom);
        const exp = expected[i];
        expect(dom.id, `${i + 1}번째 슬라이드`).toBe(exp.id);
        problems.push(...checkSlideDom(dom, exp, label));
        titleChecked += exp.titleIndicators.length;
        sideChecked += exp.sideTexts.length;
        // 가로 넘침 0px·글자 잘림 0 (QM2-3) — 큰 값 아래 줄(조혼인율)도 잘리지 않는다
        problems.push(...textResizeViolations(await measureTextResize(page), `${label} ${dom.id}`));
        if (i < n - 1) await page.getByTestId('carousel-next').click();
      }
      expect(problems).toEqual([]);

      // 공허 통과 방지: 검사한 (슬라이드, 지표) 쌍이 14 이상이고 조혼인율이 들어 있다, 화면이 실제로 글자를 모았다
      expect(titleChecked, '제목에 이름이 든 (슬라이드, 지표) 쌍').toBeGreaterThanOrEqual(14);
      expect(sideChecked, '큰 값 아래 줄(보조 값)').toBeGreaterThanOrEqual(1);
      expect(doms.reduce((sum, d) => sum + d.all.length, 0), '모은 화면 글자 수').toBeGreaterThan(2500);
      expect(expected.flatMap((e) => e.titleIndicators).some((t) => t.name === '조혼인율'), '조혼인율 쌍이 검사 대상에 들어 있다').toBe(true);
      expect(doms.filter((d) => d.chartTexts.length > 0).length, '그래프 글자가 모인 슬라이드').toBe(14);
      // 형식 B(조사망률·자살률): 폭·글자 크기에 따라 기준 줄이 한 줄이거나 두 줄 — 어느 쪽이든 형식을 지킨다
      const basisB = doms.filter((d) => d.id === 'cdr' || d.id === 'suicide-rate').map((d) => d.basisLines.length);
      expect(basisB, '형식 B 두 장').toHaveLength(2);
      if (percent === 200) expect(basisB, '글자 200%에서는 쌍이 두 줄로 나뉜다').toEqual([2, 2]);
      if (percent === 100 && width !== 320) expect(basisB, '글자 100%·폭이 넉넉하면 한 줄이다').toEqual([1, 1]);

      // 혼인 건수 슬라이드: 조혼인율 줄 (QM2-11 b)
      const marriage = doms.find((d) => d.id === 'marriage-count')!;
      expect(marriage.sideLines, '큰 값 아래 줄').toHaveLength(1);
      expect(marriage.sideLines[0].replace(/\s+/g, ' ')).toMatch(/^조혼인율 인구 1천 명당 \d+\.\d건$/);
      expect(marriage.sideLines[0], '데이터 라벨의 괄호 단위를 그대로 쓰지 않는다').not.toContain('(');
      expect(marriage.legend, '조혼인율은 범례(선 무늬)가 아니라 값 줄 아래 줄이다').toEqual([]);
    });
  }
}

for (const width of [320, 360] as const) {
  test(`증거 스크린샷: ${width}px 혼인 건수 슬라이드 — 큰 값 아래 줄에 「조혼인율 인구 1천 명당 4.7건」 (QA-003-M2 M2-C03 재현 상황, 고친 뒤)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('carousel-pause').click();
    for (let i = 0; i < 14; i++) {
      if ((await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id'))) === 'marriage-count') break;
      await page.getByTestId('carousel-next').click();
    }
    const dom = await collectSlideDom(page);
    expect(dom.id).toBe('marriage-count');
    expect(dom.sideLines).toEqual(['조혼인율 인구 1천 명당 4.7건']);
    await page.addStyleTag({ content: '[data-testid="bottom-bar"] { visibility: hidden !important; }' });
    await page.getByTestId('carousel').scrollIntoViewIfNeeded();
    await page.getByTestId('carousel').screenshot({ path: `${SHOTS}/dev-M2-r5-c03-marriage-${width}.png` });
  });
}
