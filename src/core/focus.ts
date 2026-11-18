import { FOCUS_ENABLED } from '../data/focusSwitch';
import { FOCUS_K, FOCUS_MIN_EVENTS, FOCUS_SECTIONS, FOCUS_TABLE, FOCUS_TOPICS, FOCUS_TOPICS_PER_EVENT_MAX } from '../data/focusTable';
import { GATE_SLOT_EVENTS } from './careerTrack';
import { inYearRange, stageOfAge, type EventDef, type EventPool } from './events';
import { eventPool } from './gameData';
import { personaOf } from './persona';
import type { FocusCode, FocusId, FocusSection, GameState } from './types';

/**
 * 올해의 초점 (SPEC-018 PL10, 설계 `docs/data/focus-spend-model.md`) — **순수 함수 모음**(난수·시각·DOM 없음).
 * 초점은 **추첨 가중에만** 닿는다: `life.ts#pickWeighted`가 `focusFactor`를 한 번 곱한다. 사건이 뽑힌 뒤의 효과·자격·조건·자동 선택 점수는 이 파일을 읽지 않는다(3절 — `tests/focusInvariant.test.ts`가 잠근다).
 * 초점 없음(`focusEffectiveOf`가 `null`) = 곱은 리터럴 `1` = 변경 전과 바이트 동일(4절).
 */

/** 주제 코드 → 저장 번호(`FOCUS_TOPICS`의 색인 — One-way) */
export const focusIdOf = (code: FocusCode): FocusId => FOCUS_TOPICS.indexOf(code) as FocusId;

/** 마지막 구간(65세 이후)의 끝 나이 */
export const FOCUS_SECTION_END_AGE = 110;

/** 구간 번호 → 구간의 나이 범위 `[시작, 끝]` (13~19·20~39·40~64·65~110) */
export function focusSectionRange(section: FocusSection): readonly [number, number] {
  const next = FOCUS_SECTIONS[section + 1];
  return [FOCUS_SECTIONS[section], next === undefined ? FOCUS_SECTION_END_AGE : next - 1];
}

/** 이 나이가 속한 구간 번호 (13세 전이면 `null`) */
export function focusSectionOf(age: number): FocusSection | null {
  if (age < FOCUS_SECTIONS[0]) return null;
  let s = 0;
  for (let i = 1; i < FOCUS_SECTIONS.length; i++) if (age >= FOCUS_SECTIONS[i]) s = i;
  return s as FocusSection;
}

/**
 * 표지 대상 판정 (설계 1-2절 — 한 곳): 일반 추첨(`pickWeighted`)이 고르고 13세 이후에 나올 수 있는 사건만 표에 행을 둔다.
 * 가족 강제(`trigger`)·진로 카드(`pick`)·마일스톤·맞춤 판에서 퇴역한 사건(`retiredWith`)·큰 갈림길 슬롯·조르기·영유아 단계 전용·13세 전 사건은 아니다. 게이트와 구간 목록이 같은 함수를 쓴다.
 */
export function focusTaggable(ev: EventDef): boolean {
  if (ev.trigger !== undefined || ev.pick !== undefined || ev.milestone === true || ev.retiredWith !== undefined || ev.ask !== undefined) return false;
  if (GATE_SLOT_EVENTS.has(ev.id)) return false;
  if (!ev.stages.some((s) => s !== 'infant')) return false;
  return (ev.ageRange?.max ?? FOCUS_SECTION_END_AGE) >= FOCUS_SECTIONS[0];
}

/** 사건 id → 주제 번호 (표에서 한 번 만든다). 표에 없거나 `[]`이면 빈 배열 */
const TOPIC_IDS: ReadonlyMap<string, readonly FocusId[]> = new Map(Object.entries(FOCUS_TABLE).map(([id, codes]) => [id, codes.map(focusIdOf)] as const));

/** 이 사건의 주제 번호들 (0~2개) */
export const focusTopicsOf = (eventId: string): readonly FocusId[] => TOPIC_IDS.get(eventId) ?? [];

/**
 * 추첨 가중에 곱하는 배수 (설계 2-1절): 초점 없음·모르는 사건·주제가 다르면 리터럴 `1`, 사건의 주제 중 하나라도 초점이면 `FOCUS_K`(주제 둘이 모두 초점이어도 한 번 — k²가 아니다).
 * `x * 1`은 IEEE에서 `x`와 같다 — 초점 없는 판의 가중 배열은 변경 전과 같다.
 */
export function focusFactor(eventId: string, focus: FocusId | null): number {
  if (focus === null) return 1;
  const topics = TOPIC_IDS.get(eventId);
  return topics !== undefined && topics.includes(focus) ? FOCUS_K : 1;
}

// ---------- 구간에서 보이는 초점 ----------

const CHOICES_CACHE = new WeakMap<EventPool, Map<number, readonly FocusId[]>>();

/** 이 사건이 이 구간·이 출생 연도에서 **한 번이라도 후보 자격(나이·단계·연도)을 가질 수 있는가** — 상태(플래그·`seen`)는 읽지 않는다(설계 1-6절) */
function possibleIn(ev: EventDef, birthYear: number, section: FocusSection): boolean {
  const [a, b] = focusSectionRange(section);
  const lo = Math.max(a, ev.ageRange?.min ?? a);
  const hi = Math.min(b, ev.ageRange?.max ?? b);
  for (let age = lo; age <= hi; age++) if (ev.stages.includes(stageOfAge(age)) && inYearRange(birthYear + age, ev.yearRange)) return true;
  return false;
}

/** 구간×주제의 사건 수 — `all`은 주·보조 모두 센 수, `primary`는 첫 주제(주)로만 센 수 (`scripts/focusCount.ts`·설계 1-5절 표) */
export interface FocusTopicCounts {
  all: number[];
  primary: number[];
}

/** 표지 대상 사건 가운데 이 구간·출생 연도에 나올 수 있는 사건을 주제별로 센다 (풀과 표만 읽는다) */
export function focusTopicCounts(birthYear: number, section: FocusSection, pool: EventPool = eventPool()): FocusTopicCounts {
  const all = new Array<number>(FOCUS_TOPICS.length).fill(0);
  const primary = new Array<number>(FOCUS_TOPICS.length).fill(0);
  for (const ev of pool.events) {
    const topics = TOPIC_IDS.get(ev.id);
    if (topics === undefined || topics.length === 0 || !focusTaggable(ev) || !possibleIn(ev, birthYear, section)) continue;
    topics.forEach((t, i) => {
      all[t]++;
      if (i === 0) primary[t]++;
    });
  }
  return { all, primary };
}

/**
 * 이 구간에서 고를 수 있는 초점 (설계 1-6절): 표지 대상 사건 가운데 그 구간·연도에 나올 수 있는 사건이 그 주제를 `FOCUS_MIN_EVENTS`개 이상 가진 주제, 번호 오름차순.
 * 풀과 표만 읽는다(상태를 읽지 않아 구간 안에서 고정) — 같은 풀·출생 연도·구간이면 같은 목록이고 풀마다 캐시한다.
 */
export function focusChoicesOf(birthYear: number, section: FocusSection, pool: EventPool = eventPool()): readonly FocusId[] {
  let byKey = CHOICES_CACHE.get(pool);
  if (byKey === undefined) {
    byKey = new Map();
    CHOICES_CACHE.set(pool, byKey);
  }
  const key = birthYear * 4 + section;
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const list = focusTopicCounts(birthYear, section, pool).all.flatMap((n, i) => (n >= FOCUS_MIN_EVENTS ? [i as FocusId] : []));
  byKey.set(key, list);
  return list;
}

// ---------- 스위치 (시험·측정 전용 덮어쓰기) ----------

let activeFocusEnabled: boolean = FOCUS_ENABLED;

/** 측정·시험 전용: `fn` 동안만 초점 스위치를 바꾼다(끝나면 되돌린다) — `withGateTogether` 전례 */
export function withFocusEnabled<T>(on: boolean, fn: () => T): T {
  const before = activeFocusEnabled;
  activeFocusEnabled = on;
  try {
    return fn();
  } finally {
    activeFocusEnabled = before;
  }
}

/** 지금 쓰는 초점 스위치 */
export const focusEnabledNow = (): boolean => activeFocusEnabled;

// ---------- 판의 초점 ----------

/**
 * 이 나이의 추첨에 쓸 초점 (설계 5-2절): 스위치가 꺼졌거나·맞춤 판이 아니거나·고른 적이 없거나·13세 전이거나·고른 주제가 **지금 구간 목록에 없으면** `null`(저장은 지우지 않는다).
 * `stepYear`가 맨 앞에서 한 번 부른다. 초점 필드가 없는 판은 아무것도 읽지 않고 곧장 `null`이다.
 */
export function focusEffectiveOf(state: GameState, age: number, pool: EventPool = eventPool()): FocusId | null {
  const id = state.focus?.id;
  if (id === undefined || !activeFocusEnabled || personaOf(state) === null || state.character === null) return null;
  const section = focusSectionOf(age);
  if (section === null) return null;
  return focusChoicesOf(state.character.birthYear, section, pool).includes(id) ? id : null;
}

/**
 * 「고르기 가능」 (설계 5-1절): 맞춤 판·스위치 켬·인생 단계·구간이 있고 지금 구간이 아직 안 묻힌(`sec` 초과) 구간이며 그 구간에 고를 초점이 있다. 화면의 비차단 패널이 이 값이 참인 동안 열린다.
 * 대기 상태를 만들지 않는다 — 진행·타이머·자동 진행을 막지 않는다.
 */
export function focusPromptDue(state: GameState, pool: EventPool = eventPool()): boolean {
  if (!activeFocusEnabled || state.phase !== 'life' || personaOf(state) === null || state.character === null) return false;
  const section = focusSectionOf(state.age);
  if (section === null || section <= (state.focus?.sec ?? -1)) return false;
  return focusChoicesOf(state.character.birthYear, section, pool).length > 0;
}

/**
 * 초점 고르기·바꾸기·「없음」·「넘기기」 (설계 5-4절 7번) — 순수하고 **진행을 일으키지 않는다**(`pending`이 열려 있어도 허용, 효과는 다음 추첨부터).
 * `focus`: 주제 번호 = 그 초점으로, `null` = 「없음」(초점을 끈다), `undefined` = 「넘기기」(지금 값을 유지한 채 구간만 마친 것으로 한다). 어느 쪽이든 `sec`을 지금 구간으로 올린다(내리지 않는다).
 * 무시(같은 객체): 스위치 끔·인생 단계 아님·맞춤 판 아님·13세 전·지금 구간 목록에 없는 주제·바뀌는 것이 없음(멱등 — 연타해도 한 번이고, 서로 다른 값은 마지막 값이 이긴다).
 */
export function setFocus(state: GameState, focus: FocusId | null | undefined, pool: EventPool = eventPool()): GameState {
  if (!activeFocusEnabled || state.phase !== 'life' || personaOf(state) === null || state.character === null) return state;
  const section = focusSectionOf(state.age);
  if (section === null) return state;
  if (focus !== undefined && focus !== null && typeof focus !== 'number') return state; // 변조된 입력
  if (typeof focus === 'number' && !focusChoicesOf(state.character.birthYear, section, pool).includes(focus)) return state;
  const before = state.focus;
  const id: FocusId | undefined = focus === undefined ? before?.id : (focus ?? undefined);
  const sec = (before === undefined ? section : Math.max(before.sec, section)) as FocusSection;
  if (before !== undefined && before.id === id && before.sec === sec) return state;
  return { ...state, focus: id === undefined ? { sec } : { id, sec } };
}

// ---------- 표 게이트 (빌드 `check:events`) ----------

/** 표 ↔ 풀 점검 (설계 1-4절 게이트 ①~④; ⑤ 문서 대조는 `tests/focusDoc.test.ts`) — 문제 목록(빈 배열이면 통과) */
export function focusTableProblems(events: readonly EventDef[], table: Readonly<Record<string, readonly FocusCode[]>> = FOCUS_TABLE): string[] {
  const problems: string[] = [];
  const byId = new Map(events.map((e) => [e.id, e] as const));
  for (const ev of events) {
    if (focusTaggable(ev) && !Object.prototype.hasOwnProperty.call(table, ev.id)) {
      problems.push(`${ev.id}: 13세 이후 일반 추첨에 나오는 사건인데 초점 표(src/data/focusTable.ts)에 행이 없다 — 주제를 적거나 주제가 없으면 빈 배열 []로 적는다`);
    }
  }
  for (const [id, codes] of Object.entries(table)) {
    const ev = byId.get(id);
    if (ev === undefined) {
      problems.push(`${id}: 초점 표에 있지만 이벤트 풀에 없다 (사건을 지웠거나 이름을 바꿨다)`);
      continue;
    }
    if (!focusTaggable(ev)) problems.push(`${id}: 초점 표에 행이 있지만 표지 대상이 아닌 사건이다 (가족 강제·진로 카드·마일스톤·퇴역·슬롯·조르기·13세 전) — 죽은 표지는 구간 목록을 부풀린다`);
    if (codes.length > FOCUS_TOPICS_PER_EVENT_MAX) problems.push(`${id}: 주제는 한 사건에 최대 ${FOCUS_TOPICS_PER_EVENT_MAX}개다 (${codes.length}개)`);
    if (new Set(codes).size !== codes.length) problems.push(`${id}: 같은 주제가 두 번 적혔다`);
    for (const c of codes) if (!(FOCUS_TOPICS as readonly string[]).includes(c)) problems.push(`${id}: 모르는 주제 코드다 (${String(c)})`);
  }
  return problems;
}
