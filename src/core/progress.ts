/**
 * 올해 진행률 (SPEC-003 DB2): 대시보드 헤더의 바는 그 해의 연출 시간 동안 0 → 100%로 차오르고, 100%가 되면 나이가 +1 된다.
 * 순수 함수라 React·타이머 없이 단위 테스트한다(tests/progress.test.ts). 시계(requestAnimationFrame·타이머)는 UI 계층의 ui/useYearClock.ts가 돌린다.
 *
 * 연출 시간은 core/timing.ts#holdDelayMs(걸음의 종류 / 배속 / 시간 배율)가 정한다. 선택지 대기·사망처럼 연출 시간이 없는 상태(null)에서는 바가 **멈춘 채 가득 차 있다** —
 * 바로 앞 연출이 100%까지 찬 뒤에 선택지가 떴거나(플레이 중), 선택지가 뜬 채 열렸을 때(새로고침 복원)도 한 해가 끝나는 지점에서 기다리는 모습이 같기 때문이다.
 */

/** 경과 시간(ms)과 연출 시간(ms)으로 진행률 0~1. 연출 시간이 없으면(null) 가득 찬 1, 0 이하이거나 유한하지 않으면 1(0으로 나누지 않는다). 경과가 음수면 0. */
export function yearProgress(elapsedMs: number, durationMs: number | null): number {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / durationMs);
}

/**
 * 진행률을 시간이 흐른 만큼 올린다(dtMs 경과). 연출 시간은 호출 시점의 값을 쓴다 — 한 해 도중에 배속이 바뀌어도 진행률(비율)은 그대로 이어지고 남은 비율만 새 속도로 채워진다
 * (바가 되감기거나 건너뛰지 않는다). 시간은 거꾸로 가지 않는다(dt < 0은 0으로 본다). 결과는 0~1.
 */
export function advanceFraction(fraction: number, dtMs: number, durationMs: number | null): number {
  const base = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return base;
  return Math.min(1, base + dtMs / durationMs);
}

/** 표시용 정수 퍼센트 0~100 (내림: 가득 차기 전에는 100이 되지 않는다 — 100은 나이가 오르는 순간뿐이다) */
export function percentOf(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(100, Math.max(0, Math.floor(fraction * 100 + 1e-9)));
}
