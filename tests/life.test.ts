import { describe, expect, it } from 'vitest';
import lifeSrc from '../src/core/life.ts?raw';
import sessionSrc from '../src/core/session.ts?raw';
import eventsSrc from '../src/core/events.ts?raw';
import statsSrc from '../src/core/stats.ts?raw';
import timingSrc from '../src/core/timing.ts?raw';
import historySrc from '../src/core/history.ts?raw';
import {
  AUTO_TEMPERATURE,
  DEFAULT_SETTINGS,
  ERAS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  STAT_MAX,
  STAT_MIN,
  addDeltas,
  advanceUntilDecision,
  advanceYear,
  appendHistory,
  applyFlags,
  applyStatDeltas,
  autoChoiceWeights,
  autoResolveStep,
  clampStat,
  createEventPool,
  createInitialState,
  createRng,
  createSession,
  deathChance,
  educationGrowthPerYear,
  independenceWealth,
  isValidStat,
  loadGame,
  maxAgeOf,
  naturalDeltas,
  parseGame,
  playToEnd,
  resolveChoice,
  resolveChoiceStep,
  saveGame,
  serializeGame,
  sessionReducer,
  stepYear,
  validateEventFiles,
  type Character,
  type Era,
  type EventPool,
  type GameState,
  type HistoryEntry,
  type StorageLike,
} from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { EVENT_POOL } from '../src/data/events';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { startLife } from '../scripts/simulateLib';

const poolOf = (...events: unknown[]): EventPool => createEventPool(validateEventFiles({ 'test.json': { events } }));
const EMPTY_POOL = createEventPool([]);

const narrativeEvent = (over: Record<string, unknown> = {}) => ({
  id: 'n-event',
  title: '서술',
  text: '시험용 서술 이벤트의 본문 문장이다.',
  stages: ['school'],
  weight: 10,
  once: true,
  effects: { stats: { happiness: 1 } },
  ...over,
});
const choiceEvent = (over: Record<string, unknown> = {}) => ({
  id: 'c-event',
  title: '선택',
  text: '시험용 선택지 이벤트의 본문 문장이다.',
  stages: ['school'],
  weight: 10,
  once: true,
  choices: [
    { id: 'a', label: '첫째', result: '첫째를 골랐다. 결과 문장.', effects: { stats: { wealth: 3, happiness: -2 }, setFlags: ['picked_a'] } },
    { id: 'b', label: '둘째', result: '둘째를 골랐다. 결과 문장.', effects: { stats: { happiness: 4 } } },
  ],
  ...over,
});

/** 시드·시대 → 0세 인생 (캐릭터 속성을 덮어쓸 수 있다) */
function life(seed = 1, era: Era = 'present', character: Partial<Character> = {}, over: Partial<GameState> = {}): GameState {
  const s = startLife(seed, era);
  return { ...s, character: { ...s.character!, ...character }, ...over };
}

/** 이벤트 확률을 1로 만든 풀에서 첫 선택지 이벤트까지 진행한 상태 (대기 중인 선택지가 반드시 있다) */
function pendingState(pool = EVENT_POOL, seed = 5, era: Era = 'present'): GameState {
  for (let s = seed; s < seed + 200; s++) {
    const r = advanceUntilDecision(startLife(s, era), pool).state;
    if (r.phase === 'life' && r.pending !== null) return r;
  }
  throw new Error('선택지가 있는 시드를 찾지 못했다');
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('스탯 범위 정책 (한 곳: core/stats.ts, R-024)', () => {
  it('범위는 0~100이고 clampStat은 범위로 자르고 반올림한다', () => {
    expect([STAT_MIN, STAT_MAX]).toEqual([0, 100]);
    expect(clampStat(-5)).toBe(0);
    expect(clampStat(150)).toBe(100);
    expect(clampStat(49.5)).toBe(50);
    expect(clampStat(0)).toBe(0);
    expect(clampStat(100)).toBe(100);
    for (const bad of [NaN, Infinity, -Infinity]) expect(() => clampStat(bad)).toThrow(RangeError);
  });

  it('isValidStat: 0~100의 정수만', () => {
    for (const ok of [0, 1, 50, 99, 100]) expect(isValidStat(ok)).toBe(true);
    for (const bad of [-1, 101, 50.5, NaN, Infinity, '50', null, undefined]) expect(isValidStat(bad)).toBe(false);
  });

  it('applyStatDeltas: 더한 뒤 범위로 자른다(원본은 그대로), 적지 않은 스탯은 그대로', () => {
    const base = { wealth: 95, education: 3, health: 50, happiness: 50, relationships: 50 };
    const out = applyStatDeltas(base, { wealth: 20, education: -10, health: 7 });
    expect(out).toEqual({ wealth: 100, education: 0, health: 57, happiness: 50, relationships: 50 });
    expect(base.wealth).toBe(95);
    expect(addDeltas({ wealth: 2 }, { wealth: 3, health: -1 })).toEqual({ wealth: 5, health: -1 });
  });

  it('범위 숫자(0·100)를 직접 쓰는 곳은 stats.ts 하나뿐이다: 진행 로직 소스가 clamp를 직접 구현하지 않는다', () => {
    for (const src of [lifeSrc, sessionSrc, eventsSrc]) expect(src).not.toMatch(/Math\.(min|max)\(\s*100|Math\.max\(\s*0\s*,\s*Math\.min/);
    expect(statsSrc).toContain('STAT_MAX');
  });

  it('플래그: 끄고 켠다, 정렬·중복 없음, 같은 플래그가 둘 다면 켜는 쪽이 이긴다', () => {
    expect(applyFlags(['b', 'a'], ['c', 'a'], ['b'])).toEqual(['a', 'c']);
    expect(applyFlags([], ['x'], ['x'])).toEqual(['x']);
  });
});

describe('core 순수성: 진행 루프에 React·타이머·Date·Math.random이 없다', () => {
  it('life·events·session·stats·timing·history 소스 (주석 제외)', () => {
    const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const raw of [lifeSrc, sessionSrc, eventsSrc, statsSrc, timingSrc, historySrc]) {
      const src = stripComments(raw);
      expect(src.length).toBeGreaterThan(500); // 주석 제거가 소스를 통째로 지우지 않았다
      expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|requestAnimationFrame|from 'react'|document\.|window\./);
    }
  });
});

describe('한 해 진행 (stepYear / advanceYear)', () => {
  it('life가 아니거나 선택지가 대기 중이면 같은 상태 객체를 돌려준다 (연타·겹친 타이머가 한 해를 두 번 진행하지 못한다)', () => {
    const title = createInitialState(1);
    expect(stepYear(title).state).toBe(title);
    expect(stepYear(title).tick.kind).toBe('none');
    const pending = pendingState();
    const r = stepYear(pending);
    expect(r.state).toBe(pending);
    expect(r.tick.kind).toBe('none');
    expect(advanceYear(pending)).toBe(pending);
    const dead = playToEnd(life(2)).state;
    expect(dead.phase).toBe('ending');
    expect(advanceYear(dead)).toBe(dead);
  });

  it('한 걸음에 나이는 정확히 1살 오르거나(선택지가 아닐 때) 오르지 않는다(선택지에서 멈춤), 사망하면 나이는 그대로이고 phase가 ending이 된다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = life(seed);
      for (let i = 0; i < 400 && s.phase === 'life'; i++) {
        if (s.pending) {
          s = resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
          continue;
        }
        const before = s.age;
        const r = stepYear(s);
        if (r.tick.kind === 'choice') {
          expect(r.state.age, '선택지 앞에서는 나이가 오르지 않는다').toBe(before);
          expect(r.state.pending!.age).toBe(before);
        } else if (r.tick.kind === 'death') {
          expect(r.state.age).toBe(before);
          expect(r.state.phase).toBe('ending');
        } else {
          expect(r.state.age).toBe(before + 1);
        }
        s = r.state;
      }
      expect(s.phase).toBe('ending');
    }
  });

  it('같은 시드 + 같은 선택 → 같은 인생 / 다른 시드는 다른 인생', () => {
    const first = (s: GameState) => s.pending!.choiceIds[0];
    const a = playToEnd(life(77), first);
    const b = playToEnd(life(77), first);
    expect(a.state).toEqual(b.state);
    expect(a.counts).toEqual(b.counts);
    expect(playToEnd(life(78), first).state).not.toEqual(a.state);
    // 같은 시드라도 선택이 다르면(첫 번째 대신 마지막) 인생이 달라질 수 있다
    const lastChoice = playToEnd(life(77), (s) => s.pending!.choiceIds[s.pending!.choiceIds.length - 1]);
    expect(JSON.stringify(lastChoice.state)).not.toBe(JSON.stringify(a.state));
  });

  it('중간에 직렬화↔복원을 매 걸음 해도 연속으로 진행한 것과 완전히 같다 (대기 중인 선택지·플래그·본 이벤트·연표 포함)', () => {
    for (const era of ERAS) {
      for (const seed of [3, 31, 311]) {
        let direct = life(seed, era);
        let viaStorage = life(seed, era);
        for (let i = 0; i < 500 && direct.phase === 'life'; i++) {
          const next = (s: GameState): GameState => (s.pending ? resolveChoice(s, s.pending.key, s.pending.choiceIds[s.pending.choiceIds.length - 1]) : advanceYear(s));
          direct = next(direct);
          const restored = parseGame(serializeGame(next(viaStorage)));
          expect(restored, `${era} seed ${seed} step ${i}: 복원 실패`).not.toBeNull();
          viaStorage = restored!;
          expect(viaStorage).toEqual(direct);
        }
        expect(direct.phase).toBe('ending');
      }
    }
  });

  it('출생 직후부터 서술 이벤트는 효과와 연표를 남기고 본 이벤트(seen)에 기록된다 (같은 시드의 전/후로 정확한 변화량 확인)', () => {
    const pool = poolOf(narrativeEvent({ stages: ['infant'], ageRange: { min: 0, max: 0 }, effects: { stats: { happiness: 7 }, setFlags: ['saw_it'] }, weight: 100 }));
    // 서술 이벤트 확률(영유아 0.3)을 넘는 시드를 찾는다. 같은 시드의 before를 그대로 잡아 둔다.
    let found: { before: GameState; after: GameState } | null = null;
    for (let seed = 1; seed < 200 && !found; seed++) {
      const before = life(seed);
      const r = stepYear(before, pool);
      if (r.tick.kind === 'narrative') found = { before, after: r.state };
    }
    expect(found).not.toBeNull();
    const { before, after } = found!;
    expect(after.flags).toContain('saw_it');
    expect(after.seen['n-event']).toBe(0);
    expect(after.history[after.history.length - 1]).toMatchObject({ age: 0, kind: 'event', title: '서술', eventId: 'n-event' });
    // 효과 +7만큼 정확히 늘고, 영유아기 자연 변화는 학력뿐이다(naturalDeltas) → 나머지 스탯은 그대로, 나이는 한 살 많아진다.
    const growth = naturalDeltas(0, before.character!, before.stats, before.era!);
    expect(Object.keys(growth)).toEqual(['education']);
    expect(after.stats).toEqual({
      ...before.stats,
      happiness: Math.min(100, before.stats.happiness + 7),
      education: Math.min(100, before.stats.education + growth.education!),
    });
    expect(after.age).toBe(1);
  });
});

describe('선택지 이벤트: 대기 → 선택 → 효과·연표·플래그', () => {
  const pool = poolOf(
    choiceEvent({
      stages: ['infant'],
      ageRange: { min: 0, max: 6 },
      weight: 100,
      choices: [
        { id: 'a', label: '첫째', result: '첫째를 골랐다. 결과 문장.', effects: { stats: { wealth: 3, happiness: -2 }, setFlags: ['picked_a'] } },
        { id: 'b', label: '둘째', result: '둘째를 골랐다. 결과 문장.', effects: { stats: { happiness: 4 } } },
        {
          id: 'c',
          label: '셋째',
          result: '셋째를 골랐다. 결과 문장.',
          effects: { stats: { education: 5 } },
          bonuses: [{ when: { parentWealth: { min: 4 } }, effects: { stats: { education: 3 } } }],
          requires: { parentWealth: { min: 4 } },
        },
      ],
    }),
  );
  const rich = (): GameState => pendingState(pool, 1); // 재력은 시드에 따라 다르므로 아래에서 직접 지정
  const decision = (parentWealth: 1 | 5) => {
    for (let seed = 1; seed < 400; seed++) {
      const s = life(seed, 'present', { parentWealth });
      const d = advanceUntilDecision(s, pool).state;
      if (d.pending) return d;
    }
    throw new Error('결정을 찾지 못했다');
  };

  it('requires: 부모 재력이 낮으면 선택지가 2개, 높으면 3개가 보인다 (대기 상태에 보이는 선택지 id가 저장된다)', () => {
    expect(rich().pending!.choiceIds.length).toBeGreaterThanOrEqual(2);
    expect(decision(1).pending!.choiceIds).toEqual(['a', 'b']);
    expect(decision(5).pending!.choiceIds).toEqual(['a', 'b', 'c']);
  });

  it('대기 상태: key는 이벤트 id@나이, seen·lastChoiceAge에 기록되고 나이는 오르지 않는다', () => {
    const d = decision(1);
    expect(d.pending).toMatchObject({ eventId: 'c-event', key: `c-event@${d.age}`, age: d.age });
    expect(d.seen['c-event']).toBe(d.age);
    expect(d.lastChoiceAge).toBe(d.age);
    expect(d.phase).toBe('life');
  });

  it('선택하면 효과(스탯·플래그)가 적용되고 연표에 선택 내용이 남고 대기가 풀리며 한 해가 지난다', () => {
    const d = decision(1);
    const r = resolveChoiceStep(d, d.pending!.key, 'a', pool);
    const s = r.state;
    expect(s.pending).toBeNull();
    expect(s.flags).toContain('picked_a');
    expect(s.age).toBe(d.age + 1);
    expect(r.tick).toMatchObject({ kind: 'resolved', eventId: 'c-event', fromAge: d.age });
    const entry = s.history[s.history.length - 1];
    expect(entry).toMatchObject({ kind: 'choice', eventId: 'c-event', age: d.age, title: '선택', choice: '첫째', text: '첫째를 골랐다. 결과 문장.' });
    // 재산 +3, 행복 -2 (나이를 한 해 먹으며 자연 변화도 있으므로 방향만 확인)
    expect(s.stats.wealth).toBeGreaterThanOrEqual(d.stats.wealth + 3);
    expect(s.stats.happiness).toBe(d.stats.happiness - 2);
  });

  it('보너스: 같은 선택도 부모 재력에 따라 효과가 다르다 (셋째: 학력 +5, 재력 4 이상이면 +3 더)', () => {
    const d = decision(5);
    const s = resolveChoice(d, d.pending!.key, 'c', pool);
    const growth = naturalDeltas(d.age, d.character!, d.stats, d.era!).education ?? 0;
    expect(s.stats.education).toBe(Math.min(100, d.stats.education + 5 + 3 + growth));
  });

  it('틀린 key / 없는 선택지 id / 보이지 않는 선택지(requires 불충족)는 상태를 바꾸지 않는다', () => {
    const d = decision(1);
    expect(resolveChoice(d, 'c-event@999', 'a', pool)).toBe(d);
    expect(resolveChoice(d, d.pending!.key, 'no-such', pool)).toBe(d);
    expect(resolveChoice(d, d.pending!.key, 'c', pool)).toBe(d); // 재력이 낮아 안 보이는 선택지
    expect(resolveChoice(d, 'x', 'a', pool)).toBe(d);
    expect(resolveChoiceStep(d, d.pending!.key, 'zzz', pool).tick.kind).toBe('none');
  });

  it('같은 선택을 연달아 두 번 보내도 두 번째는 무시된다 (대기가 이미 풀려 있다)', () => {
    const d = decision(1);
    const once = resolveChoice(d, d.pending!.key, 'b', pool);
    expect(resolveChoice(once, d.pending!.key, 'b', pool)).toBe(once);
    expect(once.history.filter((h) => h.kind === 'choice')).toHaveLength(1);
  });

  it('다음 선택지(키가 다른)에는 이전 선택지의 입력이 닿지 않는다', () => {
    // 첫 선택 뒤에 두 번째 선택지가 나오는 시드를 찾는다(못 찾으면 테스트가 실패한다 — 조건이 안 맞아 단언을 건너뛰지 않는다).
    let found: { oldKey: string; next: GameState } | null = null;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const d = advanceUntilDecision(life(seed)).state;
      if (d.phase !== 'life' || d.pending === null) continue;
      const afterFirst = resolveChoice(d, d.pending.key, d.pending.choiceIds[0]);
      const next = advanceUntilDecision(afterFirst).state;
      if (next.phase === 'life' && next.pending !== null) found = { oldKey: d.pending.key, next };
    }
    expect(found, '두 번째 선택지가 나오는 시드').not.toBeNull();
    const { oldKey, next } = found!;
    expect(next.pending!.key).not.toBe(oldKey);
    expect(resolveChoice(next, oldKey, next.pending!.choiceIds[0])).toBe(next); // 늦게 도착한 입력은 무시
  });

  it('선택지 이벤트 사이에는 최소 간격(MIN_YEARS_BETWEEN_CHOICES)이 있다: 선택지가 연달아 나오지 않는다', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = life(seed);
      let last: number | null = null;
      for (let i = 0; i < 400 && s.phase === 'life'; i++) {
        s = advanceUntilDecision(s).state;
        if (s.phase !== 'life' || !s.pending) break;
        if (last !== null) expect(s.pending.age - last, `seed ${seed}`).toBeGreaterThanOrEqual(2);
        last = s.pending.age;
        s = resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
      }
    }
  });
});

describe('플래그가 이후 이벤트를 열고 닫는다 (진행 루프 경유)', () => {
  // opener(선택지, 영유아 0세)가 plan_flag를 켜고, later(서술, 학창)는 plan_flag가 있어야, blocked(서술, 학창)는 plan_flag가 없어야 나온다.
  const pool = poolOf(
    choiceEvent({
      id: 'opener',
      stages: ['infant'],
      ageRange: { min: 0, max: 6 },
      weight: 100,
      choices: [
        { id: 'open', label: '연다', result: '문을 열었다. 결과 문장이다.', effects: { setFlags: ['plan_flag'] } },
        { id: 'skip', label: '넘긴다', result: '그냥 넘겼다. 결과 문장이다.' },
      ],
    }),
    narrativeEvent({ id: 'later', stages: ['school'], once: false, cooldown: 1, conditions: { flags: ['plan_flag'] }, weight: 100 }),
    narrativeEvent({ id: 'blocked', stages: ['school'], once: false, cooldown: 1, conditions: { notFlags: ['plan_flag'] }, weight: 100 }),
  );

  function schoolEventsAfter(chooseId: string): Set<string> {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      let s = life(seed);
      s = advanceUntilDecision(s, pool).state;
      if (!s.pending) continue;
      s = resolveChoice(s, s.pending.key, chooseId, pool);
      // 학창기 동안만 본다(서술 이벤트만 있는 풀이라 선택지는 더 없다)
      while (s.phase === 'life' && s.age < 20) s = advanceYear(s, pool);
      for (const h of s.history) if (h.eventId === 'later' || h.eventId === 'blocked') seen.add(h.eventId);
    }
    return seen;
  }

  it('플래그를 켜는 선택 뒤에는 later만 나오고 blocked는 닫힌다', () => {
    expect([...schoolEventsAfter('open')]).toEqual(['later']);
  });

  it('플래그를 켜지 않은 선택 뒤에는 blocked만 나오고 later는 열리지 않는다', () => {
    expect([...schoolEventsAfter('skip')]).toEqual(['blocked']);
  });

  it('조건으로 닫혀 있으면 아무리 진행해도 그 이벤트는 일어나지 않는다 (풀에 그것뿐일 때 한 번도 안 나온다)', () => {
    const onlyGated = poolOf(narrativeEvent({ stages: ['school'], once: false, cooldown: 1, conditions: { flags: ['never_set'] }, weight: 100 }), narrativeEvent({ id: 'setter', stages: ['senior'], effects: { setFlags: ['never_set'] } }));
    for (let seed = 1; seed <= 20; seed++) {
      let s = life(seed);
      while (s.phase === 'life' && s.age < 20) s = advanceYear(s, onlyGated);
      expect(s.history.some((h) => h.eventId === 'n-event')).toBe(false);
    }
  });
});

describe('사망: 건강과 나이에 따른 확률 + 절대 상한 나이', () => {
  it('deathChance: 0~1, 나이가 들수록(20세 이후) 커지고 건강이 나쁠수록 커진다', () => {
    for (const era of ERAS) {
      let prev = 0;
      for (let age = 20; age <= 100; age += 5) {
        const q = deathChance(age, 50, era);
        expect(q).toBeGreaterThanOrEqual(0);
        expect(q).toBeLessThanOrEqual(1);
        expect(q).toBeGreaterThan(prev);
        prev = q;
      }
      for (let health = 100; health > 0; health -= 10) {
        expect(deathChance(60, health - 10, era)).toBeGreaterThan(deathChance(60, health, era));
      }
    }
  });

  it('건강 계수: 건강 50 대비 75는 반(1/2), 25는 두 배 — 같은 나이·시대', () => {
    for (const era of ERAS) {
      const base = deathChance(60, 50, era);
      expect(deathChance(60, 75, era)).toBeCloseTo(base / 2, 12);
      expect(deathChance(60, 25, era)).toBeCloseTo(base * 2, 12);
    }
  });

  it('건강이 위험 수준(15 미만) 아래로 내려가면 확률이 추가로 크게 오른다', () => {
    expect(deathChance(30, 0, 'present')).toBeGreaterThan(0.15);
    expect(deathChance(30, 20, 'present')).toBeLessThan(0.01);
  });

  it('시대 계수: 같은 나이·건강이면 지난 세상 > 지금 세상 > 다가올 세상', () => {
    for (const age of [10, 40, 70, 90]) {
      expect(deathChance(age, 50, 'past')).toBeGreaterThan(deathChance(age, 50, 'present'));
      expect(deathChance(age, 50, 'present')).toBeGreaterThan(deathChance(age, 50, 'future'));
    }
  });

  it('절대 상한 나이: 시대별 상한 나이에서는 건강이 100이어도 반드시 사망한다 (연표에 나이·원인이 남는다)', () => {
    for (const era of ERAS) {
      const max = maxAgeOf(era);
      expect(max).toBe(ERA_CONFIG[era].life.maxAge);
      for (let seed = 1; seed <= 5; seed++) {
        const base = life(seed, era);
        const s = { ...base, age: max, stats: { ...base.stats, health: 100 }, history: base.history };
        const r = stepYear(s, EMPTY_POOL);
        expect(r.tick.kind).toBe('death');
        expect(r.state.phase).toBe('ending');
        expect(r.state.death).toMatchObject({ age: max });
        expect(r.state.death!.cause.length).toBeGreaterThan(0);
        expect(r.state.history[r.state.history.length - 1]).toMatchObject({ kind: 'death', age: max });
        expect(r.state.history[r.state.history.length - 1].text).toContain(r.state.death!.cause);
      }
    }
  });

  it('상한 나이 직전(상한-1세)에는 건강하면 보통 살아서 다음 해로 간다 (상한 규칙이 모두를 죽이지는 않는다)', () => {
    let alive = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const base = life(seed, 'future');
      const s = { ...base, age: maxAgeOf('future') - 1, stats: { ...base.stats, health: 100 } };
      if (stepYear(s, EMPTY_POOL).state.phase === 'life') alive++;
    }
    expect(alive).toBeGreaterThan(0);
  });

  it('시대별 상한 나이는 지난 100 / 지금 105 / 다가올 110', () => {
    expect([maxAgeOf('past'), maxAgeOf('present'), maxAgeOf('future')]).toEqual([100, 105, 110]);
  });

  it('사망하면 phase가 ending이 되고 death가 채워지며, 사망 이후에는 진행도 선택도 되지 않는다', () => {
    const end = playToEnd(life(9)).state;
    expect(end.phase).toBe('ending');
    expect(end.death).not.toBeNull();
    expect(end.death!.age).toBe(end.age);
    expect(end.pending).toBeNull();
    expect(stepYear(end).state).toBe(end);
    expect(end.history.filter((h) => h.kind === 'death')).toHaveLength(1);
    expect(end.history[end.history.length - 1].kind).toBe('death');
  });
});

describe('단계별 자연 변화와 출생 학력 의미 (R-025)', () => {
  const c = (parentWealth: Character['parentWealth'], parenting: Character['parenting']): Character => ({
    name: '김민준', gender: 'male', birthYear: 2012, parentWealth, parenting, looks: 50,
  });
  const st = { wealth: 50, education: 50, health: 50, happiness: 50, relationships: 50 };

  it('학창기 연간 학력 증가: 재력·교육방식 표를 직접 적은 값과 같다 (기본 2 + 재력 보정 + 방식 보정, 1~4로 자름)', () => {
    // 재력 보정 [-1, 0, 0, +1, +1], 방식 보정 {방임 -1, 자유 0, 헬리콥터 +1, 엄격 +1}
    expect(educationGrowthPerYear(c(1, 'neglect'))).toBe(1); // 0 → 최소 1
    expect(educationGrowthPerYear(c(1, 'free'))).toBe(1);
    expect(educationGrowthPerYear(c(3, 'free'))).toBe(2);
    expect(educationGrowthPerYear(c(3, 'strict'))).toBe(3);
    expect(educationGrowthPerYear(c(4, 'helicopter'))).toBe(4);
    expect(educationGrowthPerYear(c(5, 'helicopter'))).toBe(4); // 4 → 최대 4
    expect(educationGrowthPerYear(c(2, 'neglect'))).toBe(1);
    for (const w of PARENT_WEALTHS) for (const p of PARENTING_STYLES) {
      const g = educationGrowthPerYear(c(w, p));
      expect(g).toBeGreaterThanOrEqual(1);
      expect(g).toBeLessThanOrEqual(4);
    }
  });

  it('단계별 자연 변화: 영유아·학창은 학력이 자라고, 노년은 건강이 해마다 줄며 80세부터 더 빠르다', () => {
    expect(naturalDeltas(3, c(3, 'free'), st, 'present')).toEqual({ education: 1 });
    expect(naturalDeltas(10, c(3, 'strict'), st, 'present').education).toBe(3);
    expect(naturalDeltas(66, c(3, 'free'), st, 'present').health).toBe(-1);
    expect(naturalDeltas(79, c(3, 'free'), st, 'present').health).toBe(-1);
    expect(naturalDeltas(80, c(3, 'free'), st, 'present').health).toBe(-2);
    expect(naturalDeltas(81, c(3, 'free'), st, 'present').health).toBe(-1);
    expect(naturalDeltas(82, c(3, 'free'), st, 'present').health).toBe(-2);
  });

  it('청년·중년: 건강은 간격을 두고 조금씩 줄고, 재산은 학력이 높을수록 자주 늘어난다', () => {
    expect(naturalDeltas(30, c(3, 'free'), st, 'present').health).toBe(-1);
    expect(naturalDeltas(31, c(3, 'free'), st, 'present').health).toBeUndefined();
    expect(naturalDeltas(35, c(3, 'free'), st, 'present').health).toBe(-1);
    expect(naturalDeltas(25, c(3, 'free'), st, 'present').health).toBeUndefined(); // 30세 전에는 줄지 않는다
    expect(naturalDeltas(40, c(3, 'free'), st, 'present').health).toBe(-1);
    expect(naturalDeltas(41, c(3, 'free'), st, 'present').health).toBeUndefined();
    expect(naturalDeltas(43, c(3, 'free'), st, 'present').health).toBe(-1);
    // 청년기 소득 간격: 학력 70 이상 2년, 40 이상 3년, 그 미만 6년마다 +1
    expect(naturalDeltas(22, c(3, 'free'), { ...st, education: 80 }, 'present').wealth).toBe(1);
    expect(naturalDeltas(23, c(3, 'free'), { ...st, education: 80 }, 'present').wealth).toBeUndefined();
    expect(naturalDeltas(24, c(3, 'free'), { ...st, education: 50 }, 'present').wealth).toBe(1);
    expect(naturalDeltas(22, c(3, 'free'), { ...st, education: 50 }, 'present').wealth).toBeUndefined();
    expect(naturalDeltas(25, c(3, 'free'), { ...st, education: 10 }, 'present').wealth).toBeUndefined();
    expect(naturalDeltas(24, c(3, 'free'), { ...st, education: 10 }, 'present').wealth).toBe(1); // 24는 6의 배수
    expect(naturalDeltas(27, c(3, 'free'), { ...st, education: 10 }, 'present').wealth).toBeUndefined();
  });

  it('노년 생활비: 물가(priceIndex)가 높은 시대일수록 재산이 더 자주 줄어든다 (지난 13년 / 지금 4년 / 다가올 3년마다 -1)', () => {
    const wealthDeltaAges = (era: Era) => Array.from({ length: 36 }, (_, i) => 65 + i).filter((age) => naturalDeltas(age, c(3, 'free'), st, era).wealth === -1);
    expect(wealthDeltaAges('present').every((a) => a % 4 === 0)).toBe(true);
    expect(wealthDeltaAges('future').every((a) => a % 3 === 0)).toBe(true);
    expect(wealthDeltaAges('past').every((a) => a % 13 === 0)).toBe(true);
    expect(wealthDeltaAges('future').length).toBeGreaterThan(wealthDeltaAges('present').length);
    expect(wealthDeltaAges('present').length).toBeGreaterThan(wealthDeltaAges('past').length);
  });

  it('독립(20세): 재산이 집안 형편에서 내가 가진 것으로 바뀐다 — 직접 적은 값과 같다', () => {
    expect(independenceWealth(92, 60)).toBe(68); // 0.5×92 + 0.2×60 + 10
    expect(independenceWealth(8, 40)).toBe(22); // 4 + 8 + 10
    expect(independenceWealth(0, 0)).toBe(10);
    expect(independenceWealth(100, 100)).toBe(80);
  });

  it('이벤트 없는 풀에서 단계 진입 문구가 7·20·40·65세에 한 번씩 남고, 20세에 독립 변환이 정확히 한 번 일어난다', () => {
    let checked = 0;
    for (let seed = 1; seed <= 300 && checked < 3; seed++) {
      const start = life(seed, 'future');
      let s = start;
      let before20: GameState | null = null;
      while (s.phase === 'life') {
        const r = advanceYear(s, EMPTY_POOL);
        if (r.age === 20 && s.age === 19) before20 = s;
        s = r;
      }
      if (s.death!.age < 66 || before20 === null) continue;
      checked++;
      const stageLines = s.history.filter((h) => h.kind === 'stage');
      expect(stageLines.map((h) => h.age)).toEqual([0, 7, 20, 40, 65]);
      // 19세 마지막 해의 자연 변화가 끝난 직후 독립 변환이 적용된 값
      const after19 = applyStatDeltas(before20.stats, naturalDeltas(19, before20.character!, before20.stats, 'future'));
      const at20 = [...s.history].find((h) => h.kind === 'stage' && h.age === 20);
      expect(at20).toBeDefined();
      const state20 = (() => {
        let t = start;
        while (t.age < 20) t = advanceYear(t, EMPTY_POOL);
        return t;
      })();
      expect(state20.stats.wealth).toBe(independenceWealth(after19.wealth, after19.education));
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('출생 학력은 0~15의 낮은 값이다: 3시대 × 2000시드 (0세에 학력이 높게 시작하지 않는다), birthStats와 같은 의미', () => {
    for (const era of ERAS) {
      let max = 0;
      let sum = 0;
      const n = 2000;
      for (let seed = 1; seed <= n; seed++) {
        const s = startLife(seed * 17, era);
        expect(s.birthStats!.education).toBe(s.stats.education);
        max = Math.max(max, s.stats.education);
        sum += s.stats.education;
      }
      expect(max, era).toBeLessThanOrEqual(15);
      expect(sum / n, era).toBeLessThan(10);
    }
  });

  it('가정의 교육 여건은 출생 값이 아니라 성장 속도로 반영된다: 이벤트 없이 19세가 되면 부유+헬리콥터가 가난+방임보다 학력이 훨씬 높다', () => {
    const eduAt19 = (parentWealth: Character['parentWealth'], parenting: Character['parenting']) => {
      let sum = 0;
      for (let seed = 1; seed <= 40; seed++) {
        let s = life(seed, 'present', { parentWealth, parenting });
        while (s.phase === 'life' && s.age < 19) s = advanceYear(s, EMPTY_POOL);
        sum += s.stats.education;
      }
      return sum / 40;
    };
    expect(eduAt19(5, 'helicopter') - eduAt19(1, 'neglect')).toBeGreaterThan(20);
  });
});

describe('연표(history) 저장 상한/요약 정책', () => {
  const entry = (i: number, kind: HistoryEntry['kind']): HistoryEntry => ({ age: i % 100, kind, text: `기록 ${i}` });

  it('상한(maxEntries)을 넘기지 않는다: 서술 이벤트부터 버리고, 출생(맨 앞)·선택지·사망은 끝까지 남는다', () => {
    let h: HistoryEntry[] = [{ age: 0, kind: 'stage', text: '태어났다' }];
    for (let i = 1; i <= 300; i++) h = appendHistory(h, entry(i, i % 10 === 0 ? 'choice' : 'event'));
    h = appendHistory(h, { age: 90, kind: 'death', text: '세상을 떠났다.' });
    expect(h.length).toBeLessThanOrEqual(HISTORY_LIMITS.maxEntries);
    expect(h[0]).toMatchObject({ kind: 'stage', text: '태어났다' });
    expect(h[h.length - 1].kind).toBe('death');
    // 선택지 30개는 모두 남아 있다 (서술 이벤트만 줄었다)
    expect(h.filter((e) => e.kind === 'choice')).toHaveLength(30);
    expect(h.filter((e) => e.kind === 'event').length).toBeLessThan(270);
  });

  it('서술이 더 없으면 오래된 선택지 기록, 그다음 단계 기록 순으로 버린다 (출생·방금 넣은 항목은 남는다)', () => {
    let h: HistoryEntry[] = [{ age: 0, kind: 'stage', text: '태어났다' }];
    for (let i = 1; i <= HISTORY_LIMITS.maxEntries + 20; i++) h = appendHistory(h, entry(i, 'choice'));
    expect(h).toHaveLength(HISTORY_LIMITS.maxEntries);
    expect(h[0].text).toBe('태어났다');
    expect(h[h.length - 1].text).toBe(`기록 ${HISTORY_LIMITS.maxEntries + 20}`);
    expect(h[1].text).toBe('기록 22'); // 출생 다음 가장 오래된 21개(기록 1~21)가 사라졌다
    let st: HistoryEntry[] = [{ age: 0, kind: 'stage', text: '태어났다' }];
    for (let i = 1; i <= HISTORY_LIMITS.maxEntries + 5; i++) st = appendHistory(st, entry(i, 'stage'));
    expect(st).toHaveLength(HISTORY_LIMITS.maxEntries);
    expect(st[0].text).toBe('태어났다');
  });

  it('긴 문구는 길이 상한으로 잘린다 (원본 항목은 건드리지 않는다)', () => {
    const long: HistoryEntry = { age: 1, kind: 'choice', text: '가'.repeat(1000), title: '나'.repeat(200), choice: '다'.repeat(500) };
    const h = appendHistory([], long);
    expect(h[0].text.length).toBe(HISTORY_LIMITS.maxTextLength);
    expect(h[0].title!.length).toBe(HISTORY_LIMITS.maxTitleLength);
    expect(h[0].choice!.length).toBe(HISTORY_LIMITS.maxChoiceLength);
    expect(long.text).toHaveLength(1000);
  });

  it('실제 한 판의 연표는 상한보다 훨씬 작고 저장 크기가 작다 (한 판 직렬화 40KB 이내)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 50; seed++) {
        const end = playToEnd(life(seed, era)).state;
        expect(end.history.length).toBeLessThan(HISTORY_LIMITS.maxEntries / 2);
        expect(serializeGame(end).length).toBeLessThan(40_000);
      }
    }
  });
});

describe('자동 모드: 성향 기반 선택', () => {
  // 선택 a는 학력, b는 행복을 올리는 이벤트
  const pool = poolOf(
    choiceEvent({
      stages: ['infant'],
      ageRange: { min: 0, max: 6 },
      weight: 100,
      choices: [
        { id: 'a', label: '공부', result: '공부를 골랐다. 결과 문장이다.', effects: { stats: { education: 6 } } },
        { id: 'b', label: '놀이', result: '놀이를 골랐다. 결과 문장이다.', effects: { stats: { happiness: 6 } } },
      ],
    }),
  );
  const decisionFor = (character: Partial<Character>, stats: Partial<GameState['stats']> = {}) => {
    for (let seed = 1; seed < 500; seed++) {
      const d = advanceUntilDecision(life(seed, 'present', character), pool).state;
      if (d.pending) return { ...d, stats: { ...d.stats, ...stats } };
    }
    throw new Error('결정을 찾지 못했다');
  };

  it('가중치는 순수 계산이다: 같은 상태 → 같은 값, 선택지 순서는 pending.choiceIds와 같고 모두 양수', () => {
    const d = decisionFor({ parenting: 'free' });
    const w1 = autoChoiceWeights(d, pool)!;
    const w2 = autoChoiceWeights(d, pool)!;
    expect(w1).toEqual(w2);
    expect(w1.ids).toEqual(d.pending!.choiceIds);
    for (const w of w1.weights) expect(w).toBeGreaterThan(0);
    expect(autoChoiceWeights(life(1), pool)).toBeNull();
  });

  it('교육방식이 성향을 만든다: 엄격은 학력 쪽, 자유는 행복 쪽 선택지를 더 높게 친다', () => {
    const strict = autoChoiceWeights(decisionFor({ parenting: 'strict' }, { education: 50, happiness: 50 }), pool)!;
    const free = autoChoiceWeights(decisionFor({ parenting: 'free' }, { education: 50, happiness: 50 }), pool)!;
    const ratio = (w: { weights: number[] }) => w.weights[0] / w.weights[1]; // 학력 / 행복
    expect(ratio(strict)).toBeGreaterThan(1);
    expect(ratio(free)).toBeLessThan(1);
    expect(ratio(strict)).toBeGreaterThan(ratio(free));
  });

  it('현재 스탯이 성향에 영향을 준다: 행복이 낮을수록 행복을 올리는 선택지를 더 높게 친다', () => {
    const low = autoChoiceWeights(decisionFor({ parenting: 'free' }, { happiness: 10, education: 50 }), pool)!;
    const high = autoChoiceWeights(decisionFor({ parenting: 'free' }, { happiness: 90, education: 50 }), pool)!;
    expect(low.weights[1] / low.weights[0]).toBeGreaterThan(high.weights[1] / high.weights[0]);
  });

  it('점수를 온도로 나눠 지수로 가중치를 만든다: 같은 입력 규모면 온도(AUTO_TEMPERATURE)가 가중치 비율을 정한다', () => {
    const d = decisionFor({ parenting: 'helicopter' }, { education: 50, happiness: 50 });
    const w = autoChoiceWeights(d, pool)!;
    // helicopter: 학력 1.3 / 행복 0.9, 스탯 50이면 필요도 1 → 점수 6×1.3 vs 6×0.9
    expect(w.weights[0] / w.weights[1]).toBeCloseTo(Math.exp((6 * 1.3 - 6 * 0.9) / AUTO_TEMPERATURE), 10);
  });

  it('결정적이고 시드 RNG를 쓴다: 같은 상태에서 자동 선택 결과가 같고, 시드가 다르면 섞여서 두 선택지가 모두 나온다', () => {
    const d = decisionFor({ parenting: 'free' });
    const a = autoResolveStep(d, d.pending!.key, pool);
    expect(autoResolveStep(d, d.pending!.key, pool)).toEqual(a);
    const picked = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const s = advanceUntilDecision(life(seed, 'present', { parenting: 'free' }), pool).state;
      if (!s.pending) continue;
      const r = autoResolveStep(s, s.pending.key, pool).state;
      picked.add([...r.history].reverse().find((h) => h.kind === 'choice')!.choice!);
    }
    expect(picked).toEqual(new Set(['공부', '놀이']));
  });

  /**
   * 자동 선택 한 걸음의 결과에서 "어느 선택지를 골랐는지"를 거꾸로 읽는다(연표에 남은 선택 문구 → 선택지 id).
   * 구현의 난수 사용 방식을 복제하지 않고 결과만 보고 판단하므로, R-039의 동치 단언이 구현을 그대로 되풀이하지 않는다.
   */
  function pickedId(before: GameState, after: GameState, p: EventPool): string {
    const label = [...after.history].reverse().find((h) => h.kind === 'choice')!.choice;
    const ev = p.byId.get(before.pending!.eventId)!;
    const matches = ev.choices!.filter((c) => c.label === label && before.pending!.choiceIds.includes(c.id));
    expect(matches, `선택 문구 "${label}"`).toHaveLength(1);
    return matches[0].id;
  }

  it('자동이 고른 선택지를 수동으로 고르면 이후 상태가 완전히 같다 (R-039): 한 걸음 — 같은 시드, 시대 3개, 실제 이벤트 풀', () => {
    let checked = 0;
    for (const era of ERAS) {
      for (let seed = 1; seed <= 60; seed++) {
        const d = advanceUntilDecision(life(seed, era)).state;
        if (d.phase !== 'life' || d.pending === null) continue;
        const auto = autoResolveStep(d, d.pending.key).state;
        const manual = resolveChoice(d, d.pending.key, pickedId(d, auto, EVENT_POOL));
        expect(manual, `${era} ${seed}`).toEqual(auto); // 난수 상태(rngState)·연표·스탯·플래그 전부
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('한 판 전체: 자동 모드가 고른 선택을 수동으로 따라 하거나 자동과 수동을 섞어도 최종 상태가 자동으로 끝까지 간 것과 완전히 같다 (R-039)', () => {
    let decisions = 0;
    for (const era of ERAS) {
      for (let seed = 1; seed <= 25; seed++) {
        const start = life(seed, era);
        // 자동으로 끝까지 가며 고른 선택을 기록한다.
        const picks: string[] = [];
        let s = start;
        while (s.phase === 'life') {
          if (s.pending) {
            const after = autoResolveStep(s, s.pending.key).state;
            picks.push(pickedId(s, after, EVENT_POOL));
            s = after;
          } else {
            s = stepYear(s).state;
          }
        }
        const autoEnd = s;
        expect(playToEnd(start, null).state).toEqual(autoEnd);
        decisions += picks.length;

        // 같은 선택을 전부 수동으로
        let i = 0;
        expect(playToEnd(start, () => picks[i++]).state, `${era} ${seed}: 전부 수동`).toEqual(autoEnd);

        // 자동과 수동을 섞어서(어느 결정을 자동으로 할지는 시드 RNG로 정한다) — 어떤 순서로 섞어도 같다
        const mixRng = createRng(seed * 31 + 7);
        let m = start;
        let j = 0;
        while (m.phase === 'life') {
          if (m.pending) {
            m = mixRng.next() < 0.5 ? autoResolveStep(m, m.pending.key).state : resolveChoice(m, m.pending.key, picks[j]);
            j++;
          } else {
            m = stepYear(m).state;
          }
        }
        expect(m, `${era} ${seed}: 섞어서`).toEqual(autoEnd);
        expect(j).toBe(picks.length);
      }
    }
    expect(decisions).toBeGreaterThan(100); // 선택이 실제로 많이 일어나는 표본이었다
  });

  it('선택은 어느 선택지를 골라도 난수 수열을 같은 위치로 보낸다 (선택 난수 1회 + 해 마무리, 사망하지 않은 경우) (R-039)', () => {
    const d = pendingState();
    const ids = d.pending!.choiceIds;
    expect(ids.length).toBeGreaterThanOrEqual(2);
    // 선택지에 따라 난수 소비량이 달라지지 않는다: 어느 선택지를 골라도(사망하지 않았다면) 이후 난수 수열 위치가 같다.
    const results = ids.map((id) => resolveChoice(d, d.pending!.key, id));
    const alive = results.filter((r) => r.phase === 'life');
    expect(alive.length).toBeGreaterThanOrEqual(2);
    for (const r of alive) expect(r.rngState).toBe(alive[0].rngState);
    // 선택 전과는 다르다(난수가 실제로 소비됐다)
    expect(alive[0].rngState).not.toBe(d.rngState);
  });

  it('key가 다르거나 대기 중인 선택지가 없으면 아무것도 하지 않는다', () => {
    const d = decisionFor({});
    expect(autoResolveStep(d, 'other@1', pool).state).toBe(d);
    const noPending = life(1);
    expect(autoResolveStep(noPending, 'x@0', pool).state).toBe(noPending);
  });

  it('끝까지 도달한다: 세 시대 × 시드 100개, 자동 선택으로 사망에 닿고 모든 선택지가 해결됐다', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 100; seed++) {
        const r = playToEnd(life(seed, era), null);
        expect(r.state.phase, `${era} ${seed}`).toBe('ending');
        expect(r.state.pending).toBeNull();
        // 선택지 수 = 해결된 선택 + (선택 직후 곧바로 사망한 경우는 사망 걸음으로 집계)
        expect(r.counts.choice).toBe(r.state.history.filter((h) => h.kind === 'choice').length);
      }
    }
  });
});

describe('다음 결정으로 (advanceUntilDecision)', () => {
  it('선택지 또는 사망에서 정확히 멈추고, 그 사이에는 선택지가 하나도 건너뛰어지지 않는다', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 40; seed++) {
        let s = life(seed, era);
        let decisions = 0;
        for (let i = 0; i < 100 && s.phase === 'life'; i++) {
          const startAge = s.age;
          const r = advanceUntilDecision(s);
          expect(r.state.phase === 'ending' || r.state.pending !== null, `${era} ${seed}: 멈춘 이유가 선택지나 사망이어야 한다`).toBe(true);
          expect(['choice', 'death']).toContain(r.last.kind);
          if (r.state.pending) {
            // 지나온 해는 모두 조용한 해/서술 이벤트였다(선택지는 pending으로 나왔을 뿐 건너뛰지 않았다)
            expect(r.counts.choice).toBe(1);
            expect(r.state.age - startAge).toBe(r.counts.quiet + r.counts.narrative);
            decisions++;
            s = resolveChoice(r.state, r.state.pending.key, r.state.pending.choiceIds[0]);
          } else {
            s = r.state;
          }
        }
        expect(s.phase).toBe('ending');
        expect(s.history.filter((h) => h.kind === 'choice')).toHaveLength(decisions);
      }
    }
  });

  it('이미 선택지가 대기 중이거나 life가 아니면 움직이지 않는다', () => {
    const p = pendingState();
    const r = advanceUntilDecision(p);
    expect(r.state).toBe(p);
    expect(r.counts).toEqual({ quiet: 0, narrative: 0, choice: 0, resolved: 0, death: 0 });
    const t = createInitialState(1);
    expect(advanceUntilDecision(t).state).toBe(t);
  });

  it('선택지가 한 번도 없는 풀에서는 사망까지 간다 (선택지가 없으면 멈출 곳은 사망뿐)', () => {
    const r = advanceUntilDecision(life(3), EMPTY_POOL);
    expect(r.state.phase).toBe('ending');
    expect(r.last.kind).toBe('death');
    expect(r.counts.choice).toBe(0);
  });
});

describe('세션 reducer: 타이머·클릭·자동 모드가 겹쳐도 한 해가 두 번 진행되지 않는다 (R-005)', () => {
  const sess = (game: GameState) => createSession(game, { speed: 1, autoMode: false });

  it('advance(fromAge): 같은 나이로 두 번 와도 한 해만 진행된다 (StrictMode 이중 실행·겹친 타이머)', () => {
    const s0 = sess(life(2));
    const s1 = sessionReducer(s0, { type: 'advance', fromAge: 0 });
    expect(s1.game.age + (s1.game.pending ? 1 : 0)).toBeGreaterThanOrEqual(1);
    const s2 = sessionReducer(s1, { type: 'advance', fromAge: 0 });
    expect(s2).toBe(s1); // 두 번째는 나이가 달라졌으므로(또는 선택지 대기 중이므로) 무시
  });

  it('advance: 나이가 맞아도 선택지가 대기 중이면 무시', () => {
    const p = sess(pendingState());
    expect(sessionReducer(p, { type: 'advance', fromAge: p.game.age })).toBe(p);
  });

  it('choose: 틀린 key·이미 풀린 선택은 무시, 맞는 key는 한 번만 적용된다', () => {
    const p = sess(pendingState());
    const key = p.game.pending!.key;
    const id = p.game.pending!.choiceIds[0];
    expect(sessionReducer(p, { type: 'choose', key: 'x@1', choiceId: id })).toBe(p);
    const done = sessionReducer(p, { type: 'choose', key, choiceId: id });
    expect(done).not.toBe(p);
    expect(done.game.pending?.key).not.toBe(key);
    expect(sessionReducer(done, { type: 'choose', key, choiceId: id })).toBe(done);
    expect(sessionReducer(done, { type: 'autoChoose', key })).toBe(done); // 수동 모드이므로 key와 상관없이 무시(R-038)
  });

  it('autoChoose: 자동 모드가 켜져 있어도 낡은 key(이미 해결됐거나 다른 선택지의 것)는 무시하고, 맞는 key만 한 번 적용된다 (자동 모드 켜짐 + 낡은 key)', () => {
    const p = pendingState();
    const key = p.pending!.key;
    const on = createSession(p, { speed: 8, autoMode: true });
    // 틀린 key: 자동 모드가 켜져 있어도 같은 객체
    expect(sessionReducer(on, { type: 'autoChoose', key: 'x@1' })).toBe(on);
    expect(sessionReducer(on, { type: 'autoChoose', key: `${key}-stale` })).toBe(on);
    // 맞는 key: 한 번 적용된다 (위 두 단언이 자동 모드를 꺼서가 아니라 key 때문에 통과했다는 증거)
    const done = sessionReducer(on, { type: 'autoChoose', key });
    expect(done).not.toBe(on);
    expect(done.settings.autoMode).toBe(true);
    // 이미 해결된 선택의 key로 한 번 더 와도(겹친 타이머) 자동 모드가 켜진 채로 무시된다
    expect(sessionReducer(done, { type: 'autoChoose', key })).toBe(done);
    // 선택지가 하나도 없는 상태에서도 마찬가지
    const noPending = createSession(life(41), { speed: 8, autoMode: true });
    expect(noPending.game.pending).toBeNull();
    expect(sessionReducer(noPending, { type: 'autoChoose', key })).toBe(noPending);
  });

  it('skip(다음 결정으로): 선택지에서 멈추고, 이미 선택지 대기 중이면 같은 객체', () => {
    const s = sessionReducer(sess(life(41)), { type: 'skip' });
    expect(s.game.phase).toBe('life'); // 이 시드는 사망 전에 선택지가 나온다 — 못 찾으면 실패하도록 단언을 조건 없이 둔다
    expect(s.game.pending).not.toBeNull();
    expect(s.tick?.kind).toBe('choice');
    expect(s.game).toEqual(advanceUntilDecision(life(41)).state);
    expect(sessionReducer(s, { type: 'skip' })).toBe(s);
  });

  it('skip: 선택지가 한 번도 없으면 사망까지 간다 (tick은 death)', () => {
    const s = sessionReducer(sess(life(3)), { type: 'skip' }, EMPTY_POOL);
    expect(s.game.phase).toBe('ending');
    expect(s.tick?.kind).toBe('death');
    expect(sessionReducer(s, { type: 'skip' }, EMPTY_POOL)).toBe(s); // 사망 뒤에는 무시
  });

  it('skip + 자동 모드: 무시된다 — 자동 모드의 선택은 타이머(autoChoose)로만 일어나고, 화면도 이 버튼을 비활성화한다 (R-038)', () => {
    const auto = createSession(life(41), { speed: 8, autoMode: true });
    expect(sessionReducer(auto, { type: 'skip' })).toBe(auto);
    // 선택지가 대기 중인 자동 모드에서도 마찬가지
    const withPending = createSession(pendingState(), { speed: 1, autoMode: true });
    expect(sessionReducer(withPending, { type: 'skip' })).toBe(withPending);
  });

  it('autoChoose: 자동 모드가 켜져 있을 때만 고른다. 꺼져 있으면(타이머가 울리기 직전 해제) 무시하고 선택지는 그대로 남는다 (R-038)', () => {
    const p = pendingState();
    const key = p.pending!.key;
    const off = createSession(p, { speed: 1, autoMode: false });
    expect(sessionReducer(off, { type: 'autoChoose', key })).toBe(off);
    const on = createSession(p, { speed: 1, autoMode: true });
    const done = sessionReducer(on, { type: 'autoChoose', key });
    expect(done).not.toBe(on);
    expect(done.game).toEqual(autoResolveStep(p, key).state);
    expect(done.game.pending?.key).not.toBe(key);
    // 해제 → 늦게 도착한 autoChoose는 무시, 다시 켜면 같은 선택지를 고를 수 있다
    const raced = sessionReducer(sessionReducer(on, { type: 'setAuto', auto: false }), { type: 'autoChoose', key });
    expect(raced.game).toBe(p);
    expect(raced.game.pending?.key).toBe(key);
  });

  it('setSpeed / setAuto: 같은 값이면 같은 객체, 잘못된 속도는 무시', () => {
    const s = sess(life(1));
    expect(sessionReducer(s, { type: 'setSpeed', speed: 1 })).toBe(s);
    expect(sessionReducer(s, { type: 'setAuto', auto: false })).toBe(s);
    expect(sessionReducer(s, { type: 'setSpeed', speed: 3 as never })).toBe(s);
    expect(sessionReducer(s, { type: 'setSpeed', speed: 8 }).settings).toEqual({ ...DEFAULT_SETTINGS, speed: 8, autoMode: false });
    expect(sessionReducer(s, { type: 'setAuto', auto: true }).settings).toEqual({ ...DEFAULT_SETTINGS, speed: 1, autoMode: true });
    // 속도·자동 변경이 게임 상태를 건드리지 않는다
    expect(sessionReducer(s, { type: 'setSpeed', speed: 4 }).game).toBe(s.game);
  });

  it('adopt: 다른 탭의 상태를 이어받고 tick을 지운다', () => {
    const s = sessionReducer(sess(life(1)), { type: 'advance', fromAge: 0 });
    const other = life(2);
    const adopted = sessionReducer(s, { type: 'adopt', game: other });
    expect(adopted.game).toBe(other);
    expect(adopted.tick).toBeNull();
  });

  it('화면 전환 액션(setEra/begin/enterLife)이 core 함수와 같고 연타는 같은 객체를 돌려준다', () => {
    let s = createSession(createInitialState(9), { speed: 1, autoMode: false });
    expect(s.game.phase).toBe('title'); // 첫 화면에서 곧바로 세상을 고르고 태어난다 — 시대 선택 화면은 없다
    s = sessionReducer(s, { type: 'setEra', era: 'future' });
    expect(s.settings.era).toBe('future');
    expect(sessionReducer(s, { type: 'setEra', era: 'future' })).toBe(s); // 같은 선택은 같은 객체
    s = sessionReducer(s, { type: 'begin' });
    expect(s.game.phase).toBe('birth');
    expect(s.game.era).toBe('future');
    const born = s;
    expect(sessionReducer(s, { type: 'begin' })).toBe(born); // 이중 추첨 없음
    s = sessionReducer(s, { type: 'enterLife' });
    expect(s.game.phase).toBe('life');
    expect(sessionReducer(s, { type: 'enterLife' })).toBe(s);
  });

  it('무작위로 섞은 중복 입력(중복 advance·중복 choose·늦게 도착한 입력)에도 결과는 중복 없이 진행한 것과 같다', () => {
    for (const seed of [4, 44, 444]) {
      const first = (g: GameState) => g.pending!.choiceIds[0];
      const canonical = playToEnd(life(seed), first).state;
      const rng = createRng(seed);
      let s = sess(life(seed));
      for (let guard = 0; guard < 5000 && s.game.phase === 'life'; guard++) {
        const g = s.game;
        const dup = 1 + rng.int(0, 3);
        if (g.pending) {
          for (let i = 0; i < dup; i++) s = sessionReducer(s, { type: 'choose', key: g.pending.key, choiceId: first(g) });
          s = sessionReducer(s, { type: 'advance', fromAge: g.age }); // 늦게 도착한 타이머: 선택 직후면 이미 나이가 달라져 무시
        } else {
          const staleAge = Math.max(0, g.age - rng.int(0, 2));
          for (let i = 0; i < dup; i++) s = sessionReducer(s, { type: 'advance', fromAge: g.age });
          s = sessionReducer(s, { type: 'advance', fromAge: staleAge === g.age ? -1 : staleAge }); // 옛 나이의 타이머
        }
      }
      expect(s.game).toEqual(canonical);
    }
  });
});

describe('설정(배속·자동 여부)은 게임과 독립으로 저장되고 다음 판에도 유지된다', () => {
  it('설정을 바꿔 저장 → 새 게임(리셋)으로 시작해도 같은 설정으로 시작한다', async () => {
    const { saveSettings, loadSettings, clearGame } = await import('../src/core');
    const st = memoryStorage();
    let s = createSession(createInitialState(1), loadSettings(st));
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    s = sessionReducer(s, { type: 'setSpeed', speed: 8 });
    s = sessionReducer(s, { type: 'setAuto', auto: true });
    saveSettings(st, s.settings);
    saveGame(st, s.game);
    // 판이 끝나 게임 저장이 사라지고(새 판) 앱이 다시 열린다
    clearGame(st);
    const next = createSession(loadGame(st) ?? createInitialState(2), loadSettings(st));
    expect(next.game.phase).toBe('title');
    expect(next.settings).toEqual({ ...DEFAULT_SETTINGS, speed: 8, autoMode: true });
  });
});

describe('저장 복원: 대기 중인 선택지 (R-008 잔여)', () => {
  it('선택지 대기 상태를 저장 → 복원하면 같은 이벤트·같은 선택지이고, 복원 뒤 진행도 이어 쓴 것과 같다', () => {
    const st = memoryStorage();
    const p = pendingState();
    expect(saveGame(st, p)).toBe(true);
    const restored = loadGame(st)!;
    expect(restored).toEqual(p);
    expect(restored.pending).toEqual(p.pending);
    const id = p.pending!.choiceIds[p.pending!.choiceIds.length - 1];
    expect(resolveChoice(restored, restored.pending!.key, id)).toEqual(resolveChoice(p, p.pending!.key, id));
    // 대기 중에는 진행해도 다시 굴려지거나 건너뛰지 않는다
    expect(advanceYear(restored)).toBe(restored);
    expect(restored.rngState).toBe(p.rngState);
  });
});
