import { describe, expect, it } from 'vitest';
import { SLIDE_FORMS, forbiddenIn } from '../e2e/carouselForms';
import { checkSlideDom, type ExpectedSlide, type SlideDom } from '../e2e/slideText';
import { buildCarousel } from '../src/core';

/**
 * 화면 DOM 글자 판정기(e2e/slideText.ts#checkSlideDom)가 실제로 잡는지 직접 만든 DOM 측정값으로 본다 — 판정기가 아무것도 못 잡으면 e2e/slide-text.spec.ts(14장 × 폭 3 × 글자 2)가 의미가 없다.
 * 이 e2e는 단위 테스트(tests/carousel.test.ts: 모델의 글자)가 못 보는 「화면이 그 글자를 실제로 그리는가」를 본다(REV-003-M2-3 R-231, SPEC-003 QM2-4 c·QM2-11 c).
 */

const marriage: SlideDom = {
  id: 'marriage-count',
  title: '혼인 건수와 조혼인율',
  captions: [],
  valueLines: [{ label: null, text: '240,326건', unit: '건' }],
  sideLines: ['조혼인율 인구 1천 명당 4.7건'],
  basisLines: ['2025년 기준'],
  pairSepVisible: null,
  statLines: ['통계 기준: 2025년 · 마지막 갱신 2026-10-15'],
  legend: [],
  metas: ['혼인 건수(건, 혼인신고 기준)', '출처: 국가데이터처, KOSIS 혼인건수, 조혼인율 (2026-10-15 조회)'],
  definition: '혼인 건수는 혼인신고 기준(신고월 기준)으로 집계한 값이고, 조혼인율은 인구 1천 명당 혼인 건수입니다.',
  chartTexts: ['1970', '2025', '240,326', '295,137'],
  all: '혼인 건수와 조혼인율\n240,326건\n조혼인율 인구 1천 명당 4.7건\n2025년 기준\n1970\n2025\n240,326\n295,137\n혼인 건수(건, 혼인신고 기준)\n혼인 건수는 혼인신고 기준(신고월 기준)으로 집계한 값이고, 조혼인율은 인구 1천 명당 혼인 건수입니다.\n통계 기준: 2025년 · 마지막 갱신 2026-10-15',
};
const marriageExpected: ExpectedSlide = {
  id: 'marriage-count',
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
  title: '자살률',
  captions: [],
  valueLines: [{ label: null, text: '27.8명', unit: '명' }],
  sideLines: [],
  basisLines: ['인구 10만 명당 · 2025년 기준'],
  pairSepVisible: true,
  statLines: ['통계 기준: 2025년 · 마지막 갱신 2026-10-15'],
  legend: [],
  metas: [],
  definition: '자살률은 인구 10만 명당 자살 사망자 수입니다.',
  chartTexts: ['2005', '2025', '27.8'],
  all: '자살률\n27.8명\n인구 10만 명당 · 2025년 기준\n2005\n2025\n27.8\n자살률은 인구 10만 명당 자살 사망자 수입니다.\n통계 기준: 2025년 · 마지막 갱신 2026-10-15',
};
const suicideExpected: ExpectedSlide = {
  id: 'suicide-rate',
  year: 2025,
  chartKind: 'line',
  scopeLabel: null,
  titleIndicators: [{ name: '자살률', kind: 'main', valueText: '인구 10만 명당 27.8명', valueGlyph: '27.8명' }],
  sideTexts: [],
};

const check = (dom: SlideDom, exp: ExpectedSlide) => checkSlideDom(dom, exp, 'T');

describe('화면 글자 판정기 checkSlideDom: 올바른 화면은 통과한다', () => {
  it('혼인 건수(형식 A + 조혼인율 줄)·자살률(형식 B, 한 줄 기준)이 통과한다', () => {
    expect(check(marriage, marriageExpected)).toEqual([]);
    expect(check(suicide, suicideExpected)).toEqual([]);
  });

  it('형식 B의 기준 줄이 좁은 폭에서 두 줄로 나뉜 모양(기호를 감추고 두 항목을 각각 한 줄로)도 통과한다 — 기호가 눈에 안 보이는 것이 맞다', () => {
    const split: SlideDom = { ...suicide, basisLines: ['인구 10만 명당', '2025년 기준'], pairSepVisible: false, statLines: ['통계 기준: 2025년', '마지막 갱신 2026-10-15'] };
    expect(check(split, suicideExpected)).toEqual([]);
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
    const oldUnit: SlideDom = { ...suicide, valueLines: [{ label: null, text: '27.8명', unit: '명' }], basisLines: ['2025년 기준'], all: `${suicide.all}\n인구 10만 명당 명` };
    expect(check(oldUnit, suicideExpected).some((p) => p.includes('금지 패턴'))).toBe(true);
    const dataLabel: SlideDom = { ...marriage, legend: ['조혼인율(인구 1천 명당 건) 인구 1천 명당 4.7건'], all: `${marriage.all}\n조혼인율(인구 1천 명당 건)` };
    const problems = check(dataLabel, marriageExpected);
    expect(problems.some((p) => p.includes('범례에 금지 패턴')), problems.join('\n')).toBe(true);
  });

  it('형식표: B형 기준 줄이 「2025년 기준」뿐이면(분모 문구 없음) 걸리고, A형 값 줄에 분모가 섞여도 걸린다', () => {
    const noDenominator: SlideDom = { ...suicide, basisLines: ['2025년 기준'] };
    expect(check(noDenominator, suicideExpected).some((p) => p.includes('형식 B 기준 줄'))).toBe(true);
    const aWithDenominator: SlideDom = { ...marriage, valueLines: [{ label: null, text: '인구 1천 명당 240,326건', unit: '건' }] };
    expect(check(aWithDenominator, marriageExpected).some((p) => p.includes('「숫자 + 단위 낱말」 모양이 아니다'))).toBe(true);
  });

  it('쌍의 기호: 한 줄인데 기호가 안 보이거나, 두 줄로 나뉘었는데 기호가 눈에 보이면 걸린다', () => {
    expect(check({ ...suicide, pairSepVisible: false }, suicideExpected).some((p) => p.includes('한 줄인데 「·」가 보이지 않는다'))).toBe(true);
    const split: SlideDom = { ...suicide, basisLines: ['인구 10만 명당', '2025년 기준'], pairSepVisible: true };
    expect(check(split, suicideExpected).some((p) => p.includes('두 줄로 나뉘었는데 「·」가 눈에 보인다'))).toBe(true);
  });

  it('기준 연도가 한 값에서 나오지 않으면 걸린다: 기준 줄 2024년 vs latest.year 2025', () => {
    const wrongYear: SlideDom = { ...marriage, basisLines: ['2024년 기준'] };
    const problems = check(wrongYear, marriageExpected);
    expect(problems.some((p) => p.includes('기준 연도 2024')), problems.join('\n')).toBe(true);
  });

  it('형식표에 없는 슬라이드(새 지표)는 형식을 정하라고 걸린다', () => {
    expect(check({ ...marriage, id: 'brand-new' }, { ...marriageExpected, id: 'brand-new' }).some((p) => p.includes('형식표(SLIDE_FORMS)에 없는 슬라이드'))).toBe(true);
  });
});

describe('e2e의 형식표·금지 패턴은 단위 테스트(모델)와 같은 것을 쓴다', () => {
  it('SLIDE_FORMS의 키는 실제 캐러셀 14장의 id와 정확히 같다 (새 지표가 형식 없이 들어오지 못한다)', () => {
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
    expect(forbiddenIn('인구 10만 명당 · 2025년 기준')).toEqual([]);
  });
});
