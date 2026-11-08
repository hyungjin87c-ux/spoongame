import type { Effects } from '../core/types';

/**
 * 어린 시절 조르기 표 (SPEC-011 AK2·AK3, 설계 문서 docs/data/ask-model.md — AK0 승인 2026-11-07 후속 204 AA1~AA14).
 * 이 파일이 **조르기 값의 한 곳**이다: 종류·들어주기 기본값 `BASE`·모델 계수·갈래별 효과 `ASK_EFFECTS`. 설계 문서 12절 끝의 「기계 판독 블록」(```ask-table)과 같아야 하고(tests/askDoc.test.ts),
 * 사건 데이터(`src/data/events/*.json`)에는 갈래별 효과를 쓰지 않는다(결정 AQ1 — `beg`·`tantrum`의 효과는 이 표가 정하고 `endure`만 데이터 `effects`가 표의 `endure` 행과 같아야 한다, eventLint).
 * 모든 수치 ▲는 기획자 설계값이다 — 공식 통계가 아니고 화면에 숫자로 나오지 않는다. 값을 바꾸면 설계 문서 11절 사다리 안에서만, dev 로그에 이유를 적는다.
 * 이 파일은 순수 상수만 가진다(난수·시각 없음). 효과를 적용하는 해결 경로(`askOutcomeOf`)는 AK4다.
 */

/** 조르기 종류: 장난감·게임기 · 예체능·배움 · 강아지 (학습 학원은 부모 결정 카드가 계속 맡는다 — 결정 Q3) */
export const ASK_KINDS = ['toy', 'lessons', 'pet'] as const;
export type AskKind = (typeof ASK_KINDS)[number];

/** 조르기 사건의 선택지 id — 이 순서, 항상 보인다(`requires` 없음) */
export const ASK_CHOICE_IDS = ['beg', 'tantrum', 'endure'] as const;
export type AskChoiceId = (typeof ASK_CHOICE_IDS)[number];

/** 결정자 표지의 영역 코드 — 분류표(`parentDecisionTable.ts`)의 영역 `ask`와 같은 글자 (R1a: 영역에 `ask`가 있으면 나이와 무관하게 본인) */
export const ASK_AREA = 'ask' as const;

/**
 * 종류별 해시 번호와 나이 한계. 번호는 **사건 번호가 아니라 종류 번호**다 — 한 판에 한 종류는 한 번이라 `(종류, 나이)`가 유일하고, 사건 id를 바꾸거나 시대 사건을 나눠도 같은 시드의 값이 그대로다.
 * 번호는 바꾸지 않는다(알려진 시드의 결과가 바뀐다 — `FAMILY_TAG`와 같은 취급, 저장 마이그레이션은 필요 없다).
 */
export const ASK_KIND_INFO: Readonly<Record<AskKind, { no: number; ageMin: number; ageMax: number }>> = {
  toy: { no: 1, ageMin: 4, ageMax: 12 },
  lessons: { no: 2, ageMin: 5, ageMax: 12 },
  pet: { no: 3, ageMin: 5, ageMax: 12 },
};

/**
 * 들어주기 기본값 `BASE` ▲ (재력 1~5단계). 설계 원칙: ① 재력에 단조 비감소 ② 같은 칸에서 장난감 ≥ 예체능 ≥ 강아지 ③ 3단계 장난감 0.65를 닻으로 한 단계 0.15
 * ④ 5단계−1단계 ≥ 0.30 ⑤ `C = 3`의 1단계 하한(낙인 방지): 장난감 0.30·예체능 0.20·강아지 0.10 이상. 통계 근거는 없다(전부 설계값).
 */
export const ASK_BASE: Readonly<Record<AskKind, readonly [number, number, number, number, number]>> = {
  toy: [0.35, 0.5, 0.65, 0.8, 0.9],
  lessons: [0.25, 0.4, 0.55, 0.7, 0.8],
  pet: [0.1, 0.2, 0.35, 0.5, 0.65],
};

/**
 * 모델 계수 ▲ (설계 문서 2-2·4-1절).
 *  - closeStep: 사이 한 단계당 들어줄 확률 변화 `0.06 × (C − 3)` (형편이 주, 사이가 보조)
 *  - tantrumBonus: 떼쓰기가 조르기보다 더하는 확률 `+0.10`
 *  - pMin/pMax: 어느 칸도 「확정 거절·확정 승낙」이 되지 않는 하한·상한
 *  - strainBase/strainStep/strainMin/strainMax: 떼쓰기가 거절당했을 때 사이가 나빠질 확률 `s(C) = clamp(0.50 + 0.10 × (3 − C), 0.20, 0.80)` (AK5가 쓴다)
 */
export const ASK_MODEL = {
  closeStep: 0.06,
  tantrumBonus: 0.1,
  pMin: 0.05,
  pMax: 0.95,
  strainBase: 0.5,
  strainStep: 0.1,
  strainMin: 0.2,
  strainMax: 0.8,
} as const;

/** 사이 `C`의 기준(평균 아닌 설계 기준점): `BASE`는 `C = 3` 기준이고, 함께 사는 부모가 없으면(방어 분기) `C = 3` */
export const ASK_CLOSENESS_BASE = 3;

/** 갈래 이름 — 설계 문서 3-1절 효과 표의 행 (`granted-*` 들어주기 3종 · `denied-beg`/`denied-tantrum` 거절 · `strained` 거절 + 사이 나빠짐 · `endure` 참는다) */
export type AskEffectKey = 'granted-toy' | 'granted-lessons' | 'granted-pet' | 'denied-beg' | 'denied-tantrum' | 'strained' | 'endure';

/**
 * 갈래별 효과 `ASK_EFFECTS` ▲ (설계 문서 3-1절 — 코드 상수 한 곳). 일반 선택지와 같은 효과 문법(`stats`·`family`·`setFlags`)이고 기존 검증(R-046)을 통과한다.
 * `pet_dog`는 「사건이 켜고 시스템이 끔」인 기존 이름(SPEC-009 K10)이고 이 갈래는 켜기만 한다. `parent_strained`(결정 K7 — 상태형, 배포 뒤 바꾸면 One-way)는 사건이 켜는 일반 플래그다.
 * `endure`만 사건 데이터의 `effects`로도 쓰이고(일반 선택지), 데이터의 값이 이 행과 같아야 한다.
 */
export const ASK_EFFECTS: Readonly<Record<AskEffectKey, Effects>> = {
  'granted-toy': { stats: { happiness: 3 }, family: -100 },
  'granted-lessons': { stats: { happiness: 1, education: 2 }, family: -300 },
  'granted-pet': { stats: { happiness: 4, health: 1 }, family: -150, setFlags: ['pet_dog'] },
  'denied-beg': { stats: { happiness: -2 } },
  'denied-tantrum': { stats: { happiness: -3 } },
  strained: { stats: { happiness: -3, relationships: -1 }, setFlags: ['parent_strained'] },
  endure: { stats: { happiness: -1 } },
};

/**
 * 사건 가중의 사다리 (설계 문서 11절 1번 — 재승인 없이 움직일 수 있는 범위): 장난감·예체능 25~70, 강아지 15~45. 승인 값은 45·40·30이다.
 * 범위 밖은 마스터 승인이고, 사건 데이터의 가중이 이 안에 있는지 eventLint가 점검한다.
 */
export const ASK_WEIGHT_LADDER: Readonly<Record<AskKind, { min: number; max: number }>> = {
  toy: { min: 25, max: 70 },
  lessons: { min: 25, max: 70 },
  pet: { min: 15, max: 45 },
};

export const isAskKind = (v: unknown): v is AskKind => (ASK_KINDS as readonly unknown[]).includes(v);
