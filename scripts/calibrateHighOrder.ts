import '../src/data/installAll';
import { FAMILY_MAX_CHILDREN, familyScheduleOf, generateBirthFromSeed, orderSharesOf, rollYoungerSiblings, type GameState, createInitialState } from '../src/core';
import { reportTiltOf } from '../src/data/birthReportTable';
import { FAMILY_DESIGN } from '../src/data/familyTables';
import { spreadSeeds } from '../tests/helpers/familyGolden';
import { GENERATION_IDS } from '../src/core';

/**
 * 1945년 이전 출생 어머니의 고차 출산 이어짐 보정 (SPEC-009 FM4b, 마스터 결정 2026-10-28 · 1941~45는 R-565, 2026-11-02): 어머니 출생 코호트(5년)마다 3명 이상을 낳은 어머니가 한 명 더 낳을 확률 `q`를
 * FD6 코호트 평균 출생아 수(`fd6_mean_children_by_age_calc` — 1970 센서스 연령 계급을 코호트로 읽음)에 맞춰 이분법으로 찾는다. 출력은 `data/familyTables.ts#FAMILY_DESIGN.highOrderContinue`에 옮겨 적는 표다.
 * 모형 평균은 「어머니 가중」(주인공 1명당 1/N을 더해 표본 수 ÷ 합) — T-FA3c와 같은 정의, 형제 순서 5는 「다섯째 이상」이지만 5명으로 센다.
 * 실행: ./node_modules/.bin/vite-node scripts/calibrateHighOrder.ts [시드 수=20000]
 */
const N = Number(process.argv[2] ?? 20000);

// 코호트 상한 연도 → FD6 목표 (1970 센서스 연령 계급: 70-74세 4.91 · 65-69 5.05 · 60-64 5.22 · 55-59 5.42 · 50-54 5.65 · 45-49 5.62, 1975 45-49 5.23 · 1980 4.69 · 1985 4.07 · 1990 3.43; ≤1900은 70-74(4.91)와 75세 이상(4.75)의 가운데)
const TARGETS: Array<[number, number]> = [[1900, 4.85], [1905, 5.05], [1910, 5.22], [1915, 5.42], [1920, 5.65], [1925, 5.62], [1930, 5.23], [1935, 4.69], [1940, 4.07], [1945, 3.43]];
const cohortOf = (by: number): number => TARGETS.find(([upTo]) => by <= upTo)?.[0] ?? -1;

interface Row {
  order: number;
  motherAge: number;
  shares: readonly [number, number, number];
  famSeed: number;
  lastAt: number;
  by: number;
}
const rows = new Map<number, Row[]>();
for (const gen of GENERATION_IDS) {
  GENERATION_IDS.indexOf(gen);
  for (const seed of spreadSeeds(N, GENERATION_IDS.indexOf(gen))) {
    const b = generateBirthFromSeed(seed, gen);
    const by = b.character.birthYear - b.report.mother.age;
    const c = cohortOf(by);
    if (c < 0) continue;
    const game = { ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
    const sc = familyScheduleOf(game);
    rows.set(c, [
      ...(rows.get(c) ?? []),
      { order: b.report.birthOrder, motherAge: b.report.mother.age, shares: orderSharesOf(reportTiltOf(b.character.birthYear), b.report.region, b.character.birthYear), famSeed: sc.famSeed, lastAt: Math.min(sc.firstGone?.at ?? Infinity, sc.divorce?.at ?? Infinity), by },
    ]);
  }
}

// 코호트별 터울 상한(출산이 많던 코호트일수록 짧은 터울 — 설계값): ≤1925 3 · 1930 4 · 1935·1940·1945 5(= 보정 없는 SIBLING_GAP.max). 이어짐 상한 cap은 모두 0.98
const GAP_MAX: Record<number, number> = { 1900: 3, 1905: 3, 1910: 3, 1915: 3, 1920: 3, 1925: 3, 1930: 4, 1935: 5, 1940: 5, 1945: 5 };
const CAP = 0.98;
// 설치된 객체의 값을 바꿔 측정한다 (표를 직접 고치지 않는다)
const table = FAMILY_DESIGN.highOrderContinue.value;
for (const row of table) {
  row.cap = CAP;
  row.gapMax = GAP_MAX[row.upTo];
}
function measure(cohort: number, q: number): number {
  const entry = table.find((c) => c.upTo === cohort)!;
  const saved = entry.q;
  entry.q = q;
  let inv = 0;
  const list = rows.get(cohort) ?? [];
  for (const r of list) {
    const y = rollYoungerSiblings(r.famSeed, r.order, r.motherAge, r.shares, r.lastAt, r.by).length;
    inv += 1 / Math.min(Math.min(r.order, 5) + y, FAMILY_MAX_CHILDREN);
  }
  entry.q = saved;
  return list.length / inv;
}

console.log('코호트 상한 | 표본 | 목표 | q 0.5 | q 0.8 | q 0.95 | 찾은 q | 그때 평균');
const found: Array<[number, number]> = [];
for (const [cohort, target] of TARGETS) {
  const n = rows.get(cohort)?.length ?? 0;
  if (n === 0) {
    console.log(`${cohort} | 0`);
    continue;
  }
  const lo = measure(cohort, 0.3);
  const hi = measure(cohort, 0.97);
  let a = 0.3;
  let b = 0.97;
  for (let i = 0; i < 24; i++) {
    const mid = (a + b) / 2;
    if (measure(cohort, mid) < target) a = mid;
    else b = mid;
  }
  const q = Math.round(((a + b) / 2) * 1000) / 1000;
  found.push([cohort, q]);
  console.log(`${cohort} | ${n} | ${target} | ${measure(cohort, 0.5).toFixed(2)} | ${measure(cohort, 0.8).toFixed(2)} | ${measure(cohort, 0.95).toFixed(2)} | ${q} | ${measure(cohort, q).toFixed(2)} (q 0.3→${lo.toFixed(2)}, 0.97→${hi.toFixed(2)})`);
}
console.log('\n' + found.map(([upTo, q]) => `{ upTo: ${upTo}, cap: ${CAP}, q: ${q}, gapMax: ${GAP_MAX[upTo]} },`).join('\n'));
