import { expect, test, type Page } from '@playwright/test';
import { slideCount } from './carouselHelpers';
import { measureLineBreaks, type LineReport } from './lineBreaks';
import { setRootFontPercent } from './textResize';
import { BAR_STATES, openBarState, type BarState } from './titleStates';

/**
 * 줄바꿈 감사 (SPEC-003 QM2-5 a·b, QM2-10 a, QA-003-M2 인상·M2-C02): 구분 기호(「·」「/」「—」)와 여는 괄호가 줄 끝에, 구분 기호·닫는 괄호·쉼표·마침표가 줄 첫머리에 혼자 남지 않고,
 * 숫자와 바로 뒤 단위·날짜 묶음(「11월 1일 0시」)이 두 줄로 갈라지지 않는다. 화면의 보이는 글자를 글자 단위 Range로 줄로 나눠 본다(e2e/lineBreaks.ts).
 *
 * 표본(QM2-10 a — QA 감사 135회와 같은 표본 + 띠 상태): **폭 320·360·1280 × 글자 100·150·200%** 아홉 조합마다
 *   첫 화면 본문(로고·한 줄 설명·수저 띠·가상 인구·세상·인생 길이) · 하단 띠의 세 상태(새 판·이어하기·확인 단계) 글자 · 푸터 · 캐러셀 14장.
 * 이 감사는 **구분 기호 단언을 글자 100·150·200% 모두에서 켠다**(r4까지는 150·200%에서 `separators: false`라 글자 200% 푸터의 「· 교육부」를 못 잡았다 — QA-003-M2 2회차 M2-C02).
 * 이전 구현(푸터 기관 목록을 `orgs.join(' · ')`)에서 실패함을 확인했다 — 360×740·글자 200%에서 「· 교육부」로 줄이 시작(ai-log 「변이 점검」).
 * 이어하기·확인 단계는 개발 서버의 ?__exit 탐침으로만 열린다(e2e/titleStates.ts).
 */

const SHOTS = 'qa/screenshots/003';
const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;
/** 갈라지면 안 되는 낱말(REV-003-M2-3 R-237: 글자 200%에서 「한국인의 한 / 번의 인생」으로 끊기던 것 · QA 3회차: 「한국인의 한 번의 / 인생」으로 마지막 낱말만 혼자 남던 것) */
const KEEP_WORDS = ['한 번의', '한 번의 인생'] as const;

interface Tally {
  problems: string[];
  lines: number;
  chars: number;
  keeps: number;
  parts: string[];
}

function add(tally: Tally, label: string, r: LineReport): void {
  tally.lines += r.lineCount;
  tally.chars += r.charCount;
  tally.keeps += r.keepChecked;
  tally.parts.push(`${label} ${r.lineCount}줄`);
  for (const v of r.violations) tally.problems.push(`${label}: ${v}`);
}

/** 캐러셀 14장을 모두 넘기며 장마다 잰다 (일시정지 상태에서) */
async function measureSlides(page: Page, label: string, tally: Tally): Promise<number> {
  const n = await slideCount(page);
  for (let i = 0; i < n; i++) {
    const id = await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!);
    add(tally, `${label} ${i + 1}/${n} ${id}`, await measureLineBreaks(page, '.slide.is-active', { separators: true, keeps: true }));
    if (i < n - 1) await page.getByTestId('carousel-next').click();
  }
  return n;
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    test(`${width}px · 글자 ${percent}%: 첫 화면 본문·하단 띠 세 상태·푸터·캐러셀 14장에서 줄 끝·첫머리에 혼자 남는 구분 기호 0(쉼표·마침표가 줄 첫머리 0), 숫자와 단위·날짜가 갈라지는 곳 0 (QM2-5 a·b, QM2-10 a)`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile-360';
      test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: mobile ? 740 : 800 });
      const tally: Tally = { problems: [], lines: 0, chars: 0, keeps: 0, parts: [] };
      const label = `${width}px/${percent}%`;

      // 새 판: 본문 · 푸터 · 캐러셀 14장 · 띠
      await openBarState(page, 'new');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      await page.getByTestId('carousel-pause').click();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const main = await measureLineBreaks(page, '.title__main', { separators: true, keeps: true, keepWords: KEEP_WORDS });
      add(tally, `${label} 첫 화면 본문`, main);
      add(tally, `${label} 하단 띠(new)`, await measureLineBreaks(page, '[data-testid="bottom-bar"]'));
      add(tally, `${label} 푸터`, await measureLineBreaks(page, '[data-testid="title-foot"]'));
      const slides = await measureSlides(page, label, tally);
      expect(slides).toBe(14);

      // 이어하기 · 확인 단계의 띠 글자
      for (const state of BAR_STATES.filter((s): s is Exclude<BarState, 'new'> => s !== 'new')) {
        await openBarState(page, state);
        if (percent !== 100) await setRootFontPercent(page, percent);
        add(tally, `${label} 하단 띠(${state})`, await measureLineBreaks(page, '[data-testid="bottom-bar"]'));
      }

      // 공허 통과 방지: 실제로 잰 줄·글자·묶음 수(100% 기준 이전 하한 이상)
      expect(tally.lines, `실제로 잰 줄 수 — ${tally.parts.slice(0, 4).join(', ')} …`).toBeGreaterThan(120);
      expect(tally.chars, '실제로 잰 글자 수').toBeGreaterThan(2000);
      expect(tally.keeps, '숫자+단위·날짜·keepWords 묶음을 실제로 잰 개수').toBeGreaterThan(50);
      expect(main.keepChecked, '첫 화면 본문에서 「한 번의」를 실제로 잰 개수').toBeGreaterThanOrEqual(1);
      expect(tally.problems).toEqual([]);
    });
  }
}

for (const [width, height] of [
  [320, 568],
  [360, 740],
] as const) {
  test(`${width}x${height} 글자 200%: 푸터 기관 나열은 쉼표 나열이라 한 줄을 넘어도 「·」가 줄 가장자리에 서지 않고, 줄 첫머리에 쉼표가 오지 않는다 (QM2-10 b 화면)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await setRootFontPercent(page, 200);
    const credit = page.getByTestId('stats-credit');
    const text = (await credit.innerText()).replace(/\s+/g, ' ').trim();
    expect(text).toMatch(/^통계 출처: 국가데이터처, 행정안전부, 교육부 \(통계표 이름과 기준 연도는 카드마다 적혀 있습니다\)$/);
    expect(text, '기관 이름 사이에 「·」가 없다').not.toMatch(/(국가데이터처|행정안전부|교육부)\s*·/);
    const r = await measureLineBreaks(page, '[data-testid="stats-credit"]');
    expect(r.lineCount, '푸터 출처 줄이 글자 200%에서 실제로 여러 줄이다(공허 통과 방지)').toBeGreaterThanOrEqual(3);
    expect(r.violations).toEqual([]);
    await credit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/dev-M2-r5-c02-footer-${width}x${height}-200pct.png` });
  });
}

for (const width of [320, 360] as const) {
  for (const percent of [100, 150, 200] as const) {
    test(`${width}px 글자 ${percent}%: 첫 화면 한 줄 설명의 마지막 줄에 「인생」이 혼자 남지 않는다 — 끝 「한 번의 인생」은 한 줄에 같이 있다 (QA-003-M2 3회차 인상, 마지막 두 어절 묶음)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const r = await measureLineBreaks(page, '.hero__tag', { separators: true, keeps: true, keepWords: KEEP_WORDS });
      expect(r.lineCount, '한 줄 설명을 실제로 잰 줄 수').toBeGreaterThanOrEqual(1);
      expect(r.violations).toEqual([]);
      const last = r.sample[r.sample.length - 1];
      expect(last, `마지막 줄 「${last}」 — 줄 모양 ${r.sample.join(' / ')}`).not.toBe('인생');
      expect(last.endsWith('한 번의 인생'), `마지막 줄 「${last}」은 「한 번의 인생」으로 끝난다`).toBe(true);
      if (percent === 200 && width === 320) {
        expect(r.lineCount, '320px 글자 200%에서는 한 줄 설명이 여러 줄이다(공허 통과 방지: 마지막 줄을 실제로 본다)').toBeGreaterThanOrEqual(3);
        await page.locator('.hero__tag').scrollIntoViewIfNeeded();
        await page.locator('.hero__tag').screenshot({ path: `${SHOTS}/dev-M2-r6-hero-tag-320x740-200pct.png` });
      }
    });
  }
}

test('증거 스크린샷: 320px 혼인 건수 슬라이드(예전에는 「240,326 건 ·」 뒤 기준 연도가 다음 줄로 밀려 점이 혼자 남던 곳)와 고령인구 비율 슬라이드(「(11월 1일 0시 기준」)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.getByTestId('carousel-pause').click();
  await page.addStyleTag({ content: '[data-testid="bottom-bar"] { visibility: hidden !important; }' });
  for (const [id, file] of [
    ['marriage-count', 'dev-M2-r4-qm25-marriage-count-320.png'],
    ['aging-rate', 'dev-M2-r4-qm25-aging-rate-320.png'],
    ['suicide-rate', 'dev-M2-r4-qm24-suicide-rate-320.png'],
  ] as const) {
    for (let i = 0; i < 14; i++) {
      if ((await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id'))) === id) break;
      await page.getByTestId('carousel-next').click();
    }
    await page.waitForTimeout(350);
    await page.getByTestId('carousel').scrollIntoViewIfNeeded();
    await page.getByTestId('carousel').screenshot({ path: `${SHOTS}/${file}` });
    const r = await measureLineBreaks(page, '.slide.is-active');
    expect(r.violations, id).toEqual([]);
  }
});
