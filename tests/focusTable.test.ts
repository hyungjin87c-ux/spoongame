import { describe, expect, it } from 'vitest';
import { FOCUS_TABLE } from '../src/data/focusTable';
import { EVENT_POOL } from '../src/data/events';
import { focusTableProblems, focusTaggable, type EventDef } from '../src/core';
import type { FocusCode } from '../src/core/types';

/**
 * 표 게이트 (SPEC-018 PL10, 설계 1-4절 ①~④): 새 사건이 표지를 잊거나, 죽은 표지가 남거나, 주제가 잘못되면 `check:events`가 실패한다. 통과 사례 하나와 실패 사례 각각.
 */
const events = EVENT_POOL.events;
const table = FOCUS_TABLE as Record<string, readonly FocusCode[]>;
const without = (id: string): Record<string, readonly FocusCode[]> => Object.fromEntries(Object.entries(table).filter(([k]) => k !== id));

describe('focusTable 게이트', () => {
  it('통과: 실제 풀과 실제 표는 문제가 없고, 표지 대상은 표와 정확히 일치한다 (102개)', () => {
    expect(focusTableProblems(events, table)).toEqual([]);
    const taggable = events.filter(focusTaggable).map((e) => e.id);
    expect(taggable).toHaveLength(102);
    expect([...taggable].sort()).toEqual(Object.keys(table).sort());
  });

  it('① 표지 대상 사건의 행이 빠지면 실패한다 (새 사건이 표지를 잊는 길)', () => {
    const p = focusTableProblems(events, without('school-club'));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('school-club');
    expect(p[0]).toContain('행이 없다');
  });

  it('① 새 사건 가정: 풀에 사건을 하나 더하면 표에 행이 없어 실패하고 `[]`로 적으면 통과한다', () => {
    const extra: EventDef = { ...(events.find((e) => e.id === 'school-lunch') as EventDef), id: 'school-lunch-extra' };
    expect(focusTableProblems([...events, extra], table).join('\n')).toContain('school-lunch-extra');
    expect(focusTableProblems([...events, extra], { ...table, 'school-lunch-extra': [] })).toEqual([]);
  });

  it('② 표의 id가 풀에 없으면 실패한다 (사건을 지우거나 이름을 바꿈)', () => {
    const p = focusTableProblems(events, { ...table, 'school-gone': ['bond'] });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('school-gone');
    const renamed = events.filter((e) => e.id !== 'youth-meeting');
    expect(focusTableProblems(renamed, table).join('\n')).toContain('youth-meeting');
  });

  it('③ 모르는 주제·한 사건 3개·같은 주제 두 번은 실패한다', () => {
    expect(focusTableProblems(events, { ...table, 'school-club': ['hobby', 'bond', 'learn'] }).join('\n')).toContain('최대 2개');
    expect(focusTableProblems(events, { ...table, 'school-club': ['hobby', 'hobby'] }).join('\n')).toContain('두 번');
    expect(focusTableProblems(events, { ...table, 'school-club': ['sports' as FocusCode] }).join('\n')).toContain('모르는 주제');
  });

  it('④ 표지 대상이 아닌 사건(가족 강제·진로 카드·퇴역·슬롯·조르기·13세 전·마일스톤)에 행을 달면 실패한다', () => {
    const notTaggable = ['job-pick-field', 'youth-military', 'school-career-choice', 'school-high-pick', 'school-lessons', 'infant-new-sibling'];
    for (const id of notTaggable) {
      expect(events.some((e) => e.id === id), `${id}가 풀에 있다`).toBe(true);
      expect(focusTaggable(events.find((e) => e.id === id) as EventDef), id).toBe(false);
      expect(focusTableProblems(events, { ...table, [id]: ['bond'] }).join('\n'), id).toContain(`${id}: 초점 표에 행이 있지만 표지 대상이 아닌`);
    }
    const ask = events.find((e) => e.ask !== undefined) as EventDef;
    const milestone = events.find((e) => e.milestone === true) as EventDef;
    expect(focusTaggable(ask)).toBe(false);
    expect(focusTaggable(milestone)).toBe(false);
  });
});
