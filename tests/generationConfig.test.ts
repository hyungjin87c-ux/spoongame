import { describe, expect, it } from 'vitest';
import { PARENTING_STYLES } from '../src/core/types';
import { wealthFor } from '../src/core/generationMixture';
import { GENERATION_CONFIG, anchorYearOf, generationConfig } from '../src/data/generationConfig';
import { GENERATIONS, yearsOfGeneration } from '../src/data/generations';
import { GENERATION_IDS } from '../src/core/types';
import reference from './fixtures/gm3-mixture-reference.json';

/**
 * GENERATION_CONFIG (SPEC-004 NR1·NR6, `docs/data/generations.md` 3절): 7종 · 수저 5단계 × 7세대 닻 표(합 100) · X 세대 = [33, 31, 24, 10, 2](G-01) · 교육방식 7세대 합 100(G-02) · randomWeight 1/7(G-07).
 * `wealthFor(y)`(N29): 닻 해의 값 = 세대 표 · 닻 사이는 직선 · 첫 닻 앞과 마지막 닻 뒤는 닻 값 · 1940~2020 모든 해 합 100 정수 · 1960~1963은 연도만으로 결정 · 예시 세 값.
 */

describe('GENERATION_CONFIG (NR6)', () => {
  it('7종이고 id·표시 이름·범위·BGM 참고가 GENERATIONS와 같다', () => {
    expect(Object.keys(GENERATION_CONFIG)).toEqual([...GENERATION_IDS]);
    for (const g of GENERATIONS) {
      const c = generationConfig(g.id);
      expect([c.id, c.label, c.birth.from, c.birth.to, c.bgmReference]).toEqual([g.id, g.label, g.birth.from, g.birth.to, g.bgm]);
    }
  });

  it('수저 가중치 닻 표(5단계 × 7세대): 합 100, X = [33, 31, 24, 10, 2], 산업화·베이비붐·86 = SPEC-003 지난 세상 표, 밀레니얼·Z·알파 = 지금 세상 표', () => {
    const w = (id: (typeof GENERATION_IDS)[number]) => [...GENERATION_CONFIG[id].wealthWeights];
    for (const id of GENERATION_IDS) {
      expect(w(id).length, id).toBe(5);
      expect(w(id).reduce((a, b) => a + b, 0), id).toBe(100);
    }
    expect(w('industrial')).toEqual([40, 32, 20, 7, 1]);
    expect(w('boomer')).toEqual([40, 32, 20, 7, 1]);
    expect(w('g86')).toEqual([40, 32, 20, 7, 1]);
    expect(w('genx')).toEqual([33, 31, 24, 10, 2]);
    expect(w('millennial')).toEqual([25, 30, 28, 14, 3]);
    expect(w('genz')).toEqual([25, 30, 28, 14, 3]);
    expect(w('alpha')).toEqual([25, 30, 28, 14, 3]);
  });

  it('교육방식 가중치 7세대 합 100: 산업화~86 = 지난 표, X = 두 표의 평균, 밀레니얼~알파 = 지금 표 (G-02)', () => {
    for (const id of GENERATION_IDS) expect(PARENTING_STYLES.reduce((s, p) => s + GENERATION_CONFIG[id].parentingWeights[p], 0), id).toBe(100);
    expect(GENERATION_CONFIG.industrial.parentingWeights).toEqual({ neglect: 25, free: 10, helicopter: 10, strict: 55 });
    expect(GENERATION_CONFIG.genx.parentingWeights).toEqual({ neglect: 20, free: 20, helicopter: 20, strict: 40 });
    expect(GENERATION_CONFIG.alpha.parentingWeights).toEqual({ neglect: 15, free: 30, helicopter: 30, strict: 25 });
  });

  it('randomWeight 7세대 모두 1/7, trackMode는 알파만 assembled (AL3)', () => {
    for (const id of GENERATION_IDS) expect(GENERATION_CONFIG[id].randomWeight, id).toBe(1 / 7);
    expect(GENERATION_IDS.filter((id) => GENERATION_CONFIG[id].trackMode === 'assembled')).toEqual(['alpha']);
  });

  it('설정 객체는 얼려 있어 실행 중에 바뀌지 않는다', () => {
    expect(Object.isFrozen(GENERATION_CONFIG)).toBe(true);
    expect(Object.isFrozen(GENERATION_CONFIG.alpha)).toBe(true);
  });

  it('닻 해 = 세대 출생 범위의 가운데 해 (산업화 1947 · 베이비붐 1959 · 86 1964.5 · X 1975 · 밀레니얼 1988.5 · Z 2004.5 · 알파 2016.5)', () => {
    expect(GENERATION_IDS.map((id) => anchorYearOf(id))).toEqual([1947, 1959, 1964.5, 1975, 1988.5, 2004.5, 2016.5]);
  });

  it('이름 풀 id: 세대 ↔ 풀 표 (G-03) — 산업화 1940·1950년대, 알파 법원 2013~2020, Z는 1990·2000년대 + 법원 2008~2012', () => {
    expect(GENERATION_CONFIG.industrial.namePool).toEqual(['decade-1940', 'decade-1950']);
    expect(GENERATION_CONFIG.genz.namePool).toEqual(['decade-1990', 'decade-2000', 'court-2008', 'court-2009', 'court-2010', 'court-2011', 'court-2012']);
    expect(GENERATION_CONFIG.alpha.namePool).toEqual(['court-2013', 'court-2014', 'court-2015', 'court-2016', 'court-2017', 'court-2018', 'court-2019', 'court-2020']);
  });
});

describe('wealthFor — 출생 연도별 수저 비율 (NR1, N29)', () => {
  it('닻 해의 값 = 세대 표', () => {
    expect(wealthFor(1947)).toEqual([40, 32, 20, 7, 1]);
    expect(wealthFor(1959)).toEqual([40, 32, 20, 7, 1]);
    expect(wealthFor(1964.5)).toEqual([40, 32, 20, 7, 1]);
    expect(wealthFor(1975)).toEqual([33, 31, 24, 10, 2]);
    expect(wealthFor(1988.5)).toEqual([25, 30, 28, 14, 3]);
    expect(wealthFor(2004.5)).toEqual([25, 30, 28, 14, 3]);
    expect(wealthFor(2016.5)).toEqual([25, 30, 28, 14, 3]);
  });

  it('첫 닻(1947) 앞과 마지막 닻(2016.5) 뒤는 그 닻의 값이다', () => {
    for (const y of [1940, 1944, 1946]) expect(wealthFor(y), `${y}`).toEqual([40, 32, 20, 7, 1]);
    for (const y of [2017, 2018, 2020]) expect(wealthFor(y), `${y}`).toEqual([25, 30, 28, 14, 3]);
  });

  it('예시 세 값: 1981년 [29, 31, 26, 12, 2] · 1988년 [25, 30, 28, 14, 3] · 1947년 [40, 32, 20, 7, 1]', () => {
    expect(wealthFor(1981)).toEqual([29, 31, 26, 12, 2]);
    expect(wealthFor(1988)).toEqual([25, 30, 28, 14, 3]);
    expect(wealthFor(1947)).toEqual([40, 32, 20, 7, 1]);
  });

  it('1940~2020 모든 해 합이 100인 정수이고, 닻 사이는 직선(실수 값이 두 닻 값 사이에 있고 한쪽으로만 움직인다)', () => {
    for (let y = 1940; y <= 2020; y++) {
      const w = wealthFor(y);
      expect(w.length).toBe(5);
      expect(w.reduce((a, b) => a + b, 0), `${y}`).toBe(100);
      for (const v of w) expect(Number.isInteger(v), `${y}`).toBe(true);
    }
    // 1975(X) → 1988.5(밀레니얼) 사이: 흙수저 33 → 25로 줄고 금수저 10 → 14로 는다 — 한 해씩 단조 비증가/비감소(합 보정 ±1 이내)
    let prev = wealthFor(1975);
    for (let y = 1976; y <= 1988; y++) {
      const cur = wealthFor(y);
      expect(cur[0]).toBeLessThanOrEqual(prev[0]);
      expect(cur[3]).toBeGreaterThanOrEqual(prev[3]);
      prev = cur;
    }
    // 직선: 1981.75(두 닻의 가운데)는 두 닻 값의 평균(합 보정 ±1)
    const mid = wealthFor(1981.75);
    [29, 30.5, 26, 12, 2.5].forEach((m, k) => expect(Math.abs(mid[k] - m), `k${k}`).toBeLessThanOrEqual(1));
  });

  it('1960~1963 겹침 해는 고른 세대와 무관하게 연도만으로 정해진다 (같은 함수 한 값)', () => {
    for (let y = 1960; y <= 1963; y++) {
      expect(wealthFor(y)).toEqual(wealthFor(y));
      expect(yearsOfGeneration('boomer')).toContain(y);
      expect(yearsOfGeneration('g86')).toContain(y);
    }
  });

  it('시안 생성기(buildGm3Mockups.mjs)의 wealthFor와 1940~2020 모든 해가 같다', () => {
    for (let y = 1940; y <= 2020; y++) expect(wealthFor(y), `${y}`).toEqual((reference.wealthFor as Record<string, number[]>)[String(y)]);
  });

  it('유한하지 않은 연도는 throw한다', () => {
    expect(() => wealthFor(Number.NaN)).toThrow();
  });
});
