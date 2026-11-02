import { autoResolveStep, stepYear, type EventPool, type GameState, type ProfileId } from '../../src/core';
import { startLife } from '../../scripts/simulateLib';

/**
 * 가족 변화 시험의 도우미 (SPEC-009 FM4b): 한 판을 한 해씩 돌리며 **해가 끝난 상태**(대기 중인 선택지가 없는 때)를 모은다.
 * 선택은 자동 모드(성향)로 한다 — 시드 고정이라 같은 시드는 같은 인생이다.
 */
export interface Step {
  /** 이 걸음이 끝난 뒤의 상태 */
  state: GameState;
  /** 걸음을 시작할 때의 상태 */
  before: GameState;
}

/** 한 판을 끝까지 돌리며 걸음마다의 (전, 후) 상태를 돌려준다. 대기 중인 선택지는 자동 선택으로 풀어 한 해가 끝난 상태만 모은다 */
export function lifeSteps(seed: number, gen: ProfileId, pool?: EventPool): Step[] {
  let s: GameState = startLife(seed, gen);
  const out: Step[] = [];
  for (let guard = 0; s.phase === 'life' && guard < 400; guard++) {
    const before = s;
    let r = stepYear(s, pool);
    while (r.state.pending !== null) r = autoResolveStep(r.state, r.state.pending.key, pool);
    s = r.state;
    out.push({ before, state: s });
  }
  return out;
}

/** 판의 시드 열: 세대마다 다른 시드 */
export const seedsFor = (n: number, genIndex: number): number[] => Array.from({ length: n }, (_, i) => 1 + i * 41 + genIndex * 1_000_003);
