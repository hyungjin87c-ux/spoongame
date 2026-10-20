import { describe, expect, it } from 'vitest';
import statsJson from '../src/data/koreaStats.json';
import basisDoc from '../docs/data/events-stats-basis.md?raw';
import sourcesDoc from '../docs/data/korea-stats-sources.md?raw';
import slidesDoc from '../docs/data/projection-slides-QI4.md?raw';
import { CAROUSEL_ORDER, formatIndicatorValue, getCarouselIndicators, getUsableIndicator, getUsableIndicators, type RawIndicator } from '../src/data/koreaStatsAccess';
import { STAT_HEADLINES } from '../src/data/statHeadlines';

/**
 * 공식 전망 지표 7개 + 연령별 격차 지표 2개 (SPEC-005 QI4 1단계, FC1~FC5·M8·M10, SPEC-004 PJ2).
 *  - 형식(PJ2): 보고서·발표 기관·발표일·기준 연도·지평·실측 경계·시나리오별 값·열람일·basisId
 *  - 일치: 같은 표에서 읽은 값끼리의 관계(연령 3구간 합·구성비·부양비·가구 비율)와 국가데이터처 보도자료 본문의 값, 기존 지표(future-projection·tfr·life-expectancy·elderly-poverty·single-household)와의 대조
 *  - 문장 속 수치: notes·definition에 적힌 소수 수치는 데이터 값과 같아야 한다
 *  - 캐러셀 미연결(use에 carousel 없음), 기존 지표 불변, 근거·수집 기록·제안표 문서의 연결
 * 값은 KOSIS 화면에서 읽은 그대로이고 지어낸 미래 수치는 0이다 — 이 시험은 읽은 값이 서로 맞는지와 문장이 값을 따르는지를 잠근다.
 */

interface Pt {
  year: number;
  value: number;
}
interface Scenario {
  key: string;
  level: string;
  label: string;
  official: string;
  series?: Pt[];
  rows?: Array<Record<string, number>>;
}
interface Related {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  actual?: Pt[];
  scenarios: Array<{ key: string; series: Pt[] }>;
}
type Ind = RawIndicator & {
  related?: Related[];
  cohort?: { birthYear: number; ages: number[]; note: string };
  measures?: Array<{ key: string; concept: string; metric: string; unit: string | null; decimals: number; bands: Array<{ key: string; label: string; series: Pt[] }> }>;
  meanIncome?: { unit: string; decimals: number; year: number; rows: Array<{ label: string; value: number }> };
  history?: { years: number[]; unit: string; decimals: number; poverty: Array<{ label: string; series: Pt[] }>; meanIncome: Array<{ label: string; series: Pt[] }> };
};

const ALL = (statsJson as unknown as { indicators: Ind[] }).indicators;
const get = (id: string): Ind => {
  const found = ALL.find((i) => i.id === id);
  if (!found) throw new Error(`지표 없음: ${id}`);
  return found;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const PROJ: Array<{ id: string; basisId: string; report: string; releasedOn: string; baseYear: number; horizon: number; actualThrough: number; first: number; scenarios: string[] }> = [
  { id: 'projection-population-total', basisId: 's-092', report: '장래인구추계: 2022~2072년', releasedOn: '2023-12-14', baseYear: 2022, horizon: 2072, actualThrough: 2022, first: 1960, scenarios: ['median', 'high', 'low'] },
  { id: 'projection-aging-share', basisId: 's-093', report: '장래인구추계: 2022~2072년', releasedOn: '2023-12-14', baseYear: 2022, horizon: 2072, actualThrough: 2022, first: 1960, scenarios: ['median', 'high', 'low'] },
  { id: 'projection-working-age', basisId: 's-094', report: '장래인구추계: 2022~2072년', releasedOn: '2023-12-14', baseYear: 2022, horizon: 2072, actualThrough: 2022, first: 1960, scenarios: ['median', 'high', 'low'] },
  { id: 'projection-tfr', basisId: 's-096', report: '장래인구추계: 2022~2072년', releasedOn: '2023-12-14', baseYear: 2022, horizon: 2072, actualThrough: 2022, first: 1970, scenarios: ['median', 'high', 'low'] },
  { id: 'projection-life-expectancy', basisId: 's-097', report: '장래인구추계: 2022~2072년', releasedOn: '2023-12-14', baseYear: 2022, horizon: 2072, actualThrough: 2022, first: 1970, scenarios: ['median', 'high', 'low'] },
  { id: 'projection-one-person-households', basisId: 's-098', report: '장래가구추계: 2022~2052년', releasedOn: '2024-09-12', baseYear: 2022, horizon: 2052, actualThrough: 2021, first: 2000, scenarios: ['main'] },
];
const NEWBORN = 'projection-newborn-age-structure';
const GAP_IDS = ['income-gap-by-age', 'poverty-by-age-band'];
const PROJ_IDS = [...PROJ.map((p) => p.id), NEWBORN];
const NEW_IDS = [...PROJ_IDS, ...GAP_IDS];

const pts = (a: Pt[] | undefined): Pt[] => {
  if (!a) throw new Error('시리즈 없음');
  return a;
};
const at = (a: Pt[] | undefined, year: number): number => {
  const p = pts(a).find((x) => x.year === year);
  if (!p) throw new Error(`${year}년 값 없음`);
  return p.value;
};
const scenario = (id: string, key: string): Scenario => {
  const s = (get(id).projection?.scenarios as Scenario[] | undefined)?.find((x) => x.key === key);
  if (!s) throw new Error(`${id} 시나리오 ${key} 없음`);
  return s;
};
const series = (id: string, key = 'median'): Pt[] => pts(scenario(id, key).series);
const related = (id: string, key: string): Related => {
  const r = get(id).related?.find((x) => x.key === key);
  if (!r) throw new Error(`${id} related ${key} 없음`);
  return r;
};
const rel = (id: string, key: string, scen = 'median'): Pt[] => {
  const s = related(id, key).scenarios.find((x) => x.key === scen);
  if (!s) throw new Error(`${id}/${key} 시나리오 ${scen} 없음`);
  return s.series;
};
const round1 = (v: number): number => Math.round(v * 10) / 10;
const man = (v: number): number => Math.round(v / 10000);
const YEARS = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const ascending = (a: Pt[]): boolean => a.every((p, k) => k === 0 || p.year > a[k - 1].year);
/** 글 속 소수(예 0.68, 37.89)만 뽑는다 — 연도·날짜·정수는 뺀다 */
const decimalsIn = (t: string): string[] => t.match(/\d+\.\d+/g) ?? [];

describe('공식 전망 지표 — PJ2 형식 (보고서·발표 기관·발표일·기준 연도·지평·실측 경계·열람일·basisId)', () => {
  it('새 지표 9개가 JSON 끝에 이어 붙었고(기존 74개 앞부분 불변) id·basisId가 겹치지 않는다', () => {
    expect(ALL).toHaveLength(83);
    expect(ALL.slice(-9).map((i) => i.id)).toEqual([...PROJ.slice(0, 3).map((p) => p.id), NEWBORN, ...PROJ.slice(3).map((p) => p.id), ...GAP_IDS]);
    expect(ALL.slice(0, 74).some((i) => NEW_IDS.includes(i.id))).toBe(false);
    expect(new Set(ALL.map((i) => i.basisId)).size).toBe(ALL.length);
    expect(ALL.slice(-9).map((i) => i.basisId)).toEqual(['s-092', 's-093', 's-094', 's-095', 's-096', 's-097', 's-098', 's-099', 's-100']);
  });

  it('전망 지표 7개: kind projection · use future(캐러셀 아님) · 확인됨 · basisId', () => {
    for (const p of PROJ) {
      const i = get(p.id);
      expect(i.kind, p.id).toBe('projection');
      expect(i.use, p.id).toEqual(['future']);
      expect(i.basisId, p.id).toBe(p.basisId);
      expect(i.usable, p.id).toBe(true);
      expect(i.verification.status, p.id).toBe('verified');
    }
    expect(get(NEWBORN).kind).toBe('projection');
    expect(get(NEWBORN).basisId).toBe('s-095');
    expect(get(NEWBORN).use).toEqual(['future']);
  });

  it('PJ2 필드: 보고서·발표 기관(= 출처 기관)·발표일·발표 글 주소·기준 연도·지평·실측 경계·기본 시나리오·열람일', () => {
    for (const id of PROJ_IDS) {
      const i = get(id);
      const p = i.projection!;
      expect(p, id).toBeDefined();
      expect(p.report.length, id).toBeGreaterThan(8);
      expect(p.publisher, id).toBe(i.source!.org);
      expect(p.publisher, id).toContain('현 국가데이터처');
      expect(p.releasedOn, id).toMatch(DATE);
      expect(p.releaseUrl, id).toMatch(/^https:\/\/mods\.go\.kr\/board\.es\?mid=a10301020600&bid=207&act=view&list_no=\d+$/);
      expect(Number.isInteger(p.baseYear) && Number.isInteger(p.horizon) && Number.isInteger(p.actualThrough), id).toBe(true);
      expect(p.horizon, id).toBeGreaterThan(p.baseYear);
      expect([p.baseYear - 1, p.baseYear], `${id} 실측 경계는 기준 연도 또는 그 전해`).toContain(p.actualThrough);
      expect(p.actualNote.length, id).toBeGreaterThan(15);
      expect(p.scenarios.map((s) => s.key), id).toContain(p.defaultScenario);
      expect(i.source!.accessedOn, id).toBe('2026-10-21');
      expect(p.releasedOn < i.source!.accessedOn, id).toBe(true);
      expect(i.source!.url, id).toMatch(/^https:\/\/kosis\.kr\/statHtml\/statHtml\.do\?orgId=101&tblId=DT_\w+$/);
    }
  });

  it('지표별 보고서·발표일·기준 연도·지평·실측 경계가 원문(KOSIS 주석·보도자료)과 같다', () => {
    for (const p of PROJ) {
      const pr = get(p.id).projection!;
      expect(pr.report, p.id).toBe(p.report);
      expect(pr.releasedOn, p.id).toBe(p.releasedOn);
      expect(pr.baseYear, p.id).toBe(p.baseYear);
      expect(pr.horizon, p.id).toBe(p.horizon);
      expect(pr.actualThrough, p.id).toBe(p.actualThrough);
      expect(pr.scenarios.map((s) => s.key), p.id).toEqual(p.scenarios);
    }
    // 인구 표 주석: 「1960~2022년까지는 확정인구」, 합계출산율·기대수명 표 주석: 「2022년까지는 … 실적치」, 가구 표 주석: 「2022~2052년 추계가구수 제공」
    expect(get('projection-population-total').projection!.actualNote).toContain('1960~2022년까지는 확정인구');
    expect(get('projection-tfr').projection!.actualNote).toContain('2022년까지는 인구동태통계 합계출산율 실적치');
    expect(get('projection-life-expectancy').projection!.actualNote).toContain('2022년까지는 인구동태통계에 의한 기대수명 실적치');
    expect(get('projection-one-person-households').projection!.actualNote).toContain('2022~2052년 추계가구수 제공');
    expect(get(NEWBORN).projection!.releasedOn).toBe('2023-12-14');
    expect(get(NEWBORN).projection!.horizon).toBe(2072);
  });

  it('시나리오 이름은 원문 그대로다(중위·고위·저위 / 가구는 구분 없음) — 낙관·비관으로 옮기지 않는다', () => {
    const LEVEL: Record<string, string> = { median: 'mid', high: 'high', low: 'low', main: 'single' };
    for (const id of PROJ_IDS) {
      for (const s of get(id).projection!.scenarios as Scenario[]) {
        expect(s.level, `${id}/${s.key}`).toBe(LEVEL[s.key]);
        expect(s.label.length, id).toBeGreaterThan(2);
        expect(s.official.length, id).toBeGreaterThan(3);
        expect(`${s.label}${s.official}`, id).not.toMatch(/낙관|비관|기준 시나리오/);
      }
    }
    expect(scenario('projection-population-total', 'median').official).toBe('중위 추계(기본 추계: 출산율-중위 / 기대수명-중위 / 국제순이동-중위)');
    expect(scenario('projection-population-total', 'high').official).toBe('고위 추계(최대인구 추계: 출산율-고위 / 기대수명-고위 / 국제순이동-고위)');
    expect(scenario('projection-population-total', 'low').official).toBe('저위 추계(최소인구 추계: 출산율-저위 / 기대수명-저위 / 국제순이동-저위)');
    expect(scenario('projection-tfr', 'high').label).toBe('출산율 고위 가정');
    expect(scenario('projection-life-expectancy', 'low').label).toBe('기대수명 저위 가정');
    expect(scenario('projection-one-person-households', 'main').official).toContain('시나리오 이름이 없다');
  });

  it('시리즈 모양: 연도 오름차순, 전망은 실측 경계에서 시작해 지평에서 끝나고, 경계가 겹치면 모든 시나리오가 같은 값(= 실측 마지막 값)이다', () => {
    for (const p of PROJ) {
      const i = get(p.id);
      const actual = pts(i.actual);
      expect(ascending(actual), `${p.id} actual 오름차순`).toBe(true);
      expect(actual[0].year, p.id).toBe(p.first);
      expect(actual.at(-1)!.year, p.id).toBe(p.actualThrough);
      expect(actual.length, `${p.id} 연도 빠짐 없음`).toBe(p.actualThrough - p.first + 1);
      for (const s of i.projection!.scenarios as Scenario[]) {
        const ser = pts(s.series);
        expect(ascending(ser), `${p.id}/${s.key}`).toBe(true);
        expect(ser.at(-1)!.year, `${p.id}/${s.key} 지평`).toBe(p.horizon);
        expect([p.actualThrough, p.actualThrough + 1], `${p.id}/${s.key} 시작`).toContain(ser[0].year);
        expect(ser.length, `${p.id}/${s.key} 연도 빠짐 없음`).toBe(p.horizon - ser[0].year + 1);
        if (ser[0].year === p.actualThrough) expect(ser[0].value, `${p.id}/${s.key} 경계 값`).toBe(actual.at(-1)!.value);
        for (const x of ser) expect(Number.isFinite(x.value), `${p.id}/${s.key}/${x.year}`).toBe(true);
      }
      // 큰 숫자 = 기본 시나리오의 지평 값
      const def = i.projection!.defaultScenario;
      expect(i.latest, p.id).toEqual({ year: p.horizon, value: series(p.id, def).at(-1)!.value });
    }
  });

  it('보조 계열(related)도 같은 모양이다: 실측 경계와 지평이 지표와 같고, 값이 유한수다', () => {
    let n = 0;
    for (const p of PROJ) {
      for (const r of get(p.id).related ?? []) {
        n++;
        expect(r.unit.length, `${p.id}/${r.key}`).toBeGreaterThan(0);
        for (const s of r.scenarios) {
          expect(ascending(s.series), `${p.id}/${r.key}/${s.key}`).toBe(true);
          expect(s.series.at(-1)!.year).toBe(p.horizon);
          for (const x of s.series) expect(Number.isFinite(x.value)).toBe(true);
        }
        if (r.actual) {
          expect(ascending(r.actual), `${p.id}/${r.key} actual`).toBe(true);
          expect(r.actual.at(-1)!.year).toBe(p.actualThrough);
        }
      }
    }
    expect(n).toBe(6); // 65세 이상 인구·15~64세 구성비·남자·여자 기대수명·1인 가구 수·전체 가구 수(보조 계열은 중위 또는 단일 추계만 담았다)
  });
});

describe('같은 표에서 읽은 값끼리의 관계 — 연령 구조 (장래인구추계 2022년 기준)', () => {
  const years = YEARS(2022, 2072);

  it('65세 이상 구성비 = 65세 이상 인구 ÷ 총인구(소수 첫째 자리 반올림): 중위 2022~2072와 확정 1960~2022 모두', () => {
    const total = series('projection-population-total');
    const pop65 = rel('projection-aging-share', 'population65plus');
    const share = series('projection-aging-share');
    for (const y of years) expect(round1((at(pop65, y) / at(total, y)) * 100), `중위 ${y}`).toBe(at(share, y));
    const tA = pts(get('projection-population-total').actual);
    const pA = pts(related('projection-aging-share', 'population65plus').actual);
    const sA = pts(get('projection-aging-share').actual);
    for (const y of YEARS(1960, 2022)) expect(round1((at(pA, y) / at(tA, y)) * 100), `확정 ${y}`).toBe(at(sA, y));
  });

  it('15~64세 구성비 = 생산연령인구 ÷ 총인구, 세 구간 구성비의 합이 100.0(±0.15)이고 0~14세 인구가 0 이상이다', () => {
    const total = series('projection-population-total');
    const work = series('projection-working-age');
    const wShare = rel('projection-working-age', 'share15to64');
    const pop65 = rel('projection-aging-share', 'population65plus');
    const aShare = series('projection-aging-share');
    for (const y of years) {
      expect(round1((at(work, y) / at(total, y)) * 100), `15~64세 ${y}`).toBe(at(wShare, y));
      const youth = at(total, y) - at(work, y) - at(pop65, y);
      expect(youth, `0~14세 인구 ${y}`).toBeGreaterThan(0);
      const youthShare = (youth / at(total, y)) * 100;
      expect(Math.abs(youthShare + at(wShare, y) + at(aShare, y) - 100), `구성비 합 ${y}`).toBeLessThanOrEqual(0.15);
    }
    // 확정 구간도 같은 관계
    const tA = pts(get('projection-population-total').actual);
    const wA = pts(get('projection-working-age').actual);
    const wsA = pts(related('projection-working-age', 'share15to64').actual);
    for (const y of YEARS(1960, 2022)) expect(round1((at(wA, y) / at(tA, y)) * 100), `확정 15~64세 ${y}`).toBe(at(wsA, y));
  });

  it('세 추계 모두: 2022년은 같은 값이고 2023년부터 갈라지며, 고위 > 중위 > 저위 총인구는 2023년 이후 항상 성립한다', () => {
    const [m, h, l] = ['median', 'high', 'low'].map((k) => series('projection-population-total', k));
    expect(h[0].value).toBe(m[0].value);
    expect(l[0].value).toBe(m[0].value);
    for (const y of YEARS(2023, 2072)) {
      expect(at(h, y), `고위 ${y}`).toBeGreaterThan(at(m, y));
      expect(at(m, y), `저위 ${y}`).toBeGreaterThan(at(l, y));
    }
    // 65세 이상 구성비는 반대로 2072년에 고위가 가장 낮다(출산율이 높아 젊은 층이 늘어서)
    const [a, b, c] = ['high', 'median', 'low'].map((k) => at(series('projection-aging-share', k), 2072));
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('지금 태어난 아기 지표: 2026년생이 0·10·20·30·40세가 되는 해(2026·2036·2046·2056·2066)의 행이 시나리오마다 있고 지평 안이다', () => {
    const i = get(NEWBORN);
    expect(i.cohort).toMatchObject({ birthYear: 2026, ages: [0, 10, 20, 30, 40] });
    expect(i.projection!.shape).toBe('cohort-rows');
    for (const s of i.projection!.scenarios as Scenario[]) {
      expect(s.series, `${s.key} series 없음(행 모양)`).toBeUndefined();
      expect(s.rows!.map((r) => [r.age, r.year]), s.key).toEqual([[0, 2026], [10, 2036], [20, 2046], [30, 2056], [40, 2066]]);
      for (const r of s.rows!) {
        expect(r.year, `${s.key} ${r.age}세`).toBeGreaterThan(i.projection!.actualThrough);
        expect(r.year).toBeLessThanOrEqual(i.projection!.horizon);
        expect(r.year).toBe(2026 + r.age);
      }
    }
    expect(i.latest).toEqual({ year: 2056, value: 42.1 });
    expect(i.latestLabel).toContain('30세가 되는 해');
  });

  it('지금 태어난 아기 지표의 행이 다른 지표와 같은 값이다: 총인구·65세 이상 구성비(세 추계), 15~64세 구성비·65세 이상 인구(중위)', () => {
    for (const s of get(NEWBORN).projection!.scenarios as Scenario[]) {
      for (const r of s.rows!) {
        expect(r.population, `${s.key} ${r.year} 총인구`).toBe(at(series('projection-population-total', s.key), r.year));
        expect(r.share65plus, `${s.key} ${r.year} 65세 이상`).toBe(at(series('projection-aging-share', s.key), r.year));
        // 세 구간 합 100(반올림 ±0.15), 총부양비 = 유소년부양비 + 노년부양비(±0.15)
        expect(Math.abs(r.share0to14 + r.share15to64 + r.share65plus - 100), `${s.key} ${r.year} 합`).toBeLessThanOrEqual(0.15);
        expect(Math.abs(r.totalDependency - (r.youthDependency + r.elderlyDependency)), `${s.key} ${r.year} 부양비`).toBeLessThanOrEqual(0.15);
      }
    }
    const total = series('projection-population-total');
    const work = series('projection-working-age');
    const pop65 = rel('projection-aging-share', 'population65plus');
    const wShare = rel('projection-working-age', 'share15to64');
    for (const r of scenario(NEWBORN, 'median').rows!) {
      expect(r.share15to64, `${r.year} 15~64세`).toBe(at(wShare, r.year));
      // 노년부양비 = 65세 이상 ÷ 15~64세 × 100, 유소년부양비 = 0~14세 ÷ 15~64세 × 100 — 인구 값으로 다시 계산
      expect(Math.abs((at(pop65, r.year) / at(work, r.year)) * 100 - r.elderlyDependency), `${r.year} 노년부양비`).toBeLessThanOrEqual(0.06);
      const youth = at(total, r.year) - at(work, r.year) - at(pop65, r.year);
      expect(Math.abs((youth / at(work, r.year)) * 100 - r.youthDependency), `${r.year} 유소년부양비`).toBeLessThanOrEqual(0.06);
    }
  });

  it('2026년 값 65세 이상 21.6%가 기존 future-projection 지표(고령자 통계의 2026년 값)와 같다', () => {
    const fp = get('future-projection') as unknown as { aging: { year2026Share65Plus: number; shareAbove30By: number; shareAbove40By: number } };
    expect(at(series('projection-aging-share'), 2026)).toBe(fp.aging.year2026Share65Plus);
    const share = series('projection-aging-share');
    // 「2036년 30%·2050년 40% 초과」: 그 전해는 아직 넘지 않았고 그 해에 처음 넘는다(중위)
    expect(at(share, fp.aging.shareAbove30By - 1)).toBeLessThanOrEqual(30);
    expect(at(share, fp.aging.shareAbove30By)).toBeGreaterThan(30);
    expect(at(share, fp.aging.shareAbove40By - 1)).toBeLessThanOrEqual(40);
    expect(at(share, fp.aging.shareAbove40By)).toBeGreaterThan(40);
  });
});

describe('보도자료 본문의 값과 같다 — 「장래인구추계: 2022~2072년」(2023-12-14)', () => {
  const total = (k = 'median') => series('projection-population-total', k);
  const work = () => series('projection-working-age');
  const pop65 = () => rel('projection-aging-share', 'population65plus');

  it('총인구: 2022년 5,167만, 2024년 5,175만 → 2030년 5,131만, 2072년 3,622만 · 고위 4,282만 · 저위 3,017만', () => {
    expect(man(at(total(), 2022))).toBe(5167);
    expect(man(at(total(), 2024))).toBe(5175);
    expect(man(at(total(), 2030))).toBe(5131);
    expect(man(at(total(), 2072))).toBe(3622);
    expect(man(at(total('high'), 2072))).toBe(4282);
    expect(man(at(total('low'), 2072))).toBe(3017);
    // 2024년이 정점(그 뒤 감소)
    const peak = total().reduce((a, b) => (b.value > a.value ? b : a));
    expect(peak.year).toBe(2024);
    expect(get('projection-population-total').latest).toEqual({ year: 2072, value: 36222293 });
  });

  it('연령 구성: 65세 이상 17.4% → 47.7%, 15~64세 71.1% → 45.8%, 고령인구 898만 → 2025년 1,000만 넘음 → 1,727만', () => {
    expect(at(series('projection-aging-share'), 2022)).toBe(17.4);
    expect(at(series('projection-aging-share'), 2072)).toBe(47.7);
    expect(at(rel('projection-working-age', 'share15to64'), 2022)).toBe(71.1);
    expect(at(rel('projection-working-age', 'share15to64'), 2072)).toBe(45.8);
    expect(man(at(pop65(), 2022))).toBe(898);
    expect(at(pop65(), 2024)).toBeLessThan(10_000_000);
    expect(at(pop65(), 2025)).toBeGreaterThan(10_000_000);
    expect(man(at(pop65(), 2072))).toBe(1727);
  });

  it('생산연령인구: 2022년 3,674만, 향후 10년간 332만 감소, 2072년 1,658만', () => {
    expect(man(at(work(), 2022))).toBe(3674);
    expect(man(at(work(), 2022) - at(work(), 2032))).toBe(332);
    expect(man(at(work(), 2072))).toBe(1658);
    expect(get('projection-working-age').latest).toEqual({ year: 2072, value: 16575182 });
  });

  it('유소년인구(총인구 − 15~64세 − 65세 이상): 2022년 595만, 2040년 388만, 2072년 238만', () => {
    const youth = (y: number) => at(total(), y) - at(work(), y) - at(pop65(), y);
    expect(man(youth(2022))).toBe(595);
    expect(man(youth(2040))).toBe(388);
    expect(man(youth(2072))).toBe(238);
  });

  it('총부양비 2022년 40.6(노년 24.4) → 2072년 118.5(노년 104.2): 지금 태어난 아기 지표의 행과 같은 표 값', () => {
    const rows = scenario(NEWBORN, 'median').rows!;
    const r2026 = rows.find((r) => r.year === 2026)!;
    expect(r2026).toMatchObject({ share0to14: 9.7, share15to64: 68.8, share65plus: 21.6, totalDependency: 45.4 });
    const r2056 = rows.find((r) => r.year === 2056)!;
    expect(r2056).toMatchObject({ share0to14: 7.4, share15to64: 50.5, share65plus: 42.1, totalDependency: 97.9, elderlyDependency: 83.2 });
    const r2066 = rows.find((r) => r.year === 2066)!;
    expect(r2066).toMatchObject({ share65plus: 47, totalDependency: 114.6 });
  });
});

describe('합계출산율·기대수명 전망 — 기존 지표와의 대조', () => {
  const fp = get('future-projection') as unknown as { rows: Array<{ year: number; tfr: number; lifeExpectancy: number }> };

  it('중위 값이 기존 future-projection 지표의 같은 해 값과 같다(2025·2026·2030·2040·2050·2060·2072)', () => {
    expect(fp.rows).toHaveLength(7);
    for (const r of fp.rows) {
      expect(at(series('projection-tfr'), r.year), `합계출산율 ${r.year}`).toBe(r.tfr);
      expect(at(series('projection-life-expectancy'), r.year), `기대수명 ${r.year}`).toBe(r.lifeExpectancy);
    }
  });

  it('실적 구간이 기존 tfr·life-expectancy 지표(실제 통계)와 같다: 2022년 합계출산율 0.78, 2021·2022년 기대수명 83.6·82.7', () => {
    const tfr = get('tfr').series as Pt[];
    const le = get('life-expectancy').series as Pt[];
    for (const y of [2022]) expect(at(get('projection-tfr').actual, y), `tfr ${y}`).toBe(at(tfr, y));
    for (const y of [2021, 2022]) expect(at(get('projection-life-expectancy').actual, y), `기대수명 ${y}`).toBe(at(le, y));
    expect(at(get('projection-life-expectancy').actual, 2022)).toBe(82.7);
    // 1970~2022 모든 해: 합계출산율 실적이 tfr 지표와 같다(두 표가 같은 인구동태통계)
    for (const p of pts(get('projection-tfr').actual)) expect(p.value, `tfr ${p.year}`).toBe(at(tfr, p.year));
  });

  it('고위·저위는 2022년 같은 값에서 갈라지고, 2072년 합계출산율 중위 1.08 · 고위 1.34 · 저위 0.82, 기대수명 중위 91.1', () => {
    for (const id of ['projection-tfr', 'projection-life-expectancy']) {
      const [m, h, l] = ['median', 'high', 'low'].map((k) => series(id, k));
      expect(h[0].value, id).toBe(m[0].value);
      expect(l[0].value, id).toBe(m[0].value);
      expect(at(h, 2072), id).toBeGreaterThan(at(m, 2072));
      expect(at(m, 2072), id).toBeGreaterThan(at(l, 2072));
    }
    expect([at(series('projection-tfr', 'median'), 2072), at(series('projection-tfr', 'high'), 2072), at(series('projection-tfr', 'low'), 2072)]).toEqual([1.08, 1.34, 0.82]);
    expect(at(series('projection-life-expectancy'), 2072)).toBe(91.1);
  });

  it('전체 기대수명은 같은 해 남자와 여자 값 사이에 있다(중위 2022~2072)', () => {
    const all = series('projection-life-expectancy');
    const male = rel('projection-life-expectancy', 'male');
    const female = rel('projection-life-expectancy', 'female');
    for (const p of all) {
      expect(at(male, p.year), `${p.year}`).toBeLessThanOrEqual(p.value);
      expect(p.value, `${p.year}`).toBeLessThanOrEqual(at(female, p.year));
    }
  });

  it('notes 속 숫자: 2022년 기준 합계출산율 전망은 2024~2025년 실제보다 낮다 — 중위 0.68·0.65, 고위 0.75, 2023년 0.72가 데이터와 같다', () => {
    const notes = get('projection-tfr').notes!;
    const tfr = get('tfr').series as Pt[];
    expect(decimalsIn(notes).sort()).toEqual(['0.65', '0.68', '0.72', '0.75']);
    expect(at(series('projection-tfr'), 2024)).toBe(0.68);
    expect(at(series('projection-tfr'), 2025)).toBe(0.65);
    expect(at(series('projection-tfr', 'high'), 2025)).toBe(0.75);
    expect(at(series('projection-tfr'), 2023)).toBe(0.72);
    expect(at(tfr, 2023)).toBe(0.72);
    expect(at(tfr, 2024)).toBeGreaterThan(at(series('projection-tfr'), 2024));
    expect(at(tfr, 2025)).toBeGreaterThan(at(series('projection-tfr'), 2025));
    expect(at(tfr, 2025)).toBeGreaterThan(at(series('projection-tfr', 'high'), 2025));
  });
});

describe('1인 가구 전망 — 장래가구추계(2022년 기준, 2024-09-12 발표)', () => {
  const id = 'projection-one-person-households';
  const one = () => [...pts(related(id, 'oneHouseholds').actual), ...rel(id, 'oneHouseholds', 'main')];
  const all = () => [...pts(related(id, 'allHouseholds').actual), ...rel(id, 'allHouseholds', 'main')];
  const share = () => [...pts(get(id).actual), ...series(id, 'main')];

  it('2000~2052 연속 53개 연도이고(앞선 구간 2000~2021 + 추계 2022~2052), 비율 = 1인 가구 수 ÷ 전체 가구 수(소수 첫째 자리 반올림)이다', () => {
    expect(share().map((p) => p.year)).toEqual(YEARS(2000, 2052));
    expect(one().map((p) => p.year)).toEqual(YEARS(2000, 2052));
    expect(all().map((p) => p.year)).toEqual(YEARS(2000, 2052));
    for (const y of YEARS(2000, 2052)) expect(Math.round((at(one(), y) / at(all(), y)) * 1000) / 10, `${y}`).toBe(at(share(), y));
    expect(related(id, 'oneHouseholds').unit).toBe('가구');
  });

  it('보도자료 본문: 2022년 1인 가구 34.1%(738만 9천 가구) → 2052년 41.3%(962만 가구), 7.2%p 증가', () => {
    expect(at(share(), 2022)).toBe(34.1);
    expect(at(share(), 2052)).toBe(41.3);
    expect(round1(at(share(), 2052) - at(share(), 2022))).toBe(7.2);
    expect(Math.round(at(one(), 2022) / 1000)).toBe(7389); // 천 가구 = 738만 9천 가구
    expect(man(at(one(), 2052))).toBe(962);
    expect(get(id).latest).toEqual({ year: 2052, value: 41.3 });
  });

  it('보도자료 본문: 총가구 2022년 2,166만 4천 → 2041년 2,437만 2천 정점 → 2052년 2,327만 7천', () => {
    const t = all();
    expect(Math.round(at(t, 2022) / 1000)).toBe(21664);
    const peak = t.reduce((a, b) => (b.value > a.value ? b : a));
    expect(peak.year).toBe(2041);
    expect(Math.round(peak.value / 1000)).toBe(24372);
    expect(Math.round(at(t, 2052) / 1000)).toBe(23277);
  });

  it('notes 속 수치: 2022년 1인 가구 34.1%, 인구주택총조사의 single-household 지표(2025년 36.6%)와 기준 시점이 달라 직접 빼지 않는다', () => {
    const notes = get(id).notes!;
    expect(decimalsIn(notes).sort()).toEqual(['34.1', '36.6']);
    const sh = get('single-household');
    expect(sh.latest).toEqual({ year: 2025, value: 36.6 });
    expect(at(share(), 2022)).toBe(34.1);
    expect(notes).toContain('기준 시점이 달라');
    expect(get(id).projection!.baseNote).toContain('7월 1일');
  });
});

describe('연령별 경제력 격차 지표 — 소득분배지표(연령계층별, 가계금융복지조사) (형진 님 답 M8)', () => {
  const g = () => get('income-gap-by-age');
  const m = (key: string, band: string) => {
    const x = g().measures!.find((q) => q.key === key)!.bands.find((b) => b.key === band)!;
    return x.series;
  };

  it('income-gap-by-age: 기존 line 형식 — 단위 배, 소수 2자리, 2011~2024 14개 연도 연속, 큰 숫자 = 66세 이상 2024년, 캐러셀 아님', () => {
    const i = g();
    expect(i.kind).toBe('line');
    expect(i.use).toEqual(['research']);
    expect(i.unit).toBe('배');
    expect(i.latestUnit).toBe('배');
    expect(i.decimals).toBe(2);
    expect(i.series!.map((p) => (p as Pt).year)).toEqual(YEARS(2011, 2024));
    expect(i.latest).toEqual({ year: 2024, value: 6.9 });
    expect(formatIndicatorValue(getUsableIndicator('income-gap-by-age')!).text).toBe('6.90배');
    expect(i.seriesLabel).toBe('66세 이상(은퇴연령인구)');
    expect(i.extraSeries).toHaveLength(1);
    expect(i.extraSeries![0].label).toBe('18~65세(근로연령인구)');
  });

  it('measures: 소득 5분위배율·지니계수 × 처분가능소득·시장소득 × 연령 3구간(원문 이름 그대로) × 14개 연도', () => {
    const ms = g().measures!;
    expect(ms.map((x) => x.key)).toEqual(['quintileRatio-disposable', 'gini-disposable', 'quintileRatio-market', 'gini-market']);
    for (const x of ms) {
      expect(x.bands.map((b) => b.key), x.key).toEqual(['working', 'retired', 'senior']);
      expect(x.bands.map((b) => b.label), x.key).toEqual(['근로연령인구(18~65세)', '은퇴연령인구(66세 이상)', '노인인구(65세이상)']);
      for (const b of x.bands) {
        expect(b.series.map((p) => p.year), `${x.key}/${b.key}`).toEqual(YEARS(2011, 2024));
        for (const p of b.series) expect(Number.isFinite(p.value) && p.value > 0, `${x.key}/${b.key}/${p.year}`).toBe(true);
      }
    }
    expect(ms[1].unit).toBeNull();
    expect(ms[0].unit).toBe('배');
  });

  it('그래프에 쓰는 두 선이 measures의 처분가능소득 5분위배율과 같다(66세 이상 11.44 → 6.90, 18~65세 7.12 → 5.01)', () => {
    expect(g().series).toEqual(m('quintileRatio-disposable', 'retired'));
    expect(g().extraSeries![0].series).toEqual(m('quintileRatio-disposable', 'working'));
    expect([at(m('quintileRatio-disposable', 'retired'), 2011), at(m('quintileRatio-disposable', 'retired'), 2024)]).toEqual([11.44, 6.9]);
    expect([at(m('quintileRatio-disposable', 'working'), 2011), at(m('quintileRatio-disposable', 'working'), 2024)]).toEqual([7.12, 5.01]);
  });

  it('2024년 값(KOSIS 표): 처분가능소득 5분위배율 66세 이상 6.90·18~65세 5.01, 시장소득 37.89·7.08, 지니계수 처분가능 0.377·0.303·시장 0.541·0.354 — 같은 나이대 안의 격차는 66세 이상이 더 크다', () => {
    expect(at(m('quintileRatio-disposable', 'retired'), 2024)).toBe(6.9);
    expect(at(m('quintileRatio-disposable', 'working'), 2024)).toBe(5.01);
    expect(at(m('quintileRatio-market', 'retired'), 2024)).toBe(37.89);
    expect(at(m('quintileRatio-market', 'working'), 2024)).toBe(7.08);
    expect(at(m('gini-disposable', 'retired'), 2024)).toBe(0.377);
    expect(at(m('gini-disposable', 'working'), 2024)).toBe(0.303);
    expect(at(m('gini-market', 'retired'), 2024)).toBe(0.541);
    expect(at(m('gini-market', 'working'), 2024)).toBe(0.354);
    // 66세 이상이 18~65세보다 큰 해: 2011~2024 모든 해(처분가능소득 두 지표)
    for (const y of YEARS(2011, 2024)) {
      expect(at(m('quintileRatio-disposable', 'retired'), y), `5분위배율 ${y}`).toBeGreaterThan(at(m('quintileRatio-disposable', 'working'), y));
      expect(at(m('gini-disposable', 'retired'), y), `지니 ${y}`).toBeGreaterThan(at(m('gini-disposable', 'working'), y));
    }
  });

  it('보도자료(2025-12-04) 전체 인구 값 — 지니계수 0.325·5분위배율 5.78배(처분가능소득)가 연령계층별 값 사이에 있다', () => {
    expect(at(m('gini-disposable', 'working'), 2024)).toBeLessThan(0.325);
    expect(0.325).toBeLessThan(at(m('gini-disposable', 'retired'), 2024));
    expect(at(m('quintileRatio-disposable', 'working'), 2024)).toBeLessThan(5.78);
    expect(5.78).toBeLessThan(at(m('quintileRatio-disposable', 'retired'), 2024));
  });

  it('notes 속 소수 수치(시장소득 5분위배율 37.89배, 처분가능소득 6.90배)가 데이터와 같다', () => {
    expect(decimalsIn(g().notes!).sort()).toEqual(['37.89', '6.90']);
    expect(at(m('quintileRatio-market', 'retired'), 2024).toFixed(2)).toBe('37.89');
    expect(at(m('quintileRatio-disposable', 'retired'), 2024).toFixed(2)).toBe('6.90');
  });

  it('poverty-by-age-band: 원문 연령 7구간 그대로의 막대(2024년), 단위 %, 큰 숫자 = 76세 이상 53.8%, 캐러셀 아님', () => {
    const i = get('poverty-by-age-band');
    expect(i.kind).toBe('bar');
    expect(i.use).toEqual(['research']);
    expect(i.latest).toEqual({ year: 2024, value: 53.8 });
    expect(i.latestLabel).toBe('76세 이상 상대적 빈곤율(2024년)');
    expect(i.series).toEqual([
      { label: '0~17세', value: 9.5 },
      { label: '18~25세', value: 9.3 },
      { label: '26~40세', value: 8 },
      { label: '41~50세', value: 9.3 },
      { label: '51~65세', value: 13.1 },
      { label: '66~75세', value: 26.6 },
      { label: '76세 이상', value: 53.8 },
    ]);
    expect(i.meanIncome).toEqual({
      unit: '만 원',
      decimals: 0,
      year: 2024,
      rows: [
        { label: '0~17세', value: 4542 },
        { label: '18~25세', value: 4860 },
        { label: '26~40세', value: 4826 },
        { label: '41~50세', value: 4781 },
        { label: '51~65세', value: 4845 },
        { label: '66~75세', value: 3596 },
        { label: '76세 이상', value: 2453 },
      ],
    });
  });

  it('poverty-by-age-band 2011~2024: 7구간 × 14개 연도, 막대(2024)가 history의 2024년 값과 같고 50세 이후 나이가 많을수록 빈곤율이 높다', () => {
    const i = get('poverty-by-age-band');
    const h = i.history!;
    expect(h.years).toEqual(YEARS(2011, 2024));
    expect(h.poverty).toHaveLength(7);
    expect(h.meanIncome).toHaveLength(7);
    for (const b of [...h.poverty, ...h.meanIncome]) expect(b.series.map((p) => p.year), b.label).toEqual(YEARS(2011, 2024));
    expect(h.poverty.map((b) => b.label)).toEqual((i.series as Array<{ label: string }>).map((b) => b.label));
    for (const [k, b] of h.poverty.entries()) expect(at(b.series, 2024), b.label).toBe((i.series as Array<{ value: number }>)[k].value);
    const v = (i.series as Array<{ value: number }>).map((b) => b.value);
    expect(v[3]).toBeLessThan(v[4]);
    expect(v[4]).toBeLessThan(v[5]);
    expect(v[5]).toBeLessThan(v[6]);
  });

  it('66세 이상 전체 빈곤율(기존 elderly-poverty 2024년 37.7%)이 66~75세와 76세 이상 사이에 있다 — 같은 표의 값임을 확인', () => {
    const ep = get('elderly-poverty');
    expect(ep.latest).toEqual({ year: 2024, value: 37.7 });
    const b = (get('poverty-by-age-band').series as Array<{ label: string; value: number }>);
    expect(b.find((x) => x.label === '66~75세')!.value).toBeLessThan(37.7);
    expect(b.find((x) => x.label === '76세 이상')!.value).toBeGreaterThan(37.7);
  });
});

describe('문장 속 수치 — notes·definition의 소수 수치는 데이터 값과 같다(지어낸 수치 0)', () => {
  it('지표 9개의 notes·definition에 적힌 소수 수치가 정확히 이 목록이고, 각각 데이터·기존 지표의 값과 같다', () => {
    const EXPECT: Record<string, string[]> = {
      'projection-population-total': [],
      'projection-aging-share': ['20.7'],
      'projection-working-age': [],
      'projection-newborn-age-structure': [],
      'projection-tfr': ['0.65', '0.68', '0.72', '0.75'],
      'projection-life-expectancy': ['82.7'],
      'projection-one-person-households': ['34.1', '36.6'],
      'income-gap-by-age': ['37.89', '6.90'],
      'poverty-by-age-band': [],
    };
    for (const id of NEW_IDS) {
      const i = get(id);
      expect(decimalsIn(`${i.definition} ${i.notes ?? ''}`).sort(), id).toEqual(EXPECT[id]);
    }
    // 값 대조: 현재 지표 aging-rate 20.7%, 2022년 기대수명 실적 82.7세
    expect(get('aging-rate').latest!.value.toFixed(1)).toBe('20.7');
    expect(at(get('projection-life-expectancy').actual, 2022).toFixed(1)).toBe('82.7');
    expect(get('projection-aging-share').notes).toContain('aging-rate');
    expect(get('projection-life-expectancy').notes).toContain('코로나19');
  });

  it('crossChecks 속 「N만 명」 값은 데이터에서 다시 계산한 값이다(총인구·고령인구·생산연령인구·가구)', () => {
    const cc = (id: string) => get(id).verification.crossChecks!.join(' / ');
    const total = series('projection-population-total');
    expect(cc('projection-population-total')).toContain(`2022년 ${man(at(total, 2022)).toLocaleString('en-US')}만 명`);
    expect(cc('projection-population-total')).toContain(`2072년 ${man(at(total, 2072)).toLocaleString('en-US')}만 명(중위)`);
    expect(cc('projection-population-total')).toContain(`고위 ${man(at(series('projection-population-total', 'high'), 2072)).toLocaleString('en-US')}만 명`);
    const p65 = rel('projection-aging-share', 'population65plus');
    expect(cc('projection-aging-share')).toContain(`2072년 ${man(at(p65, 2072)).toLocaleString('en-US')}만 명`);
    expect(cc('projection-working-age')).toContain(`2072년 ${man(at(series('projection-working-age'), 2072)).toLocaleString('en-US')}만 명`);
    const one = rel('projection-one-person-households', 'oneHouseholds', 'main');
    expect(cc('projection-one-person-households')).toContain(`2052년 41.3%(${at(one, 2052).toLocaleString('en-US')}가구)`);
  });
});

describe('캐러셀에는 연결하지 않았다 · 기존 지표 불변', () => {
  it('새 지표 9개 모두 use에 carousel이 없고, 캐러셀 지표는 여전히 14개(CAROUSEL_ORDER 그대로)이다', () => {
    for (const id of NEW_IDS) expect(get(id).use, id).not.toContain('carousel');
    const ids = getCarouselIndicators().map((i) => i.id);
    expect(ids).toEqual([...CAROUSEL_ORDER]);
    expect(ids).toHaveLength(14);
    for (const id of NEW_IDS) expect(ids, id).not.toContain(id);
    expect(getUsableIndicators('carousel')).toHaveLength(14);
  });

  it('use future는 기존 둘(future-projection·heat-projection) + 새 전망 7개, use research에 격차 2개가 늘었다', () => {
    const f = getUsableIndicators('future').map((i) => i.id);
    expect(f).toEqual(expect.arrayContaining(['future-projection', 'heat-projection', ...PROJ_IDS]));
    expect(f).toHaveLength(2 + PROJ_IDS.length);
    const r = getUsableIndicators('research').map((i) => i.id);
    expect(r).toEqual(expect.arrayContaining(GAP_IDS));
  });

  it('접근자가 새 지표를 돌려준다(usable·verified·latest·source) — 값은 읽기 전용으로 쓴다', () => {
    for (const id of NEW_IDS) {
      const u = getUsableIndicator(id);
      expect(u, id).toBeDefined();
      expect(u!.usable).toBe(true);
      expect(u!.latest).not.toBeNull();
      expect(u!.source.accessedOn).toBe('2026-10-21');
    }
  });

  it('기존 지표의 대표 값이 그대로다(합계출산율 0.80, 노인빈곤율 37.7, 폭염일수 86.4, future-projection 7행)', () => {
    expect(get('tfr').latest).toEqual({ year: 2025, value: 0.8 });
    expect(get('elderly-poverty').latest).toEqual({ year: 2024, value: 37.7 });
    expect(get('heat-projection').latest).toEqual({ year: 2081, value: 86.4 });
    expect((get('future-projection').rows ?? []).length).toBe(7);
    expect(get('aging-rate').latest).toEqual({ year: 2025, value: 20.7 });
    expect(get('single-household').latest).toEqual({ year: 2025, value: 36.6 });
  });
});

describe('근거 문서·수집 기록·제안표 연결', () => {
  const block = (basisId: string): string => {
    const k = basisDoc.indexOf(`### ${basisId} `);
    if (k < 0) throw new Error(`근거 행 없음 ${basisId}`);
    const next = basisDoc.indexOf('\n### ', k + 5);
    return basisDoc.slice(k, next < 0 ? undefined : next);
  };

  it('근거 문서에 s-092~s-100 행이 있고 각 행의 수치 칸이 큰 숫자와 같으며, 「캐러셀에는 아직 연결하지 않음」이 적혀 있다', () => {
    for (const id of NEW_IDS) {
      const i = get(id);
      const b = block(i.basisId);
      const line = b.split('\n').find((l) => l.startsWith('- **수치**:'))!;
      expect(line, id).toContain(`${i.latest!.year}년`);
      expect(line, id).toContain(formatIndicatorValue(getUsableIndicator(id)!).text);
      expect(b, id).toContain('**상태**: **확인**');
      expect(b, id).toContain('캐러셀에는 아직 연결하지 않음');
      expect(b, id).toContain(i.source!.url);
    }
  });

  it('수집 기록에 새 지표 9개가 적혀 있고 3.12절 표의 값이 데이터와 같다', () => {
    const k = sourcesDoc.indexOf('### 3.12 SPEC-005 QI4 1단계 수집 결과');
    const end = sourcesDoc.indexOf('\n## 4. 갱신 방법과 주기');
    expect(k).toBeGreaterThan(0);
    const sec = sourcesDoc.slice(k, end);
    for (const id of NEW_IDS) {
      expect(sourcesDoc, id).toContain(`\`${id}\``);
      const row = sec.split('\n').find((l) => l.startsWith(`| \`${id}\` |`));
      expect(row, `${id} 3.12절 행`).toBeDefined();
      expect(row, id).toContain(get(id).basisId);
      expect(row, id).toContain(formatIndicatorValue(getUsableIndicator(id)!).text);
    }
  });

  it('수집 기록: 2026-10-21 접근 기록(robots 별도 단계·UA·요청 수·내려받기 0)·공공누리 제1유형 확인·출처 표시 의무·새 판 확인·못 구한 것(이유)이 있다', () => {
    for (const s of [
      'SPEC-005 QI4 1단계(2026-10-21) 접근 기록',
      '본문 요청 전, 별도 단계',
      'Claude/2.37337.1',
      '**파일 내려받기 0건**',
      '`www.k-stat.go.kr`',
      '`www.nabo.go.kr`',
      '`www.keis.or.kr`',
      '셋 모두 제1유형(출처표시)',
      '출처 표시 의무',
      '2022년 기준(2023-12-14 발표)이 2026-10-21 현재 가장 새 판',
      '국민연금 재정추계',
      '국가 재정 전망',
      '학령인구',
    ]) expect(sourcesDoc, s).toContain(s);
    // 요청 수는 사이트마다 한도(300회) 안임을 적었다
    expect(sourcesDoc).toContain('어느 사이트도 한도(300회) 안이다');
  });

  it('제안표: 새 지표 9개와 heat-projection 행이 있고, 표제어 후보는 SH2 규칙(24자 이하·숫자와 연도 없음·느낌표 없음·금지어 없음)을 지킨다', () => {
    const FORBIDDEN = ['문제', '탓', '때문', '심각', '위기', '충격', '최악', '참담', '실패', '낙오', '무능', '게으'];
    const rows = slidesDoc.split('\n').filter((l) => /^\| `(projection-|income-gap|poverty-by|heat-projection)/.test(l));
    expect(rows.map((r) => /`([^`]+)`/.exec(r)![1].replace(/\(.*$/, ''))).toEqual(expect.arrayContaining([...NEW_IDS, 'heat-projection']));
    let candidates = 0;
    for (const r of rows) {
      const cell = r.split('|')[2];
      for (const m of cell.matchAll(/「([^」]+)」\((\d+)자/g)) {
        candidates++;
        const text = m[1];
        expect([...text].length, text).toBe(Number(m[2]));
        expect([...text].length, text).toBeLessThanOrEqual(24);
        // 형진 님 예시 「나이들수록 …」는 숫자가 없고 24자다
        expect(text, text).not.toMatch(/\d/);
        expect(text, text).not.toMatch(/[!！]/);
        for (const w of FORBIDDEN) expect(text, `${text} 금지어 ${w}`).not.toContain(w);
        expect(/[?요]$/.test(text), `${text} 질문형·해요체 끝`).toBe(true);
        // 현재 캐러셀 표제어와 같은 글이 없다(SH2 ⑥ 중복 없음)
        expect(Object.values(STAT_HEADLINES).map((h) => h.insight), text).not.toContain(text);
      }
    }
    expect(candidates).toBeGreaterThanOrEqual(11);
  });

  it('제안표: 공식 통계명 줄이 FC2 형식 `{공식 전망명}({발표 연도} 발표, {기준 연도} 기준, …)`이고 발표 연도·기준 연도가 데이터와 같다', () => {
    for (const p of PROJ) {
      const row = slidesDoc.split('\n').find((l) => l.startsWith(`| \`${p.id}\` |`))!;
      expect(row, p.id).toBeDefined();
      const m = /`([^`]+\(\d{4}년 발표, \d{4}년 기준[^`]*\))`/.exec(row);
      expect(m, `${p.id} 공식 통계명 줄`).not.toBeNull();
      expect(m![1], p.id).toContain(`(${p.releasedOn.slice(0, 4)}년 발표, ${p.baseYear}년 기준`);
      expect(m![1], p.id).toContain(p.report.split(':')[0]);
    }
    const nb = slidesDoc.split('\n').find((l) => l.startsWith(`| \`${NEWBORN}\` |`))!;
    expect(nb).toContain('장래인구추계(2023년 발표, 2022년 기준, 중위 추계)');
  });

  it('제안표: 보여 줄 값이 데이터의 큰 숫자와 같다(총인구 36,222,293명·65세 이상 47.7%·15~64세 16,575,182명·합계출산율 1.08명·기대수명 91.1세·1인 가구 41.3%·30세가 되는 해 42.1%·66세 이상 6.90배·76세 이상 53.8%)', () => {
    for (const id of NEW_IDS) {
      const row = slidesDoc.split('\n').find((l) => l.startsWith(`| \`${id}\` |`));
      expect(row, id).toBeDefined();
      expect(row, id).toContain(formatIndicatorValue(getUsableIndicator(id)!).text);
    }
  });

  it('제안표: 실측·전망 경계가 데이터의 actualThrough와 같게 적혀 있다(인구 1960~2022·2023~2072, 가구 2000~2021·2022~2052, 출산율·기대수명 1970~2022)', () => {
    const row = (id: string) => slidesDoc.split('\n').find((l) => l.startsWith(`| \`${id}\` |`))!;
    expect(row('projection-population-total')).toContain('1960~2022 실선');
    expect(row('projection-population-total')).toContain('2023~2072 점선');
    expect(row('projection-aging-share')).toContain('1960~2022 실선');
    expect(row('projection-working-age')).toContain('2023~2072 점선');
    expect(row('projection-one-person-households')).toContain('2000~2021 실선');
    expect(row('projection-one-person-households')).toContain('2022~2052 점선');
    expect(row('projection-tfr')).toContain('1970~2022 실선');
    expect(row('projection-life-expectancy')).toContain('1970~2022 실선');
    for (const p of PROJ) expect(get(p.id).projection!.actualThrough).toBe(Number(/(\d{4})~(\d{4}) 실선/.exec(row(p.id))![2]));
  });

  it('제안표 캐러셀 순서: 20개 이하이고, 앞 15개는 현재 14개(CAROUSEL_ORDER 순서)에 격차 슬라이드를 elderly-poverty 뒤에 끼운 것이며 끝 5개가 전망이다', () => {
    const k = slidesDoc.indexOf('## 4. 캐러셀 순서 제안');
    const sec = slidesDoc.slice(k, slidesDoc.indexOf('\n## 5.', k));
    const ids = sec
      .split('\n')
      .filter((l) => /^\| \d+ \| `/.test(l))
      .map((l) => /^\| (\d+) \| `([^`]+)`/.exec(l)!)
      .map((m) => ({ n: Number(m[1]), id: m[2] }));
    expect(ids.map((x) => x.n)).toEqual(YEARS(1, ids.length));
    expect(ids.length).toBeLessThanOrEqual(20);
    expect(ids.length).toBe(20);
    const present = [...CAROUSEL_ORDER];
    const expectedPresent = [...present.slice(0, present.indexOf('elderly-poverty') + 1), 'income-gap-by-age', ...present.slice(present.indexOf('elderly-poverty') + 1)];
    expect(ids.slice(0, 15).map((x) => x.id)).toEqual(expectedPresent);
    expect(ids.slice(15).map((x) => x.id).sort()).toEqual(['heat-projection', 'projection-aging-share', 'projection-newborn-age-structure', 'projection-one-person-households', 'projection-population-total']);
    // 전망 슬라이드는 4~6개(M10)
    expect(ids.length - 15).toBeGreaterThanOrEqual(4);
    expect(ids.length - 15).toBeLessThanOrEqual(6);
    // 끝의 전망 5개 중 4개는 koreaStats의 projection 지표이고 하나는 기존 heat-projection이다
    expect(ids.slice(15).filter((x) => get(x.id).kind === 'projection')).toHaveLength(4);
  });

  it('제안표: 형진 님 예시 문장 판단이 한 줄로 있고 대안 표제어 둘이 있다 · elderly-poverty는 그대로 둔다는 제안이 있다', () => {
    expect(slidesDoc).toContain('**한 줄 판단**');
    expect(slidesDoc).toContain('부분 일치');
    expect(slidesDoc).toContain('「나이가 들면 또래 간 소득 차이가 커질까?」');
    expect(slidesDoc).toContain('「나이대별로 소득 격차가 어떻게 다를까?」');
    expect(slidesDoc).toContain('새 지표로 둔다(추가)');
    expect(slidesDoc).toContain('`elderly-poverty`는 **그대로 둔다**');
  });
});
