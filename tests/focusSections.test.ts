import { describe, expect, it } from 'vitest';
import { FOCUS_MIN_EVENTS, FOCUS_SECTIONS, FOCUS_TABLE, FOCUS_TOPICS } from '../src/data/focusTable';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { SELF_FROM_AGE } from '../src/data/parentDecisionTable';
import { EVENT_POOL } from '../src/data/events';
import { eventPool, focusChoicesOf, focusSectionOf, focusSectionRange, focusTaggable, focusTopicCounts, stageOfAge, type FocusId, type FocusSection } from '../src/core';

/**
 * 구간 경계 격자 (SPEC-018 PL10, 설계 1-6절·8-1절): 구간 나이 경계와 출생 연도 격자에서 `focusChoicesOf`가 **풀에서 직접 센 목록과 같다**.
 * 「직접 센다」 = 이 시험이 따로 짠 세기(나이마다 단계·나이 범위·연도 범위를 한 번씩 본다).
 */
const pool = eventPool();

describe('focusSections — 구간 번호와 시작 나이', () => {
  it('나이 → 구간: 12는 없음, 13·19는 0, 20·39는 1, 40·64는 2, 65는 3', () => {
    const want: Array<[number, FocusSection | null]> = [[0, null], [12, null], [13, 0], [19, 0], [20, 1], [39, 1], [40, 2], [64, 2], [65, 3], [90, 3], [110, 3]];
    for (const [age, s] of want) expect(focusSectionOf(age), `${age}세`).toBe(s);
  });

  it('구간 시작 나이 20·40·65는 단계 표의 startAge와, 13은 `SELF_FROM_AGE`와 같다', () => {
    expect([...FOCUS_SECTIONS]).toEqual([SELF_FROM_AGE, STAGE_TABLE.youth.startAge, STAGE_TABLE.middle.startAge, STAGE_TABLE.senior.startAge]);
    expect(focusSectionRange(0)).toEqual([13, 19]);
    expect(focusSectionRange(1)).toEqual([20, 39]);
    expect(focusSectionRange(2)).toEqual([40, 64]);
    expect(focusSectionRange(3)[0]).toBe(65);
  });
});

/** 풀에서 직접 센 구간 목록 — 구현과 따로 짠 세기 */
function direct(birthYear: number, section: FocusSection): FocusId[] {
  const [a, b] = focusSectionRange(section);
  const count = FOCUS_TOPICS.map(() => 0);
  for (const ev of EVENT_POOL.events) {
    if (!focusTaggable(ev)) continue;
    const codes = FOCUS_TABLE[ev.id] ?? [];
    let can = false;
    for (let age = a; age <= b && !can; age++) {
      const inAge = ev.ageRange === undefined || (age >= (ev.ageRange.min ?? -Infinity) && age <= (ev.ageRange.max ?? Infinity));
      const year = birthYear + age;
      const inYear = ev.yearRange === undefined || ((ev.yearRange.from === undefined || year >= ev.yearRange.from) && (ev.yearRange.to === undefined || year <= ev.yearRange.to));
      if (inAge && inYear && ev.stages.includes(stageOfAge(age))) can = true;
    }
    if (can) for (const c of codes) count[FOCUS_TOPICS.indexOf(c)]++;
  }
  return count.flatMap((n, i) => (n >= FOCUS_MIN_EVENTS ? [i as FocusId] : []));
}

/** 출생 연도 격자: 10년 간격 + 풀의 `yearRange` 경계를 구간 경계 나이에서 −1·0·+1 걸치는 연도 */
function birthYears(): number[] {
  const set = new Set<number>();
  for (let y = 1940; y <= 2090; y += 10) set.add(y);
  for (const ev of EVENT_POOL.events) {
    for (const bound of [ev.yearRange?.from, ev.yearRange?.to]) {
      if (bound === undefined) continue;
      for (const age of [12, 13, 19, 20, 39, 40, 64, 65]) for (const d of [-1, 0, 1]) set.add(bound - age + d);
    }
  }
  return [...set].filter((y) => y >= 1900 && y <= 2120).sort((x, y) => x - y);
}

describe('focusSections — 구간 목록 = 풀에서 직접 센 목록 (출생 연도 격자 × 4구간)', () => {
  const years = birthYears();

  it('격자가 충분히 촘촘하다', () => {
    expect(years.length).toBeGreaterThan(30);
  });

  it('모든 출생 연도 × 구간: `focusChoicesOf` = 직접 센 목록', () => {
    for (const by of years) for (const s of [0, 1, 2, 3] as const) expect([...focusChoicesOf(by, s, pool)], `${by}년생 구간 ${s}`).toEqual(direct(by, s));
  });

  it('목록은 번호 오름차순이고 주제는 사건 `FOCUS_MIN_EVENTS`개 이상일 때만 보인다 (카운트와 일치)', () => {
    for (const by of [1950, 1990, 2020]) {
      for (const s of [0, 1, 2, 3] as const) {
        const c = focusTopicCounts(by, s, pool);
        const list = focusChoicesOf(by, s, pool);
        expect([...list]).toEqual([...list].sort((x, y) => x - y));
        expect([...list]).toEqual(c.all.flatMap((n, i) => (n >= FOCUS_MIN_EVENTS ? [i] : [])));
        for (let i = 0; i < c.all.length; i++) expect(c.primary[i]).toBeLessThanOrEqual(c.all[i]);
      }
    }
  });

  it('13세 첫 고르기에는 공부·관계·돈이 있고(밀레니얼대 출생), 건강은 40세부터 보인다 — Q6 재분류의 결과', () => {
    const first = focusChoicesOf(1995, 0, pool);
    expect(first).toEqual(expect.arrayContaining([0, 2, 5]));
    expect(first).not.toContain(3);
    expect(focusChoicesOf(1995, 2, pool)).toContain(3);
  });

  it('같은 풀·연도·구간은 같은 목록 객체를 돌려준다 (캐시)', () => {
    expect(focusChoicesOf(1995, 1, pool)).toBe(focusChoicesOf(1995, 1, pool));
  });
});
