import { describe, expect, it, vi } from 'vitest';
import birthGolden from './fixtures/birth-golden.json';
import { GENERATION_IDS, L0_SEEDS, goldenSeeds, l0Hash } from './helpers/familyGolden';
import { createInitialState, beginBirth, enterBirth, enterLife, famSeedOf, generateBirthFromSeed, parseGame, serializeGame, personaBirthOf, aptSeedOf, PARENTING_STYLES, PARENT_WEALTHS, TEMPER_IDS, mixSeed } from '../src/core';
import { PERSONA_TABLE } from '../src/data/personaTable';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));
vi.mock('../src/core/familyRng', async (orig) => {
  const m = await orig<typeof import('../src/core/familyRng')>();
  return { ...m, famHash01: vi.fn(m.famHash01) };
});

/**
 * 기질 출생 배정 (SPEC-018 PL1, 설계 1-2절). 스위치를 켠 채 돌린다(이 파일 맨 위 mock).
 *  - L0: 배정이 **진행 난수를 소비하지 않는다** — 출생 골든(`birth-golden.json`, 변경 전 코드로 만든 character·stats·report·peerSeed·`rngState` 해시)이 7세대 × 1000판에서 그대로 같다.
 *  - 룰렛 도중·직후 새로고침에도 같은 값: `beginBirth`가 상태에 `persona`를 넣고 저장·복원이 그대로 돌려준다.
 *  - 분포: 양육 방식·수저와 약한 상관(`P_i` ≈ 0.13~0.22), 수저 곱수는 양육 곱수보다 좁다 — 어느 칸에서도 한 기질이 > 25%가 되지 않는다.
 */

describe('L0: 켠 채로도 출생 골든이 그대로다 (진행 난수 비소비)', () => {
  for (const gen of GENERATION_IDS) {
    it(`${gen}: character·stats·report·peerSeed·rngState 해시가 골든과 같다(persona를 켠 상태)`, () => {
      const golden = (birthGolden.generations as Record<string, { hash: string }>)[gen];
      expect(l0Hash(gen, goldenSeeds(L0_SEEDS))).toBe(golden.hash);
    });
  }

  it('켠 출생 결과에는 persona가 있고, 같은 시드 → 같은 persona다', () => {
    for (const seed of [1, 7, 4242, 987654]) {
      const a = generateBirthFromSeed(seed, 'millennial');
      const b = generateBirthFromSeed(seed, 'millennial');
      expect(a.persona).toBeDefined();
      expect(b.persona).toEqual(a.persona);
      expect(a.rngState).toBe(b.rngState);
    }
  });
});

describe('배정 모양', () => {
  it('v=1, 두드러진 기질 번호 0~5, 그 세기 60~69, 나머지 20~44, shown = born, 키움 g는 모두 0, 예산 필드 없음', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { persona, character, peerSeed } = generateBirthFromSeed(seed, 'millennial');
      expect(persona).toBeDefined();
      const p = persona!;
      expect(p.v).toBe(1);
      expect(p.born).toBeGreaterThanOrEqual(0);
      expect(p.born).toBeLessThanOrEqual(5);
      expect(p.shown).toBe(p.born);
      expect(p.w).toHaveLength(6);
      p.w.forEach((x, i) => {
        if (i === p.born) {
          expect(x).toBeGreaterThanOrEqual(60);
          expect(x).toBeLessThanOrEqual(69);
        } else {
          expect(x).toBeGreaterThanOrEqual(20);
          expect(x).toBeLessThanOrEqual(44);
        }
      });
      expect(p.g).toEqual([0, 0, 0, 0, 0]);
      expect(Object.keys(p)).toEqual(['v', 'born', 'w', 'shown', 'g']);
      // 순수 함수와 같은 값이다 (출생 결과가 같은 호출에서 파생한다)
      expect(p).toEqual(personaBirthOf(famSeedOf(peerSeed), character.parenting, character.parentWealth));
    }
  });

  it('출생에서 두드러진 기질 6종이 모두 나온다(한 기질로 쏠리지 않는다)', () => {
    const born = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) born.add(generateBirthFromSeed(seed, 'genx').persona!.born);
    expect([...born].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('beginBirth·저장: 룰렛 도중·직후 새로고침에도 같은 값 (CX-002 보충 1)', () => {
  it('beginBirth가 출생 결과의 persona를 상태에 그대로 옮긴다', () => {
    for (const seed of [3, 11, 500]) {
      const s = beginBirth(createInitialState(seed), 'g86');
      expect(s.phase).toBe('roulette');
      expect(s.persona).toBeDefined();
      const direct = generateBirthFromSeed(seed, 'g86');
      expect(s.persona).toEqual(direct.persona);
      expect(s.peerSeed).toBe(direct.peerSeed);
    }
  });

  it('룰렛·출생신고·인생 단계에서 저장 → 복원이 persona를 그대로 돌려준다', () => {
    const roulette = beginBirth(createInitialState(21), 'millennial');
    const birth = enterBirth(roulette);
    const life = enterLife(birth);
    for (const s of [roulette, birth, life]) {
      const back = parseGame(serializeGame(s));
      expect(back).not.toBeNull();
      expect(back!.persona).toEqual(s.persona);
      expect(serializeGame(back!)).toBe(serializeGame(s));
    }
    expect(life.persona).toEqual(roulette.persona);
  });

  it('재시작(createInitialState)한 새 판에는 이전 판의 persona가 새지 않는다', () => {
    const s = beginBirth(createInitialState(5), 'millennial');
    const next = createInitialState(6);
    expect(next.persona).toBeUndefined();
    expect(beginBirth(next, 'millennial').persona).not.toEqual(s.persona);
  });
});

describe('분포: 양육·수저와 약한 상관', () => {
  /** 해석적 분포 P_i = M[양육][i] × N[수저][i] 를 정규화한 값 (설계 1-2절) */
  const analytic = (parenting: string, wealth: number): number[] => {
    const m = PERSONA_TABLE.BORNM[parenting as keyof typeof PERSONA_TABLE.BORNM] as readonly number[];
    const n = PERSONA_TABLE.BORNN[String(wealth) as '1'] as readonly number[];
    const p = m.map((x, i) => x * n[i]);
    const sum = p.reduce((a, b) => a + b, 0);
    return p.map((x) => x / sum);
  };

  it('해석적 분포: 모든 (양육 × 수저) 칸에서 P_i ≈ 0.13~0.22 (손계산 범위)', () => {
    for (const parenting of PARENTING_STYLES) {
      for (const wealth of PARENT_WEALTHS) {
        for (const p of analytic(parenting, wealth)) {
          expect(p).toBeGreaterThanOrEqual(0.13);
          expect(p).toBeLessThanOrEqual(0.22);
        }
      }
    }
  });

  it('수저 곱수는 양육 곱수보다 좁다 — 같은 양육에서 수저 1과 5의 두드러진 기질 분포 차는 어느 기질에서도 ≤ 8%p (「가난 = 특정 기질」 방지)', () => {
    for (const parenting of PARENTING_STYLES) {
      const a = analytic(parenting, 1);
      const b = analytic(parenting, 5);
      for (let i = 0; i < 6; i++) expect(Math.abs(a[i] - b[i]), `${parenting} ${TEMPER_IDS[i]}`).toBeLessThanOrEqual(0.08);
    }
  });

  it('표본 분포가 해석적 분포와 맞는다(가족 시드 12,000개 — 칸마다 ±3%p)', () => {
    for (const [parenting, wealth] of [['strict', 1], ['free', 3], ['helicopter', 5], ['neglect', 2]] as const) {
      const counts = new Array<number>(6).fill(0);
      const N = 12_000;
      for (let i = 0; i < N; i++) counts[personaBirthOf(mixSeed(i + 1, 0x9e3779b1), parenting, wealth).born]++;
      const want = analytic(parenting, wealth);
      for (let t = 0; t < 6; t++) expect(Math.abs(counts[t] / N - want[t]), `${parenting}/${wealth}/${TEMPER_IDS[t]}`).toBeLessThanOrEqual(0.03);
    }
  });

  it('양육 방식은 기질에 약하게 닿는다: strict는 호기심보다 끈기·지기 싫음 쪽이 더 많고 free는 반대다', () => {
    const strict = analytic('strict', 3);
    const free = analytic('free', 3);
    expect(strict[1]).toBeGreaterThan(strict[0]);
    expect(free[0]).toBeGreaterThan(free[1]);
  });
});

describe('해시 키: 배정과 적성 싹의 키가 서로 겹치지 않는다 (1-2절 「서로 겹치지 않는다 — 시험」)', () => {
  it('(1,0)·(3,0)·(2,i)·싹 (100+k, 0/1)은 모두 다른 (a, b)이고 배정은 진행 난수를 쓰지 않는다', async () => {
    const mod = await import('../src/core/familyRng');
    const spy = mod.famHash01 as unknown as ReturnType<typeof vi.fn>;
    spy.mockClear();
    personaBirthOf(12345, 'free', 3);
    for (let k = 0; k < 5; k++) aptSeedOf(12345, k);
    const keys = spy.mock.calls.map((c) => `${c[1]}:${c[2]}:${c[3]}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.startsWith('21:'))).toBe(true);
    // 배정: 배정 (1,0) · 두드러진 세기 (3,0) · 나머지 5개 (2,i) / 싹 10개 = 17번
    expect(keys.length).toBe(1 + 1 + 5 + 10);
  });
});
