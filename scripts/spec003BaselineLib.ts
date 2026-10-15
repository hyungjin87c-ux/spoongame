import { STAGES, stageOfAge, type Era } from '../src/core';
import { isChoiceEvent } from '../src/core/events';
import { EVENT_POOL } from '../src/data/events';

/**
 * SPEC-003 M0 기준선(V1) 측정: 이벤트 수, 나이별 일어날 수 있는 이벤트 수, 나이별 인생 기록 줄 수, 영유아 사건 없는 해, 판당 선택지·시간.
 * 순수 계산 부분(테스트가 import한다). 실행 스크립트는 scripts/spec003Baseline.ts. 이벤트 수·0세와 7세의 이벤트 수는 tests/spec003Baseline.test.ts가 기준선 문서와 대조한다.
 */

/** 나이 age에서 시대 era에 일어날 수 있는 이벤트 수 (단계·ageRange·eras만 본다; 플래그·재력 같은 조건은 보지 않는다) */
export function possibleEventsAt(age: number, era: Era): number {
  let n = 0;
  for (const ev of EVENT_POOL.events) {
    if (!ev.stages.includes(stageOfAge(age))) continue;
    if (ev.ageRange?.min !== undefined && age < ev.ageRange.min) continue;
    if (ev.ageRange?.max !== undefined && age > ev.ageRange.max) continue;
    if (ev.eras && !ev.eras.includes(era)) continue;
    n++;
  }
  return n;
}

export function eventCounts(): { total: number; choice: number; narrative: number; byStage: Record<string, { total: number; choice: number; narrative: number }> } {
  const byStage: Record<string, { total: number; choice: number; narrative: number }> = {};
  for (const s of STAGES) byStage[s] = { total: 0, choice: 0, narrative: 0 };
  let choice = 0;
  for (const ev of EVENT_POOL.events) {
    const c = isChoiceEvent(ev);
    if (c) choice++;
    // 한 이벤트가 여러 단계에 걸치면 단계마다 센다
    for (const s of ev.stages) {
      byStage[s].total++;
      byStage[s][c ? 'choice' : 'narrative']++;
    }
  }
  return { total: EVENT_POOL.events.length, choice, narrative: EVENT_POOL.events.length - choice, byStage };
}

