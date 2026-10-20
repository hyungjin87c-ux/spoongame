import { calendarYear, citationFor, stageOfAge, type Era, type HistoryEntry } from '../src/core';
import { isChoiceEvent } from '../src/core/events';
import { EVENT_POOL } from '../src/data/events';

/**
 * SPEC-005 QI0 기준선 측정의 순수 계산 부분 (실행 스크립트는 scripts/spec005Baseline.ts, 결과는 docs/data/spec-005-baseline.md).
 * 이 파일은 **측정용**이다 — 게임 코드(`src/`)는 바꾸지 않고, 부모 결정의 본 구현(`src/core/parentDecision.ts`·`src/data/parentDecisionTable.ts`)은 QI5의 몫이다.
 * 분류표는 SPEC-005 부록 A(PD2, 기획자 초안)를 그대로 옮긴 것이며 PD0 설계 문서(`docs/data/parent-decision-model.md`)가 확정하면 그쪽이 기준이다.
 */

/** 나이 구간 4개 (SPEC-005 QI0): 영유아(0~7세, EARLY_YEARS_MAX_AGE) / 8~12 / 13~18 / 19+ */
export const BANDS = [
  { key: 'infant', label: '영유아 0~7세', min: 0, max: 7 },
  { key: 'age8to12', label: '8~12세', min: 8, max: 12 },
  { key: 'age13to18', label: '13~18세', min: 13, max: 18 },
  { key: 'age19plus', label: '19세 이상', min: 19, max: 130 },
] as const;
export type BandKey = (typeof BANDS)[number]['key'];

export function bandOf(age: number): BandKey {
  return BANDS.find((b) => age >= b.min && age <= b.max)!.key;
}

/** 부록 A 영역 표지: 부모 영역 6 · 본인 영역 3 · 아이 반응 */
export const PARENT_AREAS = ['돌봄', '건강', '돈', '진학', '이사', '집안'] as const;
export const SELF_AREAS = ['공부', '친구', '취미'] as const;
export type Area = (typeof PARENT_AREAS)[number] | (typeof SELF_AREAS)[number] | '아이 반응';

/** 부록 A 비고의 M2 후보: R = 선택지가 아이의 반응, P = 8~12세 아이의 행동이 선택지(P*), V = 선택지가 아이의 목소리 */
export type ChildKind = 'R' | 'P' | 'V';

export interface AppendixRow {
  areas: readonly Area[];
  child?: ChildKind;
}

/** 부록 A 32장 (영유아 15 + 학창 17) — 이벤트 id → 영역 */
export const APPENDIX_A: Record<string, AppendixRow> = {
  'infant-care': { areas: ['돌봄'] },
  'infant-fever': { areas: ['건강'] },
  'infant-stories': { areas: ['돌봄'] },
  'infant-screen': { areas: ['돌봄'] },
  'infant-new-sibling': { areas: ['아이 반응'], child: 'R' },
  'infant-meal-start': { areas: ['돌봄'] },
  'infant-parental-leave': { areas: ['돌봄'] },
  'infant-first-birthday': { areas: ['돌봄', '돈'] },
  'infant-daycare-wait': { areas: ['돌봄'] },
  'infant-noise': { areas: ['이사', '돌봄'] },
  'infant-kindergarten': { areas: ['진학'] },
  'infant-sibling-toy': { areas: ['아이 반응'], child: 'R' },
  'infant-hospital-stay': { areas: ['건강'] },
  'infant-moving': { areas: ['이사'] },
  'infant-early-lessons': { areas: ['진학', '돈'] },
  'school-supplies': { areas: ['돈'] },
  'school-after-hours': { areas: ['돌봄'] },
  'school-friend': { areas: ['친구'], child: 'P' },
  'school-puppy': { areas: ['집안'], child: 'P' },
  'school-bully': { areas: ['친구'], child: 'P' },
  'school-tutoring': { areas: ['공부', '돈'] },
  'school-club': { areas: ['취미'] },
  'school-friend-quarrel': { areas: ['친구'], child: 'P' },
  'school-academy-night': { areas: ['공부', '돈'] },
  'school-teacher-notice': { areas: ['공부'], child: 'P' },
  'school-family-priority': { areas: ['진학', '돈'], child: 'V' },
  'school-early-work': { areas: ['돈', '진학'] },
  'school-career-choice': { areas: ['진학'] },
  'school-first-love': { areas: ['친구'] },
  'school-scholarship': { areas: ['돈', '진학'] },
  'school-exam': { areas: ['진학', '돈'] },
  'school-parttime': { areas: ['돈'] },
};

const isParentArea = (a: Area): boolean => (PARENT_AREAS as readonly string[]).includes(a) || a === '아이 반응';

/**
 * 부록 A의 규칙 (PD1·PD2): 0~12세 = 모두 부모 · 13~18세 = 영역에 부모 영역이 하나라도 있으면 부모, 없으면(공부·친구·취미뿐) 본인 · 19세 이상 = 본인.
 * 「아이 반응」은 규칙상 부모(0~12세)다 — 형진 님 답 M2는 그 카드를 「이렇게 흘러갔습니다」로 쓰기로 했으므로 부모 결정 문구가 아닐 수 있다(PD0에서 목록 확정).
 */
export function deciderByRule(eventId: string, age: number): 'parent' | 'self' {
  const row = APPENDIX_A[eventId];
  if (row === undefined) return 'self'; // 부록 밖(= 20세 이상 카드 58장)은 본인
  if (age <= 12) return 'parent';
  if (age <= 18) return row.areas.some(isParentArea) ? 'parent' : 'self';
  return 'self';
}

/**
 * PD0 설계 문서(`docs/data/parent-decision-model.md` 1-2절, 승인안)의 판정 순서: R1 19세 이상 본인 → R2 아이 반응(`reaction`: 선택지 전부가 아이의 반응·목소리) 흘러감 →
 * R3 `childActUntil`(12세 이하에서 선택지가 아이의 행동) 흘러감 → R4 12세 이하 부모 → R5 13~18세 부모 영역이 있으면 부모, 없으면 본인.
 * 부록 A와 다른 곳: `school-family-priority`는 12~17세 전 구간 흘러감, 8~12세 P\* 네 카드는 흘러감, `school-puppy`는 부모.
 */
export const PD0_REACTION = ['infant-new-sibling', 'infant-sibling-toy', 'school-family-priority'] as const;
export const PD0_CHILD_ACT_UNTIL_12 = ['school-friend', 'school-bully', 'school-friend-quarrel', 'school-teacher-notice'] as const;

export function deciderPD0(eventId: string, age: number): 'parent' | 'child' | 'self' {
  if (age >= 19) return 'self';
  const row = APPENDIX_A[eventId];
  if (row === undefined) return 'self';
  if ((PD0_REACTION as readonly string[]).includes(eventId)) return 'child';
  if ((PD0_CHILD_ACT_UNTIL_12 as readonly string[]).includes(eventId) && age <= 12) return 'child';
  if (age <= 12) return 'parent';
  return row.areas.some((a) => (PARENT_AREAS as readonly string[]).includes(a)) ? 'parent' : 'self';
}

/** 규칙상 부모 소관 카드를 M2 후보(아이 반응·행동·목소리)와 순수 부모 결정으로 가른다 — 후보는 0~12세에서만 의미가 있다(P*는 8~12세, R·V는 해당 카드의 12세 이하) */
export function parentKind(eventId: string, age: number): 'pure' | ChildKind | null {
  if (deciderByRule(eventId, age) !== 'parent') return null;
  const row = APPENDIX_A[eventId];
  if (row?.child !== undefined && age <= 12) return row.child;
  return 'pure';
}

/** 시대 era의 나이 age에 단계·나이 범위·시대 제한으로 일어날 수 있는 선택지 이벤트 id (조건 requires·conditions는 보지 않는다) */
export function choiceEventIdsAt(age: number, era: Era): string[] {
  const out: string[] = [];
  for (const ev of EVENT_POOL.events) {
    if (!isChoiceEvent(ev)) continue;
    if (!ev.stages.includes(stageOfAge(age))) continue;
    if (ev.ageRange?.min !== undefined && age < ev.ageRange.min) continue;
    if (ev.ageRange?.max !== undefined && age > ev.ageRange.max) continue;
    if (ev.eras && !ev.eras.includes(era)) continue;
    out.push(ev.id);
  }
  return out;
}

/** 구간 안 어느 한 해라도 일어날 수 있는 선택지 이벤트 id 집합 (시대별) */
export function choiceEventsInBand(band: BandKey, era: Era): Set<string> {
  const b = BANDS.find((x) => x.key === band)!;
  const ids = new Set<string>();
  for (let a = b.min; a <= Math.min(b.max, 100); a++) for (const id of choiceEventIdsAt(a, era)) ids.add(id);
  return ids;
}

/** 19세 미만에서 일어날 수 있는 선택지 이벤트 id (시대 무관 합집합) — 부록 A의 32장과 같아야 한다 */
export function underNineteenChoiceIds(): Set<string> {
  const ids = new Set<string>();
  for (const era of ['past', 'present', 'future'] as const) for (let a = 0; a <= 18; a++) for (const id of choiceEventIdsAt(a, era)) ids.add(id);
  return ids;
}

export interface Pd0Tally {
  parent: number;
  child: number;
  /** 구간별 부모 / 흘러감 / 본인(19세 미만 + 이상 모두) */
  parentByBand: Record<BandKey, number>;
  childByBand: Record<BandKey, number>;
  /** 13~18세 중 본인이 고르는 카드 */
  self13to18: number;
  /** 사람이 고르지 않는 카드(부모 + 흘러감) */
  notChosen: number;
}

export interface CardTally {
  /** 구간별 결정 카드(연표 choice 줄) 수 */
  band: Record<BandKey, number>;
  total: number;
  /** 규칙상 부모 소관 카드 (부록 A) */
  parentRule: number;
  /** 그중 순수 부모 결정 / M2 후보(아이 반응 R · 8~12세 행동 P · 아이 목소리 V) */
  parentPure: number;
  child: Record<ChildKind, number>;
  /** 구간별 규칙상 부모 소관 */
  parentByBand: Record<BandKey, number>;
  /** 13~18세 중 본인이 고르는 카드 */
  self13to18: number;
  /** PD0 설계 문서 승인안의 부모 / 흘러감 / 본인 (인용 노출은 시대 era와 출생 연도로 센다) */
  pd0: Pd0Tally;
  /** PD0 결정자별 카드 수와 그중 인용 박스가 보인 카드 수 */
  cite: Record<'parent' | 'child' | 'self' | 'all', { shown: number; cited: number }>;
}

const emptyBand = (): Record<BandKey, number> => ({ infant: 0, age8to12: 0, age13to18: 0, age19plus: 0 });

/** 한 판의 연표에서 결정 카드를 센다 (연표의 `choice` 줄 = 결정 카드, 불변식 「카드 수 = 결정 틱 수 = 연표 선택 수」) */
export function tallyLife(history: readonly HistoryEntry[], era: Era, birthYear: number): CardTally {
  const t: CardTally = {
    band: emptyBand(),
    total: 0,
    parentRule: 0,
    parentPure: 0,
    child: { R: 0, P: 0, V: 0 },
    parentByBand: emptyBand(),
    self13to18: 0,
    pd0: { parent: 0, child: 0, parentByBand: emptyBand(), childByBand: emptyBand(), self13to18: 0, notChosen: 0 },
    cite: { parent: { shown: 0, cited: 0 }, child: { shown: 0, cited: 0 }, self: { shown: 0, cited: 0 }, all: { shown: 0, cited: 0 } },
  };
  for (const h of history) {
    if (h.kind !== 'choice') continue;
    const b = bandOf(h.age);
    t.band[b]++;
    t.total++;
    const id = h.eventId ?? '';
    // PD0 승인안 분류 + 인용 박스 노출(인용 박스가 보였는가 = citationFor가 값을 돌려주는가, scripts/citationExposureLib.ts와 같은 방법)
    const d = deciderPD0(id, h.age);
    const ev = EVENT_POOL.byId.get(id);
    const showed = ev !== undefined && citationFor(ev, era, calendarYear(birthYear, h.age)) !== null;
    for (const key of [d, 'all'] as const) {
      t.cite[key].shown++;
      if (showed) t.cite[key].cited++;
    }
    if (d === 'parent') {
      t.pd0.parent++;
      t.pd0.parentByBand[b]++;
    } else if (d === 'child') {
      t.pd0.child++;
      t.pd0.childByBand[b]++;
    } else if (b === 'age13to18') t.pd0.self13to18++;
    t.pd0.notChosen = t.pd0.parent + t.pd0.child;
    const k = parentKind(id, h.age);
    if (k === null) {
      if (b === 'age13to18') t.self13to18++;
      continue;
    }
    t.parentRule++;
    t.parentByBand[b]++;
    if (k === 'pure') t.parentPure++;
    else t.child[k]++;
  }
  return t;
}

export function meanOf(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

/** 표준오차 */
export function seOf(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = meanOf(xs);
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v / xs.length);
}
