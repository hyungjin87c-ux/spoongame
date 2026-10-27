import {
  CURVE_FIRST_AGE,
  CURVE_LAST_AGE,
  ECONOMY,
  LABOR_INCOME_CURVE_THOUSAND,
  LIMITS,
  type EconomyFactors,
} from '../data/economyTable';
import { type Assets, type AssetDeltas, type Dwelling, type ParentWealth } from './types';

/**
 * 경제 모델 (SPEC-003 M5 EC1·EC2, docs/data/economy-model.md 3·4절). **순수 함수**: React·타이머·Date·Math.random을 쓰지 않고 난수를 쓰지 않는다(RNG 스트림 보존).
 * 모든 금액은 만 원 정수(지금 가치 환산). 계수는 data/economyTable.ts 한 곳.
 *
 * 한 해(나이 a를 산 해, 20세 이상): 일 상태·소득 → 생활비·주거비·의료 → 이자 → 순자산 += 현금흐름 → 상환 → 자동 대출(`debt ≥ max(0, −net)`).
 * 선택지의 자산 효과(`assets.net`·`income`·`debt`)와 그 선택이 켜는 플래그가 바꾸는 주거 형태(`dwellingAfterFlags`)는 `applyAssetEffects`가 한 번에 적용한다.
 */

/**
 * 연도 축 경제 계수의 입력 (SPEC-004 EY4 — `economyFactors({ year, birthYear, tier, regionClass })`). `year`는 달력 연도(= 출생 연도 + 나이).
 * **GM4 단계의 사실**: `economyByYear`의 열이 아직 하나도 확보·배선되지 않았으므로(EY2 「점진 활성」) 모든 규칙이 항등이다 — 어느 연도·수저·지역이든 R1 「지금 세상」 계수(소득·생활·주거 모두 1)다.
 * 연도별 수준 `L(y)`·모양·`SHIELD`·`SPOON_SPREAD`·`REGION_WEIGHT`는 GM10이 이 함수 안에서 켠다(입력 모양은 그대로).
 * `forceR1`은 시험·스크립트 전용 스위치다(EY17 ② 항등 시험): 켜면 연도 규칙이 있든 없든 R1 값을 돌려준다 — 지금은 켜든 끄든 같지만, GM10이 규칙을 켠 뒤에도 R1 스냅숏(`tests/fixtures/r1-economy-snapshot.json`)과 줄 단위로 같음을 이 스위치로 잰다.
 * 시대 3종 계수(`ERA_ECONOMY` — 지난 0.6·0.7·0.6 / 다가올 1.15·1.2·1.3)는 없어졌다: 연도별 수준 `L(y)`·모양·충격으로 GM10이 대체하고, 그 전에는 항등이다.
 */
export interface EconomyFactorsInput {
  /** 달력 연도 = 출생 연도 + 나이 */
  year: number;
  birthYear: number;
  tier: ParentWealth;
  regionClass: RegionClass;
  forceR1?: boolean;
}

/** 지역군 (RG9 — 수도권 / 광역시·특별자치시 / 그 밖). GM10의 `region.income`·`region.housing`이 쓴다. 지금은 계수에 닿지 않는다. */
export type RegionClass = 'capital' | 'metro' | 'other';

const R1_FACTORS: EconomyFactors = Object.freeze({ income: 1, living: 1, housing: 1 });

export function economyFactors(input: EconomyFactorsInput): EconomyFactors {
  void input; // GM4: 모든 규칙이 항등이라 입력이 계수를 바꾸지 않는다 (forceR1이든 아니든 같은 값)
  return R1_FACTORS;
}

/** 출생 시도(줄임 이름) → 지역군 (RG9): 서울·경기·인천 = capital, 광역시·세종 = metro, 그 밖 = other. 모르는 이름은 other */
export function regionClassOf(region: string | null | undefined): RegionClass {
  if (region === '서울' || region === '경기' || region === '인천') return 'capital';
  if (region === '부산' || region === '대구' || region === '광주' || region === '대전' || region === '울산' || region === '세종' || region === '전남광주') return 'metro';
  return 'other';
}

/** 경제 계산 상태가 가리키는 계수 (EconomyContext → economyFactors) */
function factorsOf(ctx: EconomyContext): EconomyFactors {
  return economyFactors({ year: ctx.year, birthYear: ctx.birthYear, tier: ctx.tier, regionClass: ctx.regionClass, forceR1: ctx.forceR1 });
}

/** 일 상태: 플래그(has_career·own_business·college·exam_prep)와 나이에서 정한다 */
export type WorkState = 'student' | 'exam' | 'working' | 'business' | 'casual';

/** 경제 계산이 읽는 상태 한 벌 (나이·지식 스탯·플래그·부모 재력 단계·연도 축 입력) */
export interface EconomyContext {
  age: number;
  education: number;
  flags: ReadonlySet<string>;
  tier: ParentWealth;
  /** 달력 연도 = 출생 연도 + 나이 (EY4). 아직 계수가 연도를 보지 않는다(GM4) */
  year: number;
  birthYear: number;
  regionClass: RegionClass;
  /** R1 항등 스위치 (EY17 ②, 시험·스크립트 전용) */
  forceR1?: boolean;
}

const clampInt = (v: number, lo: number, hi: number): number => {
  if (!Number.isFinite(v)) throw new RangeError(`economy: 유한한 수가 아니다 (${v})`);
  return Math.min(hi, Math.max(lo, Math.round(v)));
};

/** 나이별 1인당 노동소득(만 원, 소수) — s-053 곡선. 20세 미만은 20세 값, 85세 이상은 한 칸 */
export function laborCurve(age: number): number {
  const a = Math.min(CURVE_LAST_AGE, Math.max(CURVE_FIRST_AGE, Math.floor(age)));
  return LABOR_INCOME_CURVE_THOUSAND[a - CURVE_FIRST_AGE] / 10;
}

export function workStateOf(flags: ReadonlySet<string>, age: number): WorkState {
  if (flags.has('has_career')) return 'working';
  if (flags.has('college') && age <= ECONOMY.studentUntilAge) return 'student';
  if (flags.has('exam_prep') && age <= ECONOMY.examUntilAge) return 'exam';
  if (flags.has('own_business')) return 'business';
  return 'casual';
}

export function educationMultiplier(education: number): number {
  for (const e of ECONOMY.edu) if (education < e.below) return e.mult;
  return ECONOMY.edu[ECONOMY.edu.length - 1].mult;
}

/** 이 해의 연 소득(만 원, 정수): 곡선 × 학력 × 일 상태 × 시대, 결혼하면 맞벌이 계수, 소득 보정을 더하고 65세부터 연금을 더한다 */
export function incomeOf(ctx: EconomyContext, incomeAdj: number): number {
  const state = workStateOf(ctx.flags, ctx.age);
  const curve = laborCurve(ctx.age);
  const base = (state === 'working' || state === 'business') && ctx.age < ECONOMY.floorBelowAge ? Math.max(ECONOMY.fullTimeFloor, curve) : curve;
  const labor = base * educationMultiplier(ctx.education) * ECONOMY.state[state] * factorsOf(ctx).income;
  const spouse = ctx.flags.has('married') ? ECONOMY.spouseIncome : 1;
  const adj = incomeAdj * (ctx.age >= ECONOMY.pension.fromAge ? ECONOMY.pension.adjFade : 1);
  const pension = ctx.age >= ECONOMY.pension.fromAge ? ECONOMY.pension.amount : 0;
  return clampInt(Math.max(0, labor * spouse + adj) + pension, 0, LIMITS.incomeMax);
}

/** 생활 인원 환산: 나 1 + 배우자 + 자녀(has_child이고 child_left가 아닐 때) */
export function livingEquivalent(flags: ReadonlySet<string>): number {
  const kids = flags.has('has_child') && !flags.has('child_left');
  return 1 + (flags.has('married') ? ECONOMY.living.spouse : 0) + (kids ? ECONOMY.living.child : 0);
}

export function livingOf(ctx: EconomyContext, dwelling: Dwelling): number {
  const student = workStateOf(ctx.flags, ctx.age) === 'student' ? ECONOMY.living.student : 1;
  const old = ctx.age >= 80 ? ECONOMY.living.old80 : 1;
  const family = dwelling === 'family' ? ECONOMY.living.familyLiving : 1;
  const profile = ECONOMY.living.ageProfile.find((p) => ctx.age <= p.upTo)?.mult ?? 1;
  return Math.round(ECONOMY.living.base * factorsOf(ctx).living * livingEquivalent(ctx.flags) * old * student * family * profile);
}

export function medicalOf(age: number): number {
  return (age >= 65 ? ECONOMY.medical.from65 : 0) + (age >= 80 ? ECONOMY.medical.from80Extra : 0);
}

/** 주거비. `housingFactor`는 `economyFactors(...).housing`(연도·지역 보정, GM4에서는 늘 1) */
export function housingCostOf(dwelling: Dwelling, income: number, housingFactor: number): number {
  const h = ECONOMY.housing;
  const rent = Math.max(h.rentFloor, h.rentRate * income);
  const cost = dwelling === 'own' ? h.own : dwelling === 'rent' ? rent : dwelling === 'jeonse' ? h.jeonseShare * rent : dwelling === 'care' ? h.care : h.family;
  return Math.round(cost * housingFactor);
}

/** 연 현금흐름의 내역(만 원). total = income − living − medical − housing − interest + subsidy (subsidy는 노년 안전망이 메운 적자, 아니면 0) */
export interface CashFlow {
  income: number;
  living: number;
  medical: number;
  housing: number;
  interest: number;
  /** 노년 안전망(D20)이 메운 그해 적자(이자 포함). 안전망이 아니면 0 */
  subsidy: number;
  total: number;
}

/** 노년 안전망이 적용되는가: safetyNet.fromAge세 이상이고 순자산 ≤ 0 (D20) */
export const safetyNetApplies = (age: number, net: number): boolean => age >= ECONOMY.safetyNet.fromAge && net <= 0;

/**
 * 이 상태(나이·플래그·소득 보정·주거·부채·순자산)에서 이 해의 현금흐름. 선택 전·후를 각각 구해 견주면 영향 표기의 「연 현금흐름 변화」가 된다.
 * 생활비는 차입 한도(ECONOMY.living.maxBorrow·minShare)를 넘지 않는다: 소득·자산이 모자라면 씀씀이를 줄이고, 기본 생활비의 minShare 아래로는 줄지 않는다(D19).
 * 노년 안전망(D20): 65세 이상이고 순자산 ≤ 0이면 생활비를 하한까지 줄이고, 그래도 남는 적자(이자 포함)는 `subsidy`로 메워 새 빚이 되지 않는다(부채는 동결). 난수를 쓰지 않는다.
 */
export function cashFlowOf(
  ctx: EconomyContext,
  assets: Pick<Assets, 'incomeAdj' | 'dwelling' | 'debt' | 'net'>,
  options: { limits?: boolean } = {},
): CashFlow {
  const income = incomeOf(ctx, assets.incomeAdj);
  const medical = medicalOf(ctx.age);
  const housing = housingCostOf(assets.dwelling, income, factorsOf(ctx).housing);
  const interest = Math.round(assets.debt * ECONOMY.interest);
  const desired = livingOf(ctx, assets.dwelling);
  const floor = Math.round(ECONOMY.living.base * factorsOf(ctx).living * ECONOMY.living.minShare);
  const affordable = income - medical - housing - interest + Math.max(0, assets.net) + ECONOMY.living.maxBorrow;
  // limits=false: 한도·안전망 없이 「원래 씀씀이」로 계산한다 — 선택이 바꾸는 연 현금흐름(구조)을 읽는 영향 표기용. 한도는 쌓인 자산에 따라 생활을 줄이는 반응이라 선택의 효과가 아니다.
  const limited = options.limits !== false;
  const safety = limited && safetyNetApplies(ctx.age, assets.net);
  const living = !limited ? desired : safety ? Math.min(desired, floor) : Math.min(desired, Math.max(floor, Math.round(affordable)));
  const raw = income - living - medical - housing - interest;
  // 안전망: 순자산 ≤ 0이면 적자 전부를 메운다(D20). coverOvershoot가 켜져 있으면 순자산이 남아 있던 해의 적자도 0까지만 줄이고 그 아래로 내려간 몫은 메운다(자산을 다 쓴 해에 새 빚이 생기지 않는다).
  const overshoot = limited && !safety && ECONOMY.safetyNet.coverOvershoot && ctx.age >= ECONOMY.safetyNet.fromAge && assets.net + raw < 0 ? -(assets.net + raw) : 0;
  const subsidy = safety && raw < 0 ? -raw : overshoot;
  return { income, living, medical, housing, interest, subsidy, total: raw + subsidy };
}

/**
 * 값을 한계로 자르고 불변식 `debt ≥ max(0, −net)`을 지킨다: 순자산이 음수이면 부족분만큼 부채가 있어야 한다(총자산 net + debt ≥ 0).
 * 자산이 있는 동안의 적자는 자산에서 나가고, 자산이 바닥난 뒤의 적자는 부채가 된다(「빚이 빚을 만든다」).
 */
export function settleAssets(a: Assets): Assets {
  const net = clampInt(a.net, LIMITS.netMin, LIMITS.netMax);
  const debtFloor = Math.max(0, -net);
  const debt = Math.max(clampInt(a.debt, 0, LIMITS.debtMax), debtFloor);
  return {
    net,
    income: clampInt(a.income, 0, LIMITS.incomeMax),
    debt,
    incomeAdj: clampInt(a.incomeAdj, -LIMITS.adjMax, LIMITS.adjMax),
    dwelling: a.dwelling,
  };
}

/** 독립(20세) 때의 기본 주거: 재력 3~5단계는 부모 집, 1~2단계는 월세 */
export function initialDwelling(tier: ParentWealth): Dwelling {
  return tier >= 3 ? 'family' : 'rent';
}

/**
 * 독립(20세) 초기 자산 (M-1, 15절): net₂₀ = SUPPORT + familyFund − debt₂₀, 학자금 대출은 college 플래그가 있을 때 LOAN[재력].
 * familyFund에 하한을 두지 않는다 — 모자란 몫은 불변식이 시작 부채로 만든다.
 */
export function initialAssets(ctx: EconomyContext, familyFund: number): Assets {
  const i = ctx.tier - 1;
  const loan = ctx.flags.has('college') ? ECONOMY.collegeLoan[i] : 0;
  const net = ECONOMY.support[i] + familyFund - loan;
  return settleAssets({ net, income: incomeOf(ctx, 0), debt: loan, incomeAdj: 0, dwelling: initialDwelling(ctx.tier) });
}

/**
 * 선택이 켠 플래그가 바꾸는 주거 형태와, 결혼으로 부모 집에서 나올 때의 시작 부채(설계값). `before`·`after`는 선택 전·후 플래그 집합이다.
 *  - in_care → 요양, own_home → 자가, renting → 월세, lives_with_parents·moved_home → 가족(요양이 아닐 때)
 *  - 결혼(married가 막 켜짐)했는데 부모 집이면: 재력 4~5단계 자가(+부채 6,000)·3단계 전세(+부채 5,000)·1~2단계 월세
 */
export function dwellingAfterFlags(
  prev: Dwelling,
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
  tier: ParentWealth,
): { dwelling: Dwelling; debtAdd: number } {
  const gained = (f: string): boolean => after.has(f) && !before.has(f);
  let dwelling = prev;
  let debtAdd = 0;
  if (gained('in_care')) dwelling = 'care';
  else if (gained('own_home')) dwelling = 'own';
  else if (gained('renting')) dwelling = 'rent';
  else if (gained('lives_with_parents') || gained('moved_home')) dwelling = 'family';
  if (gained('married') && dwelling === 'family') {
    if (tier >= 4) {
      dwelling = 'own';
      debtAdd = ECONOMY.marriage.ownDebt;
    } else if (tier === 3) {
      dwelling = 'jeonse';
      debtAdd = ECONOMY.marriage.jeonseDebt;
    } else dwelling = 'rent';
  }
  return { dwelling, debtAdd };
}

/** 선택과 무관한 자연 전환: 미혼 30세 이상이 부모 집에 남아 있으면(lives_with_parents·moved_home 플래그가 없을 때) 월세로 나온다 */
export function naturalDwelling(prev: Dwelling, ctx: EconomyContext): Dwelling {
  if (prev !== 'family') return prev;
  if (ctx.flags.has('married') || ctx.flags.has('lives_with_parents') || ctx.flags.has('moved_home')) return prev;
  return ctx.age >= ECONOMY.leaveFamilyAge ? 'rent' : prev;
}

/**
 * 선택·이벤트가 자산에 주는 효과를 적용한다(순수). `ctxAfter`는 효과 적용 뒤의 플래그·지식으로 만든 상태다(소득을 다시 계산한다).
 * 순서: 순자산·소득 보정·부채를 더하고 → 새로 켜진 플래그의 주거 전환(결혼 시작 부채 포함) → 한계·불변식 → 연 소득을 다시 계산해 저장.
 */
export function applyAssetEffects(assets: Assets, delta: AssetDeltas, flagsBefore: ReadonlySet<string>, ctxAfter: EconomyContext): Assets {
  const moved = dwellingAfterFlags(assets.dwelling, flagsBefore, ctxAfter.flags, ctxAfter.tier);
  const next = settleAssets({
    ...assets,
    net: assets.net + (delta.net ?? 0),
    incomeAdj: assets.incomeAdj + (delta.income ?? 0),
    debt: assets.debt + (delta.debt ?? 0) + moved.debtAdd,
    dwelling: moved.dwelling,
  });
  return { ...next, income: incomeOf(ctxAfter, next.incomeAdj) };
}

/**
 * 한 해 마무리(나이 a를 산 해): 자연 주거 전환 → 현금흐름을 순자산에 더함 → 흑자의 일부로 상환 → 자동 대출 → 연 소득 저장.
 * 난수를 쓰지 않는다.
 */
export function yearlyAssets(assets: Assets, ctx: EconomyContext): Assets {
  const dwelling = naturalDwelling(assets.dwelling, ctx);
  const flow = cashFlowOf(ctx, { incomeAdj: assets.incomeAdj, dwelling, debt: assets.debt, net: assets.net });
  let debt = assets.debt;
  if (flow.total > 0 && debt > 0) debt -= Math.min(debt, Math.round(ECONOMY.repayShare * flow.total));
  return settleAssets({ ...assets, net: assets.net + flow.total, income: flow.income, debt, dwelling });
}

const ASSET_KEYS = ['net', 'income', 'debt', 'incomeAdj', 'dwelling'] as const;

/** 저장·시험용: 키가 정확히 다섯 개이고, 값이 한계 안의 정수이며 불변식을 지키는가 */
export function isValidAssets(v: unknown, dwellings: readonly string[]): v is Assets {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  // 키는 정확히 다섯 개다(R-357): 여분 키(`__proto__` 포함)가 저장에 숨어 들어오지 못한다 — validStats와 같은 규칙
  const keys = Object.keys(a);
  if (keys.length !== ASSET_KEYS.length || !ASSET_KEYS.every((k) => Object.prototype.hasOwnProperty.call(a, k))) return false;
  const int = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
  return (
    int(a.net, LIMITS.netMin, LIMITS.netMax) &&
    int(a.income, 0, LIMITS.incomeMax) &&
    int(a.debt, 0, LIMITS.debtMax) &&
    int(a.incomeAdj, -LIMITS.adjMax, LIMITS.adjMax) &&
    typeof a.dwelling === 'string' &&
    dwellings.includes(a.dwelling) &&
    a.debt >= Math.max(0, -a.net)
  );
}

/** 20세 미만 집안 살림 누적을 범위로 자른다 */
export function clampFamilyFund(v: number): number {
  return clampInt(v, -LIMITS.familyFundMax, LIMITS.familyFundMax);
}
