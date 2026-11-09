import { ASK_BASE, ASK_CLOSENESS_BASE, ASK_EFFECTS, ASK_KIND_INFO, ASK_MODEL, type AskChoiceId, type AskEffectKey, type AskKind } from '../data/askTable';
import type { EventDef } from './events';
import { FAMILY_TAG_ASK } from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { closenessOf } from './familyCloseness';
import { coParentsOf } from './parentSubject';
import type { FamilyGame } from './familyView';
import type { Effects, GameState } from './types';

/**
 * 어린 시절 조르기 판정 (SPEC-011 AK3, 설계 문서 docs/data/ask-model.md 2절 — AK0 승인 2026-11-07). **순수 함수**: 진행 RNG(`rngState`)·`Date`·`Math.random`을 읽지도 쓰지도 않는다.
 *
 *   p(조른다)    = clamp( BASE[종류][재력] + 0.06 × (C − 3),         0.05, 0.95 )
 *   p(떼쓴다)    = clamp( BASE[종류][재력] + 0.06 × (C − 3) + 0.10,  0.05, 0.95 )
 *
 * 입력은 **부모 재력 단계 `W`(1~5) · 사이 `C`(1~5) · 종류 · 선택** 네 가지뿐이다(부모 직업·부모 나이·성별·이름·지역·형제 순서·집안 살림 잔액·아이의 스탯·외모·달력 연도는 입력이 아니다 — 격자 시험이 잠근다).
 * 양육 방식은 `C`의 기울임(방임 −2 · 엄격 −1 · 자유 0 · 헬리콥터 +1)으로만 들어간다.
 * `C` = 함께 사는 부모 중 가장 가까운 분의 사이(`closenessOf`의 최댓값, 가족 카드에 보이는 사이 말과 같은 함수·같은 값). 함께 사는 부모는 DS1 `coParentsOf`가 정한다 — 한 분이면 그분의 값, 없으면 `C = 3`(구조상 도달하지 않는 방어 분기).
 *
 * 난수는 해시다: `famHash01(가족 시드, 20, 종류 번호, 나이×2+칸)` — 칸 0 = `u1`(들어주기: `u1 < p`면 들어주기), 칸 1 = `u2`(떼쓰기가 거절당했을 때 사이 비용, AK5). **조르기와 떼쓰기가 `u1`을 공유**해서
 * `p(떼쓴다) ≥ p(조른다)`이면 「조른다가 들어주기이면 떼쓰기도 들어주기」이 항상 성립한다. 나이는 카드가 뜬 `pending.age`다(대기 카드가 없으면 지금 나이 — 해결 시 둘은 같다).
 * `closenessOf`가 지연 로드 덩어리 `familyTables()`를 쓴다 — 조르기 카드는 인생 단계에서만 뜨고 그때는 게임 데이터가 로드돼 있다.
 */

/** 조르기 판정이 읽는 상태: 가족 계획이 읽는 칸 + 대기 카드 */
export type AskState = FamilyGame & Pick<GameState, 'pending'>;

/** 확률이 있는 선택(조른다·떼쓴다). `참는다`는 확률이 없는 확정 결과다 */
export type AskRollChoice = Exclude<AskChoiceId, 'endure'>;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** 판정 나이 — 카드가 뜬 나이(`pending.age`), 대기 카드가 없으면 지금 나이 */
export function askAgeOf(state: Pick<AskState, 'pending' | 'age'>): number {
  return state.pending !== null ? state.pending.age : state.age;
}

function kindOf(ev: Pick<EventDef, 'id' | 'ask'>): AskKind {
  if (ev.ask === undefined) throw new Error(`ask: 조르기 사건이 아니다 (${ev.id}) — 사건에 ask 필드가 있어야 한다`);
  return ev.ask.kind;
}

/**
 * 사이 `C`(1~5): 그 해 함께 사는 부모 중 가장 가까운 분의 사이. 두 분이면 어머니·아버지 중 큰 값, 한 분이면 그분, 없으면 3.
 * `closenessOf`는 지금 플래그를 읽으므로 `parent_strained`가 켜진 뒤에는 한 단계 낮다(AK5가 표에 올리는 줄).
 */
export function askCloseness(state: AskState, age: number = askAgeOf(state)): number {
  const co = coParentsOf(state, age);
  if (co === 'none') return ASK_CLOSENESS_BASE;
  const mother = () => closenessOf({ id: 'mother', role: 'mother' }, state);
  const father = () => closenessOf({ id: 'father', role: 'father' }, state);
  if (co === 'mother') return mother();
  if (co === 'father') return father();
  return Math.max(mother(), father());
}

/** 들어줄 확률 `p` (조른다 · 떼쓴다) — 위 식. 확률이 없는 `endure`를 물으면 throw한다 */
export function askGrantChance(state: AskState, ev: Pick<EventDef, 'id' | 'ask'>, choiceId: AskRollChoice): number {
  if (choiceId !== 'beg' && choiceId !== 'tantrum') throw new Error(`askGrantChance: 조른다(beg)·떼쓴다(tantrum)만 확률이 있다 (${String(choiceId)})`);
  const kind = kindOf(ev);
  if (state.character === null) throw new Error('askGrantChance: 출생 전 상태에는 부모 재력이 없다');
  const base = ASK_BASE[kind][state.character.parentWealth - 1];
  const c = askCloseness(state);
  const p = base + ASK_MODEL.closeStep * (c - ASK_CLOSENESS_BASE) + (choiceId === 'tantrum' ? ASK_MODEL.tantrumBonus : 0);
  return clamp(p, ASK_MODEL.pMin, ASK_MODEL.pMax);
}

/**
 * 판정 난수 두 칸 `u1`·`u2` ([0,1) 해시). 진행 RNG를 쓰지 않는다 — 같은 판 · 같은 종류 · 같은 나이는 같은 값이다(저장·새로고침 뒤에도).
 * 시드는 `peerSeed ?? seed`(가족 계획과 같다). 키는 `(종류 번호, 나이×2+칸)` — 사건 id가 아니라 종류 번호라 사건을 나누거나 id를 바꿔도 값이 그대로다.
 */
export function askRolls(state: Pick<AskState, 'pending' | 'age' | 'peerSeed' | 'seed'>, ev: Pick<EventDef, 'id' | 'ask'>): { u1: number; u2: number } {
  const no = ASK_KIND_INFO[kindOf(ev)].no;
  const age = askAgeOf(state);
  const famSeed = famSeedOf(state.peerSeed ?? state.seed);
  return { u1: famHash01(famSeed, FAMILY_TAG_ASK, no, age * 2), u2: famHash01(famSeed, FAMILY_TAG_ASK, no, age * 2 + 1) };
}

/**
 * 사이 비용 확률 `s(C) = clamp(0.50 + 0.10 × (3 − C), 0.20, 0.80)` (SPEC-011 AK5, 설계 문서 4-1절): 떼쓰기가 **거절당했을 때** 사이가 나빠질 확률. 사이가 먼 부모일수록 높다
 * (`C = 1` 0.70 · `C = 3` 0.50 · `C = 5` 0.30). `C`는 들어줄 확률과 같은 `askCloseness`다 — 순수 함수, 진행 RNG를 읽지 않는다.
 */
export function askStrainChance(state: AskState, age: number = askAgeOf(state)): number {
  const c = askCloseness(state, age);
  return clamp(ASK_MODEL.strainBase + ASK_MODEL.strainStep * (ASK_CLOSENESS_BASE - c), ASK_MODEL.strainMin, ASK_MODEL.strainMax);
}

/**
 * 한 선택이 닿을 수 있는 갈래와 그 확률 (SPEC-011 AK4·AK6, 설계 문서 3-1·5-3절): 합이 1이다. 확정 결과인 `endure`는 갈래 하나(확률 1).
 *  - 조른다: 들어주기 `p` · 거절 `1 − p`
 *  - 떼쓴다: 들어주기 `p` · 거절+사이 나빠짐 `(1 − p) × s(C)` · 거절 `(1 − p) × (1 − s(C))`
 * 자동 모드의 기대 효과 가중(`life.ts#autoChoiceWeights`)과 시험이 읽고, 실제 해결(`askOutcomeOf`)은 같은 `p`·`s`로 해시 `u1`·`u2`를 견줘 한 갈래를 고른다 — 그래서 갈래 빈도가 이 확률과 같다.
 */
export function askBranchProbs(state: AskState, ev: Pick<EventDef, 'id' | 'ask'>, choiceId: AskChoiceId): Array<{ key: AskEffectKey; prob: number }> {
  const kind = kindOf(ev);
  if (choiceId === 'endure') return [{ key: 'endure', prob: 1 }];
  const p = askGrantChance(state, ev, choiceId);
  const granted = { key: `granted-${kind}` as const, prob: p };
  if (choiceId === 'beg') return [granted, { key: 'denied-beg', prob: 1 - p }];
  const s = askStrainChance(state);
  return [granted, { key: 'strained', prob: (1 - p) * s }, { key: 'denied-tantrum', prob: (1 - p) * (1 - s) }];
}

/** 해결 결과: 일어난 갈래 · 그 갈래의 효과(`ASK_EFFECTS` 한 곳) · 연표 줄의 결과 문장 (`resolveChoiceCore`가 일반 선택과 같은 경로로 적용한다) */
export interface AskOutcome {
  branch: AskEffectKey;
  effects: Effects;
  /** 연표 줄·카드의 결과 문장: 들어주기 `result` · 거절 `askDenied` · 거절+사이 나빠짐 `askStrained` · 참는다 `result` */
  text: string;
}

/**
 * 조르기 선택의 **해결 한 곳** (SPEC-011 AK4 — 갈래·효과·문장): `askRolls`의 `u1`로 들어주기을, 떼쓰기가 거절당했으면 `u2`로 사이 나빠짐을 정한다
 * (`u1 < p` → 들어주기, 아니면 거절 · 떼쓰기 거절은 `u2 < s(C)`이면 사이 나빠짐 — AK5). 효과는 코드 표 `ASK_EFFECTS`에서 읽고 사건 데이터는 문장만 준다(결정 AQ1).
 * `endure`는 확정 결과이고 난수를 읽지 않는다. 선택지 연타·새로고침에도 같은 값이다(해시). 진행 RNG(`rngState`)를 읽지도 쓰지도 않는다.
 * `state`는 **해결 전 상태**(`pending`이 있는 상태)다 — `p`·`s`의 사이 `C`가 효과 적용 전의 플래그를 읽는다.
 */
export function askOutcomeOf(state: AskState, ev: Pick<EventDef, 'id' | 'ask' | 'choices'>, choiceId: AskChoiceId): AskOutcome {
  const choice = ev.choices?.find((c) => c.id === choiceId);
  if (choice === undefined) throw new Error(`askOutcomeOf: 선택지를 찾을 수 없다 (${ev.id}/${choiceId})`);
  const need = (text: string | undefined, field: string): string => {
    if (text === undefined) throw new Error(`askOutcomeOf: 문장 필드가 없다 (${ev.id}/${choiceId}.${field})`);
    return text;
  };
  const kind = kindOf(ev);
  let branch: AskEffectKey;
  if (choiceId === 'endure') branch = 'endure';
  else {
    const { u1, u2 } = askRolls(state, ev);
    if (u1 < askGrantChance(state, ev, choiceId)) branch = `granted-${kind}`;
    else if (choiceId === 'beg') branch = 'denied-beg';
    else branch = u2 < askStrainChance(state) ? 'strained' : 'denied-tantrum';
  }
  const text = branch === 'strained' ? need(choice.askStrained, 'askStrained') : branch === 'denied-beg' || branch === 'denied-tantrum' ? need(choice.askDenied, 'askDenied') : choice.result;
  return { branch, effects: ASK_EFFECTS[branch], text };
}

/**
 * 조르기 사건의 **갈래 선택지**(조른다·떼쓴다)인가 (SPEC-011 AK4 — 정적 효과를 읽는 시험·스크립트의 한 곳 규칙).
 * 이 선택지는 데이터에 효과 필드가 없다(갈래별 효과는 코드 표 `ASK_EFFECTS`, 결정 AQ1). 그래서 풀 전체의 선택지 `effects`·`bonuses`를 훑어 점수·영향·플래그를 읽는 코드는
 * 이 선택지를 「효과 0」으로 읽으면 안 된다 — 거르거나(`tests/helpers/askChoice.ts#resolvedChoiceEffects`처럼) 일어난 갈래의 `ASK_EFFECTS`·`askBranchProbs` 기대값을 읽는다.
 * 참는다(`endure`)는 일반 선택지라 데이터 `effects`를 그대로 읽는다.
 */
export function isAskRollChoice(ev: Pick<EventDef, 'ask'>, choiceId: string): boolean {
  return ev.ask !== undefined && choiceId !== 'endure';
}
