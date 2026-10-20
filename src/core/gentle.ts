import { EVENT_POOL } from '../data/events';
import { INHERIT_NOTE_TEXT } from '../data/lifeTable';
import type { EventDef, EventPool } from './events';
import type { HeavyKind, HistoryEntry } from './types';

/**
 * 무거운 장면 가리기의 판정 (SPEC-005 HV2·HV3, 순수 함수). 화면(UI)이 「이 줄·이 카드를 가려야 하는가」를 물을 때 쓴다.
 *
 * **가림은 지금의 설정값으로 화면이 정한다**(화면 규칙 (A), R-475) — 그래서 「줄마다 가렸는지」는 어디에도 저장하지 않고, 이 파일은 **줄이 무거운 장면인가**(분류)만 알려 준다:
 *  - 이벤트에서 온 줄: 이벤트 데이터의 `heavy: { kind }`(23개, 부록 D-1).
 *  - **이벤트 밖의 기록 줄**(`eventId`가 없는 줄, R-468): 줄을 만드는 쪽의 상수로 잡는다. 지금 이런 줄 가운데 무거운 것은 상속 줄 하나뿐이다(「부모님이 남기신 재산을 물려받았습니다.」, `INHERIT_NOTE_TEXT`,
 *    부모의 죽음을 직접 말해 가린 `middle-parents-farewell` 줄 바로 뒤에 붙어 내용이 샌다). 줄에 필드를 더하지 않고 **글자 상수**로 알아보므로 이 변경 **이전에 저장된 v8 판의 상속 줄도**
 *    똑같이 잡힌다(M20 — 옛 저장의 줄에는 표지 필드가 없다). 저장 스키마는 v8 그대로다(필드 증가 0).
 *
 * 사건·선택·효과·확률·난수·플래그는 이 판정과 무관하다(방식 A) — 이 파일의 어떤 함수도 인생 상태를 읽거나 바꾸지 않는다.
 */

/** 이벤트의 무거운 장면 분류(없으면 null) */
export function heavyKindOfEvent(ev: EventDef | undefined): HeavyKind | null {
  return ev?.heavy?.kind ?? null;
}

/**
 * `eventId`가 없는 기록 줄(종류 `event`) 가운데 무거운 줄의 글자 → 분류 (R-468). 글자는 줄을 만드는 쪽의 상수(`INHERIT_NOTE_TEXT`, core/life.ts#inheritanceLine)와 같은 값이라 둘이 어긋날 수 없다.
 * 새로 이벤트 밖의 무거운 줄이 생기면 여기에 더한다(tests/gentle.test.ts가 줄을 만드는 곳의 모든 `eventId` 없는 줄을 이 표와 대조한다).
 */
export const HEAVY_LINES_WITHOUT_EVENT: ReadonlyMap<string, HeavyKind> = new Map<string, HeavyKind>([[INHERIT_NOTE_TEXT, 'loss']]);

/**
 * 기록 줄의 무거운 장면 분류(없으면 null). 사건(`event`)·선택 결과(`choice`) 줄만 가릴 수 있고, 단계·사망·「나의 기록」 줄은 가리지 않는다(HV8).
 * 이벤트에서 온 줄은 그 이벤트의 표지를, 이벤트 밖의 줄은 상수 표를 따른다. 풀에 없는 이벤트(콘텐츠가 사라진 옛 저장)는 null — 원문 그대로 보인다.
 */
export function heavyKindOfEntry(entry: HistoryEntry, pool: EventPool = EVENT_POOL): HeavyKind | null {
  if (entry.kind !== 'event' && entry.kind !== 'choice') return null;
  if (entry.eventId === undefined) return entry.kind === 'event' ? (HEAVY_LINES_WITHOUT_EVENT.get(entry.text) ?? null) : null;
  return heavyKindOfEvent(pool.byId.get(entry.eventId));
}

/** 풀에서 무거운 장면 표지가 붙은 이벤트 id → 분류 (시험·보고용) */
export function heavyEvents(pool: EventPool = EVENT_POOL): Map<string, HeavyKind> {
  const out = new Map<string, HeavyKind>();
  for (const ev of pool.events) if (ev.heavy !== undefined) out.set(ev.id, ev.heavy.kind);
  return out;
}
