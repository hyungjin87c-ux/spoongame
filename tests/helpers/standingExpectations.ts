import { expectedLooksStanding } from './looksReference';

/**
 * 화면에 나와야 하는 "상위 약 N%" 표현의 기대값 (R-018). 구현의 함수를 쓰지 않고 사람이 직접 적은 표다.
 * vitest(tests/)와 Playwright(e2e/)가 함께 쓰므로 어떤 모듈도 import하지 않는다(looksReference 제외).
 *
 * 계산 근거(src/data/birthTable.ts 재력 가중치 %, 인덱스 0 = 1단계):
 *   past    [40, 32, 20,  7,  1]  1단계 하위 40 / 2단계 상위 60·하위 72(중앙에 걸침) / 3단계 상위 28 / 4단계 상위 8 / 5단계 상위 1
 *   present [25, 30, 28, 14,  3]  1단계 하위 25 / 2단계 상위 75·하위 55(중앙에 걸침) / 3단계 상위 45 / 4단계 상위 17 / 5단계 상위 3
 *   future  [30, 28, 24, 13,  5]  1단계 하위 30 / 2단계 상위 70·하위 58(중앙에 걸침) / 3단계 상위 42 / 4단계 상위 18 / 5단계 상위 5
 * 규칙: 상위(이상) 누적 <= 50 이면 "상위 약 N%", 아니면 하위(이하) 누적 <= 50 이면 "하위 약 N%", 둘 다 50 초과면 "딱 중간쯤".
 */
export const WEALTH_LABELS = {
  past: { 1: '하위 약 40%', 2: '딱 중간쯤', 3: '상위 약 28%', 4: '상위 약 8%', 5: '상위 약 1%' },
  present: { 1: '하위 약 25%', 2: '딱 중간쯤', 3: '상위 약 45%', 4: '상위 약 17%', 5: '상위 약 3%' },
  future: { 1: '하위 약 30%', 2: '딱 중간쯤', 3: '상위 약 42%', 4: '상위 약 18%', 5: '상위 약 5%' },
} as const;

/** 출생 화면의 집안 형편 순위 문장 */
export function expectedWealthSentence(era: keyof typeof WEALTH_LABELS, tier: 1 | 2 | 3 | 4 | 5): string {
  const label = WEALTH_LABELS[era][tier];
  return label === '딱 중간쯤'
    ? '우리나라 출생아 가운데 딱 중간쯤의 집안 형편이었다.'
    : `우리나라 출생아 중 ${label}의 집안 형편이었다.`;
}

/** 외모 순위 라벨: 정수 전수 열거(looksReference)로 결정한 표현을 문구로 옮긴 독립 기준값 */
export function expectedLooksLabel(looks: number): string {
  const s = expectedLooksStanding(looks);
  if (s.kind === 'middle') return '딱 중간쯤';
  const side = s.kind === 'top' ? '상위' : '하위';
  return s.within ? `${side} ${s.percent}% 안쪽` : `${side} 약 ${s.percent}%`;
}

export function expectedLooksSentence(looks: number): string {
  return `외모 ${looks}점 (${expectedLooksLabel(looks)}).`;
}
