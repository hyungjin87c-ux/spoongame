import { describe, expect, it } from 'vitest';
import { SLIDE_FORMS, forbiddenIn } from '../e2e/carouselForms';
import { checkSlideDom, type ExpectedSlide, type SlideDom } from '../e2e/slideText';
import { buildCarousel } from '../src/core';

/**
 * 화면 DOM 글자 판정기(e2e/slideText.ts#checkSlideDom)가 실제로 잡는지 직접 만든 DOM 측정값으로 본다 — 판정기가 아무것도 못 잡으면 e2e/slide-text.spec.ts(20장 × 폭 3 × 글자 2)가 의미가 없다.
 * 이 e2e는 단위 테스트(tests/carousel.test.ts: 모델의 글자)가 못 보는 「화면이 그 글자를 실제로 그리는가」를 본다(REV-003-M2-3 R-231, SPEC-003 QM2-4 c·QM2-11 c).
 */

const marriage: SlideDom = {
  id: 'marriage-count',
  insight: '한 해에 몇 쌍이 결혼할까?',
  official: '혼인 건수·조혼인율(2025년)',
  captions: [],
  valueLines: [{ label: null, text: '240,326건', unit: '건' }],
  sideLines: ['조혼인율 인구 1천 명당 4.7건'],
  basisLines: [],
  statLines: ['통계 기준: 2025년 · 마지막 갱신 2026-10-15'],
  legend: [],
  metas: ['혼인 건수(건, 혼인신고 기준)', '출처: 국가데이터처, KOSIS 혼인건수, 조혼인율 (2026-10-15 조회)'],
  definition: '혼인 건수는 혼인신고 기준(신고월 기준)으로 집계한 값이고, 조혼인율은 인구 1천 명당 혼인 건수입니다.',
  chartTexts: ['1970', '2025', '240,326', '295,137'],
  all: '한 해에 몇 쌍이 결혼할까?\n혼인 건수·조혼인율(2025년)\n240,326건\n조혼인율 인구 1천 명당 4.7건\n1970\n2025\n240,326\n295,137\n혼인 건수(건, 혼인신고 기준)\n혼인 건수는 혼인신고 기준(신고월 기준)으로 집계한 값이고, 조혼인율은 인구 1천 명당 혼인 건수입니다.\n통계 기준: 2025년 · 마지막 갱신 2026-10-15',
};
const marriageExpected: ExpectedSlide = {
  id: 'marriage-count',
  insight: '한 해에 몇 쌍이 결혼할까?',
  officialText: '혼인 건수·조혼인율(2025년)',
  year: 2025,
  chartKind: 'line',
  scopeLabel: null,
  titleIndicators: [
    { name: '혼인 건수', kind: 'main', valueText: '240,326건', valueGlyph: '240,326건' },
    { name: '조혼인율', kind: 'extra', valueText: '인구 1천 명당 4.7건', valueGlyph: '4.7건' },
  ],
  sideTexts: ['조혼인율 인구 1천 명당 4.7건'],
};

const suicide: SlideDom = {
  id: 'suicide-rate',
  insight: '삶을 스스로 마감하는 사람은 얼마나 될까?',
  official: '자살률(2025년)',
  captions: [],
  valueLines: [{ label: null, text: '27.8명', unit: '명' }],
  sideLines: [],
  basisLines: ['인구 10만 명당'],
  statLines: ['통계 기준: 2025년 · 마지막 갱신 2026-10-15'],
  legend: [],
  metas: [],
  definition: '자살률은 인구 10만 명당 자살 사망자 수입니다.',
  chartTexts: ['2005', '2025', '27.8'],
  all: '삶을 스스로 마감하는 사람은 얼마나 될까?\n자살률(2025년)\n27.8명\n인구 10만 명당\n2005\n2025\n27.8\n자살률은 인구 10만 명당 자살 사망자 수입니다.\n통계 기준: 2025년 · 마지막 갱신 2026-10-15',
};
const suicideExpected: ExpectedSlide = {
  id: 'suicide-rate',
  insight: '삶을 스스로 마감하는 사람은 얼마나 될까?',
  officialText: '자살률(2025년)',
  year: 2025,
  chartKind: 'line',
  scopeLabel: null,
  titleIndicators: [{ name: '자살률', kind: 'main', valueText: '인구 10만 명당 27.8명', valueGlyph: '27.8명' }],
  sideTexts: [],
};

const check = (dom: SlideDom, exp: ExpectedSlide) => checkSlideDom(dom, exp, 'T');

describe('화면 글자 판정기 checkSlideDom: 올바른 화면은 통과한다', () => {
  it('혼인 건수(형식 A + 조혼인율 줄)·자살률(형식 B, 분모만 남은 기준 줄)이 통과한다 — 연도는 공식 통계명 줄이 맡는다 (SPEC-005 SH3)', () => {
    expect(check(marriage, marriageExpected)).toEqual([]);
    expect(check(suicide, suicideExpected)).toEqual([]);
  });

  it('「통계 기준」 줄의 쌍이 좁은 폭에서 두 줄로 나뉜 모양(기호를 감추고 두 항목을 각각 한 줄로)도 통과한다 — 기호가 눈에 안 보이는 것이 맞다', () => {
    const split: SlideDom = { ...suicide, statLines: ['통계 기준: 2025년', '마지막 갱신 2026-10-15'] };
    expect(check(split, suicideExpected)).toEqual([]);
  });

  it('형식 D(시·도별): 공식 통계명 줄에 범위 문구의 기준(월 기준 「2026년 9월」)이 들어 있으면 통과하고, 기준 줄은 없다', () => {
    const region: SlideDom = { ...marriage, id: 'region-population-registered', insight: '사람들은 어디에 모여 살까?', official: '지역별 주민등록 인구수(2026년 9월, 16개 시·도)', captions: ['2026년 9월 전국 주민등록 인구'], valueLines: [{ label: null, text: '51,082,431명', unit: '명' }], sideLines: [], legend: [], chartTexts: ['경기'], statLines: ['통계 기준: 2026년 · 마지막 갱신 2026-10-15'], all: '사람들은 어디에 모여 살까?\n지역별 주민등록 인구수(2026년 9월)\n2026년 9월 전국 주민등록 인구\n51,082,431명\n경기' };
    const regionExpected: ExpectedSlide = { id: 'region-population-registered', insight: region.insight, officialText: region.official, year: 2026, chartKind: 'bar', scopeLabel: '2026년 9월 기준(16개 시·도, 주민등록)', titleIndicators: [], sideTexts: [] };
    expect(check(region, regionExpected)).toEqual([]);
    expect(check({ ...region, basisLines: ['2026년 9월 기준(16개 시·도, 주민등록)'] }, regionExpected).some((p) => p.includes('형식 D에 기준 줄이 남아 있다'))).toBe(true);
  });
});

describe('화면 글자 판정기 checkSlideDom: 잡아야 할 것을 잡는다', () => {
  it('QM2-11: 제목에 이름이 든 지표(조혼인율)의 값이 눈에 보이는 글자에 없으면 걸린다 — 이전 구현(조혼인율 줄이 없던 화면)', () => {
    const before: SlideDom = { ...marriage, sideLines: [], all: marriage.all.replace('조혼인율 인구 1천 명당 4.7건\n', '') };
    const problems = check(before, marriageExpected);
    expect(problems.some((p) => p.includes('「조혼인율」의 값 「4.7건」이 눈에 보이는 글자에 없다')), problems.join('\n')).toBe(true);
    expect(problems.some((p) => p.includes('큰 값 아래 줄에 「조혼인율 인구 1천 명당 4.7건」가 없다'))).toBe(true);
  });

  it('정의 문장에만 값이 있는 경우(숫자 없이 낱말만)는 보이는 값으로 치지 않는다', () => {
    const wordOnly: SlideDom = { ...marriage, sideLines: [], all: marriage.all.replace('조혼인율 인구 1천 명당 4.7건\n', '') };
    expect(wordOnly.all).toContain('조혼인율은 인구 1천 명당 혼인 건수입니다');
    expect(check(wordOnly, { ...marriageExpected, sideTexts: [] }).some((p) => p.includes('조혼인율'))).toBe(true);
  });

  it('QM2-4 금지 패턴: 「인구 10만 명당 명」(이전 단위 칸)·데이터 라벨 그대로의 「(인구 1천 명당 건)」을 그리면 걸린다', () => {
    const oldUnit: SlideDom = { ...suicide, valueLines: [{ label: null, text: '27.8명', unit: '명' }], all: `${suicide.all}\n인구 10만 명당 명` };
    expect(check(oldUnit, suicideExpected).some((p) => p.includes('금지 패턴'))).toBe(true);
    const dataLabel: SlideDom = { ...marriage, legend: ['조혼인율(인구 1천 명당 건) 인구 1천 명당 4.7건'], all: `${marriage.all}\n조혼인율(인구 1천 명당 건)` };
    const problems = check(dataLabel, marriageExpected);
    expect(problems.some((p) => p.includes('범례에 금지 패턴')), problems.join('\n')).toBe(true);
  });

  it('형식표: B형 기준 줄이 없거나 연도가 섞이면(옛 「인구 10만 명당 · 2025년 기준」) 걸리고, A형 값 줄에 분모가 섞여도 걸린다', () => {
    expect(check({ ...suicide, basisLines: [] }, suicideExpected).some((p) => p.includes('형식 B 기준 줄'))).toBe(true);
    expect(check({ ...suicide, basisLines: ['인구 10만 명당 · 2025년 기준'] }, suicideExpected).some((p) => p.includes('형식 B 기준 줄'))).toBe(true);
    expect(check({ ...suicide, basisLines: ['인구 10만 명당', '2025년 기준'] }, suicideExpected).some((p) => p.includes('형식 B 기준 줄'))).toBe(true);
    const aWithDenominator: SlideDom = { ...marriage, valueLines: [{ label: null, text: '인구 1천 명당 240,326건', unit: '건' }] };
    expect(check(aWithDenominator, marriageExpected).some((p) => p.includes('「숫자 + 단위 낱말」 모양이 아니다'))).toBe(true);
  });

  it('SPEC-005: 연도만 있던 기준 줄이 A형·C형에 남아 있으면 걸린다(연도는 공식 통계명 줄이 맡는다)', () => {
    const problems = check({ ...marriage, basisLines: ['2025년 기준'] }, marriageExpected);
    expect(problems.some((p) => p.includes('형식 A에 기준 줄이 남아 있다')), problems.join('\n')).toBe(true);
  });

  it('SPEC-005: 표제어에 숫자가 있거나, 표제어·공식 통계명 줄이 모델과 다르거나, 공식 통계명 줄에 기준이 없으면 걸린다', () => {
    expect(check({ ...suicide, insight: '2025년 자살은 얼마나 될까?' }, suicideExpected).some((p) => p.includes('표제어에 숫자가 있다'))).toBe(true);
    expect(check({ ...suicide, insight: '다른 질문일까?' }, suicideExpected).some((p) => p.includes('표제어가 모델과 다르다'))).toBe(true);
    expect(check({ ...suicide, official: '자살률' }, suicideExpected).some((p) => p.includes('공식 통계명 줄이 모델과 다르다'))).toBe(true);
    expect(check({ ...suicide, official: '자살률' }, { ...suicideExpected, officialText: '자살률' }).some((p) => p.includes('공식 통계명 줄 모양'))).toBe(true);
  });

  it('기준 연도가 한 값에서 나오지 않으면 걸린다: 공식 통계명 줄 2024년 vs latest.year 2025', () => {
    const wrongYear: SlideDom = { ...marriage, official: '혼인 건수·조혼인율(2024년)' };
    const problems = check(wrongYear, { ...marriageExpected, officialText: '혼인 건수·조혼인율(2024년)' });
    expect(problems.some((p) => p.includes('기준 연도 2024')), problems.join('\n')).toBe(true);
  });

  it('형식표에 없는 슬라이드(새 지표)는 형식을 정하라고 걸린다', () => {
    expect(check({ ...marriage, id: 'brand-new' }, { ...marriageExpected, id: 'brand-new' }).some((p) => p.includes('형식표(SLIDE_FORMS)에 없는 슬라이드'))).toBe(true);
  });
});

// ---------- QI4 2단계: 형식 E(연령별 격차)와 P(공식 전망)를 판정기가 본다 ----------

const gap: SlideDom = {
  id: 'income-gap-by-age',
  insight: '나이들수록 또래들과 경제력 차이가 극심해져요',
  official: '연령계층별 소득 5분위배율(2024년)',
  captions: ['같은 나이대 안에서 소득 상위 20%가 하위 20%의 몇 배인지(균등화 처분가능소득)'],
  valueLines: [
    { label: '66세 이상', text: '6.90배', unit: '배' },
    { label: '18~65세', text: '5.01배', unit: '배' },
  ],
  sideLines: ['2011~2024년 모든 해에 66세 이상의 격차가 18~65세보다 큽니다.', '같은 나이대 안의 소득 격차는 18~65세와 66세 이상 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.'],
  basisLines: [],
  statLines: ['통계 기준: 2024년 · 마지막 갱신 2026-10-21'],
  legend: [],
  metas: [],
  definition: '소득 5분위배율은 소득 상위 20% 계층의 평균소득을 하위 20% 계층의 평균소득으로 나눈 값입니다.',
  chartTexts: ['2024년', '66세 이상', '6.90배', '18~65세', '5.01배'],
  all: '나이들수록 또래들과 경제력 차이가 극심해져요\n연령계층별 소득 5분위배율(2024년)\n66세 이상 6.90배\n18~65세 5.01배\n2011~2024년 모든 해에 66세 이상의 격차가 18~65세보다 큽니다.\n같은 나이대 안의 소득 격차는 18~65세와 66세 이상 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.\n2024년\n66세 이상\n6.90배\n18~65세\n5.01배',
};
const gapExpected: ExpectedSlide = {
  id: 'income-gap-by-age',
  insight: gap.insight,
  officialText: gap.official,
  year: 2024,
  chartKind: 'bars',
  projection: null,
  scopeLabel: null,
  titleIndicators: [{ name: '연령계층별 소득 5분위배율', kind: 'main', valueText: '6.90배', valueGlyph: '6.90배' }],
  sideTexts: gap.sideLines,
};

const NOTE = '전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.';
const population: SlideDom = {
  id: 'projection-population-total',
  insight: '앞으로 인구는 어떻게 달라질까?',
  official: '장래인구추계 총인구(2023년 발표, 2022년 기준, 중위 추계)',
  captions: ['2072년 총인구(중위 추계)'],
  valueLines: [{ label: null, text: '36,222,293명', unit: '명' }],
  sideLines: ['2072년 고위 추계(최대인구) 42,818,632명, 저위 추계(최소인구) 30,172,383명'],
  basisLines: [],
  statLines: ['발표: 2023-12-14 · 마지막 갱신 2026-10-21'],
  legend: ['확정 1960~2022 51,672,569명', '전망 2023~2072(중위) 36,222,293명', '고위(최대인구)~저위(최소인구) 추계 범위'],
  metas: [],
  chips: ['전망'],
  projNotes: [NOTE],
  definition: '장래인구추계의 총인구입니다.',
  chartTexts: ['1960', '2022', '2072', '3,622만', '고위', '저위'],
  all: '전망\n앞으로 인구는 어떻게 달라질까?\n장래인구추계 총인구(2023년 발표, 2022년 기준, 중위 추계)\n36,222,293명\n2072년 고위 추계(최대인구) 42,818,632명, 저위 추계(최소인구) 30,172,383명',
};
const populationExpected: ExpectedSlide = {
  id: 'projection-population-total',
  insight: population.insight,
  officialText: population.official,
  year: 2072,
  chartKind: 'line',
  projection: { chip: '전망', note: NOTE, releasedOn: '2023-12-14' },
  scopeLabel: null,
  titleIndicators: [{ name: '장래인구추계(2022년 기준): 총인구', kind: 'main', valueText: '36,222,293명', valueGlyph: '36,222,293명' }],
  sideTexts: population.sideLines,
};

describe('화면 글자 판정기 checkSlideDom: 형식 E(연령별 격차)·P(공식 전망) — QI4 2단계', () => {
  it('올바른 격차 화면(값 둘 배 · 보조 문장 둘 · 기준 줄 없음)과 올바른 전망 화면(칩 「전망」 · 발표·기준 연도 통계명 줄 · 한 줄 안내 · 「발표: …」 기준 줄)이 통과한다', () => {
    expect(check(gap, gapExpected)).toEqual([]);
    expect(check(population, populationExpected)).toEqual([]);
  });

  it('형식 E: 값 라벨이 66세 이상·18~65세가 아니거나 단위가 배가 아니거나 보조 문장이 둘이 아니면 걸린다', () => {
    expect(check({ ...gap, valueLines: [{ label: '남자', text: '6.90배', unit: '배' }, gap.valueLines[1]] }, gapExpected).some((p) => p.includes('형식 E 값 라벨'))).toBe(true);
    expect(check({ ...gap, valueLines: [{ label: '66세 이상', text: '6.90명', unit: '명' }, gap.valueLines[1]] }, gapExpected).some((p) => p.includes('형식 E 값이 「…배」가 아니다'))).toBe(true);
    expect(check({ ...gap, sideLines: [gap.sideLines[0]] }, { ...gapExpected, sideTexts: [gap.sideLines[0]] }).some((p) => p.includes('형식 E 보조 문장이 둘이 아니다'))).toBe(true);
  });

  it('형식 P: 칩이 없거나 글자가 다르거나, 한 줄 안내가 모델과 다르거나, 기준 줄이 「발표: …」가 아니거나, 통계명 줄이 발표·기준 연도 꼴이 아니면 걸린다 · 전망이 아닌 슬라이드에 칩이 있어도 걸린다', () => {
    expect(check({ ...population, chips: [] }, populationExpected).some((p) => p.includes('전망 칩 글자'))).toBe(true);
    expect(check({ ...population, chips: ['예상'] }, populationExpected).some((p) => p.includes('전망 칩 글자'))).toBe(true);
    expect(check({ ...population, projNotes: [] }, populationExpected).some((p) => p.includes('전망 한 줄 안내'))).toBe(true);
    expect(check({ ...population, statLines: ['통계 기준: 2072년 · 마지막 갱신 2026-10-21'] }, populationExpected).some((p) => p.includes('전망 기준 줄 모양'))).toBe(true);
    expect(check({ ...population, official: '장래인구추계 총인구(2072년)' }, { ...populationExpected, officialText: '장래인구추계 총인구(2072년)' }).some((p) => p.includes('공식 전망 통계명 줄 모양'))).toBe(true);
    expect(check({ ...marriage, chips: ['전망'] }, marriageExpected).some((p) => p.includes('전망이 아닌 슬라이드에 칩이 있다'))).toBe(true);
    // 발표일이 기준 줄에 없으면 걸린다
    expect(check({ ...population, statLines: ['발표: 2022-01-01 · 마지막 갱신 2026-10-21'] }, populationExpected).some((p) => p.includes('발표일 2023-12-14이 없다'))).toBe(true);
  });
});

describe('e2e의 형식표·금지 패턴은 단위 테스트(모델)와 같은 것을 쓴다', () => {
  it('SLIDE_FORMS의 키는 실제 캐러셀 20장의 id와 정확히 같다 (새 지표가 형식 없이 들어오지 못한다 — QI4 2단계: 14장 → 20장)', () => {
    expect(Object.keys(SLIDE_FORMS).sort()).toEqual(
      buildCarousel()
        .slides.map((s) => s.id)
        .sort(),
    );
  });

  it('forbiddenIn: 「명당 명」·같은 단위 연속은 걸리고 올바른 표기는 걸리지 않는다', () => {
    expect(forbiddenIn('인구 10만 명당 명')).toHaveLength(1);
    expect(forbiddenIn('조혼인율(인구 1천 명당 건)')).toHaveLength(1);
    expect(forbiddenIn('37.7% %')).toHaveLength(1);
    expect(forbiddenIn('조혼인율 인구 1천 명당 4.7건')).toEqual([]);
    expect(forbiddenIn('인구 10만 명당')).toEqual([]);
    expect(forbiddenIn('자살률(2025년)')).toEqual([]);
  });
});
