import { describe, expect, it } from 'vitest';
import { FAMILY_TABLES } from '../src/data/familyTables';
import { NO_DEATH_PLAN, deathAgeGiven, familyTables, mortalityClassOf, mortalityScalePre1970, survivalCurve } from '../src/core';

/**
 * 코호트 생존 곡선과 별세 나이 (SPEC-009 FM4a, docs/data/family-model.md 4-4절·12-5절 `familyLife`):
 * 간이생명표 5세 구간 사망확률을 1세 위험률로 쪼개 이어 곱한다. 2024 뒤는 2024 값 유지, 1970 앞은 1970 값에 배율(≥ 1)을 곱한 추정.
 */

describe('구간 번호', () => {
  it('0세 · 1~4세 · 5~9세 … 95~99세 · 100세 이상(22개)으로 나뉜다', () => {
    expect(mortalityClassOf(0)).toBe(0);
    expect(mortalityClassOf(1)).toBe(1);
    expect(mortalityClassOf(4)).toBe(1);
    expect(mortalityClassOf(5)).toBe(2);
    expect(mortalityClassOf(9)).toBe(2);
    expect(mortalityClassOf(10)).toBe(3);
    expect(mortalityClassOf(99)).toBe(20);
    expect(mortalityClassOf(100)).toBe(21);
    expect(mortalityClassOf(130)).toBe(21);
    expect(familyTables().mortality.classes).toBe(22);
  });
});

describe('survivalCurve', () => {
  const cohorts = [1880, 1920, 1950, 1969, 1970, 1985, 2000, 2024, 2060];
  for (const sex of ['male', 'female'] as const) {
    it(`${sex}: S[0] = 1, 길이 102, 단조 비증가, 0~1, S[101] = 0 (100세 이상 구간 Q = 1) — 출생 코호트 ${cohorts.join('·')}`, () => {
      for (const by of cohorts) {
        const s = survivalCurve(sex, by);
        expect(s).toHaveLength(102);
        expect(s[0]).toBe(1);
        expect(s[101]).toBe(0);
        for (let x = 1; x < s.length; x++) {
          expect(s[x], `${sex} ${by}년생 ${x}세`).toBeLessThanOrEqual(s[x - 1]);
          expect(s[x]).toBeGreaterThanOrEqual(0);
          expect(s[x]).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  it('같은 입력은 같은 곡선을 돌려준다(캐시된 같은 객체)', () => {
    expect(survivalCurve('male', 1950)).toBe(survivalCurve('male', 1950));
  });

  it('여자가 남자보다 오래 산다(1950·1985·2000 코호트 60세 생존)', () => {
    for (const by of [1950, 1985, 2000]) expect(survivalCurve('female', by)[60], `${by}년생`).toBeGreaterThan(survivalCurve('male', by)[60]);
  });

  it('나중에 태어난 코호트일수록 오래 산다(여자 60세 생존: 1920 < 1950 < 1985 < 2000)', () => {
    const at60 = [1920, 1950, 1985, 2000].map((by) => survivalCurve('female', by)[60]);
    for (let i = 1; i < at60.length; i++) expect(at60[i]).toBeGreaterThan(at60[i - 1]);
  });

  it('2024 뒤의 해는 2024 값을 유지한다(미래 개선 없음): 2024년에 태어난 코호트의 0세 위험률은 표의 마지막 열이고, 2030 이후 해의 표 값은 2024 열과 같다', () => {
    const m = FAMILY_TABLES.mortality;
    // 2024 출생 코호트의 첫 구간(0세)은 2024년 표를 쓴다 → S[1] = 1 − Q(0세, 2024)
    for (const [si, sex] of [[0, 'male'], [1, 'female']] as const) {
      expect(survivalCurve(sex, 2024)[1]).toBeCloseTo(1 - m.qx[si][0][m.lastYear - m.firstYear], 10);
      // 2060 출생 코호트의 0세는 2060년 → 2024 값을 유지하므로 같다
      expect(survivalCurve(sex, 2060)[1]).toBeCloseTo(1 - m.qx[si][0][m.lastYear - m.firstYear], 10);
    }
  });

  it('1970 앞 해는 1970 값에 배율 m(t) ≥ 1을 곱한다: 배율은 1 이상이고 과거로 갈수록 커지며, 1970 이후는 1이다', () => {
    for (const sex of ['male', 'female'] as const) {
      expect(mortalityScalePre1970(sex, 1970)).toBe(1);
      expect(mortalityScalePre1970(sex, 2000)).toBe(1);
      let prev = 1;
      for (const t of [1969, 1960, 1940, 1920, 1900]) {
        const m = mortalityScalePre1970(sex, t);
        expect(m, `${sex} ${t}`).toBeGreaterThanOrEqual(prev);
        prev = m;
      }
      expect(mortalityScalePre1970(sex, 1900)).toBeGreaterThan(1.5);
    }
  });

  it('1970 앞 코호트의 첫 구간(0세) 사망확률은 1970 값에 배율을 곱해 1970 값보다 크다(Q ≤ 0.999)', () => {
    const q1970 = FAMILY_TABLES.mortality.qx[0][0][0];
    const s = survivalCurve('male', 1930);
    expect(1 - s[1]).toBeGreaterThan(q1970);
    expect(1 - s[1]).toBeLessThanOrEqual(0.999);
  });
});

describe('deathAgeGiven', () => {
  it('u = 0이면 지금 나이에 곧바로(= aliveAtAge), u가 1에 가까우면 가장 늦게 떠난다', () => {
    expect(deathAgeGiven('male', 1950, 40, 0)).toBe(40);
    const late = deathAgeGiven('male', 1950, 40, 0.999999);
    expect(late).toBeGreaterThan(80);
    expect(late).toBeLessThanOrEqual(100);
  });

  it('u에 대해 단조: u가 클수록 별세 나이가 같거나 늦다', () => {
    let prev = -1;
    for (let i = 0; i < 200; i++) {
      const d = deathAgeGiven('female', 1960, 30, i / 200);
      expect(d).toBeGreaterThanOrEqual(prev);
      expect(d).toBeGreaterThanOrEqual(30);
      prev = d;
    }
  });

  it('경계: 살아 있던 나이보다 앞서지 않고, 100을 넘기면 계획 없음(101)이며 100세 이상 구간 Q = 1이라 실제로는 100 이하다', () => {
    for (let u = 0; u < 1; u += 0.01) {
      const d = deathAgeGiven('female', 1990, 56, u);
      expect(d).toBeGreaterThanOrEqual(56);
      expect(d).toBeLessThanOrEqual(100);
    }
    expect(NO_DEATH_PLAN).toBe(101);
    expect(deathAgeGiven('male', 1950, 100, 0.5)).toBe(100);
  });

  it('표본 평균이 곡선의 기대값과 맞는다: 분포는 P(d = x) = (S[x] − S[x+1]) / S[a]', () => {
    for (const [sex, by, a] of [['male', 1940, 30], ['female', 1965, 28], ['male', 1990, 35]] as const) {
      const s = survivalCurve(sex, by);
      let expected = 0;
      for (let x = a; x <= 100; x++) expected += (x * (s[x] - s[x + 1])) / s[a];
      let sum = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) sum += deathAgeGiven(sex, by, a, (i + 0.5) / n);
      expect(Math.abs(sum / n - expected), `${sex} ${by}년생 ${a}세에 살아 있던 사람`).toBeLessThan(0.05);
    }
  });
});
