import { AUTO_CHOICE_MS, HOLD_MS, JUMP_OVERHEAD_SEC, READ_SEC_PER_CHOICE } from '../data/timingTable';
import type { TickCounts, TickKind } from './life';
import type { Speed } from './types';

/** 시간 모델과 연출 시간 계산(순수 함수). 타이머 자체는 UI 계층에만 있다. */

/** 한 걸음을 보여 준 뒤 다음 해로 넘어가기까지의 대기(ms). 선택지·사망·진행 불가에는 타이머 대기가 없어 null. */
export function holdMsFor(kind: TickKind | null): number | null {
  switch (kind) {
    case 'narrative':
      return HOLD_MS.narrative;
    case 'resolved':
      return HOLD_MS.resolved;
    case 'choice':
    case 'death':
      return null;
    default:
      return HOLD_MS.quiet; // quiet, none, null(복원 직후)
  }
}

/** 실제 타이머 지연(ms) = 대기 / 배속 / 시간 배율(개발 서버 전용 탐침). 최소 0. */
export function holdDelayMs(kind: TickKind | null, speed: Speed, timeScale = 1): number | null {
  const base = holdMsFor(kind);
  if (base === null) return null;
  return Math.max(0, base / speed / timeScale);
}

/** 자동 모드가 선택지를 고르기까지의 지연(ms) */
export function autoChoiceDelayMs(speed: Speed, timeScale = 1): number {
  return Math.max(0, AUTO_CHOICE_MS / speed / timeScale);
}

export interface PlayMode {
  speed: Speed;
  /** "다음 결정으로"로 연출을 건너뛰는가 */
  skipToDecision: boolean;
}

/**
 * 한 판이 걸리는 시간 추정(초). readSec = 선택지 1개를 읽고 고르는 시간 가정(기본: 중앙 가정 READ_SEC_PER_CHOICE).
 *  - 건너뛰지 않으면: 각 걸음의 연출 대기 합 / 배속 + 선택지 수 × readSec (선택은 사람이 하는 시간이라 배속과 무관)
 *  - 다음 결정으로: 연출 없음. (선택지 수 + 마지막 사망까지의 이동 1회) × JUMP_OVERHEAD_SEC + 선택지 수 × readSec
 */
export function estimatePlaySeconds(counts: TickCounts, mode: PlayMode, readSec: number = READ_SEC_PER_CHOICE): number {
  const reading = counts.choice * readSec;
  if (mode.skipToDecision) return reading + (counts.choice + 1) * JUMP_OVERHEAD_SEC;
  const hold = counts.quiet * HOLD_MS.quiet + counts.narrative * HOLD_MS.narrative + counts.resolved * HOLD_MS.resolved;
  return hold / 1000 / mode.speed + reading;
}
