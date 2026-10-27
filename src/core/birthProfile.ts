import { GENERATION_CONFIG } from '../data/generationConfig';
import { yearsOfGeneration } from '../data/generations';
import { LIFE_PARAMS_PLACEHOLDER, type LifeParams } from '../data/lifeTable';
import { MERGED_PICK, regionShort, REGION_KEY_LIST, type RegionKey } from '../data/regionKeys';
import { birthYearTables } from './gameData';
import { genMixture, wealthFor, yearOddsOf, type BirthYearTables, type YearOdd } from './generationMixture';
import { GENERATION_IDS, PARENTING_STYLES, R1_PRESENT, eraOfYear, type Era, type GameState, type GenerationChoice, type GenerationId, type ParentingStyle, type ProfileId } from './types';

const GENERATION_IDS_LIST: readonly GenerationId[] = GENERATION_IDS;

/**
 * 판의 출생 프로필 (SPEC-004 NR1·NR6, EY17): 세대 7종은 `GENERATION_CONFIG`와 출생 연도 표에서, R1 프로필(「지금 세상」 2026년생, **시험·스크립트 전용**)은 R1 때의 상수에서 값을 낸다.
 * 출생 로직(birth.ts)·룰렛(roulette.ts)·엔딩(ending.ts)·또래(peers.ts)가 모두 이 한 곳을 거쳐 세대 설정을 읽는다 — 시대 3종 `ERA_CONFIG`는 없어졌다.
 */

/** R1 「지금 세상」 프로필 — 출생 연도 2026 한 해, SPEC-003 R1의 수저·교육방식 비율 (EY17 항등 시험의 기준) */
export const R1_PROFILE = Object.freeze({
  label: '지금 세상',
  birthYear: 2026,
  wealthWeights: Object.freeze([25, 30, 28, 14, 3]) as readonly number[],
  parentingWeights: Object.freeze({ neglect: 15, free: 30, helicopter: 30, strict: 25 }) as Readonly<Record<ParentingStyle, number>>,
});

export function isR1(profile: ProfileId | null): profile is typeof R1_PRESENT {
  return profile === R1_PRESENT;
}

/** 표시 이름 (세대 이름 / R1은 「지금 세상」) */
export function profileLabel(profile: ProfileId): string {
  return profile === R1_PRESENT ? R1_PROFILE.label : GENERATION_CONFIG[profile].label;
}

/**
 * 출생 연도 확률 (GS7): 세대는 출생아 수 비례/균등(`yearOddsOf`), R1은 2026 한 해 100%.
 * `years`를 주면 그 연도 집합으로 다시 정규화한다(직접 고른 시도 때문에 연도가 줄 때, RG2).
 */
export function birthYearOddsOf(profile: ProfileId, tables: BirthYearTables = birthYearTables(), years?: readonly number[]): YearOdd[] {
  if (profile === R1_PRESENT) return [{ year: R1_PROFILE.birthYear, births: null, p: 100 }];
  return yearOddsOf(profile, tables, years);
}

/** 이 출생 연도의 부모 재력 5단계 출생 비율(합 100) — 세대는 `wealthFor(연도)`(N29), R1은 고정 */
export function wealthWeightsFor(profile: ProfileId, birthYear: number): readonly number[] {
  return profile === R1_PRESENT ? R1_PROFILE.wealthWeights : wealthFor(birthYear);
}

/** 교육방식 비율(합 100) — 순서는 PARENTING_STYLES */
export function parentingWeightsFor(profile: ProfileId): number[] {
  const w = profile === R1_PRESENT ? R1_PROFILE.parentingWeights : GENERATION_CONFIG[profile].parentingWeights;
  return PARENTING_STYLES.map((s) => w[s]);
}

/** 사망 모형 인자 (NR5는 GM10 — 지금은 모든 출생 연도가 같은 값이다) */
export function lifeParamsOf(_profile: ProfileId | null, _birthYear: number): LifeParams {
  return LIFE_PARAMS_PLACEHOLDER;
}

/**
 * 인용·시간 모델이 쓰는 시대 구간 (인용·시간 모델의 연도 축 전환은 GM10 — MG4): 세대 판은 **달력 연도**(= 출생 연도 + 나이)로 가르고, R1 프로필은 늘 「지금」이다(R1 때 그대로).
 */
export function eraBucketOf(profile: ProfileId | null, calendarYear: number): Era {
  return profile === R1_PRESENT ? 'present' : eraOfYear(calendarYear);
}

/** 읽는 시간 모델(`estimatePlaySeconds`)의 시대 구간: 한 판의 대표 시대 — 세대 판은 마흔 살의 달력 연도, R1은 「지금」 (GM10이 판 안에서 연도별 값으로 바꾼다) */
export function timingEraOf(profile: ProfileId | null, birthYear: number): Era {
  return profile === R1_PRESENT ? 'present' : eraOfYear(birthYear + 40);
}

/** 프로필 전체의 대표 시대 구간 (시간 모델 보고용): 세대는 출생 범위 가운데 해의 마흔 살 */
export function timingEraOfProfile(profile: ProfileId): Era {
  if (profile === R1_PRESENT) return 'present';
  const { from, to } = GENERATION_CONFIG[profile].birth;
  return eraOfYear(Math.round((from + to) / 2) + 40);
}

// ---------- 시도 직접 고르기 (RG1·RG2) ----------

/** 세종특별자치시가 생긴 해 — 이 해 앞에는 직접 고르기에서 연도가 빠진다 (DC7 마스터 해석 2026-10-27: 「존재」 판정에서 빠지는 키는 `sejong` 하나) */
export const SEJONG_FIRST_YEAR = 2012;

/** 이 시·도를 이 출생 연도에 직접 고를 수 있는가 (RG2) */
export function regionPickableInYear(key: RegionKey, year: number): boolean {
  return key !== 'sejong' || year >= SEJONG_FIRST_YEAR;
}

/** 이 세대에서 이 시·도를 직접 고를 수 있는 출생 연도들 (비면 비활성) */
export function pickableYears(generation: GenerationId, key: RegionKey): number[] {
  return yearsOfGeneration(generation).filter((y) => regionPickableInYear(key, y));
}

/** 이 세대에서 직접 고를 수 있는 시·도 키 (RG2 (b): 어느 연도에도 없는 시·도는 비활성) */
export function pickableRegions(generation: GenerationId): RegionKey[] {
  return REGION_KEY_LIST.filter((k) => pickableYears(generation, k).length > 0);
}

/** 이 세대에서 비활성인 시·도 (세종 × 산업화~밀레니얼) */
export function unpickableRegions(generation: GenerationId): RegionKey[] {
  return REGION_KEY_LIST.filter((k) => pickableYears(generation, k).length === 0);
}

/** 줄임 이름 → 안정 키 (R1의 합쳐진 「전남광주」는 키가 없다 → null) */
export function regionKeyOfShort(short: string): RegionKey | null {
  const hit = REGION_KEY_LIST.find((k) => regionShort(k) === short);
  return hit === undefined ? null : hit;
}

/** 직접 고른 시도의 연도 집합: 그 시도가 있던 연도만 (고르지 않았으면 undefined = 세대 범위 전체) */
export function candidateYearsOf(generation: GenerationId, pickedRegion: string | null | undefined): number[] | undefined {
  if (pickedRegion === null || pickedRegion === undefined) return undefined;
  const key = regionKeyOfShort(pickedRegion);
  return key === null ? undefined : pickableYears(generation, key);
}

/**
 * 이 판의 수저 분포 = 세대 전체 기준의 섞은 값 (룰렛 결과 줄의 구간·출생신고 「집안 형편」·엔딩이 같은 분포를 쓴다, D4-48). 직접 고른 시도로 연도가 줄었으면 줄어든 연도 집합으로 다시 섞는다.
 * R1 프로필은 고정 비율이다.
 */
export function wealthMixtureOfGame(game: Pick<GameState, 'generation'> & { regionPicked?: boolean; birthReport: { region: string } | null }, tables: BirthYearTables = birthYearTables()): number[] {
  const g = game.generation;
  if (g === null) throw new Error('wealthMixtureOfGame: 세대가 없다');
  return wealthMixtureOfProfile(g, game.regionPicked === true ? (game.birthReport?.region ?? null) : null, tables);
}

/** 프로필(과 직접 고른 시도)의 수저 분포 — 판 없이 프로필만으로 (시뮬레이션·스크립트용) */
export function wealthMixtureOfProfile(profile: ProfileId, pickedRegion: string | null = null, tables: BirthYearTables = birthYearTables()): number[] {
  if (profile === R1_PRESENT) return [...R1_PROFILE.wealthWeights];
  return genMixture(profile, tables, candidateYearsOf(profile, pickedRegion)).wealth;
}


/**
 * 시도 직접 고르기를 받아도 되는가 (RG2): 고르지 않았으면 늘 참. 고른 세대에서 그 시도가 어느 출생 연도에도 없으면(세종 × 산업화~밀레니얼) 거부한다.
 * 「랜덤 세대」에서는 세종을 고를 수 없다(7세대 중 5세대에 세종이 없다) — 나머지 시도는 모든 세대에서 고를 수 있다. 합쳐진 「전남광주」 칩은 모든 해에 광주·전남이 있어 늘 참이다.
 */
export function pickAllowedForChoice(choice: GenerationChoice, regionPick: string | null): boolean {
  if (regionPick === null || regionPick === MERGED_PICK) return true;
  const key = regionKeyOfShort(regionPick);
  if (key === null) return false;
  if (choice === 'random') return GENERATION_IDS_LIST.every((g) => pickableRegions(g).includes(key));
  return pickableRegions(choice).includes(key);
}
