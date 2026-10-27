import statsJson from '../src/data/koreaStats.json';
import { describe, expect, it } from 'vitest';
import { R1_PRESENT, createRng, generateBirth, type ParentWealth, type ProfileId } from '../src/core';
import { ERA_REPORT_ADJUST, FATHER_GAP, PARENT_AGE_LIMITS } from '../src/data/birthReportTable';
import { getBirthStats } from '../src/data/birthStats';
import { buildParentAgeModel, fitBandPmf } from '../src/data/parentAgeModel';

/**
 * 부모 나이 분포 (SPEC-003 BR4, REV-003-M3-1 R-265 마스터 결정): **공표 구간 비중을 우선으로 지키고 그 안에서 평균을 맞춘다.**
 * 기준은 koreaStats.json 원자료(구간별 출생아 수·평균·35세 이상 비중)를 직접 읽은 값이다. 두 가지로 본다:
 *  (가) 모델 자체(결정적): 전체 분포의 구간 비중·평균이 공표값과 같고, 집단(출산 순위 × 수저 단계)을 비중대로 합치면 전체 분포가 되며, 아버지의 조건부 분포가 나이 차 범위 안이다.
 *  (나) 실제 추첨(generateBirth) 대량 표본: 구간 비중·어머니 35세 이상 비중 오차 ±1%p, 평균 오차 ±0.3세 (둘 다). 표본은 시드가 고정이라 한 번 통과하면 항상 통과한다.
 */

interface Row {
  [key: string]: unknown;
}
const indicators = (statsJson as unknown as { indicators: Array<{ id: string; series?: Row[]; averages?: Record<string, number> }> }).indicators;
const ind = (id: string) => indicators.find((i) => i.id === id)!;

const motherSeries = ind('birth-mother-age').series!.map((p) => ({ label: p.label as string, value: p.value as number }));
const fatherSeries = ind('birth-father-age').series!.map((p) => ({ label: p.label as string, value: p.value as number }));
const motherAvg = ind('birth-mother-age').averages!;
const fatherAvg = ind('birth-father-age').averages!;

/** 구간 이름에서 [min, max]를 직접 읽는다(구현의 parseAgeBand를 거치지 않는다). 열린 구간의 끝은 어머니 49·아버지 54, 아래 끝은 16 */
function bounds(label: string, top: number): [number, number] {
  let m = /^(\d+)세 미만$/.exec(label);
  if (m) return [16, Number(m[1]) - 1];
  m = /^(\d+)~(\d+)세$/.exec(label);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d+)세 이상$/.exec(label);
  if (m) return [Number(m[1]), top];
  throw new Error(label);
}

const motherBands = motherSeries.map((p) => ({ ...p, range: bounds(p.label, 49) }));
const fatherBands = fatherSeries.map((p) => ({ ...p, range: bounds(p.label, 54) }));

/** 공표 구간 비중(%) */
const publishedShare = (bands: Array<{ value: number }>) => bands.map((b) => (b.value / bands.reduce((a, x) => a + x.value, 0)) * 100);
const MOTHER_SHARE = publishedShare(motherBands);
const FATHER_SHARE = publishedShare(fatherBands);

const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('(가) 부모 나이 모델: 공표 구간 비중·평균·집단 합·나이 차가 결정적으로 맞는다', () => {
  const model = getBirthStats().parentAges;
  const shareIn = (pmf: number[], lo: number, a: number, b: number) => pmf.reduce((acc, p, i) => (lo + i >= a && lo + i <= b ? acc + p : acc), 0) * 100;

  it('어머니 전체 분포: 구간 비중이 공표값과 같고(오차 1e-6%p), 평균이 공표 평균 33.8이며, 35세 이상 비중이 공표 37.3%와 0.1%p 이내', () => {
    motherBands.forEach((b, i) => expect(shareIn(model.motherMarginal, model.motherMin, b.range[0], b.range[1]), b.label).toBeCloseTo(MOTHER_SHARE[i], 6));
    const mean = model.motherMarginal.reduce((a, p, i) => a + p * (model.motherMin + i), 0);
    expect(motherAvg.all).toBe(33.8);
    expect(Math.abs(mean - motherAvg.all)).toBeLessThan(1e-6);
    expect(motherAvg.over35Share).toBe(37.3);
    expect(Math.abs(shareIn(model.motherMarginal, model.motherMin, 35, 99) - motherAvg.over35Share)).toBeLessThan(0.1);
    expect(model.motherMarginal.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('아버지 전체 분포: 구간 비중이 공표값과 같고(오차 1e-6%p), 평균이 공표 평균 36.1이다', () => {
    fatherBands.forEach((b, i) => expect(shareIn(model.fatherMarginal, model.fatherMin, b.range[0], b.range[1]), b.label).toBeCloseTo(FATHER_SHARE[i], 6));
    const mean = model.fatherMarginal.reduce((a, p, i) => a + p * (model.fatherMin + i), 0);
    expect(fatherAvg.all).toBe(36.1);
    expect(Math.abs(mean - fatherAvg.all)).toBeLessThan(1e-6);
  });

  it('집단(출산 순위 × 수저 단계)을 비중대로 합치면 전체 분포와 같다 — 순위·단계 차이가 구간 비중을 흩뜨리지 않는다 (옛 방식은 35세 이상이 41~42%였다)', () => {
    const ages = model.motherMarginal.length;
    const mix = new Array<number>(ages).fill(0);
    let shares = 0;
    for (let k = 0; k < 3; k++) {
      for (let w = 0; w < 5; w++) {
        shares += model.groupShare[k][w];
        expect(model.motherGiven[k][w].reduce((a, b) => a + b, 0), `${k}·${w}`).toBeCloseTo(1, 9);
        model.motherGiven[k][w].forEach((p, a) => (mix[a] += model.groupShare[k][w] * p));
      }
    }
    expect(shares).toBeCloseTo(1, 9);
    mix.forEach((p, a) => expect(Math.abs(p - model.motherMarginal[a]), `${model.motherMin + a}세`).toBeLessThan(1e-6));
  });

  it('출산 순위별 어머니 평균 나이가 공표값(첫째 33.2·둘째 34.7·셋째 이상 35.8)에 0.06세 이내로 맞고, 수저 단계가 높을수록 평균이 높다(설계 차이 −1·0·0·+1·+1에서 비중 가중 평균을 뺀 값)', () => {
    const mean = (pmf: number[]) => pmf.reduce((a, p, i) => a + p * (model.motherMin + i), 0);
    const published = [motherAvg.first, motherAvg.second, motherAvg.thirdPlus];
    for (let k = 0; k < 3; k++) {
      const sk = model.groupShare[k].reduce((a, b) => a + b, 0);
      const row = new Array<number>(model.motherMarginal.length).fill(0);
      for (let w = 0; w < 5; w++) model.motherGiven[k][w].forEach((p, a) => (row[a] += (model.groupShare[k][w] / sk) * p));
      expect(Math.abs(mean(row) - published[k]), `순위 ${k + 1}`).toBeLessThan(0.06);
      // 같은 순위 안에서 단계가 높을수록 평균이 비감소 (동수저·은수저는 같은 차이)
      for (let w = 1; w < 5; w++) expect(mean(model.motherGiven[k][w]), `순위 ${k + 1} ${w + 1}단계`).toBeGreaterThanOrEqual(mean(model.motherGiven[k][w - 1]) - 1e-9);
      expect(mean(model.motherGiven[k][4]) - mean(model.motherGiven[k][0]), `순위 ${k + 1}: 흙수저와 다이아몬드수저의 평균 차`).toBeGreaterThan(1.5);
    }
  });

  it('아버지는 어머니 나이의 조건부 분포에서 나온다: 행마다 합 1, 나이 차(아버지 − 어머니)가 허용 범위 밖인 확률은 0, 합치면 아버지 전체 분포가 된다', () => {
    const fathers = model.fatherMarginal.length;
    const mix = new Array<number>(fathers).fill(0);
    model.fatherGivenMother.forEach((row, i) => {
      expect(row.reduce((a, b) => a + b, 0), `어머니 ${model.motherMin + i}세`).toBeCloseTo(1, 9);
      row.forEach((p, j) => {
        const gap = model.fatherMin + j - (model.motherMin + i);
        if (gap < FATHER_GAP.min || gap > FATHER_GAP.max) expect(p, `어머니 ${model.motherMin + i}세 아버지 ${model.fatherMin + j}세`).toBe(0);
        mix[j] += model.motherMarginal[i] * p;
      });
    });
    mix.forEach((p, j) => expect(Math.abs(p - model.fatherMarginal[j]), `아버지 ${model.fatherMin + j}세`).toBeLessThan(1e-6));
    // 평균 나이 차는 두 공표 평균의 차(2.3살)다
    const gapMean = model.fatherGivenMother.reduce((acc, row, i) => acc + model.motherMarginal[i] * row.reduce((a, p, j) => a + p * (model.fatherMin + j - (model.motherMin + i)), 0), 0);
    expect(gapMean).toBeCloseTo(fatherAvg.all - motherAvg.all, 6);
  });

  it('모델 구성 함수: 평균을 맞출 수 없는 입력(구간 밖 평균)은 throw한다 (조용히 틀린 분포를 만들지 않는다)', () => {
    const bands = [
      { label: '20~24세', min: 20, max: 24, weight: 1 },
      { label: '25~29세', min: 25, max: 29, weight: 1 },
    ];
    expect(() => fitBandPmf(bands, 40)).toThrow(RangeError);
    expect(() => fitBandPmf(bands, 10)).toThrow(RangeError);
    const ok = fitBandPmf(bands, 25);
    expect(ok.reduce((a, p, i) => a + p * (20 + i), 0)).toBeCloseTo(25, 6);
    expect(ok.slice(0, 5).reduce((a, b) => a + b, 0)).toBeCloseTo(0.5, 9); // 구간 비중은 평균을 맞추려 기울여도 그대로
    expect(() =>
      buildParentAgeModel({
        motherBands: bands,
        fatherBands: bands,
        motherMean: 99,
        fatherMean: 25,
        orderShares: [60, 30, 10],
        orderMeans: [24, 25, 26],
        wealthWeights: [20, 20, 20, 20, 20],
        wealthOffsets: [0, 0, 0, 0, 0],
        gap: { min: -4, max: 15, peak: 2, spread: 3 },
      }),
    ).toThrow(RangeError);
  });
});

describe('(나) 실제 추첨 대량 표본 (시험 전용 R1 「지금 세상」 프로필 60000건): 구간 비중·35세 이상 비중 ±1%p, 평균 ±0.3세', () => {
  const N = 60000;
  const rng = createRng(20261016);
  const draws = Array.from({ length: N }, () => generateBirth(rng, R1_PRESENT));
  const mothers = draws.map((d) => d.report.mother.age);
  const fathers = draws.map((d) => d.report.father.age);
  const shareOf = (ages: number[], a: number, b: number) => (ages.filter((x) => x >= a && x <= b).length / ages.length) * 100;

  it('어머니: 모든 구간 비중이 공표값과 1%p 이내이고, 35세 이상 비중이 공표 37.3%와 1%p 이내, 평균이 33.8과 0.3세 이내', () => {
    motherBands.forEach((b, i) => {
      const observed = shareOf(mothers, b.range[0], b.range[1]);
      expect(Math.abs(observed - MOTHER_SHARE[i]), `${b.label} 관측 ${observed.toFixed(2)}% / 공표 ${MOTHER_SHARE[i].toFixed(2)}%`).toBeLessThanOrEqual(1);
    });
    const over35 = shareOf(mothers, 35, 99);
    expect(Math.abs(over35 - motherAvg.over35Share), `35세 이상 관측 ${over35.toFixed(2)}% / 공표 ${motherAvg.over35Share}%`).toBeLessThanOrEqual(1);
    expect(Math.abs(meanOf(mothers) - motherAvg.all), `평균 ${meanOf(mothers).toFixed(3)}`).toBeLessThanOrEqual(0.3);
  });

  it('아버지: 모든 구간 비중이 공표값과 1%p 이내이고 평균이 36.1과 0.3세 이내', () => {
    fatherBands.forEach((b, i) => {
      const observed = shareOf(fathers, b.range[0], b.range[1]);
      expect(Math.abs(observed - FATHER_SHARE[i]), `${b.label} 관측 ${observed.toFixed(2)}% / 공표 ${FATHER_SHARE[i].toFixed(2)}%`).toBeLessThanOrEqual(1);
    });
    expect(Math.abs(meanOf(fathers) - fatherAvg.all), `평균 ${meanOf(fathers).toFixed(3)}`).toBeLessThanOrEqual(0.3);
  });

  it('출산 순위별 어머니 평균은 공표값과 0.3세 이내(첫째 33.2·둘째 34.7·셋째 이상 35.8)이고 순위가 늦을수록 높다 — 구간 비중을 지키면서도 순위 차이가 남는다', () => {
    const mean = (pick: (o: number) => boolean) => meanOf(draws.filter((d) => pick(d.report.birthOrder)).map((d) => d.report.mother.age));
    const byOrder = [mean((o) => o === 1), mean((o) => o === 2), mean((o) => o >= 3)];
    expect(byOrder[0]).toBeLessThan(byOrder[1]);
    expect(byOrder[1]).toBeLessThan(byOrder[2]);
    [motherAvg.first, motherAvg.second, motherAvg.thirdPlus].forEach((published, k) => expect(Math.abs(byOrder[k] - published), `순위 ${k + 1} 관측 ${byOrder[k].toFixed(2)}`).toBeLessThanOrEqual(0.3));
  });

  it('수저 단계가 높을수록 부모가 평균 조금 늦게 낳는다(흙 < 은 < 다이아몬드), 단계 평균 차는 설계 차이(−1에서 +1, 약 2살)에 가깝다', () => {
    const mean = (w: ParentWealth) => meanOf(draws.filter((d) => d.character.parentWealth === w).map((d) => d.report.mother.age));
    expect(mean(1)).toBeLessThan(mean(3));
    expect(mean(3)).toBeLessThan(mean(5));
    expect(Math.abs(mean(5) - mean(1) - 2), `다이아 ${mean(5).toFixed(2)} − 흙 ${mean(1).toFixed(2)}`).toBeLessThanOrEqual(0.7);
  });

  it('모든 표본에서 나이가 허용 범위 안이고, 아버지 − 어머니 나이 차가 허용 범위 안이다', () => {
    for (const d of draws) {
      const { mother, father } = d.report;
      expect(mother.age).toBeGreaterThanOrEqual(PARENT_AGE_LIMITS.min);
      expect(father.age).toBeLessThanOrEqual(PARENT_AGE_LIMITS.max);
      expect(father.age - mother.age).toBeGreaterThanOrEqual(FATHER_GAP.min);
      expect(father.age - mother.age).toBeLessThanOrEqual(FATHER_GAP.max);
    }
    expect(Math.min(...mothers)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...mothers)).toBeLessThanOrEqual(49); // 공표 구간의 위쪽 끝(45세 이상 → 49세)
    expect(Math.max(...fathers)).toBeLessThanOrEqual(54);
  });
});

describe('시대 보정: 두 부모에게 같은 살수를 더하고 허용 범위로 맞춘다 (나이 차는 그대로)', () => {
  const meanAge = (era: ProfileId, n: number, who: 'mother' | 'father') => {
    const rng = createRng(77 + (era === 'genx' ? 1 : 0));
    const ages: number[] = [];
    let gapsOk = true;
    for (let i = 0; i < n; i++) {
      const r = generateBirth(rng, era).report;
      ages.push(r[who].age);
      if (r.father.age - r.mother.age < FATHER_GAP.min || r.father.age - r.mother.age > FATHER_GAP.max) gapsOk = false;
    }
    return { mean: meanOf(ages), gapsOk, min: Math.min(...ages), max: Math.max(...ages) };
  };

  it('보정 0살(1990년 이후 출생 갈래 — 시험 전용 R1 프로필) 대 −6살(1989년 이전 갈래 — X 세대; 허용 범위 아래에서 잘리는 만큼은 평균이 높다): 평균 어머니 나이가 보정만큼 다르다', () => {
    expect(ERA_REPORT_ADJUST.present.parentAgeShift).toBe(0);
    const base = meanAge(R1_PRESENT, 20000, 'mother');
    const past = meanAge('genx', 20000, 'mother');
    // 지난 세상은 형제 순서 비중도 시대 보정(셋째 이상 48%)이라 어머니 평균이 순서 효과만큼 더 높다 → 보정 −6살보다 1.5살 안쪽으로 비교
    expect(past.mean).toBeLessThan(base.mean - 4);
    expect(past.mean).toBeGreaterThan(base.mean - 6 - 0.5);
    for (const r of [base, past]) expect(r.gapsOk).toBe(true);
    expect(past.min).toBeGreaterThanOrEqual(PARENT_AGE_LIMITS.min);
    expect(base.max).toBeLessThanOrEqual(PARENT_AGE_LIMITS.max);
  });
});
