import { describe, expect, it } from 'vitest';
import statsDoc from '../docs/data/youth-employment-stats.md?raw';
import { PERSONA_TABLE as T } from '../src/data/personaTable';
import { ERA_W_MIN, applyProbOf, hireYearOf, type JobHire } from '../src/core';

/**
 * 시대 표 (SPEC-018 PL4, 설계 4C-3): 연도별 취업 문턱 `HIREYEAR`는 `youth-employment-stats.md` 4-2절 표(a = 1 열)와 **한 칸씩 같고**, 식 `clamp((8.36 ÷ U)^1, 0.75, 1.10)`과 맞고,
 * 범위 밖(1980 앞·2025 뒤)은 1.0이다. 입문 보장은 어떤 해에도 깨지지 않는다(`HIREYEAR` 하한 0.75·입문 자리 `eraW` 미적용·`tries ≥ 3` p = 1은 `HIREYEAR` 무관).
 */

interface Row {
  year: number;
  u: number;
  hire: number;
}

/** 4-2절 표의 행: `| 1980 | 9.8 | 1주×1.058 | 0.853 | **0.85** | 0.92 |` */
function parseStats(): Row[] {
  const rows: Row[] = [];
  for (const line of statsDoc.split('\n')) {
    const m = /^\| (\d{4}) \| ([\d.]+) \|[^|]*\|[^|]*\| \*\*([\d.]+)\*\* \|/.exec(line);
    if (m !== null) rows.push({ year: Number(m[1]), u: Number(m[2]), hire: Number(m[3]) });
  }
  return rows;
}

describe('HIREYEAR 값이 stats 4-2절 표와 같다', () => {
  const rows = parseStats();

  it('표를 제대로 읽었다(1980~2025, 46행)', () => {
    expect(rows).toHaveLength(46);
    expect(rows[0].year).toBe(1980);
    expect(rows[45].year).toBe(2025);
  });

  it('연도마다 코드 값 = 표의 a = 1 열', () => {
    for (const r of rows) expect(hireYearOf(r.year), String(r.year)).toBe(r.hire);
  });

  it('식 clamp((Uref ÷ U)^1, 0.75, 1.10) (Uref = 8.36)과 반올림 오차 안에서 맞는다', () => {
    const [uref] = T.MODEL.hireYearUref;
    const [lo] = T.MODEL.hireYearFloor;
    const [hi] = T.MODEL.hireYearCap;
    expect([uref, lo, hi]).toEqual([8.36, 0.75, 1.1]);
    for (const r of rows) {
      const f = Math.min(hi, Math.max(lo, uref / r.u));
      expect(Math.abs(hireYearOf(r.year) - f), String(r.year)).toBeLessThan(0.006);
    }
  });

  it('범위 밖(1980 앞·2025 뒤)은 1.0', () => {
    for (const y of [1900, 1940, 1979, 2026, 2050, 2100]) expect(hireYearOf(y)).toBe(1);
  });

  it('하한 0.75는 외환위기 1998·1999에만 걸리고 상한 1.10 밖의 값이 없다', () => {
    const years = rows.filter((r) => hireYearOf(r.year) === 0.75).map((r) => r.year);
    expect(years).toEqual([1998, 1999]);
    for (const r of rows) {
      expect(hireYearOf(r.year)).toBeGreaterThanOrEqual(0.75);
      expect(hireYearOf(r.year)).toBeLessThanOrEqual(1.1);
    }
    expect(Math.min(...rows.map((r) => hireYearOf(r.year)))).toBe(0.75);
  });

  it('밀레니얼 첫 취업기(2003~2020) 평균 배율은 1.0 근처(HIRE 기본값을 흔들지 않는다)', () => {
    const mean = rows.filter((r) => r.year >= 2003 && r.year <= 2020).reduce((a, r) => a + hireYearOf(r.year), 0) / 18;
    expect(mean).toBeGreaterThan(0.99);
    expect(mean).toBeLessThan(1.01);
  });

  it('통계로는 평범한 2003·2009·2020은 숫자를 비틀지 않는다(위기감은 사건 문장 몫)', () => {
    expect(hireYearOf(2003)).toBe(1.05);
    expect(hireYearOf(2009)).toBe(1.05);
    expect(hireYearOf(2020)).toBe(0.93);
  });
});

describe('입문 보장 불변 (4C-3 「어느 해에도 깨지지 않는 이유」)', () => {
  it('(b) HIREYEAR 하한 0.75라 첫 지원 p_first 최악도 입문 0.85 × 0.75, 모든 해 p ≥ 0.10', () => {
    for (let y = 1940; y <= 2100; y++) {
      for (const hire of ['open', 'normal', 'selective'] as JobHire[]) {
        const { p } = applyProbOf({ hire, education: 0, aptTier: 'low', stretch: true, hireYear: hireYearOf(y), tries: 0, relationships: 0 });
        expect(p, `${y}/${hire}`).toBeGreaterThanOrEqual(0.1);
      }
      expect(applyProbOf({ hire: 'open', education: 50, stretch: false, hireYear: hireYearOf(y), tries: 0, relationships: 0 }).pFirst).toBeGreaterThanOrEqual(0.85 * 0.75 - 1e-12);
    }
  });

  it('(c) tries ≥ 3 입문 합격 p = 1은 HIREYEAR와 무관하다(적용 코드가 입문 보장을 hireYear로 곱하지 않는다 — jobApply.test가 잠근다)', () => {
    expect(T.MODEL.triesFree[0]).toBe(3);
  });

  it('eraW 하한 0.5, 기본 1.0', () => {
    expect(ERA_W_MIN).toBe(0.5);
  });
});
