import { createEventPool, validateEventFiles, visibleChoices, condContextOf, type EventPool, type GameState, type PersonaState, type ProfileId } from '../../src/core';
import { startLife } from '../../scripts/simulateLib';

/**
 * 맞춤 인생(SPEC-018 2단계) 시험 도우미. `PERSONA_ENABLED`는 기본이 꺼져 있어(2단계 — `src/data/personaSwitch.ts`) 켜서 돌리는 시험 파일은 맨 위에
 * `vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }))`를 둔다(이 도우미 안에서는 mock이 호이스팅되지 않는다).
 */

/** 시험용 사건 한 줄의 기본형: 학창기 선택지·서술 어느 쪽이든 필드를 덮어쓴다 */
export function ev(over: Record<string, unknown>): Record<string, unknown> {
  return { title: '시험 사건', text: '아이가 하루를 보냈습니다. 별일 없는 날이었습니다.', stages: ['school'], weight: 1, once: false, cooldown: 15, track: 'common', ...over };
}

/** 선택지 하나 */
export function ch(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, label: `${id}를 한다`, result: `${id}를 골랐습니다. 하루가 지났습니다.`, ...over };
}

/** 사건 목록 → 검증을 거친 풀 */
export function poolOf(events: unknown[]): EventPool {
  return createEventPool(validateEventFiles({ 'test.json': { events } }));
}

/** 시드에서 시작한 인생(0세)을 `age`살로 옮긴 상태 — 출생 기질·`peerSeed`는 그대로다 */
export function lifeAt(seed: number, age: number, generation: ProfileId = 'millennial'): GameState {
  const base = startLife(seed, generation);
  return { ...base, age };
}

/** 그 사건의 대기(pending)를 직접 만든다 — 보이는 선택지는 지금 상태에서 계산한다 */
export function withPending(s: GameState, pool: EventPool, eventId: string): GameState {
  const ev = pool.byId.get(eventId);
  if (ev === undefined) throw new Error(`${eventId}: 풀에 없다`);
  const ids = visibleChoices(ev, condContextOf(s)).map((c) => c.id);
  return { ...s, seen: { ...s.seen, [eventId]: s.age }, lastChoiceAge: s.age, pending: { eventId, key: `${eventId}@${s.age}`, age: s.age, choiceIds: ids } };
}

export const personaOf = (s: GameState): PersonaState => {
  if (s.persona === undefined) throw new Error('persona가 없다');
  return s.persona;
};
