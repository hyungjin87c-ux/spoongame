import { ERA_CONFIG } from '../data/birthTable';
import { isForbiddenFullName } from '../data/forbiddenNames';
import { NAMES, PRESENT_POOL_YEAR, futurePool, officialPool, pastPool } from '../data/names';
import { rollBirthReport } from './birthReport';
import { createRng, forkRng, mixSeed, type Rng } from './rng';
import { standingOf, type Standing } from './standing';
import {
  ERAS,
  GENDERS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  type BirthReport,
  type Character,
  type Era,
  type Gender,
  type ParentWealth,
  type ParentingStyle,
  type Stats,
} from './types';

/** 순수 출생 로직. React와 무관하고 시드 RNG만 쓴다. 같은 RNG 상태 + 같은 시대 → 같은 결과. */

// ---------- 이름 ----------

/** 출생 연도가 속한 시대(ERA_CONFIG.birthYears 기준). 어느 시대에도 속하지 않으면 null. */
export function eraOfBirthYear(birthYear: number): Era | null {
  for (const era of ERAS) {
    const { min, max } = ERA_CONFIG[era].birthYears;
    if (birthYear >= min && birthYear <= max) return era;
  }
  return null;
}

/**
 * 이름 풀의 종류와 키. 시대마다 풀이 다르다(R-012).
 *  - past: 1950~1989년생 → 연대(decade) 풀. 언론 인용 확인분 + 추정 보충(통계 아님).
 *  - present: 올해(2026)년생 고정 → 가장 최근 연도(2025) 하나의 법원 통계서비스 상위 20위(공식 통계). `year`는 풀의 기준 연도다(출생 연도가 아니다 — 2026년은 진행 중이라 통계가 없다).
 *  - future: 2030~2060년생 → 통계가 없어 최근 5개 연도(2021~2025) 공식 풀의 합집합.
 */
export type NamePoolId = { kind: 'past'; decade: number } | { kind: 'present'; year: number } | { kind: 'future' };

/**
 * 출생 연도 → 이름 풀. 풀이 없는 연도(1949 이하, 1990~2007, 2026~2029, 2061 이상 등)와
 * 정수가 아닌 연도는 **throw**한다. 다른 풀로 조용히 돌려보내면 "있지도 않은 통계"가 되므로,
 * 데이터·시대 설정이 어긋났을 때 깨져서 드러나는 편이 낫다. 게임은 시대 설정(ERA_CONFIG.birthYears)의
 * 연도만 넘기므로 정상 경로에서는 발생하지 않는다.
 */
export function namePoolIdOf(birthYear: number): NamePoolId {
  if (!Number.isInteger(birthYear)) throw new RangeError(`namePoolIdOf: 정수 연도가 아니다 (${birthYear})`);
  const era = eraOfBirthYear(birthYear);
  if (era === null) throw new RangeError(`namePoolIdOf: ${birthYear}년생은 어느 시대에도 속하지 않아 이름 풀이 없다`);
  if (era === 'past') {
    const decade = Math.floor(birthYear / 10) * 10;
    if (pastPool(decade, 'male') === null) throw new RangeError(`namePoolIdOf: ${decade}년대 이름 풀이 없다`);
    return { kind: 'past', decade };
  }
  if (era === 'present') {
    if (officialPool(PRESENT_POOL_YEAR, 'male') === null) throw new RangeError(`namePoolIdOf: ${PRESENT_POOL_YEAR}년 공식 통계 풀이 없다`);
    return { kind: 'present', year: PRESENT_POOL_YEAR };
  }
  return { kind: 'future' };
}

/** 출생 연도·성별에 맞는 이름(성 제외) 풀. 읽기 전용. */
export function namePoolFor(birthYear: number, gender: Gender): readonly string[] {
  const id = namePoolIdOf(birthYear);
  const pool = id.kind === 'past' ? pastPool(id.decade, gender) : id.kind === 'present' ? officialPool(id.year, gender) : futurePool(gender);
  if (pool === null || pool.length === 0) throw new RangeError(`namePoolFor: ${birthYear}년 ${gender} 이름 풀이 비어 있다`);
  return pool;
}

/** 성씨별 가중치: 인구수에 비례 */
export function surnameWeights(): { name: string; weight: number }[] {
  return NAMES.surnames.items.map((s) => ({ name: s.name, weight: s.populationThousands }));
}

/** 이름이 걸렸을 때 같은 풀에서 이름을 다시 뽑는 최대 횟수. 넘으면 풀에서 안 걸리는 첫 이름으로 대체한다. */
export const MAX_NAME_REDRAWS = 8;

/**
 * 이 성+이름 조합을 쓰면 안 되는가 (내부 필터, 플레이어에게 보이지 않는다). 두 가지가 같은 필터로 걸린다.
 *  1) 금지 목록(민감한 실존 인물, R-023·R-028) — 성+이름 전체가 같을 때
 *  2) 성과 이름의 첫 글자가 같은 조합(이이준·윤윤서·정정우 등, R-027) — 어색해 보이는 조합이라 다시 뽑는다
 */
export function isRejectedName(surname: string, given: string): boolean {
  return isForbiddenFullName(surname + given) || (given.length > 0 && given[0] === surname);
}

/**
 * 성+이름을 뽑는다. 성씨는 인구수 가중 랜덤, 이름은 출생 연도·성별 풀에서 균등 랜덤.
 * isRejectedName에 걸리면 **이름만** 같은 풀에서 다시 뽑는다(성씨 분포는 건드리지 않는다).
 * 다시 뽑기는 같은 RNG에서 이어 뽑으므로 결정적이고, MAX_NAME_REDRAWS번 뒤에도 걸리면
 * 풀에서 걸리지 않는 첫 이름을 쓴다(무한 루프 없음).
 */
export function pickFullName(rng: Rng, birthYear: number, gender: Gender): string {
  const pool = namePoolFor(birthYear, gender);
  const surnames = surnameWeights();
  const surname = surnames[rng.weightedIndex(surnames.map((s) => s.weight))].name;
  let given = rng.pick(pool);
  for (let tries = 0; tries < MAX_NAME_REDRAWS && isRejectedName(surname, given); tries++) {
    given = rng.pick(pool);
  }
  if (isRejectedName(surname, given)) {
    const safe = pool.find((g) => !isRejectedName(surname, g));
    if (safe === undefined) throw new Error(`pickFullName: ${surname} 성에 쓸 수 있는 이름이 풀에 없다`);
    given = safe;
  }
  return surname + given;
}

// ---------- 외모 분포 ----------

function computeLooksPmf(): number[] {
  const single = Array.from({ length: 101 }, () => 1);
  const conv = (a: number[], b: number[]) => {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
    return out;
  };
  const sums = conv(conv(single, single), single); // 길이 301
  const total = 101 ** 3;
  const pmf = new Array<number>(101).fill(0);
  sums.forEach((count, s) => {
    pmf[Math.floor(s / 3)] += count / total;
  });
  return pmf;
}

let looksPmfCache: readonly number[] | null = null;
let looksTailCache: readonly number[] | null = null;

/**
 * 외모 = floor((U1+U2+U3)/3), Ui는 0~100 정수 균등. 종 모양에 가까운 0~100 분포.
 * 입력이 없는 순수 상수이므로 한 번만 계산해 같은 (읽기 전용) 배열을 돌려준다(R-017).
 */
export function looksPmf(): readonly number[] {
  if (!looksPmfCache) looksPmfCache = Object.freeze(computeLooksPmf());
  return looksPmfCache;
}

/** tail[i] = 외모가 i점 이상일 확률. 길이 102 (tail[101] = 0). */
function looksTail(): readonly number[] {
  if (!looksTailCache) {
    const pmf = looksPmf();
    const tail = new Array<number>(pmf.length + 1).fill(0);
    for (let i = pmf.length - 1; i >= 0; i--) tail[i] = tail[i + 1] + pmf[i];
    looksTailCache = Object.freeze(tail);
  }
  return looksTailCache;
}

export function rollLooks(rng: Rng): number {
  return Math.floor((rng.int(0, 100) + rng.int(0, 100) + rng.int(0, 100)) / 3);
}

/** 이 점수 이상일 확률(%) — 보정 전. */
function looksAtLeastShare(looks: number): number {
  const tail = looksTail();
  const i = Math.min(tail.length - 1, Math.max(0, Math.ceil(looks)));
  return Math.min(100, Math.max(0, tail[i] * 100)); // 부동소수 누적 오차로 100을 넘거나 0 미만이 되지 않게
}

/** 이 점수 이하일 확률(%) — 보정 전. P(점수 <= k) = 1 - P(점수 >= k+1). */
function looksAtMostShare(looks: number): number {
  const tail = looksTail();
  const i = Math.min(tail.length - 1, Math.max(0, Math.floor(looks) + 1));
  return Math.min(100, Math.max(0, (1 - tail[i]) * 100));
}

/**
 * 이 점수 이상일 확률(%)을 1~100 정수로 보정한 값. 화면에는 이 값을 직접 쓰지 않고
 * looksStanding(상위/하위/중간 규칙)의 결과만 쓴다(R-018: 50%가 넘는 값은 표시하지 않는다).
 */
export function looksTopPercent(looks: number): number {
  return Math.min(100, Math.max(1, Math.round(looksAtLeastShare(looks))));
}

// ---------- 순위 표현 (상위/하위/중간) ----------
// Standing·standingOf는 core/standing.ts로 옮겼다(출생 체중도 같은 규칙을 쓴다). 여기서 다시 내보내 기존 import 경로가 그대로 동작한다.
export { standingOf, type Standing } from './standing';

/**
 * 가중치 표에서 이 재력 단계 이상의 비율(%). 가중치 합으로 나눠 정규화하므로 합이 100이 아니어도
 * 항상 0~100이다(R-031: 표가 어긋났다고 standingOf가 throw하지 않는다). 합이 0 이하면 throw.
 */
export function cumulativeTopPercent(weights: readonly number[], wealth: ParentWealth): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new RangeError('cumulativeTopPercent: 가중치 합이 0 이하다');
  let sum = 0;
  for (let i = wealth - 1; i < weights.length; i++) sum += weights[i];
  return Math.min(100, Math.max(0, (sum * 100) / total));
}

/** 가중치 표에서 이 재력 단계 이하의 비율(%) (정규화, 위와 같은 규칙) */
export function cumulativeBottomPercent(weights: readonly number[], wealth: ParentWealth): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new RangeError('cumulativeBottomPercent: 가중치 합이 0 이하다');
  let sum = 0;
  for (let i = 0; i < wealth && i < weights.length; i++) sum += weights[i];
  return Math.min(100, Math.max(0, (sum * 100) / total));
}

/** 해당 시대 출생아 중 이 재력 단계 이상의 비율(%) */
export function wealthTopPercent(era: Era, wealth: ParentWealth): number {
  return cumulativeTopPercent(ERA_CONFIG[era].wealthWeights, wealth);
}

/** 해당 시대 출생아 중 이 재력 단계 이하의 비율(%) */
export function wealthBottomPercent(era: Era, wealth: ParentWealth): number {
  return cumulativeBottomPercent(ERA_CONFIG[era].wealthWeights, wealth);
}

/** 재력 단계의 표현. 가중치 표의 누적합에서 계산한다. */
export function wealthStanding(era: Era, wealth: ParentWealth): Standing {
  return standingOf(wealthTopPercent(era, wealth), wealthBottomPercent(era, wealth));
}

/** 외모 점수의 표현. 외모 분포(looksPmf)의 꼬리 확률에서 계산한다. 재력과 같은 규칙. */
export function looksStanding(looks: number): Standing {
  return standingOf(looksAtLeastShare(looks), looksAtMostShare(looks));
}

// ---------- 출생 스탯 ----------

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * 출생 시 재산·학력의 의미 (R-025):
 *  - 재산(wealth)은 어릴 때는 "집안 형편"이다. 스무 살(독립)에 "내가 가진 것"으로 바뀐다(core/life.ts#independenceWealth).
 *  - 학력(education)은 "지금까지 쌓은 학업 성취"다. 0세에 높게 시작하는 건 이상하므로 출생 값은 0~15의 낮은 값이고,
 *    가정의 교육 여건(부모 재력·교육방식)은 출생 값이 아니라 **성장 속도**(core/life.ts#educationGrowthPerYear)와
 *    이벤트 확률/효과로 반영된다. birthStats(엔딩의 "출발선 대비")도 같은 뜻의 값을 쓴다:
 *    학력의 출발선은 거의 같고, 얼마나 올라왔는지가 비교 대상이다.
 */
const BASE_WEALTH = [8, 22, 45, 70, 92] as const;
const BASE_EDUCATION = [2, 4, 6, 8, 10] as const;
const HAPPY_BY_WEALTH = [-6, -2, 0, 3, 5] as const;
const EDU_MOD: Record<ParentingStyle, number> = { neglect: -2, free: 0, helicopter: 3, strict: 2 };
const HAPPY_MOD: Record<ParentingStyle, number> = { neglect: -8, free: 8, helicopter: -2, strict: -5 };
const REL_MOD: Record<ParentingStyle, number> = { neglect: -10, free: 4, helicopter: 6, strict: -2 };

/** 건강은 0에서 시작하지 않는다(R-008). 출생 시 최소값. */
export const MIN_BIRTH_HEALTH = 30;

export function rollBirthStats(rng: Rng, wealth: ParentWealth, parenting: ParentingStyle): Stats {
  const i = wealth - 1;
  return {
    wealth: clamp(BASE_WEALTH[i] + rng.int(-5, 5), 0, 100),
    education: clamp(BASE_EDUCATION[i] + EDU_MOD[parenting] + rng.int(-2, 2), 0, 100),
    health: clamp(70 + (wealth >= 4 ? 3 : 0) + rng.int(-10, 10), MIN_BIRTH_HEALTH, 100),
    happiness: clamp(50 + HAPPY_BY_WEALTH[i] + HAPPY_MOD[parenting] + rng.int(-5, 5), 0, 100),
    relationships: clamp(50 + REL_MOD[parenting] + rng.int(-5, 5), 0, 100),
  };
}

// ---------- 전체 출생 ----------

export interface BirthResult {
  character: Character;
  stats: Stats;
  /** 출생신고 상세(출생 월·지역·시군구·부모·주거·체중·형제 순서) — 룰렛(RL2)과 출생신고(BR)가 이 값을 그대로 보인다 */
  report: BirthReport;
  /** 같은 해 태어난 사람들(VP3)을 만드는 시드 */
  peerSeed: number;
}

/** 갈래 RNG의 salt: 출생신고 상세 / 같은 해 태어난 사람들. 값은 바꾸지 않는다(같은 시드 → 같은 인물이 새 판에서도 이어지도록 — 바꾸면 알려진 시드의 출생신고가 달라진다). */
const REPORT_SALT = 0x52505254; // 'RPRT'
const PEER_SALT = 0x50454552; // 'PEER'

/**
 * 난수 소비 순서(고정): 연도 → 성별 → 성씨 → 이름 → 재력 → 교육방식 → 외모 → 스탯.
 * 출생신고 상세(report)와 또래 시드(peerSeed)는 이 RNG를 **전진시키지 않고** 현재 상태에서 갈라낸 별도 수열로 만든다(forkRng·mixSeed) —
 * 그래서 인생 진행의 난수 수열(rngState)과 엔딩 분포표(finalDistribution)는 출생신고가 생기기 전과 같다(R-022 「정확히 한 번 뽑는다」도 그대로).
 */
export function generateBirth(rng: Rng, era: Era): BirthResult {
  const cfg = ERA_CONFIG[era];
  const birthYear = rng.int(cfg.birthYears.min, cfg.birthYears.max);
  const gender = GENDERS[rng.int(0, GENDERS.length - 1)];
  const name = pickFullName(rng, birthYear, gender);
  const parentWealth = PARENT_WEALTHS[rng.weightedIndex(cfg.wealthWeights)];
  const parenting = PARENTING_STYLES[rng.weightedIndex(PARENTING_STYLES.map((p) => cfg.parentingWeights[p]))];
  const looks = rollLooks(rng);
  const stats = rollBirthStats(rng, parentWealth, parenting);
  const report = rollBirthReport(forkRng(rng, REPORT_SALT), era, birthYear, gender, parentWealth);
  return { character: { name, gender, birthYear, parentWealth, parenting, looks }, stats, report, peerSeed: mixSeed(rng.getState(), PEER_SALT) };
}

/** 시드에서 바로 출생 결과를 만든다(테스트·시뮬레이션용). */
export function generateBirthFromSeed(seed: number, era: Era): BirthResult & { rngState: number } {
  const rng = createRng(seed);
  const result = generateBirth(rng, era);
  return { ...result, rngState: rng.getState() };
}
