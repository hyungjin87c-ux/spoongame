import type { Era, ParentingStyle } from '../core/types';

/**
 * 시대별 출생 분포·계수 표. 게임 설계값(통계가 아님)이며 코드가 아니라 이 표만 고치면 된다.
 * 테스트와 출생 결과 화면의 "상위 몇 %"는 모두 이 표에서 계산한다.
 */
export interface EraConfig {
  /** 시대 선택 화면 이름 */
  label: string;
  /** 시대 선택 화면 한 줄 설명 */
  blurb: string;
  /**
   * 출생 연도 범위(양 끝 포함). SPEC-001 '시대 선택': 지난 1950~1989 / 지금 2008~2025 / 다가올 2030~2060.
   * 이름 풀, 저장 검증(storage.ts), 시대 선택 화면이 모두 이 표를 따른다. 범위를 바꾸면 이름 풀(names.json,
   * 원자료) 범위와 어긋나지 않는지 tests/names.test.ts가 확인한다.
   */
  birthYears: { min: number; max: number };
  /** 부모 재력 1~5단계 출생 비율(%) 합계 100. 인덱스 0 = 1단계. */
  wealthWeights: readonly [number, number, number, number, number];
  /** 교육방식 비율(%) 합계 100 */
  parentingWeights: Record<ParentingStyle, number>;
  /**
   * 물가 계수. 노년기 생활비로 재산이 줄어드는 속도에 쓰인다(data/lifeTable.ts#SENIOR_WEALTH_DRAIN_BASE).
   * 숫자가 클수록 생활비가 많이 든다. 재산 스탯은 0~100의 상대값이라 이벤트의 재산 변화량은 시대별로 따로 곱하지 않는다.
   */
  priceIndex: number;
  /** 인생 진행 계수 (M3). 특정 달력 연도가 아니라 이 계수와 이벤트 풀로만 시대 차이를 만든다. */
  life: {
    /** 연간 사망 확률에 곱하는 계수 (1 = 기준) */
    mortalityScale: number;
    /** 절대 상한 나이: 이 나이가 되면 건강과 무관하게 한 해를 못 넘긴다 */
    maxAge: number;
  };
}

export const ERA_CONFIG: Record<Era, EraConfig> = {
  past: {
    label: '지난 세상',
    blurb: '모두가 가난했고, 모두가 바빴던 시절',
    birthYears: { min: 1950, max: 1989 },
    wealthWeights: [40, 32, 20, 7, 1],
    parentingWeights: { neglect: 25, free: 10, helicopter: 10, strict: 55 },
    priceIndex: 0.3,
    life: { mortalityScale: 1.8, maxAge: 100 },
  },
  present: {
    label: '지금 세상',
    blurb: '우리가 지금 살고 있는 시간',
    birthYears: { min: 2008, max: 2025 },
    wealthWeights: [25, 30, 28, 14, 3],
    parentingWeights: { neglect: 15, free: 30, helicopter: 30, strict: 25 },
    priceIndex: 1,
    life: { mortalityScale: 1, maxAge: 105 },
  },
  future: {
    label: '다가올 세상',
    blurb: '아직 오지 않은 시간. 격차는 더 벌어졌다고들 합니다',
    birthYears: { min: 2030, max: 2060 },
    wealthWeights: [30, 28, 24, 13, 5],
    parentingWeights: { neglect: 10, free: 35, helicopter: 30, strict: 25 },
    priceIndex: 1.6,
    life: { mortalityScale: 0.75, maxAge: 110 },
  },
};
