import type { ParentingStyle } from '../core/types';

/**
 * 어린 시절 부모님 결정 표 (SPEC-005 PD1·PD2·PD4, 설계 문서 docs/data/parent-decision-model.md — PD0 승인 2026-10-20 A1~A17·Q1~Q8).
 * 이 파일이 **분류표 한 곳**이다: 이벤트 id → 영역 표지·`childActUntil`. 설계 문서 5절의 「기계 판독 블록」과 행마다 같아야 하고(tests/parentDecisionDoc.test.ts, T1b),
 * 데이터(19세 미만에서 일어날 수 있는 선택지 이벤트 32장)와도 정확히 같아야 한다(tests/parentDecision.test.ts, T1 · scripts/validateEvents.ts — 새 선택지 이벤트를 분류 없이 추가하면 빌드가 실패한다).
 * 모든 수치 ▲는 기획자 설계값이다 — 공식 통계가 아니고 화면에 통계처럼 보이지 않는다. 값을 바꾸면 설계 문서와 dev 로그에 이유를 적는다(튜닝 사다리 A16).
 */

// ---------- 영역 표지와 분류표 (설계 문서 1-2·1-3절) ----------

/** 부모 영역: 돌봄·건강·돈·진학·이사·집안 — 집안의 어른이 정하는 일 */
export const PARENT_AREAS = ['care', 'health', 'money', 'school', 'move', 'home'] as const;
/** 본인 영역: 공부·친구·취미 — 13~18세에도 본인이 고르는 일 */
export const SELF_AREAS = ['study', 'friends', 'hobby'] as const;
/** 아이의 반응: 선택지 전부가 아이의 반응·목소리 — 나이와 무관하게 「이렇게 흘러갔습니다」 */
export const REACTION_AREA = 'reaction' as const;

export type ParentArea = (typeof PARENT_AREAS)[number];
export type SelfArea = (typeof SELF_AREAS)[number];
export type DecisionArea = ParentArea | SelfArea | typeof REACTION_AREA;

export const DECISION_AREAS: readonly DecisionArea[] = [...PARENT_AREAS, ...SELF_AREAS, REACTION_AREA];

export interface DecisionRow {
  /** 영역 표지(하나 이상) */
  areas: readonly DecisionArea[];
  /** 부록 A의 P*: 이 나이 이하에서는 선택지가 아이의 행동이라 「흘러감」, 그 위 나이는 영역 규칙. 없으면 undefined */
  childActUntil?: number;
}

/** 결정자 규칙의 나이 경계: 이 나이부터 본인 영역(공부·친구·취미)을 본인이 고른다 */
export const SELF_FROM_AGE = 13;
/** 19세부터는 모든 결정이 본인이다 (R1) */
export const ALL_SELF_FROM_AGE = 19;

const row = (areas: readonly DecisionArea[], childActUntil?: number): DecisionRow => (childActUntil === undefined ? { areas } : { areas, childActUntil });

/**
 * 32장 분류표 (설계 문서 1-3절). 키 순서는 문서의 기계 판독 블록과 같다.
 * 부모가 정하는 카드 24장 · 흘러감이 있는 카드 7장(`infant-new-sibling`·`infant-sibling-toy`·`school-family-priority` 전 구간 + 12세 이하 `school-friend`·`school-bully`·`school-friend-quarrel`·`school-teacher-notice`)
 * · 본인이 고르는 구간이 있는 카드 9장.
 */
export const PARENT_DECISION_TABLE: Readonly<Record<string, DecisionRow>> = {
  'infant-care': row(['care']),
  'infant-fever': row(['health']),
  'infant-stories': row(['care']),
  'infant-screen': row(['care']),
  'infant-new-sibling': row(['reaction']),
  'infant-meal-start': row(['care']),
  'infant-parental-leave': row(['care']),
  'infant-first-birthday': row(['care', 'money']),
  'infant-daycare-wait': row(['care']),
  'infant-noise': row(['move', 'care']),
  'infant-kindergarten': row(['school']),
  'infant-sibling-toy': row(['reaction']),
  'infant-hospital-stay': row(['health']),
  'infant-moving': row(['move']),
  'infant-early-lessons': row(['school', 'money']),
  'school-supplies': row(['money']),
  'school-after-hours': row(['care']),
  'school-friend': row(['friends'], 12),
  'school-puppy': row(['home']),
  'school-bully': row(['friends'], 12),
  'school-tutoring': row(['study', 'money']),
  'school-club': row(['hobby']),
  'school-friend-quarrel': row(['friends'], 12),
  'school-academy-night': row(['study', 'money']),
  'school-teacher-notice': row(['study'], 12),
  'school-family-priority': row(['reaction', 'school', 'money']),
  'school-early-work': row(['money', 'school']),
  'school-career-choice': row(['school']),
  'school-first-love': row(['friends']),
  'school-scholarship': row(['money', 'school']),
  'school-exam': row(['school', 'money']),
  'school-parttime': row(['money']),
};

// ---------- 줄 문구 상수 (설계 문서 3-1·3-4·3-5절) ----------

/** 부모 결정 줄·카드 도장 문구 (마스터 확정) */
export const PARENT_DECIDED_TEXT = '부모님이 이렇게 정했습니다';
/** 흘러감 줄·카드 도장 문구 (형진 님 답 M2) */
export const CHILD_FLOW_TEXT = '이렇게 흘러갔습니다';

/** 연표 줄·엔딩 연표의 「(…: 라벨)」 앞머리를 만든다 — 줄 형식 `{결과 문장} ({부모님이 이렇게 정했습니다|이렇게 흘러갔습니다}: {고른 길 라벨})`가 이 한 곳에서 나온다 (PD6). 본인이 고른 선택은 `DASH_TEXT.logChoicePrefix`(「선택: 」) */
export function decidedByText(by: 'parent' | 'child'): string {
  return by === 'parent' ? PARENT_DECIDED_TEXT : CHILD_FLOW_TEXT;
}

/** 카드 머리 칩 — 부모: 설계 문서 3-2절의 문구. 흘러감: 「아이의 일」 (designer 확정 — `docs/design/copy.md` 11-1 ①) */
export const PARENT_CHIP_TEXT = '부모님의 결정';
export const CHILD_CHIP_TEXT = '아이의 일';

/**
 * 판의 첫 부모 카드에만 더하는 안내 한 줄 (마스터 승인 Q6, 설계 문서 3-4절 · 문구는 designer 확정 — `docs/design/copy.md` 11-1 ②): 담담한 사실 문장, 평가·설교 없음.
 * 13이라는 경계는 `SELF_FROM_AGE`와 같아야 한다(tests/parentDecision.test.ts).
 */
export const FIRST_PARENT_HINT = '어린 시절의 큰 결정은 부모님이 내립니다. 열세 살부터는 공부·친구·취미를 직접 고릅니다.';

/** 엔딩 두 번째 줄 (설계 문서 3-5절 · 문구는 designer 확정 — `docs/design/copy.md` 11-1 ③, 숫자·조사 규칙 11-2). 둘 다 0이면 null(줄을 그리지 않는다) */
export function delegatedSummaryText(parent: number, child: number): string | null {
  if (parent > 0 && child > 0) return `어린 시절의 큰 결정 가운데 ${parent}번은 부모님이 내렸고, ${child}번은 아이의 일로 흘러갔습니다.`;
  if (parent > 0) return `어린 시절의 큰 결정 가운데 ${parent}번은 부모님이 내렸습니다.`;
  if (child > 0) return `어린 시절의 큰 결정 가운데 ${child}번은 아이의 일로 흘러갔습니다.`;
  return null;
}

// ---------- 부모 선택 확률 모델 (설계 문서 2절 — 승인 A3~A6) ----------

/** 부모 확률 모델의 점수 항 이름: 스탯 4개 + 돈(집안 살림) */
export type PriorityKey = 'education' | 'health' | 'happiness' | 'relationships' | 'wealth';

/**
 * 양육 방식 표 `PARENT_PRIORITY` ▲ [승인 A3] (학력/건강/행복/관계/돈). 현재 `AUTO_PRIORITY`가 출발점이고 부모는 아이의 학력·건강·집안 살림에 더 무게를 둔다.
 * 방향의 개념 근거(수치 아님): 요구(통제)와 반응(따뜻함) 두 축의 양육 방식 4분류 — 숫자는 설계값이고 연구 결과가 아니다. 서지는 원문 확인 전이라 화면·인용에 쓰지 않는다.
 */
export const PARENT_PRIORITY: Readonly<Record<ParentingStyle, Readonly<Record<PriorityKey, number>>>> = {
  strict: { education: 1.8, health: 1.2, happiness: 0.6, relationships: 0.7, wealth: 1.3 },
  free: { education: 1.0, health: 1.2, happiness: 1.4, relationships: 1.2, wealth: 1.0 },
  helicopter: { education: 1.7, health: 1.7, happiness: 0.9, relationships: 0.9, wealth: 1.1 },
  neglect: { education: 0.6, health: 0.6, happiness: 0.7, relationships: 0.5, wealth: 1.5 },
};

/**
 * 모델 상수 ▲ [승인 A4·A5]. 튜닝 사다리(A16): ε 0.10~0.20 · T_p 7~10은 재승인 없이 움직일 수 있고 dev 로그에 적는다.
 *  - epsilon: 관성·우연. 모든 보이는 선택지가 `epsilon / n` 이상의 확률을 갖는다.
 *  - temperature: 퍼짐 T_p (자동 모드 6보다 퍼져 부모는 최적화하지 않는다)
 *  - exponentLimit: exp()에 넣는 값의 절댓값 상한 (자동 선택의 AUTO_EXPONENT_LIMIT와 같은 40)
 *  - moneyPoint: 집안 살림(만 원)을 점수로 바꾸는 값 = AUTO_ASSET.familyPointMan 150
 *  - siblingStep/siblingMaxOrder: `siblingFactor(순서) = 1 + 0.08 × (min(순서, 5) − 1)` (첫째 1.00 … 다섯째 이상 1.32)
 *  - balanceRange/balanceDivisor: `balanceFactor(F) = 1 − clamp(F, ±1500) / 6000` (집안 살림 −1500이면 1.25, +1500이면 0.75)
 */
export const PARENT_MODEL = {
  epsilon: 0.15,
  temperature: 8,
  exponentLimit: 40,
  moneyPoint: 150,
  siblingStep: 0.08,
  siblingMaxOrder: 5,
  balanceRange: 1500,
  balanceDivisor: 6000,
} as const;

/** 20세 미만의 「돈 민감도」 기준: 옛 재산 스탯의 재력 단계별 출발값(8·22·45·70·92). `moneyNeed(수저) = 1 + (50 − 값) / 100` — 자동 선택과 같다. */
export const FAMILY_NEED_BASE = [8, 22, 45, 70, 92] as const;

/** 적합도 곱의 허용 범위 (설계 문서 2-5절) */
export const PARENT_FIT_RANGE = { min: 0.5, max: 4.0 } as const;

/**
 * 적합도 `PARENT_FIT` ▲ [승인 A6]: `이벤트id/선택지id` → 곱(기본 1.0 — 표에 없는 선택지). 예외 열거만 한다.
 *  - fever.dismiss 0.5: 수용 가능성(낙인 방지). 어느 형편에서도 아이의 건강을 외면하는 길은 드물게 — 가난한 집에서만 두드러져 「가난한 부모는 방임」으로 읽히는 것을 막는다.
 *  - 사교육 보정 상수(통계 보정, 지금 세상 참여율 52.8~84.9%를 맞추는 상수): tutoring academy·tutor 2.5, academy-night many·one — 승인 초기값은 2.0·2.5였으나 **구현 실측 뒤 1.3·1.3으로 조정**했다(아래).
 *  - 육아휴직 one·share: 승인 초기값 1.0 (측정 뒤 지금 세상 가구 단위 사용 비율이 57% 아래로 나오면 같은 곱 한 개 — 초기 1.3) → **실측 뒤 1.5**(아래).
 *
 * 구현 실측 조정 (튜닝 사다리 A16 — 보정 상수 1.0~4.0 안은 재승인 없이, ai-log/2026-10-20_SPEC-005_dev-QI5.md에 기록; `npm run report:parent -- --only=calibration`, 지금 세상 단계당 600판):
 *  ① academy-night 2.0/2.5 → 1.3/1.3: 승인값에서는 참여율이 76.4/75.1/77.9/78.3/79.5%로 거의 평평해 1단계가 공식(52.8%)보다 23.6%p 높았다(판정 ≤ 15%p 탈락). 1.0/1.0은 최대 차 17.9%p,
 *     1.0/1.5는 14.5%p, 1.3/1.3은 66.8/65.5/69.1/69.8/70.9%로 양 끝(1단계 +14.0 · 5단계 −14.0)이 같아 가장 여유 있다. T_p·ε는 승인값(8·0.15) 그대로.
 *  ② 육아휴직 1.0 → 1.5: 1.0에서는 수저 비율로 가중한 비율이 52.7%(어머니 72.2% ±15%p의 하한 57.2% 아래, 차 19.5%p)였고 1.3은 57.4%로 하한에 0.2%p 닿는 정도라 1.5(약 59.5%)로 여유를 뒀다.
 * 곱은 선택지의 효과를 바꾸지 않는다(영향 줄 = 실제 효과 불변). 화면에 나오지 않는다.
 */
export const PARENT_FIT: Readonly<Record<string, number>> = {
  'infant-fever/dismiss': 0.5,
  'school-tutoring/academy': 2.5,
  'school-tutoring/tutor': 2.5,
  'school-academy-night/many': 1.3,
  'school-academy-night/one': 1.3,
  'infant-parental-leave/one': 1.5,
  'infant-parental-leave/share': 1.5,
};

/** 한 선택지의 적합도 (표에 없으면 1.0) */
export function parentFitOf(eventId: string, choiceId: string): number {
  const v = PARENT_FIT[`${eventId}/${choiceId}`];
  return v === undefined ? 1 : v;
}

// ---------- 13~18세 본인 영역 가중 (PD13, 마스터 결정 Q2) ----------

/**
 * 13~18세에 본인이 고르는 카드(`deciderOf === 'self'`)의 이벤트 추첨 가중에 곱하는 값. 기본 1.0(그대로)이고, **13~18세 본인 카드가 0장인 판이 25%를 넘으면 올린다**(마스터 결정 Q2, 측정은 `npm run report:parent`의 `selfBefore19`). 「본인 카드 1장 보장」은 쓰지 않는다.
 * 지금 값 **2.0**: 설계 문서 7절의 승인 값은 ×1.5였으나 ×1.5로도 0장 비율이 26.6~30.9%라 25%에 못 미쳐 마스터가 ×2.0으로 올렸다(설계 문서 9절 3번, A16 범위 밖의 마스터 승인). 3000판 0장 비율: ×1.0 35~39% · ×1.5 27~30% · **×2.0 21~24%** · ×3.0 15~18%.
 * 값을 바꾸면 이벤트 추첨이 달라져 EK(경제·분포) 재측정이 따라온다.
 */
export const SELF_AREA_WEIGHT: number = 2;

// ---------- 시험이 쓰는 집계 (설계 문서 1-3절 「집계」) ----------

export const PARENT_TABLE_COUNTS = { parentCards: 24, childCards: 7, selfCards: 9, selfCards13to18: 6 } as const;
