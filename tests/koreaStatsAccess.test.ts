import { describe, expect, it } from 'vitest';
import statsJson from '../src/data/koreaStats.json';
import {
  CAROUSEL_ORDER,
  createStatsAccess,
  formatColumnValue,
  formatHeadlines,
  formatIndicatorValue,
  formatNumber,
  formatPointValue,
  formatWithUnit,
  getCarouselCards,
  getCarouselIndicators,
  getRegionFootnote,
  getRouletteRegions,
  getSeriesGaps,
  getSigunguRows2026,
  getUsableIndicator,
  getUsableIndicators,
  type RawIndicator,
  type StatsFile,
} from '../src/data/koreaStatsAccess';

/**
 * 한국 통계 접근자(src/data/koreaStatsAccess.ts) 검증 — SPEC-003 M6a-r2 (R-140 하위 항목 규칙·R-147(e) 단일 접근자).
 * 1) usable: false·미확인 값이 어떤 함수로도 새어 나오지 않는다 (실제 데이터 + 가짜 데이터)
 * 2) 미확인 하위 항목(verification.unverifiedParts)은 잘라 낸 복사본만 돌려준다
 * 3) 캐러셀 카드·표기·행정구역·룰렛 지역 함수의 반환
 */

const FILE = statsJson as unknown as StatsFile;
const ALL = FILE.indicators;
const UNUSABLE_IDS = ALL.filter((i) => !i.usable).map((i) => i.id);

/** 가짜 지표 만들기 (규칙 시험용) */
function fake(over: Partial<RawIndicator> & { id: string }): RawIndicator {
  return {
    title: '시험 지표',
    unit: '명',
    kind: 'line',
    use: ['carousel'],
    latest: { year: 2025, value: 1 },
    latestUnit: '명',
    decimals: 0,
    series: [
      { year: 2024, value: 1 },
      { year: 2025, value: 2 },
    ],
    definition: '시험 지표입니다.',
    basisId: 's-001',
    source: { org: '시험처', table: '시험표', url: 'https://example.test/', accessedOn: '2026-10-15' },
    verification: { status: 'verified', method: '시험', crossChecks: ['시험'] },
    safety: null,
    usable: true,
    ...over,
  } as RawIndicator;
}

describe('usable: false 는 어떤 접근 함수로도 나오지 않는다 (R-147(e))', () => {
  it('실제 데이터: 미확인 지표 7개는 getUsableIndicator가 undefined이고 목록(전체·캐러셀·용도별)에 없다', () => {
    expect(UNUSABLE_IDS.sort()).toEqual(['childcare-cost', 'household-credit', 'household-loan-rate', 'income-college-gap', 'korean-children-panel', 'rent-type-split', 'wedding-cost']);
    const listed = new Set(getUsableIndicators().map((i) => i.id));
    const uses = ['carousel', 'roulette', 'birth', 'economy', 'death', 'satire', 'future', 'research'] as const;
    const listedByUse = new Set(uses.flatMap((u) => getUsableIndicators(u).map((i) => i.id)));
    for (const id of UNUSABLE_IDS) {
      expect(getUsableIndicator(id), id).toBeUndefined();
      expect(listed.has(id), id).toBe(false);
      expect(listedByUse.has(id), id).toBe(false);
      expect(getCarouselIndicators().some((i) => i.id === id), id).toBe(false);
    }
    expect(listed.size).toBe(ALL.length - UNUSABLE_IDS.length);
  });

  it('찾는 id가 없으면 undefined(예외 아님)이고, 돌려준 모든 지표는 usable true·verified·latest·source가 있다', () => {
    expect(getUsableIndicator('없는-지표')).toBeUndefined();
    for (const i of getUsableIndicators()) {
      expect(i.usable, i.id).toBe(true);
      expect(i.verification.status, i.id).toBe('verified');
      expect(i.latest, i.id).not.toBeNull();
      expect(i.source, i.id).not.toBeNull();
      expect(typeof i.latestUnit, i.id).toBe('string');
    }
  });

  it('가짜 데이터: usable이 true여도 verification이 unverified이거나 latest·source가 없으면 돌려주지 않는다', () => {
    const f: StatsFile = {
      meta: { updatedOn: '2026-10-15' },
      indicators: [
        fake({ id: 'ok-one' }),
        fake({ id: 'flag-false', usable: false }),
        fake({ id: 'status-unverified', verification: { status: 'unverified', reason: '사유가 있는 미확인' } }),
        fake({ id: 'no-latest', latest: null }),
        fake({ id: 'no-source', source: null }),
      ],
    };
    const a = createStatsAccess(f);
    expect(a.getUsableIndicators().map((i) => i.id)).toEqual(['ok-one']);
    for (const id of ['flag-false', 'status-unverified', 'no-latest', 'no-source']) expect(a.getUsableIndicator(id), id).toBeUndefined();
    expect(a.getCarouselIndicators().map((i) => i.id)).toEqual(['ok-one']);
    expect(a.getCarouselCards().map((c) => c.id)).toEqual(['ok-one']);
  });
});

describe('미확인 하위 항목 처리 규칙 (R-140): unverifiedParts는 잘라 낸 복사본만 돌려준다', () => {
  const build = (): StatsFile => ({
    meta: { updatedOn: '2026-10-15' },
    indicators: [
      fake({
        id: 'partial-one',
        kind: 'table',
        unit: null,
        columns: [
          { key: 'name', label: '이름' },
          { key: 'v', label: '값' },
        ],
        rows: [
          { name: 'a', v: 1 },
          { name: 'b', v: 2 },
          { name: 'c', v: 3 },
        ],
        extraSeries: [
          { label: '아버지', series: [{ year: 2025, value: 10 }] },
          { label: '어머니', series: [{ year: 2025, value: 72 }] },
        ],
        shares: { checked: 1, notChecked: 2 },
        verification: {
          status: 'verified',
          method: '시험',
          crossChecks: ['시험'],
          unverifiedParts: [
            { part: 'extraSeries:어머니', reason: '분모를 아직 확인하지 못함(시험)' },
            { part: 'row:name=b', reason: '원문과 대조하지 못함(시험)' },
            { part: 'field:shares.notChecked', reason: '원문과 대조하지 못함(시험)' },
          ],
        },
      }),
      fake({ id: 'plain' }),
    ],
  });

  it('extraSeries·row·field 하위 항목을 잘라 내고 partial: true를 붙인다', () => {
    const a = createStatsAccess(build());
    const p = a.getUsableIndicator('partial-one')!;
    expect(p.partial).toBe(true);
    expect(p.extraSeries!.map((e) => e.label)).toEqual(['아버지']);
    expect(p.rows!.map((r) => r.name)).toEqual(['a', 'c']);
    expect((p.shares as Record<string, number>).notChecked).toBeUndefined();
    expect((p.shares as Record<string, number>).checked).toBe(1);
  });

  it('원본 데이터는 바뀌지 않고(복사본), 하위 항목이 없는 지표에는 partial이 없다', () => {
    const f = build();
    const a = createStatsAccess(f);
    a.getUsableIndicator('partial-one');
    const raw = f.indicators[0];
    expect(raw.extraSeries).toHaveLength(2);
    expect(raw.rows).toHaveLength(3);
    expect((raw.shares as Record<string, number>).notChecked).toBe(2);
    expect(a.getUsableIndicator('plain')!.partial).toBeUndefined();
  });

  it('목록·캐러셀을 거쳐도 잘라 낸 모양이다 (우회 경로 없음)', () => {
    const f = build();
    f.indicators[0].use = ['carousel'];
    const a = createStatsAccess(f);
    const viaList = a.getUsableIndicators().find((i) => i.id === 'partial-one')!;
    expect(viaList.extraSeries!.map((e) => e.label)).toEqual(['아버지']);
    const viaCarousel = a.getCarouselIndicators().find((i) => i.id === 'partial-one')!;
    expect(viaCarousel.extraSeries!.map((e) => e.label)).toEqual(['아버지']);
  });

  it('알 수 없는 part 표기는 조용히 넘어가지 않고 예외로 알린다', () => {
    const f = build();
    f.indicators[0].verification.unverifiedParts = [{ part: '이상한표기', reason: '시험' }];
    expect(() => createStatsAccess(f).getUsableIndicator('partial-one')).toThrow('알 수 없는 unverifiedParts');
  });

  it('인용(refs)이 잘려 나간 하위 항목을 가리키면 찾을 수 없다 — 실제 데이터에는 하위 항목 미확인이 아직 없다', () => {
    for (const i of ALL) expect((i.verification.unverifiedParts ?? []).length, i.id).toBe(0);
  });
});

describe('표기 함수', () => {
  it('formatNumber: 천 단위 쉼표·고정 소수 자릿수·반올림(33.85 → 33.9)', () => {
    expect(formatNumber(0.8, 2)).toBe('0.80');
    expect(formatNumber(254341, 0)).toBe('254,341');
    expect(formatNumber(33.85, 1)).toBe('33.9');
    expect(formatNumber(31.62, 1)).toBe('31.6');
    expect(formatNumber(51082431, 0)).toBe('51,082,431');
    expect(formatNumber(7270.3, 1)).toBe('7,270.3');
    expect(formatNumber(1234.5, 0)).toBe('1,235');
    expect(formatNumber(0, 1)).toBe('0.0');
    expect(formatNumber(-1.5, 1)).toBe('-1.5');
    expect(formatNumber(1000000, 0)).toBe('1,000,000');
  });

  it('formatWithUnit: 「인구 N명당 명」은 앞에 붙이고 %·명·세·천 명·만 원은 숫자 바로 뒤', () => {
    expect(formatWithUnit(7.1, '인구 1천 명당 명', 1)).toBe('인구 1천 명당 7.1명');
    expect(formatWithUnit(27.8, '인구 10만 명당 명', 1)).toBe('인구 10만 명당 27.8명');
    expect(formatWithUnit(36.6, '%', 1)).toBe('36.6%');
    expect(formatWithUnit(51817, '천 명', 0)).toBe('51,817천 명');
    expect(formatWithUnit(5000, '만 원', 0)).toBe('5,000만 원');
    expect(formatWithUnit(0.8, '명', 2)).toBe('0.80명');
  });

  it('formatIndicatorValue·formatPointValue·formatColumnValue: 큰 숫자·시리즈 점·표 셀', () => {
    const tfr = getUsableIndicator('tfr')!;
    expect(formatIndicatorValue(tfr)).toEqual({ value: '0.80', unit: '명', text: '0.80명', year: 2025, label: '합계출산율' });
    expect(formatPointValue(tfr, 1.24)).toBe('1.24명');
    const mother = getUsableIndicator('birth-mother-age')!;
    expect(formatIndicatorValue(mother).text).toBe('33.8세');
    expect(formatIndicatorValue(mother).label).toBe('모의 평균 출산연령');
    expect(formatPointValue(mother, 121.1)).toBe('121.1천 명');
    const sido = getUsableIndicator('birth-by-sido')!;
    const share = sido.columns!.find((c) => c.key === 'sharePct')!;
    expect(formatColumnValue(share, 3)).toBe('3.0');
    expect(formatColumnValue(sido.columns!.find((c) => c.key === 'births')!, 45516)).toBe('45,516');
    expect(formatHeadlines(tfr).map((h) => h.text)).toEqual(['0.80명']);
  });

  it('getSeriesGaps: 연도 간격이 1년을 넘는 구간(자살률 2년 간격)', () => {
    const suicide = getUsableIndicator('suicide-rate')!;
    expect(getSeriesGaps(suicide.series!)).toEqual([
      { from: 2015, to: 2017 },
      { from: 2017, to: 2019 },
      { from: 2019, to: 2021 },
      { from: 2021, to: 2023 },
    ]);
    expect(getSeriesGaps(getUsableIndicator('tfr')!.series!)).toEqual([]);
  });
});

describe('캐러셀 (M2가 쓰는 함수)', () => {
  it('getCarouselIndicators: 14개, CAROUSEL_ORDER 순서(요청의 5개가 앞), 모두 use: carousel이고 2025 센서스 17개 시도 지표는 없다', () => {
    const ids = getCarouselIndicators().map((i) => i.id);
    expect(ids).toHaveLength(14);
    expect(ids.slice(0, 6)).toEqual(['tfr', 'births', 'cdr', 'elderly-poverty', 'suicide-rate', 'region-population-registered']);
    expect(ids).toEqual(CAROUSEL_ORDER.filter((id) => ids.includes(id)));
    expect(ids).not.toContain('region-population');
    for (const i of getCarouselIndicators()) expect(i.use).toContain('carousel');
  });

  it('getCarouselCards: 카드마다 제목·큰 숫자(들)·그래프 점·정의·기준 문구·출처 줄이 있고 기준 문구는 「통계 기준: 연도 · 마지막 갱신 날짜」', () => {
    const cards = getCarouselCards();
    expect(cards).toHaveLength(14);
    for (const c of cards) {
      expect(c.title, c.id).toBeTruthy();
      expect(c.headlines.length, c.id).toBeGreaterThanOrEqual(1);
      for (const h of c.headlines) {
        expect(h.text, c.id).toMatch(/\d/);
        expect(h.unit.length, c.id).toBeGreaterThan(0);
      }
      expect(c.chart.points.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.definition.endsWith('.'), c.id).toBe(true);
      expect(c.basisLine, c.id).toMatch(/^통계 기준: \d{4}년 · 마지막 갱신 \d{4}-\d{2}-\d{2}$/);
      expect(c.sourceLine, c.id).toContain(' · ');
      expect(c.sourceLine, c.id).not.toMatch(/https?:/);
    }
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(byId.tfr.headlines[0].text).toBe('0.80명');
    expect(byId.tfr.chart.axis!.regular).toBe(true);
    expect(byId['suicide-rate'].chart.axis!.regular).toBe(false);
  });

  it('초혼 연령 카드는 남자·여자 두 값, 지역 카드는 기준 문구(주민등록 16개 시·도 / 2025년 17개 시·도)를 함께 보인다', () => {
    const cards = Object.fromEntries(getCarouselCards().map((c) => [c.id, c]));
    expect(cards['first-marriage-age'].headlines.map((h) => `${h.label} ${h.text}`)).toEqual(['남자 33.9세', '여자 31.6세']);
    expect(cards['first-marriage-age'].title).toContain('남자');
    expect(cards['region-population-registered'].scopeLabel).toBe('2026년 9월 기준(16개 시·도, 주민등록)');
    expect(cards['region-population-registered'].chart.points).toHaveLength(16);
    expect(cards['tfr-by-sido'].scopeLabel).toBe('2025년 기준(17개 시·도)');
    expect(cards['tfr-by-sido'].chart.points).toHaveLength(17);
    expect(cards.tfr.scopeLabel).toBeNull();
  });

  it('자살률 카드만 상담전화 109(24시간) 안내를 같은 카드 안에 갖고, 다른 카드에는 없다', () => {
    const cards = getCarouselCards();
    const help = cards.filter((c) => c.helpLine !== null);
    expect(help.map((c) => c.id)).toEqual(['suicide-rate']);
    expect(help[0].helpLine).toMatchObject({ number: '109', hours: '24시간' });
    expect(help[0].helpLine!.name).toContain('자살예방 상담전화');
  });

  it('조사망률 카드는 「인구 1천 명당 7.1명」, 1인 가구는 「36.6%」로 표기된다', () => {
    const cards = Object.fromEntries(getCarouselCards().map((c) => [c.id, c]));
    expect(cards.cdr.headlines[0].text).toBe('인구 1천 명당 7.1명');
    expect(cards['single-household'].headlines[0].text).toBe('36.6%');
    expect(cards.births.headlines[0].text).toBe('254,341명');
  });
});

describe('행정구역·룰렛 함수 (M3가 쓰는 함수, R-145·R-146)', () => {
  it('getSigunguRows2026: 옛 구(인천 중·동·서구, 화성시)를 빼고 새 구 8개(설계값)를 넣어 256행, 전국 합 254,341, 시도별 합 불변', () => {
    const rows = getSigunguRows2026();
    expect(rows).toHaveLength(256);
    expect(rows.reduce((a, r) => a + r.births, 0)).toBe(254341);
    const names = rows.map((r) => `${r.sido} ${r.name}`);
    for (const gone of ['인천 중구', '인천 동구', '인천 서구', '경기 화성시']) expect(names, gone).not.toContain(gone);
    for (const made of ['인천 제물포구', '인천 영종구', '인천 서해구', '인천 검단구', '경기 만세구', '경기 효행구', '경기 병점구', '경기 동탄구']) expect(names, made).toContain(made);
    expect(rows.filter((r) => r.designValue)).toHaveLength(8);
    expect(rows.filter((r) => r.designValue && r.from === undefined)).toHaveLength(0);
    expect(new Set(rows.map((r) => `${r.sido2026} ${r.name}`)).size, '2026 시도+이름 중복 없음').toBe(256);
    const bySido: Record<string, number> = {};
    for (const r of rows) bySido[r.sido] = (bySido[r.sido] ?? 0) + r.births;
    const sidoRows = (statsJson as unknown as StatsFile).indicators.find((i) => i.id === 'birth-by-sido')!.rows as Array<{ sido: string; births: number }>;
    for (const s of sidoRows) expect(bySido[s.sido], s.sido).toBe(s.births);
  });

  it('광주·전남 행은 시도 이름이 전남광주(통합특별시)로 바뀐다', () => {
    const rows = getSigunguRows2026();
    const merged = rows.filter((r) => r.sido2026 === '전남광주');
    expect(merged.filter((r) => r.sido === '광주')).toHaveLength(5);
    expect(merged.filter((r) => r.sido === '전남').length).toBeGreaterThan(15);
    expect(rows.filter((r) => r.sido2026 === '광주' || r.sido2026 === '전남')).toHaveLength(0);
    expect(rows.find((r) => r.name === '동탄구')).toMatchObject({ sido2026: '경기', parent: '화성시', designValue: true });
  });

  it('getRouletteRegions: 출생 연도별 시·도 목록 — 1950~62 10개, 1963~80 11개, 1981~85 13개, 1986~88 14개, 1989 15개, 2026·2030~2060 16개, 그 밖은 없음', () => {
    const n = (y: number) => getRouletteRegions(y)?.regions.length;
    expect([n(1950), n(1962)]).toEqual([10, 10]);
    expect([n(1963), n(1980)]).toEqual([11, 11]);
    expect([n(1981), n(1985)]).toEqual([13, 13]);
    expect([n(1986), n(1988)]).toEqual([14, 14]);
    expect(n(1989)).toBe(15);
    expect([n(2026), n(2030), n(2045), n(2060)]).toEqual([16, 16, 16, 16]);
    for (const y of [1949, 1990, 2025, 2027, 2029, 2061]) expect(getRouletteRegions(y), String(y)).toBeUndefined();
  });

  it('getRouletteRegions: 비율 합 100.0, 출생아 합 254,341, 모두 설계값 표시, 지금 세상은 전남광주 한 칸', () => {
    for (const y of [1955, 1970, 1983, 1987, 1989, 2026, 2050]) {
      const r = getRouletteRegions(y)!;
      expect(r.designValue, String(y)).toBe(true);
      expect(Math.round(r.regions.reduce((a, x) => a + x.sharePct, 0) * 10) / 10, String(y)).toBe(100);
      expect(r.regions.reduce((a, x) => a + x.births, 0), String(y)).toBe(254341);
    }
    const now = getRouletteRegions(2026)!;
    expect(now.kind).toBe('present');
    expect(now.regions.map((x) => x.name)).toContain('전남광주');
    expect(now.regions.map((x) => x.name)).not.toContain('광주');
    expect(getRouletteRegions(1955)!.kind).toBe('past');
    expect(getRouletteRegions(1955)!.regions.map((x) => x.name)).not.toContain('울산');
  });

  it('getRegionFootnote: 「출생 통계는 2025년 행정구역 기준」 표기 문구', () => {
    expect(getRegionFootnote()).toContain('출생 통계는 2025년 행정구역 기준');
    expect(getRegionFootnote()).toContain('설계값');
  });
});

describe('단일 접근자 강제 (R-147(e)): 게임 코드는 koreaStats.json을 직접 읽지 않는다', () => {
  const SOURCES = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const DIRECT = /from\s+['"][^'"]*koreaStats\.json['"]|import\(\s*['"][^'"]*koreaStats\.json['"]|require\(\s*['"][^'"]*koreaStats\.json['"]/;

  it('src 안에서 koreaStats.json을 import하는 파일은 src/data/koreaStatsAccess.ts 하나뿐이다 — 화면·로직은 접근자 함수만 쓴다(미확인 값 차단)', () => {
    const files = Object.keys(SOURCES);
    expect(files.length, '소스 목록을 읽었다').toBeGreaterThan(30);
    const offenders = Object.entries(SOURCES)
      .filter(([, text]) => DIRECT.test(text))
      .map(([path]) => path.replace('../', ''));
    expect(offenders).toEqual(['src/data/koreaStatsAccess.ts']);
  });
});
