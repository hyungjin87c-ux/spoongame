import { ECONOMY } from '../data/economyTable';
import { parentAgeAt } from './birthReport';
import { familyOf, parentStateOf } from './family';
import type { GameState } from './types';

/**
 * 간이 상속 (SPEC-003 M5, 마스터 결정 D10 변경 — docs/data/economy-model.md 15-4절, 위치는 r3 15-6절). **순수 함수**, 난수를 쓰지 않는다.
 * 부모가 모두 세상을 떠난 해(가족 상태가 처음 「gone」이 되는 해 — `parents_gone` 플래그 또는 부모 나이 상한, core/family.ts#parentStateOf와 같은 판정)에 한 번
 * `INHERIT[부모 재력 단계] ÷ (형제 수 + 1)`을 순자산에 더한다. **선택의 효과가 아니라 해 끝 규칙이다**(r3): 부모와 작별하는 장면의 선택지에 돈 표시가 앞서지 않도록 선택 적용
 * (apply.ts#applyResolved)과 영향 표기(previewChoice)에는 넣지 않고, life.ts#finishYear 한 곳이 — 원인이 사건이든 나이 상한이든 — 그 해 끝에 한 번 더한다.
 * 금액은 화면에 쓰지 않는다(설계값, S6) — 인생 기록에 한 줄만 남는다(data/lifeTable.ts#INHERIT_NOTE_TEXT).
 */

type View = Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed' | 'assets'>;

/** 이 상태에서 부모가 모두 세상을 떠났는가 (둘 다 「gone」) */
export function parentsAllGone(game: Pick<GameState, 'age' | 'flags' | 'birthReport'>): boolean {
  const r = game.birthReport;
  if (r === null) return false;
  return (
    parentStateOf(parentAgeAt(r.mother, game.age), game.flags) === 'gone' && parentStateOf(parentAgeAt(r.father, game.age), game.flags) === 'gone'
  );
}

/** 형제 수 (출생 때 정해진 위 형제 + 「동생이 생겼다」 이후의 동생, core/family.ts#familyOf와 같은 계산) */
export function siblingCountOf(game: View): number {
  return familyOf(game).siblings.length;
}

/** 상속액(만 원, 정수): INHERIT[재력 단계] ÷ (형제 수 + 1) */
export function inheritanceAmount(tier: number, siblings: number): number {
  const base = ECONOMY.inherit[tier - 1] ?? 0;
  return Math.round(base / (siblings + 1));
}

/**
 * `before`(그 해를 시작할 때)에서 `after`(그 해 끝)로 넘어가며 부모가 처음 모두 떠났다면 이번에 받는 상속액(만 원), 아니면 0.
 * `after.assets`가 null이면(20세 미만) 0 — 자산이 없는 동안은 받을 곳이 없다. 20세 전에 떠난 판은 life.ts#finishYear가 독립(20세) 때 순자산에 한 번 더한다(familyFund에 더하지 않는다).
 */
export function inheritanceDue(before: View, after: View): number {
  if (after.assets === null || after.character === null || after.birthReport === null) return 0;
  if (!parentsAllGone(after) || parentsAllGone(before)) return 0;
  const amount = inheritanceAmount(after.character.parentWealth, siblingCountOf(after));
  return amount > 0 ? amount : 0;
}
