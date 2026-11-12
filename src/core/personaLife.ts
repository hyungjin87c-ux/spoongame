import type { ChoiceDef, EventDef } from './events';
import { closenessOf } from './familyCloseness';
import { isGameDataReady } from './gameData';
import { applyPersonaShift, personaFamSeedOf, personaOf, stableKey, type PersonaShiftContext, type PersonaShiftInput, type PersonaState } from './persona';
import type { DelegatedBy, GameState, HeavyKind, HistoryEntry } from './types';
import { FAMILY_LINE_HEAVY } from '../data/familyLineText';

/**
 * 인생 진행이 맞춤 인생(기질·적성)을 갱신하는 지점 (SPEC-018 PL1·PL2, 설계 `docs/data/persona-model.md` 1-3절 7번). **갱신은 아래 세 지점에서만, 각각 한 번** 일어나고 모두 순수 함수 `applyPersonaShift` 하나를 부른다(난수 비소비):
 *  ① 사건 적용 지점 — 선택 해결 한 번(`onChoice`: 본인·부모가 정한·흘러감 `by` 모두 같은 코드, **대기(`pending`) 중에는 적용하지 않는다**) · 서술 사건이 적용되는 자리 한 번(`onNarrative`)
 *  ② 가족 변화 줄 — `applyFamilyChanges` 자리에서 `FAMILY_LINE_HEAVY` 분류 줄이 있으면 역경 입력(`onFamilyLines`) `[CX-002-006]`
 *  ③ 해 끝 공통 경로 — 일반 진행과 선택 해결이 **같이 부르는 `finishYear`** 에서 한 번(`onYearEnd`): 어느 길이든 한 해에 한 번이다.
 * 모든 함수는 맞춤 인생이 꺼져 있으면(스위치 끔·`persona` 없음·출생 전) 같은 상태를 그대로 돌려준다(중립 불변). 「무거운 장면 가리기」 설정은 읽지 않는다 — 가려지는 것은 글뿐이라 갱신은 켬·끔이 같다.
 */

/** 갱신이 읽는 판의 값 — `persona`와 판이 모두 있을 때만 */
function context(s: GameState, age: number): { p: PersonaState; c: PersonaShiftContext } | null {
  const p = personaOf(s);
  if (p === null || s.peerSeed === null || s.character === null) return null;
  return { p, c: { famSeed: personaFamSeedOf(s.peerSeed), age, parenting: s.character.parenting, parentWealth: s.character.parentWealth } };
}

/**
 * 역경에 지지가 있는가 (1-3절 ③): 부모와의 사이 `closenessOf` 4 이상(어머니·아버지 중 큰 값) · `close_friend` 플래그 · 본보기 어른을 겪음(`roleUsed > 0`).
 * 가족 표(지연 덩어리)가 아직 없으면(시험의 맨 상태) 사이를 모르는 것으로 본다.
 */
export function personaSupportOf(s: GameState): boolean {
  if (s.flags.includes('close_friend') || (s.persona?.roleUsed ?? 0) > 0) return true;
  if (s.character === null || !isGameDataReady()) return false;
  return Math.max(closenessOf({ id: 'mother', role: 'mother' }, s), closenessOf({ id: 'father', role: 'father' }, s)) >= 4;
}

function shift(s: GameState, age: number, input: PersonaShiftInput | ((support: boolean) => PersonaShiftInput)): GameState {
  const ctx = context(s, age);
  if (ctx === null) return s;
  const resolved = typeof input === 'function' ? input(personaSupportOf(s)) : input;
  const next = applyPersonaShift(ctx.p, ctx.c, resolved);
  return JSON.stringify(next) === JSON.stringify(ctx.p) ? s : { ...s, persona: next };
}

/**
 * ① 선택 해결: 고른 선택지의 활동(`act`)·본보기(`role`)와 사건의 역경(`heavy`, 나이 ≤ 18)을 한 번에 적용한다. 역경의 안정 키는 (이벤트 id, 선택지 id).
 * 해결 **뒤**(효과 적용 뒤)·해 끝 **앞**에 부른다. `by`(부모가 정한·흘러감)이면 활동·본보기는 절반다.
 */
export function personaOnChoice(s: GameState, ev: EventDef, choice: ChoiceDef, by: DelegatedBy | undefined, age: number): GameState {
  if (choice.act === undefined && choice.role === undefined && ev.heavy === undefined) return s;
  const heavy: HeavyKind | undefined = ev.heavy?.kind;
  return shift(s, age, (supported) => ({
    ...(choice.act !== undefined ? { act: choice.act } : {}),
    ...(choice.role !== undefined ? { role: choice.role } : {}),
    ...(by !== undefined ? { by } : {}),
    ...(heavy !== undefined ? { adversity: { kind: heavy, key: stableKey(ev.id, choice.id), supported } } : {}),
  }));
}

/** ① 서술 사건이 적용되는 자리: 사건의 본보기(`role`)와 역경(`heavy`). 안정 키는 (이벤트 id, `age<나이>`) */
export function personaOnNarrative(s: GameState, ev: EventDef, age: number): GameState {
  if (ev.role === undefined && ev.heavy === undefined) return s;
  const heavy: HeavyKind | undefined = ev.heavy?.kind;
  return shift(s, age, (supported) => ({
    ...(ev.role !== undefined ? { role: ev.role } : {}),
    ...(heavy !== undefined ? { adversity: { kind: heavy, key: stableKey(ev.id, `age${age}`), supported } } : {}),
  }));
}

/** ② 가족 변화 줄: `FAMILY_LINE_HEAVY` 분류 줄마다 역경 한 번 — 풀에도 `seen`에도 없는 줄이라 줄의 `eventId`와 나이로 키를 만든다 */
export function personaOnFamilyLines(s: GameState, lines: readonly HistoryEntry[], age: number): GameState {
  let out = s;
  for (const line of lines) {
    const kind = line.eventId === undefined ? undefined : FAMILY_LINE_HEAVY[line.eventId];
    if (kind === undefined || line.eventId === undefined) continue;
    const key = stableKey(line.eventId, `age${age}`);
    out = shift(out, age, (supported) => ({ adversity: { kind, key, supported } }));
  }
  return out;
}

/** ③ 해 끝 공통 경로(`finishYear`): 양육 방식의 지속 영향·학교·부모 투자. `age`는 그 해 나이(`s.age`) */
export function personaOnYearEnd(s: GameState): GameState {
  return shift(s, s.age, { yearEnd: true });
}
