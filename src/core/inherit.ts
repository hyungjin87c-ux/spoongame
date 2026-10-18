import { ECONOMY } from '../data/economyTable';
import { parentAgeAt } from './birthReport';
import { familyOf, parentStateOf } from './family';
import type { Dwelling, GameState } from './types';

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
 * 부모가 **이 해에 처음 모두** 떠났는가 — `before`(그 해를 시작할 때)에서 `after`(그 해 끝)로 넘어가며 둘 다 「gone」이 되었다. 자산이 있는(20세 이상) 상태에서만 본다.
 * 상속을 받는 해와 가족 집 주거가 월세로 바뀌는 해(`dwellingWhenParentsGone`)가 같은 판정을 쓴다.
 */
export function parentsJustGone(before: View, after: View): boolean {
  if (after.assets === null || after.character === null || after.birthReport === null) return false;
  return parentsAllGone(after) && !parentsAllGone(before);
}

/**
 * 부모가 모두 떠난 해 끝의 주거 (SPEC-003 M7e-3, 마스터 결정 추가②, docs/data/economy-model.md 4-2절): 가족 집(`family`)에 살고 있었다면 월세(`rent`)로 나온다 —
 * 부모가 모두 떠난 뒤에도 평생 가족 집(생활비 ×0.25)에 사는 모순을 없앤다. 다른 주거(월세·전세·자가·돌봄)는 그대로다. 상속(해 끝 규칙)을 더한 뒤에 판정하며 난수를 쓰지 않는다.
 *
 * **`moved_home`(70~90세 「자식 곁으로 옮긴다」, `senior-move-home/child`)이 켜진 판은 제외한다**(M7e-4, REV-003-M7e-1 R-378): 그 판의 가족 집(`family`)은 부모 집이 아니라 **자식 집**이라
 * 부모가 모두 떠나도 바뀌지 않는다 — 자식 집에 사는 노인을 월세로 내보내면 생활비가 갑자기 오르고 「자식이 사는 동네로 옮겼습니다」와도 어긋난다. 부모 집 주거는 `lives_with_parents`(또는 20세 기본 주거)로 정해진다.
 */
export function dwellingWhenParentsGone(dwelling: Dwelling, flags: readonly string[]): Dwelling {
  return dwelling === 'family' && !flags.includes('moved_home') ? 'rent' : dwelling;
}

/**
 * `before`(그 해를 시작할 때)에서 `after`(그 해 끝)로 넘어가며 부모가 처음 모두 떠났다면 이번에 받는 상속액(만 원), 아니면 0.
 * `after.assets`가 null이면(20세 미만) 0 — 자산이 없는 동안은 받을 곳이 없다. 20세 전에 떠난 판은 life.ts#finishYear가 독립(20세) 때 순자산에 한 번 더한다(familyFund에 더하지 않는다).
 */
export function inheritanceDue(before: View, after: View): number {
  if (!parentsJustGone(before, after) || after.character === null) return 0;
  const amount = inheritanceAmount(after.character.parentWealth, siblingCountOf(after));
  return amount > 0 ? amount : 0;
}
