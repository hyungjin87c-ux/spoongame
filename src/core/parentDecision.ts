import { eventPool } from './gameData';
import {
  ALL_SELF_FROM_AGE,
  DECISION_AREAS,
  FAMILY_NEED_BASE,
  PARENT_AREAS,
  PARENT_DECISION_TABLE,
  PARENT_MODEL,
  PARENT_PRIORITY,
  SELF_AREA_WEIGHT,
  SELF_FROM_AGE,
  parentFitOf,
  type DecisionRow,
} from '../data/parentDecisionTable';
import { condContextOf } from './apply';
import { isChoiceEvent, resolveEffects, stageOfAge, type EventDef, type EventPool } from './events';
import { STAT_KEYS, type GameState, type ParentWealth, type StatKey } from './types';

/**
 * 어린 시절 부모님 결정 (SPEC-005 PD1~PD4·PD13, 설계 문서 docs/data/parent-decision-model.md — PD0 승인 2026-10-20). **순수 함수**: 난수·시각을 쓰지 않는다(`Date`·`Math.random` 없음).
 *
 *  - `deciderOf(eventId, age)`: 그 해 그 결정 카드를 누가 정하는가 — `'parent'` 부모님 / `'child'` 흘러감(아이의 반응·행동이 선택지라 아이의 성향·형편으로 정해짐) / `'self'` 본인.
 *  - `parentChoiceWeights(state, pool)`: 부모의 선택지 확률(2절). 입력은 수저 단계·양육 방식·형제 순서·집안 살림 잔액·아이의 현재 스탯·나이뿐이다 —
 *    부모 직업·부모 나이·성별·이름·지역·외모는 입력이 아니다(마스터 결정 M4, 시험이 격자로 잠근다).
 *  - 흘러감의 확률은 `autoChoiceWeights`를 그대로 쓴다(`life.ts#childFlowWeights`, 승인 A9).
 */

export type Decider = 'parent' | 'child' | 'self';

const has = (id: string): boolean => Object.prototype.hasOwnProperty.call(PARENT_DECISION_TABLE, id);

/** 분류표에 있는 이벤트 id인가 (19세 미만에서 일어날 수 있는 선택지 이벤트 32장). 표 밖 id의 `deciderOf`(나이 < 19)는 throw한다 */
export function isClassified(eventId: string): boolean {
  return has(eventId);
}

/** 한 이벤트의 분류 한 줄 (없으면 undefined) */
export function decisionRowOf(eventId: string): DecisionRow | undefined {
  return has(eventId) ? PARENT_DECISION_TABLE[eventId] : undefined;
}

/**
 * 그 해(`age`) 그 결정 카드를 누가 정하는가 (SPEC-005 PD2 — 설계 문서 1-2절). 아래 순서로 첫 번째 맞는 줄을 쓴다.
 *  R1 `age ≥ 19` → 본인 / R2 영역에 `reaction` → 흘러감 / R3 `childActUntil`이 있고 `age ≤` 그 값 → 흘러감 / R4 `age ≤ 12` → 부모 / R5 13~18세: 부모 영역이 하나라도 있으면 부모, 없으면 본인.
 * 나이는 결정 카드가 일어나는 그 해의 나이(`pending.age`)다. 나이 < 0·정수가 아닌 나이는 throw. 19세 이상은 표를 보지 않는다(청년 이상 58장은 표에 없고 모두 본인).
 * 표에 없는 이벤트 id를 19세 미만에서 물으면 throw한다 — 빌드의 lint(scripts/validateEvents.ts)가 먼저 막는다.
 */
export function deciderOf(eventId: string, age: number): Decider {
  if (!Number.isInteger(age) || age < 0) throw new Error(`deciderOf: 나이는 0 이상의 정수여야 한다 (${age})`);
  if (age >= ALL_SELF_FROM_AGE) return 'self'; // R1
  const row = decisionRowOf(eventId);
  if (row === undefined) throw new Error(`deciderOf: 분류표에 없는 이벤트다 (${eventId}) — src/data/parentDecisionTable.ts에 영역을 적어야 한다`);
  return deciderFromRow(row, age); // R2~R5
}

/**
 * 엔진이 쓰는 판정: 표에 없는 이벤트는 사람이 정한다(`'self'`). 실제 풀은 lint·시험(T1)이 32장 전수 분류를 보장하고, 시험이 만든 가짜 풀(분류표에 없는 id)은 지금까지처럼 사람이 고른다.
 */
export function decisionFor(eventId: string, age: number): Decider {
  return isClassified(eventId) ? deciderOf(eventId, age) : 'self';
}

/**
 * PD13: 13~18세에 본인이 고르는 카드의 이벤트 추첨 가중 배수(`SELF_AREA_WEIGHT`, 기본 1). 그 밖의 카드·나이는 1.
 * 13~18세 본인 카드가 0장인 판이 25%를 넘으면 올리고 EK를 다시 잰다(마스터 결정 Q2): 승인 값 ×1.5로는 3000판 26.6~29.6%라 못 미쳐 마스터가 **×2.0**으로 올렸다(설계 문서 9절 3번, `SELF_AREA_WEIGHT`).
 */
export function selfAreaWeightFactor(eventId: string, age: number): number {
  if (SELF_AREA_WEIGHT === 1 || age < SELF_FROM_AGE || age >= ALL_SELF_FROM_AGE) return 1;
  return decisionFor(eventId, age) === 'self' ? SELF_AREA_WEIGHT : 1;
}

// ---------- 형편 입력 (2-4절) ----------

/** 돈 민감도: `1 + (50 − FAMILY_NEED_BASE[수저 − 1]) / 100` — 1단계 1.42 · 2단계 1.28 · 3단계 1.05 · 4단계 0.80 · 5단계 0.58 (자동 선택과 같다) */
export function moneyNeedOf(tier: ParentWealth): number {
  return 1 + (50 - FAMILY_NEED_BASE[tier - 1]) / 100;
}

/** 형제 순서 계수: `1 + 0.08 × (min(순서, 5) − 1)` — 첫째 1.00 · 둘째 1.08 · 셋째 1.16 · 넷째 1.24 · 다섯째 이상 1.32 (형제가 많을수록 한 아이에게 쓸 몫이 줄어든다는 설계) */
export function siblingFactor(birthOrder: number): number {
  return 1 + PARENT_MODEL.siblingStep * (Math.min(Math.max(1, Math.floor(birthOrder)), PARENT_MODEL.siblingMaxOrder) - 1);
}

/** 집안 살림 잔액 계수: `1 − clamp(F, ±1500) / 6000` — 잔액 −1500만 원이면 1.25, 0이면 1.00, +1500만 원이면 0.75 */
export function balanceFactor(familyFund: number): number {
  const f = Math.min(PARENT_MODEL.balanceRange, Math.max(-PARENT_MODEL.balanceRange, familyFund));
  return 1 - f / PARENT_MODEL.balanceDivisor;
}

// ---------- 부모의 선택지 확률 (2-1절) ----------

export interface ChoiceWeights {
  /** 보이는 선택지 id (`pending.choiceIds`와 같은 순서) */
  ids: string[];
  /** 선택 확률 (합 1). `weightedIndex`가 합으로 나누므로 어떤 배율이어도 같은 선택이다 */
  weights: number[];
}

/**
 * 부모의 선택지 확률. 보이는 선택지(`pending.choiceIds`)마다 점수 `S_j`를 만들고 가중치로 바꾼다 (RNG 없음):
 *
 *   스탯항 = Σ_k Δ_j.stats[k] × PARENT_PRIORITY[양육 방식][k] × need_k        need_k = 1 + (50 − 스탯_k) / 100  (0.5~1.5)
 *   돈항   = (Δ_j.family / 150) × PARENT_PRIORITY[양육 방식].wealth × M        M = moneyNeed(수저) × siblingFactor(형제 순서) × balanceFactor(집안 살림 잔액)
 *   w_j    = ε / n + (1 − ε) × fit_j × exp(clamp(S_j / T_p, ±40)) / Σ_i fit_i × exp(clamp(S_i / T_p, ±40))
 *
 * `Δ_j`는 영향 줄과 같은 실제 효과(`resolveEffects`)이고, 20세 미만이라 자산 항은 없다. `fit_j`(`PARENT_FIT`)는 가중치에만 곱하고 선택지의 효과를 바꾸지 않는다.
 * 고르는 난수는 `resolveChoiceStep`이 선택마다 먼저 소비하는 그 한 번의 난수와 같다(life.ts#parentPick).
 * 대기 중인 선택지가 없거나 인생 단계가 아니면 null.
 */
export function parentChoiceWeights(state: GameState, pool: EventPool = eventPool()): ChoiceWeights | null {
  const pending = state.pending;
  if (state.phase !== 'life' || pending === null || state.character === null) return null;
  const ev = pool.byId.get(pending.eventId);
  if (ev === undefined) throw new Error(`parentChoiceWeights: 이벤트를 찾을 수 없다 (${pending.eventId})`);
  const { parenting, parentWealth } = state.character;
  const priority = PARENT_PRIORITY[parenting];
  const ctx = condContextOf(state);
  const order = state.birthReport === null ? 1 : state.birthReport.birthOrder;
  const money = moneyNeedOf(parentWealth) * siblingFactor(order) * balanceFactor(state.familyFund);
  const limit = PARENT_MODEL.exponentLimit;
  const n = pending.choiceIds.length;
  const raw = pending.choiceIds.map((id) => {
    const choice = ev.choices?.find((c) => c.id === id);
    if (choice === undefined) throw new Error(`parentChoiceWeights: 선택지를 찾을 수 없다 (${id})`);
    const eff = resolveEffects(choice.effects, choice.bonuses, ctx);
    let score = 0;
    for (const key of STAT_KEYS) {
      const delta = eff.stats[key as StatKey] ?? 0;
      if (delta === 0) continue;
      const need = 1 + (50 - state.stats[key]) / 100; // 이미 높은 스탯보다 낮은 스탯이 더 절실하다 (0.5~1.5)
      score += delta * priority[key] * need;
    }
    score += (eff.family / PARENT_MODEL.moneyPoint) * priority.wealth * money;
    return parentFitOf(ev.id, id) * Math.exp(Math.max(-limit, Math.min(limit, score / PARENT_MODEL.temperature)));
  });
  const total = raw.reduce((a, b) => a + b, 0);
  const weights = raw.map((w) => PARENT_MODEL.epsilon / n + (1 - PARENT_MODEL.epsilon) * (w / total));
  return { ids: [...pending.choiceIds], weights };
}

// ---------- 분류표 점검 (PD2 검증 ①②③, 빌드 lint) ----------

/** 이 이벤트가 일어날 수 있는 모든 나이(단계와 `ageRange`가 겹치는 0~130세) */
export function possibleAgesOf(ev: Pick<EventDef, 'stages' | 'ageRange'>, maxAge = 130): number[] {
  const out: number[] = [];
  for (let a = 0; a <= maxAge; a++) {
    if (!ev.stages.includes(stageOfAge(a))) continue;
    if (ev.ageRange?.min !== undefined && a < ev.ageRange.min) continue;
    if (ev.ageRange?.max !== undefined && a > ev.ageRange.max) continue;
    out.push(a);
  }
  return out;
}

/** 19세 미만에서 일어날 수 있는 선택지 이벤트인가 (= 분류표에 있어야 하는 이벤트) */
export function isPreAdultChoice(ev: EventDef): boolean {
  return isChoiceEvent(ev) && possibleAgesOf(ev).some((a) => a < ALL_SELF_FROM_AGE);
}

/**
 * 분류표 ↔ 이벤트 데이터 점검 (SPEC-005 PD2 검증 ①②③): ① 19세 미만에서 일어날 수 있는 모든 선택지 이벤트가 표에 있다(새 선택지 이벤트를 분류 없이 추가하면 실패) ② 표의 이벤트 id가 모두 실제 선택지 이벤트이고 19세 미만에서 일어난다
 * ③ 영역 코드가 알려진 코드이고, 13~18세 본인 결정 이벤트는 영역이 `study·friends·hobby`뿐이다(`childActUntil`은 0~18의 정수). 문제 목록(빈 배열이면 통과).
 */
export function parentTableProblems(events: readonly EventDef[], table: Readonly<Record<string, DecisionRow>> = PARENT_DECISION_TABLE): string[] {
  const problems: string[] = [];
  const byId = new Map(events.map((e) => [e.id, e] as const));
  for (const ev of events) {
    if (isPreAdultChoice(ev) && !Object.prototype.hasOwnProperty.call(table, ev.id)) {
      problems.push(`${ev.id}: 19세 미만에서 일어나는 선택지 이벤트인데 분류표(src/data/parentDecisionTable.ts)에 없다 — 부모 / 흘러감 / 본인 중 누가 정하는지 영역 표지를 적는다`);
    }
  }
  for (const [id, row] of Object.entries(table)) {
    const ev = byId.get(id);
    if (ev === undefined || !isChoiceEvent(ev)) {
      problems.push(`${id}: 분류표에 있지만 실제 선택지 이벤트가 아니다`);
      continue;
    }
    if (!isPreAdultChoice(ev)) problems.push(`${id}: 분류표에 있지만 19세 미만에서 일어나지 않는다 (청년 이상은 모두 본인이라 표에 두지 않는다)`);
    if (row.areas.length === 0) problems.push(`${id}: 영역 표지가 비어 있다`);
    for (const a of row.areas) if (!(DECISION_AREAS as readonly string[]).includes(a)) problems.push(`${id}: 알 수 없는 영역 코드다 (${a})`);
    if (row.childActUntil !== undefined && !(Number.isInteger(row.childActUntil) && row.childActUntil >= 0 && row.childActUntil < ALL_SELF_FROM_AGE)) {
      problems.push(`${id}: childActUntil은 0~${ALL_SELF_FROM_AGE - 1}의 정수여야 한다 (${row.childActUntil})`);
    }
    // ③ 13~18세에 본인이 고르는 나이가 있다면 영역은 공부·친구·취미뿐이다 (R5가 부모 영역이 있으면 부모로 가르므로 어긋나면 코드 오류)
    for (const a of possibleAgesOf(ev)) {
      if (a < SELF_FROM_AGE || a >= ALL_SELF_FROM_AGE) continue;
      if (deciderFromRow(row, a) === 'self' && row.areas.some((x) => (PARENT_AREAS as readonly string[]).includes(x) || x === 'reaction')) {
        problems.push(`${id}: ${a}세에 본인 결정인데 영역에 부모 영역·아이 반응이 있다`);
        break;
      }
    }
  }
  return problems;
}

/** 표 한 줄과 나이로 결정자를 구한다 (R1~R5 — `deciderOf`가 쓰는 같은 규칙, 표 밖 id를 점검하는 곳에서 쓴다) */
function deciderFromRow(row: DecisionRow, age: number): Decider {
  if (age >= ALL_SELF_FROM_AGE) return 'self';
  if (row.areas.includes('reaction')) return 'child';
  if (row.childActUntil !== undefined && age <= row.childActUntil) return 'child';
  if (age < SELF_FROM_AGE) return 'parent';
  return row.areas.some((a) => (PARENT_AREAS as readonly string[]).includes(a)) ? 'parent' : 'self';
}
