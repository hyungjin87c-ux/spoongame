import { autoResolveStep, resolveChoiceStep, stepYear, type Chooser, type EventPool, type GameState } from '../../src/core';
import { EVENT_POOL } from '../../src/data/events';

/**
 * 인생을 끝까지(또는 `until`까지) 진행하며 **결정 카드가 뜨는 모든 순간**을 관찰한다 (SPEC-005부터의 시험 도우미).
 * 사람이 고르는 카드(`pending`)는 물론, 부모님이 정하거나 아이의 일로 흘러가는 카드(PD3 — `pending` 없이 그 해 안에서 해결된다)도 `onDecision`에 「고르기 직전의 대기 상태」로 넘긴다
 * (`stepYear`의 관찰 인자 — 읽기만 하고 인생을 바꾸지 않는다). 본인 카드는 `chooser`(없으면 자동 성향)로 고른다.
 * 예전에는 `s.pending`을 훑는 것만으로 모든 결정 카드를 봤다 — 20세 미만 카드의 일부는 이제 이 도우미로 본다.
 */
export function playDecisions(start: GameState, onDecision: (pending: GameState, by: 'self' | 'parent' | 'child') => void, opts: { pool?: EventPool; chooser?: Chooser | null; until?: (s: GameState) => boolean } = {}): GameState {
  const pool = opts.pool ?? EVENT_POOL;
  const chooser = opts.chooser ?? null;
  let s = start;
  for (let guard = 0; s.phase === 'life' && guard < 1000; guard++) {
    if (opts.until?.(s)) break;
    if (s.pending !== null) {
      onDecision(s, 'self');
      const picked = chooser === null ? null : chooser(s);
      s = picked === null ? autoResolveStep(s, s.pending.key, pool).state : resolveChoiceStep(s, s.pending.key, picked, pool).state;
      continue;
    }
    s = stepYear(s, pool, (e) => onDecision(e.state, e.by)).state;
  }
  return s;
}
