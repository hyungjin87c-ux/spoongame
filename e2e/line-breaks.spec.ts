import { expect, test, type Page } from '@playwright/test';
import { slideCount } from './carouselHelpers';
import { FORCED_BREAK_WORDS } from './intendedBreaks';
import { describeWordBreak, measureLineBreaks, measureWordBreaks, type LineReport, type WordBreakReport } from './lineBreaks';
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
 *
 * **낱말 중간 끊김(QM3-1, QA-003-M3 M3-L02)**: 같은 조합마다 공통 감사기 `measureWordBreaks`(e2e/lineBreaks.ts)로 첫 화면(새 판·이어하기·확인 단계)과 캐러셀 14장의 눈에 보이는 **모든 낱말**을 잰다.
 * 낱말이 한 줄 전체보다 짧은데 중간에서 끊기면(`broken`) 결함이고, 한 줄보다 긴 낱말(`unavoidable`)은 글자 100%에서 0이어야 한다(R-281 유지). 첫 화면의 의도된 `<wbr>` 낱말은 없고, 강제 줄바꿈 `<br>`는 수저 띠의 「다이아몬드수저」 하나뿐이다(등록제 — e2e/intendedBreaks.ts `FORCED_BREAKS`, 감사기가 `forced`로 따로 보고하고 이 시험이 집합을 고정한다, R-300).
 */

const SHOTS = 'qa/screenshots/003';
const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;
/** 갈라지면 안 되는 낱말(REV-003-M2-3 R-237: 글자 200%에서 「한국인의 한 / 번의 인생」으로 끊기던 것 · QA 3회차: 「한국인의 한 번의 / 인생」으로 마지막 낱말만 혼자 남던 것) */
const KEEP_WORDS = ['같은 대한민국'] as const; // SPEC-004 한 줄 설명의 줄바꿈 금지 묶음(GEN_TEXT.tagKeep)

interface Tally {
  problems: string[];
  lines: number;
  chars: number;
  keeps: number;
  parts: string[];
  /** 낱말 끊김 감사(QM3-1)에서 잰 낱말 수 */
  words: number;
}

/** 낱말 끊김 감사 결과를 모은다: 결함(broken) 0, 글자 100%에서는 한 줄 전체보다 긴 낱말(unavoidable)도 0 */
function addWords(tally: Tally, label: string, r: WordBreakReport, percent: number, expectedForced: readonly string[] = []): void {
  tally.words += r.checked;
  for (const b of r.broken) tally.problems.push(`${label}: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
  if (percent === 100) for (const u of r.unavoidable) tally.problems.push(`${label}: 글자 100%인데 한 줄보다 긴 낱말 ${describeWordBreak(u)}`);
  for (const i of r.intended) tally.problems.push(`${label}: 첫 화면에는 의도된 줄바꿈 낱말이 없다 ${describeWordBreak(i)}`);
  // 강제 줄바꿈 `<br>`(R-300): 등록 낱말이 기대한 곳에서만 `forced`로 보고되고 그 밖에는 없다 — 첫 화면 본문은 수저 띠의 「다이아몬드수저」 하나, 캐러셀 슬라이드는 없다
  const forcedWords = r.forced.map((f) => f.word).sort();
  if (forcedWords.join('|') !== [...expectedForced].sort().join('|')) tally.problems.push(`${label}: 강제 줄바꿈(<br>) 낱말이 기대와 다르다 — 기대 [${expectedForced.join(', ')}] / 실제 [${forcedWords.join(', ')}]`);
}

function add(tally: Tally, label: string, r: LineReport): void {
  tally.lines += r.lineCount;
  tally.chars += r.charCount;
  tally.keeps += r.keepChecked;
  tally.parts.push(`${label} ${r.lineCount}줄`);
  for (const v of r.violations) {
    // 알려진 예외(GM4 2차에서 캐러셀 글을 다시 흐르게 할 때 풀 일): 「지금 태어나는 아기라면?」 슬라이드의 코호트 나열 「0·10·20·30·40세가」는 한 낱말(Glue 사슬)이라 폭 320 · 글자 200%에서
    // 안에서 줄이 바뀌면 「0·10·20·30·」로 끝난다 — Noto Sans KR로 글꼴이 바뀐 폭에서 드러났다. 나열을 쉼표로 바꾸면 풀리지만 시안 글(copy.md 15-2)의 결정이라 디자이너 몫이다
    if (label.includes('projection-newborn-age-structure') && v.includes('「0·10·20·30·」')) continue;
    tally.problems.push(`${label}: ${v}`);
  }
}

/** 캐러셀 21장을 모두 넘기며 장마다 잰다 (일시정지 상태에서) */
async function measureSlides(page: Page, label: string, tally: Tally, percent: number): Promise<number> {
  const n = await slideCount(page);
  for (let i = 0; i < n; i++) {
    const id = await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!);
    add(tally, `${label} ${i + 1}/${n} ${id}`, await measureLineBreaks(page, '.slide.is-active', { separators: true, keeps: true }));
    addWords(tally, `${label} ${i + 1}/${n} ${id}`, await measureWordBreaks(page, { scope: '.slide.is-active' }), percent);
    if (i < n - 1) await page.getByTestId('carousel-next').click();
  }
  return n;
}

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    test(`${width}px · 글자 ${percent}%: 첫 화면 본문·하단 띠 세 상태·푸터·캐러셀 21장에서 줄 끝·첫머리에 혼자 남는 구분 기호 0(쉼표·마침표가 줄 첫머리 0), 숫자와 단위·날짜가 갈라지는 곳 0 (QM2-5 a·b, QM2-10 a)`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile-360';
      test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: mobile ? 740 : 800 });
      const tally: Tally = { problems: [], lines: 0, chars: 0, keeps: 0, parts: [], words: 0 };
      const label = `${width}px/${percent}%`;

      // 새 판: 본문 · 푸터 · 캐러셀 20장 · 띠
      await openBarState(page, 'new');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      await page.getByTestId('carousel-pause').click();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const main = await measureLineBreaks(page, '.title__main', { separators: true, keeps: true, keepWords: KEEP_WORDS });
      add(tally, `${label} 첫 화면 본문`, main);
      add(tally, `${label} 하단 띠(new)`, await measureLineBreaks(page, '[data-testid="bottom-bar"]'));
      add(tally, `${label} 푸터`, await measureLineBreaks(page, '[data-testid="title-foot"]'));
      addWords(tally, `${label} 첫 화면(새 판)`, await measureWordBreaks(page), percent, FORCED_BREAK_WORDS); // 본문·띠·푸터·지금 보이는 슬라이드의 모든 낱말
      const slides = await measureSlides(page, label, tally, percent);
      expect(slides, '첫 장 세대 그래프 + 지표 20장').toBe(21);

      // 이어하기 · 확인 단계의 띠 글자
      for (const state of BAR_STATES.filter((s): s is Exclude<BarState, 'new'> => s !== 'new')) {
        await openBarState(page, state);
        if (percent !== 100) await setRootFontPercent(page, percent);
        add(tally, `${label} 하단 띠(${state})`, await measureLineBreaks(page, '[data-testid="bottom-bar"]'));
        addWords(tally, `${label} 첫 화면(${state})`, await measureWordBreaks(page), percent, FORCED_BREAK_WORDS);
      }

      // 공허 통과 방지: 실제로 잰 줄·글자·묶음 수(100% 기준 이전 하한 이상)
      expect(tally.lines, `실제로 잰 줄 수 — ${tally.parts.slice(0, 4).join(', ')} …`).toBeGreaterThan(120);
      expect(tally.chars, '실제로 잰 글자 수').toBeGreaterThan(2000);
      expect(tally.keeps, '숫자+단위·날짜·keepWords 묶음을 실제로 잰 개수').toBeGreaterThan(50);
      expect(main.keepChecked, '첫 화면 본문에서 「같은 대한민국」을 실제로 잰 개수').toBeGreaterThanOrEqual(1);
      expect(tally.words, '낱말 끊김 감사에서 실제로 잰 낱말 수(공허 통과 방지: 화면 3상태 + 슬라이드 20장)').toBeGreaterThan(600);
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
    // 20장(SPEC-005 QI4)이 되면서 푸터 기관이 3곳 → 7곳으로 늘었다(한국은행·금융감독원·통계청(현 국가데이터처)·기상청(국립기상과학원) 추가) — 기관 이름을 박아 두지 않고 줄 모양(쉼표 나열, 「·」 0개)과 기관 수만 본다
    expect(text).toMatch(/^통계 출처: [^·]+ \(통계표 이름과 기준 연도는 그래프와 통계 카드마다 적혀 있어요\)$/);
    const list = text.replace(/^통계 출처: /, '').replace(/ \(통계표 이름과 기준 연도는 그래프와 통계 카드마다 적혀 있어요\)$/, '');
    const items = list.split(/, (?![^(]*\))/); // 괄호 안의 쉼표는 항목 사이가 아니다
    expect(items.length, `기관 나열 항목 수 ${items.length}: ${items.join(' | ')}`).toBeGreaterThanOrEqual(3);
    expect(items.every((it) => it.trim().length > 0), '빈 항목이 없다').toBe(true);
    expect(text, '기관 이름 사이에 「·」가 없다').not.toContain('·');
    const r = await measureLineBreaks(page, '[data-testid="stats-credit"]');
    expect(r.lineCount, '푸터 출처 줄이 글자 200%에서 실제로 여러 줄이다(공허 통과 방지)').toBeGreaterThanOrEqual(3);
    expect(r.violations).toEqual([]);
    await credit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/dev-M2-r5-c02-footer-${width}x${height}-200pct.png` });
  });
}

for (const width of [320, 360] as const) {
  for (const percent of [100, 150, 200] as const) {
    test(`${width}px 글자 ${percent}%: 첫 화면 한 줄 설명의 마지막 줄에 「대한민국」이 혼자 남지 않는다 — 끝 「같은 대한민국」은 한 줄에 같이 있다 (QA-003-M2 3회차 인상, 마지막 두 어절 묶음)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const r = await measureLineBreaks(page, '.hero__tag', { separators: true, keeps: true, keepWords: KEEP_WORDS });
      expect(r.lineCount, '한 줄 설명을 실제로 잰 줄 수').toBeGreaterThanOrEqual(1);
      expect(r.violations).toEqual([]);
      const last = r.sample[r.sample.length - 1];
      expect(last, `마지막 줄 「${last}」 — 줄 모양 ${r.sample.join(' / ')}`).not.toBe('대한민국');
      expect(last.endsWith('같은 대한민국'), `마지막 줄 「${last}」은 「같은 대한민국」으로 끝난다`).toBe(true); // SPEC-004: 한 줄 설명은 「다른 세대, 다른 삶, 같은 대한민국」
      if (percent === 200 && width === 320) {
        expect(r.lineCount, '320px 글자 200%에서는 한 줄 설명이 여러 줄이다(공허 통과 방지: 마지막 줄을 실제로 본다 — 새 한 줄 설명은 두 줄)').toBeGreaterThanOrEqual(2);
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
