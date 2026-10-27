import birthSrc from '../src/core/birth.ts?raw';
import rngSrc from '../src/core/rng.ts?raw';
import stateSrc from '../src/core/state.ts?raw';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERATION,
  DEFAULT_LIFE_LENGTH,
  GENERATION_IDS,
  GENDERS,
  R1_PRESENT,
  MIN_BIRTH_HEALTH,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  beginBirth,
  createInitialState,
  createRng,
  cumulativeBottomPercent,
  cumulativeTopPercent,
  enterBirth,
  enterLife,
  generateBirth,
  generateBirthFromSeed,
  looksPmf,
  looksTopPercent,
  standingOf,
  wealthBottomPercent,
  wealthTopPercent,
  type ProfileId,
} from '../src/core';
import reference from './fixtures/gm3-mixture-reference.json';
import { GENERATION_CONFIG } from '../src/data/generationConfig';
import { GENERATIONS } from '../src/data/generations';
import { R1_PROFILE } from '../src/core/birthProfile';
import { PARENTING_LABEL } from '../src/data/birthText';
import { parentingDocText } from '../src/data/birthReportText';
import { WEALTH_ADJECTIVE } from '../src/data/birthReportTable';
import { EPS, sigmaTolerance, sigmaTolerancePct } from './helpers/stats';
import { exactTopPercent, expectedTopPercent } from './helpers/looksReference';

const N = 30000;

/** 세대 전체(= 랜덤 연도 뽑기 포함)의 수저 섞음 비율(%, 정수) — 시안 생성기가 낸 독립 기준값(`tests/fixtures/gm3-mixture-reference.json`) */
const MIX = (g: ProfileId): readonly number[] => (g === R1_PRESENT ? R1_PROFILE.wealthWeights : (reference as unknown as { gens: Record<string, { wealth: number[] }> }).gens[g].wealth);
/** 교육방식 비율(%) */
const PARENTING_OF = (g: ProfileId) => (g === R1_PRESENT ? R1_PROFILE.parentingWeights : GENERATION_CONFIG[g].parentingWeights);
/** 이 시험이 표본을 뽑는 프로필: 세대 7종 + 시험 전용 R1 프로필 */
const PROFILES: readonly ProfileId[] = [...GENERATION_IDS, R1_PRESENT];

/** 같은 (프로필, n)은 한 번만 뽑는다. 시드가 고정이라 결과는 항상 같다. */
const sampleCache = new Map<string, ReturnType<typeof generateBirth>[]>();
function sample(era: ProfileId, n = N) {
  const key = `${era}:${n}`;
  let births = sampleCache.get(key);
  if (!births) {
    const rng = createRng(20261013);
    births = Array.from({ length: n }, () => generateBirth(rng, era));
    sampleCache.set(key, births);
  }
  return births;
}

describe('세대별 설정 표 (NR1·NR6)', () => {
  for (const g of GENERATION_IDS) {
    it(`${g}: 재력(닻 해 값)·교육방식 가중치 합계 100, 출생 연도 범위가 올바르다`, () => {
      const cfg = GENERATION_CONFIG[g];
      expect(cfg.wealthWeights).toHaveLength(5);
      expect(cfg.wealthWeights.reduce((a, b) => a + b, 0)).toBe(100);
      expect(PARENTING_STYLES.reduce((a, p) => a + cfg.parentingWeights[p], 0)).toBe(100);
      expect(cfg.birth.from).toBeLessThanOrEqual(cfg.birth.to);
      expect(MIX(g).reduce((a, b) => a + b, 0), '세대 섞음 비율 합').toBe(100);
    });
  }

  it('세대 출생 연도 범위(GD1 표): 산업화 1940~1954 · 베이비붐 1955~1963 · 86 1960~1969 · X 1970~1980 · 밀레니얼 1981~1996 · Z 1997~2012 · 알파 2013~2020 (1960~1963은 두 세대 겹침) — 「지금 세상」은 시험 전용 R1 프로필뿐', () => {
    expect(GENERATIONS.map((g) => [g.id, g.birth.from, g.birth.to])).toEqual([
      ['industrial', 1940, 1954],
      ['boomer', 1955, 1963],
      ['g86', 1960, 1969],
      ['genx', 1970, 1980],
      ['millennial', 1981, 1996],
      ['genz', 1997, 2012],
      ['alpha', 2013, 2020],
    ]);
    expect(R1_PROFILE.birthYear).toBe(2026);
  });

  it('세대마다 분포가 서로 다르다 (산업화·베이비붐·86은 같은 닻 값이라 한 묶음, 섞음 비율은 연도별 보간이라 모두 다르다)', () => {
    const w = GENERATION_IDS.map((g) => MIX(g).join(','));
    expect(new Set(w).size).toBeGreaterThanOrEqual(5);
    // 가장 앞 세대가 하위 단계 비중이 가장 크다
    expect(MIX('industrial')[0]).toBeGreaterThan(MIX('alpha')[0]);
  });
});

describe('재력 분포가 표와 통계적으로 맞는다 (허용오차 4σ + 반올림 0.5%p, R-015)', () => {
  for (const era of PROFILES) {
    it(`${era}: 재력 5단계 비율이 세대 섞음 비율과 4σ 이내, 5단계 모두 1회 이상 나온다`, () => {
      const births = sample(era);
      const seen = new Set(births.map((b) => b.character.parentWealth));
      expect([...seen].sort()).toEqual([...PARENT_WEALTHS]); // 가장 작은 단계(지난 세상 5단계 1%)까지 전부 등장
      for (const tier of PARENT_WEALTHS) {
        const count = births.filter((b) => b.character.parentWealth === tier).length;
        const observed = (count / N) * 100;
        const expected = MIX(era)[tier - 1];
        expect(count).toBeGreaterThan(0);
        // 기준값은 정수 %로 반올림된 값(largest remainder)이라 실제 확률과 최대 0.5%p 다르다
        expect(Math.abs(observed - expected), `${era} ${tier}단계 관측 ${observed.toFixed(2)}% / 기대 ${expected}%`).toBeLessThanOrEqual(
          sigmaTolerancePct(expected, N) + 0.5 + EPS,
        );
      }
    });

    it(`${era}: 교육방식 비율이 표와 4σ 이내, 4가지 모두 1회 이상 나온다`, () => {
      const births = sample(era);
      const seen = new Set(births.map((b) => b.character.parenting));
      expect([...seen].sort()).toEqual([...PARENTING_STYLES].sort());
      for (const p of PARENTING_STYLES) {
        const count = births.filter((b) => b.character.parenting === p).length;
        const observed = (count / N) * 100;
        const expected = PARENTING_OF(era)[p];
        expect(count).toBeGreaterThan(0);
        expect(Math.abs(observed - expected), `${era} ${p} 관측 ${observed.toFixed(2)}% / 기대 ${expected}%`).toBeLessThanOrEqual(
          sigmaTolerancePct(expected, N) + EPS,
        );
      }
    });

    it(`${era}: 성별 두 가지가 모두 나온다`, () => {
      const births = sample(era);
      expect(new Set(births.map((b) => b.character.gender))).toEqual(new Set(GENDERS));
    });
  }

  it('허용오차 헬퍼: 작은 범주일수록 조여진다 (1%는 ±1.5%p보다 훨씬 좁다)', () => {
    expect(sigmaTolerancePct(1, N)).toBeLessThan(0.25);
    expect(sigmaTolerancePct(50, N)).toBeGreaterThan(sigmaTolerancePct(1, N));
    expect(sigmaTolerancePct(100, N)).toBe(0);
  });
});

describe('범위·스냅샷', () => {
  it('외모 0~100 정수, 분포가 이론 분포(looksPmf)와 4σ 이내로 맞는다', () => {
    const pmf = looksPmf();
    expect(pmf).toHaveLength(101);
    expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    const births = sample(R1_PRESENT);
    for (const b of births) {
      expect(Number.isInteger(b.character.looks)).toBe(true);
      expect(b.character.looks).toBeGreaterThanOrEqual(0);
      expect(b.character.looks).toBeLessThanOrEqual(100);
    }
    const mean = births.reduce((a, b) => a + b.character.looks, 0) / N;
    const expectedMean = pmf.reduce((a, p, i) => a + p * i, 0);
    const variance = pmf.reduce((a, p, i) => a + p * (i - expectedMean) ** 2, 0);
    expect(Math.abs(mean - expectedMean)).toBeLessThanOrEqual(4 * Math.sqrt(variance / N));
    // 중앙값 근처 점수 이상 비율이 표와 맞는다
    const observedTop = births.filter((b) => b.character.looks >= 60).length / N;
    const expectedTop = pmf.slice(60).reduce((a, b) => a + b, 0);
    expect(Math.abs(observedTop - expectedTop)).toBeLessThanOrEqual(sigmaTolerance(expectedTop, N) + EPS);
  });

  it('looksPmf는 한 번만 계산해 같은 읽기 전용 배열을 돌려준다 (R-017 메모이즈)', () => {
    const a = looksPmf();
    const b = looksPmf();
    expect(b).toBe(a);
    expect(Object.isFrozen(a)).toBe(true);
    // 얼려 있으므로 호출자가 실수로 고쳐도 다음 호출에 영향이 없다
    expect(() => {
      (a as number[])[0] = 123;
    }).toThrow();
    expect(looksPmf()[0]).not.toBe(123);
  });

  it('외모 상위 %: 0점은 100%, 단조 감소', () => {
    expect(looksTopPercent(0)).toBe(100);
    let prev = 101;
    for (let l = 0; l <= 100; l += 5) {
      const v = looksTopPercent(l);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(1);
      prev = v;
    }
  });

  it('외모 상위 %: 0~100점 전부 101^3 전수 열거로 구한 값(반올림, 1~100 보정)과 같다 (R-017)', () => {
    for (let l = 0; l <= 100; l++) {
      expect(looksTopPercent(l), `${l}점`).toBe(expectedTopPercent(l));
    }
    // 대표 값은 기준 구현을 거치지 않고 직접 적어 둔다: 정확히 절반 지점, 맨 끝
    expect(exactTopPercent(0)).toBeCloseTo(100, 9);
    expect(looksTopPercent(50)).toBe(50); // 대칭 분포라 50점 이상은 약 절반(중앙 구간 포함)
    expect(looksTopPercent(100)).toBe(1); // 상위 0.000...%는 1%로 보정
  });

  it('외모 상위 % 표시값이 실제 표본의 꼬리 비율과도 맞는다 (R-017)', () => {
    const births = sample(R1_PRESENT);
    let checked = 0;
    for (let t = 10; t <= 90; t += 5) {
      const exact = exactTopPercent(t);
      if (exact < 1.5) continue; // 1% 하한 보정·반올림이 지배하는 구간은 위 전수 열거 테스트가 맡는다
      const shown = looksTopPercent(t);
      const observed = (births.filter((b) => b.character.looks >= t).length / N) * 100;
      // 반올림(최대 0.5%p) + 표본 오차(4σ)
      expect(Math.abs(observed - shown), `${t}점 이상: 표시 ${shown}% / 표본 ${observed.toFixed(2)}%`).toBeLessThanOrEqual(
        0.5 + sigmaTolerancePct(exact, N),
      );
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('초기 스탯: 모두 0~100, 건강은 최소값 이상(0 아님)', () => {
    for (const era of PROFILES) {
      for (const b of sample(era, 5000)) {
        for (const v of Object.values(b.stats)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
        expect(b.stats.health).toBeGreaterThanOrEqual(MIN_BIRTH_HEALTH);
        expect(b.stats.health).toBeGreaterThan(0);
      }
    }
  });

  it('재력이 높을수록 평균 초기 학력이 높다 (재산 스탯은 없어졌다 — 집안 형편은 부모 재력 단계와 집안 살림이 맡는다, SPEC-003 M5)', () => {
    const births = sample('millennial');
    const avg = (t: number) => {
      const xs = births.filter((b) => b.character.parentWealth === t).map((b) => b.stats.education);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    for (let t = 1; t < 5; t++) expect(avg(t + 1)).toBeGreaterThan(avg(t));
  });

  it('beginBirth: 출생 시점 스탯 스냅샷이 저장되고 stats와 별개 객체다', () => {
    const s = beginBirth(createInitialState(5), 'millennial');
    expect(s.birthStats).toEqual(s.stats);
    expect(s.birthStats).not.toBe(s.stats);
    s.stats.education += 10;
    expect(s.birthStats!.education).not.toBe(s.stats.education);
  });
});

describe('결정성', () => {
  it('같은 시드 + 같은 세대 → 같은 결과, 출생 연도는 그 세대의 범위(시험 전용 R1은 2026 한 해) 안이다', () => {
    for (const era of PROFILES) {
      expect(generateBirthFromSeed(777, era), era).toEqual(generateBirthFromSeed(777, era));
    }
    for (const def of GENERATIONS) {
      for (let seed = 1; seed <= 200; seed++) {
        const y = generateBirthFromSeed(seed, def.id).character.birthYear;
        expect(y, `${def.id} 시드 ${seed}`).toBeGreaterThanOrEqual(def.birth.from);
        expect(y, `${def.id} 시드 ${seed}`).toBeLessThanOrEqual(def.birth.to);
      }
    }
    expect(generateBirthFromSeed(777, R1_PRESENT).character.birthYear).toBe(2026);
  });

  it('다른 시드는 (대부분) 다른 결과', () => {
    const names = new Set(Array.from({ length: 200 }, (_, i) => generateBirthFromSeed(i, 'millennial').character.name));
    expect(names.size).toBeGreaterThan(100);
  });

  it('출생 로직 소스에 Math.random이 없다', () => {
    for (const src of [birthSrc, stateSrc, rngSrc]) {
      expect(src).not.toContain('Math.random');
    }
  });
});

describe('재력 누적 비율이 표와 일치 (표시 문구의 기준은 tests/standing.test.ts)', () => {
  for (const era of PROFILES) {
    it(`${era}: 상위(이상)/하위(이하) 누적 %가 가중치 표의 누적합과 같다`, () => {
      const w = MIX(era);
      for (const tier of PARENT_WEALTHS) {
        const top = w.slice(tier - 1).reduce((a, b) => a + b, 0);
        const bottom = w.slice(0, tier).reduce((a, b) => a + b, 0);
        expect(wealthTopPercent(w, tier)).toBe(top);
        expect(wealthBottomPercent(w, tier)).toBe(bottom);
      }
      expect(wealthTopPercent(w, 1)).toBe(100);
      expect(wealthBottomPercent(w, 5)).toBe(100);
    });
  }

  it('누적 비율이 실제 표본에서 관측한 비율과도 4σ + 반올림 이내로 맞는다 (경험적 검증)', () => {
    for (const era of PROFILES) {
      const births = sample(era);
      for (const tier of PARENT_WEALTHS) {
        const shown = wealthTopPercent(MIX(era), tier);
        const observedTop = (births.filter((b) => b.character.parentWealth >= tier).length / N) * 100;
        expect(Math.abs(observedTop - shown), `${era} ${tier}단계 이상 관측 ${observedTop.toFixed(2)}% / 표시 ${shown}%`).toBeLessThanOrEqual(
          sigmaTolerancePct(shown, N) + 1 + EPS,
        );
        const bottom = wealthBottomPercent(MIX(era), tier);
        const observedBottom = (births.filter((b) => b.character.parentWealth <= tier).length / N) * 100;
        expect(Math.abs(observedBottom - bottom), `${era} ${tier}단계 이하 관측 ${observedBottom.toFixed(2)}% / 표시 ${bottom}%`).toBeLessThanOrEqual(
          sigmaTolerancePct(bottom, N) + 1 + EPS,
        );
      }
    }
  });
});

describe('재력 누적 %는 가중치 합으로 정규화된다 (R-031: 합이 100이 아니어도 throw하지 않는다)', () => {
  const tiers = PARENT_WEALTHS;

  it('합이 100이 아닌 표(합 2, 300, 1000)도 비율이 0~100이고, 같은 비율의 표와 결과가 같다', () => {
    const base = [1, 2, 3, 4, 5]; // 합 15
    for (const scale of [2, 20, 66.6667]) {
      const scaled = base.map((w) => w * scale);
      for (const t of tiers) {
        expect(cumulativeTopPercent(scaled, t)).toBeCloseTo(cumulativeTopPercent(base, t), 9);
        expect(cumulativeBottomPercent(scaled, t)).toBeCloseTo(cumulativeBottomPercent(base, t), 9);
      }
    }
    for (const weights of [[1, 1, 0, 0, 0], [20, 40, 60, 80, 100], [0.2, 0.2, 0.2, 0.2, 0.2], [99.9, 0, 0, 0, 0]]) {
      for (const t of tiers) {
        const top = cumulativeTopPercent(weights, t);
        const bottom = cumulativeBottomPercent(weights, t);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThanOrEqual(100);
        expect(bottom).toBeGreaterThanOrEqual(0);
        expect(bottom).toBeLessThanOrEqual(100);
      }
    }
  });

  it('직접 적은 값: [1,1,0,0,0]이면 1단계 이상 100% / 2단계 이상 50%, 1단계 이하 50% / 2단계 이하 100%', () => {
    const w = [1, 1, 0, 0, 0];
    expect(cumulativeTopPercent(w, 1)).toBe(100);
    expect(cumulativeTopPercent(w, 2)).toBe(50);
    expect(cumulativeTopPercent(w, 3)).toBe(0);
    expect(cumulativeBottomPercent(w, 1)).toBe(50);
    expect(cumulativeBottomPercent(w, 2)).toBe(100);
    expect(cumulativeBottomPercent(w, 5)).toBe(100);
  });

  it('합이 100이 아닌 표에서도 standingOf(표현 결정)가 throw하지 않는다 — 렌더 예외가 나지 않는다', () => {
    for (const w of [[1, 1, 0, 0, 0], [10, 20, 30, 20, 20.5], [5, 5, 5, 5, 5], [0.1, 0.1, 0.1, 0.1, 0.1]]) {
      for (const t of tiers) {
        expect(() => standingOf(cumulativeTopPercent(w, t), cumulativeBottomPercent(w, t))).not.toThrow();
      }
    }
  });

  it('합이 0 이하이면 throw한다 (의미 없는 표)', () => {
    expect(() => cumulativeTopPercent([0, 0, 0, 0, 0], 1)).toThrow(RangeError);
    expect(() => cumulativeBottomPercent([0, 0, 0, 0, 0], 1)).toThrow(RangeError);
    expect(() => cumulativeTopPercent([], 1)).toThrow(RangeError);
  });

  it('실제 세대 표(합 100)의 결과는 정규화 전과 같다 (정수 연산이라 부동소수 오차가 없다)', () => {
    for (const era of PROFILES) {
      for (const t of tiers) {
        expect(Number.isInteger(wealthTopPercent(MIX(era), t)), `${era} ${t}`).toBe(true);
        expect(Number.isInteger(wealthBottomPercent(MIX(era), t)), `${era} ${t}`).toBe(true);
      }
    }
  });
});

describe('상태 전이', () => {
  it('첫 화면(타이틀, 기본 「랜덤 세대」·약 30분) → 출생 → 인생. 세대는 「태어나기」 순간에 뽑혀 판에 들어간다 (GS3)', () => {
    expect(DEFAULT_GENERATION).toBe('random');
    expect(DEFAULT_LIFE_LENGTH).toBe('short30');
    let s = createInitialState(1);
    expect(s.phase).toBe('title');
    expect(s.generation).toBeNull(); // 고르는 값은 설정에 있다. 판에는 출생 때 정해진다
    expect(s.lifeLength).toBeNull();
    s = beginBirth(s); // 아무것도 안 고르면 기본값 — 세대와 출생 결과가 이 순간 정해지고 룰렛 단계로 간다(RL5)
    expect(s.phase).toBe('roulette');
    expect(GENERATION_IDS as readonly string[]).toContain(s.generation);
    expect(s.fromRandom, '랜덤 세대에서 나온 판 표지').toBe(true);
    expect(s.lifeLength).toBe('short30');
    expect(s.character).not.toBeNull();
    expect(s.birthReport).not.toBeNull();
    expect(s.peerSeed).not.toBeNull();
    expect(enterLife(s)).toBe(s); // 룰렛에서 곧바로 인생으로는 못 간다(출생신고를 거친다)
    s = enterBirth(s);
    expect(s.phase).toBe('birth');
    s = enterLife(s);
    expect(s.phase).toBe('life');
    expect(s.lifeLength).toBe('short30'); // 진행 중에도 그대로(LM3)
  });

  it('랜덤 세대는 같은 시드면 같은 세대를 뽑고, 7세대가 모두 나온다 (같은 확률)', () => {
    expect(beginBirth(createInitialState(31), 'random').generation).toBe(beginBirth(createInitialState(31), 'random').generation);
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 7000; seed++) {
      const g = beginBirth(createInitialState(seed), 'random').generation!;
      seen.set(g, (seen.get(g) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual([...GENERATION_IDS].sort());
    for (const g of GENERATION_IDS) expect(Math.abs((seen.get(g) ?? 0) / 7000 - 1 / 7), g).toBeLessThan(0.03);
  });

  it('고른 세대·인생 길이가 판에 그대로 들어가고(표지 fromRandom 없음), 인생 길이는 인생이 시작돼도 바뀌지 않는다 (LM3)', () => {
    for (const era of GENERATION_IDS) {
      for (const length of ['short30', 'long60'] as const) {
        const born = enterBirth(beginBirth(createInitialState(77), era, length));
        expect(born.generation, `${era}/${length}`).toBe(era);
        expect(born.lifeLength, `${era}/${length}`).toBe(length);
        expect(born.fromRandom).toBeUndefined();
        expect(enterLife(born).lifeLength).toBe(length);
      }
    }
  });

  it('인생 길이가 달라도 출생 결과(인물·스탯)는 같다 — 인생 길이는 출생 확률에 영향을 주지 않는다', () => {
    const a = beginBirth(createInitialState(123), 'millennial', 'short30');
    const b = beginBirth(createInitialState(123), 'millennial', 'long60');
    expect(b.character).toEqual(a.character);
    expect(b.stats).toEqual(a.stats);
    expect(b.rngState).toBe(a.rngState);
  });

  it('beginBirth 연타해도 한 번만 뽑힌다 / 첫 화면(title) 밖에서는 아무 일도 없다', () => {
    const rolled = beginBirth(createInitialState(9), 'alpha');
    expect(beginBirth(rolled, 'industrial')).toBe(rolled);
    expect(enterBirth(enterBirth(rolled))).toEqual(enterBirth(rolled)); // 「출생신고 보기」 연타도 한 번
    const born = enterBirth(rolled);
    expect(enterBirth(born)).toBe(born); // 출생신고 단계에서는 더 하지 않는다
    expect(enterLife(enterLife(born))).toEqual(enterLife(born));
    const life = enterLife(born);
    expect(beginBirth(life, 'industrial', 'long60')).toBe(life);
    expect(enterLife(createInitialState(9))).toEqual(createInitialState(9)); // 출생 전에는 인생이 시작되지 않는다
  });

  it('beginBirth는 정확히 한 번 뽑은 결과이고 rngState가 그만큼 전진한다 (R-022)', () => {
    const before = createInitialState(9);
    const born = beginBirth(before, 'alpha');

    // 같은 상태에서 generateBirth를 직접 한 번 돌린 결과와 같다
    const ref = createRng(before.rngState);
    const expected = generateBirth(ref, 'alpha');
    expect(born.character).toEqual(expected.character);
    expect(born.stats).toEqual(expected.stats);
    expect(born.birthReport).toEqual(expected.report); // 출생신고 상세·또래 시드도 같은 한 번의 추첨에서 나온다
    expect(born.peerSeed).toBe(expected.peerSeed);
    expect(born.rngState).toBe(ref.getState());

    // 난수 상태가 실제로 전진했다 (시드 그대로가 아니다)
    expect(born.rngState).not.toBe(before.rngState);
    expect(born.seed).toBe(before.seed);

    // 두 번 뽑았다면 결과가 달랐을 것이다 → 위의 일치가 "1회 추첨"을 실제로 구분한다
    const second = generateBirth(createRng(born.rngState), 'alpha');
    expect(second.character).not.toEqual(born.character);

    // 연타해도 상태가 바뀌지 않는다
    expect(beginBirth(born)).toBe(born);
    expect(beginBirth(beginBirth(born))).toBe(born);
  });

  it('세대 7종 모두 출생까지 도달하고 그 세대 범위의 연도가 나온다', () => {
    for (const def of GENERATIONS) {
      const s = beginBirth(createInitialState(42), def.id);
      expect(s.generation).toBe(def.id);
      const y = s.character!.birthYear;
      expect(y).toBeGreaterThanOrEqual(def.birth.from);
      expect(y).toBeLessThanOrEqual(def.birth.to);
      expect(GENDERS).toContain(s.character!.gender);
    }
  });
});

describe('화면 문구 (출생신고의 형편 서술·교육방식, 합쇼체)', () => {
  const FORBIDDEN_GRADE = /[흙동은금]수저|다이아|수저/;
  const combos = PARENT_WEALTHS.flatMap((w) => PARENTING_STYLES.map((p) => ({ w, p })));

  it('재력 5단계 × 교육방식 4종 = 20개 조합 모두 문구가 있다 (R-013)', () => {
    expect(combos).toHaveLength(20);
    for (const { w, p } of combos) {
      const t = parentingDocText(p, w);
      expect(typeof t, `재력 ${w} × ${p}`).toBe('string');
      expect(t.trim().length, `재력 ${w} × ${p}`).toBeGreaterThan(10);
      expect(PARENTING_LABEL[p].length).toBeGreaterThan(0);
    }
    // 형편 서술 5개는 서로 다르고, 방임은 형편 단계별로 문구가 나뉜다
    expect(Object.keys(WEALTH_ADJECTIVE)).toHaveLength(5);
    expect(new Set(Object.values(WEALTH_ADJECTIVE)).size).toBe(5);
    expect(new Set(PARENT_WEALTHS.map((w) => parentingDocText('neglect', w))).size).toBeGreaterThanOrEqual(3);
    // 20개 조합의 최종 문장(형편 + 교육방식)이 모두 서로 다르다
    const full = combos.map(({ w, p }) => `${WEALTH_ADJECTIVE[w]} ${parentingDocText(p, w)}`);
    expect(new Set(full).size).toBe(20);
  });

  it('형편 서술·교육방식 문구에 등급명(흙/동/은/금/다이아 수저)과 느낌표가 없고, 문장은 합쇼체(~습니다)로 끝난다 — 인생 기록 첫 줄에도 들어가는 글이라 등급명 금지(C4)', () => {
    const all = [...Object.values(WEALTH_ADJECTIVE), ...combos.map(({ w, p }) => parentingDocText(p, w))];
    for (const t of all) {
      expect(t).not.toMatch(FORBIDDEN_GRADE);
      expect(t).not.toContain('!');
    }
    for (const { w, p } of combos) for (const sentence of parentingDocText(p, w).split(/(?<=\.)\s*/).filter(Boolean)) expect(sentence, `${w}×${p}`).toMatch(/습니다\.$/);
  });

  it('R-013: 재력 4·5단계의 어떤 교육방식 문구에도 가난·쫓김 표현이 없다', () => {
    const poorWords = /먹고사는|쫓겨|빠듯|한숨|끼니|가난|형편이 어려|여유가 없/;
    for (const w of [4, 5] as const) {
      for (const p of PARENTING_STYLES) {
        expect(parentingDocText(p, w), `재력 ${w} × ${p}`).not.toMatch(poorWords);
      }
    }
  });

  it('R-013: 재력 1·2단계의 어떤 교육방식 문구에도 넉넉함 표현이 없다', () => {
    const richWords = /아끼지 않|여유가 있|돈 문제로 고민하는 어른을 본 적이 없/;
    for (const w of [1, 2] as const) {
      for (const p of PARENTING_STYLES) {
        expect(parentingDocText(p, w), `재력 ${w} × ${p}`).not.toMatch(richWords);
      }
    }
  });
});
