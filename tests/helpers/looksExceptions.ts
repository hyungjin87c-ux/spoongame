/**
 * 설계 4B 「기존 사건 예외」 목록 (SPEC-018 PL16, persona-model.md 4B `[CX-002-004]`): 외모 표준 표(`LOOKW`)로 옮긴 연애·소개·재회 5곳과 외모 가중·소득 보너스를 뺀 사업 제안 2곳.
 * 골든 허용 차이(`eligibilityGolden.ts`의 `LOOKS_ALLOWED`)와 사건 텍스트 비교 시험이 같은 목록을 쓰도록 의존 없이 둔다.
 */
export const LOOKS_ROMANCE_EVENTS: readonly string[] = ['school-first-love', 'youth-meeting', 'youth-meeting-again', 'youth-matchmaker', 'youth-workplace-romance'];
export const LOOKS_BUSINESS_EVENTS: readonly string[] = ['youth-startup', 'middle-business'];
export const LOOKS_EXCEPTION_EVENTS: readonly string[] = [...LOOKS_ROMANCE_EVENTS, ...LOOKS_BUSINESS_EVENTS];
