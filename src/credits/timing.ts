/**
 * 「이 삶의 이름들」의 길이·자동 흐름 판정·시간표 (SPEC-022 EC1 7항) — 모두 **순수 함수**다(React·타이머·Date 없음).
 *  - `N`: 줄 모델의 줄 문자열을 줄바꿈 없이 이어 붙인 것의 Unicode 코드 포인트 수(`[...lines.join('')].length` — UTF-16 길이나 DOM `textContent`로 세지 않는다).
 *  - `D_read = max(18, ceil(8 + N/7))`초. 초당 7자는 확인되지 않은 가설이며 v0.6.1 플레이테스트에서 조정한다.
 *  - 자동 흐름: 처음 4초·마지막 4초 정지, 가운데 `D_read − 8`초 동안 선형 이동(가속·페이드 없음).
 */

/** 초당 읽는 글자 수(가설 ▲) */
export const READ_CHARS_PER_SECOND = 7;
/** 처음·마지막 정지(초) */
export const HOLD_SECONDS = 4;
/** `D_read`의 하한(초) */
export const MIN_READ_SECONDS = 18;
/** 이보다 길면 정지 목록으로 시작한다(초) */
export const MAX_AUTO_SECONDS = 90;
/** 이동 속도 상한(CSS px/s) */
export const MAX_SPEED_PX = 36;
/** 명단 상한 — 넘으면 정지 목록 */
export const MAX_AUTO_PEOPLE = 21;
/** 글자 확대로 보는 루트 글자 크기(px) — 기준 16px의 150% */
export const LARGE_ROOT_PX = 24;

/** 줄 문자열을 줄바꿈 없이 이어 붙인 것의 코드 포인트 수 */
export function creditsLength(lines: readonly string[]): number {
  return [...lines.join('')].length;
}

/** 읽는 시간(초) */
export function readSeconds(n: number): number {
  return Math.max(MIN_READ_SECONDS, Math.ceil(8 + n / READ_CHARS_PER_SECOND));
}

export type ListReason = 'long' | 'people' | 'fast' | 'reduced' | 'large' | 'short';

export interface PlanInput {
  /** 줄 모델의 N */
  n: number;
  /** 명단 사람 수 */
  people: number;
  /** 진입 시 스크롤 영역의 scrollHeight − clientHeight (px) */
  distance: number;
  /** 움직임 줄이기(OS 설정 또는 `data-motion=reduce`) */
  reduced: boolean;
  /** 루트 글자 크기(px) */
  rootPx: number;
}

export type Plan = { mode: 'auto'; readSec: number } | { mode: 'list'; readSec: number; reason: ListReason };

/** 자동 흐름으로 열지 정지 목록으로 열지 — 정지 목록으로 시작하는 여섯 경우(EC1 7항). 글·사람을 자르거나 빨리 흘려 맞추지 않는다 */
export function planOf(i: PlanInput): Plan {
  const readSec = readSeconds(i.n);
  const list = (reason: ListReason): Plan => ({ mode: 'list', readSec, reason });
  if (readSec > MAX_AUTO_SECONDS) return list('long');
  if (i.people > MAX_AUTO_PEOPLE) return list('people');
  if (i.reduced) return list('reduced');
  if (i.rootPx >= LARGE_ROOT_PX) return list('large');
  if (!(i.distance > 0)) return list('short');
  if (i.distance / (readSec - 2 * HOLD_SECONDS) > MAX_SPEED_PX) return list('fast');
  return { mode: 'auto', readSec };
}

/** 시간(초) → 스크롤 위치(0~distance): 0~4초 처음 위치, 이후 선형, 마지막 4초 끝 위치 */
export function positionAt(elapsedSec: number, readSec: number, distance: number): number {
  const span = readSec - 2 * HOLD_SECONDS;
  if (elapsedSec <= HOLD_SECONDS || span <= 0) return 0;
  if (elapsedSec >= HOLD_SECONDS + span) return distance;
  return ((elapsedSec - HOLD_SECONDS) / span) * distance;
}

/** 위치 → 시간: 「이어 보기」가 멈춘 자리에서 남은 거리를 같은 속도로 잇는 기준(멈춘 위치가 정지 구간이면 그 구간의 끝 쪽) */
export function elapsedAt(position: number, readSec: number, distance: number): number {
  const span = readSec - 2 * HOLD_SECONDS;
  if (distance <= 0 || span <= 0) return HOLD_SECONDS;
  const ratio = Math.min(1, Math.max(0, position / distance));
  return HOLD_SECONDS + ratio * span;
}
