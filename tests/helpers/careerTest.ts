import { autoResolveStep, resolveChoiceStep, stepYear, type GameState, type ProfileId } from '../../src/core';
import { startLife } from '../../scripts/simulateLib';

/**
 * 진로 트랙(SPEC-018 3a단계) 시험 도우미. `PERSONA_ENABLED`는 꺼져 있어(출하 값) 켜서 돌리는 시험 파일은 맨 위에 `vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }))`를 둔다.
 */

/** 한 걸음: 대기가 있으면 `choose`(없으면 자동)로 고르고, 없으면 한 해 진행한다 */
export function stepWith(s: GameState, choose?: (s: GameState) => string | null): GameState {
  if (s.pending !== null) {
    const id = choose?.(s) ?? null;
    return (id === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, id)).state;
  }
  return stepYear(s).state;
}

/** 조건이 참이 될 때까지(또는 인생이 끝날 때까지) 진행한다 */
export function playUntil(s0: GameState, until: (s: GameState) => boolean, choose?: (s: GameState) => string | null, maxSteps = 600): GameState {
  let s = s0;
  for (let i = 0; i < maxSteps && s.phase === 'life' && !until(s); i++) s = stepWith(s, choose);
  return s;
}

export const isJobCard = (s: GameState, kind?: 'field' | 'detail'): boolean =>
  s.pending !== null && (kind === undefined ? s.pending.eventId.startsWith('job-pick-') : s.pending.eventId === `job-pick-${kind}`);

/** 시드에서 시작해 첫 진로 카드(분야 `field` / 세부 `detail`)가 대기 중인 상태까지 자동으로 진행한다 */
export function runToJobCard(seed: number, kind: 'field' | 'detail' = 'field', generation: ProfileId = 'millennial'): GameState {
  const s = playUntil(startLife(seed, generation), (x) => isJobCard(x, kind));
  if (!isJobCard(s, kind)) throw new Error(`seed ${seed}: ${kind} 카드가 뜨지 않았다`);
  return s;
}
