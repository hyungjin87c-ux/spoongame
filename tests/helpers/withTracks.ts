import { validateEventFiles, type EventDef } from '../../src/core';

/**
 * 시험용 이벤트 묶음에 `track`(SPEC-004 MG2 — 이벤트 데이터의 필수 항목)을 채운다. 시험이 손으로 쓰는 작은 이벤트 풀은 연도 구간이 없는 공통 이벤트(`common`)로 충분하다.
 * 이미 `track`이 있으면 그대로 둔다. `validateEventFiles`가 `track` 없음을 잡는 시험(tests/events.test.ts)은 이 도우미를 쓰지 않고 날것으로 부른다.
 */
export function withTracks(files: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [file, raw] of Object.entries(files)) {
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { events?: unknown }).events)) {
      const events = (raw as { events: unknown[] }).events.map((e) => (typeof e === 'object' && e !== null && !('track' in e) ? { track: 'common', ...(e as object) } : e));
      out[file] = { ...(raw as object), events };
    } else out[file] = raw;
  }
  return out;
}

/** `validateEventFiles` + `withTracks` */
export function validateTrackedEventFiles(files: Readonly<Record<string, unknown>>): EventDef[] {
  return validateEventFiles(withTracks(files));
}
