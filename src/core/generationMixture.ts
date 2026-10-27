import { GENERATION_CONFIG } from '../data/generationConfig';
import { generationDef, yearsOfGeneration } from '../data/generations';
import { REGION_KEYS, type RegionKey } from '../data/regionKeys';
import { birthYearTables } from './gameData';
import type { Rng } from './rng';
import { GENERATION_IDS, type GenerationId } from './types';

/**
 * 세대 전체 기준의 섞은 값 (SPEC-004 GS6·GS7·NR1·NR6 — 시안 생성기 `scripts/design/buildGm3Mockups.mjs`의 `yearOddsFor`·`regionShare`·`wealthFor`·`largestRemainder`·`genMixture`를 옮긴 것).
 * 순수 함수 — 난수·시각·DOM이 없다. 데이터(출생 연도 표)는 인자로 받거나 `core/gameData.ts`에 놓인 것을 읽는다.
 *
 * ## 무엇을 섞는가
 * 출생 연도는 룰렛에 보이지 않게 뽑히고(GS6) 룰렛 아래 표는 **고른 세대 전체 기준**이다. 표 값은 연도 가중 P(연도|세대)로 섞은 값이며 그것이 실제로 뽑히는 확률이다.
 *  - P(연도|세대): 그해 전국 출생아 수에 비례(`births`: 1970~2020 — X·밀레니얼·Z·알파) 또는 균등(`uniform`: 1940~1969 — 산업화·베이비붐·86; 공식 연간 통계가 없다). 겹침 해(1960~1963)는 **고른 세대 범위 안의 비율**로 센다.
 *  - 지역 = Σ P(연도) × 그해 시·도 비율 (1981~2020 시도별 출생아 비율 `birth_share_sido`, 1940~1980 인구총조사 도별 인구의 계단식 가중 `stairWeights`). 그 해에 없던 시·도는 0.
 *  - 수저 = Σ P(연도) × `wealthFor(연도)` (N29 연도별 설계값).
 * 직접 고른 시도 때문에 가능한 연도가 줄면(예: Z + 세종 → 2012) 줄어든 연도 집합으로 다시 섞는다(`years` 인자) — 원칙은 「표 = 실제로 뽑히는 확률」.
 */

/** 출생 연도 표 — 파일 `data/birthYearData.json`(생성 `scripts/genBirthYearData.ts`)의 모양 */
export interface BirthYearTables {
  /** 연도 → 전국 출생아 수(명). 공식 값이 있는 해(1970~2020)만 */
  births: Readonly<Record<string, number>>;
  /** 연도 → 시·도 키 → 비율(%). 그 해에 없던 시·도는 키가 없다 */
  regions: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/**
 * 합이 `total`이 되도록 정수로 나눈다(가장 큰 나머지 방식 — 시안 생성기의 `largestRemainder`와 같다): 내림한 뒤 모자란 몫을 소수 부분이 큰 순서로 1씩 더한다(같으면 앞 칸 먼저).
 * 입력의 합이 `total`이 아니어도 시안 생성기와 같은 결과를 낸다(`core/roulette.ts#largestRemainder`는 입력을 정규화하는 다른 함수다).
 */
export function largestRemainderTo(raw: readonly number[], total = 100): number[] {
  const fl = raw.map(Math.floor);
  const left = total - fl.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left && k < order.length; k++) fl[order[k][1]]++;
  return fl;
}

// ---------- 수저 비율의 연도 변화 (NR1, N29) ----------

interface Anchor {
  y: number;
  w: readonly number[];
}

/** 세대 7종의 가운데 해(닻)와 그 해의 수저 비율 — 닻 해 순서 */
const ANCHORS: readonly Anchor[] = GENERATION_IDS.map((id) => {
  const c = GENERATION_CONFIG[id];
  return { y: (c.birth.from + c.birth.to) / 2, w: c.wealthWeights as readonly number[] };
}).sort((a, b) => a.y - b.y);

/**
 * 출생 연도 `year`의 부모 재력 5단계 출생 비율(합 100 정수). 이웃한 두 닻 사이를 직선으로 잇고(첫 닻 앞·마지막 닻 뒤는 그 닻의 값) 표시는 `largestRemainderTo`로 합 100을 맞춘다.
 * 세대가 겹치는 해(1960~1963)도 **연도만으로** 정해진다(고른 세대와 무관). 연도별 값은 통계가 아니라 설계값이다.
 */
export function wealthFor(year: number): number[] {
  if (!Number.isFinite(year)) throw new RangeError(`wealthFor: 유한한 연도가 아니다 (${year})`);
  if (year <= ANCHORS[0].y) return [...ANCHORS[0].w];
  const last = ANCHORS[ANCHORS.length - 1];
  if (year >= last.y) return [...last.w];
  let i = 0;
  while (!(ANCHORS[i].y <= year && year <= ANCHORS[i + 1].y)) i++;
  const a = ANCHORS[i];
  const b = ANCHORS[i + 1];
  const t = (year - a.y) / (b.y - a.y);
  return largestRemainderTo(a.w.map((v, k) => v * (1 - t) + b.w[k] * t));
}

// ---------- 연도 가중 (GS7) ----------

export interface YearOdd {
  year: number;
  /** 그해 전국 출생아 수(명) — `uniform`이면 null */
  births: number | null;
  /** 이 세대(또는 줄어든 연도 집합) 안의 확률(%, 합 100) */
  p: number;
}

export type YearBasis = 'births' | 'uniform';

/** 이 세대의 연도 가중 기준: 모든 해에 출생아 수가 있으면 `births`, 하나도 없으면 `uniform`. 섞여 있으면 throw(한 세대 안에서 기준이 섞이지 않는다 — DC2 마스터 결정 1) */
export function yearBasisOf(generation: GenerationId, tables: BirthYearTables = birthYearTables()): YearBasis {
  const years = yearsOfGeneration(generation);
  const have = years.filter((y) => typeof tables.births[String(y)] === 'number').length;
  if (have === 0) return 'uniform';
  if (have === years.length) return 'births';
  throw new RangeError(`yearBasisOf: ${generation}의 출생아 수가 일부 해에만 있다 (${have}/${years.length}) — 한 세대 안에서 기준이 섞인다`);
}

/**
 * 연도 확률(합 100, GS7): `births`면 그해 출생아 수에 비례, `uniform`이면 균등. `years`를 주면 그 연도 집합(세대 범위의 부분집합)으로 다시 정규화한다(직접 고른 시도로 연도가 줄 때, RG2).
 * 연도 집합이 비면 throw.
 */
export function yearOddsOf(generation: GenerationId, tables: BirthYearTables = birthYearTables(), years?: readonly number[]): YearOdd[] {
  const all = yearsOfGeneration(generation);
  const use = years === undefined ? all : all.filter((y) => years.includes(y));
  if (use.length === 0) throw new RangeError(`yearOddsOf: ${generation}에 쓸 수 있는 출생 연도가 없다`);
  if (yearBasisOf(generation, tables) === 'uniform') return use.map((year) => ({ year, births: null, p: 100 / use.length }));
  const b = use.map((y) => tables.births[String(y)]);
  const sum = b.reduce((s, v) => s + v, 0);
  return use.map((year, i) => ({ year, births: b[i], p: (b[i] / sum) * 100 }));
}

/** 연도 확률로 출생 연도 하나를 뽑는다 (난수 1번 — `Rng.weightedIndex`). */
export function pickBirthYear(rng: Rng, odds: readonly YearOdd[]): number {
  return odds[rng.weightedIndex(odds.map((o) => o.p))].year;
}

// ---------- 지역 (GS7·RG2·NR3) ----------

/** 그 해 시·도 비율(%) — 없던 시·도는 null */
export function regionShareOf(year: number, key: RegionKey, tables: BirthYearTables = birthYearTables()): number | null {
  const v = tables.regions[String(year)]?.[key];
  return typeof v === 'number' ? v : null;
}

/** 그 해에 값이 있는 시·도(룰렛 지역 릴의 칸) — 시·도 표 순서 */
export function regionsInYear(year: number, tables: BirthYearTables = birthYearTables()): RegionKey[] {
  return REGION_KEYS.filter((r) => regionShareOf(year, r.key, tables) !== null).map((r) => r.key);
}

/** 이 세대 범위에서 한 번이라도 값이 있는 시·도(표의 고정 줄 — 어느 해에도 없던 시·도는 뺀다) */
export function regionRowsOf(generation: GenerationId, tables: BirthYearTables = birthYearTables()): RegionKey[] {
  const years = yearsOfGeneration(generation);
  return REGION_KEYS.filter((r) => years.some((y) => regionShareOf(y, r.key, tables) !== null)).map((r) => r.key);
}

// ---------- 세대 전체 기준의 섞은 값 ----------

export interface GenMixture {
  generation: GenerationId;
  basis: YearBasis;
  odds: YearOdd[];
  /** 지역 표의 줄(시·도 표 순서) — pct는 소수 1자리, 합 100.0 */
  region: Array<{ key: RegionKey; short: string; pct: number }>;
  /** 수저 5단계 표(정수, 합 100) */
  wealth: number[];
  /** 세대 범위 도중에 생긴 시·도의 줄임 이름들(첫 해에 없고 뒤 해에 있다) — 표 아래 주석 재료 */
  later: string[];
  /** 1981년 앞의 해가 들어 있는가(인구 비례로 센 해가 있다) — 「인구 비례(출생 자료 없음)」 주석 */
  popYears: boolean;
}

/**
 * 세대 전체 기준의 섞은 값 (표시 합: 지역 100.0 소수 1자리 · 수저 100 정수). `years`를 주면 줄어든 연도 집합으로 다시 섞는다(수저 표·수저 구간).
 * 지역 줄은 **세대 범위 전체**의 시·도 합집합을 쓴다(직접 고른 시도의 판은 지역 표 대신 「직접 고른 시도」를 보이므로 지역 값은 쓰이지 않는다).
 */
export function genMixture(generation: GenerationId, tables: BirthYearTables = birthYearTables(), years?: readonly number[]): GenMixture {
  const odds = yearOddsOf(generation, tables, years);
  const rows = regionRowsOf(generation, tables);
  if (rows.length === 0) throw new RangeError(`genMixture: ${generation}의 지역 자료가 없다`);
  const regionRaw = rows.map((key) => odds.reduce((s, o) => s + (o.p / 100) * (regionShareOf(o.year, key, tables) ?? 0), 0));
  const tenths = largestRemainderTo(
    regionRaw.map((v) => v * 10),
    1000,
  );
  const wealthRaw = [0, 0, 0, 0, 0];
  for (const o of odds) {
    const w = wealthFor(o.year);
    for (let k = 0; k < 5; k++) wealthRaw[k] += (o.p / 100) * w[k];
  }
  const firstYear = generationDef(generation).birth.from;
  return {
    generation,
    basis: yearBasisOf(generation, tables),
    odds,
    region: rows.map((key, i) => ({ key, short: REGION_KEYS.find((r) => r.key === key)!.short, pct: tenths[i] / 10 })),
    wealth: largestRemainderTo(wealthRaw),
    later: rows.filter((key) => regionShareOf(firstYear, key, tables) === null).map((key) => REGION_KEYS.find((r) => r.key === key)!.short),
    popYears: firstYear < 1981,
  };
}

/** 수저 구간(`bandOf`)의 재료: 이 세대(또는 줄어든 연도 집합)의 섞은 수저 비율 5개 (룰렛 결과 줄·출생신고 「집안 형편」·엔딩이 같은 분포를 쓴다, D4-48) */
export function wealthMixtureOf(generation: GenerationId, tables: BirthYearTables = birthYearTables(), years?: readonly number[]): number[] {
  return genMixture(generation, tables, years).wealth;
}

// ---------- 랜덤 세대 (GS3) ----------

/**
 * 「랜덤 세대」: 7세대를 같은 확률(각 1/7, `randomWeight`)로 뽑는다 — 인구 비례가 아니다. 난수 1번(`Rng.weightedIndex`).
 * 이어서 그 세대 범위 안에서 GS7 가중으로 출생 연도를 뽑는 것은 `generateBirth`가 한다.
 */
export function pickRandomGeneration(rng: Rng): GenerationId {
  return GENERATION_IDS[rng.weightedIndex(GENERATION_IDS.map((id) => GENERATION_CONFIG[id].randomWeight))];
}
