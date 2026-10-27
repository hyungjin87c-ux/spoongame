import { describe, expect, it } from 'vitest';
import { GENERATION_IDS, type GenerationId } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { genMixture, largestRemainderTo, pickBirthYear, regionRowsOf, regionShareOf, regionsInYear, wealthFor, yearBasisOf, yearOddsOf } from '../src/core/generationMixture';
import { generationDef, yearsOfGeneration } from '../src/data/generations';
import { BIRTH_YEAR_TABLES } from '../src/data/birthYearData';
import reference from './fixtures/gm3-mixture-reference.json';

/**
 * 세대 전체 기준의 섞은 값 (SPEC-004 GS6·GS7, D4-47): 룰렛 릴 아래 지역·수저 표 = 연도 가중으로 섞은 값이 곧 실제로 뽑히는 확률이다.
 * 기준값은 시안 생성기(`scripts/design/buildGm3Mockups.mjs`)의 함수가 낸 값(`tests/fixtures/gm3-mixture-reference.json`) — 7세대 모두 소수 1자리·정수까지 같다.
 */

type RefGen = { odds: Array<{ year: number; births: number | null; p: number }>; region: Array<{ key: string; short: string; pct: string }>; wealth: number[]; later: string[]; popYears: boolean };
const REF = reference.gens as unknown as Record<string, RefGen>;
const mixOf = (id: GenerationId) => genMixture(id, BIRTH_YEAR_TABLES);

describe('largestRemainderTo (합을 정확히 맞추는 정수 나눔)', () => {
  it('내림한 뒤 모자란 몫을 소수 부분이 큰 순서로 1씩 더한다 (같으면 앞 칸 먼저)', () => {
    expect(largestRemainderTo([33.3, 33.3, 33.4])).toEqual([33, 33, 34]);
    expect(largestRemainderTo([25.5, 25.5, 25.5, 23.5])).toEqual([26, 26, 25, 23]);
    expect(largestRemainderTo([0.5, 0.5], 1)).toEqual([1, 0]);
    expect(largestRemainderTo([40, 32, 20, 7, 1])).toEqual([40, 32, 20, 7, 1]);
  });
  it('입력의 합이 total과 달라도 결과의 합은 total이다 (모자란 만큼만 나눈다)', () => {
    const out = largestRemainderTo([10.4, 10.4, 10.4, 10.4, 10.4, 10.4, 10.4, 10.4, 10.4, 10.4], 100);
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('연도 가중 (GS7) — 출생아 수 비례 / 균등, 고른 세대 범위 안의 비율', () => {
  it('산업화·베이비붐·86은 균등(uniform), X·밀레니얼·Z·알파는 출생아 수 비례(births)다 — 한 세대 안에서 기준이 섞이지 않는다', () => {
    expect(GENERATION_IDS.map((id) => yearBasisOf(id, BIRTH_YEAR_TABLES))).toEqual(['uniform', 'uniform', 'uniform', 'births', 'births', 'births', 'births']);
  });

  it('세대마다 연도 확률의 합이 100이고, 시안 생성기의 값과 같다', () => {
    for (const id of GENERATION_IDS) {
      const odds = yearOddsOf(id, BIRTH_YEAR_TABLES);
      expect(odds.map((o) => o.year), id).toEqual(yearsOfGeneration(id));
      expect(odds.reduce((s, o) => s + o.p, 0), id).toBeCloseTo(100, 9);
      expect(odds, id).toEqual(REF[id].odds);
    }
  });

  it('겹침 해(1960~1963)는 고른 세대 범위 안의 비율로 센다: 베이비붐 55~63과 86 60~69가 각각 따로 합 100 (둘 다 균등)', () => {
    const boomer = yearOddsOf('boomer', BIRTH_YEAR_TABLES);
    const g86 = yearOddsOf('g86', BIRTH_YEAR_TABLES);
    expect(boomer.find((o) => o.year === 1961)!.p).toBeCloseTo(100 / 9, 9);
    expect(g86.find((o) => o.year === 1961)!.p).toBeCloseTo(100 / 10, 9);
  });

  it('출생아 수 비례: 알파 2016년(406,243)은 2020년(272,337)보다 확률이 높다', () => {
    const odds = yearOddsOf('alpha', BIRTH_YEAR_TABLES);
    const p = (y: number) => odds.find((o) => o.year === y)!.p;
    expect(p(2016)).toBeGreaterThan(p(2020));
    expect(p(2016) / p(2020)).toBeCloseTo(BIRTH_YEAR_TABLES.births['2016'] / BIRTH_YEAR_TABLES.births['2020'], 9);
  });

  it('연도 집합이 줄면(직접 고른 시도 때문에) 줄어든 집합으로 다시 정규화한다: Z + 세종 → 2012 한 해 100%', () => {
    const only = yearOddsOf('genz', BIRTH_YEAR_TABLES, [2012]);
    expect(only).toEqual([{ year: 2012, births: BIRTH_YEAR_TABLES.births['2012'], p: 100 }]);
    const half = yearOddsOf('alpha', BIRTH_YEAR_TABLES, [2013, 2014]);
    expect(half.reduce((s, o) => s + o.p, 0)).toBeCloseTo(100, 9);
    expect(() => yearOddsOf('alpha', BIRTH_YEAR_TABLES, [1999])).toThrow();
  });

  it('출생아 수가 일부 해에만 있는 세대는 throw한다 (기준이 섞이지 않는다)', () => {
    const broken = { births: { ...BIRTH_YEAR_TABLES.births }, regions: BIRTH_YEAR_TABLES.regions };
    delete (broken.births as Record<string, number>)['1975'];
    expect(() => yearBasisOf('genx', broken)).toThrow();
  });

  it('세대 × 20000회 뽑기: 모든 연도가 1회 이상 나오고 비율이 연도 가중과 4σ 이내다', () => {
    for (const id of GENERATION_IDS) {
      const odds = yearOddsOf(id, BIRTH_YEAR_TABLES);
      const rng = createRng(1000 + GENERATION_IDS.indexOf(id));
      const counts = new Map<number, number>();
      const N = 20000;
      for (let i = 0; i < N; i++) {
        const y = pickBirthYear(rng, odds);
        counts.set(y, (counts.get(y) ?? 0) + 1);
      }
      for (const o of odds) {
        const c = counts.get(o.year) ?? 0;
        expect(c, `${id} ${o.year}년이 한 번도 나오지 않았다`).toBeGreaterThan(0);
        const p = o.p / 100;
        expect(Math.abs(c - N * p), `${id} ${o.year}`).toBeLessThanOrEqual(4 * Math.sqrt(N * p * (1 - p)));
      }
    }
  });
});

describe('지역 줄·릴 칸 (NR3·RG2)', () => {
  it('릴 칸 = 그 해에 값이 있는 시·도: 1970년 11개 · 1981년 13개 · 1988년 14개 · 1997년 16개 · 2012년 17개', () => {
    expect(regionsInYear(1970, BIRTH_YEAR_TABLES).length).toBe(11);
    expect(regionsInYear(1981, BIRTH_YEAR_TABLES).length).toBe(13);
    expect(regionsInYear(1988, BIRTH_YEAR_TABLES).length).toBe(14);
    expect(regionsInYear(1997, BIRTH_YEAR_TABLES).length).toBe(16);
    expect(regionsInYear(2012, BIRTH_YEAR_TABLES).length).toBe(17);
  });

  it('세종은 2012년 앞에는 없다 (직접 고르기 비활성의 근거 — RG2)', () => {
    for (let y = 1940; y < 2012; y++) expect(regionShareOf(y, 'sejong', BIRTH_YEAR_TABLES), `${y}`).toBeNull();
    expect(regionShareOf(2012, 'sejong', BIRTH_YEAR_TABLES)).not.toBeNull();
  });

  it('줄 수: 산업화 10 · 베이비붐 11 · 86 11 · X 11 · 밀레니얼 15 · Z 17 · 알파 17 (어느 해에도 없던 시·도는 뺀다)', () => {
    expect(GENERATION_IDS.map((id) => regionRowsOf(id, BIRTH_YEAR_TABLES).length)).toEqual([10, 11, 11, 11, 15, 17, 17]);
  });
});

describe('genMixture — 고른 세대 전체 기준 (D4-47)', () => {
  it('7세대 × 지역 표 합 100.0(소수 1자리) · 수저 표 합 100(정수)', () => {
    for (const id of GENERATION_IDS) {
      const m = mixOf(id);
      expect(Math.round(m.region.reduce((s, r) => s + r.pct * 10, 0)), id).toBe(1000);
      for (const r of m.region) expect(Math.round(r.pct * 10) / 10, `${id} ${r.key}`).toBe(r.pct);
      expect(m.wealth.reduce((a, b) => a + b, 0), id).toBe(100);
      expect(m.wealth.length).toBe(5);
    }
  });

  it('시안 생성기의 값과 7세대 모두 같다 (지역 줄·값, 수저 표, 범위 도중 생긴 시·도, 인구 비례 여부)', () => {
    for (const id of GENERATION_IDS) {
      const m = mixOf(id);
      const ref = REF[id];
      expect(m.region.map((r) => [r.key, r.short, r.pct]), id).toEqual(ref.region.map((r) => [r.key, r.short, Number(r.pct)]));
      expect(m.wealth, id).toEqual(ref.wealth);
      expect(m.later, id).toEqual(ref.later);
      expect(m.popYears, id).toBe(ref.popYears);
    }
  });

  it('기준 값 몇 개를 눈으로 고정한다: 밀레니얼 서울 24.5 · 경기 16.0, 수저 [26, 30, 27, 14, 3] / 산업화 수저 [40, 32, 20, 7, 1]', () => {
    const m = mixOf('millennial');
    expect(m.region.find((r) => r.key === 'seoul')!.pct).toBe(24.5);
    expect(m.region.find((r) => r.key === 'gyeonggi')!.pct).toBe(16);
    expect(m.wealth).toEqual([26, 30, 27, 14, 3]);
    expect(mixOf('industrial').wealth).toEqual([40, 32, 20, 7, 1]);
  });

  it('범위 도중에 생긴 시·도(표 아래 주석 재료): 산업화 「서울·제주」 · 베이비붐·86 「부산」 · 밀레니얼 「광주·대전」 · Z 「세종」 · X와 알파는 없다', () => {
    // diff-004 D4-47은 X세대를 「대구·인천」이라 적었지만 자료(1970~1980 도별 인구 계단식)에는 대구·인천 행이 없다(1981-07-01에야 독립) — 시안 생성기의 계산값(X = 없음)을 따른다
    expect(GENERATION_IDS.map((id) => mixOf(id).later)).toEqual([['서울', '제주'], ['부산'], ['부산'], [], ['광주', '대전'], ['세종'], []]);
  });

  it('1981년 앞이 든 세대(산업화~X)는 인구 비례, 밀레니얼부터는 출생아 비율만 쓴다', () => {
    expect(GENERATION_IDS.map((id) => mixOf(id).popYears)).toEqual([true, true, true, true, false, false, false]);
    // 데이터로 확인: 1980년 앞 해의 지역 값은 도별 인구 비례 계단식(같은 해 두 값이 아니라 한 값)이고, 1981년부터는 출생 비율이다 — 생성기 시험(birthYearData.test.ts)이 원자료와 대조한다
    for (const id of ['industrial', 'boomer', 'g86', 'genx'] as const) expect(Math.max(...yearsOfGeneration(id))).toBeLessThanOrEqual(1980 + 3);
  });

  it('직접 고른 시도로 연도가 줄면 줄어든 집합으로 다시 섞는다: Z + 세종 → 연도 2012만이라 수저 표 = wealthFor(2012)', () => {
    const m = genMixture('genz', BIRTH_YEAR_TABLES, [2012]);
    expect(m.odds).toHaveLength(1);
    expect(m.wealth).toEqual(wealthFor(2012));
    const full = mixOf('genz');
    expect(full.odds).toHaveLength(16);
    // 줄어든 집합의 표는 합 100을 지킨다
    expect(m.wealth.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('세대 범위와 맞지 않는 연도만 주면 throw한다', () => {
    expect(() => genMixture('alpha', BIRTH_YEAR_TABLES, [1950])).toThrow();
  });

  it('수저 표 = Σ P(연도) × wealthFor(연도): 직접 계산과 ±1(정수 보정) 이내', () => {
    for (const id of GENERATION_IDS) {
      const odds = yearOddsOf(id, BIRTH_YEAR_TABLES);
      const raw = [0, 0, 0, 0, 0];
      for (const o of odds) wealthFor(o.year).forEach((v, k) => (raw[k] += (o.p / 100) * v));
      const m = mixOf(id);
      raw.forEach((v, k) => expect(Math.abs(m.wealth[k] - v), `${id} ${k}`).toBeLessThanOrEqual(1));
    }
  });

  it('세대 정의(GD1)의 범위 안의 해만 쓴다', () => {
    for (const id of GENERATION_IDS) {
      const { from, to } = generationDef(id).birth;
      for (const o of mixOf(id).odds) expect(o.year >= from && o.year <= to).toBe(true);
    }
  });
});
