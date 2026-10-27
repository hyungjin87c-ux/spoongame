import { describe, expect, it } from 'vitest';
import { PARENT_WEALTHS, advanceUntilDecision, autoResolveStep, createSession, deciderOf, parseGame, resolveChoiceStep, serializeGame, sessionReducer, stepYear, type GameState, type HistoryEntry, type ParentWealth, type ProfileId } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { PARENT_DECISION_TABLE, PARENT_FIT, SELF_AREA_WEIGHT } from '../src/data/parentDecisionTable';
import { selfAreaWeightFactor } from '../src/core/parentDecision';
import {
  CARE_CHOICES,
  MONOTONE_CARDS,
  OFFICIAL,
  cardCounts,
  careRows,
  dominanceCells,
  familyPriorityAccept,
  monotoneRows,
  parentalLeaveShare,
  parentingGap,
  privateEducationRows,
  runYoungLife,
  sampleYoung,
  sampleYoungByTier,
  seedOf,
  type CareRow,
  type YoungLife,
} from '../scripts/parentReportLib';
import { SIM_PROFILES, chooserFor, startLife, type Strategy } from '../scripts/simulateLib';

/**
 * T3 동치·결정론 + T5 분포 시험 = PD12 (SPEC-005, 설계 문서 docs/data/parent-decision-model.md 5절).
 * 부모님이 정한·흘러간 선택이 (1) 사람이 같은 선택지를 고른 것과 같은 경로이고 (2) 같은 시드 → 같은 인생이며 (3) 분포가 설계한 방향(수저 단조 · 양육 방식 · 통계 보정 · 지배 방지)인지 본다.
 * 임계는 구현 뒤 **측정값 − 3 SE**로 정했고 통과시키려고 내리지 않았다. 측정 표는 `npm run report:parent`와 dev 로그(ai-log/2026-10-20_SPEC-005_dev-QI5.md)에 있다.
 * 표본은 20세가 되기 전까지만 돈다(부모님이 정한·흘러간 카드와 13~19세 본인 카드는 거기서 끝난다) — 한 판 0.5~1.5ms. 시드는 `i × 7919 + 13`.
 */

const LIVES = 1000;
const PER_TIER = 300;
const STRATEGIES: Strategy[] = ['random', 'auto'];

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

const natural = lazy(() => {
  const out = {} as Record<Strategy, Record<ProfileId, YoungLife[]>>;
  for (const st of STRATEGIES) out[st] = Object.fromEntries(SIM_PROFILES.map((era) => [era, sampleYoung(era, LIVES, st)])) as Record<ProfileId, YoungLife[]>;
  return out;
});
const tiered = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, sampleYoungByTier(era, PER_TIER, 'random')])) as Record<ProfileId, Record<ParentWealth, YoungLife[]>>);

// ---------------------------------------------------------------------------------------------------------------------
// T3 동치·결정론
// ---------------------------------------------------------------------------------------------------------------------

/** 연표 줄의 `by`와 (부모일 때만 달라질 수 있는) 선택 문구를 가린 상태 — 동치 비교용 */
function normalized(state: GameState, maskText: boolean): unknown {
  const history = state.history.map((h, i) => {
    const { by: _by, ...rest } = h as HistoryEntry & { by?: unknown };
    void _by;
    return maskText && i === state.history.length - 1 ? { ...rest, text: '', choice: '' } : rest;
  });
  return { ...state, history };
}

interface Capture {
  before: GameState;
  by: 'parent' | 'child';
  choiceId: string;
  after: GameState;
  tick: ReturnType<typeof stepYear>['tick'];
}

/** 한 판을 사망까지 돌리며 부모·흘러감으로 해결된 모든 해를 모은다 (본인 카드는 전략대로 고른다) */
function playAndCapture(seed: number, era: ProfileId, strategy: Strategy, onYear?: (s: GameState) => GameState): { final: GameState; captures: Capture[] } {
  const chooser = chooserFor(strategy, seed);
  const captures: Capture[] = [];
  let s = startLife(seed, era);
  for (let guard = 0; s.phase === 'life' && guard < 400; guard++) {
    if (onYear !== undefined) s = onYear(s);
    if (s.pending !== null) {
      const picked = chooser === null ? null : chooser(s);
      s = (picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked)).state;
      continue;
    }
    let seen: { state: GameState; by: 'parent' | 'child'; choiceId: string } | null = null;
    const r = stepYear(s, EVENT_POOL, (e) => {
      seen = { state: e.state, by: e.by, choiceId: e.choiceId };
    });
    if (seen !== null) {
      const c = seen as { state: GameState; by: 'parent' | 'child'; choiceId: string };
      captures.push({ before: c.state, by: c.by, choiceId: c.choiceId, after: r.state, tick: r.tick });
    }
    s = r.state;
  }
  return { final: s, captures };
}

describe('T3 동치·결정론 (설계 문서 5절 T3)', () => {
  const SEEDS = 40;

  it('① 부모님이 정한 해는 같은 상태에서 그 선택지를 수동으로 고른 것과 같다: 연표 줄의 by(와 parentLabel/parentResult가 있는 카드의 문구)만 빼고 상태 전체가 같다', () => {
    let checked = 0;
    let labeled = 0;
    for (const era of SIM_PROFILES) {
      for (let i = 1; i <= SEEDS; i++) {
        const seed = seedOf(i);
        const { captures } = playAndCapture(seed, era, 'random');
        for (const c of captures.filter((x) => x.by === 'parent')) {
          const key = c.before.pending!.key;
          const manual = resolveChoiceStep(c.before, key, c.choiceId).state;
          const ev = EVENT_POOL.byId.get(c.before.pending!.eventId)!;
          const choice = ev.choices!.find((x) => x.id === c.choiceId)!;
          const hasParentText = choice.parentLabel !== undefined || choice.parentResult !== undefined;
          if (hasParentText) labeled++;
          expect(normalized(c.after, hasParentText), `${era} 시드 ${seed} ${key}/${c.choiceId}`).toEqual(normalized(manual, hasParentText));
          // by 표지와 틱
          expect(c.after.history.filter((h) => h.eventId === ev.id).pop()?.by).toBe('parent');
          expect(c.tick.by).toBe('parent');
          expect(c.tick.choiceId).toBe(c.choiceId);
          // 수동으로 고른 줄에는 by가 없다
          expect(manual.history.filter((h) => h.eventId === ev.id).pop()?.by).toBeUndefined();
          checked++;
        }
      }
    }
    expect(checked, '대조한 부모 해 수(공허 통과 방지)').toBeGreaterThan(300);
    expect(labeled, 'parentLabel/parentResult가 있는 카드도 한 번 이상 대조했다').toBeGreaterThan(0);
  });

  it('② 흘러감은 autoResolveStep과 상태 전체가 같다 (by 표지만 다르다)', () => {
    let checked = 0;
    for (const era of SIM_PROFILES) {
      for (let i = 1; i <= SEEDS; i++) {
        const seed = seedOf(i);
        const { captures } = playAndCapture(seed, era, 'random');
        for (const c of captures.filter((x) => x.by === 'child')) {
          const auto = autoResolveStep(c.before, c.before.pending!.key).state;
          expect(normalized(c.after, false), `${era} 시드 ${seed} ${c.before.pending!.key}`).toEqual(normalized(auto, false));
          expect(c.after.history.filter((h) => h.eventId === c.before.pending!.eventId).pop()?.by).toBe('child');
          checked++;
        }
      }
    }
    expect(checked, '대조한 흘러감 해 수(공허 통과 방지)').toBeGreaterThan(40);
  });

  it('③ 같은 (시드, 세상, 본인 선택 목록)이면 최종 상태가 같다 — 두 번 돌려 직렬화가 한 글자도 다르지 않다 (세 시대 × 두 전략)', () => {
    for (const era of SIM_PROFILES) {
      for (const strategy of STRATEGIES) {
        for (let i = 1; i <= 15; i++) {
          const seed = seedOf(i);
          const a = playAndCapture(seed, era, strategy).final;
          const b = playAndCapture(seed, era, strategy).final;
          expect(serializeGame(b), `${era} ${strategy} 시드 ${seed}`).toBe(serializeGame(a));
          expect(a.phase).toBe('ending');
        }
      }
    }
  });

  it('④ 인생의 모든 나이에서 저장 → 복원 → 계속해도 같은 인생이다: 매 걸음 직렬화·복원한 판의 최종 상태가 한 번에 돌린 판과 같고, 복원한 상태에 부모·흘러감 카드가 pending으로 열려 있던 일은 0이다', () => {
    let restores = 0;
    for (const era of SIM_PROFILES) {
      for (let i = 1; i <= 12; i++) {
        const seed = seedOf(i);
        const straight = playAndCapture(seed, era, 'random').final;
        const viaStorage = playAndCapture(seed, era, 'random', (s) => {
          const back = parseGame(serializeGame(s));
          expect(back, `${era} 시드 ${seed} ${s.age}세 복원`).not.toBeNull();
          restores++;
          // ⑤ 부모 영역·흘러감 카드가 pending으로 저장된 상태는 만들어지지 않는다: 열린 pending이 있다면 본인 카드뿐이다
          if (back!.pending !== null) expect(deciderOf(back!.pending.eventId, back!.pending.age), `${era} 시드 ${seed} ${s.age}세`).toBe('self');
          return back!;
        }).final;
        expect(serializeGame(viaStorage), `${era} 시드 ${seed}`).toBe(serializeGame(straight));
      }
    }
    expect(restores, '복원 횟수(공허 통과 방지)').toBeGreaterThan(2000);
  });

  it('⑤ 부모 결정 해에 pending이 상태로 저장되는 일은 0이다: 걸음마다 부모·흘러감 카드가 열린 상태를 보지 못했다 (30판 × 세 시대)', () => {
    for (const era of SIM_PROFILES) {
      for (let i = 1; i <= 30; i++) {
        const seed = seedOf(i);
        playAndCapture(seed, era, 'random', (s) => {
          if (s.pending !== null && PARENT_DECISION_TABLE[s.pending.eventId] !== undefined) {
            expect(deciderOf(s.pending.eventId, s.pending.age), `${era} 시드 ${seed} ${s.pending.eventId}@${s.pending.age}`).toBe('self');
          }
          return s;
        });
      }
    }
  });

  it('변이 점검: 부모 해의 상태에서 다른 선택지를 고르면 대조가 실패한다 (공허 통과 방지)', () => {
    const { captures } = playAndCapture(seedOf(3), 'alpha', 'random');
    const c = captures.find((x) => x.by === 'parent' && x.before.pending!.choiceIds.length >= 2)!;
    expect(c).toBeDefined();
    const other = c.before.pending!.choiceIds.find((id) => id !== c.choiceId)!;
    const manualOther = resolveChoiceStep(c.before, c.before.pending!.key, other).state;
    expect(JSON.stringify(normalized(c.after, true))).not.toBe(JSON.stringify(normalized(manualOther, true)));
  });
});

describe('PD7 자동 모드·다음 결정으로·일시정지 (세션 reducer — 시계가 아니라 규칙을 본다)', () => {
  /** 첫 본인 카드 앞에 부모·흘러감 해가 둘 이상 있는 0세 상태(기록 카드 꺼짐 — 카드 멈춤은 tests/noteCards.test.ts가 본다) */
  function earlyLife(): GameState {
    for (let seed = 1; seed < 800; seed++) {
      const s0 = startLife(seed, 'alpha');
      const s = advanceUntilDecision(s0, EVENT_POOL, 'consume').state;
      if (s.phase === 'life' && s.pending !== null && s.history.filter((h) => h.by !== undefined).length >= 2) return s0;
    }
    throw new Error('부모·흘러감 해가 둘 이상 앞서는 시드를 찾지 못했다');
  }
  const base = { speed: 1 as const, noteCards: false };

  it('PD7-1 자동 모드는 부모·흘러감 해에 영향이 없다: 같은 상태에서 한 해씩 나아가면 자동 모드 켬/끔의 게임 상태·틱이 한 글자도 다르지 않다 (0~12세 전부)', () => {
    const s0 = earlyLife();
    let off = createSession(s0, { ...base, autoMode: false });
    let on = createSession(s0, { ...base, autoMode: true });
    let delegated = 0;
    for (let i = 0; i < 40 && off.game.phase === 'life' && off.game.age < 12; i++) {
      if (off.game.pending !== null) break; // 본인 카드에서 멈추면 그 앞까지만 본다
      off = sessionReducer(off, { type: 'advance', fromAge: off.game.age });
      on = sessionReducer(on, { type: 'advance', fromAge: on.game.age });
      expect(serializeGame(on.game), `${i}번째 걸음`).toBe(serializeGame(off.game));
      expect(on.tick).toEqual(off.tick);
      if (off.tick?.by !== undefined) delegated++;
    }
    expect(delegated, '부모·흘러감 해를 지났다(공허 통과 방지)').toBeGreaterThanOrEqual(2);
  });

  it('PD7-3 「다음 결정으로」: 부모·흘러감 해를 연출 없이 지나 첫 본인 카드 앞에서 멈추고, 상태가 advanceUntilDecision과 같으며 지나온 해마다 by 표지 줄이 남는다 (카드는 화면에 뜨지 않는다 — 마지막 틱에 by가 없다)', () => {
    const s0 = earlyLife();
    const expected = advanceUntilDecision(s0, EVENT_POOL, 'consume');
    const after = sessionReducer(createSession(s0, { ...base, autoMode: false }), { type: 'skip' });
    expect(serializeGame(after.game)).toBe(serializeGame(expected.state));
    expect(after.game.pending).not.toBeNull();
    expect(deciderOf(after.game.pending!.eventId, after.game.pending!.age)).toBe('self');
    expect(after.game.history.filter((h) => h.by === 'parent').length).toBeGreaterThanOrEqual(1);
    expect(after.game.history.filter((h) => h.kind === 'choice' && h.by === undefined)).toHaveLength(0);
    expect(after.tick?.by, '멈춘 걸음은 본인 카드(choice)다').toBeUndefined();
  });

  it('자동 모드에서 「다음 결정으로」는 동작이 없다 (사용자가 고르는 것이 아니고 시계가 한 해씩 간다)', () => {
    const s = createSession(earlyLife(), { ...base, autoMode: true });
    expect(sessionReducer(s, { type: 'skip' })).toBe(s);
  });

  it('PD7-4 일시정지 중에는 해가 진행되지 않는다: 부모·흘러감 해가 올 차례여도 advance를 무시한다 (카드 표시 시간도 시계와 함께 멈춘다)', () => {
    let s = createSession(earlyLife(), { ...base, autoMode: false });
    s = sessionReducer(s, { type: 'setPaused', paused: true });
    const before = serializeGame(s.game);
    for (let i = 0; i < 5; i++) s = sessionReducer(s, { type: 'advance', fromAge: s.game.age });
    expect(serializeGame(s.game)).toBe(before);
  });

  it('PD7-5 새로고침: 부모 결정 해를 막 지난 판을 저장했다 복원하면 틱이 없어(저장하지 않는다) 카드가 다시 뜨지 않고, 같은 해를 다시 굴리지도 않는다', () => {
    let s = createSession(earlyLife(), { ...base, autoMode: false });
    for (let i = 0; i < 40 && s.tick?.by === undefined; i++) s = sessionReducer(s, { type: 'advance', fromAge: s.game.age });
    expect(s.tick?.by).toBeDefined();
    const restored = createSession(parseGame(serializeGame(s.game))!, { ...base, autoMode: false });
    expect(restored.tick).toBeNull();
    expect(serializeGame(restored.game)).toBe(serializeGame(s.game));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T5 분포 시험 = PD12
// ---------------------------------------------------------------------------------------------------------------------

describe('T5 ①② 구조: 결정자 표지가 100% 맞고, 부모·흘러감 카드가 pending으로 남지 않는다', () => {
  it('① by: parent 줄이 부모 구간 카드의 100%, by: child가 흘러감 구간의 100%, 그 밖(본인 구간·19세 이상)은 0% — 세 시대 × 두 전략 × 1000판', () => {
    for (const st of STRATEGIES) {
      for (const era of SIM_PROFILES) {
        const lives = natural()[st][era];
        expect(lives).toHaveLength(LIVES);
        const bad = lives.reduce((n, l) => n + l.byMismatch, 0);
        expect(bad, `${era} ${st}: by 표지가 deciderOf와 어긋난 줄`).toBe(0);
        // 19세 이상의 선택 줄에는 by가 없다 (모두 본인)
        for (const l of lives) for (const h of l.history) if (h.kind === 'choice' && h.age >= 19) expect(h.by, `${era} 시드 ${l.seed} ${h.age}세`).toBeUndefined();
      }
    }
  });

  it('② 19세 미만에서 pending이 부모·흘러감 카드로 열린 판 0 (구조), 20세 전 사망은 1% 미만(측정 0.1~0.4%)', () => {
    for (const st of STRATEGIES) {
      for (const era of SIM_PROFILES) {
        const lives = natural()[st][era];
        expect(lives.reduce((n, l) => n + l.pendingLeak, 0), `${era} ${st}`).toBe(0);
        expect(cardCounts(lives).diedYoung, `${era} ${st}`).toBeLessThan(0.01);
      }
    }
  });
});

describe('T5 ③ 판당 카드 수: 부모 결정 + 흘러감 합이 SPEC의 4.5~7장 안이다 (손계산 5.9)', () => {
  it('세 시대 × 두 전략 모두: 합 4.5 ≤ 평균 ≤ 7 · 부모 ≥ 3.5 · 흘러감 ≥ 0.8 (측정 부모 4.5~4.7 · 흘러감 1.3~1.4 · 합 5.9~6.0)', () => {
    for (const st of STRATEGIES) {
      for (const era of SIM_PROFILES) {
        const c = cardCounts(natural()[st][era]);
        expect(c.parent + c.child, `${era} ${st} 합`).toBeGreaterThanOrEqual(4.5);
        expect(c.parent + c.child, `${era} ${st} 합`).toBeLessThanOrEqual(7);
        expect(c.parent, `${era} ${st} 부모`).toBeGreaterThanOrEqual(3.5);
        expect(c.child, `${era} ${st} 흘러감`).toBeGreaterThanOrEqual(0.8);
      }
    }
  });
});

describe('T5 ④ 수저 단조: 재력이 높을수록 비용이 큰 선택지를 고르는 부모가 늘어난다', () => {
  for (const era of SIM_PROFILES) {
    it(`${era}: 비교 가능한 카드 중 비용 합 확률이 5단계(또는 3단계)에서 1단계보다 ≥ 10%p 높은 카드가 70% 이상(지금 세상 10장 중 7장 이상), 역전(≤ −5%p) 0장, 인접 단계 격차 −8%p 이하 0곳`, () => {
      const rows = monotoneRows(era, tiered()[era]);
      expect(rows, `${era} 줄 수`).toHaveLength(MONOTONE_CARDS.length);
      const comparable = rows.filter((r) => r.gap !== null);
      // 그 세대의 달력 연도에 일어나지 않는 카드(육아휴직·어린이집 대기 같은 요즘 이야기)는 관측이 없어 비교에서 빠진다
      expect(comparable.length, `${era} 비교 가능한 카드 수`).toBeGreaterThanOrEqual(era === 'alpha' ? 8 : 6);
      const passing = comparable.filter((r) => r.gap! >= 10);
      expect(passing.length / comparable.length, `${era}: ${passing.length}/${comparable.length} — ${comparable.map((r) => `${r.id} ${r.gap!.toFixed(1)}`).join(', ')}`).toBeGreaterThanOrEqual(0.7);
      if (era === 'alpha') expect(passing.length, '알파 세대 10장 중').toBeGreaterThanOrEqual(7);
      expect(comparable.filter((r) => r.gap! <= -5).map((r) => r.id), `${era} 역전`).toEqual([]);
      // 균등 무작위(ε = 1)로도 「비싼 선택지가 높은 재력에서만 보인다」는 이유로 17%p 격차가 나오는 카드가 많아 7/10 기준만으로는 모델이 빠져도 통과한다(변이 점검: ε = 1이면 지금 세상 7/10, 평균 격차 10~12, 최소 0).
      // 그래서 모델이 실제로 일하는지 보는 두 단언을 더했다 — 평균 격차 ≥ 15%p(측정 19~21, 균등이면 10~12)와 모든 카드가 같은 방향 +1.5%p 이상(측정 최소 3.8~4.9, 균등이면 0).
      const meanGap = comparable.reduce((a, r) => a + r.gap!, 0) / comparable.length;
      expect(meanGap, `${era} 평균 격차`).toBeGreaterThanOrEqual(15);
      expect(comparable.filter((r) => r.gap! < 1.5).map((r) => `${r.id} ${r.gap!.toFixed(1)}`), `${era} 방향이 약한 카드`).toEqual([]);
      expect(comparable.filter((r) => r.minAdjacent !== null && r.minAdjacent <= -8).map((r) => r.id), `${era} 인접 단계 격차 −8%p 이하 (보고 대상)`).toEqual([]);
    });
  }
});

describe('T5 ⑤ 양육 방식: 엄격·헬리콥터 부모가 자유·방임 부모보다 학력 효과가 가장 큰 선택지를 더 자주 고른다', () => {
  for (const era of SIM_PROFILES) {
    it(`${era}: 차가 +8%p 이상이다 (SPEC 기준 +3%p▲ — 측정 11~17%p에서 측정값 − 3 SE로 올렸다)`, () => {
      const g = parentingGap(natural().random[era]);
      expect(g.cards, `${era} 카드 수`).toBeGreaterThanOrEqual(5);
      expect(g.n, `${era} 관측 수`).toBeGreaterThan(500);
      expect(g.gap, `${era}: 엄격·헬리콥터 ${(g.front * 100).toFixed(1)}% 대 자유·방임 ${(g.back * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(8);
    });
  }
});

describe('T5 ⑥ 지배 방지: 어떤 (카드 × 수저 × 양육) 칸에서도 한 선택지가 90%를 넘지 않는다 (부모 결정)', () => {
  for (const era of SIM_PROFILES) {
    it(`${era}: 관측 8 이상인 모든 칸의 최대 평균 확률 ≤ 90% (측정 최대 80.1%)`, () => {
      const cells = dominanceCells([...natural().random[era], ...PARENT_WEALTHS.flatMap((t) => tiered()[era][t])], 8).filter((c) => c.by === 'parent');
      expect(cells.length, `${era} 칸 수`).toBeGreaterThan(100);
      const worst = cells.reduce((a, b) => (b.maxShare > a.maxShare ? b : a));
      expect(worst.maxShare, `${era}: ${worst.eventId}/${worst.maxId} 수저 ${worst.tier} ${worst.parenting} n=${worst.n}`).toBeLessThanOrEqual(0.9);
    });
  }
});

describe('T5 ⑦ 통계 보정 판정 2곳 (지금 세상, 차 ≤ 15%p): 사교육 소득별 참여율 · 육아휴직 어머니 사용률', () => {
  it('사교육: school-tutoring·school-academy-night의 참여 선택지 확률이 소득별(수저 1~5단계) 공식 참여율 52.8·64.2·74.9·83.1·84.9%와 15%p 안이다 (측정 최대 tutoring 11.9 · academy-night 14.2)', () => {
    const rows = privateEducationRows(tiered().alpha);
    expect(rows).toHaveLength(2);
    expect(OFFICIAL.privateEdu).toEqual([52.8, 64.2, 74.9, 83.1, 84.9]);
    for (const r of rows) {
      r.byTier.forEach((t, i) => {
        expect(t.n, `${r.label} ${t.tier}단계 관측`).toBeGreaterThanOrEqual(30);
        expect(r.diffs[i]!, `${r.label} ${t.tier}단계 시뮬 ${t.share!.toFixed(1)}% 대 공식 ${OFFICIAL.privateEdu[i]}%`).toBeLessThanOrEqual(OFFICIAL.tolerancePp);
      });
    }
  });

  it('육아휴직: 한 사람 이상 일을 쉬는 선택(one + share)의 가구 비율이 어머니 사용률 72.2%와 15%p 안이다 (측정 60.0%, 차 12.2%p)', () => {
    const leave = parentalLeaveShare(tiered().alpha, 'alpha');
    expect(Math.abs(leave.share - OFFICIAL.parentalLeaveMother), `시뮬 ${leave.share.toFixed(1)}% 대 ${OFFICIAL.parentalLeaveMother}%`).toBeLessThanOrEqual(OFFICIAL.tolerancePp);
    for (const t of leave.byTier) expect(t.n, `${t.tier}단계 관측`).toBeGreaterThanOrEqual(30);
  });
});

/**
 * R-454 돌봄 선택지 낙인 점검 (설계 문서 2-5절·6-3절·10절). 마스터 결정 2026-10-21(설계 문서 10-9): 권고 A(수용) — 1차(v0.2.0)는 수치·데이터 그대로, 시험·문서만.
 *
 * **규칙 (10-9 ②): 돌봄 관련 선택지의 수저별 격차 가운데 「돈 민감도 몫」은 ≤ 8%p, 선택지가 열리는(가시성) 몫은 제한 없음.** 가시성은 `requires.parentWealth.min = 3`이 세 번째 선택지
 * (`academy`·`book`·`move`)를 여는 것으로, 형편이 선택지를 바꾸는 것은 게임의 주제(G3)다. 돈 민감도 몫은 같은 선택지를 보고도 `moneyNeed`(1.42 → 0.58)가 돈 드는 길의 점수를 깎아 돈이 남는 길로 끌리는 몫으로,
 * 「부모가 돈 때문에 아이를 덜 챙긴다」로 읽힐 수 있는 경로(G4)라 8%p로 묶는다(`fever.dismiss` 상한과 같은 값).
 *
 * 이 파일이 지키는 것 (시뮬 표에서는 두 몫을 가를 수 없어 전체 격차로 잠근다):
 *  - `fever.dismiss`: 보이는 선택지가 3 → 3이라 가시성 몫이 0 — 전체 격차가 곧 돈 민감도 몫이므로 **≤ 8%p를 직접 단언**한다(측정 지난 5.9 · 지금 5.1 · 다가올 4.9%p; 설계 문서 2-5절·2-10절의 「3~4%p」는
 *    헬리콥터 한 칸 손계산이었다 — 양육 방식별 손계산 3.5~6.8%p, 측정 5.0~6.1%p, 10-7절).
 *  - `after-hours.alone` · `noise.hush` · `stories.alone`: 가시성 몫이 큰 계단형(1~2단계 같음 → 3단계에서 한 번에 내려감 → 3~5단계 평평)이라 **전체 격차 ≤ 25%p로 지금 크기를 알려진 값으로 잠그고 앞으로 키우지 않게 한다**
 *    (단계당 300판 측정 14.4~19.2%p, 단계당 1000판 측정 지금 세상 19.7 · 18.8 · 14.5%p — 10-1절). 돈 민감도 몫은 손계산으로 after-hours 약 7.5 · noise 약 3.6 · stories 0%p로 모두 8%p 안이다(10-2절) —
 *    시뮬레이션으로 두 몫을 따로 재는 단언은 아직 없다(선택지 가시성을 가린 표본이 필요 — 2차 「R-454-후속」에서 자료 확인과 함께 다룬다).
 * 표본: 단계당 300판(`PER_TIER`), 전략 `random`, 시드 `i × 7919 + 13`(`seedOf`)을 차례로 훑어 그 단계가 나온 판을 모은 조건부 표본, 세 시대. 표의 값은 판마다 그 선택지가 보인 해의 선택 **확률** 평균이라 표본 잡음이 작다
 * (300판 표와 1000판 표가 1%p 안에서 같다). 격차 = 1단계 − 카드가 일어나는 가장 높은 단계(`noise.hush`는 재력 5단계에 카드가 없어 1 − 4단계, 나머지는 1 − 5단계).
 */
describe('R-454 돌봄 선택지 낙인 점검 (설계 문서 2-5절·6-3절·10-9): 수저에 따른 비율 표, 아픈 아이를 넘기는 선택(fever.dismiss)의 1단계 대 5단계 격차 ≤ 8%p, 세 카드(after-hours.alone·noise.hush·stories.alone)의 격차 ≤ 25%p', () => {
  const rowsOf = (era: ProfileId) => Object.fromEntries(careRows(tiered()[era]).map((r) => [r.name, r]));

  it('표가 다섯 선택지 × 수저 5단계 × 양육 방식 4가지로 나온다 — fever.dismiss는 세 시대 모든 단계에 관측이 충분하고, 지금 세상은 다섯 선택지가 모두 관측된다 (공허 통과 방지)', () => {
    expect(CARE_CHOICES.map((c) => c.name)).toEqual(['fever.dismiss', 'after-hours.alone', 'stories.alone', 'screen.free', 'noise.hush']);
    for (const era of SIM_PROFILES) {
      const rows = careRows(tiered()[era]);
      expect(rows).toHaveLength(5);
      for (const r of rows) {
        expect(r.byTier.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5]);
        expect(r.byParenting.map((x) => x.parenting)).toEqual(['neglect', 'free', 'helicopter', 'strict']);
      }
      for (const t of rowsOf(era)['fever.dismiss'].byTier) expect(t.n, `${era} fever.dismiss ${t.tier}단계 관측`).toBeGreaterThanOrEqual(40);
    }
    for (const r of careRows(tiered().alpha)) expect(r.byTier.filter((t) => t.share !== null).length, `알파 세대 ${r.name}`).toBeGreaterThanOrEqual(4); // noise.hush는 5단계에 보이지 않는다(requires)
  });

  it('fever.dismiss의 수저 1단계 대 5단계 격차는 세 시대 모두 8%p 이하다 (측정 지난 5.9 · 지금 5.1 · 다가올 4.9%p — 설계 문서 2-5절의 옛 손계산 3~4%p보다 크지만 마스터가 수용했다(10-9 ①); 1단계가 더 자주 고른다)', () => {
    for (const era of SIM_PROFILES) {
      const r = rowsOf(era)['fever.dismiss'];
      expect(r.gap1to5, `${era}`).not.toBeNull();
      expect(Math.abs(r.gap1to5!), `${era}: 1단계 ${r.byTier[0].share!.toFixed(1)}% 대 5단계 ${r.byTier[4].share!.toFixed(1)}%`).toBeLessThanOrEqual(8);
    }
  });

  it('변이 점검: fever.dismiss의 적합도 0.5를 2.0으로 바꾸면 격차가 8%p를 넘는다 (이 상한이 PARENT_FIT 0.5를 실제로 지킨다 — 측정 지금 세상 9.4%p)', () => {
    const table = PARENT_FIT as Record<string, number>;
    const saved = table['infant-fever/dismiss'];
    try {
      table['infant-fever/dismiss'] = 2;
      const r = careRows(sampleYoungByTier('alpha', PER_TIER, 'random')).find((x) => x.name === 'fever.dismiss')!;
      expect(Math.abs(r.gap1to5!), '적합도 2.0일 때 격차').toBeGreaterThan(8);
    } finally {
      table['infant-fever/dismiss'] = saved;
    }
    expect(PARENT_FIT['infant-fever/dismiss']).toBe(0.5);
  });

  // ---- 세 카드 격차 상한 (10-9 ③, 1차 몫) ----
  /** 격차 상한(%p) — 측정 최대 19.2(300판 표) / 19.7(1000판 표)에 여유를 둔 값, 지금 크기를 알려진 값으로 잠근다 */
  const THREE_CARD_GAP_CAP = 25;
  const THREE_CARDS = ['after-hours.alone', 'noise.hush', 'stories.alone'] as const;
  /** 시대마다 이 세 카드 가운데 일어나는 것 (이벤트의 `eras`·`requires`가 정한다 — 안 일어나는 칸은 관측 0이라 격차가 없다) */
  const OBSERVED: Record<string, readonly string[]> = {
    industrial: ['stories.alone'],
    genx: ['stories.alone'],
    alpha: ['after-hours.alone', 'noise.hush', 'stories.alone'],
  };
  /** 1단계 − 관측이 있는 가장 높은 단계 (noise.hush는 5단계에 카드가 없어 1−4단계). 관측이 없으면 null */
  function gapToLastTier(r: CareRow): { gap: number; last: number; n1: number; nLast: number } | null {
    const seen = r.byTier.filter((t) => t.share !== null);
    if (seen.length === 0) return null;
    const first = seen[0];
    const last = seen[seen.length - 1];
    return { gap: first.share! - last.share!, last: last.tier, n1: first.n, nLast: last.n };
  }

  it('세 카드(after-hours.alone·noise.hush·stories.alone)의 1단계 대 끝단계 격차는 일어나는 모든 칸에서 25%p 이하이고 관측이 충분하다 (측정 지금 세상 19.0 · 18.4 · 14.4%p — 표본 단계당 300판, 시드 i×7919+13, 무작위 선택)', () => {
    for (const era of SIM_PROFILES) {
      const observed: string[] = [];
      for (const name of THREE_CARDS) {
        const g = gapToLastTier(rowsOf(era)[name]);
        if (g === null) continue;
        observed.push(name);
        expect(g.n1, `${era} ${name} 1단계 관측`).toBeGreaterThanOrEqual(40);
        expect(g.nLast, `${era} ${name} ${g.last}단계 관측`).toBeGreaterThanOrEqual(40);
        expect(g.gap, `${era} ${name}: 1단계 ${rowsOf(era)[name].byTier[0].share!.toFixed(1)}% 대 ${g.last}단계 ${rowsOf(era)[name].byTier[g.last - 1].share!.toFixed(1)}% (1 − ${g.last}단계 ${g.gap.toFixed(1)}%p)`).toBeLessThanOrEqual(THREE_CARD_GAP_CAP);
        expect(g.gap, `${era} ${name}: 부호는 1단계가 더 자주 고르는 쪽(제약 경로의 방향)`).toBeGreaterThan(0);
      }
      // 공허 통과 방지: 어느 시대에 어느 카드가 일어나는지가 데이터와 같다(카드가 사라지거나 다른 시대로 옮겨 가 단언이 조용히 비는 일을 막는다)
      expect(observed, `${era}에서 관측되는 카드`).toEqual([...OBSERVED[era]]);
    }
  });

  // 변이 점검: 세 번째(돈 드는) 선택지의 적합도를 허용 범위(PARENT_FIT_RANGE 0.5~4.0) 안에서 올리면 격차가 25%p를 넘는다 — 이 상한이 실제로 격차의 확대를 알아챈다
  const MUTATIONS: Array<{ card: (typeof THREE_CARDS)[number]; fit: Record<string, number>; measured: string }> = [
    { card: 'after-hours.alone', fit: { 'school-after-hours/academy': 4 }, measured: '지금 세상 29.7%p' },
    { card: 'noise.hush', fit: { 'infant-noise/move': 4 }, measured: '지금 세상 31.9%p' },
    // stories는 book 4.0만으로는 23.6%p라 상한 아래다 — 범위 안에서 tell을 0.5로 낮춰 함께 바꾼다(37.1%p)
    { card: 'stories.alone', fit: { 'infant-stories/book': 4, 'infant-stories/tell': 0.5 }, measured: '지금 세상 37.1%p' },
  ];
  for (const m of MUTATIONS) {
    it(`변이 점검: ${m.card} — 적합도 ${JSON.stringify(m.fit)}로 바꾸면 격차가 25%p를 넘는다 (측정 ${m.measured})`, () => {
      const table = PARENT_FIT as Record<string, number>;
      const saved: Record<string, number | undefined> = {};
      try {
        for (const [key, v] of Object.entries(m.fit)) {
          saved[key] = table[key];
          table[key] = v;
        }
        const g = gapToLastTier(careRows(sampleYoungByTier('alpha', PER_TIER, 'random')).find((x) => x.name === m.card)!);
        expect(g, `${m.card} 관측`).not.toBeNull();
        expect(g!.gap, `${m.card} 변이 뒤 격차`).toBeGreaterThan(THREE_CARD_GAP_CAP);
      } finally {
        for (const [key, v] of Object.entries(saved)) {
          if (v === undefined) delete table[key];
          else table[key] = v;
        }
      }
      for (const key of Object.keys(m.fit)) expect(PARENT_FIT[key], `${key} 원상 복구`).toBe(saved[key]);
    }, 60_000);
  }
});

describe('T5 ⑧ 에러 0 · 모순 0, ⑨ 같은 시드는 같은 인생', () => {
  it('⑧ 세 시대 × 두 전략 × 1000판이 모두 끝까지 돈다(예외 0) — 표본 수와 구조 점검이 위 시험이 본 값과 같다', () => {
    for (const st of STRATEGIES) for (const era of SIM_PROFILES) expect(natural()[st][era].length).toBe(LIVES);
    // 모순: 부모가 학업 중단(school-family-priority accept)을 정했다면 이후 본인 카드에 학업 관련 이벤트가 뜨지 않는다는 규칙은 `tests/flow.test.ts`가 지킨다 — 여기서는 부모·흘러감 해가 상태 불변식을 깨지 않았는지만 본다
    for (const l of natural().random.alpha) for (const h of l.history) expect(h.age).toBeLessThanOrEqual(20);
  });

  it('⑨ 같은 시드는 같은 인생이다: 30시드 × 세 시대 × 두 전략을 두 번 돌려 연표 전체가 같다', () => {
    for (const st of STRATEGIES) {
      for (const era of SIM_PROFILES) {
        for (let i = 1; i <= 30; i++) {
          const seed = seedOf(i);
          const a = runYoungLife(startLife(seed, era), seed, st);
          const b = runYoungLife(startLife(seed, era), seed, st);
          expect(b.history, `${era} ${st} 시드 ${seed}`).toEqual(a.history);
        }
      }
    }
  });
});

describe('T5 ⑩ 흘러감: 어떤 칸에서도 한 선택지 ≤ 90%, family-priority accept는 보고(대역 5~35%)', () => {
  for (const era of SIM_PROFILES) {
    it(`${era}: 흘러감 카드의 칸마다 최대 평균 확률 ≤ 90% (측정 최대 86.4%, school-teacher-notice/accept 수저1 엄격)`, () => {
      const cells = dominanceCells([...natural().random[era], ...PARENT_WEALTHS.flatMap((t) => tiered()[era][t])], 8).filter((c) => c.by === 'child');
      expect(cells.length, `${era} 칸 수`).toBeGreaterThan(30);
      const worst = cells.reduce((a, b) => (b.maxShare > a.maxShare ? b : a));
      expect(worst.maxShare, `${era}: ${worst.eventId}/${worst.maxId} 수저 ${worst.tier} ${worst.parenting} n=${worst.n}`).toBeLessThanOrEqual(0.9);
    });
  }

  it('school-family-priority(지난 세상 12~17세, 둘째 이상)의 accept 확률이 재력 단계마다 대역 5~35% 안이다 (측정 13.0~14.8%) — 관측이 있는 단계만', () => {
    const rows = familyPriorityAccept(tiered().industrial).filter((r) => r.share !== null);
    expect(rows.length, '관측이 있는 단계 수').toBeGreaterThanOrEqual(2);
    for (const r of rows) {
      expect(r.share!, `${r.tier}단계 accept ${r.share!.toFixed(1)}% (n=${r.n})`).toBeGreaterThanOrEqual(5);
      expect(r.share!, `${r.tier}단계 accept ${r.share!.toFixed(1)}% (n=${r.n})`).toBeLessThanOrEqual(35);
    }
  });
});

describe('T5 ⑪ 보고: 13~18세·19세까지 본인 카드 수 분포와 0장 비율 (PD13), 부모 해 인용 노출률', () => {
  it('분포는 합이 1이고 13~18세 본인 카드 평균은 0.9장 이상 · 0장 비율은 30% 이하다 (1000판 측정 평균 1.00~1.08장 · 0장 22.3~25.8% — 1000판 표본은 잡음 폭이 ±1.4%p라 25% 목표 자체는 아래 3000판 시험이 본다)', () => {
    for (const era of SIM_PROFILES) {
      const c = cardCounts(natural().random[era]);
      expect(c.dist13to18.reduce((a, b) => a + b, 0), era).toBeCloseTo(1, 10);
      expect(c.self13to18, `${era} 13~18세 본인 평균`).toBeGreaterThanOrEqual(0.9);
      expect(c.self13to18Zero, `${era} 13~18세 0장 비율`).toBeLessThanOrEqual(0.3);
      expect(c.selfUpTo19, `${era} 19세까지 본인 평균`).toBeGreaterThan(c.self13to18);
      expect(c.selfUpTo19Zero, `${era} 19세까지 0장 비율`).toBeLessThan(c.self13to18Zero);
    }
  });

  it('PD13 목표: 13~18세 본인 카드가 0장인 판이 세 시대 모두 25% 이하다 (3000판 측정 24.4 / 21.1 / 21.6% — 마스터 결정 9절 3번: ×1.5의 3000판 26.6~29.6%로는 못 미쳐 ×2.0으로 올렸다)', () => {
    for (const era of SIM_PROFILES) {
      const c = cardCounts(sampleYoung(era, 3000, 'random'));
      expect(c.self13to18Zero, `${era} 13~18세 본인 0장 비율`).toBeLessThanOrEqual(0.25);
    }
  }, 60_000);

  it('PD13 적용: 13~18세 본인 영역(공부·친구·취미) 선택지 이벤트의 추첨 가중이 ×2.0이다 — 부모 카드·19세 이상·서술 이벤트는 ×1', () => {
    expect(SELF_AREA_WEIGHT).toBe(2);
    const selfCards = Object.keys(PARENT_DECISION_TABLE).filter((id) => deciderOf(id, 15) === 'self');
    expect(selfCards.length).toBeGreaterThanOrEqual(5);
    for (const id of selfCards) {
      expect(selfAreaWeightFactor(id, 15), id).toBe(SELF_AREA_WEIGHT);
      expect(selfAreaWeightFactor(id, 19), `${id} 19세`).toBe(1);
    }
    for (const id of Object.keys(PARENT_DECISION_TABLE).filter((id) => deciderOf(id, 15) !== 'self')) expect(selfAreaWeightFactor(id, 15), id).toBe(1);
    expect(selfAreaWeightFactor('infant-care', 5)).toBe(1);
  });

  it('부모님이 정한 카드의 인용 박스 노출률은 모든 시대에서 0보다 크고 1보다 작다 (보고: report:parent — 인용은 일부 카드·연도에만 붙는다)', () => {
    for (const era of SIM_PROFILES) {
      const share = cardCounts(natural().random[era]).parentCiteShare;
      // 산업화 세대의 어린 시절(1940~70년대)에는 연결된 인용이 없다 — 0이어도 된다
      if (era !== 'industrial') expect(share, era).toBeGreaterThan(0);
      expect(share, era).toBeLessThan(1);
    }
  });
});
