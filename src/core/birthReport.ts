import {
  ERA_REPORT_ADJUST,
  INCOME_CLASS_BLEND,
  INCOME_CLASS_ROW,
  JOB_TILT_BY_ERA,
  JOB_TILT_BY_PARENT,
  JOB_TILT_BY_WEALTH,
  PARENT_AGE_LIMITS,
  THIRD_PLUS_SPLIT,
  WEALTH_ADJECTIVE,
  minMotherAgeForOrder,
} from '../data/birthReportTable';
import { babyLabel, formatKg, orderText } from '../data/birthReportText';
import { getBirthStats, housingRow, nationalHousing, regionHousing, regionOrderShares, regionsOf, sigunguChoices } from '../data/birthStats';
import { standingLabel } from '../data/birthText';
import { placeLabel } from '../data/regionNames';
import type { Rng } from './rng';
import { standingOf, type Standing } from './standing';
import { HOUSINGS, OCCUPATIONS, type BirthReport, type Era, type Gender, type Occupation, type Parent, type ParentWealth } from './types';

/**
 * 출생신고 상세 (SPEC-003 BR2~BR4). 순수 함수 — 시드 RNG만 쓰고 React·Date·Math.random이 없다(CM2). 통계(data/birthStats.ts)에 수저 단계·시대 설계 보정(data/birthReportTable.ts)을 얹는다.
 *
 * ## 추첨 순서(고정)
 * 지역(룰렛) → 시군구 → 출생 월 → 형제 순서 → 어머니 나이 → 아버지 나이 → 어머니 직업 → 아버지 직업 → 사는 집 → 출생 체중.
 * 모두 core/birth.ts#generateBirth가 인생 진행용 RNG에서 **갈라낸**(forkRng) 별도 RNG로 뽑는다 — 인생 진행의 난수 수열(rngState)과 최종 재산 분포표를 건드리지 않는다.
 *
 * ## 통계에서 가져오는 것과 설계 보정
 *  - 출생 월 = 월별 출생아 수 가중(s-018, 남은 결정 R1). 지역 = 시·도 출생아 비율(룰렛, s-016). 시군구 = 시·도 안의 출생아 수 가중(s-017).
 *  - 형제 순서 = 지역의 출산 순위 비중(s-022). 셋째 이상은 넷째·다섯째로 나눈다(설계값 THIRD_PLUS_SPLIT).
 *  - 부모 나이 = **공표 구간 비중을 지키는 확률표**(data/parentAgeModel.ts, R-265): 어머니는 (출산 순위 × 수저 단계) 집단의 분포에서(구간 안 기울기로 첫째 33.2·둘째 34.7·셋째 이상 35.8·전체 33.8에 맞춤),
 *    아버지는 그 어머니의 조건부 분포에서(나이 차 FATHER_GAP 안, 전체는 공표 구간 비중·평균 36.1) 뽑는다. 시대 보정은 두 부모에게 같은 살수를 더한다.
 *    형제 순서가 먼저 정해지므로 어머니 나이는 그 순서가 가능한 나이로 제한된다(위 형제 수 ≤ ⌊(어머니 나이 − 16) / 2⌋, `rollParentAges`의 조건부 재추첨 — R-330 r3, 식구 카드와 같은 상수).
 *  - 부모 직업 = 30·40대 취업자 직업 분포(s-025, 통계에 부모 직업이 없어 쓰는 근사) × 수저 단계·부모(어머니/아버지)·시대 설계 배율.
 *  - 사는 집 = 지역별 점유형태(s-024) × 소득계층 배율(수저 단계에 맞춘 계층). 출생 체중 = 성별 체중 구간별 출생아 수(s-019), 구간 안은 0.1kg 격자 균등.
 *  - 시대 보정(지난·다가올 세상)은 부모 나이(통째로 더하는 살수)·형제 순서·직업 배율뿐이고 모두 설계값이다.
 */

// ---------- 작은 도구 ----------

function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  return items[rng.weightedIndex(weights)];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------- 지역·시군구 ----------

/** 룰렛이 정한 지역(시·도) 이름을 가중으로 뽑는다 */
export function rollRegion(rng: Rng, birthYear: number): string {
  const { regions } = regionsOf(birthYear);
  return pickWeighted(rng, regions, regions.map((r) => r.sharePct)).name;
}

// ---------- 형제 순서·부모 나이 ----------

function rollOrder(rng: Rng, era: Era, regionName: string, birthYear: number): { order: number; bucket: 0 | 1 | 2 } {
  const region = regionsOf(birthYear).regions.find((r) => r.name === regionName);
  if (region === undefined) throw new RangeError(`rollOrder: ${birthYear}년생 룰렛 지역에 ${regionName}이 없다`);
  const shares = ERA_REPORT_ADJUST[era].orderShares ?? regionOrderShares(region);
  const bucket = rng.weightedIndex(shares) as 0 | 1 | 2;
  if (bucket < 2) return { order: bucket + 1, bucket };
  return { order: 3 + rng.weightedIndex(THIRD_PLUS_SPLIT), bucket };
}

/**
 * 부모 나이 한 쌍. 어머니는 (출산 순위 칸 `bucket` × 수저 단계 `wealth`) 집단의 확률표에서, 아버지는 그 어머니 나이의 조건부 확률표에서 뽑는다(난수 2개).
 * 시대 보정(지난 −6살·다가올 +1살)은 두 부모에게 같이 더하고 허용 범위로 맞춘다 — 지금 세상은 0이라 공표 구간 비중·평균이 그대로 나온다.
 *
 * **형제 순서에 맞는 어머니 나이만 만든다** (R-330 r3, BR6·CM9): 위 형제가 N−1명이면 시대 보정을 더하고 맞춘 **최종 어머니 나이**가 `minMotherAgeForOrder(order)`(16 + 2 × 위 형제 수) 이상이다.
 * 첫 추첨이 어긋나면 그 나이들의 가중치를 0으로 두고 **한 번 더** 뽑는다(조건부 재추첨) — 첫 추첨이 맞은 판은 예전 구현과 같고(난수 소비도 같다), 어긋난 판만 「순서가 정해졌다는 조건 아래의
 * 어머니 나이 분포」(= 예전 분포에서 불가능한 칸을 잘라낸 것)에서 다시 뽑힌다. 그래서 **형제 순서 비중(공표 출산 순위 비중)은 그대로**이고(순서를 먼저 뽑는다), 바뀌는 것은 불가능했던
 * 칸(어머니 16~17세의 둘째 이상 …)의 질량뿐이다. `order`를 안 주면 첫째로 본다(제한 없음).
 */
export function rollParentAges(rng: Rng, era: Era, wealth: ParentWealth, bucket: 0 | 1 | 2, order = 1): { mother: number; father: number } {
  const model = getBirthStats().parentAges;
  const shift = ERA_REPORT_ADJUST[era].parentAgeShift;
  const finalAge = (age: number) => clamp(age + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max);
  const need = minMotherAgeForOrder(order);
  const weights = model.motherGiven[bucket][wealth - 1];
  let mother = model.motherMin + rng.weightedIndex(weights);
  if (finalAge(mother) < need) mother = model.motherMin + rng.weightedIndex(weights.map((w, i) => (finalAge(model.motherMin + i) >= need ? w : 0)));
  const father = model.fatherMin + rng.weightedIndex(model.fatherGivenMother[mother - model.motherMin]);
  return { mother: finalAge(mother), father: finalAge(father) };
}

// ---------- 직업 ----------

/** 직업별 가중치(통계 × 설계 배율). 나이가 40 미만이면 30대 열, 아니면 40대 열. 테스트가 이 배열을 직접 대조한다. */
export function jobWeights(who: 'mother' | 'father', age: number, wealth: ParentWealth, era: Era): number[] {
  const occ = getBirthStats().occupation;
  const base = age < 40 ? occ.a30 : occ.a40;
  return OCCUPATIONS.map((job) => base[job] * JOB_TILT_BY_WEALTH[wealth][job] * JOB_TILT_BY_PARENT[who][job] * JOB_TILT_BY_ERA[era][job]);
}

function rollJob(rng: Rng, who: 'mother' | 'father', age: number, wealth: ParentWealth, era: Era): Occupation {
  return pickWeighted(rng, OCCUPATIONS, jobWeights(who, age, wealth, era));
}

// ---------- 사는 집 ----------

/** 사는 집 확률 [자가, 임차, 무상](합 1): 지역 점유형태 × 소득계층 배율(수저 단계에 맞춘 계층의 섞음). 테스트가 직접 대조한다. */
export function housingProbs(regionName: string, birthYear: number, wealth: ParentWealth): [number, number, number] {
  const region = regionsOf(birthYear).regions.find((r) => r.name === regionName);
  if (region === undefined) throw new RangeError(`housingProbs: ${birthYear}년생 룰렛 지역에 ${regionName}이 없다`);
  const base = regionHousing(region);
  const national = nationalHousing();
  const ratio = [0, 0, 0];
  for (const [cls, share] of INCOME_CLASS_BLEND[wealth]) {
    const row = housingRow(INCOME_CLASS_ROW[cls]);
    for (let k = 0; k < 3; k++) ratio[k] += share * (row[k] / national[k]);
  }
  const raw = base.map((b, k) => b * ratio[k]);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / total) as [number, number, number];
}

// ---------- 출생 체중 ----------

/** 체중 격자(0.1kg)에서 이 체중의 위치. 격자 밖(0.1kg 단위가 아닌 값 포함, 예 3.25)이면 -1. */
function weightIndex(gender: Gender, kg: number): number {
  const grid = getBirthStats().weight[gender];
  const key = Math.round(kg * 10);
  if (!Number.isFinite(kg) || Math.abs(kg * 10 - key) > 1e-6) return -1; // 반올림해 가장 가까운 칸으로 받아 주지 않는다
  return grid.values.findIndex((v) => Math.round(v * 10) === key);
}

/**
 * 출생 체중의 순위 표현(R-018 규칙 그대로): 같은 성별 출생아 중 이 체중 이상의 비율과 이하의 비율에서 상위/하위/중간을 정한다.
 * 체중 분포는 0.5kg 구간별 출생아 수를 구간 안 균등으로 쪼갠 0.1kg 격자다(근사, s-019 notes). 격자 밖의 체중이면 throw.
 */
export function weightStanding(kg: number, gender: Gender): Standing {
  const grid = getBirthStats().weight[gender];
  const i = weightIndex(gender, kg);
  if (i < 0) throw new RangeError(`weightStanding: ${kg}kg은 체중 격자 밖이다`);
  let atLeast = 0;
  let atMost = 0;
  grid.probs.forEach((p, k) => {
    if (k >= i) atLeast += p;
    if (k <= i) atMost += p;
  });
  return standingOf(Math.min(100, atLeast * 100), Math.min(100, atMost * 100));
}

function rollWeight(rng: Rng, gender: Gender): number {
  const grid = getBirthStats().weight[gender];
  return grid.values[rng.weightedIndex(grid.probs)];
}

// ---------- 전체 ----------

/**
 * 출생신고 상세를 한 번에 뽑는다. rng는 호출하는 쪽(generateBirth)이 인생 진행용 RNG에서 갈라낸(forkRng) 것이다.
 * 같은 rng 상태·같은 입력 → 같은 결과.
 */
export function rollBirthReport(rng: Rng, era: Era, birthYear: number, gender: Gender, wealth: ParentWealth): BirthReport {
  const region = rollRegion(rng, birthYear);
  const choices = sigunguChoices(birthYear, region);
  const place = pickWeighted(rng, choices, choices.map((c) => c.births));
  const month = rng.weightedIndex(getBirthStats().monthWeights) + 1;
  const { order, bucket } = rollOrder(rng, era, region, birthYear);
  const ages = rollParentAges(rng, era, wealth, bucket, order);
  const motherJob = rollJob(rng, 'mother', ages.mother, wealth, era);
  const fatherJob = rollJob(rng, 'father', ages.father, wealth, era);
  const housing = pickWeighted(rng, HOUSINGS, housingProbs(region, birthYear, wealth));
  return {
    month,
    region,
    sigunguSido: place.sido,
    sigungu: place.name,
    mother: { age: ages.mother, job: motherJob },
    father: { age: ages.father, job: fatherJob },
    housing,
    birthWeightKg: rollWeight(rng, gender),
    birthOrder: order,
  };
}

// ---------- 표시 ----------

/** 서류에 적는 「태어난 곳」(정식 시·도 이름 + 시군구) */
export function reportPlaceLabel(report: BirthReport, era: Era): string {
  return placeLabel({ region: report.region, sigunguSido: report.sigunguSido, sigungu: report.sigungu }, era);
}

/**
 * 한 줄 서술문 (BR3, 합쇼체): 「2026년 1월, 경기도 화성시의 형편이 빠듯한 가정에서 3.3kg 여자아이로 태어났습니다. 첫째입니다. (3.3kg은 상위 약 38%)」.
 * 같은 문장이 인생 기록 0세의 첫 줄이 된다(core/state.ts#enterLife) — 그래서 수저 이름·구간을 쓰지 않는다(C4: 인생 기록에는 등급명을 쓰지 않는다).
 */
export function birthSentence(c: { birthYear: number; gender: Gender; parentWealth: ParentWealth }, report: BirthReport, era: Era): string {
  const kg = formatKg(report.birthWeightKg);
  return `${c.birthYear}년 ${report.month}월, ${reportPlaceLabel(report, era)}의 ${WEALTH_ADJECTIVE[c.parentWealth]} 가정에서 ${kg} ${babyLabel(c.gender)}로 태어났습니다. ${orderText(report.birthOrder)}입니다. (${kg}은 ${standingLabel(weightStanding(report.birthWeightKg, c.gender))})`;
}

/** 아이가 childAge살일 때 부모의 나이 (BR6: 가족 정합 — 부모 나이는 해마다 오른다) */
export function parentAgeAt(parent: Parent, childAge: number): number {
  return parent.age + childAge;
}

// ---------- 저장 검증 ----------

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function validParent(v: unknown, maxAge: number): v is Parent {
  return isObj(v) && isInt(v.age) && v.age >= PARENT_AGE_LIMITS.min && v.age <= maxAge && (OCCUPATIONS as readonly unknown[]).includes(v.job);
}

/**
 * 저장된 출생신고 상세가 맞는 모양인가(저장 검증, CM1): 월·부모 나이·직업·주거·체중·형제 순서가 범위 안이고, 지역이 그 출생 연도의 룰렛 지역 목록에 있으며,
 * 시군구가 그 지역의 후보에 있고, 체중이 격자(0.1kg) 위에 있다. 손상·변조되면 false(→ 새 게임).
 */
export function isValidBirthReport(v: unknown, birthYear: number, gender: Gender): v is BirthReport {
  if (!isObj(v)) return false;
  if (!isInt(v.month) || v.month < 1 || v.month > 12) return false;
  if (typeof v.region !== 'string' || typeof v.sigunguSido !== 'string' || typeof v.sigungu !== 'string') return false;
  if (!validParent(v.mother, PARENT_AGE_LIMITS.max) || !validParent(v.father, PARENT_AGE_LIMITS.max)) return false;
  if (!(HOUSINGS as readonly unknown[]).includes(v.housing)) return false;
  if (!isInt(v.birthOrder) || v.birthOrder < 1 || v.birthOrder > 5) return false;
  if (typeof v.birthWeightKg !== 'number' || !Number.isFinite(v.birthWeightKg)) return false;
  try {
    if (weightIndex(gender, v.birthWeightKg) < 0) return false;
    if (!regionsOf(birthYear).regions.some((r) => r.name === v.region)) return false;
    return sigunguChoices(birthYear, v.region).some((c) => c.sido === v.sigunguSido && c.name === v.sigungu);
  } catch {
    return false;
  }
}
