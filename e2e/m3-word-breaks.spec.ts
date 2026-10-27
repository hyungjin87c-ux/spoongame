import { expect, test, type Page } from '@playwright/test';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { describeWordBreak, measureWordBreaks, type WordBreakReport } from './lineBreaks';
import { freezeTime } from './m3States';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';
import { BIRTH_STATE_IDS, PLAIN_STATE_IDS, ROULETTE_RESULT_IDS, isRouletteState, openWordBreakState, type WordBreakStateId } from './wordBreakStates';
import { WORD_BREAK_EXTRAS } from './wordBreakVariants';

/**
 * 낱말 중간 끊김 감사 — 룰렛·출생신고 (SPEC-003 QM3-1, QA-003-M3 M3-L02). 공통 감사기 `measureWordBreaks`(e2e/lineBreaks.ts)로 화면의 **눈에 보이는 모든 글자**를 잰다.
 * 낱말이 한 줄에 놓이지 못하고 중간에서 끊기면 셋으로 나눈다:
 *   intended    코드에 명시한 `<wbr>` 지점(e2e/intendedBreaks.ts의 목록 — 지금 「다이아몬드수저」 하나)에서만 끊긴 것
 *   unavoidable 자연 폭 > 한 줄 전체 + 0.5px라 끊을 수밖에 없는 것(측정으로 판정, 낱말·조합 목록을 손으로 늘리지 않는다)
 *   broken      그 밖의 끊김 = 결함(칸 배치 때문에 끊긴 짧은 낱말)
 * 조합 = `STANDARD_VIEWPORTS` 11종 × 글자 100·150·200% × 상태(룰렛 회전 중 · 결과 5수저 · 움직임 줄이기, 출생신고 표본 7가지 — QA 감사의 12상태 + 움직임 줄이기). 모든 조합에서 `broken = []`이고,
 * 글자 100%에서는 `unavoidable = []`(R-281 유지)이며 `intended`는 목록의 낱말뿐이다. 첫 화면(M2)은 e2e/line-breaks.spec.ts가 같은 감사기로 잰다.
 * 공허 통과 방지: 상태마다 잰 낱말 수가 하한 이상이고 제목·칩·직업 라벨·출처 줄·릴 칸·장소의 낱말이 각각 들어 있다(표본 확인용이지 허용 목록이 아니다).
 * 변조 대조(아래 「측정기 대조」): 어머니·아버지 칸을 반쪽으로 되돌림, 의도된 낱말 목록에서 「다이아몬드수저」를 뺌, 비교 표를 표 칸 안으로 되돌림 — 시험이 실제로 잡는다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const PERCENTS = [100, 150, 200] as const;

/** 잰 낱말이 어느 요소 안에 있는지 센다 (이름 → 선택자) */
const WORD_CATEGORIES = {
  heading: 'h1',
  chip: '.grade',
  job: '[data-testid="birth-mother"], [data-testid="birth-father"]',
  source: '.cmp__source',
  reel: '.reel',
  place: '[data-testid="birth-place"], [data-testid="peer-place"]',
  sentence: '[data-testid="birth-sentence"]',
  foot: '[data-testid="page-foot"]',
  bar: '[data-testid="bottom-bar"]',
} as const;

type Category = keyof typeof WORD_CATEGORIES;

/** 상태마다 잰 낱말 수의 하한(실측: 룰렛 96~100, 지금 세상 출생신고 280~295, 지난·다가올 세상 213~225)과 꼭 들어 있어야 하는 낱말의 종류 */
function expectations(id: WordBreakStateId): { floor: number; categories: readonly Category[] } {
  if (isRouletteState(id)) return { floor: 80, categories: id === 'roulette-reduced' ? ['heading', 'reel', 'bar'] : ['heading', 'chip', 'reel', 'bar'] };
  // 비교 표(와 그 출처 줄 `.cmp__source`)는 SPEC-004 BR5(N20)에서 모든 세대 판에 숨겨졌다 — 표본 전부가 표 없는 서류다(compareRows 0). 하한은 표 없는 표본의 실측(235~240)보다 낮게 둔다
  const base: Category[] = ['heading', 'chip', 'job', 'place', 'sentence', 'foot', 'bar'];
  return { floor: 190, categories: base };
}

interface AuditOutcome {
  problems: string[];
  unavoidable: string[];
  intended: string[];
  report: WordBreakReport;
}

/** 지금 열린 상태를 재고 규칙(결함 0, 글자 100%의 불가피 0, 의도 목록, 하한·종류)을 어긴 것을 모은다 */
async function auditState(page: Page, id: WordBreakStateId, percent: number, label: string): Promise<AuditOutcome> {
  const report = await measureWordBreaks(page, { categories: WORD_CATEGORIES });
  const problems: string[] = [];
  for (const b of report.broken) problems.push(`${label}: 끊긴 낱말(결함) ${describeWordBreak(b)}`);
  if (percent === 100) for (const u of report.unavoidable) problems.push(`${label}: 글자 100%인데 한 줄보다 긴 낱말 ${describeWordBreak(u)}`);
  for (const i of report.intended) if (!INTENDED_BREAK_WORDS.includes(i.word)) problems.push(`${label}: 의도 목록 밖 낱말이 intended로 셈 ${describeWordBreak(i)}`);
  // 강제 줄바꿈 `<br>`(R-300): 룰렛·출생신고에는 `<br>`가 하나도 없다 — 생기면 등록(FORCED_BREAKS)과 함께 이 단언을 바꿔야 한다
  for (const f of report.forced) problems.push(`${label}: 룰렛·출생신고에는 강제 줄바꿈(<br>) 낱말이 없다 ${describeWordBreak(f)}`);
  const { floor, categories } = expectations(id);
  if (report.checked < floor) problems.push(`${label}: 잰 낱말 ${report.checked}개 < 하한 ${floor} (공허 통과)`);
  for (const c of categories) if ((report.categories[c] ?? 0) < 1) problems.push(`${label}: ${c} 낱말을 하나도 못 쟀다 (${WORD_CATEGORIES[c]})`);
  return { problems, unavoidable: report.unavoidable.map(describeWordBreak), intended: report.intended.map(describeWordBreak), report };
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`낱말 끊김 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of PERCENTS) {
      test(`${vp.name} · 글자 ${percent}% · 룰렛 결과 5수저·출생신고 표본 7가지: 끊긴 낱말(결함) 0${percent === 100 ? ', 한 줄보다 긴 낱말 0' : ''}, 의도한 끊김은 <wbr> 목록의 낱말뿐 (QM3-1)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(240_000);
        const problems: string[] = [];
        const unavoidable: string[] = [];
        for (const id of PLAIN_STATE_IDS) {
          await openWordBreakState(page, id);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const out = await auditState(page, id, percent, `${vp.name}/${percent}%/${id}`);
          problems.push(...out.problems);
          unavoidable.push(...out.unavoidable.map((u) => `${id}: ${u}`));
        }
        if (unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: unavoidable.join(' · ') }); // 단언이 아니라 리포트용 기록
        expect(problems).toEqual([]);
      });

      test(`${vp.name} · 글자 ${percent}% · 움직임 줄이기 결과: 끊긴 낱말(결함) 0 (QM3-1)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(120_000);
        await openWordBreakState(page, 'roulette-reduced');
        await expect(page.getByTestId('motion-note')).toBeVisible();
        if (percent !== 100) await setRootFontPercent(page, percent);
        const out = await auditState(page, 'roulette-reduced', percent, `${vp.name}/${percent}%/roulette-reduced`);
        expect(out.problems).toEqual([]);
      });

      test(`${vp.name} · 글자 ${percent}% · 룰렛 회전 중: 끊긴 낱말(결함) 0 — 시간을 멈춰 붙들고 잰다 (QM3-1)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(120_000);
        await openWordBreakState(page, 'roulette-spin');
        if (percent !== 100) await setRootFontPercent(page, percent);
        await freezeTime(page);
        const out = await auditState(page, 'roulette-spin', percent, `${vp.name}/${percent}%/roulette-spin`);
        expect(await page.getByTestId('roulette-screen').getAttribute('data-state'), '측정 중에 연출이 끝나지 않았다').toBe('spinning');
        expect(out.problems).toEqual([]);
      });
    }
  });
}

// ---------- QA가 찾은 낱말의 분류 (QM3-1 (g)) ----------
// 「정해졌습니다」(제목)는 e2e/m3-title-cap.spec.ts, 「단순노무직」·「서비스직」은 위 매트릭스(결함 0 + 직업 라벨 낱말이 잰 대상에 들어 있음)가 본다. 여기서는 나머지 넷이 측정으로 갈리는 것을 직접 확인한다.

test.describe('QA의 낱말 분류 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('「다이아몬드수저」: 폭 320 · 글자 100%의 릴 칸에서 끊기는 것은 intended(<wbr> 지점)다 — 결함도 불가피도 아니다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    await openWordBreakState(page, 'roulette-result-5');
    const r = await measureWordBreaks(page);
    const dia = r.intended.filter((i) => i.word === '다이아몬드수저');
    expect(dia.length, `intended ${r.intended.map(describeWordBreak).join(' / ')}`).toBeGreaterThanOrEqual(1);
    expect(dia[0].where).toBe('reel-wealth');
    expect(dia[0].natural, '한 줄 전체(두 릴 전체 폭)보다 짧다 — 목록에 없었다면 결함이다').toBeLessThanOrEqual(dia[0].line);
    expect(r.broken).toEqual([]);
    expect(r.unavoidable).toEqual([]);
  });

  test('「제주특별자치도」(폭 320 · 글자 200%, 서류 서술문): 자연 폭이 한 줄 전체보다 길어 unavoidable이다 — 결함이 아니다(측정이 가른다)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    await openWordBreakState(page, 'birth-labor-jeju');
    await setRootFontPercent(page, 200);
    const r = await measureWordBreaks(page);
    const jeju = r.unavoidable.filter((u) => u.word.startsWith('제주특별자치도')); // (서술문에서는 조사가 붙은 「제주특별자치도의」가 한 낱말이다)
    expect(jeju.length, `unavoidable ${r.unavoidable.map(describeWordBreak).join(' / ')}`).toBeGreaterThanOrEqual(1);
    for (const u of jeju) expect(u.natural, '자연 폭 > 한 줄 전체').toBeGreaterThan(u.line + 0.5);
    expect(r.broken).toEqual([]);
  });
});

test.describe('QA의 낱말 분류 320x568 (전남광주통합특별시)', () => {
  // (Noto Sans KR로 글꼴이 바뀐 뒤 9글자 낱말의 폭이 줄어 폭 375 · 글자 200%에서는 한 줄에 들어간다 — 같은 상황이 되는 가장 넓은 폭 쪽으로 320을 쓴다)
  test.use({ viewport: { width: 320, height: 568 } });

  test('「전남광주통합특별시」(폭 320 · 글자 200%): 서술문·태어난 곳의 9글자 낱말은 한 줄 전체보다 길어 unavoidable이다 — 목록(320·360)이 아니라 측정이 가른다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    await openWordBreakState(page, 'birth-dirt');
    await setRootFontPercent(page, 200);
    const r = await measureWordBreaks(page);
    const honam = r.unavoidable.filter((u) => u.word === '전남광주통합특별시');
    expect(honam.length, `unavoidable ${r.unavoidable.map(describeWordBreak).join(' / ')}`).toBeGreaterThanOrEqual(1);
    for (const u of honam) expect(u.natural, `${u.where}: 자연 폭 > 한 줄 전체`).toBeGreaterThan(u.line + 0.5);
    expect(r.broken).toEqual([]);
  });
});

// (667x375·640x400 비교 표 출처 줄 「초중고사교육비조사」 시험은 SPEC-004 BR5(N20)에서 비교 표가 세대 판에 숨겨져 없앴다)

// ---------- 측정기 대조 (QM3-1 (f)) ----------
// 변조를 일부러 만들어(스타일을 덮어씀) 이 감사가 실제로 그 낱말을 `broken`으로 잡는지 본다. 선택자가 바뀌어 덮어쓰기가 안 먹으면(선택자 썩음) 끊김이 안 생겨 이 시험이 실패한다.
// 파일 변조(실제 CSS·목록을 고쳐 돌린 뒤 `cmp`로 되돌림)는 ai-log dev-M3-r4에 결과를 적었다.

test.describe('측정기 대조: 어머니·아버지 칸을 반쪽으로 되돌리면', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  const HALF_CELLS = '.doc__grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .doc__grid .span-2 { grid-column: span 2 !important; }';
  for (const percent of [200] as const) { // (Noto Sans KR로 폭이 줄어 150%의 반쪽 칸에서는 「단순노무직」이 끊기지 않는다 — 같은 상황이 되는 200%만)
    test(`폭 320 · 글자 ${percent}%: 「단순노무직」(5글자, 한 줄 전체의 절반 가까이)이 broken으로 잡힌다 — 덮어쓰기 전에는 없다`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      await openWordBreakState(page, 'birth-labor-jeju');
      await setRootFontPercent(page, percent);
      expect((await measureWordBreaks(page)).broken, '덮어쓰기 전에는 결함이 없다').toEqual([]);
      await page.addStyleTag({ content: HALF_CELLS });
      const after = await measureWordBreaks(page);
      const words = after.broken.map((b) => b.word);
      expect(words, `broken ${after.broken.map(describeWordBreak).join(' / ')}`).toContain('단순노무직');
      for (const b of after.broken.filter((x) => x.word === '단순노무직')) expect(b.natural, '한 줄 전체보다 짧은데 끊겼다').toBeLessThanOrEqual(b.line);
    });
  }
  test('폭 320 · 글자 200%: 「서비스직」(4글자)도 반쪽 칸에서 broken으로 잡힌다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    await openWordBreakState(page, 'birth-service-sejong');
    await setRootFontPercent(page, 200);
    expect((await measureWordBreaks(page)).broken, '덮어쓰기 전에는 결함이 없다').toEqual([]);
    await page.addStyleTag({ content: HALF_CELLS });
    const after = await measureWordBreaks(page);
    expect(after.broken.map((b) => b.word), `broken ${after.broken.map(describeWordBreak).join(' / ')}`).toContain('서비스직');
  });
});

test.describe('측정기 대조: 의도된 낱말 목록에서 「다이아몬드수저」를 빼면', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test('폭 320 · 글자 100%의 릴 칸에서 「다이아몬드수저」가 intended가 아니라 broken으로 잡힌다 (목록 ↔ <wbr> 일치는 tests/wordBreaks.test.ts)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    await openWordBreakState(page, 'roulette-result-5');
    const withList = await measureWordBreaks(page);
    expect(withList.broken, '목록이 있으면 결함이 아니다').toEqual([]);
    expect(withList.intended.map((i) => i.word)).toContain('다이아몬드수저');
    const without = await measureWordBreaks(page, { intended: INTENDED_BREAK_WORDS.filter((w) => w !== '다이아몬드수저') });
    expect(without.intended).toEqual([]);
    const dia = without.broken.filter((b) => b.word === '다이아몬드수저');
    expect(dia.length, `broken ${without.broken.map(describeWordBreak).join(' / ')}`).toBeGreaterThanOrEqual(1);
    expect(dia[0].where).toBe('reel-wealth');
  });
});

// (비교 표를 표 칸 안으로 되돌려 「초중고사교육비조사」가 끊기는 것을 잡던 측정기 대조는 SPEC-004 BR5(N20)에서 비교 표가 세대 판에 숨겨져 없앴다)

// 추가 표본이 의도한 낱말을 담는지(공허 통과 방지)는 tests/m3Variants.test.tsx가 마크업으로 본다 — 여기서는 표본 목록이 비지 않았음만 확인한다.
test('추가 출생신고 표본 둘이 상태 목록에 들어 있다', () => {
  expect(Object.keys(WORD_BREAK_EXTRAS)).toHaveLength(2);
  expect(BIRTH_STATE_IDS, '출생신고 표본 7가지(가장 긴 내용 5 + 추가 2)').toHaveLength(7);
  expect(PLAIN_STATE_IDS.filter((id) => (BIRTH_STATE_IDS as readonly string[]).includes(id))).toHaveLength(7);
  expect(PLAIN_STATE_IDS.filter((id) => id.startsWith('roulette-'))).toEqual([...ROULETTE_RESULT_IDS]);
});
