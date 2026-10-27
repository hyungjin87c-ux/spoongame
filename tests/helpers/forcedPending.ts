import { calendarYear, condContextOf, inYearRange, possibleAgesOf, visibleChoices, type Era, type GameState, type ProfileId } from '../../src/core';
import { EVENT_POOL } from '../../src/data/events';
import { startLife } from '../../scripts/simulateLib';

/**
 * 이벤트 하나가 **대기 중(`pending`)인 상태를 직접 만든다** (SPEC-005부터의 시험 도우미).
 *
 * 어린 시절의 큰 결정 가운데 부모님이 정하거나 아이의 일로 흘러가는 카드(`deciderOf`)는 인생을 진행하는 동안 `pending`이 되지 않는다(그 해 안에서 즉시 해결, PD3).
 * 그런데 결정 카드의 **화면**(모달 시트·인용 박스·영향 줄 …)을 보는 시험은 그런 이벤트의 카드를 쓰던 것이 많다 — 시트가 보이는 모양은 누가 정하느냐와 상관이 없으므로, 그 이벤트가 일어날 수 있는 나이에
 * 시작 상태를 옮겨 대기 상태를 직접 만든다(저장 호환 PD10이 열자마자 처리하는 구 저장의 대기 상태와 같은 모양). 보이는 선택지가 2개 이상인 첫 시드를 쓴다.
 */
/** 옛 「시대」 이름으로 고르면 시도해 볼 세대 순서 (SPEC-004: 시대 3종이 세대 7종으로 바뀌어 판 상태에 시대가 없다). 이벤트의 연도 구간(`yearRange`)이 맞는 세대를 찾을 때까지 훑는다 */
const CANDIDATES: Record<Era, readonly ProfileId[]> = {
  past: ['genx', 'g86', 'boomer', 'industrial', 'millennial'],
  present: ['alpha', 'genz', 'millennial', 'genx'],
  future: ['alpha', 'genz', 'millennial'],
};

/** `era`에 세대(또는 시험 전용 R1 프로필)를 주면 그 세대로만, 옛 시대 이름('past'·'present'·'future')을 주면 이벤트가 그 나이에 일어날 수 있는 가까운 세대를 찾는다 */
export function forcedPending(eventId: string, era: Era | ProfileId = 'present', opts: { age?: number } = {}): GameState {
  const ev = EVENT_POOL.byId.get(eventId);
  if (ev === undefined) throw new Error(`${eventId}: 이벤트가 없다`);
  const ages = possibleAgesOf(ev);
  const age = opts.age ?? ages[Math.floor(ages.length / 2)];
  const profiles: readonly ProfileId[] = era === 'past' || era === 'present' || era === 'future' ? CANDIDATES[era] : [era];
  for (const profile of profiles) {
    for (let seed = 1; seed <= 400; seed++) {
      const base = startLife(seed, profile);
      if (!inYearRange(calendarYear(base.character!.birthYear, age), ev.yearRange)) continue; // 이 출생 연도의 이 나이에는 일어나지 않는 이벤트
      const s: GameState = { ...base, age, seen: { [eventId]: age }, lastChoiceAge: age };
      const visible = visibleChoices(ev, condContextOf(s));
      if (visible.length < 2) continue;
      return { ...s, pending: { eventId, key: `${eventId}@${age}`, age, choiceIds: visible.map((c) => c.id) } };
    }
  }
  throw new Error(`${eventId}: ${era}에서 보이는 선택지가 2개 이상인 시작 상태를 찾지 못했다`);
}
