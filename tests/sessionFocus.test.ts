import { describe, expect } from 'vitest';
import { autoResolveStep, createInitialState, createSession, eventPool, focusPromptDue, sessionReducer, stepYear, withFocusEnabled, type FocusId, type GameState, type Session, type SessionAction } from '../src/core';
import { itFocusOn, lifeStateAt, listOf, pendingStateFrom } from './helpers/focusStates';

/**
 * 세션 액션 setFocus (SPEC-018 PL10, 설계 5절): 진행을 일으키지 않고, 연타해도 한 번이며(멱등), 서로 다른 값은 마지막 값이 이긴다. `pending` 중에도 자동 모드 중에도 받는다.
 * 무시: 인생 단계가 아님·맞춤 판이 아님·13세 전·목록 밖 값·변조된 입력·스위치 끔·첫 화면을 다시 연 동안.
 */
const pool = eventPool();
const reduce = (s: Session, a: SessionAction): Session => sessionReducer(s, a, pool);
const sessionOf = (game: GameState, auto = false): Session => createSession(game, { speed: 1, autoMode: auto });

describe('sessionFocus — 고르기·바꾸기', () => {
  const at13 = lifeStateAt(21, 'millennial', 13);

  itFocusOn('13세: 목록이 있고 「고르기 가능」이다 — 고르면 {id, sec 0}이 되고 진행(나이·대기·틱)은 그대로다', () => {
    expect(at13.age).toBe(13);
    expect(focusPromptDue(at13, pool)).toBe(true);
    const list = listOf(at13);
    expect(list.length).toBeGreaterThan(1);
    const s0 = sessionOf(at13);
    const s1 = reduce(s0, { type: 'setFocus', focus: list[0] });
    expect(s1.game.focus).toEqual({ id: list[0], sec: 0 });
    expect(s1.game.age).toBe(at13.age);
    expect(s1.game.pending).toBe(at13.pending);
    expect(s1.game.rngState).toBe(at13.rngState);
    expect(s1.tick).toBe(s0.tick);
    expect(s1.game.history).toBe(at13.history);
    expect(focusPromptDue(s1.game, pool)).toBe(false);
  });

  itFocusOn('멱등: 같은 값을 연타하면 두 번째부터 같은 세션 객체다', () => {
    const f = listOf(at13)[0];
    const s1 = reduce(sessionOf(at13), { type: 'setFocus', focus: f });
    const s2 = reduce(s1, { type: 'setFocus', focus: f });
    const s3 = reduce(s2, { type: 'setFocus', focus: f });
    expect(s2).toBe(s1);
    expect(s3).toBe(s1);
  });

  itFocusOn('마지막 값이 이긴다: 서로 다른 값을 연타하면 마지막 값만 남고 sec은 변하지 않는다', () => {
    const list = listOf(at13);
    let s = sessionOf(at13);
    const seq: FocusId[] = [list[0], list[1], list[0], list[list.length - 1], list[1]];
    for (const f of seq) s = reduce(s, { type: 'setFocus', focus: f });
    expect(s.game.focus).toEqual({ id: seq[seq.length - 1], sec: 0 });
  });

  itFocusOn('「없음」(null)은 초점을 끄고 구간은 마친 것으로 한다 — 고르지 않기와 다르다', () => {
    const f = listOf(at13)[0];
    const chosen = reduce(sessionOf(at13), { type: 'setFocus', focus: f });
    const none = reduce(chosen, { type: 'setFocus', focus: null });
    expect(none.game.focus).toEqual({ sec: 0 });
    expect('id' in none.game.focus!).toBe(false);
    const untouched = sessionOf(at13);
    expect(untouched.game.focus).toBeUndefined();
    expect(focusPromptDue(untouched.game, pool)).toBe(true);
    expect(focusPromptDue(none.game, pool)).toBe(false);
  });

  itFocusOn('「넘기기」(focus 생략): 지금 값을 두고 구간만 마친다 — 처음이면 초점 없음으로, 이미 고른 값은 유지', () => {
    const skipped = reduce(sessionOf(at13), { type: 'setFocus' });
    expect(skipped.game.focus).toEqual({ sec: 0 });
    expect(focusPromptDue(skipped.game, pool)).toBe(false);
    const f = listOf(at13)[0];
    const keep = reduce(reduce(sessionOf(at13), { type: 'setFocus', focus: f }), { type: 'setFocus' });
    expect(keep.game.focus).toEqual({ id: f, sec: 0 });
  });

  itFocusOn('다음 구간(20세)이 되면 다시 「고르기 가능」이 되고 직전 초점이 이어진다', () => {
    const f = listOf(at13)[0];
    let s = reduce(sessionOf(at13), { type: 'setFocus', focus: f }).game;
    for (let guard = 0; guard < 40 && s.age < 20; guard++) s = s.pending !== null ? autoResolveStep(s, s.pending.key, pool).state : stepYear(s, pool).state;
    expect(s.age).toBe(20);
    expect(s.focus).toEqual({ id: f, sec: 0 });
    expect(focusPromptDue(s, pool)).toBe(true);
    const next = reduce(sessionOf(s), { type: 'setFocus', focus: listOf(s)[0] }).game;
    expect(next.focus!.sec).toBe(1);
  });

  itFocusOn('목록에 없는 값(13세에 건강)·변조된 입력은 무시한다 — 같은 세션 객체', () => {
    expect(listOf(at13)).not.toContain(3);
    const s0 = sessionOf(at13);
    expect(reduce(s0, { type: 'setFocus', focus: 3 })).toBe(s0);
    expect(reduce(s0, { type: 'setFocus', focus: 6 as FocusId })).toBe(s0);
    expect(reduce(s0, { type: 'setFocus', focus: -1 as FocusId })).toBe(s0);
    expect(reduce(s0, { type: 'setFocus', focus: '2' as unknown as FocusId })).toBe(s0);
    expect(reduce(s0, { type: 'setFocus', focus: 1.5 as unknown as FocusId })).toBe(s0);
  });
});

describe('sessionFocus — 상태별', () => {
  itFocusOn('pending이 열린 동안에도 받고 열린 카드는 바뀌지 않는다', () => {
    const p = pendingStateFrom(33, 'millennial', 20)!;
    expect(p.pending).not.toBeNull();
    const f = listOf(p)[0];
    const s1 = reduce(sessionOf(p), { type: 'setFocus', focus: f });
    expect(s1.game.focus).toEqual({ id: f, sec: 1 });
    expect(s1.game.pending).toBe(p.pending);
  });

  itFocusOn('자동 모드가 켜진 채에도 받고, 자동 선택은 그대로 진행한다 (초점을 고르지 않는다)', () => {
    const p = pendingStateFrom(34, 'millennial', 20)!;
    const f = listOf(p)[0];
    const s0 = sessionOf(p, true);
    const s1 = reduce(s0, { type: 'setFocus', focus: f });
    expect(s1.game.focus).toBeDefined();
    const after = reduce(s1, { type: 'autoChoose', key: p.pending!.key });
    expect(after.game.pending).toBeNull();
    expect(after.game.focus).toEqual(s1.game.focus);
    // 자동 모드가 스스로 초점을 만들지 않는다
    let g = lifeStateAt(35, 'millennial', 13);
    let s = sessionOf(g, true);
    for (let i = 0; i < 80 && s.game.phase === 'life'; i++) s = s.game.pending !== null ? reduce(s, { type: 'autoChoose', key: s.game.pending.key }) : reduce(s, { type: 'advance', fromAge: s.game.age });
    g = s.game;
    expect(g.focus).toBeUndefined();
  });

  itFocusOn('advance와 섞어도 이중 진행이 없다: setFocus가 나이를 올리지 않고 advance는 한 해만 간다', () => {
    const g = lifeStateAt(36, 'millennial', 14);
    const f = listOf(g)[0];
    let s = sessionOf(g);
    s = reduce(s, { type: 'setFocus', focus: f });
    s = reduce(s, { type: 'setFocus', focus: f });
    expect(s.game.age).toBe(g.age);
    const adv = reduce(s, { type: 'advance', fromAge: g.age });
    expect(adv.game.age === g.age + 1 || adv.game.pending !== null).toBe(true);
    // 같은 fromAge로 다시 advance(늦게 온 타이머)는 pending이 열렸거나 나이가 달라 무시된다
    const again = reduce(adv, { type: 'advance', fromAge: g.age });
    expect(again.game.age).toBe(adv.game.age);
  });

  itFocusOn('인생 단계가 아니면 무시한다 (첫 화면·엔딩)', () => {
    const title = sessionOf(createInitialState(1));
    expect(reduce(title, { type: 'setFocus', focus: 0 })).toBe(title);
    let g = lifeStateAt(37, 'millennial', 30);
    for (let guard = 0; guard < 400 && g.phase === 'life'; guard++) g = g.pending !== null ? autoResolveStep(g, g.pending.key, pool).state : stepYear(g, pool).state;
    expect(g.phase).toBe('ending');
    const ended = sessionOf(g);
    expect(reduce(ended, { type: 'setFocus', focus: 0 })).toBe(ended);
    expect(focusPromptDue(g, pool)).toBe(false);
  });

  itFocusOn('13세 전과 맞춤 판이 아닌 판(persona 없음)은 무시한다', () => {
    const young = lifeStateAt(38, 'millennial', 9);
    expect(young.age).toBeLessThan(13);
    expect(reduce(sessionOf(young), { type: 'setFocus', focus: 0 }).game.focus).toBeUndefined();
    const g = lifeStateAt(38, 'millennial', 20);
    const bare = { ...g } as Record<string, unknown>;
    delete bare.persona;
    const s0 = sessionOf(bare as unknown as GameState);
    expect(reduce(s0, { type: 'setFocus', focus: listOf(g)[0] })).toBe(s0);
    expect(focusPromptDue(bare as unknown as GameState, pool)).toBe(false);
  });

  itFocusOn('첫 화면을 다시 연 동안(showTitle)의 늦은 입력은 무시한다', () => {
    const g = lifeStateAt(39, 'millennial', 20);
    const s0 = { ...sessionOf(g), showTitle: true };
    expect(reduce(s0, { type: 'setFocus', focus: listOf(g)[0] })).toBe(s0);
  });

  itFocusOn('스위치(FOCUS_ENABLED)를 끄면 setFocus가 무시되고 저장된 값은 지워지지 않는다', () => {
    const g = lifeStateAt(40, 'millennial', 20);
    const f = listOf(g)[0];
    const on = reduce(sessionOf(g), { type: 'setFocus', focus: f });
    withFocusEnabled(false, () => {
      expect(reduce(sessionOf(g), { type: 'setFocus', focus: f }).game.focus).toBeUndefined();
      const off = reduce(on, { type: 'setFocus', focus: null });
      expect(off).toBe(on);
      expect(off.game.focus).toEqual({ id: f, sec: 1 });
      expect(focusPromptDue(g, pool)).toBe(false);
    });
  });
});
