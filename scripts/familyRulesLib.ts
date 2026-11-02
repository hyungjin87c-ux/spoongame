import { familyTables, withParentsGoneRule, withSiblingCountRule, type EarlyLossRule } from '../src/core';

/**
 * 가족 규칙 스위치 (SPEC-009 FM4b — 측정·시험 전용): 이른 부모 별세 효과(`design.earlyLoss.enabled`)를 `fn` 동안만 켜거나 끈다. 앱은 쓰지 않는다 — 켜진 채가 배포 값이다.
 * 효과가 켜진 세상과 꺼진 세상의 분포를 나란히 재거나(`scripts/familyRemeasure.ts`), 「기록 전용」 기준선(영유아 콘텐츠·20세 평균 스탯 가드)을 지킬 때 쓴다. 설치된 표의 값을 잠깐 바꿨다 되돌린다.
 */
export function withEarlyLoss<T>(enabled: boolean, fn: () => T): T {
  const rule = familyTables().design.earlyLoss.value;
  const before = rule.enabled;
  rule.enabled = enabled;
  try {
    return fn();
  } finally {
    rule.enabled = before;
  }
}

/** 이른 부모 별세 효과의 수치를 `fn` 동안만 바꾼다(측정 전용 — 효과 크기에 따른 영향을 나란히 재는 데 쓴다). 끝나면 원래 값으로 되돌린다 */
export function withEarlyLossRule<T>(patch: Partial<EarlyLossRule>, fn: () => T): T {
  const rule = familyTables().design.earlyLoss.value;
  const before = { ...rule };
  Object.assign(rule, patch);
  try {
    return fn();
  } finally {
    Object.assign(rule, before);
  }
}

/** 효과를 절반으로 줄인 수치 (측정용 대안: 행복 −4 · 관계 −1 · 건강 −1, 집안 살림 아버지 −250 · 어머니 −150 · 집안일 −75) */
export const EARLY_LOSS_HALF: Partial<EarlyLossRule> = {
  stats: { happiness: -4, relationships: -1, health: -1 },
  family: { father: -250, mother: -150, motherHomemaker: -75 },
};

/**
 * K1(형제 수 새 정의로 상속)과 R-562(「두 분 모두 떠남」을 가족 보기와 같게)를 **켜기 전의 옛 규칙**으로 `fn` 동안만 돌린다 — 해시 불변 L1 시험(변경 전 골든)과 재측정의 V0~V3 세계가 쓴다.
 * 앱은 쓰지 않는다 — 켜진 채가 배포 값이다 (FM6).
 */
export function withLegacyInheritance<T>(fn: () => T): T {
  return withSiblingCountRule('legacy', () => withParentsGoneRule('legacy', fn));
}
