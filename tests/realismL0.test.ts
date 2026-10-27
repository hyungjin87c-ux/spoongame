import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/core';
import { playRecorded, type Snapshot } from '../scripts/baseline004Lib';
import {
  COURSE_FLAGS,
  choiceSetFlags,
  courseChooser,
  firstsOf,
  homePathOf,
  playL0,
  pointAt,
  quantile,
  seOf,
  selectorChooser,
  type L0Record,
} from '../scripts/realismL0Lib';
import { EVENT_POOL } from '../src/data/events';

/**
 * SPEC-004 현실성 보정 1단계 L0(측정 정정)의 측정 도구 점검 (`scripts/realismL0Lib.ts`).
 * 게임 규칙은 바꾸지 않는다 — 선택자 `course`(구조 상한)와 시점·누적 값 뽑기가 약속대로 동작하는지만 본다.
 */

const pendingState = (eventId: string, choiceIds: string[]): GameState => ({ pending: { eventId, choiceIds, key: 'k' } }) as unknown as GameState;

describe('선택자 course — 정석 문을 켜는 선택지를 고른다', () => {
  it('선택지가 켜는 플래그를 이벤트 데이터에서 읽는다(기본 효과 + 보너스 효과)', () => {
    expect(choiceSetFlags(EVENT_POOL.byId.get('youth-marriage')!, 'marry')).toContain('married');
    expect(choiceSetFlags(EVENT_POOL.byId.get('youth-child')!, 'later')).toEqual(['child_postponed']);
    expect(choiceSetFlags(EVENT_POOL.byId.get('youth-housing')!, 'loan')).toContain('own_home');
    expect(choiceSetFlags(EVENT_POOL.byId.get('youth-marriage')!, '없는 선택지')).toEqual([]);
  });

  it('결혼·출산·내 집·파트너·취업 문은 정석 쪽 선택지를 고른다', () => {
    const pick = (id: string, ids: string[]) => courseChooser(1)(pendingState(id, ids));
    expect(pick('youth-marriage', ['marry', 'wait', 'part'])).toBe('marry');
    expect(pick('youth-child', ['have', 'later', 'none'])).toBe('have');
    expect(pick('youth-child-again', ['have', 'none'])).toBe('have');
    expect(pick('youth-housing', ['rent', 'parents', 'loan'])).toBe('loan');
    expect(pick('middle-home-loan', ['move', 'stay'])).toBe('move');
    expect(pick('youth-meeting', ['meet', 'later'])).toBe('meet');
    expect(pick('youth-first-job', ['stable', 'dream'])).toMatch(/stable|dream/);
  });

  it('정석 문이 없는 선택지는 시드 난수로 고르고, 같은 시드면 같은 수열이다', () => {
    const ids = ['apply', 'retry', 'work'];
    const a = courseChooser(77);
    const b = courseChooser(77);
    const seqA = Array.from({ length: 12 }, () => a(pendingState('school-exam', ids)));
    const seqB = Array.from({ length: 12 }, () => b(pendingState('school-exam', ids)));
    expect(seqA).toEqual(seqB);
    for (const id of seqA) expect(ids).toContain(id);
    expect(new Set(seqA).size).toBeGreaterThan(1);
  });

  it('정석 문 플래그 우선순위: 결혼 > 출산 > 내 집 > 파트너 > 취업', () => {
    expect([...COURSE_FLAGS]).toEqual(['married', 'has_child', 'own_home', 'has_partner', 'has_career']);
  });
});

describe('playL0 — 기준선과 같은 판을 만든다', () => {
  it('auto·random은 기준선 playRecorded와 사망 나이·끝 플래그·출생 연도가 같다', () => {
    for (const era of ['genx', 'millennial'] as const)
      for (const sel of ['auto', 'random'] as const)
        for (let i = 1; i <= 4; i++) {
          const seed = i * 7919 + 13;
          const a = playL0(seed, era, sel);
          const b = playRecorded(seed, era, sel);
          expect(a.deathAge, `${era}/${sel}/${seed}`).toBe(b.deathAge);
          expect(a.birthYear).toBe(b.birthYear);
          expect([...(a.at.get(a.deathAge)?.flags ?? [])].sort()).toEqual([...(b.at.get(b.deathAge)?.flags ?? [])].sort());
        }
  });

  it('같은 시드·같은 선택자면 같은 기록이다(결정적)', () => {
    const a = playL0(8123, 'genx', 'course');
    const b = playL0(8123, 'genx', 'course');
    expect(a.pickLog).toEqual(b.pickLog);
    expect(a.deathAge).toBe(b.deathAge);
    expect(a.homeCause).toBe(b.homeCause);
  });

  it('선택자 course는 정석 4단(취업·결혼·출산·내 집)을 random보다 훨씬 많이 밟는다 (H1, 구조 상한)', () => {
    const share4 = (sel: 'random' | 'course') => {
      let ok = 0;
      let n = 0;
      for (const era of ['genx', 'millennial'] as const)
        for (let i = 1; i <= 60; i++) {
          const f = firstsOf(playL0(i * 7919 + 13, era, sel));
          n++;
          if (f.career !== null && f.married !== null && f.child !== null && f.home !== null) ok++;
        }
      return ok / n;
    };
    const course = share4('course');
    const random = share4('random');
    expect(course).toBeGreaterThan(0.25);
    expect(random).toBeLessThan(0.15);
    expect(course).toBeGreaterThan(random * 3);
  });

  it('selectorChooser는 세 선택자 모두 보이는 선택지 안에서만 고른다', () => {
    const ids = ['marry', 'wait', 'part'];
    for (const sel of ['random', 'course'] as const) {
      const c = selectorChooser(sel, 5);
      for (let i = 0; i < 10; i++) expect(ids).toContain(c(pendingState('youth-marriage', ids)));
    }
  });
});

const snap = (age: number, flags: string[], dwelling: string | null = null, seen: Record<string, number> = {}): Snapshot => ({ age, flags: new Set(flags), dwelling, seen });

function fakeRecord(): L0Record {
  const at = new Map<number, Snapshot>();
  at.set(20, snap(20, [], 'family'));
  at.set(25, snap(25, ['has_career'], 'rent'));
  at.set(29, snap(29, ['has_career', 'has_partner'], 'rent'));
  at.set(33, snap(33, ['has_career', 'married', 'has_partner'], 'own'));
  at.set(36, snap(36, ['has_career', 'married', 'has_partner', 'has_child'], 'own'));
  at.set(50, snap(50, ['has_career', 'own_business', 'married', 'has_child', 'own_home'], 'own'));
  at.set(66, snap(66, ['own_business', 'married', 'has_child', 'own_home'], 'own', { 'senior-retire': 66 }));
  return {
    seed: 1,
    era: 'genx',
    selector: 'course',
    birthYear: 1970,
    gender: 'female',
    looks: 50,
    parentWealth: 3,
    deathAge: 80,
    at,
    picks: [],
    lines: new Map(),
    pickLog: [],
    finalSeen: {},
    homeCause: 'youth-marriage/marry',
  };
}

describe('firstsOf·pointAt — 누적(ever)과 시점(at) 값', () => {
  it('처음 켜진 나이를 정석 문별로 뽑는다', () => {
    const f = firstsOf(fakeRecord());
    expect(f.career).toBe(25);
    expect(f.employed).toBe(25);
    expect(f.partner).toBe(29);
    expect(f.married).toBe(33);
    expect(f.child).toBe(36);
    expect(f.homeDwelling).toBe(33); // 결혼 때 주거만 자가
    expect(f.homeFlag).toBe(50); // 플래그는 한참 뒤
    expect(f.home).toBe(33);
  });

  it('시점 값: 그 나이의 상태(결혼·자가·취업·은퇴)', () => {
    const r = fakeRecord();
    expect(pointAt(r, 30)).toMatchObject({ married: false, hasPartner: true, ownDwelling: false, employed: true, solo: false });
    expect(pointAt(r, 40)).toMatchObject({ married: true, child: true, ownDwelling: true, ownUnion: true, employed: true, business: false });
    expect(pointAt(r, 50)).toMatchObject({ employed: true, business: true });
    expect(pointAt(r, 70)).toMatchObject({ employed: false, business: false }); // 은퇴 뒤
    expect(pointAt(r, 81)).toBeNull(); // 사망 뒤
  });

  it('내 집이 켜진 경로 이름을 묶는다', () => {
    const r = fakeRecord();
    expect(homePathOf(r)).toContain('결혼 때 자동 자가');
    expect(homePathOf({ ...r, homeCause: 'youth-housing/loan' })).toContain('youth-housing/loan');
    expect(homePathOf({ ...r, homeCause: 'middle-home-loan/move' })).toContain('middle-home-loan/move');
    expect(homePathOf({ ...r, homeCause: 'year' })).toContain('그 밖');
    expect(homePathOf({ ...r, homeCause: null })).toBeNull();
  });

  it('통계 도우미: 분위·표준오차', () => {
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8], 0.5)).toBe(5);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
    expect(seOf(0.5, 1000)).toBeCloseTo(0.0158, 3);
    expect(Number.isNaN(seOf(0.5, 0))).toBe(true);
  });
});
