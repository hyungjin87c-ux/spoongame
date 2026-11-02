import { describe, expect, it } from 'vitest';
import { PARENT_AGE_LIMITS, reportTiltOf } from '../src/data/birthReportTable';
import {
  GENERATION_IDS,
  FAMILY_MAX_CHILDREN,
  MOTHER_BIRTH_MAX,
  YOUNGER_MOTHER_MAX,
  aliveAtSixRate,
  cohabitShare,
  continueProbability,
  divorcePlan,
  famSeedOf,
  familyTables,
  firstGoneOf,
  generateBirthFromSeed,
  grandBirthYears,
  motherAgeShares,
  oldCohortOf,
  olderSiblingPlan,
  orderSharesOf,
  parentGoneAtOf,
  rollFamilyBirth,
  rollGrandparents,
  rollYoungerSiblings,
  survivalCurve,
  type FamilyData,
  type ProfileId,
} from '../src/core';
import { SIBLING_GAP, olderSiblingsOf } from '../src/data/birthReportTable';
import { sigmaTolerance } from './helpers/stats';
import { spreadSeeds } from './helpers/familyGolden';

/**
 * 출생 때 가족 구성 (SPEC-009 FM4a, docs/data/family-model.md 12-2·12-4·12-5절 `familyBirth`).
 * 7세대 × 1000판의 실제 출생 연도·조건에 맞춰 기대값을 적분한다(판마다의 `p_i`를 더한 `μ = Σp_i`, 허용 `4·√Σp_i(1−p_i)`).
 */

const N = 1000;
interface Born {
  gen: ProfileId;
  seed: number;
  birthYear: number;
  gender: 'male' | 'female';
  report: ReturnType<typeof generateBirthFromSeed>['report'];
  family: FamilyData;
  peerSeed: number;
  wealth: number;
}

const ALL: Born[] = GENERATION_IDS.flatMap((gen, gi) =>
  spreadSeeds(N, gi).map((seed) => {
    const b = generateBirthFromSeed(seed, gen);
    return { gen, seed, birthYear: b.character.birthYear, gender: b.character.gender, report: b.report, family: b.family, peerSeed: b.peerSeed, wealth: b.character.parentWealth };
  }),
);

/** 동생이 태어날 수 있는 마지막 주인공 나이 (R-530): min(부모 한 분이 떠나는 해, 이혼한 해) — 출생 때 구성과 같은 식 */
const lastAtOf = (b: Born): number => {
  const firstGone = firstGoneOf(parentGoneAtOf(b.birthYear, b.report, b.family.p));
  return Math.min(firstGone?.at ?? Infinity, divorcePlan(famSeedOf(b.peerSeed), b.birthYear, firstGone)?.at ?? Infinity);
};

const LEAVE_AGE = familyTables().design.leaveAge.value;

const sharesOf = (b: Born) => orderSharesOf(reportTiltOf(b.birthYear), b.report.region, b.birthYear);

/** 관측 개수 vs 기대 Σp, 허용 4·√Σp(1−p) */
function expectCount(observed: number, ps: readonly number[], label: string): void {
  const mu = ps.reduce((a, b) => a + b, 0);
  const sd = Math.sqrt(ps.reduce((a, p) => a + p * (1 - p), 0));
  expect(Math.abs(observed - mu), `${label}: 관측 ${observed} vs 기대 ${mu.toFixed(1)} (4σ = ${(4 * sd).toFixed(1)})`).toBeLessThanOrEqual(4 * sd + 1e-9);
}

describe('같은 입력은 같은 구성이다 (순수성·결정성)', () => {
  it('같은 famSeed·같은 입력 → 같은 FamilyData(깊은 같음), 시드가 다르면 대체로 다르다', () => {
    const b = ALL[0];
    const input = { birthYear: b.birthYear, gender: b.gender, report: b.report, parentWealth: b.wealth as 1, orderShares: sharesOf(b), siblingSeed: b.peerSeed };
    expect(rollFamilyBirth(famSeedOf(b.peerSeed), input)).toEqual(rollFamilyBirth(famSeedOf(b.peerSeed), input));
    const distinct = new Set(ALL.slice(0, 300).map((x) => JSON.stringify([x.family.g, x.family.p, x.family.c])));
    expect(distinct.size).toBeGreaterThan(250);
  });

  it('스트림 독립: 아래 동생의 이어짐 확률(형제 순서 분포)을 바꿔도 조부모·부모 별세·함께 사는 쪽·위 형제는 그대로다', () => {
    for (const b of ALL.slice(0, 200)) {
      const input = { birthYear: b.birthYear, gender: b.gender, report: b.report, parentWealth: b.wealth as 1, orderShares: sharesOf(b), siblingSeed: b.peerSeed };
      const a = rollFamilyBirth(famSeedOf(b.peerSeed), input);
      const c = rollFamilyBirth(famSeedOf(b.peerSeed), { ...input, orderShares: [1, 0, 0] });
      expect(c.g).toEqual(a.g);
      expect(c.p).toEqual(a.p);
      expect(c.c).toEqual(a.c);
      expect(c.o).toEqual(a.o);
    }
  });

  it('스트림 독립: 조부모 추첨이 바뀌어도(같은 부모, 다른 출생 연도 보정 없이) 형제 구성의 굴림은 해시라 서로 밀리지 않는다 — 같은 famSeed로 동생을 따로 굴려도 같다', () => {
    for (const b of ALL.slice(0, 200)) {
      expect(rollYoungerSiblings(famSeedOf(b.peerSeed), b.report.birthOrder, b.report.mother.age, sharesOf(b), lastAtOf(b), b.birthYear - b.report.mother.age)).toEqual(b.family.y);
    }
  });

  it('출생 결과의 family는 재생성과 같다: generateBirth가 만든 값 = rollFamilyBirth(famSeedOf(peerSeed), …)', () => {
    for (const b of ALL.filter((_, i) => i % 7 === 0)) {
      const input = { birthYear: b.birthYear, gender: b.gender, report: b.report, parentWealth: b.wealth as 1, orderShares: sharesOf(b), siblingSeed: b.peerSeed };
      expect(rollFamilyBirth(famSeedOf(b.peerSeed), input)).toEqual(b.family);
    }
  });
});

describe('INV-1 가능한 나이 범위 (7세대 × 1000판)', () => {
  it('위 형제: 옛 계산(olderSiblingPlan)과 100% 같은 값이고 누적 나이 차 ≤ 어머니 나이 − 16 (R-330), 한 명당 2~5살', () => {
    for (const b of ALL) {
      const plan = olderSiblingPlan(b.peerSeed, b.report);
      expect(b.family.o.map((s) => [s.k, s.g === 0 ? 'male' : 'female'])).toEqual(plan.map((p) => [p.gap, p.gender]));
      expect(b.family.o, `${b.gen} ${b.seed}`).toHaveLength(olderSiblingsOf(b.report.birthOrder));
      let prev = 0;
      for (const s of b.family.o) {
        expect(s.k - prev).toBeGreaterThanOrEqual(SIBLING_GAP.min);
        expect(s.k - prev).toBeLessThanOrEqual(SIBLING_GAP.max);
        prev = s.k;
      }
      expect(prev).toBeLessThanOrEqual(b.report.mother.age - PARENT_AGE_LIMITS.min);
    }
  });

  it('아래 동생: 태어나는 해의 어머니 나이 ≤ 45(YOUNGER_MOTHER_MAX), 터울 2~5, 독립 나이 20~30, 전체 자녀 수 ≤ 8 (T-FA3d)', () => {
    expect(YOUNGER_MOTHER_MAX).toBe(45);
    let withYounger = 0;
    for (const b of ALL) {
      const f = b.family;
      let prev = 0;
      for (const s of f.y) {
        expect(b.report.mother.age + s.k, `${b.gen} ${b.seed}: 어머니 나이`).toBeLessThanOrEqual(YOUNGER_MOTHER_MAX);
        expect(s.k - prev).toBeGreaterThanOrEqual(SIBLING_GAP.min);
        expect(s.k - prev).toBeLessThanOrEqual(SIBLING_GAP.max);
        prev = s.k;
        expect(s.s).toBeGreaterThanOrEqual(LEAVE_AGE.min);
        expect(s.s).toBeLessThanOrEqual(LEAVE_AGE.max);
      }
      for (const s of f.o) {
        expect(s.s).toBeGreaterThanOrEqual(LEAVE_AGE.min);
        expect(s.s).toBeLessThanOrEqual(LEAVE_AGE.max);
      }
      expect(Math.min(b.report.birthOrder, 5) + f.y.length).toBeLessThanOrEqual(FAMILY_MAX_CHILDREN);
      if (f.y.length > 0) withYounger++;
    }
    expect(withYounger, '아래 동생이 있는 판이 실제로 있다(공허 통과 방지)').toBeGreaterThan(1500);
  });

  it('조부모: 부모가 태어날 때의 나이는 16~56(PARENT_AGE_LIMITS), 조모는 ≤ 49(MOTHER_BIRTH_MAX), 조부모 출생 연도 < 부모 출생 연도 − 16, 별세 나이 ≥ 그때 나이', () => {
    for (const b of ALL) {
      const by = grandBirthYears(b.birthYear, b.report.mother.age, b.report.father.age, b.family.g);
      const parentBy = [b.birthYear - b.report.father.age, b.birthYear - b.report.father.age, b.birthYear - b.report.mother.age, b.birthYear - b.report.mother.age];
      b.family.g.forEach((g, i) => {
        expect(g.a).toBeGreaterThanOrEqual(PARENT_AGE_LIMITS.min);
        expect(g.a).toBeLessThanOrEqual(PARENT_AGE_LIMITS.max);
        if (i === 1 || i === 3) expect(g.a).toBeLessThanOrEqual(MOTHER_BIRTH_MAX);
        expect(by[i]).toBeLessThanOrEqual(parentBy[i] - PARENT_AGE_LIMITS.min);
        expect(g.d).toBeGreaterThanOrEqual(g.a);
        expect(g.d).toBeLessThanOrEqual(101);
      });
      // 부모: 출생 때 살아 있었으므로 별세 나이 ≥ 그때 나이
      expect(b.family.p[0].d).toBeGreaterThanOrEqual(b.report.mother.age);
      expect(b.family.p[1].d).toBeGreaterThanOrEqual(b.report.father.age);
    }
  });
});

describe('T-GP1 조부모 출생 때 나이 분포 (어머니 출산 연령 분포, 4-1절)', () => {
  it('출산 연령 일곱 칸 비중: 부모 출생 연도별 표가 합 100이고, 1955 앞은 1956~60 칸에서 이른 쪽으로 옮긴 값(1936~55 −1, 1916~35 −2, 그 앞 −3)이다', () => {
    for (const by of [1900, 1915, 1916, 1935, 1936, 1955, 1956, 1965, 1980, 1981, 1995, 2010, 2030]) {
      const { pct, shift } = motherAgeShares(by);
      expect(pct).toHaveLength(7);
      expect(pct.reduce((a, b) => a + b, 0)).toBeGreaterThan(99.5);
      expect(pct.reduce((a, b) => a + b, 0)).toBeLessThan(100.5);
      expect(shift, `${by}`).toBe(by <= 1915 ? 3 : by <= 1935 ? 2 : by <= 1955 ? 1 : 0);
    }
  });

  it('조모(어머니의 어머니)의 출산 연령 칸 비율이 표와 4σ 이내다 (옮김이 없는 1956년생 이후 부모 — 판마다 기대값을 더해 비교)', () => {
    const bins: ReadonlyArray<readonly [number, number]> = [[16, 19], [20, 24], [25, 29], [30, 34], [35, 39], [40, 44], [45, 49]];
    const rows = ALL.flatMap((b) => [
      { by: b.birthYear - b.report.father.age, a: b.family.g[1].a },
      { by: b.birthYear - b.report.mother.age, a: b.family.g[3].a },
    ]).filter((r) => motherAgeShares(r.by).shift === 0);
    expect(rows.length).toBeGreaterThan(5000);
    bins.forEach(([lo, hi], i) => {
      const ps = rows.map((r) => motherAgeShares(r.by).pct[i] / 100);
      const obs = rows.filter((r) => r.a >= lo && r.a <= hi).length;
      expectCount(obs, ps, `조모 출산 연령 ${lo}~${hi}`);
    });
  });

  it('조부의 나이는 같은 쪽 조모보다 대체로 많다(아버지 − 어머니 나이 차 모형): 평균 나이 차가 양수이고 모형 범위 안이다', () => {
    let sum = 0;
    let n = 0;
    for (const b of ALL) {
      for (const [m, f] of [[1, 0], [3, 2]] as const) {
        sum += b.family.g[f].a - b.family.g[m].a;
        n++;
      }
    }
    expect(sum / n).toBeGreaterThan(1.5);
    expect(sum / n).toBeLessThan(5);
  });
});

describe('T-FA4a 조부모·부모 별세 나이', () => {
  const expectedMean = (sex: 'male' | 'female', by: number, a: number): number => {
    const s = survivalCurve(sex, by);
    let e = 0;
    for (let x = a; x <= 100; x++) e += (x * (s[x] - s[x + 1])) / s[a];
    return e;
  };

  it('세대별 조부모 별세 나이 평균이 같은 코호트 곡선의 기대값과 ±1.5세 이내다 (NR5 허용 폭 방식)', () => {
    for (const gen of GENERATION_IDS) {
      const rows = ALL.filter((b) => b.gen === gen);
      let obs = 0;
      let exp = 0;
      let n = 0;
      for (const b of rows) {
        const byF = b.birthYear - b.report.father.age;
        const byM = b.birthYear - b.report.mother.age;
        const gp = [{ sex: 'male' as const, pby: byF, i: 0 }, { sex: 'female' as const, pby: byF, i: 1 }, { sex: 'male' as const, pby: byM, i: 2 }, { sex: 'female' as const, pby: byM, i: 3 }];
        for (const { sex, pby, i } of gp) {
          const g = b.family.g[i];
          obs += g.d;
          exp += expectedMean(sex, pby - g.a, g.a);
          n++;
        }
      }
      expect(Math.abs(obs / n - exp / n), `${gen}: 관측 ${(obs / n).toFixed(2)} vs 기대 ${(exp / n).toFixed(2)}`).toBeLessThan(1.5);
    }
  });

  it('부모 별세 나이도 곡선의 기대값과 맞고(±1.5세), 100세 초과 계획(101)은 0이다', () => {
    let obs = 0;
    let exp = 0;
    for (const b of ALL) {
      obs += b.family.p[0].d + b.family.p[1].d;
      exp += expectedMean('female', b.birthYear - b.report.mother.age, b.report.mother.age) + expectedMean('male', b.birthYear - b.report.father.age, b.report.father.age);
      expect(b.family.p[0].d).toBeLessThanOrEqual(100);
      expect(b.family.p[1].d).toBeLessThanOrEqual(100);
    }
    expect(Math.abs(obs - exp) / (2 * ALL.length)).toBeLessThan(1.5);
  });
});

describe('T-FA4b 조부모와 함께 사는 비율 (6세 단면)', () => {
  it('함께 사는 쪽 c: 0·1·2뿐이고, 사는 쪽에는 6세(없으면 출생 때)에 살아 있는 조부모가 있다', () => {
    for (const b of ALL) {
      expect([0, 1, 2]).toContain(b.family.c);
      if (b.family.c === 0) continue;
      const by = grandBirthYears(b.birthYear, b.report.mother.age, b.report.father.age, b.family.g);
      const parentBy = (i: number) => b.birthYear - (i < 2 ? b.report.father.age : b.report.mother.age);
      const idx = b.family.c === 1 ? [0, 1] : [2, 3];
      const goneAt = idx.map((i) => by[i] + b.family.g[i].d - b.birthYear);
      void parentBy;
      expect(Math.max(...goneAt), `${b.gen} ${b.seed}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('주인공이 6세일 때 살아 있는 조부모와 사는 판의 비율이 pGp(Y+6)와 4σ 이내다 (판마다 기대값 pGp를 더해 비교)', () => {
    const ps: number[] = [];
    let obs = 0;
    for (const b of ALL) {
      ps.push(cohabitShare(Math.min(2025, b.birthYear + 6)));
      const by = grandBirthYears(b.birthYear, b.report.mother.age, b.report.father.age, b.family.g);
      const idx = b.family.c === 1 ? [0, 1] : b.family.c === 2 ? [2, 3] : [];
      if (idx.some((i) => by[i] + b.family.g[i].d - b.birthYear >= 6)) obs++;
    }
    expectCount(obs, ps, '6세에 조부모와 사는 판');
  });

  it('세대별로도 맞는다(산업화·X·알파: 4σ 이내)', () => {
    for (const gen of ['industrial', 'genx', 'alpha'] as const) {
      const rows = ALL.filter((b) => b.gen === gen);
      const ps = rows.map((b) => cohabitShare(Math.min(2025, b.birthYear + 6)));
      let obs = 0;
      for (const b of rows) {
        const by = grandBirthYears(b.birthYear, b.report.mother.age, b.report.father.age, b.family.g);
        const idx = b.family.c === 1 ? [0, 1] : b.family.c === 2 ? [2, 3] : [];
        if (idx.some((i) => by[i] + b.family.g[i].d - b.birthYear >= 6)) obs++;
      }
      // 연도 안쪽 보간·A6 어림(표본 800)의 오차를 감안해 4σ에 기대값의 8%를 더한다
      const mu = ps.reduce((a, b) => a + b, 0);
      const sd = Math.sqrt(ps.reduce((a, p) => a + p * (1 - p), 0));
      expect(Math.abs(obs - mu), `${gen}: 관측 ${obs} vs 기대 ${mu.toFixed(1)}`).toBeLessThanOrEqual(4 * sd + 0.08 * mu);
    }
  });

  it('pGp는 표의 점을 선형 보간하고(1970 앞은 1970 값, 2025 뒤는 2025 값), A6(Y)는 0~1이며 같은 연도는 같은 값이다', () => {
    expect(cohabitShare(1960)).toBeCloseTo(cohabitShare(1970), 10);
    expect(cohabitShare(2000)).toBeCloseTo(0.15, 10);
    expect(cohabitShare(2005)).toBeCloseTo(0.1465, 10);
    expect(cohabitShare(2030)).toBeCloseTo(cohabitShare(2025), 10);
    expect(cohabitShare(2002)).toBeGreaterThan(cohabitShare(2005));
    expect(cohabitShare(2002)).toBeLessThan(cohabitShare(2000));
    for (const y of [1940, 1980, 2020]) {
      const a6 = aliveAtSixRate(y);
      expect(a6).toBeGreaterThan(0);
      expect(a6).toBeLessThanOrEqual(1);
      expect(aliveAtSixRate(y)).toBe(a6);
    }
  });
});

describe('T-FA3a·b 형제 구성', () => {
  it('이어짐 확률 a_k: a_1 = s1/s0, a_2 = s2/s1 ([0, 0.9]로 자름), a_3 = 26/74, a_4 이상 = 7/19', () => {
    expect(continueProbability(1, [60, 30, 10])).toBeCloseTo(0.5, 10);
    expect(continueProbability(2, [60, 30, 10])).toBeCloseTo(1 / 3, 10);
    expect(continueProbability(1, [10, 50, 40])).toBe(0.9);
    expect(continueProbability(2, [10, 0, 40])).toBe(0);
    expect(continueProbability(3, [1, 1, 1])).toBeCloseTo(26 / 74, 10);
    for (const k of [4, 5, 6, 7]) expect(continueProbability(k, [1, 1, 1])).toBeCloseTo(7 / 19, 10);
    expect(continueProbability(0, [1, 1, 1])).toBe(0);
  });

  it('1940년 이전 출생 어머니(코호트 표 `highOrderContinue`)는 상한 cap(k = 1·2)과 고차 q(k ≥ 3)를 쓰고, 1941년생부터는 보정이 없다', () => {
    const rows = familyTables().design.highOrderContinue.value;
    expect(rows.map((r) => r.upTo)).toEqual([1900, 1905, 1910, 1915, 1920, 1925, 1930, 1935, 1940]);
    for (const row of rows) {
      const mby = row.upTo;
      expect(continueProbability(1, [10, 50, 40], mby)).toBe(row.cap);
      expect(continueProbability(3, [1, 1, 1], mby)).toBe(row.q);
      expect(continueProbability(5, [1, 1, 1], mby)).toBe(row.q);
      expect(row.gapMax).toBeGreaterThanOrEqual(SIBLING_GAP.min);
      expect(row.gapMax).toBeLessThanOrEqual(SIBLING_GAP.max);
    }
    // 코호트가 이를수록 짧은 터울·높은 이어짐(출산이 많던 때): 터울 상한은 줄지 않는다
    for (let i = 1; i < rows.length; i++) expect(rows[i].gapMax).toBeGreaterThanOrEqual(rows[i - 1].gapMax);
    expect(continueProbability(3, [1, 1, 1], 1941)).toBeCloseTo(26 / 74, 10);
    expect(continueProbability(1, [10, 50, 40], 1941)).toBe(0.9);
    expect(continueProbability(3, [1, 1, 1])).toBeCloseTo(26 / 74, 10); // 어머니 출생 연도를 안 주면 보정 없음
  });

  it('첫 동생이 있을 비율이 판마다 기대값 a_n × (터울이 어머니 나이 한도에 걸리지 않을 비율)의 합과 4σ 이내다 (형제 순서별)', () => {
    for (const order of [1, 2, 3, 4, 5]) {
      const rows = ALL.filter((b) => b.report.birthOrder === order);
      expect(rows.length, `순서 ${order}`).toBeGreaterThan(100);
      const ps = rows.map((b) => {
        const mby = b.birthYear - b.report.mother.age;
        const a = continueProbability(order, sharesOf(b), mby);
        const gapMax = oldCohortOf(mby)?.gapMax ?? SIBLING_GAP.max; // 1940년 이전 어머니는 코호트의 짧은 터울
        let ok = 0;
        for (let gap = SIBLING_GAP.min; gap <= gapMax; gap++) if (b.report.mother.age + gap <= YOUNGER_MOTHER_MAX && gap <= lastAtOf(b)) ok++;
        return order + 1 <= FAMILY_MAX_CHILDREN ? (a * ok) / (gapMax - SIBLING_GAP.min + 1) : 0;
      });
      // 터울은 해시 균등이라 이 기대값은 정확하다(0.25 단위)
      expectCount(rows.filter((b) => b.family.y.length > 0).length, ps, `${order}째의 첫 동생`);
    }
  });

  it('동생 성별은 균등이다(4σ) — 설계값, 출생 성비 자료(FD7)가 오면 새 판부터 바꾼다', () => {
    const ys = ALL.flatMap((b) => b.family.y);
    expect(ys.length).toBeGreaterThan(5000);
    const males = ys.filter((s) => s.g === 0).length;
    expect(Math.abs(males / ys.length - 0.5)).toBeLessThanOrEqual(sigmaTolerance(0.5, ys.length));
  });

  it('T-FA3c 총 자녀 수(어머니 가중 1/N 환산 평균)가 FD6 코호트값과 ±0.45 이내다 — 어머니가 1911년생 이후인 코호트 전부(1940년 이전은 FM4b의 코호트 보정, 마스터 결정 2026-10-28)', () => {
    // FD6 어머니 출생 코호트 → 센서스 연령 계급 평균 출생아 수 (fd6_mean_children_by_age_calc): 1970 센서스 55-59세 5.42 · 50-54세 5.65 · 45-49세 5.62 / 1975 45-49세 5.23 / 1980 4.69 / 1985 4.07 / 1990 3.43 / 2000 2.31 / 2005 2.00
    const cohorts: Array<[number, number, number]> = [
      [1911, 1915, 5.42],
      [1916, 1920, 5.65],
      [1921, 1925, 5.62],
      [1926, 1930, 5.23],
      [1931, 1935, 4.69],
      [1936, 1940, 4.07],
      [1941, 1945, 3.43],
      [1951, 1955, 2.31],
      [1956, 1960, 2.0],
    ];
    const inv: number[] = cohorts.map(() => 0);
    const cnt: number[] = cohorts.map(() => 0);
    // 어머니 코호트당 표본을 늘리려고 이른 세대는 시드를 더 쓴다 (산업화·베이비붐은 어머니 출생 1911~1935, 86세대·X는 1926~1960)
    const draws: Array<[(typeof GENERATION_IDS)[number], number]> = [['industrial', 12000], ['boomer', 12000], ['g86', 8000], ['genx', 6000], ['millennial', 6000]];
    for (const [gen, n] of draws) {
      for (const seed of spreadSeeds(n, GENERATION_IDS.indexOf(gen))) {
        const b = generateBirthFromSeed(seed, gen);
        const mby = b.character.birthYear - b.report.mother.age;
        cohorts.forEach(([lo, hi], i) => {
          if (mby >= lo && mby <= hi) {
            inv[i] += 1 / (Math.min(b.report.birthOrder, 5) + b.family.y.length);
            cnt[i]++;
          }
        });
      }
    }
    cohorts.forEach(([lo, hi, fd6], i) => {
      expect(cnt[i], `${lo}~${hi}년생 어머니 표본`).toBeGreaterThan(1500);
      const model = cnt[i] / inv[i];
      // 허용 0.45는 설계 문서 12-4절의 ▲ 0.4에 FM4a 측정(1951~55가 +0.41)을 얹어 마스터가 정한 값이다.
      // R-530(부모 별세·이혼 뒤 동생을 끊음)과 1940년 이전 코호트 보정(FM4b) 뒤 다시 잰 값(R-541, 이 표본 그대로): 1911~15 −0.02 · 1916~20 −0.08 · 1921~25 −0.12 · 1926~30 0.00 · 1931~35 −0.04 · 1936~40 −0.03 ·
      // **1941~45 −0.39**(−0.45에 가깝다 — 마스터에게 알림) · 1951~55 +0.37 · 1956~60 +0.18 (ai-log/2026-10-28_SPEC-009_dev-FM4b.md 3절)
      expect(Math.abs(model - fd6), `${lo}~${hi}: 모형 ${model.toFixed(2)} vs FD6 ${fd6}`).toBeLessThanOrEqual(0.45);
    });
  });
});

describe('rollGrandparents 직접 호출', () => {
  it('같은 입력 → 같은 값이고, 부모 나이를 바꾸면 조부모 출생 연도가 따라 바뀐다', () => {
    const a = rollGrandparents(12345, 1990, 30, 33);
    expect(rollGrandparents(12345, 1990, 30, 33)).toEqual(a);
    expect(grandBirthYears(1990, 30, 33, a)).toEqual([1990 - 33 - a[0].a, 1990 - 33 - a[1].a, 1990 - 30 - a[2].a, 1990 - 30 - a[3].a]);
  });
});
