import type { Band } from './birthStats';

/**
 * 출생신고 부모 나이의 분포 모델 (SPEC-003 BR4, REV-003-M3-1 R-265 마스터 결정: **공표 구간 비중을 우선으로 지키고, 그 안에서 평균을 맞춘다**).
 *
 * 통계는 부모 나이를 구간(25~29세 …)별 출생아 수와 평균으로만 알려 준다. 예전 구현은 구간 안을 균등으로 뽑은 뒤 형제 순서·수저 단계·평균 보정으로 나이를 통째로 밀었는데(+1살, +2살 …),
 * 구간 경계를 넘나드는 사람이 생겨 공표 구간 비중이 어긋났다(어머니 35세 이상 비중이 공표 37.3%보다 4%p 가까이 높아짐). 이 모델은 거꾸로 만든다:
 *
 *  1. **구간 비중은 그대로**: 구간별 출생아 수에서 나이별 확률을 만든다. 구간 안의 모양은 이웃 구간 밀도를 이은 선으로 매끄럽게 잡고(구간 안 합은 공표 비중과 같게 다시 맞춘다),
 *     평균이 공표 평균과 어긋나면 **구간 안에서만** 기울여(exp(λ·(나이 − 구간 가운데))) 평균을 맞춘다 — 구간 합은 변하지 않는다.
 *  2. **형제 순서·수저 단계에 따른 차이도 같은 방식**: (출산 순위 3칸 × 수저 5단계) 15개 집단마다 어머니 나이 분포를 기울여 집단 평균을 목표(공표된 순위별 평균 출산연령, 수저 단계 설계 차이)에 맞추되,
 *     집단들을 비중대로 합치면 1번의 전체 분포와 정확히 같아지도록 반복 비례 보정(IPF)한다. 그래서 어느 집단 구성에서도 전체 구간 비중·평균이 공표값이다.
 *  3. **아버지**: 전체 분포는 1번과 같은 방식으로 공표 구간 비중·평균에 맞추고, 어머니와의 나이 차(FATHER_GAP: 아버지 − 어머니)가 허용 범위 안인 조합만 두는 결합 분포를 IPF로 만든다.
 *     어머니 나이가 정해지면 아버지는 그 어머니의 조건부 분포에서 뽑는다 — 예전의 「어긋나면 다시 뽑기」가 아버지 구간 비중을 흩뜨리던 문제가 없다.
 *
 * 순수 계산이다(난수 없음). 모든 표는 `buildParentAgeModel`이 한 번 만들어 `getBirthStats().parentAges`에 둔다. 수저 단계 차이·나이 차 모양은 설계값이다(data/birthReportTable.ts).
 */

export interface ParentAgeSpec {
  motherBands: readonly Band[];
  fatherBands: readonly Band[];
  /** 공표 평균 출산연령(어머니 33.8)·평균 연령(아버지 36.1) */
  motherMean: number;
  fatherMean: number;
  /** 출산 순위 [첫째, 둘째, 셋째 이상] 전국 비중(%, 합 약 100)과 순위별 어머니 평균 출산연령(공표) */
  orderShares: readonly [number, number, number];
  orderMeans: readonly [number, number, number];
  /** 수저 1~5단계 비중(%)과 단계별 어머니 평균 나이 차이(살, 설계값) — 차이는 전체 평균이 바뀌지 않게 비중으로 가중한 평균을 뺀 값으로 쓴다 */
  wealthWeights: readonly number[];
  wealthOffsets: readonly number[];
  /** 아버지 − 어머니 나이 차: 허용 범위 [min, max]와 결합 분포의 초기 모양(peak를 가운데로 한 종 모양, spread는 폭) */
  gap: { min: number; max: number; peak: number; spread: number };
}

export interface ParentAgeModel {
  /** 어머니·아버지 확률표의 첫 나이 (표의 인덱스 = 나이 − 이 값) */
  motherMin: number;
  fatherMin: number;
  /** 전체 분포(공표 구간 비중·평균에 맞춤) — 검증용 */
  motherMarginal: number[];
  fatherMarginal: number[];
  /** 집단별 어머니 나이 확률: [출산 순위 칸 0~2][수저 단계 − 1][나이 − motherMin] (행마다 합 1) */
  motherGiven: number[][][];
  /** 어머니 나이별 아버지 나이 확률: [어머니 나이 − motherMin][아버지 나이 − fatherMin] (행마다 합 1) */
  fatherGivenMother: number[][];
  /** 집단별 비중(출산 순위 × 수저 단계, 합 1): [순위 칸][수저 단계 − 1] */
  groupShare: number[][];
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** 구간 안 나이별 확률(합은 구간 비중): 이웃 구간 가운데의 1년당 밀도를 이은 선, 양 끝 밖은 끝 구간 밀도 그대로 */
function basePmf(bands: readonly Band[]): number[] {
  const lo = bands[0].min;
  const hi = bands[bands.length - 1].max;
  const total = sum(bands.map((b) => b.weight));
  const centers = bands.map((b) => (b.min + b.max) / 2);
  const dens = bands.map((b) => b.weight / (b.max - b.min + 1));
  const densityAt = (age: number): number => {
    if (age <= centers[0]) return dens[0];
    for (let i = 1; i < bands.length; i++) {
      if (age <= centers[i]) return dens[i - 1] + ((age - centers[i - 1]) / (centers[i] - centers[i - 1])) * (dens[i] - dens[i - 1]);
    }
    return dens[dens.length - 1];
  };
  const pmf = new Array<number>(hi - lo + 1).fill(0);
  for (const b of bands) {
    const raw: number[] = [];
    for (let a = b.min; a <= b.max; a++) raw.push(Math.max(0, densityAt(a)));
    const s = sum(raw);
    for (let a = b.min; a <= b.max; a++) pmf[a - lo] = s > 0 ? (raw[a - b.min] / s) * (b.weight / total) : 0;
  }
  return pmf;
}

/** 구간 안에서만 기울인다: 구간 합은 그대로, 구간 안 나이별 확률에 exp(λ·(나이 − 구간 가운데))를 곱해 다시 맞춘다 */
function tiltWithinBands(pmf: readonly number[], lo: number, bands: readonly Band[], lambda: number): number[] {
  const out = pmf.slice();
  for (const b of bands) {
    const mid = (b.min + b.max) / 2;
    let before = 0;
    let after = 0;
    const w: number[] = [];
    for (let a = b.min; a <= b.max; a++) {
      before += pmf[a - lo];
      const x = pmf[a - lo] * Math.exp(lambda * (a - mid));
      w.push(x);
      after += x;
    }
    for (let a = b.min; a <= b.max; a++) out[a - lo] = after > 0 ? (w[a - b.min] / after) * before : 0;
  }
  return out;
}

function meanOf(pmf: readonly number[], lo: number): number {
  let m = 0;
  for (let i = 0; i < pmf.length; i++) m += (lo + i) * pmf[i];
  return m;
}

/** 구간 비중은 그대로 두고 평균을 target에 맞춘 나이별 확률. 구간 안 기울기 λ는 이분법으로 찾는다(평균은 λ에 대해 단조 증가). 맞출 수 없으면 throw. */
export function fitBandPmf(bands: readonly Band[], target: number): number[] {
  const lo = bands[0].min;
  const base = basePmf(bands);
  let a = -8;
  let b = 8;
  if (target < meanOf(tiltWithinBands(base, lo, bands, a), lo) || target > meanOf(tiltWithinBands(base, lo, bands, b), lo)) {
    throw new RangeError(`fitBandPmf: 평균 ${target}을 구간 안 기울기만으로는 맞출 수 없다`);
  }
  for (let i = 0; i < 100; i++) {
    const mid = (a + b) / 2;
    if (meanOf(tiltWithinBands(base, lo, bands, mid), lo) < target) a = mid;
    else b = mid;
  }
  return tiltWithinBands(base, lo, bands, (a + b) / 2);
}

/**
 * 반복 비례 보정(IPF): seed에서 시작해 행 합이 rowSums, 열 합이 colSums가 되도록 번갈아 맞춘다. 마지막에 행 합을 맞춰 끝나므로 행은 정확하고 열은 수렴 오차만큼(1e-9 안팎) 어긋난다.
 * rowSums가 0인 행·colSums가 0인 열은 0으로 둔다.
 */
function ipf(seed: readonly (readonly number[])[], rowSums: readonly number[], colSums: readonly number[], iterations: number): number[][] {
  const rows = seed.length;
  const cols = colSums.length;
  const j = seed.map((r) => r.slice());
  for (let it = 0; it < iterations; it++) {
    for (let c = 0; c < cols; c++) {
      let s = 0;
      for (let r = 0; r < rows; r++) s += j[r][c];
      const k = s > 0 ? colSums[c] / s : 0;
      for (let r = 0; r < rows; r++) j[r][c] *= k;
    }
    for (let r = 0; r < rows; r++) {
      const s = sum(j[r]);
      const k = s > 0 ? rowSums[r] / s : 0;
      for (let c = 0; c < cols; c++) j[r][c] *= k;
    }
  }
  return j;
}

const ORDERS = 3;

/** 집단(출산 순위 × 수저 단계)별 어머니 나이 분포: 집단 평균을 목표에 맞추면서 비중대로 합치면 전체 분포(pM)가 되도록 */
function fitGroups(spec: ParentAgeSpec, pM: readonly number[], lo: number): { given: number[][][]; share: number[][] } {
  const wealths = spec.wealthWeights.length;
  const orderShare = spec.orderShares.map((s) => s / sum(spec.orderShares));
  const wealthShare = spec.wealthWeights.map((s) => s / sum(spec.wealthWeights));
  const orderDelta = spec.orderMeans.map((m) => m - sum(spec.orderMeans.map((x, k) => x * orderShare[k])));
  const wealthDelta = spec.wealthOffsets.map((m) => m - sum(spec.wealthOffsets.map((x, w) => x * wealthShare[w])));
  const overall = meanOf(pM, lo);
  const groups = ORDERS * wealths;
  const pi: number[] = [];
  const target: number[] = [];
  for (let k = 0; k < ORDERS; k++) {
    for (let w = 0; w < wealths; w++) {
      pi.push(orderShare[k] * wealthShare[w]);
      target.push(overall + orderDelta[k] + wealthDelta[w]);
    }
  }
  const t = new Array<number>(groups).fill(0);
  let joint: number[][] = [];
  for (let outer = 0; outer < 400; outer++) {
    const seed = pi.map((p, g) => pM.map((q, i) => p * q * Math.exp(t[g] * (lo + i - overall))));
    joint = ipf(seed, pi, pM, 60);
    let worst = 0;
    for (let g = 0; g < groups; g++) {
      if (pi[g] <= 0) continue;
      const row = joint[g].map((x) => x / pi[g]);
      const m = meanOf(row, lo);
      const variance = row.reduce((a, x, i) => a + x * (lo + i - m) ** 2, 0);
      const err = target[g] - m;
      worst = Math.max(worst, Math.abs(err));
      t[g] += (0.8 * err) / Math.max(variance, 1);
    }
    if (worst < 1e-7) break;
  }
  const given: number[][][] = [];
  const share: number[][] = [];
  for (let k = 0; k < ORDERS; k++) {
    given.push([]);
    share.push([]);
    for (let w = 0; w < wealths; w++) {
      const g = k * wealths + w;
      given[k].push(pi[g] > 0 ? joint[g].map((x) => x / pi[g]) : pM.slice());
      share[k].push(pi[g]);
    }
  }
  return { given, share };
}

/** 어머니 나이별 아버지 나이 확률: 두 전체 분포를 가장자리로 하고 나이 차가 허용 범위 안인 조합만 가진 결합 분포의 조건부 */
function coupleParents(pM: readonly number[], mLo: number, pF: readonly number[], fLo: number, gap: ParentAgeSpec['gap']): number[][] {
  const kernel = (g: number): number => (g < gap.min || g > gap.max ? 0 : Math.exp(-((g - gap.peak) ** 2) / (2 * gap.spread ** 2)));
  const seed = pM.map((_, i) => pF.map((_f, j) => kernel(fLo + j - (mLo + i))));
  const joint = ipf(seed, pM, pF, 400);
  return joint.map((row, i) => {
    // 어머니 나이에 질량이 없으면(뽑힐 일이 없다) 초기 모양으로 채워 weightedIndex가 던지지 않게 한다
    const src = sum(row) > 0 ? row : seed[i];
    const total = sum(src);
    return total > 0 ? src.map((x) => x / total) : src.map(() => 1 / src.length);
  });
}

export function buildParentAgeModel(spec: ParentAgeSpec): ParentAgeModel {
  const motherMin = spec.motherBands[0].min;
  const fatherMin = spec.fatherBands[0].min;
  const motherMarginal = fitBandPmf(spec.motherBands, spec.motherMean);
  const fatherMarginal = fitBandPmf(spec.fatherBands, spec.fatherMean);
  const { given, share } = fitGroups(spec, motherMarginal, motherMin);
  return {
    motherMin,
    fatherMin,
    motherMarginal,
    fatherMarginal,
    motherGiven: given,
    fatherGivenMother: coupleParents(motherMarginal, motherMin, fatherMarginal, fatherMin, spec.gap),
    groupShare: share,
  };
}
