import { autoResolveStep, eventPool, focusChoicesOf, focusSectionOf, stepYear, type FocusId, type GameState, type ProfileId } from '../../src/core';
import { startLife } from '../../scripts/simulateLib';

/** 올해의 초점 시험용 상태 만들기 — 자동 선택으로 `age`세가 되는 첫 걸음 직전(대기 없음)의 인생 상태 */
export function lifeStateAt(seed: number, era: ProfileId, age: number): GameState {
  const pool = eventPool();
  let s = startLife(seed, era);
  for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
    if (s.pending === null && s.age >= age) return s;
    s = s.pending !== null ? autoResolveStep(s, s.pending.key, pool).state : stepYear(s, pool).state;
  }
  return s;
}

/** `age`세 이후 처음으로 선택 카드가 열려 대기 중인 상태 (없으면 null) */
export function pendingStateFrom(seed: number, era: ProfileId, age: number): GameState | null {
  const pool = eventPool();
  let s = lifeStateAt(seed, era, age);
  for (let guard = 0; guard < 60 && s.phase === 'life'; guard++) {
    const r = stepYear(s, pool);
    if (r.state.pending !== null) return r.state;
    s = r.state;
  }
  return null;
}

/** 그 상태의 구간에서 고를 수 있는 초점 */
export function listOf(s: GameState): readonly FocusId[] {
  const sec = focusSectionOf(s.age);
  return sec === null || s.character === null ? [] : focusChoicesOf(s.character.birthYear, sec);
}
