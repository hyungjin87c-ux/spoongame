import { describe, expect, it, vi } from 'vitest';
import { PERSONA_TABLE } from '../src/data/personaTable';
import { APT_KEYS, PARENT_WEALTHS, PARENTING_STYLES, aptGain, aptScoreOf, aptSeedOf, aptTierOf, applyPersonaShift, mixSeed, personaBirthOf, type PersonaShiftContext, type PersonaState } from '../src/core';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 적성 (SPEC-018 PL2, 설계 2절): `apt_k = clamp(round(0.7 × 싹 + 키움 g), 0, 100)`. 싹은 수저와 독립(저장 안 함), 키움은 학교·부모 투자(`INVEST_Q × INVEST_MUL`)·활동·기질 친화로 자란다.
 * 경계: `base = 0`은 건너뜀(0을 +1로 올리지 않는다) · `g ≥ GMAX(30)`이면 멈춤(불러온 `g`가 더 커도 잘라 버리지 않는다) · 저장 범위 0~40.
 */

const fam = (i: number): number => mixSeed(i + 1, 0x51ed270b);
const state = (g: number[], over: Partial<PersonaState> = {}): PersonaState => ({ v: 1, born: 0, w: [50, 50, 50, 50, 50, 50], shown: 0, g, ...over });
const cx = (age: number, famSeed: number, over: Partial<PersonaShiftContext> = {}): PersonaShiftContext => ({ famSeed, age, parenting: 'strict', parentWealth: 3, ...over });

describe('싹: 수저와 독립, 평균 50의 삼각분포', () => {
  it('싹은 가족 시드와 축만의 함수다 — 수저·양육·기질이 달라도 같은 시드의 싹은 그대로다', () => {
    for (const seed of [fam(1), fam(2), fam(3)]) {
      const before = APT_KEYS.map((_, k) => aptSeedOf(seed, k));
      for (const wealth of PARENT_WEALTHS) for (const parenting of PARENTING_STYLES) personaBirthOf(seed, parenting, wealth);
      expect(APT_KEYS.map((_, k) => aptSeedOf(seed, k))).toEqual(before);
    }
  });

  it('0~100 정수이고 평균 ≈ 50, 가운데가 두껍다(해시 둘의 평균)', () => {
    const N = 20_000;
    let sum = 0;
    let tail = 0;
    let mid = 0;
    for (let i = 0; i < N; i++) {
      const s = aptSeedOf(fam(i), i % 5);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
      sum += s;
      if (s < 10 || s > 90) tail++;
      if (s >= 40 && s <= 60) mid++;
    }
    expect(Math.abs(sum / N - 50)).toBeLessThan(1);
    expect(tail / N).toBeLessThan(0.06); // 균등이면 20%, 삼각분포면 4%
    expect(mid / N).toBeGreaterThan(0.35);
  });

  it('다섯 축의 싹은 서로 다른 해시 키라 서로 다르다(같은 값으로 붙어 있지 않다)', () => {
    let same = 0;
    for (let i = 0; i < 400; i++) {
      const s = APT_KEYS.map((_, k) => aptSeedOf(fam(i), k));
      if (new Set(s).size === 1) same++;
    }
    expect(same).toBe(0);
  });
});

describe('적성 점수와 단계', () => {
  it('식 apt = clamp(round(0.7 × 싹 + g), 0, 100), 키움이 클수록 비감소(단조)', () => {
    for (let i = 0; i < 50; i++) {
      let prev = -1;
      for (let g = 0; g <= 40; g++) {
        const score = aptScoreOf(fam(i), state([g, g, g, g, g]), 1);
        expect(score).toBe(Math.max(0, Math.min(100, Math.round(0.7 * aptSeedOf(fam(i), 1) + g))));
        expect(score).toBeGreaterThanOrEqual(prev);
        prev = score;
      }
    }
  });

  it('상한 100·하한 0에서 자른다', () => {
    expect(aptScoreOf(fam(1), state([40, 40, 40, 40, 40]), 0)).toBeLessThanOrEqual(100);
    expect(aptScoreOf(fam(1), state([0, 0, 0, 0, 0]), 0)).toBeGreaterThanOrEqual(0);
  });

  it('단계 경계: 34 low · 35 mid · 64 mid · 65 high', () => {
    expect([0, 34, 35, 64, 65, 100].map(aptTierOf)).toEqual(['low', 'low', 'mid', 'mid', 'high', 'high']);
  });
});

describe('키움 이득 aptGain: 경계', () => {
  it('base = 0이면 건너뛴다(최소 +1 규칙 전에) — 0을 1로 올리지 않는다', () => {
    for (const g of [0, 10, 29]) expect(aptGain(g, 0, 1.3)).toBe(0);
    expect(aptGain(0, -1, 1)).toBe(0);
  });

  it('g ≥ GMAX(30)이면 멈춘다 — 불러온 g가 GMAX보다 커도 잘라 버리지 않고 더 자라지도 않는다', () => {
    for (const g of [30, 31, 35, 40]) expect(aptGain(g, 4, 1.3)).toBe(0);
    const loaded = state([40, 35, 31, 30, 29]);
    const after = applyPersonaShift(loaded, cx(10, fam(9)), { act: 'study', yearEnd: true });
    expect(after.g[0]).toBe(40); // 40·35·31·30은 그대로
    expect(after.g[1]).toBe(35);
    expect(after.g[2]).toBe(31);
    expect(after.g[3]).toBe(30);
  });

  it('max(1, round(base × m × (1 − g/GMAX))): 작아도 1은 오르고 크게 올라도 저장 범위 40을 넘지 않는다', () => {
    expect(aptGain(29, 2, 1)).toBe(1); // round(0.067) = 0 → 최소 1
    expect(aptGain(0, 2, 1.3)).toBe(3); // round(2.6)
    expect(aptGain(0, 4, 1.0)).toBe(4);
    expect(aptGain(0, 100, 1.3)).toBeLessThanOrEqual(40);
  });

  it('길게 굴려도 어느 축도 0~40을 벗어나지 않는다', () => {
    let p = state([0, 0, 0, 0, 0]);
    for (let n = 0; n < 200; n++) p = applyPersonaShift(p, cx(4 + (n % 15), fam(n), { parentWealth: 5, parenting: 'helicopter' }), { act: (['study', 'art', 'sport', 'make', 'social'] as const)[n % 5], yearEnd: true });
    for (const g of p.g) {
      expect(g).toBeLessThanOrEqual(40);
      expect(g).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('성장 원천', () => {
  it('학교: 6~18세 짝수 나이에는 study가 +1 이상 오르고, 홀수 나이에는 +1만 오르는 일이 없다(투자는 +2 이상)', () => {
    for (let i = 0; i < 300; i++) {
      for (const age of [6, 8, 10, 18]) expect(applyPersonaShift(state([0, 0, 0, 0, 0]), cx(age, fam(i)), { yearEnd: true }).g[0]).toBeGreaterThanOrEqual(1);
      for (const age of [7, 9, 17]) expect(applyPersonaShift(state([0, 0, 0, 0, 0]), cx(age, fam(i)), { yearEnd: true }).g[0]).not.toBe(1);
    }
  });

  it('부모 투자: 해마다(4~18세) 해시 < q(= INVEST × INVESTMUL)이면 올라간다 — 빈도가 q와 맞는다(5세 · 수저 3 · strict · study)', () => {
    const q = Math.min(0.6, PERSONA_TABLE.INVEST['3'][0] * PERSONA_TABLE.INVESTMUL.strict[0]);
    const N = 6000;
    let hit = 0;
    for (let i = 0; i < N; i++) if (applyPersonaShift(state([0, 0, 0, 0, 0]), cx(5, fam(i)), { yearEnd: true }).g[0] > 0) hit++;
    expect(Math.abs(hit / N - q)).toBeLessThanOrEqual(0.03);
  });

  it('부모 투자는 4세부터 18세까지만이다', () => {
    for (let i = 0; i < 200; i++) {
      expect(applyPersonaShift(state([0, 0, 0, 0, 0]), cx(3, fam(i)), { yearEnd: true }).g).toEqual([0, 0, 0, 0, 0]);
      expect(applyPersonaShift(state([0, 0, 0, 0, 0]), cx(19, fam(i)), { yearEnd: true }).g).toEqual([0, 0, 0, 0, 0]);
    }
  });

  it('수저가 높을수록 부모 투자로 자란 키움의 평균이 줄지 않는다(단조 — study·art·sport)', () => {
    const means = PARENT_WEALTHS.map((wealth) => {
      let total = 0;
      const N = 1500;
      for (let i = 0; i < N; i++) {
        let p = state([0, 0, 0, 0, 0]);
        for (let age = 0; age < 20; age++) p = applyPersonaShift(p, cx(age, fam(i), { parentWealth: wealth, parenting: PARENTING_STYLES[i % 4] }), { yearEnd: true });
        total += p.g[0] + p.g[1] + p.g[2];
      }
      return total / N;
    });
    for (let i = 1; i < means.length; i++) expect(means[i], `수저 ${i + 1}`).toBeGreaterThanOrEqual(means[i - 1] - 0.05);
    expect(means[4]).toBeGreaterThan(means[0]);
  });

  it('활동: 활동이 가리키는 축이 자란다(ACTAPT) — sport → 운동 능력 +3~5, 부모·흘러감 ½', () => {
    const base = state([0, 0, 0, 0, 0]);
    const full = applyPersonaShift(base, cx(10, fam(1)), { act: 'sport' });
    expect(PERSONA_TABLE.ACTAPT.sport).toEqual([0, 0, 4, 0, 0]);
    expect(full.g[2]).toBeGreaterThanOrEqual(3);
    expect(full.g[2]).toBeLessThanOrEqual(5);
    expect([full.g[0], full.g[1], full.g[3], full.g[4]]).toEqual([0, 0, 0, 0]); // base 0인 축은 건너뛴다
    const half = applyPersonaShift(base, cx(10, fam(1)), { act: 'sport', by: 'parent' });
    expect(half.g[2]).toBeGreaterThanOrEqual(2);
    expect(half.g[2]).toBeLessThan(full.g[2]);
  });

  it('기질 친화: 끈기 있는 기질(steady)은 학업 키움이 더 빠르다(m_k 최대 1.3, 학업 AFF 0.6)', () => {
    const steady = applyPersonaShift(state([0, 0, 0, 0, 0], { w: [50, 95, 50, 50, 50, 50] }), cx(10, fam(1)), { act: 'study' });
    const plain = applyPersonaShift(state([0, 0, 0, 0, 0]), cx(10, fam(1)), { act: 'study' });
    expect(steady.g[0]).toBeGreaterThan(plain.g[0]);
  });
});

describe('수저 1·5의 적성 단계 도달률 (측정 — 완료 기준 9는 report:persona가 판정한다)', () => {
  it('해 끝 성장만으로도 수저 1에서 학업 high가 > 5%이고 수저 5에서 학업 low가 > 5%다 · 수저 1이 high가 적고 low가 많다', () => {
    const tier = (wealth: 1 | 5): { high: number; low: number } => {
      let high = 0;
      let low = 0;
      const N = 1500;
      for (let i = 0; i < N; i++) {
        const parenting = PARENTING_STYLES[i % 4];
        let p = personaBirthOf(fam(i), parenting, wealth);
        for (let age = 0; age < 20; age++) p = applyPersonaShift(p, cx(age, fam(i), { parentWealth: wealth, parenting }), { yearEnd: true });
        const t = aptTierOf(aptScoreOf(fam(i), p, 0));
        if (t === 'high') high++;
        if (t === 'low') low++;
      }
      return { high: high / N, low: low / N };
    };
    const poor = tier(1);
    const rich = tier(5);
    expect(poor.high).toBeGreaterThan(0.05);
    expect(rich.low).toBeGreaterThan(0.05);
    expect(rich.high).toBeGreaterThanOrEqual(poor.high);
    expect(poor.low).toBeGreaterThanOrEqual(rich.low);
  });
});
