/**
 * 캐러셀 슬라이드 표기 형식표와 금지 패턴 (SPEC-003 QM2-4 완료 기준 a·b, QM2-11). 단위 테스트(tests/carousel.test.ts — 모델)와 화면 e2e(e2e/slide-text.spec.ts — 실제 DOM)가
 * **같은 표·같은 패턴**을 쓰도록 한 곳에 둔다(둘이 어긋나 한쪽만 통과하는 일이 없게). import가 없어 Playwright와 vitest가 모두 읽는다.
 */

/**
 * 14장 전부 이 넷 중 하나 (QM2-4 형식표): A 단순 · B 분모 있는 비율 · C 값 둘 · D 그래프(전국 값 + 범위 문구). 새 지표가 생기면 여기에 형식을 정해야 테스트가 통과한다.
 * SPEC-005 이후: 기준 연도·범위는 모든 형식에서 공식 통계명 줄이 말하고 기준 줄(분모)은 B형에만 있다.
 */
export type SlideForm = 'A' | 'B' | 'C' | 'D';

export const SLIDE_FORMS: Readonly<Record<string, SlideForm>> = {
  tfr: 'A',
  births: 'A',
  cdr: 'B',
  'elderly-poverty': 'A',
  'suicide-rate': 'B',
  'region-population-registered': 'D',
  'life-expectancy': 'A',
  'single-household': 'A',
  'first-marriage-age': 'C',
  'marriage-count': 'A',
  'youth-employment': 'A',
  'private-education': 'A',
  'aging-rate': 'A',
  'tfr-by-sido': 'D',
};

/** 금지 패턴 (QM2-4 완료 기준 a): 분모 바로 뒤에 단위만 따로 옴(「명당 명」)·같은 단위 연속 */
export const FORBIDDEN_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['분모 바로 뒤에 단위만 따로 옴(「명당 명」)', /당 (명|건|세|년|%)(?![가-힣])/],
  ['같은 단위 연속', /(명|건|세|년|%) ?\1(?![가-힣])/],
];

export function forbiddenIn(text: string): string[] {
  return FORBIDDEN_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** 값 줄 바로 옆 칸의 단위 낱말 하나 */
export const UNIT_WORD = /^(명|%|세|년|건|원|천 명|만 원)$/;

/** 값 줄 한 줄의 모양: 숫자 + 단위 낱말 (「240,326건」「27.8명」「36.6%」) */
export const VALUE_LINE = /^[\d,.]+(명|%|세|년|건|원|천 명|만 원)$/;

/**
 * 분모 있는 비율(B형)의 기준 줄 — 분모만 남는다 (SPEC-005 copy.md 9-2): 연도는 공식 통계명 줄(「자살률(2025년)」)로 옮겼고 기준 줄은 값 줄의 뜻(「인구 10만 명당」)만 말한다.
 * (SPEC-003 QM2-4의 「인구 10만 명당 · 2025년 기준」 한 줄·두 줄 형식은 없어졌다 — 쌍이 아니라 줄바꿈 형식도 하나다)
 */
export const BASIS_B = /^인구 (1천|10만) 명당$/;
