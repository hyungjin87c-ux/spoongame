import { STAT_KEYS, type StatKey, type Stats } from './types';

/**
 * 스탯 범위 정책: 이 파일 한 곳에서만 정한다.
 * 모든 스탯은 STAT_MIN~STAT_MAX의 정수. 변화는 항상 clampStat을 거치고, 저장 검증(storage.ts)도 isValidStat을 쓴다.
 */
export const STAT_MIN = 0;
export const STAT_MAX = 100;

export function clampStat(n: number): number {
  if (!Number.isFinite(n)) throw new RangeError(`clampStat: 유한한 수가 아니다 (${n})`);
  return Math.min(STAT_MAX, Math.max(STAT_MIN, Math.round(n)));
}

/** 범위 안의 정수인가 (저장 검증용) */
export function isValidStat(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= STAT_MIN && v <= STAT_MAX;
}

export type StatDeltas = Partial<Record<StatKey, number>>;

/** 변화량을 더하고 범위로 자른 새 Stats를 돌려준다(원본은 건드리지 않는다). */
export function applyStatDeltas(stats: Stats, deltas: StatDeltas): Stats {
  const out = { ...stats };
  for (const key of STAT_KEYS) {
    const d = deltas[key];
    if (d !== undefined) out[key] = clampStat(out[key] + d);
  }
  return out;
}

/** 변화량 둘을 더한다(보너스 합산용). */
export function addDeltas(a: StatDeltas, b: StatDeltas): StatDeltas {
  const out: StatDeltas = { ...a };
  for (const key of STAT_KEYS) {
    const d = b[key];
    if (d !== undefined) out[key] = (out[key] ?? 0) + d;
  }
  return out;
}
