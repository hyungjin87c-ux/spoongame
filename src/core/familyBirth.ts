import { ERA_REPORT_ADJUST, PARENT_AGE_LIMITS, THIRD_PLUS_SPLIT, reportTiltOf } from '../data/birthReportTable';
import { getBirthStats } from '../data/birthStats';
import { olderSiblingPlan } from './family';
import { deathAgeGiven } from './familyLife';
import {
  FAMILY_MAX_CHILDREN,
  FAMILY_TAG,
  FAMILY_DATA_VERSION,
  LEAVE_AGE,
  MOTHER_BIRTH_MAX,
  YOUNGER_MOTHER_MAX,
  type FamilyData,
  type GrandData,
  type SiblingData,
} from './familyModel';
import { famHash01, famStream } from './familyRng';
import { familyTables } from './gameData';
import { createRng, mixSeed, type Rng } from './rng';
import type { BirthReport, Gender, ParentWealth } from './types';

/**
 * 출생 때 가족 구성 (SPEC-009 FM4a, 설계 문서 4-1·4-3·4-4절): 조부모 4명의 출생 연도와 별세 나이, 부모의 별세 나이, 형제(위·아래), 함께 사는 조부모.
 * 모두 **순수 함수**이고 `famSeed`(peerSeed 파생, familyRng.ts)의 태그별 독립 스트림으로 뽑는다 — 진행 RNG(`rngState`)를 쓰지 않고 한 추첨이 늘거나 줄어도 다른 값이 밀리지 않는다.
 * 부모의 직업·나이·형제 순서·주거는 **이미 정해진 출생신고(`BirthReport`) 값을 입력으로만 받고 바꾸지 않는다**(1-3절).
 * 식구 이름·부모 학력/집안일·집 종류/방 수·고향·반려동물 유무·가진 것은 FM4b/FM4c가 채운다 — 이 파일은 그 자리를 만들지 않는다(11절 「자료가 오기 전 동작」: 값이 없으면 칸도 없다).
 */

export interface FamilyBirthInput {
  birthYear: number;
  gender: Gender;
  report: BirthReport;
  parentWealth: ParentWealth;
  /** 이 판의 형제 순서 분포 [첫째, 둘째, 셋째 이상] (birthReport.ts#orderSharesOf) — 아래 동생의 이어짐 확률을 여기서 유도한다 */
  orderShares: readonly [number, number, number];
  /** 옛 위 형제 계산의 시드 `peerSeed ?? seed` (옛 저장과 같은 값을 만들려고) */
  siblingSeed: number;
}

// ---------- 어머니 출산 연령 분포 (4-1절) ----------

/** 일곱 칸의 나이 범위: 19세 이하(16~19) · 20~24 · 25~29 · 30~34 · 35~39 · 40~44 · 45세 이상(45~49) */
const MOTHER_BINS: ReadonlyArray<readonly [number, number]> = [
  [PARENT_AGE_LIMITS.min, 19],
  [20, 24],
  [25, 29],
  [30, 34],
  [35, 39],
  [40, 44],
  [45, MOTHER_BIRTH_MAX],
];

/**
 * 부모 출생 연도 `by`의 어머니 출산 연령 일곱 칸 비중(%)과 이른 쪽으로 옮기는 살수.
 * 1981~: 인구동향조사(확인) · 1956~1980: 센서스 역산(확인(환산)) · 1955 앞: 1956~60 칸에서 옮긴 추정.
 */
export function motherAgeShares(by: number): { pct: readonly number[]; shift: number } {
  const t = familyTables().motherAge;
  if (by >= t.vitalFrom) return { pct: t.vital[Math.min(by, t.vitalFrom + t.vital.length - 1) - t.vitalFrom], shift: 0 };
  const first = t.census[0];
  if (by < first.from) {
    const rule = t.shift.find((r) => by <= r.to);
    return { pct: first.pct, shift: rule === undefined ? 0 : rule.by };
  }
  const group = t.census.find((c) => by >= c.from && by <= c.to) ?? t.census[t.census.length - 1];
  return { pct: group.pct, shift: 0 };
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** 조모(어머니의 어머니)의 출생 때 나이: 칸 하나를 비중대로, 칸 안은 균등으로 뽑고 이른 쪽 옮김을 뺀 뒤 범위로 자른다 (난수 2번) */
function rollGrandmotherAge(rng: Rng, by: number): number {
  const { pct, shift } = motherAgeShares(by);
  const [lo, hi] = MOTHER_BINS[rng.weightedIndex(pct)];
  return clamp(rng.int(lo, hi) - shift, PARENT_AGE_LIMITS.min, MOTHER_BIRTH_MAX);
}

/** 조부(아버지의 아버지)의 출생 때 나이: 같은 쪽 조모의 나이에 대한 아버지 나이 조건부 분포(전국 모형)에서 뽑는다 (난수 1번) */
function rollGrandfatherAge(rng: Rng, grandmotherAge: number): number {
  const model = getBirthStats().parentAges;
  const row = model.fatherGivenMother[clamp(grandmotherAge - model.motherMin, 0, model.fatherGivenMother.length - 1)];
  return clamp(model.fatherMin + rng.weightedIndex(row), PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max);
}

// ---------- 조부모·부모의 출생 연도와 별세 나이 (4-1·4-4절) ----------

/** 부모의 출생 연도 */
export const parentBirthYear = (birthYear: number, parentAgeAtBirth: number): number => birthYear - parentAgeAtBirth;

/**
 * 조부모 4명 `[친할아버지, 친할머니, 외할아버지, 외할머니]`: 부모가 태어날 때의 나이(`a`)와 별세 나이(`d`).
 * 나이는 GRAND_AGE 스트림(친조모 → 친조부 → 외조모 → 외조부 순), 별세는 GRAND_LIFE 스트림(네 명 순서대로 `u` 하나씩)이다.
 */
export function rollGrandparents(famSeed: number, birthYear: number, motherAge: number, fatherAge: number): [GrandData, GrandData, GrandData, GrandData] {
  const byFather = parentBirthYear(birthYear, fatherAge);
  const byMother = parentBirthYear(birthYear, motherAge);
  const ageRng = famStream(famSeed, FAMILY_TAG.GRAND_AGE);
  const pgm = rollGrandmotherAge(ageRng, byFather);
  const pgf = rollGrandfatherAge(ageRng, pgm);
  const mgm = rollGrandmotherAge(ageRng, byMother);
  const mgf = rollGrandfatherAge(ageRng, mgm);
  const lifeRng = famStream(famSeed, FAMILY_TAG.GRAND_LIFE);
  const make = (sex: Gender, parentBy: number, a: number): GrandData => ({ a, d: deathAgeGiven(sex, parentBy - a, a, lifeRng.next()) });
  // 순서 고정: pgf, pgm, mgf, mgm
  return [make('male', byFather, pgf), make('female', byFather, pgm), make('male', byMother, mgf), make('female', byMother, mgm)];
}

/** 조부모 출생 연도 `[pgf, pgm, mgf, mgm]` */
export function grandBirthYears(birthYear: number, motherAge: number, fatherAge: number, g: readonly GrandData[]): [number, number, number, number] {
  const byFather = parentBirthYear(birthYear, fatherAge);
  const byMother = parentBirthYear(birthYear, motherAge);
  return [byFather - g[0].a, byFather - g[1].a, byMother - g[2].a, byMother - g[3].a];
}

/** 부모 별세 나이 `[어머니, 아버지]` (PARENT_LIFE 스트림, 어머니 → 아버지 순서로 `u` 하나씩) — 출생 때 부모 나이에 살아 있던 사람의 별세 나이 */
export function rollParentLife(famSeed: number, birthYear: number, motherAge: number, fatherAge: number): [number, number] {
  const rng = famStream(famSeed, FAMILY_TAG.PARENT_LIFE);
  const dm = deathAgeGiven('female', parentBirthYear(birthYear, motherAge), motherAge, rng.next());
  const df = deathAgeGiven('male', parentBirthYear(birthYear, fatherAge), fatherAge, rng.next());
  return [dm, df];
}

/** 주인공 나이로 본 별세 시점 `goneAt` = (그 사람 출생 연도 + 별세 나이) − 주인공 출생 연도. 주인공 나이 `age > goneAt`이면 떠난 것으로 보인다 (1-1절) */
export const goneAtMyAge = (personBirthYear: number, d: number, birthYear: number): number => personBirthYear + d - birthYear;

// ---------- 함께 사는 조부모 (4-4절 (2)) ----------

/** 「조부모와 사는 아동」 비율(0~1): 기준 연도 `R`의 점들을 선형 보간한다. 1970 앞은 1970 값, 2025 뒤는 2025 값 */
export function cohabitShare(refYear: number): number {
  const pts = familyTables().household.points;
  if (refYear <= pts[0][0]) return pts[0][1] / 100;
  const last = pts[pts.length - 1];
  if (refYear >= last[0]) return last[1] / 100;
  const i = pts.findIndex((p) => p[0] > refYear);
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  return (y0 + ((y1 - y0) * (refYear - x0)) / (x1 - x0)) / 100;
}

/** 주인공이 6세일 때(아동 중기 기준 단면) 조부모 중 한 명이라도 살아 있을 확률 `A6(Y)`을 모의로 어림하는 표본 수 */
const A6_SAMPLES = 800;
const a6Cache = new Map<number, number>();

/**
 * 출생 연도 `Y`의 판에서 주인공이 6세일 때 조부모 한 명이라도 살아 있을 확률 — 동거 여부를 뽑을 때 `pGp(R) / A6(Y)`로 나눠 **6세 단면의 동거 비율이 `pGp(R)`와 맞게** 한다.
 * 부모 나이는 그 연도의 출생신고 모형(전국 분포 + 시대 보정)에서, 조부모는 `rollGrandparents`와 같은 함수로 고정 시드 표본을 뽑아 센다(난수는 `Y`와 표본 번호에서만 온다).
 */
export function aliveAtSixRate(birthYear: number): number {
  const hit = a6Cache.get(birthYear);
  if (hit !== undefined) return hit;
  const model = getBirthStats().parentAges;
  const shift = ERA_REPORT_ADJUST[reportTiltOf(birthYear)].parentAgeShift;
  let alive = 0;
  for (let n = 0; n < A6_SAMPLES; n++) {
    const seed = mixSeed(mixSeed(0xa6a6a6a6, birthYear), n);
    const rng = createRng(seed);
    const mother = clamp(model.motherMin + rng.weightedIndex(model.motherMarginal) + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max);
    const fatherRow = model.fatherGivenMother[clamp(mother - model.motherMin, 0, model.fatherGivenMother.length - 1)];
    const father = clamp(model.fatherMin + rng.weightedIndex(fatherRow) + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max);
    const g = rollGrandparents(mixSeed(seed, 1), birthYear, mother, father);
    const by = grandBirthYears(birthYear, mother, father, g);
    if (g.some((gp, i) => goneAtMyAge(by[i], gp.d, birthYear) >= 6)) alive++;
  }
  const rate = alive / A6_SAMPLES;
  a6Cache.set(birthYear, rate);
  return rate;
}

/** 시험 전용: 어림해 둔 `A6`을 비운다 */
export function resetFamilyBirthCaches(): void {
  a6Cache.clear();
}

/** 쪽(1 친가 · 2 외가)의 조부모 인덱스 */
const SIDE_INDEXES: Readonly<Record<1 | 2, readonly [number, number]>> = { 1: [0, 1], 2: [2, 3] };
/** 친가를 고를 확률 (설계값 — 자료가 있으면 교체, 4-4절) */
export const PATERNAL_SIDE_SHARE = 0.7;

/**
 * 함께 사는 조부모 쪽 `c`: 0 없음 · 1 친가 · 2 외가. GRAND_SIDE 스트림의 두 값(동거 여부 `uE`, 쪽 선택 `uS`)으로 정한다.
 *  ① 동거 여부: `uE < pGp(R) / A6(Y)`, `R = min(2025, Y + 6)`
 *  ② 쪽: 6세에 살아 있는 조부모가 있는 쪽만 후보(6세 단면을 `pGp`에 맞추려는 설계 — 설계 문서의 「출생 때 살아 있는 사람이 없으면 다른 쪽」을 6세 기준으로 한 단계 더 좁힌 것). 없으면 출생 때 살아 있던 조부모가 있는 쪽, 그것도 없으면 0.
 *     두 쪽이 후보면 `uS < 0.7`이 친가.
 */
export function rollCohabit(famSeed: number, birthYear: number, byGrand: readonly [number, number, number, number], g: readonly GrandData[]): 0 | 1 | 2 {
  const rng = famStream(famSeed, FAMILY_TAG.GRAND_SIDE);
  const uE = rng.next();
  const uS = rng.next();
  const goneAt = g.map((gp, i) => goneAtMyAge(byGrand[i], gp.d, birthYear));
  const aliveAt = (side: 1 | 2, age: number): boolean => SIDE_INDEXES[side].some((i) => goneAt[i] >= age);
  const anyAt6 = aliveAt(1, 6) || aliveAt(2, 6);
  const anyAtBirth = aliveAt(1, 0) || aliveAt(2, 0);
  if (!anyAtBirth) return 0;
  const a6 = aliveAtSixRate(birthYear);
  const p = a6 > 0 ? Math.min(1, cohabitShare(Math.min(2025, birthYear + 6)) / a6) : 0;
  if (!(uE < p)) return 0;
  const age = anyAt6 ? 6 : 0;
  const cand = ([1, 2] as const).filter((side) => aliveAt(side, age));
  if (cand.length === 1) return cand[0];
  return uS < PATERNAL_SIDE_SHARE ? 1 : 2;
}

// ---------- 형제 (4-3절) ----------

/** 독립 나이: 형제 번호(위 i → i, 아래 j → 10 + j)마다 20~30 균등 (설계값) */
export function leaveAgeOf(famSeed: number, num: number): number {
  return LEAVE_AGE.min + Math.floor(famHash01(famSeed, FAMILY_TAG.SIBLINGS, num, 1) * (LEAVE_AGE.max - LEAVE_AGE.min + 1));
}

/** 위 형제: 옛 계산(`olderSiblingPlan`)과 같은 값을 `family.o`에 옮겨 담는다 (옛 저장 호환과 같은 코드 경로, 1-3절) */
export function rollOlderSiblings(famSeed: number, siblingSeed: number, report: Pick<BirthReport, 'birthOrder' | 'mother'>): SiblingData[] {
  return olderSiblingPlan(siblingSeed, report).map((o, i) => ({ g: o.gender === 'male' ? 0 : 1, k: o.gap, s: leaveAgeOf(famSeed, i) }));
}

/**
 * 어머니의 최종 자녀 수를 이어짐 확률 `a_k`(전체 자녀가 k명 이상일 때 k+1명 이상일 확률)로 굴린다.
 *  a_1 = s[1]/s[0], a_2 = s[2]/s[1] (이 판의 출산 순위 비중, [0, 0.9]로 자름) · a_3 = (19+7)/74 · a_4 이상 = 7/19 (THIRD_PLUS_SPLIT) — 설계값(공표 출산 순위 비중에서 유도한 근사).
 */
export function continueProbability(k: number, shares: readonly [number, number, number]): number {
  if (k <= 0) return 0;
  if (k === 1) return shares[0] > 0 ? clamp(shares[1] / shares[0], 0, 0.9) : 0;
  if (k === 2) return shares[1] > 0 ? clamp(shares[2] / shares[1], 0, 0.9) : 0;
  const [third, fourth, fifth] = THIRD_PLUS_SPLIT;
  return k === 3 ? (fourth + fifth) / third : fifth / fourth;
}

/**
 * 아래 동생: 동생 한 명씩 차례로 이어짐을 굴린다(`j = 1, 2, …`). 굴림·터울·성별은 `j`마다 해시로 미리 뽑아 두어(스트림 위치에 기대지 않는다) 멈춰도 다른 값이 밀리지 않는다.
 * 터울 2~5(설계값), 성별 균등(설계값), 어머니의 그 출산 나이가 `YOUNGER_MOTHER_MAX`(45)를 넘으면 거기서 멈추고, 전체 자녀 수는 8명 이하다.
 */
export function rollYoungerSiblings(famSeed: number, birthOrder: number, motherAge: number, shares: readonly [number, number, number]): SiblingData[] {
  const out: SiblingData[] = [];
  let k = 0;
  for (let j = 1; birthOrder + j <= FAMILY_MAX_CHILDREN; j++) {
    k += 2 + Math.floor(famHash01(famSeed, FAMILY_TAG.SIBLINGS, 100 + j, 1) * 4);
    if (motherAge + k > YOUNGER_MOTHER_MAX) break;
    if (!(famHash01(famSeed, FAMILY_TAG.SIBLINGS, 100 + j, 0) < continueProbability(birthOrder + j - 1, shares))) break;
    out.push({ g: famHash01(famSeed, FAMILY_TAG.SIBLINGS, 10 + j, 2) < 0.5 ? 0 : 1, k, s: leaveAgeOf(famSeed, 10 + j) });
  }
  return out;
}

// ---------- 전체 ----------

/** 조부모·부모·함께 사는 쪽까지 — 형제 빼고 (옛 저장의 `legacyFamilyFrom`도 이 위에 형제만 얹는다) */
export function rollFamilyCore(famSeed: number, input: Pick<FamilyBirthInput, 'birthYear' | 'report'>): Pick<FamilyData, 'p' | 'g' | 'c'> {
  const { birthYear, report } = input;
  const g = rollGrandparents(famSeed, birthYear, report.mother.age, report.father.age);
  const [dm, df] = rollParentLife(famSeed, birthYear, report.mother.age, report.father.age);
  const c = rollCohabit(famSeed, birthYear, grandBirthYears(birthYear, report.mother.age, report.father.age, g), g);
  return { p: [{ d: dm }, { d: df }], g, c };
}

/** 출생 때 가족 구성을 한 번에 뽑는다. 같은 `famSeed`·같은 입력 → 같은 `FamilyData`. 로그(`l`)는 비어 있다 */
export function rollFamilyBirth(famSeed: number, input: FamilyBirthInput): FamilyData {
  const core = rollFamilyCore(famSeed, input);
  return {
    v: FAMILY_DATA_VERSION,
    ...core,
    o: rollOlderSiblings(famSeed, input.siblingSeed, input.report),
    y: rollYoungerSiblings(famSeed, input.report.birthOrder, input.report.mother.age, input.orderShares),
    l: [],
  };
}
