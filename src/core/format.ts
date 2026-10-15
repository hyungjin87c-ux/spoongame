/** 화면에 쓰는 숫자 표기 (순수 함수, 로캘에 기대지 않는다). 통계 값의 공식 표기(자릿수·단위)는 data/koreaStatsAccess.ts의 formatNumber·formatWithUnit이 맡는다. */

/** 천 단위 쉼표: 51284 → "51,284" (반올림한 정수로) */
export function formatCount(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
