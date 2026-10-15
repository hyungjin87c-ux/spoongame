import forbiddenJson from './forbiddenNames.json';

/**
 * 출생 시 쓰지 않는 "성+이름" 목록 (R-023). 정치적으로 민감한 실존 인물만 막는 소수 목록이다.
 * 범위·기준·갱신 방법은 forbiddenNames.json의 meta에 적혀 있다.
 */
export type ForbiddenGroup = 'president' | 'president-spouse' | 'north-korea-leader';

export interface ForbiddenName {
  /** 성+이름 전체 (예: 박정희) */
  name: string;
  group: ForbiddenGroup;
}

export const FORBIDDEN_NAMES: readonly ForbiddenName[] = Object.freeze(
  (forbiddenJson as unknown as { names: ForbiddenName[] }).names.map((n) => Object.freeze({ ...n })),
);

const FORBIDDEN_SET: ReadonlySet<string> = new Set(FORBIDDEN_NAMES.map((n) => n.name));

/** 성+이름 전체 문자열이 금지 목록과 정확히 같은가. 성이나 이름 하나만 같은 경우는 걸리지 않는다. */
export function isForbiddenFullName(fullName: string): boolean {
  return FORBIDDEN_SET.has(fullName);
}
