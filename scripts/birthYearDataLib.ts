import birthsRegionsJson from '../docs/data/dc2-dc7-births-regions.json';
import provincePopulationJson from '../docs/data/dc7-province-population.json';
import { REGION_KEYS } from '../src/data/regionKeys';

/**
 * 출생 연도·지역 가중 데이터 `src/data/birthYearData.json`을 DC2·DC7 자료에서 만든다 (SPEC-004 GS7·RG2·NR3).
 * 생성기 본체 — 실행은 `scripts/genBirthYearData.ts`(`./node_modules/.bin/vite-node scripts/genBirthYearData.ts`, npx를 쓰지 않는다). `tests/birthYearData.test.ts`가 파일과 이 생성 결과가 같은지 대조한다(문서 ↔ 데이터 일치).
 *  - births: 전국 출생아 수(`births_national`, 1970~2020 `actual`) — 연도 가중의 `births` 기준(GS7). 1940~1969는 공식 연간 통계가 없어 `uniform`(균등)이라 이 표에 없다.
 *  - regions: 해마다 시·도 비율(%) — 1981~2020은 시도별 출생아 비율(`birth_share_sido`, 그해의 시·도 구분), 1940~1980은 인구총조사 도별 인구의 계단식 가중(`stairWeights`). 키는 행정구역 연혁과 무관한 안정 키 17개(RG5).
 */
export interface BirthYearData {
  /** 연도 → 전국 출생아 수(명). 공식 값이 있는 해만 */
  births: Record<string, number>;
  /** 연도 → 시·도 키 → 비율(%). 그 해에 없던 시·도는 키가 없다 */
  regions: Record<string, Record<string, number>>;
}

export function buildBirthYearData(): BirthYearData {
  // 원자료는 JSON 가져오기로 읽는다 — tests/birthYearData.test.ts가 이 함수를 부르므로 브라우저 쪽 타입 검사(tsconfig.json)에 node:fs가 끼지 않게 한다
  const br = birthsRegionsJson as unknown as Array<{ series: string; year: number; region?: string; value: number | null; status?: string }>;
  const stair = (provincePopulationJson as unknown as { stairWeights: Array<{ year: number; region: string; share: number }> }).stairWeights;
  const births: Record<string, number> = {};
  for (const r of br) if (r.series === 'births_national' && r.status === 'actual' && typeof r.value === 'number' && r.year >= 1970 && r.year <= 2020) births[String(r.year)] = r.value;
  const regions: Record<string, Record<string, number>> = {};
  const put = (year: number, key: string, value: number): void => {
    (regions[String(year)] ??= {})[key] = value;
  };
  for (const s of stair) if (s.year <= 1980) put(s.year, s.region, s.share);
  for (const r of br) {
    if (r.series !== 'birth_share_sido' || r.year < 1981 || r.year > 2020 || typeof r.value !== 'number') continue;
    const def = REGION_KEYS.find((k) => k.now === r.region);
    if (def === undefined) throw new Error(`birth_share_sido: 알 수 없는 시·도 ${String(r.region)}`);
    put(r.year, def.key, r.value);
  }
  // 정렬해 두면 파일이 같은 입력에서 늘 같다
  const sortedBirths = Object.fromEntries(Object.entries(births).sort(([a], [b]) => Number(a) - Number(b)));
  const sortedRegions = Object.fromEntries(
    Object.entries(regions)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([y, row]) => [y, Object.fromEntries(Object.entries(row).sort(([a], [b]) => REGION_KEYS.findIndex((k) => k.key === a) - REGION_KEYS.findIndex((k) => k.key === b)))]),
  );
  return { births: sortedBirths, regions: sortedRegions };
}

export function renderBirthYearData(data: BirthYearData): string {
  const lines: string[] = ['{', '  "births": {'];
  const b = Object.entries(data.births);
  b.forEach(([y, v], i) => lines.push(`    "${y}": ${v}${i < b.length - 1 ? ',' : ''}`));
  lines.push('  },', '  "regions": {');
  const r = Object.entries(data.regions);
  r.forEach(([y, row], i) => lines.push(`    "${y}": ${JSON.stringify(row)}${i < r.length - 1 ? ',' : ''}`));
  lines.push('  }', '}', '');
  return lines.join('\n');
}
