import { expect, test } from '@playwright/test';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { M4_SCREENS, isDash, openM4Screen, type M4Screen } from './m4States';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 대시보드·엔딩·밀린 화면·오류 화면의 줄바꿈·낱말 끊김 감사 (SPEC-003 QM2-10 a·c, QM2-5, QM3-1 — M4 마일스톤의 완료 조건). 첫 화면(e2e/line-breaks.spec.ts)·룰렛·출생신고(e2e/m3-line-breaks.spec.ts,
 * e2e/m3-word-breaks.spec.ts)와 같은 공통 측정기(e2e/lineBreaks.ts)를 새 화면에 적용한다.
 *  (a) 줄바꿈: 구분 기호(「·」「/」「—」)와 여는 괄호가 줄 끝에, 구분 기호·닫는 괄호·쉼표·마침표가 줄 첫머리에 혼자 남지 않고, 숫자와 바로 뒤 단위(「17.9%」「3.3kg」)·날짜 묶음이 두 줄로 갈라지지 않는다.
 *  (b) 낱말 끊김: 눈에 보이는 모든 낱말이 한 줄에 놓이지 못하고 중간에서 끊기는 것은 코드에 명시한 `<wbr>` 지점(「다이아몬드수저」)뿐이고(intended), 한 줄 전체보다 긴 낱말은 끊을 수밖에 없다(unavoidable — 글자 100%에서는 0),
 *      그 밖의 끊김(broken)은 결함이다. 강제 `<br>` 낱말(forced)은 이 화면들에 없다.
 * 조합: **폭 320·360·1280 × 글자 100·150·200% × 화면 8가지**(대시보드 영아·결정 카드·성인·**나가기 확인 단계가 열린 상태**·**도구 줄이 열린 상태**(R-322) / 엔딩 / 밀린 화면 / 오류 화면). 전체 11뷰포트의 낱말 끊김 감사는 아래 마지막 블록이 한다.
 * 인생 기록의 줄 문장·엔딩 연표는 이벤트 데이터가 정하는 글이다(어체·문구 개편은 M7e) — 구분 기호가 줄 끝에 남는 일이 문장 안에서 생기면 이 감사가 잡아 데이터나 묶음(Glue)을 고치게 한다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다(1280 폭은 desktop 프로젝트).
 */

const WIDTHS = [320, 360, 1280] as const;
const PERCENTS = [100, 150, 200] as const;

/** 줄바꿈 감사 범위: 화면 전체 */
function scopeOf(screen: M4Screen): string {
  switch (screen) {
    case 'ending':
      return '[data-testid="ending-screen"]';
    case 'superseded':
      return '[data-testid="superseded-screen"]';
    case 'error':
      return '[data-testid="error-screen"]';
    default:
      return '[data-testid="life-screen"]';
  }
}

/** 화면마다 잰 글자 수·낱말 수의 하한(공허 통과 방지) — 처음 잰 값(관측)의 절반쯤으로 잡았다 */
const FLOORS: Record<M4Screen, { chars: number; words: number; lines: number }> = {
  'dash-infant': { chars: 120, words: 30, lines: 15 },
  'dash-decision': { chars: 160, words: 40, lines: 20 },
  'dash-adult': { chars: 200, words: 50, lines: 25 },
  // 확인 단계(R-322·R-336)·도구 줄이 열린 상태(R-322): 성인 대시보드와 같은 틀이라 하한도 같다(확인 단계의 안내문·버튼 이름이 더해진다)
  'dash-exit-ask': { chars: 220, words: 55, lines: 27 },
  'dash-tools-open': { chars: 200, words: 50, lines: 25 },
  ending: { chars: 120, words: 30, lines: 10 },
  superseded: { chars: 100, words: 20, lines: 5 },
  error: { chars: 20, words: 5, lines: 2 },
};

for (const width of WIDTHS) {
  for (const percent of PERCENTS) {
    for (const screen of M4_SCREENS) {
      test(`${width}px · 글자 ${percent}% · ${screen}: 줄 끝·첫머리에 혼자 남는 구분 기호 0, 숫자와 단위가 갈라지는 곳 0, 끊긴 낱말(결함) 0 (QM2-10·QM3-1)`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === 'mobile-360';
        test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: mobile ? 740 : 800 });
        await openM4Screen(page, screen);
        if (percent !== 100) await setRootFontPercent(page, percent);
        const floor = FLOORS[screen];
        const plain = await measureLineBreaks(page, scopeOf(screen), { separators: true, keeps: true });
        expect(plain.charCount, `글자 수 — ${plain.sample.slice(0, 3).join(' / ')}`).toBeGreaterThan(floor.chars);
        expect(plain.lineCount, '줄 수').toBeGreaterThan(floor.lines);
        expect(plain.violations).toEqual([]);
        const words = await measureWordBreaks(page, { scope: scopeOf(screen) });
        expect(words.checked, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(floor.words);
        expect(words.broken.map(describeWordBreak), '한 줄 전체보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `글자 100%인 ${width}px에서는 한 줄 전체보다 긴 낱말로 끊기는 곳도 0`).toEqual([]);
        for (const i of words.intended) expect(INTENDED_BREAK_WORDS, `의도 목록 밖 낱말이 intended로 셈: ${describeWordBreak(i)}`).toContain(i.word);
        expect(words.forced.map(describeWordBreak), '이 화면들에는 강제 줄바꿈(<br>) 낱말이 없다').toEqual([]);
        if (words.unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: words.unavoidable.map(describeWordBreak).join(' · ') });
      });
    }
  }
}

// ---------- 공통 뷰포트 11종 × 글자 100·150·200% 낱말 끊김 감사 (QM3-1) ----------

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M4 낱말 끊김 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of PERCENTS) {
      test(`${vp.name} · 글자 ${percent}% · 대시보드 3상태·엔딩·밀린 화면·오류 화면: 끊긴 낱말(결함) 0${percent === 100 ? ', 한 줄보다 긴 낱말 0' : ''}, 의도한 끊김은 <wbr> 목록의 낱말뿐 (QM3-1)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(180_000);
        const problems: string[] = [];
        let totalWords = 0;
        for (const screen of M4_SCREENS) {
          await openM4Screen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const words = await measureWordBreaks(page, { scope: scopeOf(screen) });
          totalWords += words.checked;
          const label = `${vp.name}/${percent}%/${screen}`;
          for (const b of words.broken) problems.push(`${label}: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
          if (percent === 100) for (const u of words.unavoidable) problems.push(`${label}: 글자 100%인데 한 줄보다 긴 낱말 ${describeWordBreak(u)}`);
          for (const i of words.intended) if (!INTENDED_BREAK_WORDS.includes(i.word)) problems.push(`${label}: 의도 목록 밖 낱말이 intended로 셈 ${describeWordBreak(i)}`);
          for (const f of words.forced) problems.push(`${label}: 이 화면들에는 강제 줄바꿈(<br>) 낱말이 없다 ${describeWordBreak(f)}`);
          if (isDash(screen)) expect(words.checked, `${label}: 잰 낱말 수`).toBeGreaterThan(FLOORS[screen].words);
        }
        expect(totalWords, '여섯 화면에서 잰 낱말 수').toBeGreaterThan(200);
        expect(problems).toEqual([]);
      });
    }
  });
}

// ---------- 측정기 대조 ----------
// 감사가 모든 끊김을 삼키는 공허 통과를 막는다: 회귀를 일부러 만들어 이 측정이 실제로 잡는지 본다.

test('측정기 대조: 인생 기록 줄 텍스트를 한 글자 폭으로 줄이면(overflow-wrap: anywhere) 낱말이 중간에서 끊겨 broken으로 잡힌다 (대시보드)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await openM4Screen(page, 'dash-adult');
  const before = await measureWordBreaks(page, { scope: '[data-testid="life-screen"]' });
  expect(before.broken, '덮어쓰기 전에는 끊긴 낱말이 없다').toEqual([]);
  // 로그 문장 칸을 아주 좁게 만들어 한 줄에 들어갈 낱말이 중간에서 끊기게 한다. 기록 줄은 flex-wrap이라(격자가 아니다) 문장 칸의 flex를 3.2rem으로 못 박는다
  await page.addStyleTag({ content: '.log__row { flex-wrap: nowrap !important; } .log__text { flex: 0 0 3.2rem !important; min-width: 0 !important; overflow-wrap: anywhere !important; word-break: break-all !important; }' });
  const after = await measureWordBreaks(page, { scope: '[data-testid="life-screen"]' });
  expect(after.broken.length + after.unavoidable.length, '일부러 만든 끊김이 잡힌다').toBeGreaterThan(0);
});

test('측정기 대조: 「다이아몬드수저」 칩에서 <wbr> 목록을 비우면 좁은 폭에서 끊긴 낱말이 intended가 아니라 broken으로 센다 (대시보드 프로필·또래) — 다이아몬드수저 칩이 반드시 있는 판으로 연다 (R-332)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 740 });
  // 시드 777의 판은 다이아몬드수저가 0이라 예전 시험은 늘 else 갈래로 공허하게 통과했다 — 프로필의 출신 가정을 다이아몬드수저(5단계)로 고정해 칩이 반드시 있다
  await openM4Screen(page, 'dash-diamond');
  await expect(page.getByTestId('profile-home').locator('[data-grade="5"]'), '프로필 출신 가정이 다이아몬드수저 칩').toHaveCount(1);
  await setRootFontPercent(page, 200);
  const withList = await measureWordBreaks(page, { scope: '[data-testid="life-screen"]' });
  const without = await measureWordBreaks(page, { scope: '[data-testid="life-screen"]', intended: [] });
  const dia = withList.intended.filter((i) => i.word === '다이아몬드수저');
  expect(dia.length, '글자 200% · 폭 320에서 다이아몬드수저 칩이 <wbr> 자리에서 실제로 갈렸다(공허 통과 방지)').toBeGreaterThan(0);
  expect(without.broken.map((b) => b.word), '목록을 비우면 같은 끊김이 결함으로 센다').toContain('다이아몬드수저');
  expect(withList.broken.map((b) => b.word), '목록이 있으면 결함이 아니다').not.toContain('다이아몬드수저');
});
