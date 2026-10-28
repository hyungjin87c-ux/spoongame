import type { FamilyView } from './familyModel';

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
 * 가족 보기에서 파생되는 시스템 플래그 집합 (INV-7). FM4a는 **보기에서 알 수 있는 것**만 낸다: 조부모(`has_grandparent`·`lives_with_grandparent`), 형제(`has_*_sibling`),
 * 부모 한 분 별세(`mother_gone`·`father_gone` — 두 분 모두 떠난 판은 `parents_gone`의 몫이라 켜지 않는다, INV-9), 이혼·별거(`*_apart`).
 * `mother_works`·`father_works`(부모 취업 상태, FM4b)·`sibling_loss_risk`(FM7)·`pet_farewell`(이별 로그, FM4b)은 아직 값이 없다.
 * 이 함수는 순수 계산이고 **상태에 쓰는 일은 FM4b의 `familyChangesFor`**가 한다 — 지금은 어떤 플래그도 판에 놓이지 않는다.
 */
export function deriveFamilyFlags(view: FamilyView): ReadonlySet<string> {
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
  return out;
}
