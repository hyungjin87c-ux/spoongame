import birthsRegionsJson from '../docs/data/dc2-dc7-births-regions.json';
import provincePopulationJson from '../docs/data/dc7-province-population.json';
import regionsHistoryJson from '../docs/data/dc2-dc7-regions-history.json';
import onDisk from '../src/data/birthYearData.json?raw';
import { describe, expect, it } from 'vitest';
import { buildBirthYearData, renderBirthYearData } from '../scripts/birthYearDataLib';
import { REGION_KEYS } from '../src/data/regionKeys';
import { BIRTH_YEAR_TABLES } from '../src/data/birthYearData';

/**
 * 출생 연도 표 `src/data/birthYearData.json` (SPEC-004 GS7·RG2·NR3) — DC2·DC7 자료에서 만든 생성 파일이다: 파일이 생성 결과와 같고(문서 ↔ 데이터 일치),
 * 연도 범위·시·도 존재가 행정구역 연혁(DC7 `existenceRanges`)과 맞고, 1981년을 경계로 자료의 종류(도별 인구 계단식 / 출생아 비율)가 바뀐다.
 */

describe('birthYearData.json = DC2·DC7 자료에서 만든 값', () => {
  it('파일이 생성기 결과와 글자까지 같다 (낡은 파일이면 ./node_modules/.bin/vite-node scripts/genBirthYearData.ts)', () => {
    const generated = renderBirthYearData(buildBirthYearData());
    expect(onDisk.replace(/\r\n/g, '\n')).toBe(generated);
  });

  it('출생아 수는 1970~2020 51해(공식 값), 시·도 비율은 1940~2020 81해다', () => {
    expect(Object.keys(BIRTH_YEAR_TABLES.births).map(Number)).toEqual(Array.from({ length: 51 }, (_, i) => 1970 + i));
    expect(Object.keys(BIRTH_YEAR_TABLES.regions).map(Number)).toEqual(Array.from({ length: 81 }, (_, i) => 1940 + i));
    // 1960년 출생아 수는 「신고분」이라 가중 근거로 못 쓰는 값이다 — 표에 없다
    expect(BIRTH_YEAR_TABLES.births['1960']).toBeUndefined();
    expect(BIRTH_YEAR_TABLES.births['1970']).toBe(1006645);
    expect(BIRTH_YEAR_TABLES.births['2020']).toBe(272337);
  });

  it('해마다 시·도 비율의 합이 100(±0.01)이다 — 1943·1944 같은 한반도 전체 값이 아니라 남쪽 단위만', () => {
    for (const [year, row] of Object.entries(BIRTH_YEAR_TABLES.regions)) {
      const sum = Object.values(row).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 100), `${year} 합 ${sum}`).toBeLessThan(0.02);
    }
  });

  it('시·도 키는 안정 키 17개 안이고, 해마다 값이 있는 시·도 수가 연혁과 같다 (1940~1946 8·10 → 1947 10 → 1963 11 → 1981 13 → 1986 14 → 1989 15 → 1997 16 → 2012 17)', () => {
    const keys = new Set(REGION_KEYS.map((r) => r.key as string));
    const count = (y: number) => Object.keys(BIRTH_YEAR_TABLES.regions[String(y)]).length;
    for (const row of Object.values(BIRTH_YEAR_TABLES.regions)) for (const k of Object.keys(row)) expect(keys.has(k), k).toBe(true);
    expect([1940, 1945, 1947, 1962, 1963, 1980, 1981, 1985, 1986, 1988, 1989, 1996, 1997, 2011, 2012, 2020].map(count)).toEqual([8, 8, 10, 10, 11, 11, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17]);
  });

  it('값이 있는 시·도는 연혁(dc2-dc7-regions-history.json existenceRanges)의 존재 + 일부(partial) 안에 있고, 존재하는 시·도는 모두 값이 있다 (1946 제외: 해 중간에 생긴 단위)', () => {
    const history = regionsHistoryJson as unknown as { existenceRanges: Array<{ years: string; existing: string[]; partial: string[]; absent: string[] }> };
    for (const range of history.existenceRanges) {
      const [a, b] = range.years.includes('~') ? range.years.split('~').map(Number) : [Number(range.years), Number(range.years)];
      for (let y = a; y <= b; y++) {
        const have = Object.keys(BIRTH_YEAR_TABLES.regions[String(y)]);
        for (const k of range.absent) expect(have.includes(k), `${y} ${k}는 없던 시·도`).toBe(false);
        for (const k of range.existing) expect(have.includes(k), `${y} ${k}는 있던 시·도`).toBe(true);
      }
    }
  });

  it('1980년까지는 인구 비례 계단식(도별 인구), 1981년부터는 시도별 출생아 비율이다: 원자료의 같은 해 값과 같다', () => {
    const br = birthsRegionsJson as unknown as Array<{ series: string; year: number; region?: string; value: number | null }>;
    const stair = (provincePopulationJson as unknown as { stairWeights: Array<{ year: number; region: string; share: number }> }).stairWeights;
    for (const s of stair) if (s.year <= 1980) expect(BIRTH_YEAR_TABLES.regions[String(s.year)][s.region], `${s.year} ${s.region}`).toBe(s.share);
    const seoul = br.find((r) => r.series === 'birth_share_sido' && r.year === 1988 && r.region === '서울특별시');
    expect(BIRTH_YEAR_TABLES.regions['1988'].seoul).toBe(seoul!.value);
    // 1981년부터의 값은 출생아 비율(birth_share_sido)에서만 온다 — 같은 해에 계단식 값이 섞이지 않는다
    expect(stair.filter((s) => s.year >= 1981)).toEqual([]);
  });
});
