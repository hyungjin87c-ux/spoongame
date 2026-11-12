import { describe, expect, it, vi } from 'vitest';
import { PERSONA_TABLE } from '../src/data/personaTable';
import {
  ACT_KINDS,
  ROLE_KINDS,
  personaFamSeedOf as personaFamSeed,
  TEMPER_IDS,
  adversityPathOf,
  applyPersonaShift,
  resolveChoiceStep,
  settleShown,
  stableKey,
  stepYear,
  type PersonaShiftContext,
  type PersonaState,
} from '../src/core';
import { ch, ev, lifeAt, personaOf, poolOf, withPending } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 기질 세기 갱신 (SPEC-018 PL1, 설계 1-3절): 활동·감쇠·상하한·완충·역경 세 경로와 지지·본보기·해 끝, 그리고 인생 진행이 그 함수를 **한 번씩** 부르는지.
 * 순수 함수 `applyPersonaShift`를 표 값(`PERSONA_TABLE`)으로 직접 견주고, 진행(`resolveChoiceStep`·`stepYear`)이 같은 결과를 내는지 본다.
 */

const FAM = 424242;
const ctx = (age = 10, over: Partial<PersonaShiftContext> = {}): PersonaShiftContext => ({ famSeed: FAM, age, parenting: 'strict', parentWealth: 3, ...over });
const base = (w: number[], shown = 0, over: Partial<PersonaState> = {}): PersonaState => ({ v: 1, born: shown, w, shown, g: [0, 0, 0, 0, 0], ...over });
const MID = [50, 50, 50, 50, 50, 50];
const row = (table: Record<string, readonly (number | string)[]>, key: string): number[] => table[key] as number[];

describe('활동(act): 표 값 그대로, 감쇠·상하한 안에서', () => {
  it('중립 벡터에서 활동 8종이 ACT 표 행만큼 움직인다(양의 변화는 w=50이라 감쇠 없음)', () => {
    for (const act of ACT_KINDS) {
      const p = applyPersonaShift(base([...MID]), ctx(), { act });
      const want = MID.map((x, i) => x + row(PERSONA_TABLE.ACT, act)[i]);
      expect(p.w, act).toEqual(want);
    }
  });

  it('양의 변화는 감쇠한다: w가 60 위면 줄고(80에서 ½, 95에서 ⅛) 음의 변화는 감쇠 없이 하한 5까지 간다', () => {
    // sport: driven +5 · warm +3 · steady +2 · easy +1 · quiet −2
    const hi = applyPersonaShift(base([50, 50, 80, 50, 50, 50]), ctx(), { act: 'sport' });
    expect(hi.w[2]).toBe(80 + Math.round(5 * 0.5)); // 2.5 → 3
    const top = applyPersonaShift(base([50, 50, 95, 50, 50, 50]), ctx(), { act: 'sport' });
    expect(top.w[2]).toBe(95); // 5 × ⅛ = 0.625 → 1 이 아니라 상한 95를 못 넘는다
    const low = applyPersonaShift(base([50, 50, 50, 50, 6, 50]), ctx(), { act: 'sport' });
    expect(low.w[4]).toBe(5); // −2가 하한 5에서 잘린다
    const edge = applyPersonaShift(base([50, 50, 50, 50, 5, 50]), ctx(), { act: 'sport' });
    expect(edge.w[4]).toBe(5);
  });

  it('어느 활동·어느 시작 벡터에서도 세기는 5~95 정수다 (격자: 시작값 5·20·50·60·80·95)', () => {
    for (const start of [5, 20, 50, 60, 80, 95]) {
      for (const act of ACT_KINDS) {
        const p = applyPersonaShift(base(new Array(6).fill(start)), ctx(), { act });
        for (const x of p.w) {
          expect(Number.isInteger(x)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(5);
          expect(x).toBeLessThanOrEqual(95);
        }
      }
    }
  });

  it('부모가 정한(parent)·흘러간(child) 카드의 활동은 ½다', () => {
    const full = applyPersonaShift(base([...MID]), ctx(), { act: 'social' }); // warm +5 · easy +2 · curious +1 · steady 0 · quiet −3
    const half = applyPersonaShift(base([...MID]), ctx(), { act: 'social', by: 'parent' });
    expect(full.w[3] - 50).toBe(5);
    expect(half.w[3] - 50).toBe(3); // 2.5 → 3
    expect(half.w[4] - 50).toBe(-2); // −1.5 → −2 (0에서 먼 쪽으로)
    expect(applyPersonaShift(base([...MID]), ctx(), { act: 'social', by: 'child' }).w).toEqual(half.w);
  });

  it('결정론: 같은 입력 → 같은 결과, 입력 객체를 바꾸지 않는다', () => {
    const p = base([40, 60, 30, 70, 20, 50]);
    const frozen = JSON.stringify(p);
    expect(applyPersonaShift(p, ctx(), { act: 'read' })).toEqual(applyPersonaShift(p, ctx(), { act: 'read' }));
    expect(JSON.stringify(p)).toBe(frozen);
  });
});

describe('두드러진 기질 판정(완충 H = 6)과 동률', () => {
  it('가장 큰 세기가 지금 기질보다 6 이상 클 때만 바뀐다', () => {
    expect(settleShown([50, 55, 50, 50, 50, 50], 0, FAM, 10)).toBe(0);
    expect(settleShown([50, 56, 50, 50, 50, 50], 0, FAM, 10)).toBe(1);
    expect(settleShown([60, 50, 50, 50, 50, 50], 0, FAM, 10)).toBe(0); // 지금 기질이 가장 크다
  });

  it('동률은 해시로 가르고(진행 난수 없음) 같은 입력이면 같다', () => {
    const w = [40, 70, 70, 40, 40, 40];
    const a = settleShown(w, 0, FAM, 10);
    expect([1, 2]).toContain(a);
    expect(settleShown(w, 0, FAM, 10)).toBe(a);
    // 나이가 다르면 해시가 달라 두 쪽이 모두 나온다
    const seen = new Set<number>();
    for (let age = 0; age < 60; age++) seen.add(settleShown(w, 0, FAM, age));
    expect([...seen].sort()).toEqual([1, 2]);
  });

  it('갱신 결과의 shown은 settleShown과 같다', () => {
    const p = applyPersonaShift(base([50, 50, 50, 50, 50, 50], 0), ctx(), { act: 'sport' }); // driven이 55가 되어 +5 < 6 → 그대로
    expect(p.shown).toBe(0);
    const q = applyPersonaShift(base([50, 50, 50, 50, 50, 50], 0), ctx(), { act: 'social' }); // warm 55 → 그대로
    expect(q.shown).toBe(0);
    const r = applyPersonaShift(base([50, 50, 50, 50, 50, 50], 0), ctx(), { act: 'read' }); // curious +4 · quiet +4 · steady +2 → 54: 그대로
    expect(r.shown).toBe(0);
    // 두 번 반복하면 넘는다
    const s = applyPersonaShift(applyPersonaShift(base([50, 50, 50, 50, 50, 50], 0), ctx(), { act: 'social' }), ctx(), { act: 'social' });
    expect(s.shown).toBe(3);
  });
});

describe('아동기 역경: 세 경로 · 지지 · 한 번 합 ≤ 6 · 한 판 합 ≤ 12', () => {
  const kinds = ['home', 'school', 'health', 'loss', 'bond', 'work'] as const;

  it('경로 확률이 ADV 표를 따른다(키 4,000개 — 칸마다 ±4%p)', () => {
    for (const kind of kinds) {
      const [pw, ph, pd] = row(PERSONA_TABLE.ADV, kind);
      const count = { W: 0, H: 0, D: 0 };
      const N = 4000;
      for (let i = 0; i < N; i++) count[adversityPathOf(FAM, kind, stableKey('evt', `k${i}`), false)]++;
      expect(Math.abs(count.W / N - pw), `${kind} W`).toBeLessThanOrEqual(0.04);
      expect(Math.abs(count.H / N - ph), `${kind} H`).toBeLessThanOrEqual(0.04);
      expect(Math.abs(count.D / N - pd), `${kind} D`).toBeLessThanOrEqual(0.04);
    }
  });

  it('지지가 있으면 W가 +0.3(상한 0.8)이고 나머지는 원래 비율로 줄어든다', () => {
    for (const kind of kinds) {
      const [pw, ph, pd] = row(PERSONA_TABLE.ADV, kind);
      const w2 = Math.min(0.8, pw + 0.3);
      const scale = (1 - w2) / (1 - pw);
      const count = { W: 0, H: 0, D: 0 };
      const N = 5000;
      for (let i = 0; i < N; i++) count[adversityPathOf(FAM, kind, stableKey('evt', `s${i}`), true)]++;
      expect(Math.abs(count.W / N - w2), `${kind} W`).toBeLessThanOrEqual(0.04);
      expect(Math.abs(count.H / N - ph * scale), `${kind} H`).toBeLessThanOrEqual(0.04);
      expect(Math.abs(count.D / N - pd * scale), `${kind} D`).toBeLessThanOrEqual(0.04);
    }
  });

  it('같은 역경도 세 경로로 갈린다(한 방향 고정이 아니다): 같은 키는 같은 경로, 키가 다르면 셋 다 나온다', () => {
    const paths = new Set<string>();
    for (let i = 0; i < 200; i++) paths.add(adversityPathOf(FAM, 'home', stableKey('divorce', `age${i}`), false));
    expect([...paths].sort()).toEqual(['D', 'H', 'W']);
    expect(adversityPathOf(FAM, 'home', 77, false)).toBe(adversityPathOf(FAM, 'home', 77, false));
  });

  it('한 번의 역경 변화 |Δ| 합 ≤ 6이고 advUsed는 실제 적용한 합과 같다', () => {
    for (let i = 0; i < 60; i++) {
      const p = applyPersonaShift(base([...MID]), ctx(8), { adversity: { kind: kinds[i % 6], key: stableKey('x', `${i}`), supported: i % 2 === 0 } });
      const moved = p.w.reduce((a, x, t) => a + Math.abs(x - MID[t]), 0);
      expect(moved).toBeLessThanOrEqual(6);
      expect(p.advUsed ?? 0).toBe(moved);
    }
  });

  it('한 판 역경 합은 12를 넘지 않는다: 한도에 닿으면 남은 몫만 적용하고 잘라 버린다', () => {
    let p = base([...MID]);
    for (let i = 0; i < 30; i++) p = applyPersonaShift(p, ctx(10), { adversity: { kind: 'loss', key: stableKey('loss', `n${i}`), supported: false } });
    expect(p.advUsed).toBe(12);
    // 한도 뒤의 역경은 아무것도 바꾸지 않는다
    const again = applyPersonaShift(p, ctx(10), { adversity: { kind: 'loss', key: stableKey('loss', 'extra'), supported: false } });
    expect(again.w).toEqual(p.w);
    // 한도 직전이면 남은 몫(1)만: advUsed가 12에서 멈추고 한 번에 그 이상 움직이지 않는다
    const near = applyPersonaShift(base([...MID], 0, { advUsed: 11 }), ctx(10), { adversity: { kind: 'home', key: stableKey('x', 'y'), supported: false } });
    expect(near.advUsed).toBe(12);
    expect(near.w.reduce((a, x, t) => a + Math.abs(x - MID[t]), 0)).toBe(1);
  });

  it('나이 19 이상의 역경은 적용하지 않는다(아동기 역경)', () => {
    const p = applyPersonaShift(base([...MID]), ctx(19), { adversity: { kind: 'loss', key: 1, supported: false } });
    expect(p.w).toEqual(MID);
    expect(p.advUsed).toBeUndefined();
  });

  it('지지가 없을 때와 있을 때 같은 키의 경로가 달라질 수 있다(지지가 길을 바꾼다)', () => {
    let changed = 0;
    for (let i = 0; i < 300; i++) {
      const k = stableKey('evt', `${i}`);
      if (adversityPathOf(FAM, 'school', k, false) !== adversityPathOf(FAM, 'school', k, true)) changed++;
    }
    expect(changed).toBeGreaterThan(30);
  });
});

describe('본보기 어른(role): +3(감쇠), 한 판 합 ≤ 12', () => {
  it('어른의 기질은 해시 (70+역할 번호, 나이)로 정해지고, 그쪽 세기가 +3 오른다', () => {
    for (const role of ROLE_KINDS) {
      const p = applyPersonaShift(base([...MID]), ctx(12), { role });
      const moved = p.w.map((x, i) => x - MID[i]);
      expect(moved.filter((d) => d !== 0)).toEqual([3]);
      expect(p.roleUsed).toBe(3);
    }
  });

  it('같은 (역할, 나이)는 같은 어른, 나이가 다르면 다른 어른이 나올 수 있다', () => {
    const at = (age: number) => applyPersonaShift(base([...MID]), ctx(age), { role: 'teacher' }).w.findIndex((x) => x !== 50);
    expect(at(12)).toBe(at(12));
    expect(new Set(Array.from({ length: 30 }, (_, i) => at(i + 1))).size).toBeGreaterThan(1);
  });

  it('roleUsed는 12에서 멈춘다(= +3 × 4번), 그 뒤는 아무것도 바꾸지 않는다', () => {
    let p = base([...MID]);
    for (let age = 1; age <= 12; age++) p = applyPersonaShift(p, ctx(age), { role: ROLE_KINDS[age % 5] });
    expect(p.roleUsed).toBeLessThanOrEqual(12);
    const full = applyPersonaShift(p, ctx(13), { role: 'coach' });
    if ((p.roleUsed ?? 0) === 12) expect(full.w).toEqual(p.w);
    expect(full.roleUsed).toBeLessThanOrEqual(12);
  });

  it('부모가 정한·흘러간 카드의 본보기는 ½다: +3 → +1.5 → 2', () => {
    const p = applyPersonaShift(base([...MID]), ctx(12), { role: 'boss', by: 'parent' });
    expect(p.w.filter((x) => x !== 50)).toEqual([52]);
    expect(p.roleUsed).toBe(2);
  });
});

describe('해 끝 갱신: 양육 방식의 지속 영향', () => {
  it('나이 3~18에서만 일어나고 strict는 steady·driven만 +1 받는다(해시 < 0.5)', () => {
    const none = applyPersonaShift(base([...MID]), ctx(2), { yearEnd: true });
    expect(none.w).toEqual(MID);
    let steady = 0;
    let driven = 0;
    for (let age = 3; age <= 18; age++) {
      const p = applyPersonaShift(base([...MID]), ctx(age), { yearEnd: true });
      expect(p.w.filter((_, i) => i !== 1 && i !== 2 && p.w[i] !== 50)).toEqual([]);
      steady += p.w[1] - 50;
      driven += p.w[2] - 50;
    }
    expect(steady + driven).toBeGreaterThan(0);
    // 16해 × 2개 × 0.5 ≈ 16: 확률이 0.5 근처다
    expect(steady + driven).toBeGreaterThanOrEqual(8);
    expect(steady + driven).toBeLessThanOrEqual(24);
    const after = applyPersonaShift(base([...MID]), ctx(19), { yearEnd: true });
    expect(after.w).toEqual(MID);
  });

  it('양육 방식 4종의 대상 기질이 표(DRIFT)와 같다', () => {
    for (const [parenting, targets] of Object.entries(PERSONA_TABLE.DRIFT)) {
      const hit = new Set<string>();
      for (let age = 3; age <= 18; age++) {
        const p = applyPersonaShift(base([...MID]), ctx(age, { parenting: parenting as 'strict' }), { yearEnd: true });
        p.w.forEach((x, i) => x !== 50 && hit.add(TEMPER_IDS[i]));
      }
      expect([...hit].sort(), parenting).toEqual([...targets].sort());
    }
  });

  it('기질 갱신에 수저는 입력이 아니다: 수저 1과 5의 세기 벡터가 활동·역경·본보기·해 끝 모두에서 똑같다', () => {
    const inputs = [{ act: 'sport' as const }, { role: 'teacher' as const }, { adversity: { kind: 'home' as const, key: 99, supported: false } }, { yearEnd: true }, { act: 'art' as const, role: 'coach' as const, yearEnd: true }];
    for (const input of inputs) {
      for (const age of [4, 9, 15]) {
        const a = applyPersonaShift(base([40, 55, 30, 62, 20, 48]), ctx(age, { parentWealth: 1 }), input);
        const b = applyPersonaShift(base([40, 55, 30, 62, 20, 48]), ctx(age, { parentWealth: 5 }), input);
        expect(a.w).toEqual(b.w);
        expect(a.shown).toBe(b.shown);
        expect(a.advUsed).toBe(b.advUsed);
        expect(a.roleUsed).toBe(b.roleUsed);
      }
    }
  });
});

describe('인생 진행이 갱신 함수를 정확히 한 번씩 부른다', () => {
  const pool = poolOf([
    ev({ id: 'test-club', choices: [ch('go', { act: 'sport' }), ch('stay', { act: 'read' })] }),
    ev({ id: 'test-plain', choices: [ch('a'), ch('b')] }),
  ]);

  it('선택 해결: 해결 한 번 = 활동 갱신 한 번 + 해 끝 갱신 한 번 (대기 중에는 적용하지 않는다)', () => {
    const s0 = lifeAt(1, 10);
    const p0 = personaOf(s0);
    const pending = withPending(s0, pool, 'test-club');
    expect(pending.persona).toEqual(p0); // 대기만으로는 바뀌지 않는다
    expect(stepYear(pending, pool).state).toBe(pending); // 대기 중 진행은 같은 상태
    const r = resolveChoiceStep(pending, pending.pending!.key, 'go', pool);
    const cx = { famSeed: stableFam(s0), age: 10, parenting: s0.character!.parenting, parentWealth: s0.character!.parentWealth };
    const expected = applyPersonaShift(applyPersonaShift(p0, cx, { act: 'sport' }), cx, { yearEnd: true });
    expect(r.state.persona).toEqual(expected);
  });

  it('act가 없는 선택지는 해 끝 갱신만 한다', () => {
    const s0 = lifeAt(2, 12);
    const pending = withPending(s0, pool, 'test-plain');
    const r = resolveChoiceStep(pending, pending.pending!.key, 'a', pool);
    const cx = { famSeed: stableFam(s0), age: 12, parenting: s0.character!.parenting, parentWealth: s0.character!.parentWealth };
    expect(r.state.persona).toEqual(applyPersonaShift(personaOf(s0), cx, { yearEnd: true }));
  });

  it('같은 시드·같은 선택 → 같은 persona (출생·20세 시점)', () => {
    const run = (seed: number): PersonaState => {
      let s = lifeAt(seed, 0);
      for (let guard = 0; s.age < 20 && s.phase === 'life' && guard < 200; guard++) s = s.pending === null ? stepYear(s).state : resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
      return personaOf(s);
    };
    for (const seed of [3, 8, 77]) {
      expect(run(seed)).toEqual(run(seed));
      expect(personaOf(lifeAt(seed, 0))).toEqual(personaOf(lifeAt(seed, 0)));
    }
  });
});

function stableFam(s: { peerSeed: number | null }): number {
  // 가족 시드는 peerSeed에서 파생한다(core/familyRng.ts) — 시험은 공개 함수로 같은 값을 만든다
  return personaFamSeed(s.peerSeed as number);
}
