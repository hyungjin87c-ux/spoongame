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

/** 외모 순위 라벨: 정수 전수 열거(looksReference)로 결정한 표현을 문구로 옮긴 독립 기준값 */
export function expectedLooksLabel(looks: number): string {
  const s = expectedLooksStanding(looks);
  if (s.kind === 'middle') return '딱 중간쯤';
  const side = s.kind === 'top' ? '상위' : '하위';
  return s.within ? `${side} ${s.percent}% 안쪽` : `${side} 약 ${s.percent}%`;
}

/** 수저 단계 이름(화면 표기). 「다이아몬드수저」는 요청 표기(RL4) */
export const SPOON_NAME = { 1: '흙수저', 2: '동수저', 3: '은수저', 4: '금수저', 5: '다이아몬드수저' } as const;

/**
 * 집안 형편 구간 문구 (출생신고 「흙수저(하위 25% 안쪽)」의 괄호 안, 룰렛 결과 줄 「흙수저(하위 25% 안쪽) · 서울」): 시대별 가중치 표에서 손으로 계산한 값이다
 * (tests/ending.test.ts의 BANDS와 같은 값 — 구현의 startBandOf·bandLabel을 거치지 않는 독립 기준).
 *   past    가중치 40·32·20·7·1  → 0~40 · 40~72 · 72~92 · 92~99 · 99~100
 *   present 가중치 25·30·28·14·3 → 0~25 · 25~55 · 55~83 · 83~97 · 97~100
 *   future  가중치 30·28·24·13·5 → 0~30 · 30~58 · 58~82 · 82~95 · 95~100
 */
export const WEALTH_BAND_LABELS = {
  past: { 1: '하위 40% 안쪽', 2: '하위 40%와 상위 28% 사이', 3: '상위 8~28% 사이', 4: '상위 1~8% 사이', 5: '상위 1% 안쪽' },
  present: { 1: '하위 25% 안쪽', 2: '하위 25%와 상위 45% 사이', 3: '상위 17~45% 사이', 4: '상위 3~17% 사이', 5: '상위 3% 안쪽' },
  future: { 1: '하위 30% 안쪽', 2: '하위 30%와 상위 42% 사이', 3: '상위 18~42% 사이', 4: '상위 5~18% 사이', 5: '상위 5% 안쪽' },
} as const;

/** 「흙수저(하위 25% 안쪽)」 형식의 기대 문구 */
export function expectedWealthLine(era: 'past' | 'present' | 'future', tier: 1 | 2 | 3 | 4 | 5): string {
  return `${SPOON_NAME[tier]}(${WEALTH_BAND_LABELS[era][tier]})`;
}
