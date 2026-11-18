import { createEventPool, type EventPool } from '../../src/core';
import { EVENT_POOL } from '../../src/data/events';

/**
 * SPEC-018 PL17-R(교제 카드 + 외모 반대 사례) **데이터 커밋 전과 같은 사건 풀**: 새 사건 넷(카드 3 · 서술 1)을 뺀 풀.
 * 맞춤 켠 판의 얼린 골든(`focusRng`·`gateTogether`·`familyGolden`)이 이 풀로 돈다 — 새 사건이 맞춤 판의 난수 경로를 바꾸므로 골든을 다시 만들지 않고 풀을 고정해 그것들이 보호하던 요구
 * (초점 끔 = 초점 전 · G2 불변 · 가족 생성)를 그대로 잠근다(마스터 판단, 2026-11-18). 새 사건 쪽 계약은 `romanceMeans.test.ts`가 본다.
 */
export const PL17R_EVENT_IDS: readonly string[] = ['youth-date-budget', 'youth-two-news', 'youth-late-word', 'youth-hobby-circle'];

let cached: EventPool | null = null;
export function preRomancePool(): EventPool {
  if (cached === null) cached = createEventPool(EVENT_POOL.events.filter((e) => !PL17R_EVENT_IDS.includes(e.id)));
  return cached;
}
