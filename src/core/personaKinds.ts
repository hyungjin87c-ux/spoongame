/**
 * 맞춤 인생의 이름 목록과 타입 (SPEC-018 PL1·PL2, `docs/data/persona-model.md` 1-1·2·6-2절). **id와 번호는 One-way** — 저장(`persona.w`·`persona.g`의 순서)과 해시 키가 이 순서에 묶여 있다.
 * 이 파일은 다른 core 모듈에 의존하지 않아(타입만) `events.ts`(조건 검증)와 `persona.ts`(갱신 계산)가 순환 없이 함께 읽는다.
 */

/** 기질 6종 (번호 = 순서): 0 호기심 많은 · 1 끈기 있는 · 2 지기 싫어하는 · 3 붙임성 좋은 · 4 조심스럽고 섬세한 · 5 느긋한 — 화면 이름은 designer가 정한다(`quiet`의 이름은 형진 님 지정) */
export const TEMPER_IDS = ['curious', 'steady', 'driven', 'warm', 'quiet', 'easy'] as const;
export type TemperId = (typeof TEMPER_IDS)[number];

/** 적성 5축 (번호 = 순서): 0 학업 · 1 예술 감각 · 2 운동 능력 · 3 손재주 · 4 사람 상대 */
export const APT_KEYS = ['study', 'art', 'sport', 'craft', 'people'] as const;
export type AptKey = (typeof APT_KEYS)[number];

/** 적성 단계: low(< 35) · mid(35~64) · high(≥ 65) — 사건·직업 조건은 단계만 읽는다(화면에는 숫자가 없다) */
export const APT_TIERS = ['low', 'mid', 'high'] as const;
export type AptTier = (typeof APT_TIERS)[number];

/** 활동 표지 `act` 8종 (선택지 필드 — 갱신 값은 코드 표 `ACT`·`ACTAPT` 한 곳) */
export const ACT_KINDS = ['sport', 'social', 'read', 'art', 'make', 'study', 'work', 'alone'] as const;
export type ActKind = (typeof ACT_KINDS)[number];

/** 본보기 어른 표지 `role` 5종 (번호는 해시 키 `70 + 번호`) */
export const ROLE_KINDS = ['teacher', 'relative', 'neighbor', 'coach', 'boss'] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export const isTemperId = (v: unknown): v is TemperId => (TEMPER_IDS as readonly unknown[]).includes(v);
export const isAptKey = (v: unknown): v is AptKey => (APT_KEYS as readonly unknown[]).includes(v);
export const isAptTier = (v: unknown): v is AptTier => (APT_TIERS as readonly unknown[]).includes(v);
export const isActKind = (v: unknown): v is ActKind => (ACT_KINDS as readonly unknown[]).includes(v);
export const isRoleKind = (v: unknown): v is RoleKind => (ROLE_KINDS as readonly unknown[]).includes(v);
