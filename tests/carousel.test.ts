import { describe, expect, it } from 'vitest';
import statsJson from '../src/data/koreaStats.json';
import {
  AUTO_ADVANCE_MS,
  CAROUSEL_MAX_DOTS,
  CHART_MAX_W,
  CHART_MIN_W,
  DEFAULT_CHART_SIZE,
  LINE_H,
  LINE_H_STACKED,
  LINE_W,
  BAR_ROW_H,
  bareName,
  buildCarousel,
  buildSlide,
  officialBasisOf,
  chartSizeFor,
  dotLabel,
  estimateLabelWidth,
  isDrawable,
  labelRect,
  nextSlideIndex,
  selectCarouselIndicators,
  shouldAutoAdvance,
  slideReadName,
  segmentHitsRect,
  pointerCountsAsHover,
  showDots,
  sourceOrgsOf,
  splitUnit,
  spreadY,
  swipeStep,
  titleIndicators,
  valueWidthEm,
  type LineChartModel,
} from '../src/core';
import { SLIDE_FORMS, UNIT_WORD, forbiddenIn } from '../e2e/carouselForms';
import { CAROUSEL_ORDER, createStatsAccess, formatNumber, formatWithUnit, type RawIndicator, type StatsFile } from '../src/data/koreaStatsAccess';
import { TITLE_TEXT } from '../src/data/titleText';
import { contrastRatio, parseHex, readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로(CSS 처리 꺼짐) CSS는 파일 시스템으로 읽는다(tests/legacyTheme.test.ts와 같은 방법). */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const titleCss = await readText('../src/styles/title.css');
const tokensCss = await readText('../src/styles/tokens.css');

/**
 * 통계 캐러셀의 데이터 선택·슬라이드 모델·동작 규칙 (SPEC-003 SC1~SC7). 값은 koreaStats.json 실제 값이다(시안의 가짜 값이 아니다).
 * 데이터를 읽는 규칙(usable:false 차단·미확인 하위 항목 제거)은 접근자(data/koreaStatsAccess.ts)의 몫이고 tests/koreaStats.test.ts가 본다 —
 * 여기서는 그 위에서 「캐러셀이 그릴 수 있는 것만 고른다」와 「화면 모양으로 바꾼다」를 본다.
 */

const REAL = statsJson as unknown as StatsFile;

/**
 * SPEC-005 QI4 2단계(마스터 결정 1): 슬라이드는 20장 = 기존 14장 + 연령별 격차 `income-gap-by-age` 1장 + 공식 전망 5장(총인구 · 65세 이상 비율 · 1인 가구 · 폭염 · 지금 태어나는 아기).
 * 아래 시험의 「14장」 단언은 `ORIGINAL_IDS`(기존 14장)에 그대로 걸고(약화 없음), 새 여섯 장은 형식에 맞는 단언을 더한다 — 전망·격차 형식별 모델 시험은 tests/slideForms.test.ts.
 */
const PROJECTION_IDS = ['projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection', 'projection-newborn-age-structure'];
const QI4_IDS = ['income-gap-by-age', ...PROJECTION_IDS];
const ORIGINAL_IDS = CAROUSEL_ORDER.filter((id) => !QI4_IDS.includes(id));

const base = (over: Partial<RawIndicator>): RawIndicator => ({
  id: 'fake-a',
  title: '가짜 지표',
  unit: '명',
  kind: 'line',
  use: ['carousel'],
  latest: { year: 2025, value: 1.5 },
  latestUnit: '명',
  decimals: 2,
  series: [
    { year: 2023, value: 1.2 },
    { year: 2024, value: 1.3 },
    { year: 2025, value: 1.5 },
  ],
  definition: '가짜 지표는 시험에 쓰는 값입니다.',
  basisId: 's-999',
  source: { org: '시험기관', table: '시험 통계표', url: 'https://example.invalid/', accessedOn: '2026-10-15' },
  verification: { status: 'verified' },
  safety: null,
  usable: true,
  ...over,
});
const fileOf = (...inds: RawIndicator[]): StatsFile => ({ meta: { updatedOn: '2026-10-16' }, indicators: inds });
const ids = (file: StatsFile) => selectCarouselIndicators(file).map((i) => i.id);

describe('캐러셀 데이터 선택 (SC3): 접근자가 usable:false·출처 없는 지표를 막고, 캐러셀은 그릴 수 있는 것만 고른다', () => {
  it('usable:false, 미확인(unverified), 출처 없음, 값 없음은 접근자에서 빠지고 계열이 모자라거나 그릴 수 없는 종류는 캐러셀에서 빠진다', () => {
    const file = fileOf(
      base({ id: 'ok-1' }),
      base({ id: 'bad-usable', usable: false }),
      base({ id: 'bad-unverified', verification: { status: 'unverified' } }),
      base({ id: 'bad-nosource', source: null }),
      base({ id: 'bad-nolatest', latest: null }),
      base({ id: 'bad-oneseries', series: [{ year: 2025, value: 1 }] }),
      base({ id: 'bad-table', kind: 'table' }),
      base({ id: 'bad-number', kind: 'number' }),
      base({ id: 'bad-use', use: ['birth'] }),
    );
    expect(ids(file)).toEqual(['ok-1']);
    expect(buildCarousel(file).slides.map((s) => s.id)).toEqual(['ok-1']);
    expect(createStatsAccess(file).getCarouselIndicators().map((i) => i.id), '접근자는 그릴 수 있는지는 보지 않는다').toEqual(['ok-1', 'bad-oneseries', 'bad-table', 'bad-number']);
  });

  it('실제 데이터: usable:false 지표 id는 슬라이드에 하나도 없다 (전수)', () => {
    const slides = new Set(buildCarousel().slides.map((s) => s.id));
    const blocked = REAL.indicators.filter((i) => !i.usable).map((i) => i.id);
    expect(blocked.length).toBeGreaterThan(0); // 공허 통과 방지: 막을 지표가 실제로 있다
    for (const id of blocked) expect(slides.has(id), id).toBe(false);
    // carousel 용도가 아닌 지표도 나오지 않는다
    for (const i of REAL.indicators.filter((x) => !x.use.includes('carousel'))) expect(slides.has(i.id), i.id).toBe(false);
  });

  it('자살률 슬라이드는 상담전화 안내(번호·시간대)가 갖춰졌을 때만 나온다 (SC6, C10: 확인 전에는 쓰지 않는다)', () => {
    const suicide = base({ id: 'suicide-rate', safety: 'suicide-help' });
    expect(isDrawable(createStatsAccess(fileOf(suicide)).getUsableIndicator('suicide-rate')!)).toBe(false);
    for (const helpLine of [
      { name: '자살예방 상담전화', number: '', hours: '24시간' },
      { name: '자살예방 상담전화', number: '번호미정', hours: '24시간' },
      { name: '자살예방 상담전화', number: '109', hours: '' },
      { name: '', number: '109', hours: '24시간' },
    ]) {
      expect(ids(fileOf({ ...suicide, helpLine })), JSON.stringify(helpLine)).toEqual([]);
    }
    const good = { ...suicide, helpLine: { name: '자살예방 상담전화', number: '109', hours: '24시간' } };
    expect(ids(fileOf(good))).toEqual(['suicide-rate']);
  });
});

describe('실제 캐러셀: 지표 목록·표기 (SC1·SC2)', () => {
  const data = buildCarousel();
  const byId = (id: string) => data.slides.find((s) => s.id === id)!;
  const raw = (id: string) => REAL.indicators.find((i) => i.id === id)!;

  it('지표가 10개 이상이고(SC1) 요청의 5개(합계출산율·사망률·노인빈곤율·자살률·지역별 인구수)를 포함한다', () => {
    expect(data.slides.length).toBeGreaterThanOrEqual(10);
    for (const id of ['tfr', 'cdr', 'elderly-poverty', 'suicide-rate', 'region-population-registered']) expect(byId(id), id).toBeDefined();
  });

  it('지역 인구는 2026 주민등록 16개 시·도 하나만 보인다 (17개 시도 2025 센서스 지표는 없다, 마스터 결정)', () => {
    expect(data.slides.map((s) => s.id)).not.toContain('region-population');
    const region = byId('region-population-registered');
    expect(region.chart.kind).toBe('bar');
    if (region.chart.kind === 'bar') expect(region.chart.rows.length).toBe(16);
    // 기준 표기는 공식 통계명 줄이 맡는다(SPEC-005 SH3, copy.md 9-1 #6): 월 기준 지표라 「2026년 9월」, 데이터의 범위 문구(scopeLabel)에서 만든다. 옛 기준 줄은 없다
    expect(raw('region-population-registered').scopeLabel).toContain('2026년 9월 기준(16개 시·도');
    expect(region.officialText).toBe('지역별 주민등록 인구수(2026년 9월, 16개 시·도)'); // R-446 (b)
    expect(region.basisText).toBeNull();
    expect(region.valueText).toBe('51,082,431');
    expect(region.caption).toBe('2026년 9월 전국 주민등록 인구');
  });

  it('시도별 합계출산율은 공식 통계명 줄에 「2025년, 17개 시·도」 범위가 든다 (통계 근거 검수 R-147 d, 마스터 결정 — SPEC-005에서 옛 기준 줄 「2025년 기준(17개 시·도)」을 공식 통계명 줄이 대신한다)', () => {
    const s = byId('tfr-by-sido');
    expect(raw('tfr-by-sido').scopeLabel).toBe('2025년 기준(17개 시·도)');
    expect(s.officialText).toBe('시·도별 합계출산율(2025년, 17개 시·도)');
    expect(s.basisText).toBeNull();
    expect(s.chart.kind).toBe('bar');
    expect(s.valueText).toBe('0.80');
    expect(s.caption).toBe('전국 합계출산율');
  });

  it('슬라이드마다 제목·기준 연도·출처(기관과 통계표 이름, 열람일)·한 줄 정의·그래프(대체 텍스트 포함)가 있다 (SC2) — 20장', () => {
    expect(data.slides, '슬라이드 20장').toHaveLength(20);
    for (const s of data.slides) {
      expect(s.title.length, s.id).toBeGreaterThan(1);
      // 표제어(h3)와 공식 통계명 줄이 있다(SH1~SH3): 「합계출산율(2025년)」 꼴 — 기준은 공식 통계명 줄 끝 괄호 안에 있다
      expect(s.insight.length, s.id).toBeGreaterThan(5);
      if (s.projection === null) expect(s.officialText, s.id).toMatch(/^.+\(\d{4}년( \d{1,2}월)?(, .+)?\)$/);
      else expect(s.officialText, `${s.id} 전망: 「…(2023년 발표, 2022년 기준[, 시나리오])」 꼴`).toMatch(/^.+\(\d{4}년 발표, .+ 기준(, .+)?\)$/);
      // 분모가 있는 비율(조사망률·자살률)만 기준 줄에 분모 「인구 10만 명당」이 남는다(QM2-4 B형 → copy.md 9-2) — 분모 문구는 값 옆 칸이 아니라 기준 줄에 있다. 연도는 공식 통계명 줄로 옮겼다
      expect(s.basisText === null || /^인구 (1천|10만) 명당$/.test(s.basisText), s.id).toBe(true);
      // 출처 줄은 20장 모두 「{기관 나열}의 {표 이름} ({조회일} 조회)」 — 한 함수의 꼴이라 장마다 다르게 두지 않는다 (마스터 결정: REV-005-QI4-1 「마스터 결정」 출처 줄, copy.md 14-6·D5-66).
      // 1단계까지의 기대 글자 「기관, 표 이름 (…조회)」(첫 쉼표가 기관의 끝)을 이 꼴로 바꿨다.
      expect(s.sourceText, s.id).toMatch(/^.+의 .{5,} \(\d{4}-\d{2}-\d{2} 조회\)$/);
      expect(s.sourceText, `${s.id}: 기관 사이에 「·」가 없다(쉼표 나열)`).not.toMatch(/^[^의]*·/);
      expect(s.definition.trim().endsWith('.'), s.id).toBe(true);
      expect(s.chartLabel.length, s.id).toBeGreaterThan(10);
      // 읽기 이름에 지표 이름이 든다 — 전망 슬라이드는 공식 전망명이 title과 표기가 달라(copy.md 14-4) 그래프 종류 낱말만 본다
      if (s.projection === null) expect(s.chartLabel, s.id).toContain(s.title);
      else expect(s.chartLabel, s.id).toContain('그래프');
    }
  });

  it('출처 줄은 「{기관 나열}의 {표 이름} ({조회일} 조회)」 — 기관은 쉼표 나열, 기관 묶음과 표 이름 사이는 조사 「의」, 20장 모두 데이터 source에서만 만든다 (마스터 결정 · D5-66 · R-487)', () => {
    for (const s of data.slides) {
      const src = raw(s.id).source!;
      expect(s.sourceText, s.id).toBe(`${sourceOrgsOf(src.org).join(', ')}의 ${src.table} (${src.accessedOn} 조회)`);
    }
    // 대표 꼴: 기관 하나 / 기관 둘(「국가데이터처·교육부」) / 기관 셋(KOSIS가 넷째 기관처럼 읽히지 않게 「의」)
    expect(byId('tfr').sourceText.startsWith('국가데이터처의 2025년 출생 통계 ')).toBe(true);
    expect(byId('private-education').sourceText.startsWith('국가데이터처, 교육부의 ')).toBe(true);
    expect(byId('income-gap-by-age').sourceText.startsWith('국가데이터처, 한국은행, 금융감독원의 KOSIS 가계금융복지조사 ')).toBe(true);
    expect(byId('projection-population-total').sourceText.startsWith('통계청(현 국가데이터처)의 KOSIS 장래인구추계(2022년 기준) ')).toBe(true);
    expect(byId('heat-projection').sourceText.startsWith('기상청(국립기상과학원)의 보도자료 ')).toBe(true);
    // 옛 꼴(「기관, 표 이름」 — 첫 쉼표가 기관의 끝)은 어느 장에도 없다
    for (const s of data.slides) {
      const orgs = sourceOrgsOf(raw(s.id).source!.org);
      if (orgs.length === 1) expect(s.sourceText.startsWith(`${orgs[0]}, `), `${s.id}: 기관 하나인 슬라이드는 「기관, 표」가 아니라 「기관의 표」`).toBe(false);
    }
  });

  it('슬라이드마다 「통계 기준: <연도> · 마지막 갱신 <날짜>」 한 줄이 있다 (SC4) — 전망 5장은 「발표: <발표일> · 마지막 갱신 <날짜>」(마스터 결정 8: 기준 표기는 발표일)', () => {
    for (const s of data.slides) {
      if (s.projection === null) {
        expect(s.basisLine, s.id).toMatch(/^통계 기준: \d{4}년 · 마지막 갱신 \d{4}-\d{2}-\d{2}$/);
      } else {
        expect(s.basisLine, s.id).toMatch(/^발표: \d{4}-\d{2}-\d{2} · 마지막 갱신 \d{4}-\d{2}-\d{2}$/);
        expect(s.basisLine, s.id).toBe(`발표: ${s.projection.releasedOn} · 마지막 갱신 ${REAL.meta.updatedOn}`);
      }
      expect(s.basisLine, s.id).toContain(`마지막 갱신 ${REAL.meta.updatedOn}`);
    }
    expect(byId('tfr').basisLine).toBe(`통계 기준: 2025년 · 마지막 갱신 ${REAL.meta.updatedOn}`);
    expect(byId('projection-population-total').basisLine).toBe(`발표: 2023-12-14 · 마지막 갱신 ${REAL.meta.updatedOn}`);
    expect(byId('projection-one-person-households').basisLine).toBe(`발표: 2024-09-12 · 마지막 갱신 ${REAL.meta.updatedOn}`);
    expect(byId('heat-projection').basisLine).toBe(`발표: 2021-12-23 · 마지막 갱신 ${REAL.meta.updatedOn}`);
    // 데이터 파일의 갱신일을 주면(테스트용) 그 날짜를 쓴다
    expect(buildCarousel(fileOf(base({ id: 'x' }))).slides[0].basisLine).toBe('통계 기준: 2025년 · 마지막 갱신 2026-10-16');
  });

  it('출처 기관: 국가데이터처·행정안전부·교육부 등 슬라이드에 쓰인 기관이 중복 없이 모인다 (푸터 표기)', () => {
    expect(data.orgs).toEqual(expect.arrayContaining(['국가데이터처', '행정안전부', '교육부']));
    // QI4 2단계: 격차 지표의 한국은행·금융감독원, 공식 전망의 발표 당시 명칭 「통계청(현 국가데이터처)」, 폭염의 기상청도 푸터 기관 목록에 모인다
    expect(data.orgs).toEqual(expect.arrayContaining(['한국은행', '금융감독원', '통계청(현 국가데이터처)', '기상청(국립기상과학원)']));
    expect(new Set(data.orgs).size).toBe(data.orgs.length);
    // 「국가데이터처·교육부」는 나눠서 센다
    expect(data.orgs.every((o) => !o.includes('·'))).toBe(true);
  });

  it('평가·논평 문구와 느낌표가 없다 (정의와 값만, SC2·정치적 중립)', () => {
    for (const s of data.slides) {
      const text = [s.title, s.insight, s.officialText, s.definition, s.caption ?? '', s.seriesNote ?? '', s.basisText ?? ''].join(' ');
      expect(text, s.id).not.toMatch(/[!！]/);
      expect(text, s.id).not.toMatch(/심각|위기|충격|최악|참담/);
    }
  });

  it('값 표기는 데이터가 정한 공식 표기 자릿수다: 합계출산율 0.80, 출생아 수 254,341, 66세 이상 빈곤율 37.7, 기대수명 83.7', () => {
    expect(byId('tfr').valueText).toBe('0.80');
    expect(byId('births').valueText).toBe('254,341');
    expect(byId('elderly-poverty').valueText).toBe('37.7');
    expect(byId('life-expectancy').valueText).toBe('83.7');
    expect(byId('suicide-rate').valueText).toBe('27.8');
    expect(byId('tfr').officialText).toBe('합계출산율(2025년)');
    expect(byId('elderly-poverty').officialText).toBe('66세 이상 상대적 빈곤율(2024년)'); // 지표마다 기준 연도가 다르다
    expect(byId('tfr').unitText).toBe('명');
  });

  it('슬라이드의 큰 값은 koreaStats.json의 latest 값과 같다 (시안의 가짜 값 0.68·2023이 아니다)', () => {
    for (const ind of selectCarouselIndicators()) {
      const s = byId(ind.id);
      if (s.headlines.length === 1) expect(s.valueText, ind.id).toBe(formatNumber(ind.headline?.[0]?.value ?? ind.latest.value, ind.decimals));
      // 전망 슬라이드는 기준 줄이 발표일이라 latest.year(지평·아기 30세 해)가 캡션(데이터 latestLabel)에 있다 — 단일 출처 규칙(R-478 d)
      if (s.projection === null) expect(s.officialText + s.basisLine, ind.id).toContain(String(ind.latest.year));
      else expect(s.caption, ind.id).toContain(String(ind.latest.year));
    }
    expect(byId('tfr').valueText).not.toBe('0.68');
  });

  it('초혼 연령은 남자·여자 두 값을 함께 보인다 (R-147 b), 보조 계열이 같은 단위인 지표만 두 줄 이상 그린다', () => {
    const marriage = byId('first-marriage-age');
    const r = raw('first-marriage-age');
    expect(marriage.headlines.map((h) => h.label)).toEqual(['남자', '여자']);
    expect(marriage.headlines.map((h) => h.value)).toEqual(r.headline!.map((h) => formatNumber(h.value, r.decimals!)));
    expect(marriage.legend.map((l) => l.label)).toEqual(['남편(남자)', '아내(여자)']);
    expect(marriage.legend.map((l) => l.valueText)).toEqual([
      formatWithUnit(r.series!.slice(-1)[0].value, '세', r.decimals!),
      formatWithUnit(r.extraSeries![0].series.slice(-1)[0].value, '세', r.decimals!),
    ]);
    expect(byId('life-expectancy').legend.length).toBe(3);
    expect(byId('elderly-poverty').legend.length).toBe(2);
    // 단위가 다른 보조 계열(사교육비 만 원, 조혼인율)은 겹쳐 그리지 않는다
    expect(byId('private-education').legend.length).toBe(1);
    expect(byId('marriage-count').legend.length).toBe(1);
    // 선 모양이 계열마다 다르다(색에만 의존하지 않는다)
    expect(new Set(marriage.legend.map((l) => l.dash)).size).toBe(marriage.legend.length);
  });

  it('선 그래프의 x는 연도에 비례한다 (불규칙 간격: 자살률 2015·2017·…·2023·2024·2025)', () => {
    const s = byId('suicide-rate');
    expect(s.chart.kind).toBe('line');
    if (s.chart.kind !== 'line') return;
    const pts = s.chart.series[0].points;
    expect(pts.map((p) => p.year)).toEqual([2015, 2017, 2019, 2021, 2023, 2024, 2025]);
    const span = pts[pts.length - 1].x - pts[0].x;
    for (const p of pts) expect(p.x, `${p.year}`).toBeCloseTo(pts[0].x + ((p.year - 2015) / 10) * span, 0);
    // 2023→2024→2025는 간격이 1년이라 2015→2017(2년)의 절반이다
    expect(pts[5].x - pts[4].x).toBeCloseTo((pts[1].x - pts[0].x) / 2, 0);
  });

  it('조사 방법이 바뀐 연도(axis.breaks)에서 선이 끊긴다: 1인 가구 2015년', () => {
    const s = byId('single-household');
    if (s.chart.kind !== 'line') throw new Error('line');
    const segs = s.chart.series[0].segments.map((seg) => seg.map((p) => p.year));
    expect(segs.length).toBe(2);
    expect(segs[0][segs[0].length - 1]).toBe(2010);
    expect(segs[1][0]).toBe(2015);
  });

  it('막대 그래프는 큰 값부터 정렬되고 값 라벨이 있다. 긴 이름 「전남광주」는 짧게 쓰되 전체 이름은 보존한다', () => {
    const region = byId('region-population-registered');
    if (region.chart.kind !== 'bar') throw new Error('막대 그래프여야 한다');
    const values = region.chart.rows.map((r) => r.value);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(region.chart.rows[0].fullLabel).toBe('경기');
    const gwangju = region.chart.rows.find((r) => r.fullLabel.startsWith('전남광주'))!;
    expect(gwangju.label).toBe('전남광주');
    expect(region.chart.rows.every((r) => r.text.length > 0)).toBe(true);
    for (const row of region.chart.rows) expect(row.barWidth).toBeGreaterThan(0);
    expect(region.chart.rows[0].barWidth).toBeGreaterThan(region.chart.rows[region.chart.rows.length - 1].barWidth);
  });

  it('자살률 슬라이드: 값·기준 연도·출처와 상담전화(109, 24시간)가 같은 슬라이드 안에 있다 (SC6)', () => {
    const s = byId('suicide-rate');
    expect(s.valueText).toBe('27.8');
    // 값 옆 칸에는 단위 낱말만, 분모 문구는 기준 줄로(QM2-4): 예전에는 단위가 「인구 10만 명당 명」이라 「명당 명」이 겹쳐 읽혔다
    expect(s.unitText).toBe('명');
    expect(s.basisText).toBe('인구 10만 명당');
    expect(s.officialText).toBe('자살률(2025년)');
    expect(s.sourceText).toContain('국가데이터처');
    expect(s.safety).toEqual({ name: '자살예방 상담전화', number: '109', hours: '24시간' });
    // 다른 슬라이드에는 상담전화 안내가 없다
    for (const o of data.slides.filter((x) => x.id !== 'suicide-rate')) expect(o.safety, o.id).toBeNull();
    // 방법·장소·동기 서술이 없다
    expect([s.title, s.definition, s.seriesNote ?? '', s.chartLabel].join(' ')).not.toMatch(/방법|장소|동기|수단/);
    expect(TITLE_TEXT.helpLead).not.toMatch(/[!！]/);
  });

  it('순서: 첫째는 합계출산율, 자살률은 맨 앞·맨 뒤가 아니고, 접근자의 순서(CAROUSEL_ORDER)를 따른다', () => {
    const list = data.slides.map((s) => s.id);
    expect(list[0]).toBe('tfr');
    expect(list.indexOf('suicide-rate')).toBeGreaterThan(0);
    expect(list.indexOf('suicide-rate')).toBeLessThan(list.length - 1);
    expect(list).toEqual(CAROUSEL_ORDER.filter((id) => list.includes(id)));
    expect(ids(fileOf(base({ id: 'zzz-new' }), base({ id: 'tfr', title: '합계출산율' })))).toEqual(['tfr', 'zzz-new']);
  });

  /**
   * 조용한 탈락 금지 (REV-005-QI4-1 7절 1): `isDrawable`은 그릴 수 없는 지표를 조용히 뺀다 — 그래서 「슬라이드 20장 = CAROUSEL_ORDER 순서, 16~20번 id 일치」를 단언한다.
   * 한 장이라도 빠지거나 순서가 어긋나면 이 시험이 실패한다(데이터를 고쳤을 때 전망 슬라이드가 말없이 사라지지 않는다).
   */
  it('슬라이드 20장 = CAROUSEL_ORDER 순서이고 16~20번이 전망 5장(총인구·65세 이상 비율·1인 가구·폭염·아기)이다 — 그릴 수 있는 지표가 말없이 빠지지 않는다 (R-478 7절 1)', () => {
    const list = data.slides.map((s) => s.id);
    expect(list).toHaveLength(20);
    expect(list).toEqual([...CAROUSEL_ORDER]);
    expect(list.slice(15)).toEqual(['projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection', 'projection-newborn-age-structure']);
    expect(list.slice(0, 5)).toEqual(['tfr', 'births', 'cdr', 'elderly-poverty', 'income-gap-by-age']); // 격차는 elderly-poverty 바로 뒤
    // 접근자가 고른 20개 지표가 전부 그릴 수 있는 것이다(탈락 0)
    const picked = selectCarouselIndicators();
    expect(picked.map((i) => i.id)).toEqual([...CAROUSEL_ORDER]);
    for (const i of picked) expect(isDrawable(i), i.id).toBe(true);
    // 합계출산율 전망·future-projection은 캐러셀에 없다(마스터 결정 4)
    expect(list).not.toContain('projection-tfr');
    expect(list).not.toContain('future-projection');
    // 전망 슬라이드(칩 「전망」)는 정확히 5장, 격차·기존 14장은 칩이 없다
    expect(data.slides.filter((s) => s.projection !== null).map((s) => s.id)).toEqual(PROJECTION_IDS);
    // 공허 통과 방지: 전망 지표를 지우면 슬라이드가 줄어 이 시험이 실패한다
    const dropped = { ...REAL, indicators: REAL.indicators.filter((i) => i.id !== 'projection-aging-share') };
    expect(buildCarousel(dropped).slides.map((s) => s.id)).not.toEqual([...CAROUSEL_ORDER]);
  });

  it('슬라이드의 접근 가능한 이름: 「n/N 표제어, 공식 통계명(기준)」, 전망 슬라이드는 「n/N 전망, …」 (SH3 · FC2 — 색·아이콘 없이도 전한다)', () => {
    const plainName = slideReadName(byId('tfr'), 0, 20);
    expect(plainName).toBe('1/20 한 여성이 평생 낳을 아이는 몇 명일까?, 합계출산율(2025년)');
    const proj = byId('projection-population-total');
    expect(slideReadName(proj, 15, 20)).toBe('16/20 전망, 앞으로 인구는 어떻게 달라질까?, 장래인구추계 총인구(2023년 발표, 2022년 기준, 중위 추계)');
    expect(slideReadName(byId('income-gap-by-age'), 4, 20)).toBe('5/20 나이들수록 또래들과 경제력 차이가 극심해져요, 연령계층별 소득 5분위배율(2024년)');
    for (const s of data.slides) expect(slideReadName(s, 0, 20).includes('전망,') === (s.projection !== null), s.id).toBe(true);
  });
});

describe('그래프 크기는 화면에 그려지는 폭을 따른다 (R-206: 320px에서도 글자 12px 이상)', () => {
  it('chartSizeFor: 폭은 4px 단위 내림에 [220, 520]으로 묶고, 넓은 화면은 낮은 선 그래프·좁은(한 칸) 화면은 높은 선 그래프', () => {
    expect(chartSizeFor(254, false)).toEqual({ width: 252, lineHeight: LINE_H_STACKED });
    expect(chartSizeFor(389, true)).toEqual({ width: 388, lineHeight: LINE_H });
    expect(chartSizeFor(294, false).width).toBe(292);
    expect(chartSizeFor(100, true).width).toBe(CHART_MIN_W);
    expect(chartSizeFor(5000, false).width).toBe(CHART_MAX_W);
    expect(chartSizeFor(Number.NaN, true).width).toBe(LINE_W);
    expect(chartSizeFor(Number.POSITIVE_INFINITY, true).width).toBe(LINE_W);
    expect(LINE_H_STACKED).toBeGreaterThan(LINE_H);
    expect(DEFAULT_CHART_SIZE).toEqual({ width: LINE_W, lineHeight: LINE_H });
  });

  it('좌표계 폭이 그려지는 폭과 같다: 선 그래프는 그래프 영역·마지막 값 글자 자리가 폭에 맞고, 막대는 폭 안에 들어가며, 어느 폭에서도 값 글자가 폭 밖으로 나가지 않는다 — 20장 (막대 셋·두 구간 막대·누적 막대 포함)', () => {
    for (const w of [220, 252, 292, 320, 388, 428, 520]) {
      const data = buildCarousel(undefined, { width: w, lineHeight: LINE_H });
      expect(data.slides, `${w}`).toHaveLength(20);
      for (const s of data.slides) {
        expect(s.chart.width, `${s.id} ${w}`).toBe(w);
        if (s.chart.kind === 'line') {
          expect(s.chart.plotRight, s.id).toBe(w - 66);
          for (const p of s.chart.series.flatMap((x) => x.points)) {
            expect(p.x, `${s.id} ${w}`).toBeGreaterThanOrEqual(s.chart.plotLeft);
            expect(p.x, `${s.id} ${w}`).toBeLessThanOrEqual(s.chart.plotRight + 0.1);
          }
          for (const l of s.chart.labels) expect(l.x, `${s.id} ${w} 값 글자 시작`).toBeLessThan(w); // 마지막 값 글자는 오른쪽 66칸 안에서 시작한다
        } else if (s.chart.kind === 'bar') {
          for (const r of s.chart.rows) {
            expect(s.chart.barX + r.barWidth, `${s.id} ${r.fullLabel} ${w} 막대 끝`).toBeLessThanOrEqual(w - 84 + 0.1); // 값 글자(84칸)를 위한 자리가 남는다
            expect(r.barWidth).toBeGreaterThan(0);
          }
        } else if (s.chart.kind === 'bars') {
          // 폭염 막대 셋·격차 두 구간 막대: 막대 끝 + 값 글자(굵게)가 폭 안에 든다
          for (const r of s.chart.rows) {
            expect(r.barWidth, `${s.id} ${r.label} ${w}`).toBeGreaterThan(0);
            expect(s.chart.barX + r.barWidth + (r.bold ? 6 : 4) + estimateLabelWidth(r.text, r.bold), `${s.id} ${r.label} ${w} 막대 + 값 글자`).toBeLessThanOrEqual(w + 0.1);
          }
        } else {
          // 아기 누적 막대: 세 칸이 막대 전체 폭(100%)을 빈틈없이 채우고, 오른쪽 값 글자가 폭 안에 든다
          for (const r of s.chart.rows) {
            expect(r.young.width + r.work.width + r.old.width, `${s.id} ${r.year} ${w} 세 칸 합`).toBeCloseTo(s.chart.barWidth, 0);
            expect(r.old.x + r.old.width, `${s.id} ${r.year} ${w} 막대 끝`).toBeLessThanOrEqual(s.chart.barX + s.chart.barWidth + 0.2);
            expect(r.valueX + estimateLabelWidth(r.valueText, true), `${s.id} ${r.year} ${w} 값 글자`).toBeLessThanOrEqual(w + 0.1);
          }
        }
      }
    }
  });

  it('선 그래프 높이는 요청한 높이, 막대 그래프 높이는 행 수 × 행 높이다 — 폭과 무관한 값은 그대로다 (글자 크기는 CSS의 13px 한 곳) · 새 막대 둘(막대 셋·누적)은 높이가 폭·선 높이와 무관하다', () => {
    const wide = buildCarousel(undefined, { width: 388, lineHeight: LINE_H });
    const narrow = buildCarousel(undefined, { width: 252, lineHeight: LINE_H_STACKED });
    for (let i = 0; i < wide.slides.length; i++) {
      const a = wide.slides[i].chart;
      const b = narrow.slides[i].chart;
      if (a.kind === 'line' && b.kind === 'line') {
        expect([a.height, b.height], wide.slides[i].id).toEqual([LINE_H, LINE_H_STACKED]);
      } else if (a.kind === 'bar' && b.kind === 'bar') {
        expect(a.height).toBe(a.rows.length * BAR_ROW_H + 4);
        expect(b.height).toBe(a.height);
        expect(a.rows.map((r) => [r.fullLabel, r.value, r.text])).toEqual(b.rows.map((r) => [r.fullLabel, r.value, r.text])); // 값은 폭과 무관하다
      } else if (a.kind === 'bars' && b.kind === 'bars') {
        expect(b.height, wide.slides[i].id).toBe(a.height);
        expect(a.rows.map((r) => [r.fullLabel, r.value, r.text, r.proj])).toEqual(b.rows.map((r) => [r.fullLabel, r.value, r.text, r.proj]));
      } else if (a.kind === 'stack' && b.kind === 'stack') {
        expect(b.height, wide.slides[i].id).toBe(a.height);
        expect(a.rows.map((r) => [r.age, r.year, r.valueText, r.work.text])).toEqual(b.rows.map((r) => [r.age, r.year, r.valueText, r.work.text]));
      } else {
        throw new Error('종류가 폭에 따라 바뀌면 안 된다');
      }
      expect(wide.slides[i].valueText).toBe(narrow.slides[i].valueText);
      expect(wide.slides[i].chartLabel).toBe(narrow.slides[i].chartLabel);
    }
  });

  it('값 라벨이 세로로 겹치지 않고 그래프 영역 밖(위·아래)으로 나가지 않는다: 낮은 선 그래프(180)와 높은 선 그래프(232) 모두 — 전망 선 그래프의 끝 글자(중위 끝값·「고위」·「저위」)도 12.9 이상 벌어진다', () => {
    for (const lineHeight of [LINE_H, LINE_H_STACKED]) {
      const data = buildCarousel(undefined, { width: 252, lineHeight });
      for (const s of data.slides) {
        if (s.chart.kind !== 'line') continue;
        for (const l of [...s.chart.labels, ...s.chart.xLabels]) {
          expect(l.y, `${s.id} ${lineHeight}`).toBeGreaterThan(0);
          expect(l.y, `${s.id} ${lineHeight}`).toBeLessThanOrEqual(lineHeight);
        }
        // 마지막 값 글자 = 굵은 값과 띠 끝 글자(「고위」「저위」) — 오른쪽 끝에 놓이는 글자들이 서로 겹치지 않는다
        const lasts = s.chart.labels.filter((l) => l.bold || l.tone === 'range').map((l) => l.y).sort((a, b) => a - b);
        for (let k = 1; k < lasts.length; k++) expect(lasts[k] - lasts[k - 1], `${s.id} 마지막 값 라벨 간격`).toBeGreaterThanOrEqual(12.9);
      }
    }
  });

  it('막대 행마다 단위를 붙인 값(valueWithUnit)이 있다 — 그래프 밖 표(R-207)가 읽는다', () => {
    const data = buildCarousel();
    for (const id of ['region-population-registered', 'tfr-by-sido']) {
      const s = data.slides.find((x) => x.id === id)!;
      if (s.chart.kind !== 'bar') throw new Error('bar');
      for (const r of s.chart.rows) {
        expect(r.valueWithUnit.startsWith(r.text), `${id} ${r.fullLabel}`).toBe(true);
        expect(r.valueWithUnit.length).toBeGreaterThan(r.text.length); // 단위가 붙었다
      }
    }
  });
});

describe('선 그래프의 처음 값 글자 자리 (REV-003-M2-2 R-225)', () => {
  /** 그래프를 실제로 쓰이는 폭들로 만든다: 320px 화면의 그래프 폭 252(쌓인 레이아웃 높이 232) · 360px 292 · 데스크톱 열 약 390. 220은 지원 최소 폭(그 아래 화면은 없다)이라 따로 보지 않는다. */
  const WIDTHS = [252, 292, 320, 360, 388, 428, 520];
  const HEIGHTS = [LINE_H, LINE_H_STACKED];
  /**
   * 조건부로 허용된 겹침 목록 (SPEC-003 QM2-8, 마스터 확정): 처음 값 글자가 **자기 선**에 걸리는 것을 피할 자리가 정말 없는 (지표, 폭) 조합.
   *  - 평균 수명: 계열 셋이 비슷한 높이로 나란히 올라 어느 자리도 선을 피할 수 없다(전 폭).
   *  - 혼인 건수: 첫해에 가파르게 꺾여 피할 자리가 없다(전 폭).
   *  - 고령인구 비율: 바닥에서 가파르게 시작해 위·아래 어디도 비지 않는다 — 320px 화면(그래프 폭 252, 쌓인 레이아웃 높이 232)에서만.
   * 목록 밖의 새 겹침은 **실패**다. 목록은 늘리지 않는 것이 원칙이고, 값 갱신·지표 추가로 늘어날 때는 사유를 남긴다(아래 테스트의 사유 단언).
   * 허용되는 것은 그 지표 자신의 선과의 겹침뿐이다 — 다른 글자·점(마커)·축 글자·다른 값 글자와의 겹침은 목록 안에서도 0이어야 한다.
   */
  const KNOWN_FIRST_LABEL_OVERLAPS: ReadonlyArray<{ id: string; /** 겹침이 남는 그래프 폭들(없으면 전 폭) */ widths?: readonly number[]; /** 겹침이 남는 선 그래프 높이(없으면 둘 다) */ lineHeight?: number }> = [
    { id: 'life-expectancy' },
    { id: 'marriage-count' },
    { id: 'aging-rate', widths: [252], lineHeight: LINE_H_STACKED },
  ];
  const isKnownOverlap = (id: string, width: number, lineHeight: number): boolean =>
    KNOWN_FIRST_LABEL_OVERLAPS.some((k) => k.id === id && (k.widths === undefined || k.widths.includes(width)) && (k.lineHeight === undefined || k.lineHeight === lineHeight));

  const raw0 = (id: string) => REAL.indicators.find((i) => i.id === id)!;
  // 보통 선 그래프만 — 전망 선 그래프(경계·띠가 있다: chart.split)는 처음 값 글자 자리 규칙이 다르다(r2 R-487 후보 4곳, tests/slideForms.test.ts가 따로 잠근다)
  const lineSlides = (width: number, lineHeight: number) => buildCarousel(undefined, { width, lineHeight }).slides.flatMap((s) => (s.chart.kind === 'line' && s.chart.split === null ? [{ id: s.id, chart: s.chart as LineChartModel }] : []));
  /** 처음 값 글자(굵지 않고, 계열의 첫 점 x에서 시작하며, 글자가 그 계열의 첫 값) */
  const firstLabels = (chart: LineChartModel) =>
    chart.series.flatMap((ser) => {
      const lab = chart.labels.find((l) => !l.bold && l.x === ser.first.x && l.text === ser.first.text);
      return lab === undefined ? [] : [{ ser, lab }];
    });
  /** 글자 사각형이 닿는 것: 모든 계열의 선분 수 + 모든 점 사각형 수 + 이 글자와 겹치는 다른 처음 값 글자 수 */
  function hitsOf(chart: LineChartModel, rect: ReturnType<typeof labelRect>, self: object): { lines: number; dots: number; labels: number } {
    let lines = 0;
    for (const sr of chart.series) for (const seg of sr.segments) for (let k = 1; k < seg.length; k++) if (segmentHitsRect(seg[k - 1].x, seg[k - 1].y, seg[k].x, seg[k].y, rect)) lines++;
    let dots = 0;
    for (const sr of chart.series) {
      const drawn = sr.points.length <= 20 ? sr.points : [sr.last];
      for (const p of drawn) {
        const r = (p === sr.last ? 4.5 : 3) + 2.5;
        if (rect.left < p.x + r && p.x - r < rect.right && rect.top < p.y + r && p.y - r < rect.bottom) dots++;
      }
    }
    let labels = 0;
    for (const o of firstLabels(chart)) {
      if (o.lab === self) continue;
      const q = labelRect(o.lab.x, o.lab.y, o.lab.text);
      if (rect.left < q.right && q.left < rect.right && rect.top < q.bottom && q.top < rect.bottom) labels++;
    }
    return { lines, dots, labels };
  }

  it('segmentHitsRect: 끝점이 안에 있거나 변과 교차하면 true, 비껴가면 false (경계 포함)', () => {
    const r = { left: 10, top: 10, right: 30, bottom: 20 };
    expect(segmentHitsRect(0, 15, 40, 15, r), '가로로 관통').toBe(true);
    expect(segmentHitsRect(15, 12, 18, 14, r), '완전히 안').toBe(true);
    expect(segmentHitsRect(0, 0, 20, 30, r), '비스듬히 가로지름(y=15에서 x=10)').toBe(true);
    expect(segmentHitsRect(0, 25, 40, 25, r), '아래로 비낌').toBe(false);
    expect(segmentHitsRect(0, 0, 8, 30, r), '왼쪽으로 비낌').toBe(false);
    expect(segmentHitsRect(35, 0, 35, 40, r), '오른쪽 세로선').toBe(false);
    expect(segmentHitsRect(0, 10, 10, 10, r), '모서리에 닿으면 겹침').toBe(true);
    // 사각형 바깥에서 대각선이 모서리 바로 옆을 지나가는 경우(경계 상자는 겹치지만 교차하지 않는다)
    expect(segmentHitsRect(0, 14, 16, 0, r), '왼쪽 위 모서리 바깥을 비껴감').toBe(false);
  });

  it('estimateLabelWidth: 숫자·점·쉼표만으로 폭을 어림한다(굵은 글자는 조금 더 넓다) — 실제 글자 폭(13px)을 넉넉히 덮는다', () => {
    expect(estimateLabelWidth('27.7', false)).toBeGreaterThanOrEqual(27);
    expect(estimateLabelWidth('27.7', true)).toBeGreaterThan(estimateLabelWidth('27.7', false));
    expect(estimateLabelWidth('295,137', false)).toBeGreaterThan(estimateLabelWidth('27.7', false));
    expect(estimateLabelWidth('', false)).toBe(1);
  });

  it('초혼 연령(남녀 두 계열)의 처음 값 글자는 어느 폭·높이에서도 선·점·다른 처음 값 글자와 겹치지 않는다 — 320px 화면(폭 252, 높이 232)에서 「27.7」에 선이 걸리던 문제', () => {
    for (const lineHeight of HEIGHTS) {
      for (const width of WIDTHS) {
        const s = lineSlides(width, lineHeight).find((x) => x.id === 'first-marriage-age')!;
        const fl = firstLabels(s.chart);
        expect(fl.length, `${width}x${lineHeight} 처음 값 글자가 계열마다 있다`).toBe(s.chart.series.length);
        expect(s.chart.series.length).toBeGreaterThanOrEqual(2); // 남녀 두 계열(공허 통과 방지)
        for (const { lab } of fl) {
          const h = hitsOf(s.chart, labelRect(lab.x, lab.y, lab.text), lab);
          expect(h, `${width}x${lineHeight} ${lab.text}`).toEqual({ lines: 0, dots: 0, labels: 0 });
        }
      }
    }
  });

  it('허용 목록(KNOWN_FIRST_LABEL_OVERLAPS) 밖의 모든 (선 그래프, 폭, 높이)에서 처음 값 글자는 선·점·다른 처음 값 글자와 겹치지 않는다 — 목록 밖의 새 겹침은 실패 (QM2-8)', () => {
    let checked = 0;
    for (const lineHeight of HEIGHTS) {
      for (const width of WIDTHS) {
        for (const s of lineSlides(width, lineHeight)) {
          if (isKnownOverlap(s.id, width, lineHeight)) continue;
          for (const { lab } of firstLabels(s.chart)) {
            checked++;
            expect(hitsOf(s.chart, labelRect(lab.x, lab.y, lab.text), lab), `${s.id} ${width}x${lineHeight} ${lab.text} — 허용 목록에 없는 새 겹침`).toEqual({ lines: 0, dots: 0, labels: 0 });
          }
        }
      }
    }
    expect(checked, '실제로 검사한 글자 수(공허 통과 방지)').toBeGreaterThan(150);
  });

  /** 처음 값 글자 사각형이 겹치는 다른 글자: 가로축 글자(처음·마지막 연도)와 계열의 마지막 값 글자 */
  function otherTextHits(chart: LineChartModel, rect: ReturnType<typeof labelRect>): string[] {
    const hits: string[] = [];
    for (const l of chart.xLabels) {
      const w = estimateLabelWidth(l.text, l.bold);
      const q = { left: l.anchor === 'end' ? l.x - w : l.anchor === 'middle' ? l.x - w / 2 : l.x, top: l.y - 11, right: l.anchor === 'end' ? l.x : l.anchor === 'middle' ? l.x + w / 2 : l.x + w, bottom: l.y + 3 };
      if (rect.left < q.right && q.left < rect.right && rect.top < q.bottom && q.top < rect.bottom) hits.push(`가로축 글자 ${l.text}`);
    }
    for (const l of chart.labels.filter((x) => x.bold)) {
      const q = labelRect(l.x, l.y, l.text, true);
      if (rect.left < q.right && q.left < rect.right && rect.top < q.bottom && q.top < rect.bottom) hits.push(`마지막 값 글자 ${l.text}`);
    }
    return hits;
  }

  it('허용 목록 안에서도 겹침은 그 지표 자신의 선뿐이다: 점(마커)·가로축 글자·다른 값 글자와의 겹침은 0 (QM2-8 ①)', () => {
    let checked = 0;
    for (const lineHeight of HEIGHTS) {
      for (const width of WIDTHS) {
        for (const s of lineSlides(width, lineHeight)) {
          for (const { lab } of firstLabels(s.chart)) {
            const rect = labelRect(lab.x, lab.y, lab.text);
            const h = hitsOf(s.chart, rect, lab);
            checked++;
            expect(h.dots, `${s.id} ${width}x${lineHeight} ${lab.text}: 점(마커)과 겹침`).toBe(0);
            expect(h.labels, `${s.id} ${width}x${lineHeight} ${lab.text}: 다른 처음 값 글자와 겹침`).toBe(0);
            expect(otherTextHits(s.chart, rect), `${s.id} ${width}x${lineHeight} ${lab.text}`).toEqual([]);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it('허용 목록은 낡지 않는다: 목록의 모든 항목은 실제로 선에 걸리는 (지표, 폭)을 가리키고, 걸리지 않는 폭은 목록이 감싸지 않는다 — 목록은 늘리지 않는 것이 원칙(QM2-8 ②)', () => {
    for (const k of KNOWN_FIRST_LABEL_OVERLAPS) {
      let overlapping = 0;
      for (const lineHeight of HEIGHTS) {
        for (const width of WIDTHS) {
          if (!isKnownOverlap(k.id, width, lineHeight)) continue;
          const s = lineSlides(width, lineHeight).find((x) => x.id === k.id)!;
          for (const { lab } of firstLabels(s.chart)) if (hitsOf(s.chart, labelRect(lab.x, lab.y, lab.text), lab).lines > 0) overlapping++;
        }
      }
      expect(overlapping, `${k.id}: 허용 목록에 있지만 선에 걸리는 경우가 하나도 없다 — 목록에서 뺀다`).toBeGreaterThan(0);
    }
    // 허용 목록의 크기를 못 박는다: 지금은 셋뿐이다
    expect(KNOWN_FIRST_LABEL_OVERLAPS.map((k) => k.id)).toEqual(['life-expectancy', 'marriage-count', 'aging-rate']);
  });

  it('겹침을 허용하는 근거가 화면에 있다: 처음 값은 그래프의 대체 텍스트(aria-label)에 「처음 N(연도)」로 다시 적혀 있고, 글자는 카드 바탕색 테두리로 읽힌다 (QM2-8 ⑤)', () => {
    // 같은 값이 다른 곳에도 있다 — 지표마다 처음 값은 chartLabel에, 마지막(최근) 값은 큰 숫자·범례에 있다. (명세 ⑤는 「큰 숫자·범례·숨긴 표」라 적었지만 처음 값은 그 셋에 없다 — 대체 텍스트가 유일한 다른 곳이다. ai-log 참고)
    for (const k of KNOWN_FIRST_LABEL_OVERLAPS) {
      const slide = buildCarousel().slides.find((s) => s.id === k.id)!;
      if (slide.chart.kind !== 'line') throw new Error(`${k.id}: 선 그래프여야 한다`);
      for (const ser of slide.chart.series) {
        expect(slide.chartLabel, `${k.id} ${ser.label}`).toContain(`처음 ${formatWithUnit(ser.first.value, raw0(k.id).unit ?? raw0(k.id).latestUnit ?? '', raw0(k.id).decimals ?? 0)}(${ser.first.year}년)`);
      }
    }
  });

  it('겹침을 허용하는 글자의 모양(QM2-8 ③④): 글자는 선 위에 그려지고(paint-order: stroke) 카드 바탕색 테두리 ≥ 3px, 글자 크기 ≥ 12px, 글자 색의 카드 바탕 대비 ≥ 4.5:1 (라이트·다크)', () => {
    const rule = /\.chart text\s*\{([^}]*)\}/.exec(titleCss)?.[1] ?? '';
    expect(rule, 'title.css에 .chart text 규칙이 있다').not.toBe('');
    expect(rule).toMatch(/paint-order:\s*stroke/);
    expect(rule).toMatch(/stroke:\s*var\(--c-surface\)/); // 카드 바탕색(.card background: var(--c-surface))
    expect(parseFloat(/stroke-width:\s*([\d.]+)px/.exec(rule)?.[1] ?? '0')).toBeGreaterThanOrEqual(3);
    expect(parseFloat(/font-size:\s*([\d.]+)px/.exec(rule)?.[1] ?? '0'), '그래프 글자 크기(1칸 = 1px, R-206)').toBeGreaterThanOrEqual(12);
    expect(/\.card\s*\{[^}]*background:\s*var\(--c-surface\)/.test(titleCss), '카드 바탕이 테두리와 같은 토큰이다').toBe(true);
    const blocks = readThemeBlocks(tokensCss);
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      for (const fill of ['--c-text-2', '--c-text']) {
        // 일반 값 글자는 --c-text-2, 굵은 마지막 값 글자(.val)는 --c-text
        expect(contrastRatio(parseHex(t[fill]), parseHex(t['--c-surface'])), `${theme} ${fill} 대 카드 바탕`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(/\.chart text\s*\{[^}]*fill:\s*var\(--c-text-2\)/.test(titleCss)).toBe(true);
    expect(/\.chart \.val\s*\{[^}]*fill:\s*var\(--c-text\)/.test(titleCss)).toBe(true);
  });

  it('겹침이 피할 수 없는 지표에서도 예전 자리(점 바로 위)보다 선에 덜 걸리거나 같다 — 나빠지지 않는다', () => {
    for (const lineHeight of HEIGHTS) {
      for (const width of WIDTHS) {
        for (const s of lineSlides(width, lineHeight)) {
          for (const { ser, lab } of firstLabels(s.chart)) {
            const now = hitsOf(s.chart, labelRect(lab.x, lab.y, lab.text), lab).lines;
            const before = hitsOf(s.chart, labelRect(ser.first.x, Math.round((ser.first.y - 8) * 10) / 10, ser.first.text), lab).lines;
            expect(now, `${s.id} ${width}x${lineHeight}`).toBeLessThanOrEqual(before);
          }
        }
      }
    }
  });

  it('처음 값 글자는 그래프 영역 안(위쪽 가장자리 아래, 가로축 위)에 있고 글자 내용은 계열의 첫 값이다', () => {
    for (const lineHeight of HEIGHTS) {
      for (const width of WIDTHS) {
        for (const s of lineSlides(width, lineHeight)) {
          for (const { ser, lab } of firstLabels(s.chart)) {
            const r = labelRect(lab.x, lab.y, lab.text);
            expect(r.top, `${s.id} ${width}x${lineHeight}`).toBeGreaterThanOrEqual(1);
            // 피할 자리가 없어 가로축을 넘는 경우는 허용하지 않는다: 그래프 영역 밖(아래)으로 나간 자리는 고르지 않는다
            expect(r.bottom, `${s.id} ${width}x${lineHeight} ${lab.text}`).toBeLessThanOrEqual(s.chart.axisY);
            expect(lab.text).toBe(ser.first.text);
            expect(lab.anchor).toBe('start');
            expect(lab.x).toBe(ser.first.x);
          }
        }
      }
    }
  });
});

describe('슬라이드 모델 세부', () => {
  const usable = (ind: RawIndicator) => createStatsAccess(fileOf(ind)).getUsableIndicator(ind.id)!;

  it('axis.breaks(조사 방법이 바뀐 연도)에서는 앞 점과 선을 잇지 않는다 (선분이 나뉜다), breaks가 없으면 하나로 이어진다', () => {
    const ind = base({
      id: 'brk',
      series: [
        { year: 2010, value: 1 },
        { year: 2011, value: 2 },
        { year: 2015, value: 3 },
        { year: 2016, value: 4 },
      ],
      latest: { year: 2016, value: 4 },
      axis: { scale: 'year', step: null, regular: false, gaps: [{ from: 2011, to: 2015 }], breaks: [{ year: 2015, note: '조사 방식 변경' }] },
    });
    const s = buildSlide(usable(ind))!;
    if (s.chart.kind !== 'line') throw new Error('line');
    expect(s.chart.series[0].segments.map((seg) => seg.map((p) => p.year))).toEqual([
      [2010, 2011],
      [2015, 2016],
    ]);
    const s3 = buildSlide(usable({ ...ind, axis: undefined }))!;
    if (s3.chart.kind !== 'line') throw new Error('line');
    expect(s3.chart.series[0].segments.length).toBe(1);
  });

  it('값 라벨은 계열마다 처음·마지막이 있고, 세로로 겹치면 벌어진다', () => {
    const data = buildCarousel();
    for (const s of data.slides) {
      if (s.chart.kind !== 'line' || s.chart.split !== null) continue; // 보통 선 그래프 — 전망 선 그래프는 마지막 값 글자 하나 + 띠 끝 글자(tests/slideForms.test.ts)
      const lasts = s.chart.labels.filter((l) => l.bold).map((l) => l.y);
      expect(lasts.length, s.id).toBe(s.chart.series.length);
      const sorted = [...lasts].sort((a, b) => a - b);
      for (let k = 1; k < sorted.length; k++) expect(sorted[k] - sorted[k - 1], `${s.id} 마지막 값 라벨 간격`).toBeGreaterThanOrEqual(12.9);
    }
  });

  it('spreadY: 가까운 값은 최소 간격으로 벌리고, 범위를 넘으면 위로 밀어 올린다', () => {
    expect(spreadY([50, 52, 100], 13, 0, 200)).toEqual([50, 63, 100]);
    expect(spreadY([100, 98], 13, 0, 200)).toEqual([111, 98]); // 입력 순서대로 돌려준다
    const out = spreadY([195, 196, 197], 13, 0, 200);
    expect(Math.max(...out)).toBeLessThanOrEqual(200);
    expect(out[1] - out[0]).toBeGreaterThanOrEqual(13);
    expect(out[2] - out[1]).toBeGreaterThanOrEqual(13);
    expect(spreadY([], 13, 0, 10)).toEqual([]);
  });

  it('공식 통계명 줄의 기준 문구(SH3): 없으면 latest.year 「N년」, 데이터의 scopeLabel이 월 기준이면 「2026년 9월」(범위 설명은 withScope일 때만). 표제어가 없는 지표(시험용 가짜)는 지표 이름으로 대신한다. sourceOrgsOf는 가운뎃점으로 묶인 기관을 나눈다', () => {
    expect(buildSlide(usable(base({ latest: { year: 2025, value: 1 } })))!.officialText).toBe('가짜 지표(2025년)');
    expect(buildSlide(usable(base({ scopeLabel: '2026년 9월 기준(16개 시·도)' })))!.officialText).toBe('가짜 지표(2026년 9월)');
    expect(buildSlide(usable(base({ latest: { year: 2025, value: 1 } })))!.insight).toBe('가짜 지표');
    expect(buildSlide(usable(base({ latest: { year: 2025, value: 1 } })))!.basisText).toBeNull();
    expect(officialBasisOf({ latest: { year: 2025, value: 1 }, scopeLabel: '2025년 기준(17개 시·도)' }, true)).toBe('2025년, 17개 시·도');
    expect(officialBasisOf({ latest: { year: 2025, value: 1 }, scopeLabel: '2025년 기준(17개 시·도)' }, false)).toBe('2025년');
    expect(officialBasisOf({ latest: { year: 2025, value: 1 }, scopeLabel: '2026년 9월 기준(16개 시·도, 주민등록)' }, true)).toBe('2026년 9월, 16개 시·도'); // 괄호 안 첫 항목만(R-446 b)
    expect(officialBasisOf({ latest: { year: 2025, value: 1 }, scopeLabel: '읽을 수 없는 모양' }, true)).toBe('2025년'); // 범위 문구가 이상하면 latest.year로 돌아간다
    expect(sourceOrgsOf('국가데이터처·교육부')).toEqual(['국가데이터처', '교육부']);
    expect(sourceOrgsOf('행정안전부')).toEqual(['행정안전부']);
  });

  it('막대 그래프 지표는 전국 값 라벨(latestLabel)이 있을 때만 큰 글씨 값을 보인다', () => {
    const bar = (extra: Partial<RawIndicator>) =>
      base({
        id: 'bar-x',
        kind: 'bar',
        series: [
          { label: '가', value: 5 },
          { label: '나', value: 3 },
        ],
        latest: { year: 2025, value: 8 },
        decimals: 0,
        ...extra,
      });
    expect(buildSlide(usable(bar({})))!.valueText).toBeNull();
    expect(buildSlide(usable(bar({})))!.headlines).toEqual([]);
    const withLabel = buildSlide(usable(bar({ latestLabel: '전국 합계(명)' })))!;
    expect(withLabel.valueText).toBe('8');
    expect(withLabel.caption).toBe('전국 합계(명)');
  });
});

describe('동작 규칙 (SC5)', () => {
  it('자동 전환 주기는 9초다 (SPEC-005 마스터 결정 M8 일부 — 표제어·공식 통계명이 늘어 읽을 글이 많아졌다. SPEC-003 SC5의 7초를 대체한다)', () => {
    expect(AUTO_ADVANCE_MS).toBe(9000);
  });

  it('nextSlideIndex: 한 칸 이동, 끝에서는 반대쪽 끝으로 돈다, 잘못된 입력에도 범위 안', () => {
    expect(nextSlideIndex(0, 14, 1)).toBe(1);
    expect(nextSlideIndex(13, 14, 1)).toBe(0);
    expect(nextSlideIndex(0, 14, -1)).toBe(13);
    expect(nextSlideIndex(5, 14, -1)).toBe(4);
    expect(nextSlideIndex(3, 0, 1)).toBe(0);
    expect(nextSlideIndex(Number.NaN, 5, 1)).toBe(1);
    expect(nextSlideIndex(7, 5, 1)).toBe(3); // 범위를 넘은 값도 돌려서 맞춘다
    for (let n = 1; n <= 20; n++) for (let i = 0; i < n; i++) for (const step of [1, -1] as const) {
      const r = nextSlideIndex(i, n, step);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(n);
    }
  });

  it('shouldAutoAdvance: 사용자가 멈췄거나 포인터가 올라갔거나 포커스가 있거나 움직임 줄이기이거나 탭이 가려졌거나 슬라이드가 하나뿐이면 돌지 않는다 (WCAG 2.2.2)', () => {
    const run = { count: 14, paused: false, hovering: false, focusWithin: false, reducedMotion: false, pageHidden: false };
    expect(shouldAutoAdvance(run)).toBe(true);
    for (const stop of [{ paused: true }, { hovering: true }, { focusWithin: true }, { reducedMotion: true }, { pageHidden: true }, { count: 1 }, { count: 0 }]) {
      expect(shouldAutoAdvance({ ...run, ...stop }), JSON.stringify(stop)).toBe(false);
    }
  });

  it('shouldAutoAdvance: 「펼쳐 보기」로 연 슬라이드가 있는 동안(veilOpen)에도 돌지 않고, 접으면(false) 안 준 것과 같이 돈다 — 마스터 결정 ③, 터치 포함', () => {
    const run = { count: 20, paused: false, hovering: false, focusWithin: false, reducedMotion: false, pageHidden: false };
    expect(shouldAutoAdvance({ ...run, veilOpen: true }), '펼친 동안 멈춤').toBe(false);
    expect(shouldAutoAdvance({ ...run, veilOpen: false }), '접으면 다시 돈다').toBe(true);
    expect(shouldAutoAdvance(run), 'veilOpen을 주지 않으면 이전과 같다(가림을 쓰지 않는 호출자)').toBe(true);
  });

  it('swipeStep: 가로로 40px 이상이고 세로보다 클 때만. 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전', () => {
    expect(swipeStep(-60, 5)).toBe(1);
    expect(swipeStep(60, -5)).toBe(-1);
    expect(swipeStep(-39, 0)).toBeNull();
    expect(swipeStep(-60, 70)).toBeNull(); // 세로 스크롤
    expect(swipeStep(-60, -60)).toBeNull();
    expect(swipeStep(Number.NaN, 0)).toBeNull();
    expect(swipeStep(-30, 0, 20)).toBe(1);
  });

  it('showDots: 점은 슬라이드가 2~5개일 때만 그린다 — 14개를 점으로 늘어놓으면 두 줄로 꺾인다 (R-133)', () => {
    expect(CAROUSEL_MAX_DOTS).toBe(5);
    expect([0, 1].map(showDots)).toEqual([false, false]); // 하나뿐이면 고를 것이 없다
    expect([2, 3, 4, 5].map(showDots)).toEqual([true, true, true, true]);
    expect([6, 10, 14].map(showDots)).toEqual([false, false, false]);
    expect(showDots(buildCarousel().slides.length), '실제 캐러셀(지표 14개)은 점 없이 「3 / 14」로 보인다').toBe(false);
  });

  it('점 버튼의 접근 가능한 이름은 「3/5 합계출산율」 형식이다 (SC5)', () => {
    expect(dotLabel(2, 14, '합계출산율')).toBe('3/14 합계출산율');
    const slides = buildCarousel().slides;
    expect(dotLabel(0, slides.length, slides[0].title)).toBe(`1/${slides.length} ${slides[0].title}`);
  });
});

describe('자동 전환 재개 — 포인터 종류 (SPEC-003 QM2-2 I4)', () => {
  it('pointerCountsAsHover: 마우스·펜은 「카드 위」로 세고 터치는 세지 않는다 — 탭·스와이프 뒤에 「올라가 있는」 상태가 남아 자동 전환이 멈춘 채 남지 않는다', () => {
    expect(pointerCountsAsHover('mouse')).toBe(true);
    expect(pointerCountsAsHover('pen')).toBe(true);
    expect(pointerCountsAsHover('touch')).toBe(false);
    expect(pointerCountsAsHover('')).toBe(true); // 모르는 종류는 마우스처럼
  });

  it('멈춤 사유 넷(일시정지·포인터·키보드 포커스·탭 가림)은 하나라도 남아 있으면 멈추고 모두 풀려야 재개한다 (I1)', () => {
    const idle = { count: 14, paused: false, hovering: false, focusWithin: false, reducedMotion: false, pageHidden: false };
    expect(shouldAutoAdvance(idle)).toBe(true);
    const reasons = ['paused', 'hovering', 'focusWithin', 'pageHidden'] as const;
    // 2^4 = 16가지 조합: 사유가 하나라도 켜져 있으면 멈춤, 모두 꺼졌을 때만 재개
    for (let mask = 0; mask < 16; mask++) {
      const state = { ...idle };
      reasons.forEach((r, bit) => {
        state[r] = (mask & (1 << bit)) !== 0;
      });
      expect(shouldAutoAdvance(state), JSON.stringify(state)).toBe(mask === 0);
    }
  });
});

describe('단위·기준 문구 결합 규칙 (SPEC-003 QM2-4: 값 옆 칸은 단위 낱말만, 분모 문구는 기준 줄로)', () => {
  const data = buildCarousel();
  const byId = (id: string) => data.slides.find((s) => s.id === id)!;
  const raw = (id: string) => REAL.indicators.find((i) => i.id === id)!;
  /** 기존 14장 */
  const original = data.slides.filter((s) => ORIGINAL_IDS.includes(s.id));

  /** 금지 패턴(QM2-4 완료 기준 a)은 e2e/carouselForms.ts의 것을 쓴다 — 모델(여기)과 실제 화면(e2e/slide-text.spec.ts)이 같은 패턴으로 판정한다 */

  /** 슬라이드가 화면에 내놓는 글자 전부: 값 줄·단위·기준 줄·정의·범례·그래프 라벨(대체 텍스트·값 글자·가로축)·숨긴 표 머리글·캡션 */
  function textsOf(s: ReturnType<typeof byId>): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    out.push(['값 줄', s.headlines.map((h) => `${h.label ?? ''} ${h.value}${s.unitText}`).join(' / ')]);
    out.push(['단위', s.unitText], ['기준 줄', s.basisText ?? ''], ['통계 기준 줄', s.basisLine], ['정의', s.definition], ['제목', s.title], ['표제어', s.insight], ['공식 통계명 줄', s.officialText]);
    if (s.caption !== null) out.push(['캡션', s.caption]);
    if (s.seriesNote !== null) out.push(['계열 설명', s.seriesNote]);
    for (const l of s.legend) out.push(['범례', `${l.label} ${l.valueText}`]);
    for (const v of s.sideValues) out.push(['보조 값 줄', v.text]);
    out.push(['그래프 대체 텍스트', s.chartLabel]);
    if (s.chart.kind === 'line') {
      for (const l of [...s.chart.labels, ...s.chart.xLabels]) out.push(['그래프 값 글자', l.text]);
      if (s.chart.split !== null) out.push(['그래프 경계 글자', s.chart.split.left.text], ['그래프 경계 글자', s.chart.split.right.text]);
    } else if (s.chart.kind === 'bar') {
      out.push(['숨긴 표 캡션', `${s.title} — 큰 값부터`]);
      for (const r of s.chart.rows) out.push(['숨긴 표 값', `${r.fullLabel} ${r.valueWithUnit}`], ['그래프 값 글자', r.text]);
    } else if (s.chart.kind === 'bars') {
      // QI4: 폭염 막대 셋·격차 두 구간 막대
      if (s.chart.header !== null) out.push(['그래프 머리 글자', s.chart.header.text]);
      for (const r of s.chart.rows) out.push(['그래프 값 글자', r.text], ['그래프 라벨', r.label], ['숨긴 표 값', `${r.fullLabel} ${r.valueWithUnit}`]);
    } else {
      // QI4: 아기 누적 막대
      out.push(['그래프 머리 글자', s.chart.header.text]);
      for (const r of s.chart.rows) out.push(['그래프 값 글자', r.work.text], ['그래프 값 글자', r.valueText], ['그래프 라벨', `${r.ageText} ${r.yearText}`]);
    }
    // 그래프 밖에 숨겨 둔 표(sr-only)와 전망 표시(칩·한 줄)도 같은 금지 패턴을 지킨다
    for (const tb of s.tables) out.push(['숨긴 표 캡션', tb.caption], ...tb.head.map((h): [string, string] => ['숨긴 표 머리글', h]), ...tb.rows.flatMap((r): Array<[string, string]> => [['숨긴 표 행 머리', r.head], ...r.cells.map((c): [string, string] => ['숨긴 표 값', c])]));
    if (s.projection !== null) out.push(['전망 칩', s.projection.chip], ['전망 한 줄', s.projection.note]);
    return out;
  }

  it('금지 패턴 검사기가 실제로 잡는다 — 이전 구현의 표기(「인구 10만 명당 명」·「(가임 여자 1명당 명)」·같은 단위 연속)는 걸리고 올바른 표기는 걸리지 않는다 (완료 기준 e)', () => {
    expect(forbiddenIn('27.8 인구 10만 명당 명')).toHaveLength(1);
    expect(forbiddenIn('7.1 인구 1천 명당 명')).toHaveLength(1);
    expect(forbiddenIn('평균 출생아 수입니다(가임 여자 1명당 명).')).toHaveLength(1);
    expect(forbiddenIn('240,326건 건')).toHaveLength(1);
    expect(forbiddenIn('37.7% %')).toHaveLength(1);
    // 올바른 표기
    for (const ok of ['27.8명', '인구 10만 명당 · 2025년 기준', '인구 1천 명당 7.1명', '조사망률은 인구 1천 명당 그해 사망자 수입니다.', '혼인 건수는 혼인신고 기준으로 집계한 값이고', '2025년 기준']) {
      expect(forbiddenIn(ok), ok).toEqual([]);
    }
  });

  it('20장의 값 줄·단위·기준 줄·정의·범례·그래프 라벨·숨긴 표 머리글에 금지 패턴이 0건이다 (완료 기준 a — QI4 2단계: 14장 → 20장, 새 여섯 장의 보조 줄·표·칩까지)', () => {
    expect(data.slides).toHaveLength(20);
    let checked = 0;
    for (const s of data.slides) {
      for (const [where, text] of textsOf(s)) {
        checked++;
        expect(forbiddenIn(text), `${s.id} ${where}: 「${text.slice(0, 60)}」`).toEqual([]);
      }
    }
    expect(checked, '실제로 검사한 글자 수(공허 통과 방지)').toBeGreaterThan(450);
  });

  it('splitUnit: 「인구 10만 명당 명」은 분모 문구와 단위 낱말로 나뉜다, 분모가 없는 단위는 그대로다', () => {
    expect(splitUnit('인구 10만 명당 명')).toEqual({ denominator: '인구 10만 명당', word: '명' });
    expect(splitUnit('인구 1천 명당 명')).toEqual({ denominator: '인구 1천 명당', word: '명' });
    expect(splitUnit('인구 1천 명당 건')).toEqual({ denominator: '인구 1천 명당', word: '건' });
    for (const unit of ['명', '%', '세', '년', '건', '천 명', '만 원', '원']) expect(splitUnit(unit), unit).toEqual({ denominator: null, word: unit });
  });

  it('valueWidthEm: 숫자는 0.62em, 쉼표·소수점은 0.32em — 큰 값 글자 크기를 칸 폭에 맞추는 어림(CM11)이다', () => {
    expect(valueWidthEm('0.80')).toBeCloseTo(3 * 0.62 + 0.32, 2);
    expect(valueWidthEm('51,082,431')).toBeCloseTo(8 * 0.62 + 2 * 0.32, 2);
    expect(valueWidthEm('')).toBe(0);
    // 실제 가장 긴 값(지역 인구 5,108만 명)도 보통 글자(36px)에서 320px 화면의 칸(254px)에 들어간다 — 글자가 커질 때만 줄어든다
    const longest = Math.max(...data.slides.flatMap((s) => s.headlines.map((h) => valueWidthEm(h.value))));
    expect(longest * 36 + 16 + 4, '보통 크기(루트 100%)에서 가장 긴 값 줄의 폭').toBeLessThanOrEqual(254);
  });

  /** 표기 형식표(QM2-4 5번)는 e2e/carouselForms.ts의 SLIDE_FORMS — 20장 전부 이 여섯 중 하나(A·B·C·D 기존 14장, E 연령별 격차, P 공식 전망). 새 지표가 생기면 거기에 형식을 정해야 테스트가 통과한다. */
  const FORMS = SLIDE_FORMS;
  it('형식표: 20장이 모두 A(단순)·B(분모 있는 비율)·C(값 둘)·D(그래프 + 범위 문구)·E(연령별 격차)·P(공식 전망) 중 하나의 형식이다 — 값 줄은 「값 + 단위 낱말」, 기준 줄은 형식대로 (완료 기준 b)', () => {
    expect(Object.keys(FORMS).sort(), '형식표가 20장 전부를 정한다').toEqual(data.slides.map((s) => s.id).sort());
    expect(Object.entries(FORMS).filter(([, f]) => f === 'P').map(([id]) => id).sort(), 'P형 = 전망 5장').toEqual([...PROJECTION_IDS].sort());
    expect(Object.entries(FORMS).filter(([, f]) => f === 'E').map(([id]) => id)).toEqual(['income-gap-by-age']);
    for (const s of data.slides) {
      const r = raw(s.id);
      const year = r.latest!.year;
      const form = FORMS[s.id];
      expect(s.unitText, `${s.id} 단위는 낱말 하나`).toMatch(UNIT_WORD);
      if (form === 'P') {
        // 공식 전망: 칩 「전망」 + 공식 통계명 줄 「…(2023년 발표, 2022년 기준[, 시나리오])」 + 기준 줄 「발표: …」 + 한 줄 안내 (FC2) — 연도 자리별 출처는 tests/statHeadlines.test.ts의 단일 출처 규칙
        expect(s.projection, s.id).not.toBeNull();
        expect(s.projection!.chip).toBe('전망');
        expect(s.projection!.note).toBe('전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.');
        expect(s.officialText, s.id).toMatch(/^.+\(\d{4}년 발표, .+ 기준(, .+)?\)$/);
        expect(s.basisLine.startsWith('발표: '), s.id).toBe(true);
        expect(s.headlines.length, s.id).toBeGreaterThanOrEqual(1);
        expect(s.caption, `${s.id}: 큰 값이 어느 해·어느 추계인지 캡션이 말한다`).not.toBeNull();
        continue;
      }
      expect(s.projection, `${s.id}: 칩은 전망 슬라이드에만`).toBeNull();
      // SPEC-005 copy.md 9-2: 기준 연도는 공식 통계명 줄(officialText) 끝 괄호가 말한다 — 연도만 있던 기준 줄은 없다(null). 분모가 있는 B형만 분모가 기준 줄에 남는다
      expect(s.officialText, `${s.id} 공식 통계명 줄`).toMatch(new RegExp(`\\(${year}년[,)]|\\(${year}년 \\d{1,2}월[,)]`));
      if (form === 'E') {
        // 연령별 격차: 값 둘(66세 이상 · 18~65세, 단위 배) + 캡션(정의 상수 20%) + 두 구간 막대 + 보조 문장 둘 + 2011~2024 표 (R-476)
        expect(s.headlines.map((h) => h.label)).toEqual(['66세 이상', '18~65세']);
        expect(s.unitText).toBe('배');
        expect(s.basisText).toBeNull();
        expect(s.officialText).toBe(`${s.officialName}(${year}년)`);
        expect(s.chart.kind).toBe('bars');
        expect(s.sideValues).toHaveLength(2);
        expect(s.tables).toHaveLength(1);
        expect(s.caption).not.toBeNull();
      } else if (form === 'A') {
        expect(s.headlines, s.id).toHaveLength(1);
        expect(s.headlines[0].label, s.id).toBeNull();
        expect(s.basisText, `${s.id} 기준 줄 없음`).toBeNull();
        expect(s.officialText, s.id).toBe(`${s.officialName}(${year}년)`);
      } else if (form === 'B') {
        expect(s.headlines, s.id).toHaveLength(1);
        expect(s.unitText, s.id).toBe('명');
        expect(s.basisText, `${s.id} 기준 줄(분모만)`).toMatch(/^인구 (1천|10만) 명당$/);
        // 분모 문구는 데이터의 단위(「인구 1천 명당 명」)에서 그대로 온다
        expect(r.latestUnit!.startsWith(`${s.basisText} `), `${s.id}: 분모가 데이터 단위와 같다`).toBe(true);
        expect(s.officialText, s.id).toBe(`${s.officialName}(${year}년)`);
      } else if (form === 'C') {
        expect(s.headlines.map((h) => h.label)).toEqual(['남자', '여자']);
        expect(s.unitText).toBe('세');
        expect(s.basisText).toBeNull();
        expect(s.officialText).toBe(`${s.officialName}(${year}년)`);
      } else {
        // D: 그래프가 주인공이다. 연도(월)·범위는 공식 통계명 줄이 말하고(데이터의 범위 문구 scopeLabel에서 만든다) 기준 줄은 없다.
        // (전국 값은 「캡션 + 값 + 단위 낱말」로 그대로 보인다 — 명세의 「값 줄 없음」은 지표 자신의 큰 값 줄이 없다는 뜻으로 읽었다. ai-log 참고)
        expect(s.chart.kind, s.id).toBe('bar');
        expect(r.scopeLabel, `${s.id} 데이터의 범위 문구`).toMatch(/^\d{4}년( \d{1,2}월)? 기준\(\d+개 시·도/);
        expect(s.basisText, `${s.id} 기준 줄 없음`).toBeNull();
        expect(s.caption, `${s.id}: 전국 값이 무엇인지 캡션이 있다`).not.toBeNull();
      }
    }
  });

  it('기준 연도 표기(공식 통계명 줄·「통계 기준」 줄·그래프 마지막 점)는 모두 같은 값 latest.year에서 만든다 (QM2-4 4 · SPEC-005 SH3 단일 출처) — 전망 5장은 자리마다 출처가 하나인 규칙을 따른다(tests/statHeadlines.test.ts, R-478 d)', () => {
    for (const s of data.slides.filter((x) => x.projection === null)) {
      const year = raw(s.id).latest!.year;
      const yearsIn = (text: string) => [...text.matchAll(/(\d{4})년/g)].map((m) => Number(m[1]));
      for (const y of yearsIn(s.officialText)) expect(y, `${s.id} 공식 통계명 줄 연도`).toBe(year);
      expect(yearsIn(s.officialText), `${s.id} 공식 통계명 줄에 기준 연도가 하나`).toEqual([year]);
      expect(yearsIn(s.basisLine), `${s.id} 「통계 기준」 줄 연도(마지막 갱신 날짜의 연도는 제외)`).toEqual([year]);
      if (s.chart.kind === 'line') {
        expect(s.chart.series[0].last.year, `${s.id} 그래프 마지막 점`).toBe(year);
        for (const l of s.chart.xLabels.filter((x) => x.anchor === 'end')) expect(l.text, `${s.id} 가로축 끝 글자`).toBe(String(year));
      }
    }
  });

  it('분모가 있는 값은 어디서나 「인구 1천 명당 7.1명」 어순이다: formatWithUnit·범례·그래프 값·숨긴 표 (QM2-4 3)', () => {
    expect(formatWithUnit(7.1, '인구 1천 명당 명', 1)).toBe('인구 1천 명당 7.1명');
    expect(formatWithUnit(27.8, '인구 10만 명당 명', 1)).toBe('인구 10만 명당 27.8명');
    // 실제 14장의 모든 「N당」 뒤에는 단위 낱말이 아니라 값(숫자)이 온다
    for (const s of data.slides) {
      for (const [where, text] of textsOf(s)) {
        for (const m of text.matchAll(/당 (\S+)/g)) expect(m[1], `${s.id} ${where}: 「당」 뒤`).not.toMatch(/^(명|건|세|년|%)$/);
      }
    }
  });

  it('합계출산율의 정의 끝 「(가임 여자 1명당 명)」은 정리됐다 — 「한 여자가 …낳을 것으로 예상되는 평균 출생아 수」가 이미 같은 뜻이다 (QM2-4 2)', () => {
    const def = byId('tfr').definition;
    expect(def).not.toContain('1명당 명');
    expect(def).toBe('합계출산율은 한 여자가 가임 기간(15~49세) 동안 낳을 것으로 예상되는 평균 출생아 수입니다.');
    expect(raw('tfr').definition).toBe(def);
  });
  // ---------- QM2-11: 제목이 약속한 값은 화면에 보인다 (R-230) ----------

  /**
   * 슬라이드가 화면에 **눈에 보이게** 그리는 글자 전부 (QM2-11 규칙 3): 값 줄·범례·그래프 안 글자·캡션·기준 줄·정의·출처 줄.
   * 대체 텍스트(`chartLabel`)·`sr-only` 표·`title` 속성은 세지 않는다 — 숨긴 표에 값이 있어도 눈은 못 본다. (textsOf는 금지 패턴 검사용이라 대체 텍스트·숨긴 표까지 모으고, 이 함수는 눈에 보이는 것만 모은다.)
   */
  function visibleTextsOf(s: ReturnType<typeof byId>): string[] {
    const out: string[] = [s.title];
    if (s.caption !== null) out.push(s.caption);
    for (const h of s.headlines) out.push(`${h.label ?? ''} ${h.value}${s.unitText}`.trim());
    for (const v of s.sideValues) out.push(v.text);
    out.push(s.insight, s.officialText);
    if (s.basisText !== null) out.push(s.basisText);
    out.push(s.definition, s.sourceText, s.basisLine);
    if (s.seriesNote !== null) out.push(s.seriesNote);
    for (const l of s.legend) out.push(`${l.label} ${l.valueText}`);
    if (s.chart.kind === 'line') for (const l of [...s.chart.labels, ...s.chart.xLabels]) out.push(l.text);
    else if (s.chart.kind === 'bar' || s.chart.kind === 'bars') for (const r of s.chart.rows) out.push(r.label, r.text);
    else for (const r of s.chart.rows) out.push(r.work.text, r.valueText);
    if (s.projection !== null) out.push(s.projection.chip, s.projection.note);
    if (s.safety !== null) out.push(s.safety.name, s.safety.number, s.safety.hours);
    return out;
  }

  /** 제목에 이름이 든 지표 중 그 값(숫자 + 단위 낱말)이 눈에 보이는 글자에 없는 것 */
  function missingTitleValues(s: ReturnType<typeof byId>): string[] {
    const ind = selectCarouselIndicators().find((i) => i.id === s.id)!;
    const visible = visibleTextsOf(s).join('\n').replace(/\s+/g, ' ');
    return titleIndicators(ind)
      .filter((t) => !visible.includes(t.valueGlyph))
      .map((t) => `${t.name}(${t.valueGlyph})`);
  }

  it('bareName: 괄호 풀이를 뺀 이름 — 「조혼인율(인구 1천 명당 건)」 → 「조혼인율」, 「혼인 건수(건, 혼인신고 기준)」 → 「혼인 건수」, 풀이가 없으면 그대로', () => {
    expect(bareName('조혼인율(인구 1천 명당 건)')).toBe('조혼인율');
    expect(bareName('혼인 건수(건, 혼인신고 기준)')).toBe('혼인 건수');
    expect(bareName('합계출산율')).toBe('합계출산율');
    expect(bareName('고령인구(65세 이상) 비율'), '끝이 괄호가 아니면 그대로').toBe('고령인구(65세 이상) 비율');
    expect(bareName('  남편(남자) ')).toBe('남편');
  });

  it('제목에 이름이 든 지표마다 그 값이 눈에 보이는 글자에 있다: 20장 전부 — 검사한 (슬라이드, 지표) 쌍이 20 이상이고 조혼인율 쌍이 들어 있다 (QM2-11 a — QI4 2단계: 14 → 20)', () => {
    let pairs = 0;
    const names: string[] = [];
    for (const s of data.slides) {
      const ind = selectCarouselIndicators().find((i) => i.id === s.id)!;
      const ti = titleIndicators(ind);
      expect(ti.length, `${s.id}: 본 계열은 늘 든다`).toBeGreaterThanOrEqual(1);
      pairs += ti.length;
      names.push(...ti.map((t) => t.name));
      expect(missingTitleValues(s), `${s.id}: 제목에 이름이 든 지표의 값이 눈에 보이는 글자에 없다`).toEqual([]);
    }
    expect(pairs, '검사한 (슬라이드, 지표) 쌍(공허 통과 방지)').toBeGreaterThanOrEqual(20);
    expect(names, '조혼인율 쌍이 들어 있다').toContain('조혼인율');
  });

  it('혼인 건수 슬라이드: 큰 값 아래 줄에 「조혼인율 인구 1천 명당 4.7건」(formatWithUnit 어순, 선 무늬·범례 없이, 데이터 라벨의 괄호 단위를 그대로 쓰지 않음) (QM2-11 b)', () => {
    const s = byId('marriage-count');
    const extra = raw('marriage-count').extraSeries![0];
    expect(extra.label, '데이터 라벨은 괄호 단위를 단다 — 화면에는 그대로 쓰지 않는다').toBe('조혼인율(인구 1천 명당 건)');
    expect(forbiddenIn(extra.label), '데이터 라벨 그대로는 금지 패턴이다(「당 건)」)').toHaveLength(1);
    const value = extra.latest!.value;
    expect(s.sideValues).toEqual([{ name: '조혼인율', valueText: formatWithUnit(value, '인구 1천 명당 건', 1), text: `조혼인율 ${formatWithUnit(value, '인구 1천 명당 건', 1)}` }]);
    expect(s.sideValues[0].text).toBe('조혼인율 인구 1천 명당 4.7건'); // 2025년 값(데이터 extraSeries 최신 값)
    expect(s.sideValues[0].text).not.toContain('(');
    expect(forbiddenIn(s.sideValues[0].text), '금지 패턴 0').toEqual([]);
    expect(visibleTextsOf(s).join('\n').replace(/\s+/g, ' ')).toContain('조혼인율 인구 1천 명당 4.7건');
    // 기준 연도: 보조 값의 연도 = 슬라이드의 latest.year (그래서 연도를 따로 밝히지 않는다) — 공식 통계명 줄 「혼인 건수·조혼인율(2025년)」이 둘을 함께 가리킨다
    expect(extra.latest!.year).toBe(raw('marriage-count').latest!.year);
    expect(s.officialText).toBe(`혼인 건수·조혼인율(${raw('marriage-count').latest!.year}년)`);
    // 선 무늬(범례)가 아니다: 단위가 다른 보조 계열은 그래프 축에 더하지 않는다(현행 유지, QM2-11 규칙 2)
    expect(s.legend, '범례는 본 계열 하나뿐이라 그려지지 않는다').toHaveLength(1);
    expect(s.chart.kind === 'line' && s.chart.series.map((x) => x.key), '그래프 선은 본 계열 하나').toEqual(['main']);
    // 형식표 A(혼인 건수 행): 값 줄 「240,326건」, 기준 연도는 공식 통계명 줄
    expect(s.headlines.map((h) => `${h.value}${s.unitText}`)).toEqual(['240,326건']);
  });

  it('값이 보이는 곳은 보조 값이 있는 슬라이드뿐이다: 기존 14장 중 큰 값 아래 줄(sideValues)이 있는 것은 혼인 건수 하나 — 이름이 제목에 없는 보조 계열(사교육비 등)은 값 줄을 늘리지 않는다 (QI4의 보조 줄은 새 여섯 장에만: 격차 2·고위 저위 등)', () => {
    expect(original.filter((s) => s.sideValues.length > 0).map((s) => s.id)).toEqual(['marriage-count']);
    expect(data.slides.filter((s) => QI4_IDS.includes(s.id) && s.sideValues.length === 0), 'QI4 여섯 장은 모두 보조 줄이 있다').toEqual([]);
    // 사교육 참여율에는 단위가 다른 보조 계열(사교육비)이 있지만 제목에 이름이 없어 약속한 값이 아니다
    expect(raw('private-education').extraSeries!.length).toBeGreaterThan(0);
    expect(byId('private-education').sideValues).toEqual([]);
  });

  it('검사기가 구멍을 닫는다: 조혼인율 줄이 없던 이전 모델(sideValues 비움)은 「제목에 이름이 든 지표의 값이 안 보인다」로 걸린다 (QM2-11 d)', () => {
    const before = { ...byId('marriage-count'), sideValues: [] };
    expect(missingTitleValues(before)).toEqual(['조혼인율(4.7건)']);
    // 숨긴 표·대체 텍스트에만 값이 있는 경우도 눈에 보이는 글자가 아니라 걸린다: 대체 텍스트에 넣어 보아도 그대로다
    const altOnly = { ...before, chartLabel: `${before.chartLabel} 조혼인율 인구 1천 명당 4.7건` };
    expect(missingTitleValues(altOnly), '대체 텍스트는 눈에 보이는 글자가 아니다').toEqual(['조혼인율(4.7건)']);
    expect(missingTitleValues(byId('marriage-count'))).toEqual([]);
  });

  it('금지 패턴 목록(QM2-4 a)에 범례 글자와 보조 값 줄이 들어 있다 — 「FORMS 시험이 범례를 보지 않아 통과」하던 구멍(R-230)을 닫는다: 범례 라벨에 「당 건)」이 있으면 걸린다', () => {
    const s = byId('life-expectancy');
    const wheres = textsOf(s).map(([where]) => where);
    expect(wheres, '범례 글자가 모인다').toContain('범례');
    expect(textsOf(byId('marriage-count')).map(([w]) => w), '보조 값 줄이 모인다').toContain('보조 값 줄');
    // 이전 라벨(데이터 그대로)을 범례로 그리는 모델은 금지 패턴에 걸린다
    const bad = { ...byId('marriage-count'), legend: [{ key: 'extra-0', label: '조혼인율(인구 1천 명당 건)', dash: 'dashed' as const, valueText: '인구 1천 명당 4.7건' }] };
    const hits = textsOf(bad).filter(([where, text]) => where === '범례' && forbiddenIn(text).length > 0);
    expect(hits).toHaveLength(1);
  });

  it('보조 계열의 기준 연도가 슬라이드와 다르면 연도를 밝힌다(QM2-4 규칙 4): 같으면 붙이지 않는다', () => {
    const usableOf = (ind: RawIndicator) => createStatsAccess(fileOf(ind)).getUsableIndicator(ind.id)!;
    const mk = (extraYear: number) =>
      buildSlide(
        usableOf(
          base({
            id: 'marriage-like',
            title: '혼인과 조혼인율',
            unit: '건',
            latestUnit: '건',
            seriesLabel: '혼인(건)',
            latest: { year: 2025, value: 100 },
            series: [
              { year: 2024, value: 90 },
              { year: 2025, value: 100 },
            ],
            extraSeries: [{ label: '조혼인율(인구 1천 명당 건)', unit: '인구 1천 명당 건', decimals: 1, latest: { year: extraYear, value: 4.7 }, series: [] }],
          }),
        ),
      )!;
    expect(mk(2025).sideValues.map((v) => v.text)).toEqual(['조혼인율 인구 1천 명당 4.7건']);
    expect(mk(2024).sideValues.map((v) => v.text)).toEqual(['조혼인율 인구 1천 명당 4.7건 (2024년 기준)']);
  });
});
