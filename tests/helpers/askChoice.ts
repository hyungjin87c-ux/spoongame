import { askBranchProbs, askOutcomeOf, condContextOf, isAskRollChoice, resolveEffects, type EventDef, type GameState, type ResolvedEffects, type StatKey } from '../../src/core';
import { ASK_EFFECTS, type AskChoiceId } from '../../src/data/askTable';

/**
 * 선택지의 정적 효과를 읽는 시험이 쓰는 **한 곳 규칙** (SPEC-011 AK4): 조르기 사건의 조른다·떼쓴다에는 데이터 효과가 없다(갈래별 효과는 `ASK_EFFECTS`).
 *  - `resolvedChoiceEffects`: 지금 상태에서 그 선택지를 고르면 **실제로 적용되는 효과** — 일반 선택지는 데이터(`effects` + 조건이 맞는 `bonuses`), 조르기 갈래 선택지는 일어날 갈래(`askOutcomeOf`)의 표 효과.
 *    (인생 진행의 결과와 견주는 시험용. 갈래 판정 자체는 `tests/askResolve.test.ts`가 따로 본다.)
 *  - `expectedStat`: 점수를 매기는 전략(행복·관계·지식을 많이 올리는 길)용 — 조르기 갈래 선택지는 갈래 확률(`askBranchProbs`)로 가중한 기대값이다. 그 밖에는 `resolvedChoiceEffects`와 같다.
 * 이 파일을 거치지 않고 `choice.effects`를 풀 전체에 훑는 새 시험은 `tests/askStaticEffects.test.ts`가 허용 목록에 없으면 막는다.
 * 선택지를 고르기 전의 상태(`pending`이 있는 상태)를 받는다.
 */

export function resolvedChoiceEffects(state: GameState, ev: EventDef, choiceId: string): ResolvedEffects {
  const c = ev.choices?.find((x) => x.id === choiceId);
  if (c === undefined) throw new Error(`선택지가 없다: ${ev.id}/${choiceId}`);
  const ctx = condContextOf(state);
  if (isAskRollChoice(ev, choiceId)) return resolveEffects(askOutcomeOf(state, ev, choiceId as AskChoiceId).effects, undefined, ctx);
  return resolveEffects(c.effects, c.bonuses, ctx);
}

export function expectedStat(state: GameState, ev: EventDef, choiceId: string, key: StatKey): number {
  if (isAskRollChoice(ev, choiceId)) return askBranchProbs(state, ev, choiceId as AskChoiceId).reduce((n, { key: row, prob }) => n + prob * (ASK_EFFECTS[row].stats?.[key] ?? 0), 0);
  return resolvedChoiceEffects(state, ev, choiceId).stats[key] ?? 0;
}
