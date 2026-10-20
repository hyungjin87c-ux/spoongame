import { condContextOf, possibleAgesOf, visibleChoices, type Era, type GameState } from '../../src/core';
import { EVENT_POOL } from '../../src/data/events';
import { startLife } from '../../scripts/simulateLib';

/**
 * 이벤트 하나가 **대기 중(`pending`)인 상태를 직접 만든다** (SPEC-005부터의 시험 도우미).
 *
 * 어린 시절의 큰 결정 가운데 부모님이 정하거나 아이의 일로 흘러가는 카드(`deciderOf`)는 인생을 진행하는 동안 `pending`이 되지 않는다(그 해 안에서 즉시 해결, PD3).
 * 그런데 결정 카드의 **화면**(모달 시트·인용 박스·영향 줄 …)을 보는 시험은 그런 이벤트의 카드를 쓰던 것이 많다 — 시트가 보이는 모양은 누가 정하느냐와 상관이 없으므로, 그 이벤트가 일어날 수 있는 나이에
 * 시작 상태를 옮겨 대기 상태를 직접 만든다(저장 호환 PD10이 열자마자 처리하는 구 저장의 대기 상태와 같은 모양). 보이는 선택지가 2개 이상인 첫 시드를 쓴다.
 */
export function forcedPending(eventId: string, era: Era = 'present', opts: { age?: number } = {}): GameState {
  const ev = EVENT_POOL.byId.get(eventId);
  if (ev === undefined) throw new Error(`${eventId}: 이벤트가 없다`);
  if (ev.eras !== undefined && !ev.eras.includes(era)) throw new Error(`${eventId}: ${era} 세상에서는 일어나지 않는다`);
  const ages = possibleAgesOf(ev);
  const age = opts.age ?? ages[Math.floor(ages.length / 2)];
  for (let seed = 1; seed <= 400; seed++) {
    const base = startLife(seed, era);
    const s: GameState = { ...base, age, seen: { [eventId]: age }, lastChoiceAge: age };
    const visible = visibleChoices(ev, condContextOf(s));
    if (visible.length < 2) continue;
    return { ...s, pending: { eventId, key: `${eventId}@${age}`, age, choiceIds: visible.map((c) => c.id) } };
  }
  throw new Error(`${eventId}: 보이는 선택지가 2개 이상인 시작 상태를 찾지 못했다`);
}
