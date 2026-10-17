import { IMPACT_STEPS } from '../data/economyTable';
import { applyResolved, condContextOf, economyContextOf } from './apply';
import { cashFlowOf, initialAssets } from './economy';
import { resolveEffects, type ChoiceDef, type EventPool, type ResolvedEffects } from './events';
import { STAT_KEYS, type GameState, type StatKey } from './types';

/**
 * 선택지 영향 표기 데이터 (SPEC-003 EC5, docs/data/economy-model.md 7절) — **순수 함수**. 화면(2b)이 글자·기호로 바꿀 항목·방향·칸 수·스크린리더 문장 키까지 만든다.
 *
 * 표기는 「지금 캐릭터 기준의 실제 적용값」이다: 효과(+ 조건이 맞는 보너스)를 `resolveEffects`로 해결하고, 인생 진행이 선택을 적용하는 코드(`applyResolved`)와 **같은 코드**로
 * 선택 전·후 상태를 만들어 견준다 — 그래서 표기에 없는 변화는 일어나지 않는다(숨은 효과 0). 간이 상속(core/inherit.ts)은 선택의 효과가 아니라 해 끝 규칙이라(r3) 영향 표기에 들어가지 않는다.
 *  - 자산 점수(만 원) = Δ순자산 + 3 × Δ연 현금흐름. Δ연 현금흐름은 같은 해의 경제 공식을 선택 전·후 상태에 각각 적용한 차이라서 소득 보정뿐 아니라
 *    선택이 바꾸는 일 상태·결혼·자녀·주거·부채의 파생 변화(결혼으로 소득이 늘어도 생활비·주거비 때문에 현금흐름이 줄어드는 것까지)가 들어간다.
 *  - 부채 = Δ부채(명시 부채 + 결혼 주거 전환의 시작 부채 + 자동 대출이 만든 몫). 집안 살림 = 20세 미만 이벤트의 Δ집안 살림(만 원).
 *  - **20세 미만의 부채 한 가지 예외(R-351, 마스터 결정 (a)안)**: 20세 미만 선택이 켜는 플래그가 독립(20세) 때 확정되는 시작 부채를 바꾸면(지금은 `college` → 학자금 대출 LOAN[재력]) 「부채」 항목으로 보인다.
 *    같은 `initialAssets`로 선택 전·후 시작 부채를 구해 집안 살림을 고정한 채 견주므로 독립 때 실제로 생기는 부채와 정확히 같다(재력 4~5단계는 LOAN 0이라 안 보인다).
 *    **학생 상태의 해마다 파생 효과(소득 ×0.15·생활비 ×0.7)는 표기하지 않는다** — 설계 문서 1-4·7절의 예외이고 tests/impact.test.ts가 예외 목록을 잠근다.
 *  - 항목 순서: (집안 살림 | 자산) · 부채 · 관계 · 행복 · 건강 · 지식. 변화가 있는 항목만 낸다.
 */

export const IMPACT_KEYS = ['family', 'assets', 'debt', 'relationships', 'happiness', 'health', 'education'] as const;
export type ImpactKey = (typeof IMPACT_KEYS)[number];
export type ImpactDirection = 'up' | 'down';
export type ImpactSteps = 1 | 2 | 3;

export interface ImpactItem {
  key: ImpactKey;
  /** ▲(값이 늘어난다) / ▼(줄어든다). 부채 ▲ = 빚이 늘어난다 */
  direction: ImpactDirection;
  /** 칸 수 1~3 (▲▲▲ 최대) */
  steps: ImpactSteps;
  /** 스크린리더 문장 키 `<항목>.<방향>.<칸 수>` (예: `assets.down.3`) — 문장은 designer `docs/design/copy.md`가 정한다 */
  sr: string;
}

/** 표기가 나온 계산의 값(시험·화면 보조) */
export interface ImpactDetail {
  /** 해결된 스탯 변화(자르기 전) */
  stats: Partial<Record<StatKey, number>>;
  /** Δ순자산(만 원) — 20세 미만이면 0 */
  dNet: number;
  /** Δ연 현금흐름(만 원) — 20세 미만이면 0 */
  dCashFlow: number;
  /** 자산 점수 = dNet + 3 × dCashFlow */
  assetScore: number;
  /** Δ부채(만 원) — 20세 미만이면 독립 때 확정되는 시작 부채(학자금 대출)의 변화만 */
  dDebt: number;
  dFamily: number;
}

export interface ChoiceImpact {
  items: ImpactItem[];
  detail: ImpactDetail;
}

/** 상태 4항목의 칸 수: |Δ| 1~2 → 1, 3~6 → 2, 7 이상 → 3 */
export function statSteps(abs: number): ImpactSteps {
  return abs <= IMPACT_STEPS.stat.oneUpTo ? 1 : abs <= IMPACT_STEPS.stat.twoUpTo ? 2 : 3;
}

/** 자산·집안 살림·부채의 칸 수(만 원): 500 미만 → 1, 500~2,999 → 2, 3,000 이상 → 3 */
export function moneySteps(abs: number): ImpactSteps {
  return abs <= IMPACT_STEPS.money.oneUpTo ? 1 : abs <= IMPACT_STEPS.money.twoUpTo ? 2 : 3;
}

const item = (key: ImpactKey, value: number, steps: (abs: number) => ImpactSteps): ImpactItem | null => {
  if (value === 0) return null;
  const direction: ImpactDirection = value > 0 ? 'up' : 'down';
  const n = steps(Math.abs(value));
  return { key, direction, steps: n, sr: `${key}.${direction}.${n}` };
};

/** 해결된 효과의 영향 (이미 resolveEffects를 거친 효과 → 표기 데이터). 20세 미만은 자산 대신 집안 살림이 있고, 부채는 독립 때 확정되는 시작 부채(학자금 대출)가 달라질 때만 나온다. */
export function impactOfEffects(state: GameState, eff: ResolvedEffects): ChoiceImpact {
  const after = applyResolved(state, eff);
  let dNet = 0;
  let dCashFlow = 0;
  let dDebt = 0;
  if (state.assets !== null && after.assets !== null) {
    dNet = after.assets.net - state.assets.net;
    dDebt = after.assets.debt - state.assets.debt;
    // 구조를 읽으려고 한도·안전망 없이 센다(cashFlowOf의 limits=false): 선택이 쌓인 자산을 바꿔 한도 반응(생활을 줄임)이 달라지는 것을 「현금흐름이 좋아졌다」로 읽지 않게 한다.
    const before = cashFlowOf(economyContextOf(state), state.assets, { limits: false }).total;
    const afterFlow = cashFlowOf(economyContextOf(after), after.assets, { limits: false }).total;
    dCashFlow = afterFlow - before;
  } else {
    // 20세 미만: 독립 때 확정되는 시작 부채의 변화(R-351). 집안 살림은 선택 전 값으로 고정해 플래그가 바꾸는 부채만 본다.
    dDebt = initialAssets(economyContextOf(after), state.familyFund).debt - initialAssets(economyContextOf(state), state.familyFund).debt;
  }
  const dFamily = state.assets === null ? eff.family : 0;
  const assetScore = dNet + IMPACT_STEPS.cashFlowYears * dCashFlow;
  const items: ImpactItem[] = [];
  const push = (it: ImpactItem | null): void => {
    if (it !== null) items.push(it);
  };
  push(item('family', dFamily, moneySteps));
  push(item('assets', assetScore, moneySteps));
  push(item('debt', dDebt, moneySteps));
  for (const key of ['relationships', 'happiness', 'health', 'education'] as const) push(item(key, eff.stats[key] ?? 0, statSteps));
  const stats: Partial<Record<StatKey, number>> = {};
  for (const k of STAT_KEYS) if ((eff.stats[k] ?? 0) !== 0) stats[k] = eff.stats[k];
  return { items, detail: { stats, dNet, dCashFlow, assetScore, dDebt, dFamily } };
}

/** 이 선택지를 지금 고르면 보이는 영향(선택지 아래 작은 글씨의 데이터). 지금 캐릭터의 보너스·자산이 반영된다. */
export function previewChoice(state: GameState, choice: ChoiceDef): ChoiceImpact {
  return impactOfEffects(state, resolveEffects(choice.effects, choice.bonuses, condContextOf(state)));
}

/** 대기 중인 선택지 이벤트의 보이는 선택지마다의 영향(없으면 null) */
export function previewPending(state: GameState, pool: EventPool): Array<{ choiceId: string; impact: ChoiceImpact }> | null {
  const pending = state.pending;
  if (state.phase !== 'life' || pending === null || state.character === null) return null;
  const ev = pool.byId.get(pending.eventId);
  if (ev === undefined) return null;
  return pending.choiceIds.map((id) => {
    const choice = ev.choices?.find((c) => c.id === id);
    if (choice === undefined) throw new Error(`previewPending: 선택지를 찾을 수 없다 (${pending.eventId}/${id})`);
    return { choiceId: id, impact: previewChoice(state, choice) };
  });
}
