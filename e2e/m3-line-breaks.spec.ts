import { expect, test } from '@playwright/test';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { BIRTH_SCREENS, isBirthScreen, mainSelectorOf, openM3Screen, type M3Screen } from './m3States';
import { BIRTH_VARIANTS } from './m3Variants';
import { setRootFontPercent } from './textResize';

/**
 * 룰렛·출생신고 화면의 줄바꿈 감사 (SPEC-003 QM2-10 a·c, QM2-5): 구분 기호(「·」「/」「—」)와 여는 괄호가 줄 끝에, 구분 기호·닫는 괄호·쉼표·마침표가 줄 첫머리에 혼자 남지 않고,
 * 숫자와 바로 뒤 단위(「17.9%」「3.3kg」 같은 값)·날짜 묶음이 두 줄로 갈라지지 않는다. 화면의 보이는 글자를 글자 단위 Range로 줄로 나눠 본다(e2e/lineBreaks.ts, 첫 화면과 같은 측정기).
 * 표본: **폭 320·360·1280 × 글자 100·150·200%** 아홉 조합 × 화면(룰렛 결과·출생신고 5가지 표본)의 본문과 하단 띠.
 * 출생신고 표본은 가장 긴 내용을 모은 것이다(e2e/m3Variants.ts, REV-003-M3-1 R-262): 흙수저·다이아몬드수저(지금 세상 비교 표), 지난 세상(가장 긴 장소·하단 표기 5줄), 다가올 세상.
 * 장소 낱말(「전남광주통합특별시」「마산합포구」 …)은 **중간에서 끊기지 않아야 한다**(R-269, R-281): 이 감사는 R-281의 장소 낱말 측정을 **공통 낱말 끊김 감사기**(`measureWordBreaks`, QM3-1)로 통합했다 —
 * 화면의 눈에 보이는 모든 낱말을 재고 `broken`(결함)은 0, 글자 100%에서는 한 줄 전체보다 긴 낱말(`unavoidable`)도 0이다. R-281의 「글자 200% × 폭 320·360의 명시 목록」은 측정으로 판정하는 일반 규칙이 대체했다(QM3-1 (a)).
 * 전체 조합(11뷰포트 × 글자 100·150·200% × 12상태)의 감사는 e2e/m3-word-breaks.spec.ts가 한다. 끝의 「측정기 대조」 시험은 회귀를 일부러 만들어 이 측정이 실제로 잡는지 본다.
 * 출생신고는 「A · B」 짧은 쌍(부모 나이·직업, 문서 띠 오른쪽)을 ui/FitPair로 그려, 한 줄에 들어가면 「A · B」, 좁으면 가운뎃점 없이 두 줄로 나눈다(QM2-10 규칙 3).
 */

const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;
const SCREENS: readonly M3Screen[] = ['roulette-result', ...BIRTH_SCREENS];

/** 장소 낱말(태어난 곳·또래 장소)이 잰 대상에 들었는지 세는 선택자 (공허 통과 방지) */
const PLACE_SELECTOR = '[data-testid="birth-place"], [data-testid="peer-place"]';

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const screen of SCREENS) {
      test(`${width}px · 글자 ${percent}% · ${screen}: 본문·하단 띠에서 줄 끝·첫머리에 혼자 남는 구분 기호 0, 숫자와 단위가 갈라지는 곳 0, 장소 낱말이 중간에서 끊기는 곳 0 (QM2-10)`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === 'mobile-360';
        test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: mobile ? 740 : 800 });
        await openM3Screen(page, screen);
        if (percent !== 100) await setRootFontPercent(page, percent);
        const birth = isBirthScreen(screen);
        const rich = birth && BIRTH_VARIANTS[screen].compareRows > 0; // 비교 표가 있는 화면은 줄·숫자 단위가 많다
        const plain = await measureLineBreaks(page, mainSelectorOf(screen), { separators: true, keeps: true });
        const bar = await measureLineBreaks(page, '[data-testid="bottom-bar"]');
        // 공허 통과 방지: 실제로 잰 줄·글자·묶음 수
        expect(plain.lineCount, `본문 줄 수 — ${plain.sample.slice(0, 3).join(' / ')}`).toBeGreaterThan(birth ? (rich ? 25 : 20) : 12);
        expect(plain.charCount, '본문 글자 수').toBeGreaterThan(birth ? (rich ? 500 : 400) : 250);
        expect(plain.keepChecked, '숫자+단위·날짜 묶음을 실제로 잰 개수').toBeGreaterThan(birth ? (rich ? 10 : 6) : 15);
        // 낱말 끊김 (QM3-1): 화면의 눈에 보이는 모든 낱말을 재서 결함(broken) 0, 글자 100%는 한 줄 전체보다 긴 낱말(unavoidable)도 0
        const words = await measureWordBreaks(page, { categories: { place: PLACE_SELECTOR } });
        expect(words.checked, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(birth ? 150 : 60);
        expect(words.broken.map(describeWordBreak), '한 줄 전체보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `글자 100%인 ${width}px에서는 한 줄 전체보다 긴 낱말로 끊기는 곳도 0`).toEqual([]);
        if (words.unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: words.unavoidable.map(describeWordBreak).join(' · ') }); // 단언이 아니라 리포트용 기록
        if (birth) {
          // 장소 낱말: 태어난 곳과 또래 4명의 장소 낱말을 실제로 쟀고(공허 통과 방지), 표본이 가장 긴 낱말을 포함한다
          expect(words.words, '표본이 가장 긴 낱말을 포함한다').toContain(BIRTH_VARIANTS[screen].placeWord);
          expect(words.categories.place, `장소 낱말 수`).toBeGreaterThanOrEqual(10);
        }
        expect(bar.lineCount).toBeGreaterThanOrEqual(1);
        expect([...plain.violations, ...bar.violations]).toEqual([]);
      });
    }
  }
}

// ---------- 측정기 대조 (R-281) ----------
// 감사가 모든 끊김을 삼키는 공허 통과를 막는다: 회귀를 일부러 만들어(스타일을 덮어씀) 이 측정이 실제로 그 낱말을 `broken`으로 잡는지 본다.
// 선택자가 바뀌어 덮어쓰기가 안 먹으면(선택자 썩음) 끊김이 안 생겨 이 시험이 실패한다. (어머니·아버지 칸·`<wbr>` 목록·비교 표 대조는 e2e/m3-word-breaks.spec.ts)

const CONTROLS_BIRTH_PLACE = [
  { width: 320, percent: 100 }, // 반쪽 칸(115px)에 9글자 낱말(144px)
  { width: 1280, percent: 150 }, // 3열 격자의 한 칸(205px)에 9글자 낱말(216px)
] as const;

for (const { width, percent } of CONTROLS_BIRTH_PLACE) {
  test(`측정기 대조: 「태어난 곳」을 한 칸에 넣으면(span-2 해제) ${width}px · 글자 ${percent}%에서 한 줄에 들어갈 낱말이 끊긴 것으로 잡힌다 (R-281)`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-360';
    test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: mobile ? 740 : 800 });
    await openM3Screen(page, 'birth-dirt');
    if (percent !== 100) await setRootFontPercent(page, percent);
    const before = await measureWordBreaks(page);
    expect(before.broken, '덮어쓰기 전에는 끊긴 낱말이 없다').toEqual([]);
    await page.addStyleTag({ content: '.doc__grid .span-2 { grid-column: auto !important; }' });
    const after = await measureWordBreaks(page);
    expect(after.broken.filter((b) => b.where === 'birth-place'), '한 칸에 넣은 「태어난 곳」의 9글자 낱말이 끊김으로 잡힌다').not.toEqual([]);
    expect(after.broken.map(describeWordBreak).join(' / ')).toContain('전남광주통합특별시');
  });
}

test('측정기 대조: 또래 목록의 줄바꿈(flex-wrap)을 끄면 폭 320 · 글자 100%에서 수저 칩에 밀려 끊긴 장소 낱말이 잡힌다 (R-269, R-281)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 740 });
  await openM3Screen(page, 'birth-dirt');
  const before = await measureWordBreaks(page);
  expect(before.broken, '덮어쓰기 전에는 끊긴 낱말이 없다').toEqual([]);
  await page.addStyleTag({ content: '.people li { flex-wrap: nowrap !important; }' });
  const after = await measureWordBreaks(page);
  expect(after.broken.filter((b) => b.where === 'peer-place'), '칩이 폭을 차지해 끊긴 또래 장소 낱말이 끊김으로 잡힌다').not.toEqual([]);
});
