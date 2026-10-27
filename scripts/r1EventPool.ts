import { createEventPool, type EventDef, type EventPool } from '../src/core';
import infant from '../tests/fixtures/r1-event-pool/infant.json';
import middle from '../tests/fixtures/r1-event-pool/middle.json';
import school from '../tests/fixtures/r1-event-pool/school.json';
import senior from '../tests/fixtures/r1-event-pool/senior.json';
import youth from '../tests/fixtures/r1-event-pool/youth.json';

/**
 * 얼린 R1 이벤트 풀 「지금 세상」 (SPEC-004 EY17 ② — 「같은 시드·같은 **얼린 이벤트 풀**」): MG2 변환(eras → yearRange·track) **전**의 이벤트 JSON 5개 파일
 * (`tests/fixtures/r1-event-pool/`, 커밋 e1bc33f의 `src/data/events/`를 그대로 복사)에서 R1 「지금 세상」에 나오던 이벤트만 — `eras`가 없거나 `present`를 가진 것 — 골라 `eras` 표지를 지운 풀이다.
 * 시험 전용 R1 프로필(`r1-present`)의 시뮬레이션이 이 풀로 돌아야 변환 전의 R1 숫자(얼린 스냅숏)와 줄 단위로 같다. 이 풀은 앱·검증(validateEventFiles)을 거치지 않는다.
 */
type RawEvent = EventDef & { eras?: readonly string[] };
const FILES = [infant, middle, school, senior, youth] as unknown as ReadonlyArray<{ events: RawEvent[] }>;

let cache: EventPool | null = null;

export function r1EventPool(): EventPool {
  if (cache === null) {
    const events: EventDef[] = [];
    for (const f of FILES) {
      for (const ev of f.events) {
        if (ev.eras !== undefined && !ev.eras.includes('present')) continue;
        const { eras: _eras, ...rest } = ev;
        void _eras;
        events.push(rest as EventDef);
      }
    }
    cache = createEventPool(events);
  }
  return cache;
}
