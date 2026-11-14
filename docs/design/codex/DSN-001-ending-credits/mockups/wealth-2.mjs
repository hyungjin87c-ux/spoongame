// DSN-001 round 2 design calculation. This module is not imported by the game.
// Source: docs/data/networth-distribution.md 4-1 and 4-2, option B.
export const WEALTH_NAMES = Object.freeze(['흙수저', '동수저', '은수저', '금수저', '다이아몬드수저']);
export const WHOLE_MEDIAN = 23860;
export const WHOLE_KNOTS = Object.freeze([
  [-10000, 0.2], [0, 3], [1210, 10], [5108, 20], [10000, 29.4],
  [10296, 30], [16472, 40], [20000, 44.8], [23860, 50], [30000, 56.9],
  [33050, 60], [40000, 65.8], [46180, 70], [50000, 72], [60000, 76.6],
  [69380, 80], [70000, 80.1], [80000, 83.4], [90000, 85.8],
  [100000, 88.1], [110020, 90],
].map(Object.freeze));
export const AGE_BANDS = Object.freeze([
  { id: '20-29', from: 20, to: 29, sourceLabel: '29세 이하', median: 5000, mean: 10796 },
  { id: '30-39', from: 30, to: 39, sourceLabel: '30~39세', median: 15585, mean: 25060 },
  { id: '40-49', from: 40, to: 49, sourceLabel: '40~49세', median: 28384, mean: 48389 },
  { id: '50-59', from: 50, to: 59, sourceLabel: '50~59세', median: 31685, mean: 55161 },
  { id: '60-64', from: 60, to: 64, sourceLabel: '60세 이상(65세 이상 포함)', median: 25000, mean: 53591 },
  { id: '65+', from: 65, to: null, sourceLabel: '65세 이상', median: 22100, mean: 49279 },
].map(b => Object.freeze({ ...b, sigma: Math.sqrt(2 * Math.log(b.mean / b.median)) })));
export const BOUNDARY_RULE = 'lower-inclusive: p <= cumulative boundary stays in the lower tier; design proposal, not a new core rule';

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label}: finite number required`);
}

export function ageBandOf(age) {
  finite(age, 'age');
  if (!Number.isInteger(age) || age < 0) throw new RangeError('age: nonnegative game-age integer required');
  return AGE_BANDS.find(b => age >= b.from && (b.to === null || age <= b.to)) ?? null;
}

// Integral series for the standard normal CDF. At |z| >= 8 the omitted tail
// is below 6.3e-16; the finite series avoids rounding sigma to the source table.
export function normalCdf(z) {
  finite(z, 'z');
  if (z === 0) return 0.5;
  const x = Math.abs(z);
  if (x >= 8) return z < 0 ? 0 : 1;
  let term = x;
  let sum = x;
  for (let n = 1; n < 256; n++) {
    term *= x * x / (2 * n + 1);
    const next = sum + term;
    if (next === sum) break;
    sum = next;
  }
  const halfArea = Math.exp(-x * x / 2) * sum / Math.sqrt(2 * Math.PI);
  return Math.max(0, Math.min(1, 0.5 + (z < 0 ? -halfArea : halfArea)));
}

export function wholePercentile(net) {
  finite(net, 'net');
  if (net < WHOLE_KNOTS[0][0]) return 0.1;
  if (net >= 110020) return 100 - 10 * Math.pow(net / 110020, -217122 / (217122 - 110020));
  for (let i = 1; i < WHOLE_KNOTS.length; i++) {
    const [right, high] = WHOLE_KNOTS[i];
    if (net <= right) {
      const [left, low] = WHOLE_KNOTS[i - 1];
      return low + (high - low) * (net - left) / (right - left);
    }
  }
  throw new Error('unreachable whole-CDF interval');
}

export function percentileAtAge(age, net) {
  const band = ageBandOf(age);
  if (band === null) return null;
  finite(net, 'net');
  if (net <= band.median) {
    const scaledNet = net * WHOLE_MEDIAN / band.median;
    return { percentile: wholePercentile(scaledNet), branch: 'scaled-whole-knots', scaledNet, z: null, ...band };
  }
  const z = Math.log(net / band.median) / band.sigma;
  return { percentile: 100 * normalCdf(z), branch: 'lognormal-upper', scaledNet: null, z, ...band };
}

export function gradeFromPercentile(percentile, thresholds) {
  finite(percentile, 'percentile');
  if (percentile < 0 || percentile > 100) throw new RangeError('percentile must be in [0, 100]');
  if (!Array.isArray(thresholds) || thresholds.length !== 4 || thresholds.some((p, i) => !Number.isFinite(p) || p <= (thresholds[i - 1] ?? 0) || p >= 100)) {
    throw new RangeError('four increasing raw cumulative boundaries required');
  }
  const index = thresholds.findIndex(boundary => percentile <= boundary);
  return index < 0 ? 5 : index + 1;
}

export function estimateWealth({ age, net, start, thresholds }) {
  if (!Number.isInteger(start) || start < 1 || start > 5) throw new RangeError('birth wealth must be 1..5');
  const band = ageBandOf(age);
  const common = { start, startName: WEALTH_NAMES[start - 1], age, net, thresholds: [...thresholds], boundaryRule: BOUNDARY_RULE, surveyYear: 2025, monetaryUnit: '2025-value 10,000 KRW', defaultShowPercentile: false };
  if (band === null) return { ...common, end: null, endName: null, direction: 'early', unavailable: false, percentile: null, ageBand: null, mean: null, median: null, sigma: null, branch: 'under-20-no-estimate', sentence: `${common.startName}로 태어났습니다.`, basis: '마칠 때의 수저는 추산하지 않았습니다.', numericProposalLabel: null };
  if (net === null || net === undefined || !Number.isFinite(net)) return { ...common, end: null, endName: null, direction: 'unavailable', unavailable: true, percentile: null, ageBand: band.id, mean: band.mean, median: band.median, sigma: band.sigma, branch: 'missing-adult-assets', sentence: `${common.startName}로 태어났습니다.`, basis: '마칠 때의 수저는 추산하지 못했습니다.', numericProposalLabel: null };
  const estimate = percentileAtAge(age, net);
  const end = net <= 0 ? 1 : gradeFromPercentile(estimate.percentile, thresholds);
  const endName = WEALTH_NAMES[end - 1];
  const percentile = estimate.percentile;
  return {
    ...common, end, endName, direction: end > start ? 'up' : end < start ? 'down' : 'same', unavailable: false,
    percentile, ageBand: band.id, sourceAgeBand: band.sourceLabel, mean: band.mean, median: band.median, sigma: band.sigma,
    branch: estimate.branch, scaledNet: estimate.scaledNet, z: estimate.z, nonpositiveOverride: net <= 0,
    sentence: `${common.startName}로 태어나 ${endName}로 마쳤습니다.`,
    basis: '가구주 연령대별 통계를 바탕으로 추산했습니다.',
    numericProposalLabel: percentile < 1 ? '아래에서 1% 안쪽' : percentile >= 99 ? '위에서 1% 안쪽' : `아래에서 약 ${Math.round(percentile)}%`,
  };
}
