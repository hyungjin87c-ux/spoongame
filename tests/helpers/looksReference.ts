/**
 * 외모 분포의 독립 기준값 (R-017). src/core/birth.ts의 합성곱 구현을 쓰지 않고
 * "0~100 정수 균등 3개의 합을 3으로 나눈 몫"을 101^3 = 1,030,301가지 전수 열거해 센다.
 * vitest(tests/)와 Playwright(e2e/)가 함께 쓰므로 어떤 모듈도 import하지 않는다.
 */

export const LOOKS_COMBINATIONS = 101 ** 3;

let counts: number[] | null = null;

/** 점수 0~100별 경우의 수 */
export function looksCounts(): readonly number[] {
  if (!counts) {
    const c = new Array<number>(101).fill(0);
    for (let a = 0; a <= 100; a++) {
      for (let b = 0; b <= 100; b++) {
        for (let d = 0; d <= 100; d++) c[Math.floor((a + b + d) / 3)]++;
      }
    }
    counts = c;
  }
  return counts;
}

/** 이 점수 이상인 경우의 수 */
export function looksTailCount(looks: number): number {
  const c = looksCounts();
  let sum = 0;
  for (let i = Math.max(0, Math.ceil(looks)); i <= 100; i++) sum += c[i];
  return sum;
}

/** 이 점수 이상일 정확한 확률(%) — 반올림·보정 전 */
export function exactTopPercent(looks: number): number {
  return (looksTailCount(looks) / LOOKS_COMBINATIONS) * 100;
}

/** 화면에 표시되어야 하는 "상위 약 N%": 정수로 반올림, 1~100으로 보정 */
export function expectedTopPercent(looks: number): number {
  return Math.min(100, Math.max(1, Math.round(exactTopPercent(looks))));
}

/** 이 점수 이하인 경우의 수 */
export function looksHeadCount(looks: number): number {
  const c = looksCounts();
  let sum = 0;
  for (let i = 0; i <= Math.min(100, Math.floor(looks)); i++) sum += c[i];
  return sum;
}

export type ExpectedStanding = { kind: 'top' | 'bottom'; percent: number; within: boolean } | { kind: 'middle' };

/**
 * R-018 규칙의 독립 기준값. 정수 경우의 수(전수 열거)로만 판정하므로 core의 부동소수 꼬리 합과 무관하다.
 * 이상인 경우의 수가 절반 이하면 top, 이하인 경우의 수가 절반 이하면 bottom, 둘 다 절반을 넘으면 middle.
 * 비율이 1% 미만이면 "N% 안쪽"(percent 1, within), 아니면 반올림한 정수.
 * (경우의 수 k에 대해 k/101^3*100이 정확히 x.5이거나 1일 수 없다 — 101^3은 홀수이고 100으로 나누어떨어지지 않는다.)
 */
export function expectedLooksStanding(looks: number): ExpectedStanding {
  const top = looksTailCount(looks);
  const bottom = looksHeadCount(looks);
  const ranked = (kind: 'top' | 'bottom', count: number): ExpectedStanding => {
    const share = (count / LOOKS_COMBINATIONS) * 100;
    return share < 1 ? { kind, percent: 1, within: true } : { kind, percent: Math.round(share), within: false };
  };
  if (top * 2 <= LOOKS_COMBINATIONS) return ranked('top', top);
  if (bottom * 2 <= LOOKS_COMBINATIONS) return ranked('bottom', bottom);
  return { kind: 'middle' };
}
