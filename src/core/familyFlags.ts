import { LOG_PARENT_GONE, LOG_PARENTS_APART, type FamilyView } from './familyModel';

/**
 * 시스템이 소유하는 가족 플래그 어휘 (SPEC-009, 설계 문서 6절, K3·K10): `familyChangesFor`/`enterLife`가 쓰고 이벤트 `effects`는 쓰지 않는다 — FM4b가 `eventLint`에 쓰기 금지·읽기 허용 목록으로 건다.
 * `younger_sibling`(기존)은 사건과 시스템이 함께 쓰는 플래그라 이 목록에 없다. `pet_dog`·`pet_cat`·`pet_other`는 입양 사건이 켜고 시스템이 끈다(소유가 섞여 이 목록에 없다). 이름은 바꾸지 않는다.
 */
export const FAMILY_SYSTEM_FLAGS: readonly string[] = [
  'has_grandparent',
  'lives_with_grandparent',
  'has_older_sibling',
  'has_younger_sibling',
  'has_sibling',
  'mother_gone',
  'father_gone',
  'mother_apart',
  'father_apart',
  'mother_works',
  'father_works',
  'sibling_loss_risk',
  'pet_farewell',
];

/**
 * 가족 보기에서 파생되는 시스템 플래그 집합 (INV-7). 보기에서 알 수 있는 것을 낸다: 조부모(`has_grandparent`·`lives_with_grandparent`), 형제(`has_*_sibling`),
 * 부모 한 분 별세(`mother_gone`·`father_gone` — 두 분 모두 떠난 판은 `parents_gone`의 몫이라 보기만으로는 켜지 않는다, INV-9), 이혼·별거(`*_apart`).
 *
 * `log`(= `family.l`, 알린 변화)를 주면 **한 번 켜지면 안 꺼지는 플래그**(`mother_gone`·`father_gone`·`mother_apart`·`father_apart`)를 로그에서 잇는다 — 6-1절 「안 꺼짐」: 한 분이 먼저 떠난 뒤
 * 두 번째 분이 `parents_gone` 사건으로 떠나 보기가 「두 분 모두」가 되어도 먼저 떠난 분의 플래그는 남는다(INV-9: 켜진 해 ≤ `parents_gone`이 켜진 해). 로그가 없는 옛 저장 스냅샷(`lg`)의 지난 변화는 보기에서만 읽는다.
 * `mother_works`·`father_works`(부모 취업 상태 — FA2 집안일·은퇴 나이가 들어올 때)·`sibling_loss_risk`(FM7)·`pet_farewell`(반려동물 이별, 묶음 D)은 아직 값이 없어 내지 않는다.
 * 이 함수는 순수 계산이고 상태에 쓰는 일은 `familyTick.ts#familyChangesFor`가 한다(차이만 낸다).
 */
export function deriveFamilyFlags(view: FamilyView, log: ReadonlyArray<readonly number[]> = []): ReadonlySet<string> {
  const out = new Set<string>();
  const grands = view.people.filter((p) => p.role === 'grandparent');
  if (grands.some((p) => p.state !== 'gone')) out.add('has_grandparent');
  if (grands.some((p) => p.state === 'with')) out.add('lives_with_grandparent');
  if (view.siblingCount.older > 0) out.add('has_older_sibling');
  if (view.siblingCount.younger > 0) out.add('has_younger_sibling');
  if (view.siblingCount.living > 0) out.add('has_sibling');
  const mother = view.people.find((p) => p.id === 'mother');
  const father = view.people.find((p) => p.id === 'father');
  const motherGone = mother?.state === 'gone';
  const fatherGone = father?.state === 'gone';
  if (!view.parentsGone && motherGone !== fatherGone) out.add(motherGone ? 'mother_gone' : 'father_gone');
  if (mother?.state === 'apart' && mother.apartBy === 'split') out.add('mother_apart');
  if (father?.state === 'apart' && father.apartBy === 'split') out.add('father_apart');
  for (const [kind, , target] of log) {
    if (kind === LOG_PARENT_GONE) out.add(target === 1 ? 'mother_gone' : 'father_gone');
    else if (kind === LOG_PARENTS_APART) out.add(target === 1 ? 'mother_apart' : 'father_apart');
  }
  return out;
}
