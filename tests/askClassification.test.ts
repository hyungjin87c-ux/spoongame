import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decisionFor, deciderOf, isClassified, parentTableProblems, selfAreaWeightFactor, type EventDef } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { ASK_AREA, DECISION_AREAS, PARENT_AREAS, PARENT_DECISION_TABLE, PARENT_TABLE_COUNTS, SELF_AREAS, SELF_AREA_WEIGHT, type DecisionRow } from '../src/data/parentDecisionTable';
import { askEvent } from './helpers/askEvents';

/**
 * 조르기 분류 (SPEC-011 AK1 — `docs/data/ask-model.md` 1-1·1-5절, 완료 기준 3의 코어 부분): 영역 `ask` · 결정자 규칙 R1a · `parentTableProblems` 점검 ④.
 *
 * **분류표 실제 행 9개·`PARENT_TABLE_COUNTS`(`selfCards` 18 · `askCards` 9)·PD0 기계 판독 블록 9행은 사건 데이터(AK7)와 같은 변경에서 더한다** — 표에 있는 id는 모두 실제 선택지 이벤트여야 하는 점검 ②가
 * 사건 없이 행만 더하면 빌드를 막기 때문이다(dev 로그 「결정이 필요한 것」). 그래서 이 파일은 설계 문서 1-3절의 사건 id 9개를 **임시 행으로 표에 끼워** 규칙(R1a·가중·집계 방향)을 시험하고, 점검 ④는 합성 표·합성 사건으로 본다.
 * 끼운 행은 파일이 끝나면 지운다(`afterAll`) — 실제 표는 바뀌지 않는다.
 */

const ASK_IDS = ['ask-toy-a', 'ask-toy-b', 'ask-toy-c', 'ask-toy-d', 'ask-lessons-a', 'ask-lessons-b', 'ask-lessons-c', 'ask-pet-a', 'ask-pet-b'] as const;
const TABLE = PARENT_DECISION_TABLE as Record<string, DecisionRow>;

beforeAll(() => {
  for (const id of ASK_IDS) TABLE[id] = { areas: [ASK_AREA] };
});
afterAll(() => {
  for (const id of ASK_IDS) delete TABLE[id];
});

describe('AK1 영역 ask — 단독 영역, 부모·본인·흘러감 영역과 별개', () => {
  it('DECISION_AREAS에 ask가 있고 PARENT_AREAS·SELF_AREAS·reaction에는 없다', () => {
    expect(ASK_AREA).toBe('ask');
    expect(DECISION_AREAS).toContain('ask');
    expect(DECISION_AREAS).toEqual([...PARENT_AREAS, ...SELF_AREAS, 'reaction', 'ask']);
    expect((PARENT_AREAS as readonly string[]).includes('ask')).toBe(false);
    expect((SELF_AREAS as readonly string[]).includes('ask')).toBe(false);
  });

  it('실제 분류표는 이 단계에서 그대로다 — 32행, 집계 24·7·9·6 (조르기 9행·askCards는 AK7에서 더한다)', () => {
    expect(ASK_IDS.every((id) => isClassified(id))).toBe(true); // 임시 행이 끼워진 동안은 분류돼 있다 (실제 표에는 없다)
    const real = Object.keys(TABLE).filter((id) => !(ASK_IDS as readonly string[]).includes(id));
    expect(real).toHaveLength(32);
    expect(PARENT_TABLE_COUNTS).toEqual({ parentCards: 24, childCards: 7, selfCards: 9, selfCards13to18: 6 });
  });
});

describe('AK1 R1a — 영역에 ask가 있으면 나이와 무관하게 본인 (R1 바로 뒤)', () => {
  it('조르기 9사건 × 나이 {3, 4, 12, 13} → 모두 self (3·13세는 사건이 일어나지 않는 나이지만 규칙 값은 그렇다)', () => {
    for (const id of ASK_IDS) {
      for (const age of [3, 4, 12, 13]) expect(deciderOf(id, age), `${id}@${age}`).toBe('self');
    }
  });

  it('0~19세 전 나이에서 부모·흘러감이 아니다 — 4~12세에도 「부모님이 정한다」가 아니다 (R4가 닿지 않는다)', () => {
    for (const id of ASK_IDS) {
      for (let age = 0; age <= 25; age++) {
        expect(deciderOf(id, age), `${id}@${age}`).toBe('self');
        expect(decisionFor(id, age), `${id}@${age}`).toBe('self');
      }
    }
  });

  it('R1a는 R2·R3·R4·R5보다 앞이다 — 영역이 ask와 reaction·부모 영역을 함께 가진 행(점검 ④가 막는 잘못된 행)도 값은 self이고, 기존 32장의 결정자는 그대로다', () => {
    TABLE['ask-mixed-x'] = { areas: ['ask', 'reaction'] };
    TABLE['ask-mixed-y'] = { areas: ['ask', 'care'], childActUntil: 12 };
    try {
      for (const age of [0, 4, 8, 12, 13, 18]) {
        expect(deciderOf('ask-mixed-x', age)).toBe('self');
        expect(deciderOf('ask-mixed-y', age)).toBe('self');
      }
    } finally {
      delete TABLE['ask-mixed-x'];
      delete TABLE['ask-mixed-y'];
    }
    // 기존 행: 한 칸도 달라지지 않았다 (R1a는 ask 영역이 있는 행에서만 닿는다)
    expect(deciderOf('infant-care', 5)).toBe('parent');
    expect(deciderOf('school-puppy', 10)).toBe('parent');
    expect(deciderOf('infant-new-sibling', 3)).toBe('child');
    expect(deciderOf('school-friend', 12)).toBe('child');
    expect(deciderOf('school-friend', 13)).toBe('self');
    expect(deciderOf('school-club', 10)).toBe('parent');
    expect(deciderOf('school-club', 15)).toBe('self');
    expect(deciderOf('infant-care', 19)).toBe('self');
  });

  it('PD13 가중(×2.0)은 조르기에 곱해지지 않는다 — 13세 미만에서 selfAreaWeightFactor는 1이다 (가중은 사건의 weight 하나가 전부)', () => {
    expect(SELF_AREA_WEIGHT).toBe(2);
    for (const id of ASK_IDS) {
      for (let age = 0; age <= 12; age++) expect(selfAreaWeightFactor(id, age), `${id}@${age}`).toBe(1);
    }
    // 대조: 같은 규칙에서 13~18세 본인 카드는 ×2.0이다 — 그래서 4~12세 조르기가 이 가중을 안 받는 것이 의미 있다
    expect(selfAreaWeightFactor('school-friend', 13)).toBe(2);
    expect(selfAreaWeightFactor('school-friend', 12)).toBe(1);
  });
});

describe('AK1 parentTableProblems 점검 ④ — 영역 [ask] ⇔ 사건의 ask 필드, 나이 범위가 종류 한계 안', () => {
  const tableOf = (rows: Record<string, DecisionRow>): Record<string, DecisionRow> => rows;

  it('맞는 짝(영역 [ask] + ask 필드, 종류별 나이 한계 안)은 문제가 없다 — toy 4~12 · lessons·pet 5~12', () => {
    const events = [askEvent('ask-toy-a', 'toy'), askEvent('ask-lessons-a', 'lessons'), askEvent('ask-pet-a', 'pet')];
    expect(parentTableProblems(events, tableOf({ 'ask-toy-a': { areas: ['ask'] }, 'ask-lessons-a': { areas: ['ask'] }, 'ask-pet-a': { areas: ['ask'] } }))).toEqual([]);
    // 한계 안에서 더 좁은 범위는 괜찮다
    expect(parentTableProblems([askEvent('ask-toy-a', 'toy', { ageRange: { min: 6, max: 9 } })], tableOf({ 'ask-toy-a': { areas: ['ask'] } }))).toEqual([]);
  });

  it('영역이 ask인 행인데 사건에 ask 필드가 없으면 실패한다', () => {
    const { ask: _ask, ...plain } = askEvent('ask-toy-a', 'toy') as EventDef & { ask?: unknown };
    void _ask;
    const problems = parentTableProblems([plain as unknown as EventDef], tableOf({ 'ask-toy-a': { areas: ['ask'] } }));
    expect(problems.join('\n')).toContain('영역이 ask인데 사건에 ask 필드');
  });

  it('사건에 ask 필드가 있는데 영역이 [ask]가 아니면 실패한다 (부모 영역·본인 영역·흘러감 영역으로 적은 경우)', () => {
    for (const areas of [['care'], ['study'], ['reaction']] as const) {
      const problems = parentTableProblems([askEvent('ask-toy-a', 'toy')], tableOf({ 'ask-toy-a': { areas } }));
      expect(problems.join('\n'), areas.join()).toContain("영역이 ['ask']가 아니다");
    }
  });

  it('영역 ask는 단독이다 — 다른 영역이나 childActUntil과 함께 쓰면 실패한다', () => {
    const ev = askEvent('ask-toy-a', 'toy');
    expect(parentTableProblems([ev], tableOf({ 'ask-toy-a': { areas: ['ask', 'care'] } })).join('\n')).toContain('다른 영역·childActUntil과 함께 쓰지 않는다');
    expect(parentTableProblems([ev], tableOf({ 'ask-toy-a': { areas: ['ask'], childActUntil: 6 } })).join('\n')).toContain('다른 영역·childActUntil과 함께 쓰지 않는다');
  });

  it('나이 범위가 종류 한계 밖이면 실패한다 (toy 3세·13세, lessons·pet 4세)', () => {
    const cases: Array<[Parameters<typeof askEvent>[1], { min: number; max: number }]> = [
      ['toy', { min: 3, max: 12 }],
      ['toy', { min: 4, max: 13 }],
      ['lessons', { min: 4, max: 12 }],
      ['pet', { min: 4, max: 12 }],
      ['pet', { min: 5, max: 14 }],
    ];
    for (const [kind, ageRange] of cases) {
      const problems = parentTableProblems([askEvent('ask-x', kind, { ageRange })], tableOf({ 'ask-x': { areas: ['ask'] } }));
      expect(problems.join('\n'), `${kind} ${ageRange.min}~${ageRange.max}`).toContain('세에만 일어나야 한다');
    }
  });

  it('ask 사건이 표에 없으면 기존 ①이 막는다 (19세 미만에서 일어나는 선택지 이벤트는 분류표에 있어야 한다)', () => {
    const problems = parentTableProblems([askEvent('ask-toy-a', 'toy')], tableOf({}));
    expect(problems.join('\n')).toContain('분류표(src/data/parentDecisionTable.ts)에 없다');
  });

  it('표에 영역 ask 행이 있는데 사건이 없으면 기존 ②가 막는다 — 그래서 표 9행은 사건과 같은 변경(AK7)에서 더한다', () => {
    const problems = parentTableProblems([], tableOf({ 'ask-toy-a': { areas: ['ask'] } }));
    expect(problems.join('\n')).toContain('분류표에 있지만 실제 선택지 이벤트가 아니다');
  });

  it('실제 풀·실제 표는 문제가 없다 (조르기 사건이 아직 없고 임시 행은 풀에 없는 id라 여기서는 제외하고 본다)', () => {
    const real = Object.fromEntries(Object.entries(TABLE).filter(([id]) => !(ASK_IDS as readonly string[]).includes(id)));
    expect(parentTableProblems(EVENT_POOL.events, real)).toEqual([]);
    expect(EVENT_POOL.events.filter((e) => e.ask !== undefined)).toHaveLength(0);
  });
});
