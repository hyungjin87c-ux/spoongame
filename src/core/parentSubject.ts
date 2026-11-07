import { familyScheduleOf, type FamilyGame, type FamilySchedule } from './familyView';

/**
 * 부모 결정 도장의 주어 — 「그 해에 함께 사는 부모」 (SPEC-011 DS1, `docs/data/ask-model.md` 10-1절 · SPEC 4절). **순수 함수**: 난수·`Date`가 없다.
 *
 * **계획(`familyScheduleOf`의 `firstGone`·`divorce`)과 나이만 읽는다. 지금 플래그(`parents_gone`·`mother_gone`·`mother_apart` 등)를 읽지 않는다.**
 * `familyViewOf`는 사별 사건이 켠 `parents_gone`을 입력으로 읽어서, 어른이 된 뒤 어린 시절 줄을 그리면 두 분 다 떠난 것으로 계산한다 — 엔딩 연표가 바로 그 경우다.
 * 그래서 도장·칩·안내의 주어는 이 함수가 정한다(문구는 `data/parentDecisionTable.ts#parentWording` 한 곳). 저장하지 않는 파생값이고 `HistoryEntry`·저장 스키마는 바뀌지 않는다(DS4) —
 * 옛 저장의 어린 시절 줄도 그 줄의 나이(`entry.age`)로 열자마자 바르게 그려진다.
 *
 * 경계: 별세·이혼이 난 해(`age == at`)는 두 분이 함께 있던 해이고 그다음 해(`age > at`)부터 한 분이다 — `familyViewOf`의 `age > firstGone.at`·`age > divorce.at`와 같다.
 * 0세 해 → 1세 해로 옮겨진 별세(R-634 (a))는 `parentGoneAtOf`가 이미 처리한 `at`을 `familyScheduleOf`가 준다.
 */

/** 그 해 함께 사는 부모: 두 분 · 어머니만 · 아버지만 · 없음. 「없음」은 구조상 도달하지 않는 방어 분기다(`firstGoneOf`가 먼저 떠나는 한 분만 모델이고 `divorcePlan`이 함께 살던 분이 19세 이하에 별세하면 이혼 계획을 없앤다 — INV-2c, R-558) */
export type CoParents = 'both' | 'mother' | 'father' | 'none';

/** 계획만으로 읽는 부분 — `familyScheduleOf` 없이도 합성 계획으로 시험할 수 있게 떼어 둔다 */
export type ParentPlan = Pick<FamilySchedule, 'firstGone' | 'divorce'>;

/** 계획과 나이로 그 해 함께 사는 부모를 정한다 (순수 — 어머니 = 0 · 아버지 = 1, `FamilySchedule`의 번호와 같다) */
export function coParentsAtPlan(plan: ParentPlan, age: number): CoParents {
  const out = (i: 0 | 1): boolean => (plan.firstGone !== null && plan.firstGone.who === i && age > plan.firstGone.at) || (plan.divorce !== null && plan.divorce.leaver === i && age > plan.divorce.at);
  const mother = !out(0);
  const father = !out(1);
  return mother && father ? 'both' : mother ? 'mother' : father ? 'father' : 'none';
}

/** `game`의 가족 계획에서 나이 `age`의 해 함께 사는 부모 (DS1). 출생 전 상태는 가족이 없어 `familyScheduleOf`처럼 던진다 */
export function coParentsOf(game: FamilyGame, age: number): CoParents {
  return coParentsAtPlan(familyScheduleOf(game), age);
}

/**
 * 같은 판에서 여러 나이를 읽을 때(인생 기록 줄·엔딩 연표) 계획을 한 번만 만든다. 출생 전 상태(캐릭터·출생신고서 없음)에는 가족이 없어 늘 `'both'`(기존 문구)를 돌려준다 —
 * 저장 검증이 인생·엔딩 단계에는 출생신고서를 요구하므로 실제 판에서는 닿지 않는 방어이고, 손으로 만든 상태를 그리는 화면 시험이 던지지 않게 한다.
 */
export function coParentsFn(game: FamilyGame): (age: number) => CoParents {
  if (game.character === null || game.birthReport === null) return () => 'both';
  const plan = familyScheduleOf(game);
  return (age) => coParentsAtPlan(plan, age);
}
