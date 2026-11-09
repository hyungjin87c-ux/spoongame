import { createEventPool, type EventDef, type EventPool, type GameState, type ParentingStyle, type ParentWealth } from '../../src/core';
import { startLife } from '../../scripts/simulateLib';

/**
 * 조르기 카드가 **대기 중(`pending`)인 상태**를 직접 만든다 (SPEC-011 AK4~AK6 시험 도우미). 실제 사건 9개는 AK7이라 아직 없어 합성 사건(`tests/helpers/askEvents.ts`)으로 만든다.
 * 인생 진행이 만드는 대기 상태와 같은 모양이다: `pending`(보이는 선택지 셋) + `seen`·`lastChoiceAge`. 분류표에 없는 id라 `decisionFor`가 「본인」으로 읽는다(실제 사건은 영역 `ask` → R1a로 같은 결과).
 */
export interface AskMake {
  seed?: number;
  peerSeed?: number;
  parenting?: ParentingStyle;
  wealth?: ParentWealth;
  flags?: string[];
  age?: number;
}

export function askPendingState(ev: EventDef, { seed = 7, peerSeed = 12345, parenting = 'free', wealth = 3, flags = [], age = 6 }: AskMake = {}): GameState {
  const base = startLife(seed, 'alpha');
  return {
    ...base,
    age,
    flags,
    peerSeed,
    character: { ...base.character!, parenting, parentWealth: wealth },
    seen: { ...base.seen, [ev.id]: age },
    lastChoiceAge: age,
    pending: { eventId: ev.id, key: `${ev.id}@${age}`, age, choiceIds: ['beg', 'tantrum', 'endure'] },
  };
}

/** 사건 하나만 든 풀 — `resolveChoiceStep`·`autoChoiceWeights`가 `pool.byId`로 사건을 찾는다 */
export const askPoolOf = (...events: EventDef[]): EventPool => createEventPool(events);
