import { describe, expect, it } from 'vitest';
import '../src/data/installAll';
import {
  AUTO_PRIORITY,
  advanceUntilDecision,
  askCloseness,
  autoChoiceWeights,
  autoResolveStep,
  coParentsOf,
  createEventPool,
  createRng,
  playToEnd,
  resolveChoiceStep,
  type EventDef,
  type GameState,
  type ParentingStyle,
  type ParentWealth,
  type StatKey,
} from '../src/core';
import { AUTO_ASSET } from '../src/data/economyTable';
import { FAMILY_NEED_BASE } from '../src/data/parentDecisionTable';
import { ASK_BASE, ASK_EFFECTS, ASK_KINDS, type AskEffectKey, type AskKind } from '../src/data/askTable';
import { EVENT_POOL } from '../src/data/events';
import { chooserFor, startLife } from '../scripts/simulateLib';
import { askEvent } from './helpers/askEvents';
import { askPendingState, askPoolOf } from './helpers/askForced';

/**
 * 조르기와 자동 모드·「다음 결정으로」 (SPEC-011 AK6 ①②, `docs/data/ask-model.md` 5-3절, 완료 기준 10·11의 코어 부분).
 * 자동 모드는 조른다·떼쓴다를 **기대 효과**(갈래별 효과 점수의 갈래 확률 가중 평균)로 점수를 내 `autoChoiceWeights`와 같은 방식(`T = 6`)으로 고른다. 참는다는 일반 선택지다.
 * 실제 사건 9개는 AK7이라 합성 사건(`tests/helpers/askEvents.ts`)과 직접 만든 대기 상태로 본다.
 */

const PARENTINGS: readonly ParentingStyle[] = ['neglect', 'strict', 'free', 'helicopter'];
const WEALTHS: readonly ParentWealth[] = [1, 2, 3, 4, 5];
const EV: Record<AskKind, EventDef> = { toy: askEvent('ask-toy-x', 'toy'), lessons: askEvent('ask-lessons-x', 'lessons'), pet: askEvent('ask-pet-x', 'pet') };
const AGE_MIN: Record<AskKind, number> = { toy: 4, lessons: 5, pet: 5 };
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function stateAt(kind: AskKind, i: number, over: { parenting?: ParentingStyle; wealth?: ParentWealth; peerSeed?: number } = {}): GameState {
  const age = AGE_MIN[kind] + (i % (13 - AGE_MIN[kind]));
  const s = askPendingState(EV[kind], { seed: 1 + (i % 9), peerSeed: (i + 1) * 7919, parenting: PARENTINGS[i % 4], wealth: WEALTHS[(i >> 2) % 5], age, ...over });
  // 아래 독립 계산은 기질 보정(`autoPriorityMul`, SPEC-018 PL1)을 모르는 persona 없는 판의 식이다 — 스위치를 켠 뒤(3b)에도 이 시험은 갈래 식 자체를 보도록 persona를 뗀다. 기질 보정은 `personaAuto.test.ts`가 본다
  const { persona: _persona, ...bare } = s;
  void _persona;
  return bare as GameState;
}

/** 독립 계산: 설계 문서 5-3절 — 갈래 효과의 점수를 갈래 확률로 가중 평균해 exp(점수 / 6) */
function independentWeights(s: GameState, kind: AskKind): number[] {
  const c = askCloseness(s);
  const base = ASK_BASE[kind][s.character!.parentWealth - 1] + 0.06 * (c - 3);
  const pBeg = clamp(base, 0.05, 0.95);
  const pTan = clamp(base + 0.1, 0.05, 0.95);
  const sc = clamp(0.5 + 0.1 * (3 - c), 0.2, 0.8);
  const priority = AUTO_PRIORITY[s.character!.parenting];
  const moneyNeed = 1 + (50 - FAMILY_NEED_BASE[s.character!.parentWealth - 1]) / 100;
  const score = (key: AskEffectKey): number => {
    const eff = ASK_EFFECTS[key];
    let v = 0;
    for (const [k, d] of Object.entries(eff.stats ?? {}) as [StatKey, number][]) v += d * priority[k] * (1 + (50 - s.stats[k]) / 100);
    return v + ((eff.family ?? 0) / AUTO_ASSET.familyPointMan) * priority.wealth * moneyNeed;
  };
  const granted = `granted-${kind}` as AskEffectKey;
  const eBeg = pBeg * score(granted) + (1 - pBeg) * score('denied-beg');
  const eTan = pTan * score(granted) + (1 - pTan) * sc * score('strained') + (1 - pTan) * (1 - sc) * score('denied-tantrum');
  const eEnd = score('endure');
  return [eBeg, eTan, eEnd].map((e) => Math.exp(e / 6));
}

describe('AK6 ① 자동 모드: 조르기 카드는 기대 효과로 점수를 낸다 (autoChoiceWeights의 ev.ask 분기)', () => {
  it('가중치 = 독립 계산(갈래 확률 가중 평균 → exp(점수 / 6)) — 종류 3 × 상태 150', () => {
    for (const kind of ASK_KINDS) {
      const pool = askPoolOf(EV[kind]);
      for (let i = 0; i < 150; i++) {
        const s = stateAt(kind, i);
        const w = autoChoiceWeights(s, pool)!;
        expect(w.ids).toEqual(['beg', 'tantrum', 'endure']);
        const want = independentWeights(s, kind);
        w.weights.forEach((x, k) => expect(x, `${kind}#${i}/${w.ids[k]}`).toBeCloseTo(want[k], 10));
      }
    }
  });

  it('순수·결정론이고 u1·u2를 읽지 않는다 — 사이 C·재력·양육·스탯이 같으면 해시 값이 달라도 같은 가중치다 · 입력 상태는 그대로다', () => {
    const groups = new Map<string, GameState[]>();
    for (let i = 1; i <= 800; i++) {
      const s = askPendingState(EV.toy, { peerSeed: i * 104729, parenting: 'free', wealth: 3, age: 7 });
      const key = `${askCloseness(s)}/${coParentsOf(s, 7)}`;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    let pairs = 0;
    const pool = askPoolOf(EV.toy);
    for (const list of groups.values()) {
      for (let a = 1; a < list.length && a < 6; a++) {
        const before = JSON.stringify(list[a]);
        expect(autoChoiceWeights(list[a], pool)!.weights).toEqual(autoChoiceWeights(list[0], pool)!.weights);
        expect(autoChoiceWeights(list[a], pool)!.weights).toEqual(autoChoiceWeights(list[a], pool)!.weights); // 같은 상태 → 같은 값
        expect(JSON.stringify(list[a])).toBe(before);
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThan(10);
    expect(groups.size).toBeGreaterThanOrEqual(5); // 사이 1~5가 여럿 나온다
  });

  it('참는다는 일반 경로다 — 표의 endure 행(= 데이터 effects)이 데이터를 바꾸면 따라 바뀐다', () => {
    const s = stateAt('toy', 11);
    const base = autoChoiceWeights(s, askPoolOf(EV.toy))!;
    const heavier = askEvent('ask-toy-x', 'toy', {}, { endure: { effects: { stats: { happiness: -5 } } } });
    const w = autoChoiceWeights(s, askPoolOf(heavier))!;
    expect(w.weights[2]).toBeLessThan(base.weights[2]); // 참는다의 데이터 효과를 읽는다
    expect(w.weights[0]).toBe(base.weights[0]); // 조른다·떼쓴다는 표만 읽는다
    expect(w.weights[1]).toBe(base.weights[1]);
  });

  it('지배 방지(완료 기준 10, 코어): 종류 × 재력 × 양육 방식 × 사이 C 전 칸에서 한 선택지 비율 ≤ 90%, 세 선택 모두 확률 > 0', () => {
    const byKey = new Map<string, GameState>();
    for (let seed = 1; seed <= 4000 && byKey.size < 20; seed++) {
      for (const parenting of PARENTINGS) {
        const s = askPendingState(EV.toy, { peerSeed: seed * 7919, parenting, wealth: 3, age: 7 });
        const key = `${parenting}/${askCloseness(s)}`;
        if (!byKey.has(key)) byKey.set(key, s);
      }
    }
    expect(byKey.size).toBe(11); // 양육 방식별로 닿는 사이: 방임 1~3 · 엄격 2~4 · 자율 3~5 · 과보호 4~5
    let cells = 0;
    let top = 0;
    for (const kind of ASK_KINDS) {
      for (const wealth of WEALTHS) {
        for (const [key, s0] of byKey) {
          const s: GameState = { ...s0, character: { ...s0.character!, parentWealth: wealth }, pending: { ...s0.pending!, eventId: EV[kind].id, key: `${EV[kind].id}@7` } };
          const w = autoChoiceWeights(s, askPoolOf(EV[kind]))!.weights;
          const sum = w.reduce((a, b) => a + b, 0);
          for (const x of w) {
            expect(x, `${kind}/W${wealth}/${key}`).toBeGreaterThan(0);
            expect(x / sum, `${kind}/W${wealth}/${key}`).toBeLessThanOrEqual(0.9);
            top = Math.max(top, x / sum);
          }
          cells++;
        }
      }
    }
    expect(cells).toBe(3 * 5 * 11);
    expect(top).toBeLessThan(0.6); // 손계산 최대 약 42%
  });

  it('autoResolveStep = 자동이 고른 선택을 수동으로 고른 것과 상태 전체가 같다 (R-039) — 조르기 카드도 같다, 갈래는 해시라 난수 수열은 선택 하나에 한 칸', () => {
    for (const kind of ASK_KINDS) {
      const pool = askPoolOf(EV[kind]);
      const chosen = new Map<string, number>();
      for (let i = 0; i < 120; i++) {
        const s = stateAt(kind, i);
        const w = autoChoiceWeights(s, pool)!;
        const id = w.ids[createRng(s.rngState).weightedIndex(w.weights)];
        chosen.set(id, (chosen.get(id) ?? 0) + 1);
        const auto = autoResolveStep(s, s.pending!.key, pool);
        const manual = resolveChoiceStep(s, s.pending!.key, id, pool);
        expect(auto.state, `${kind}#${i}/${id}`).toEqual(manual.state);
        expect(auto.tick).toEqual(manual.tick);
      }
      // 한 선택지로 몰리지 않는다
      expect(chosen.size, kind).toBe(3);
    }
  });
});

describe('AK6 ② 「다음 결정으로」는 조르기 카드 앞에서 멈추고 부모 결정·흘러감은 지나간다 (advanceUntilDecision 코드 변경 없음)', () => {
  // 실제 조르기 사건(AK7 이후)이 풀에 들어와도 이 시험의 합성 사건만 보도록 실제 조르기 사건은 뺀다
  const pool = createEventPool([...EVENT_POOL.events.filter((e) => e.ask === undefined), ...ASK_KINDS.map((k) => EV[k])]);
  const isAsk = (id: string): boolean => ASK_KINDS.some((k) => EV[k].id === id);

  it('조르기 카드가 있는 풀에서 첫 정지는 4~12세의 조르기 카드가 된다 — 4세에는 장난감뿐, 정지 전의 부모 결정·흘러감 해는 멈추지 않고 지나간다', () => {
    let stoppedAtAsk = 0;
    let stoppedAtOther = 0;
    let passedDelegated = 0;
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const r = advanceUntilDecision(startLife(seed, 'alpha'), pool);
      const p = r.state.pending;
      if (p === null) continue; // 대기 카드 없이 끝난 판(없다시피 하다)
      if (isAsk(p.eventId)) {
        stoppedAtAsk++;
        kinds.add(p.eventId);
        expect(p.age, `seed ${seed}`).toBeGreaterThanOrEqual(4);
        expect(p.age, `seed ${seed}`).toBeLessThanOrEqual(12);
        if (p.age === 4) expect(p.eventId).toBe('ask-toy-x');
        expect(p.choiceIds).toEqual(['beg', 'tantrum', 'endure']);
        expect(r.counts.choice).toBe(1); // 본인 카드는 이 카드 하나
        if (r.counts.parent + r.counts.child > 0) passedDelegated++;
      } else stoppedAtOther++;
    }
    expect(stoppedAtAsk).toBeGreaterThan(80); // 손계산: 첫 정지가 4~8세로 앞당겨진다
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(passedDelegated, '정지 전에 부모 결정·흘러감 해가 지나간 판').toBeGreaterThan(5);
    expect(stoppedAtAsk + stoppedAtOther).toBeGreaterThan(140);
  });

  it('이미 조르기 카드가 떠 있으면 한 걸음도 가지 않고, 풀어 준 뒤에는 다음 정지로 간다', () => {
    let s: GameState | null = null;
    for (let seed = 1; seed <= 100 && s === null; seed++) {
      const r = advanceUntilDecision(startLife(seed, 'alpha'), pool);
      if (r.state.pending !== null && isAsk(r.state.pending.eventId)) s = r.state;
    }
    expect(s).not.toBeNull();
    const again = advanceUntilDecision(s!, pool);
    expect(again.state).toBe(s);
    const solved = resolveChoiceStep(s!, s!.pending!.key, 'endure', pool).state;
    const next = advanceUntilDecision(solved, pool);
    expect(next.state.age).toBeGreaterThan(s!.age);
  });

  it('끝까지 돌린 판(자동 · 무작위 수동 흉내) 40 × 2: 조르기 카드는 3세 이하·13세 이상에 없고, 판당 3장 이하·같은 종류 1장·같은 해 1장이며 자동 모드가 인라인으로 푼다', () => {
    let withAsk = 0;
    for (const strategy of ['auto', 'random'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const end = playToEnd(startLife(seed, 'alpha'), chooserFor(strategy, seed), pool).state;
        const lines = end.history.filter((h) => h.kind === 'choice' && isAsk(h.eventId ?? ''));
        expect(lines.length, `${strategy}#${seed}`).toBeLessThanOrEqual(3);
        expect(new Set(lines.map((h) => h.eventId)).size).toBe(lines.length);
        expect(new Set(lines.map((h) => h.age)).size).toBe(lines.length);
        for (const h of lines) {
          expect(h.age).toBeGreaterThanOrEqual(4);
          expect(h.age).toBeLessThanOrEqual(12);
          if (h.age === 4) expect(h.eventId).toBe('ask-toy-x');
          expect(h.by).toBeUndefined(); // 본인이 고른 선택
        }
        if (lines.length > 0) withAsk++;
      }
    }
    expect(withAsk).toBeGreaterThan(60);
  });
});
