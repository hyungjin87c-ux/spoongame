import { describe, expect, it, vi } from 'vitest';
import { PERSONA_TABLE } from '../src/data/personaTable';
import { ACT_KINDS, AUTO_TEMPERATURE, TEMPER_IDS, actPullOf, applyPersonaShift, autoChoiceWeights, autoPriorityMul, autoResolveStep, createRng, resolveChoiceStep, type GameState, type PersonaState } from '../src/core';
import { ch, ev, lifeAt, personaOf, poolOf, withPending } from './helpers/personaTest';
import { forcedPending } from './helpers/forcedPending';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 자동 모드와 기질 (SPEC-018 PL1, 설계 1-4절 `[CX-002-008]`): 성향 표 보정 `m_key`(0.8~1.25)와 활동 끌림(합 `clamp(−4, +4)`) — 자동·흘러감만 쓴다.
 *  - **60% 가드 3종**: ① 기질 극단 벡터(5·95 조합 전부) ② 같은 활동 20회 반복 뒤 벡터(Codex 반례 재현) ③ 세 후보 기대 가중(기존 점수가 같고 한 후보만 활동 일치)에서 한 후보의 자동 선택 몫 ≤ 60%.
 *  - R-039: `autoResolveStep` = 같은 선택을 수동으로 고른 것과 **상태 전체**(persona 포함)가 같다.
 *  - 중립 불변: `persona`가 없으면 곱 1·끌림 0(꺼진 스위치의 같은 동치는 `personaSwitch.test.ts`).
 */

const w = (v: readonly number[]): Pick<PersonaState, 'w'> => ({ w: [...v] });
const T = AUTO_TEMPERATURE;

describe('성향 표 보정 곱 m_key', () => {
  it('중립 벡터(모두 50)에서는 곱이 모두 1이다', () => {
    for (const x of Object.values(autoPriorityMul(w([50, 50, 50, 50, 50, 50])))) expect(x).toBe(1);
  });

  it('극단 벡터 전부(5·95의 64조합)에서 0.8~1.25 안이다', () => {
    for (let mask = 0; mask < 64; mask++) {
      const v = Array.from({ length: 6 }, (_, i) => ((mask >> i) & 1 ? 95 : 5));
      for (const [key, x] of Object.entries(autoPriorityMul(w(v)))) {
        expect(x, `${mask}/${key}`).toBeGreaterThanOrEqual(0.8);
        expect(x, `${mask}/${key}`).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it('표(TP)의 방향이 보인다: 붙임성 좋은 기질이 강하면 관계 쪽 곱이 크다, 지기 싫은 기질이 강하면 돈 쪽 곱이 크다', () => {
    expect(autoPriorityMul(w([50, 50, 50, 95, 50, 50])).relationships).toBeGreaterThan(1);
    expect(autoPriorityMul(w([50, 50, 95, 50, 50, 50])).wealth).toBeGreaterThan(1);
    expect(autoPriorityMul(w([50, 50, 50, 50, 95, 50])).relationships).toBeLessThan(1);
  });
});

describe('활동 끌림: 합산 뒤 ±4로 자른다', () => {
  it('Codex 반례 벡터 [40,76,95,87,5,64]는 자르기 전에 +7.87까지 나온다 — 자른 뒤에는 4다', () => {
    const v = [40, 76, 95, 87, 5, 64];
    const raw = (act: (typeof ACT_KINDS)[number]): number => {
      const row = PERSONA_TABLE.ACT[act] as readonly number[];
      return 4 * v.reduce((a, x, t) => a + ((x - 50) / 50) * (row[t] / 5), 0);
    };
    const worst = Math.max(...ACT_KINDS.map(raw));
    expect(worst).toBeGreaterThan(7.5); // 반례 재현(설계가 적은 +7.87)
    expect(Math.max(...ACT_KINDS.map((a) => actPullOf(w(v), a)))).toBe(4);
  });

  it('어느 벡터(5·95의 64조합)·어느 활동에서도 −4 ~ +4다', () => {
    for (let mask = 0; mask < 64; mask++) {
      const v = Array.from({ length: 6 }, (_, i) => ((mask >> i) & 1 ? 95 : 5));
      for (const act of ACT_KINDS) {
        const pull = actPullOf(w(v), act);
        expect(pull).toBeGreaterThanOrEqual(-4);
        expect(pull).toBeLessThanOrEqual(4);
      }
    }
  });

  it('중립 벡터에서는 끌림이 0이다', () => {
    for (const act of ACT_KINDS) expect(actPullOf(w([50, 50, 50, 50, 50, 50]), act)).toBe(0);
  });
});

describe('60% 가드: 세 후보 중 한 후보의 자동 선택 몫 ≤ 60%', () => {
  // 세 후보의 기존 점수가 같고(효과 없음) 한 후보만 활동 표지가 있다
  const pool = (act: (typeof ACT_KINDS)[number]) => poolOf([ev({ id: 'test-three', choices: [ch('x', { act }), ch('y'), ch('z')] })]);

  const shareOf = (act: (typeof ACT_KINDS)[number], p: PersonaState): number => {
    const po = pool(act);
    const s0 = lifeAt(4, 12);
    const s = withPending({ ...s0, persona: p }, po, 'test-three');
    const wt = autoChoiceWeights(s, po)!;
    const sum = wt.weights.reduce((a, b) => a + b, 0);
    return wt.weights[wt.ids.indexOf('x')] / sum;
  };
  const withW = (v: number[]): PersonaState => ({ ...personaOf(lifeAt(4, 12)), w: v });

  it('① 기질 극단 벡터 전부(5·95 조합 × 활동 8종)', () => {
    let worst = 0;
    for (let mask = 0; mask < 64; mask++) {
      const v = Array.from({ length: 6 }, (_, i) => ((mask >> i) & 1 ? 95 : 5));
      for (const act of ACT_KINDS) worst = Math.max(worst, shareOf(act, withW(v)));
    }
    expect(worst).toBeLessThanOrEqual(0.6);
    // 상한 +4에서 가중 exp(4/6) ≈ 1.95배 → 몫 ≈ 49% (손계산, 60% 아래)
    expect(worst).toBeCloseTo(Math.exp(4 / T) / (Math.exp(4 / T) + 2), 6);
  });

  it('② 같은 활동 20회 반복 뒤 벡터(Codex 반례 재현)', () => {
    for (const act of ACT_KINDS) {
      let p: PersonaState = withW([40, 76, 95, 87, 5, 64]);
      for (let n = 0; n < 20; n++) p = applyPersonaShift(p, { famSeed: 99, age: 6 + (n % 12), parenting: 'strict', parentWealth: 3 }, { act });
      expect(shareOf(act, p), act).toBeLessThanOrEqual(0.6);
    }
  });

  it('③ 세 후보 기대 가중(점수가 같고 한 후보만 활동 일치) — 중립 벡터는 정확히 1/3', () => {
    expect(shareOf('sport', withW([50, 50, 50, 50, 50, 50]))).toBeCloseTo(1 / 3, 9);
    expect(shareOf('sport', withW([5, 5, 95, 95, 5, 5]))).toBeLessThanOrEqual(0.6);
    expect(shareOf('read', withW([95, 95, 5, 5, 95, 5]))).toBeLessThanOrEqual(0.6);
  });

  it('끌림은 점수가 같은 후보 사이에서 방향을 만든다(맞는 기질이면 끌리고 맞지 않으면 덜 끌린다)', () => {
    expect(shareOf('sport', withW([50, 50, 95, 80, 5, 50]))).toBeGreaterThan(1 / 3); // driven·warm이 강하고 quiet이 약함
    expect(shareOf('sport', withW([50, 50, 5, 5, 95, 50]))).toBeLessThan(1 / 3);
  });
});

describe('R-039: 자동 선택 = 같은 선택을 수동으로 고른 것과 상태 전체가 같다 (persona 포함)', () => {
  it('본인이 고르는 카드(어른 나이)에서 autoResolveStep이 수동 해결과 같다', () => {
    const club = poolOf([ev({ id: 'test-club', stages: ['youth'], choices: [ch('go', { act: 'sport' }), ch('stay', { act: 'read' }), ch('rest')] })]);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s0 = lifeAt(seed, 21);
      const pending = withPending({ ...s0, assets: s0.assets }, club, 'test-club');
      const key = pending.pending!.key;
      const wt = autoChoiceWeights(pending, club)!;
      const id = wt.ids[createRng(pending.rngState).weightedIndex(wt.weights)];
      const auto = autoResolveStep(pending, key, club);
      const manual = resolveChoiceStep(pending, key, id, club);
      expect(auto.state).toEqual(manual.state);
      expect(auto.state.persona).toEqual(manual.state.persona);
    }
  });

  it('실제 사건(어른의 큰 결정)에서도 같다', () => {
    let checked = 0;
    for (const era of ['millennial', 'genx'] as const) {
      for (const eventId of ['youth-first-job', 'youth-housing']) {
        let pending: GameState;
        try {
          pending = forcedPending(eventId, era);
        } catch {
          continue;
        }
        const wt = autoChoiceWeights(pending)!;
        const id = wt.ids[createRng(pending.rngState).weightedIndex(wt.weights)];
        expect(autoResolveStep(pending, pending.pending!.key).state).toEqual(resolveChoiceStep(pending, pending.pending!.key, id).state);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('기질이 다르면 같은 상태의 자동 가중이 달라진다(보정이 실제로 읽힌다) — 단 데이터에 act가 없는 사건에서는 성향 보정 곱만으로', () => {
    const pending = forcedPending('youth-housing', 'millennial');
    const strong = { ...pending, persona: { ...personaOf(pending), w: [50, 50, 95, 5, 5, 50] } };
    const quiet = { ...pending, persona: { ...personaOf(pending), w: [50, 50, 5, 95, 95, 50] } };
    const a = autoChoiceWeights(strong)!;
    const b = autoChoiceWeights(quiet)!;
    expect(a.ids).toEqual(b.ids);
    expect(a.weights).not.toEqual(b.weights);
  });
});

describe('중립: persona가 없으면 보정 곱 1·끌림 0', () => {
  it('persona 필드를 지우면 가중이 기질 보정 없이 계산된다(기질이 극단이어도 같은 상태 가중이 달라진다)', () => {
    const pending = forcedPending('youth-housing', 'millennial');
    const { persona: _p, ...bare } = pending;
    void _p;
    const none = autoChoiceWeights(bare as GameState)!;
    const neutral = autoChoiceWeights({ ...pending, persona: { ...personaOf(pending), w: [50, 50, 50, 50, 50, 50] } })!;
    expect(neutral.weights).toEqual(none.weights); // 중립 벡터는 없는 것과 같다(곱 1)
    expect(TEMPER_IDS).toHaveLength(6);
  });
});
