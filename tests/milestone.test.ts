import { describe, expect, it } from 'vitest';
import { EventDataError, MILESTONES_PER_YEAR_MAX, advanceUntilDecision, createEventPool, isMilestoneEvent, lintEvents, milestoneWindowProblems, resolveChoiceStep, stepYear, type EventDef, type EventPool, type GameState } from '../src/core';
import { validateTrackedEventFiles as validateEventFiles } from './helpers/withTracks';
import { EARLY_YEARS_MAX_AGE, EVENT_FREQUENCY } from '../src/data/lifeTable';
import { EVENT_POOL } from '../src/data/events';
import { SIM_PROFILES, startLife } from '../scripts/simulateLib';
import { M7A_MILESTONES } from './helpers/m7a';

/**
 * 마일스톤 슬롯 (SPEC-003 IN3, M7a 마스터 결정 M-1 A안, r3: 한 해 여러 개): 일반 추첨과 별개로 한 줄을 남기고, 창의 마지막 해에는 100% 일어나며, 한 해에 여러 개(칸 MILESTONES_PER_YEAR_MAX)까지 일어난다(id 오름차순).
 * 엔진 규칙은 이 파일의 합성 풀로, 실제 데이터(첫 예방접종·첫 걸음마·첫 말)가 모든 판에 일어나는지는 tests/infantContent.test.ts가 시뮬레이션으로 본다.
 */

const poolOf = (...events: unknown[]): EventPool => createEventPool(validateEventFiles({ 'test.json': { events } }));

const milestone = (id: string, min: number, max: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `마일스톤 ${id}`,
  text: `${id}가 일어난 해의 기록입니다. 아이는 한 걸음 자랐습니다.`,
  stages: ['infant'],
  ageRange: { min, max },
  weight: 10,
  once: true,
  milestone: true,
  effects: { stats: { happiness: 3 } },
  ...over,
});

const regular = (id: string, min: number, max: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `일반 ${id}`,
  text: `${id}가 일어난 해의 기록입니다. 평범한 하루였습니다.`,
  stages: ['infant'],
  ageRange: { min, max },
  weight: 10,
  once: true,
  effects: { stats: { relationships: 1 } },
  ...over,
});

const choiceEvent = (id: string, min: number, max: number) => ({
  id,
  title: `결정 ${id}`,
  text: `${id}를 정해야 하는 해입니다. 어른들이 의논했습니다.`,
  stages: ['infant'],
  ageRange: { min, max },
  weight: 10,
  once: true,
  choices: [
    { id: 'a', label: '이쪽을 고른다', result: '이쪽을 골랐습니다. 하루가 지났습니다.', effects: { stats: { happiness: 1 } } },
    { id: 'b', label: '저쪽을 고른다', result: '저쪽을 골랐습니다. 하루가 지났습니다.', effects: { stats: { health: 1 } } },
  ],
});

const SEEDS = 600;
/** 시드로 0세 인생을 만들어 narrow한 합성 풀로 한 해씩 진행한다 */
function lifeYears(seed: number, pool: EventPool, years: number, chooseFirst = true): { states: GameState[]; ticks: ReturnType<typeof stepYear>['tick'][] } {
  let s = startLife(seed, 'alpha');
  const states: GameState[] = [s];
  const ticks: ReturnType<typeof stepYear>['tick'][] = [];
  for (let i = 0; i < years && s.phase === 'life'; i++) {
    if (s.pending !== null) {
      s = resolveChoiceStep(s, s.pending.key, chooseFirst ? s.pending.choiceIds[0] : s.pending.choiceIds[1], pool).state;
      states.push(s);
      continue;
    }
    const r = stepYear(s, pool);
    ticks.push(r.tick);
    s = r.state;
    states.push(s);
  }
  return { states, ticks };
}

const linesOf = (s: GameState, id: string) => s.history.filter((h) => h.eventId === id);

describe('스키마: milestone 필드 (서술 전용·once 전용·창의 양 끝)', () => {
  const files = (ev: unknown) => ({ 'x.json': { note: '모티브로만 새로 쓴 글이다.', events: [ev] } });

  it('올바른 마일스톤은 통과하고 isMilestoneEvent가 참이다', () => {
    const [ev] = validateEventFiles(files(milestone('ms', 1, 2)));
    expect(ev.milestone).toBe(true);
    expect(isMilestoneEvent(ev)).toBe(true);
    expect(isMilestoneEvent(validateEventFiles(files(regular('rg', 1, 2)))[0])).toBe(false);
    expect(isMilestoneEvent(validateEventFiles(files(milestone('ms', 1, 2, { milestone: false })))[0])).toBe(false);
  });

  it('선택지가 있는 마일스톤, once가 아닌 마일스톤, 창의 끝이 없는 마일스톤, 불리언이 아닌 값은 로드할 때 오류다', () => {
    const bad = (ev: unknown) => {
      try {
        validateEventFiles(files(ev));
      } catch (e) {
        expect(e).toBeInstanceOf(EventDataError);
        return (e as EventDataError).problems.join('\n');
      }
      throw new Error('오류가 나야 한다');
    };
    expect(bad({ ...choiceEvent('c', 1, 2), milestone: true })).toContain('선택지가 있으면 안 된다');
    expect(bad(milestone('ms', 1, 2, { once: false, cooldown: 12 }))).toContain('once:true여야 한다');
    expect(bad(milestone('ms', 1, 2, { ageRange: { min: 1 } }))).toContain('min과 max가 모두 있어야 한다');
    const noRange = { ...milestone('ms', 1, 2) } as Record<string, unknown>;
    delete noRange.ageRange;
    expect(bad(noRange)).toContain('min과 max가 모두 있어야 한다');
    expect(bad(milestone('ms', 1, 2, { milestone: 'yes' }))).toContain('true 또는 false');
  });
});

describe('stepYear의 마일스톤 슬롯', () => {
  it('창이 1~3세이면 창 안의 어느 해에든 일어나고(각 1/3), 창 마지막 해(3세)까지 모든 판에 한 번 일어난다 — 난수 잡음 안에서 균등하다', () => {
    const pool = poolOf(milestone('ms', 1, 3));
    const at = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 3000; seed++) {
      const { states } = lifeYears(seed, pool, 5);
      const final = states[states.length - 1];
      const lines = linesOf(final, 'ms');
      if (final.phase === 'ending' && (final.death?.age ?? 99) < 3) continue; // 창이 끝나기 전에 사망한 판은 제외
      expect(lines, `seed ${seed}: 마일스톤은 모든 판에 정확히 한 번`).toHaveLength(1);
      expect(lines[0].age).toBeGreaterThanOrEqual(1);
      expect(lines[0].age).toBeLessThanOrEqual(3);
      expect(final.seen.ms).toBe(lines[0].age);
      at[lines[0].age]++;
    }
    const total = at.reduce((a, b) => a + b, 0);
    expect(at[0] + at[4], '창 밖에서는 일어나지 않는다').toBe(0);
    for (const age of [1, 2, 3]) expect(at[age] / total, `${age}세`).toBeGreaterThan(0.28);
    for (const age of [1, 2, 3]) expect(at[age] / total, `${age}세`).toBeLessThan(0.39);
  });

  it('창이 한 해(0세)뿐이면 난수 없이 100%다', () => {
    const pool = poolOf(milestone('ms', 0, 0));
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = stepYear(startLife(seed, 'alpha'), pool);
      expect(linesOf(r.state, 'ms'), `seed ${seed}`).toHaveLength(1);
      expect(r.tick.kind === 'narrative' || r.tick.kind === 'death').toBe(true);
      expect(r.tick.eventId).toBe('ms');
    }
  });

  it('마일스톤은 일반 추첨 후보가 아니다: 창 안이라도 슬롯 확률로만 일어난다 (일반 서술 빈도가 더해지면 1세에 1/3이 아니라 훨씬 높다)', () => {
    const pool = poolOf(milestone('ms', 1, 3));
    let atOne = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      let s = startLife(seed, 'alpha');
      s = stepYear(s, pool).state; // 0세
      if (s.phase !== 'life') continue;
      s = stepYear(s, pool).state; // 1세
      if (linesOf(s, 'ms').length > 0) atOne++;
    }
    expect(atOne / 3000).toBeGreaterThan(0.28);
    expect(atOne / 3000).toBeLessThan(0.39);
  });

  it('그 해의 일반 서술 사건과 별개 줄이다: 마일스톤 줄이 먼저, 일반 사건 줄이 뒤에 남고 tick에 둘 다 있다 (한 해 두 줄)', () => {
    const pool = poolOf(milestone('ms', 1, 1), regular('rg', 1, 1));
    let both = 0;
    let onlyMilestone = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      let s = startLife(seed, 'alpha');
      s = stepYear(s, pool).state;
      if (s.phase !== 'life') continue;
      const r = stepYear(s, pool);
      const ms = linesOf(r.state, 'ms');
      const rg = linesOf(r.state, 'rg');
      expect(ms, `seed ${seed}`).toHaveLength(1);
      expect(ms[0].age).toBe(1);
      if (rg.length === 1) {
        both++;
        const hist = r.state.history;
        expect(hist.findIndex((h) => h.eventId === 'ms'), '마일스톤 줄이 먼저').toBeLessThan(hist.findIndex((h) => h.eventId === 'rg'));
        expect(r.tick).toMatchObject({ kind: 'narrative', fromAge: 1, eventId: 'rg', milestoneIds: ['ms'] });
        // 효과도 둘 다 적용된다: 행복 +3(마일스톤)·관계 +1(일반)
        expect(r.state.seen).toMatchObject({ ms: 1, rg: 1 });
      } else {
        onlyMilestone++;
        expect(r.tick).toMatchObject({ kind: 'narrative', eventId: 'ms' });
        expect(r.tick.milestoneIds).toEqual(['ms']); // 마일스톤만 있던 해: eventId도 마일스톤이다
      }
    }
    expect(both, '일반 사건이 같이 일어난 해').toBeGreaterThan(SEEDS * 0.5);
    expect(onlyMilestone, '마일스톤만 있던 해').toBeGreaterThan(SEEDS * 0.1);
  });

  it('선택지가 뜨는 해에도 마일스톤 줄은 이미 남는다: 결정 카드가 떠 있는 상태의 연표에 마일스톤 줄이 있고, 선택하면 마일스톤 → 선택 순서로 쌓인다', () => {
    const pool = poolOf(milestone('ms', 1, 1), choiceEvent('ch', 1, 1));
    let withChoice = 0;
    for (let seed = 1; seed <= SEEDS && withChoice < 40; seed++) {
      let s = startLife(seed, 'alpha');
      s = stepYear(s, pool).state;
      if (s.phase !== 'life' || s.pending !== null) continue;
      const r = stepYear(s, pool);
      if (r.state.pending === null) continue;
      withChoice++;
      expect(r.tick).toMatchObject({ kind: 'choice', eventId: 'ch', milestoneIds: ['ms'], fromAge: 1 });
      expect(linesOf(r.state, 'ms'), '결정이 떠 있어도 마일스톤 줄이 있다').toHaveLength(1);
      expect(r.state.age).toBe(1);
      const done = resolveChoiceStep(r.state, r.state.pending!.key, 'a', pool).state;
      const order = done.history.filter((h) => h.eventId === 'ms' || h.eventId === 'ch').map((h) => h.eventId);
      expect(order).toEqual(['ms', 'ch']);
      expect(done.age).toBe(2);
    }
    expect(withChoice, '공허 통과 방지: 마일스톤과 결정이 같은 해에 있던 판').toBeGreaterThanOrEqual(40);
  });

  it('한 해에 마일스톤이 여러 개 일어날 수 있다 (r3): 창이 겹치는 둘(1~2세·1~3세)이 같은 해에 모두 일어나는 판이 있고, 각자 창 끝까지 모든 판에 한 번씩 일어난다', () => {
    const pool = poolOf(milestone('ms-a', 1, 2), milestone('ms-b', 1, 3));
    let sameYear = 0;
    let checked = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const { states } = lifeYears(seed, pool, 6);
      const final = states[states.length - 1];
      if (final.phase === 'ending' && (final.death?.age ?? 99) < 3) continue;
      const a = linesOf(final, 'ms-a');
      const b = linesOf(final, 'ms-b');
      expect(a, `seed ${seed}: ms-a`).toHaveLength(1);
      expect(b, `seed ${seed}: ms-b`).toHaveLength(1);
      expect(a[0].age).toBeLessThanOrEqual(2);
      expect(b[0].age).toBeLessThanOrEqual(3);
      checked++;
      if (a[0].age === b[0].age) sameYear++;
    }
    // 서로 독립으로 뽑히므로 같은 해에 일어나는 판이 실제로 있다
    expect(sameYear / checked, '같은 해에 두 마일스톤이 모두 일어난 판의 비율').toBeGreaterThan(0.15);
  });

  it('창 끝이 같은 둘(1~1세)은 한 해에 모두 일어나고 연표에는 id 오름차순으로 남는다 — 선택지가 뜨는 해에도, 일반 사건과 함께 세 줄까지 (r3, R-362)', () => {
    const pool = poolOf(milestone('ms-z', 1, 1), milestone('ms-a', 1, 1), regular('rg', 1, 1), choiceEvent('ch', 1, 1));
    let withRegular = 0;
    let withChoice = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      let s = startLife(seed, 'alpha');
      s = stepYear(s, pool).state; // 0세
      if (s.phase !== 'life' || s.pending !== null) continue;
      const r = stepYear(s, pool); // 1세
      expect(linesOf(r.state, 'ms-a'), `seed ${seed}: ms-a 100%`).toHaveLength(1);
      expect(linesOf(r.state, 'ms-z'), `seed ${seed}: ms-z 100%`).toHaveLength(1);
      expect(r.tick.milestoneIds, `seed ${seed}: tick`).toEqual(['ms-a', 'ms-z']);
      const order = r.state.history.filter((h) => ['ms-a', 'ms-z', 'rg', 'ch'].includes(h.eventId ?? '')).map((h) => h.eventId);
      expect(order.slice(0, 2), `seed ${seed}: 마일스톤이 먼저, id 오름차순`).toEqual(['ms-a', 'ms-z']);
      if (r.state.pending !== null) {
        withChoice++;
        expect(r.tick).toMatchObject({ kind: 'choice', eventId: 'ch', milestoneIds: ['ms-a', 'ms-z'] });
      } else if (linesOf(r.state, 'rg').length === 1) {
        withRegular++;
        expect(order).toEqual(['ms-a', 'ms-z', 'rg']); // 한 해 세 줄
        expect(r.tick).toMatchObject({ kind: 'narrative', eventId: 'rg', milestoneIds: ['ms-a', 'ms-z'] });
      }
      expect(r.state.seen).toMatchObject({ 'ms-a': 1, 'ms-z': 1 });
    }
    expect(withRegular, '한 해 세 줄이 나온 판(공허 통과 방지)').toBeGreaterThan(30);
    expect(withChoice, '결정 카드와 두 마일스톤이 같은 해에 있던 판').toBeGreaterThan(10);
  });

  it('한 해 칸(MILESTONES_PER_YEAR_MAX = 3)이 있다: 같은 해에 끝나는 마일스톤이 칸 수 이하이면 모두 일어난다', () => {
    expect(MILESTONES_PER_YEAR_MAX).toBe(3);
    const pool = poolOf(milestone('ms-a', 1, 1), milestone('ms-b', 1, 1), milestone('ms-c', 1, 1));
    for (let seed = 1; seed <= 200; seed++) {
      let s = startLife(seed, 'alpha');
      s = stepYear(s, pool).state;
      if (s.phase !== 'life') continue;
      const r = stepYear(s, pool);
      expect(r.tick.milestoneIds, `seed ${seed}`).toEqual(['ms-a', 'ms-b', 'ms-c']);
    }
  });

  it('같은 시드는 같은 인생이다 (마일스톤의 난수 소비도 상태에서 정해진다): 두 번 돌려도 연표가 같고, 한 걸음마다 직렬화해도 같다', () => {
    const pool = poolOf(milestone('ms-a', 1, 2), milestone('ms-b', 1, 3), regular('rg', 0, 6), choiceEvent('ch', 1, 5));
    for (let seed = 1; seed <= 50; seed++) {
      const x = lifeYears(seed, pool, 8).states;
      const y = lifeYears(seed, pool, 8).states;
      expect(y.map((s) => s.history)).toEqual(x.map((s) => s.history));
      expect(y.map((s) => s.rngState)).toEqual(x.map((s) => s.rngState));
    }
  });

  it('마일스톤 후보가 없는 풀에서는 이전과 난수 소비가 같다 (마일스톤이 없으면 난수를 더 쓰지 않는다)', () => {
    const pool = poolOf(regular('rg', 0, 6), choiceEvent('ch', 1, 5));
    const withUnused = poolOf(regular('rg', 0, 6), choiceEvent('ch', 1, 5), milestone('ms-late', 5, 6, { stages: ['infant'] }));
    // 마일스톤이 아직 창에 들어오지 않은 나이(0~4세)에는 두 풀의 난수 상태가 같다
    for (let seed = 1; seed <= 100; seed++) {
      const a = lifeYears(seed, pool, 4).states;
      const b = lifeYears(seed, withUnused, 4).states;
      expect(b.map((s) => s.rngState)).toEqual(a.map((s) => s.rngState));
    }
  });
});

describe('7세는 영유아 빈도표를 쓴다 (M7a, EARLY_YEARS_MAX_AGE)', () => {
  it('상수와 표: 7세까지가 영유아 빈도, 8세부터는 학창 빈도다', () => {
    expect(EARLY_YEARS_MAX_AGE).toBe(7);
    expect(EVENT_FREQUENCY.infant.narrative).toBeGreaterThan(EVENT_FREQUENCY.school.narrative);
  });

  it('7세의 서술 사건 빈도 ≈ 영유아 서술 빈도, 8세는 학창 서술 빈도(0.3)다 — 후보가 하나뿐인 합성 풀로 잰다', () => {
    const at = (age: number) => {
      const pool = poolOf(regular(`rg${age}`, age, age, { stages: ['school'] }));
      let hit = 0;
      let n = 0;
      for (let seed = 1; seed <= 1500; seed++) {
        const g = { ...startLife(seed, 'alpha'), age, stats: startLife(seed, 'alpha').stats };
        const r = stepYear(g, pool);
        n++;
        if (linesOf(r.state, `rg${age}`).length > 0) hit++;
      }
      return hit / n;
    };
    expect(at(7)).toBeGreaterThan(EVENT_FREQUENCY.infant.narrative - 0.06);
    expect(at(7)).toBeLessThan(EVENT_FREQUENCY.infant.narrative + 0.06);
    expect(at(8)).toBeGreaterThan(EVENT_FREQUENCY.school.narrative - 0.06);
    expect(at(8)).toBeLessThan(EVENT_FREQUENCY.school.narrative + 0.06);
  });
});

describe('실제 마일스톤 데이터 (첫 예방접종·첫 걸음마·첫 말)', () => {
  const ms = EVENT_POOL.events.filter(isMilestoneEvent);

  it('정확히 세 개이고 창이 문서(content-M7a-infant.md 13-3절, r3)와 같다: 0세 · 1세 · 1세, 서술·once·영유아', () => {
    expect(ms.map((e) => e.id).sort()).toEqual(M7A_MILESTONES.map((m) => m.id).sort());
    for (const m of M7A_MILESTONES) {
      const ev = EVENT_POOL.byId.get(m.id)!;
      expect(ev.ageRange, m.id).toEqual({ min: m.min, max: m.max });
      expect(ev.once, m.id).toBe(true);
      expect(ev.choices, m.id).toBeUndefined();
      expect(ev.stages, m.id).toEqual(['infant']);
    }
  });

  it('걸음마와 첫 말은 창 끝이 같은 1세다 (r3: 한 해 여러 마일스톤이라 괜찮다) — 마감 해별 개수 ≤ 한 해 칸, 풀 점검 milestoneWindowProblems', () => {
    expect(ms.filter((e) => e.ageRange!.max === 1).map((e) => e.id).sort()).toEqual(['infant-first-steps', 'infant-first-word']);
    expect(ms.filter((e) => e.ageRange!.max === 1).length).toBeLessThanOrEqual(MILESTONES_PER_YEAR_MAX);
    expect(milestoneWindowProblems(EVENT_POOL.events)).toEqual([]);
    expect(lintEvents(EVENT_POOL.events).filter((m) => m.includes('마일스톤'))).toEqual([]);
  });

  it('milestoneWindowProblems (r3): 같은 해에 끝나는 마일스톤이 한 해 칸(3개)을 넘을 때만 잡는다 — 둘·셋은 통과 (같은 시대일 때만 센다)', () => {
    const mk = (id: string, max: number, yearRange?: { from?: number; to?: number }): EventDef => createEventPool(validateEventFiles({ 'x.json': { events: [milestone(id, 0, max, yearRange ? { track: 'standard', yearRange } : {})] } })).events[0];
    const PAST = { to: 2000 };
    const FUTURE = { from: 2001 };
    expect(milestoneWindowProblems([mk('ms-a', 2), mk('ms-b', 2)])).toEqual([]); // r2까지는 걸렸다 — 한 해 여러 개를 허용하면서 풀었다
    expect(milestoneWindowProblems([mk('ms-a', 2), mk('ms-b', 2), mk('ms-c', 2)])).toEqual([]);
    const four = [mk('ms-a', 2), mk('ms-b', 2), mk('ms-c', 2), mk('ms-d', 2)];
    expect(milestoneWindowProblems(four).join('\n')).toContain('4개의 창이 같은 2세에 끝난다');
    expect(milestoneWindowProblems(four)).toHaveLength(1); // 세 시대가 같은 문제를 세 번 적지 않는다
    expect(milestoneWindowProblems([mk('ms-a', 2), mk('ms-b', 2), mk('ms-c', 2), mk('ms-d', 3)])).toEqual([]); // 끝이 다르면 괜찮다
    // 연도 구간이 겹치지 않으면 괜찮다: 지난 구간(~2000) 셋 + 이후 구간(2001~) 둘
    expect(milestoneWindowProblems([mk('ms-a', 2, PAST), mk('ms-b', 2, PAST), mk('ms-c', 2, PAST), mk('ms-d', 2, FUTURE), mk('ms-e', 2, FUTURE)])).toEqual([]);
    expect(milestoneWindowProblems([mk('ms-a', 2, PAST), mk('ms-b', 2, PAST), mk('ms-c', 2, PAST), mk('ms-d', 2)]).length).toBe(1); // 지난 구간에 넷이 몰린다
  });

  it('스키마(R-371 ①): 창의 모든 나이가 stages에 덮여야 한다 — 6~7세 창에 stages: [infant]면 7세(학창 단계)가 비어 100%가 조용히 깨지므로 오류다', () => {
    const files = (ev: unknown) => ({ 'x.json': { note: '모티브로만 새로 쓴 글이다.', events: [ev] } });
    expect(() => validateEventFiles(files(milestone('ms', 6, 7, { stages: ['infant', 'school'] })))).not.toThrow();
    try {
      validateEventFiles(files(milestone('ms', 6, 7, { stages: ['infant'] })));
      throw new Error('오류가 나야 한다');
    } catch (e) {
      expect(e).toBeInstanceOf(EventDataError);
      expect((e as EventDataError).problems.join('\n')).toContain('창의 7세는 school 단계인데 stages에 없다');
    }
  });

  it('세 시대 × 1000판: 사망하지 않은 모든 판에 세 마일스톤이 창 안에서 한 번씩 일어난다 (IN3 100%) — 걸음마·첫 말은 모두 1세다 (r3: 나이 분포 1세 100%)', () => {
    for (const era of SIM_PROFILES) {
      let checked = 0;
      for (let i = 0; i < 1000; i++) {
        const seed = i * 7919 + 13;
        let s = startLife(seed, era);
        // 사망하거나 8세가 될 때까지 (선택지는 늘 첫 번째로)
        for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= 7; guard++) {
          s = s.pending !== null ? resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state : stepYear(s).state;
        }
        const deathAge = s.phase === 'ending' ? (s.death?.age ?? 0) : 99;
        for (const m of M7A_MILESTONES) {
          const lines = s.history.filter((h) => h.eventId === m.id);
          if (deathAge < m.max) continue; // 창이 끝나기 전에 사망한 판은 제외
          checked++;
          expect(lines, `${era} seed ${seed}: ${m.id}`).toHaveLength(1);
          expect(lines[0].age, `${era} seed ${seed}: ${m.id} 나이`).toBeGreaterThanOrEqual(m.min);
          expect(lines[0].age, `${era} seed ${seed}: ${m.id} 나이`).toBeLessThanOrEqual(m.max);
        }
      }
      expect(checked, `${era}: 센 판`).toBeGreaterThan(2900);
    }
  });

  it('advanceUntilDecision(다음 결정으로)도 마일스톤 줄을 남기고 결정 카드가 뜬 해에 멈춘다', () => {
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = advanceUntilDecision(startLife(seed, 'alpha'));
      if (r.state.pending === null) continue;
      const age = r.state.age;
      const lines = r.state.history.filter((h) => h.age <= age && h.eventId === 'infant-vaccine');
      expect(lines, `seed ${seed}`).toHaveLength(1); // 0세 마일스톤은 첫 결정 카드 전에 이미 연표에 있다
      seen++;
    }
    expect(seen).toBeGreaterThan(150);
  });
});
