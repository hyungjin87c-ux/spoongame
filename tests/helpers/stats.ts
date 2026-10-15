/**
 * 분포 테스트용 허용오차 (R-015).
 *
 * 절대 허용오차(예: ±1.5%p)는 작은 범주(1%짜리 단계)에서 사실상 아무것도 검증하지 못한다.
 * 이항분포 표준편차 σ = sqrt(p(1-p)/n)의 k배(기본 4σ)를 쓰면 범주 크기에 맞게 조여지고,
 * 시드가 고정이라 한 번 통과하면 항상 같은 결과(flaky 아님)다.
 */

/** 비율(0~1) 단위 허용오차: k·sqrt(p(1-p)/n) */
export function sigmaTolerance(p: number, n: number, k = 4): number {
  return k * Math.sqrt((p * (1 - p)) / n);
}

/** %p 단위 허용오차. pPct는 0~100 */
export function sigmaTolerancePct(pPct: number, n: number, k = 4): number {
  return 100 * sigmaTolerance(pPct / 100, n, k);
}

/** 부동소수 오차(p=1 같은 경계에서 σ=0)를 흡수하는 아주 작은 여유 */
export const EPS = 1e-9;
