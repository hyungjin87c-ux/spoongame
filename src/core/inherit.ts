import { ECONOMY } from '../data/economyTable';
import { parentAgeAt } from './birthReport';
import { familyOf, parentStateOf } from './family';
import { livingSiblingCount } from './familyView';
import type { Dwelling, GameState } from './types';

/**
 * 간이 상속 (SPEC-003 M5, 마스터 결정 D10 변경 — docs/data/economy-model.md 15-4절, 위치는 r3 15-6절). **순수 함수**, 난수를 쓰지 않는다.
 * 부모가 모두 세상을 떠난 해(가족 상태가 처음 「gone」이 되는 해 — `parents_gone` 플래그 또는 부모 나이 상한, core/family.ts#parentStateOf와 같은 판정)에 한 번
 * `INHERIT[부모 재력 단계] ÷ (형제 수 + 1)`을 순자산에 더한다. **선택의 효과가 아니라 해 끝 규칙이다**(r3): 부모와 작별하는 장면의 선택지에 돈 표시가 앞서지 않도록 선택 적용
 * (apply.ts#applyResolved)과 영향 표기(previewChoice)에는 넣지 않고, life.ts#finishYear 한 곳이 — 원인이 사건이든 나이 상한이든 — 그 해 끝에 한 번 더한다.
 * 금액은 화면에 쓰지 않는다(설계값, S6) — 인생 기록에 한 줄만 남는다(data/lifeTable.ts#INHERIT_NOTE_TEXT).
 */

type View = Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed' | 'assets' | 'family'>;

/** 이 상태에서 부모가 모두 세상을 떠났는가 (둘 다 「gone」) */
export function parentsAllGone(game: Pick<GameState, 'age' | 'flags' | 'birthReport'>): boolean {
  const r = game.birthReport;
  if (r === null) return false;
  return (
    parentStateOf(parentAgeAt(r.mother, game.age), game.flags) === 'gone' && parentStateOf(parentAgeAt(r.father, game.age), game.flags) === 'gone'
  );
}

/**
 * 형제 수를 세는 규칙 (SPEC-009 K1):
 *  - `'legacy'` 출생 때 정해진 위 형제 + 「동생이 생겼다」 이후의 동생 한 명(core/family.ts#familyOf와 같은 계산) — **지금 판이 쓰는 규칙**이다.
 *  - `'view'` 새 정의 하나: 태어났고 떠나지 않은 위·아래 형제 전원(독립 여부 무관, `FamilyView.siblingCount.living`). 카드·한 줄·그림·대체 글이 읽는 값과 같다.
 * 새 정의로 바꾸면 아래 동생 구성(둘째 이상·여럿)이 상속 나누기에 들어가 경제 분포가 바뀐다. 구성이 사건·인생 기록과 맞춰지는 FM4b(K2)보다 먼저 켜면 「인생 기록에 없는 동생」이 상속을 나누게 되고
 * 경제 항등(`tests/economyIdentity`)과 해시 불변 L1이 깨지므로 FM4a는 `'legacy'`로 두고 `'view'`는 인자로만 부른다(측정·시험). 켜는 일은 FM4b의 재측정 뒤 마스터가 정한다.
 */
export type SiblingCountRule = 'legacy' | 'view';
export const SIBLING_COUNT_RULE: SiblingCountRule = 'legacy';

/** 지금 상속이 쓰는 규칙. 앱은 바꾸지 않는다 — 측정·시험(`scripts/familyRemeasure.ts`)이 `withSiblingCountRule`로 잠깐 바꿔 K1을 켠 판의 분포를 잰다 */
let activeRule: SiblingCountRule = SIBLING_COUNT_RULE;

/** 측정·시험 전용: `fn` 동안만 상속의 형제 수 규칙을 바꾼다(끝나면 되돌린다) */
export function withSiblingCountRule<T>(rule: SiblingCountRule, fn: () => T): T {
  const before = activeRule;
  activeRule = rule;
  try {
    return fn();
  } finally {
    activeRule = before;
  }
}

/** 형제 수 (상속 나누기 `÷ (형제 수 + 1)`에 쓰인다) */
export function siblingCountOf(game: View, rule: SiblingCountRule = activeRule): number {
  return rule === 'view' ? livingSiblingCount(game) : familyOf(game).siblings.length;
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
