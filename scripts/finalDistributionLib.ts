import { GENERATION_IDS, QUANTILE_COUNT, R1_PRESENT, playToEnd, reachedIndependence, type EventPool, type FinalDistribution, type ParentWealth, type ProfileId } from '../src/core';
import r1EconomySnapshot from '../tests/fixtures/r1-economy-snapshot.json';
import { chooserFor, poolOf, startLife, type Strategy } from './simulateLib';

/**
 * 엔딩 "출발선 대비"의 도착 자리를 구하는 최종 순자산 분위수표를 만든다 (R-045 c, SPEC-003 M5 D12: 재산 스탯 0~100 도수분포 → 순자산(만 원) 0~100번째 백분위 101칸). 순수 계산이라 테스트와 생성 스크립트가 함께 쓴다.
 *
 * 표본: 시대마다 시드 `i * SEED_MUL + SEED_ADD` (i = 1..판 수, uint32)로 같은 시대의 인생을 끝까지 헤드리스로 돌린다(선택 전략: 무작위 = 수동 플레이 흉내).
 * 시드와 판 수가 고정이라 같은 엔진·같은 이벤트면 항상 같은 표가 나온다. 이벤트·밸런스를 고치면 표가 달라지므로
 * tests/ending.test.ts "분포표 재생성"이 어긋남을 잡고, 아래 명령으로 다시 만든다:
 *   npx vite-node scripts/finalDistribution.ts
 * 스무 살이 되기 전에 끝난 판은 센다고 하지 않는다: 그때까지 재산은 "집안 형편"이라 "내가 가진 것"의 분포가 아니다(core/ending.ts#reachedIndependence).
 */
export const FINAL_DISTRIBUTION_PARAMS = {
  /** 시대마다 시뮬레이션하는 판 수 (한 판 약 1ms — 세 시대 합 약 10초) */
  simulated: 4000,
  strategy: 'random' as Strategy,
  seedMul: 15485863,
  seedAdd: 101,
} as const;

/** i번째 판의 시드 (uint32) */
export function finalDistributionSeed(i: number): number {
  return (i * FINAL_DISTRIBUTION_PARAMS.seedMul + FINAL_DISTRIBUTION_PARAMS.seedAdd) >>> 0;
}

/** 분포표를 만들 때 센 한 판: 부모 재력(출발)·최종 순자산(만 원, 도착 — 스무 살 전에 끝난 판은 자산이 없어 0)·사망 나이. 방향 비율(단계별 앞섬/비슷함/뒤쪽)을 보는 테스트와 보고도 같은 판들을 쓴다. */
export interface FinalLife {
  parentWealth: ParentWealth;
  net: number;
  deathAge: number;
}

/** 시대의 판 1..simulated를 끝까지 돌려 판마다 (부모 재력, 최종 재산, 사망 나이)를 모은다 (스무 살 전에 끝난 판도 포함 — 거르는 것은 distributionOf) */
export function finalLivesOf(era: ProfileId, simulated: number = FINAL_DISTRIBUTION_PARAMS.simulated, pool: EventPool = poolOf(era)): FinalLife[] {
  const out: FinalLife[] = [];
  for (let i = 1; i <= simulated; i++) {
    const seed = finalDistributionSeed(i);
    const final = playToEnd(startLife(seed, era), chooserFor(FINAL_DISTRIBUTION_PARAMS.strategy, seed), pool).state;
    if (final.phase !== 'ending' || final.death === null || final.character === null) throw new Error(`${era} seed ${seed}: 사망에 도달하지 못했다`);
    out.push({ parentWealth: final.character.parentWealth, net: final.assets?.net ?? 0, deathAge: final.death.age });
  }
  return out;
}

/**
 * 판들에서 최종 순자산 분위수표를 만든다: 스무 살 넘어 마친 판만 (그전 판은 자산이 아직 없다). 작은 것부터 놓은 n개 값에서 p번째 백분위(p = 0..100)를
 * 가장 가까운 순위(round(p/100 × (n−1)))의 값으로 정한다 — 0은 최솟값, 100은 최댓값.
 */
export function distributionOf(lives: readonly FinalLife[]): FinalDistribution {
  const nets = lives
    .filter((l) => reachedIndependence(l.deathAge))
    .map((l) => l.net)
    .sort((a, b) => a - b);
  if (nets.length === 0) throw new Error('distributionOf: 스무 살 넘어 마친 판이 없다');
  const quantiles = Array.from({ length: QUANTILE_COUNT }, (_, p) => nets[Math.round((p / (QUANTILE_COUNT - 1)) * (nets.length - 1))]);
  return { simulated: lives.length, lives: nets.length, quantiles };
}

export function buildEraDistribution(era: ProfileId, simulated: number = FINAL_DISTRIBUTION_PARAMS.simulated, pool?: EventPool): FinalDistribution {
  return distributionOf(finalLivesOf(era, simulated, pool));
}

/**
 * 세대 7종의 분포표 (SPEC-004 EY8 — 세대마다 다시 만든다; 연도 축 경제가 켜지는 GM10에서 단면 재구성으로 다시 본다). 시험 전용 R1 프로필 표는 **얼린 값**이라 다시 만들지 않는다
 * (`tests/fixtures/r1-economy-snapshot.json`의 분포표 — 항등 시험이 같은 값이 다시 나옴을 잠근다, `frozenR1Distribution`).
 */
export function buildFinalDistribution(simulated: number = FINAL_DISTRIBUTION_PARAMS.simulated, pool?: EventPool): Record<ProfileId, FinalDistribution> {
  const out = {} as Record<ProfileId, FinalDistribution>;
  for (const g of GENERATION_IDS) out[g] = buildEraDistribution(g, simulated, pool);
  out[R1_PRESENT] = frozenR1Distribution();
  return out;
}

/** 얼린 R1 스냅숏의 분포표 (EY17 ①) */
export function frozenR1Distribution(): FinalDistribution {
  const d = (r1EconomySnapshot as unknown as { finalDistribution: { simulated: number; lives: number; quantiles: number[] } }).finalDistribution;
  return { simulated: d.simulated, lives: d.lives, quantiles: d.quantiles };
}

/** 다시 만든 표와 파일의 표가 다른 프로필들 (낡은 표를 잡는다: scripts/checkFinalDistribution.ts, tests/ending.test.ts) */
export function staleEras(regenerated: Record<ProfileId, FinalDistribution>, current: Record<ProfileId, FinalDistribution>): ProfileId[] {
  return ([...GENERATION_IDS, R1_PRESENT] as ProfileId[]).filter((era) => JSON.stringify(regenerated[era]) !== JSON.stringify(current[era]));
}

/** src/data/finalDistribution.ts 의 전체 내용 */
export function renderFinalDistributionModule(table: Record<ProfileId, FinalDistribution>): string {
  const p = FINAL_DISTRIBUTION_PARAMS;
  const rows = (hist: readonly number[]) => {
    const lines: string[] = [];
    for (let i = 0; i < hist.length; i += 17) lines.push(`      ${hist.slice(i, i + 17).join(', ')},`);
    return lines.join('\n');
  };
  const eraBlock = (era: ProfileId) => {
    const d = table[era];
    return `  '${era}': {\n    simulated: ${d.simulated},\n    lives: ${d.lives},\n    quantiles: [\n${rows(d.quantiles)}\n    ],\n  },`;
  };
  return `// 자동 생성 파일 — 직접 고치지 않는다. 다시 만들기: ./node_modules/.bin/vite-node scripts/finalDistribution.ts (npx를 쓰지 않는다)
// 만드는 곳: scripts/finalDistributionLib.ts#buildFinalDistribution (tests/ending.test.ts가 현재 엔진·이벤트로 다시 만든 표와 같은지 확인한다)
import type { ProfileId } from '../core/types';
import type { FinalDistribution } from '../core/ending';

/**
 * 엔딩 "출발선 대비"의 도착 자리(같은 세대 안의 백분위, SPEC-004 EY8·D4-31)를 구하는 최종 순자산 분위수표 (R-045 c, SPEC-003 M5 D12, core/ending.ts). 키 7개는 세대, \`r1-present\`는 시험 전용 R1 프로필(얼린 값 — 다시 만들지 않는다).
 * 표본: 세대마다 \`i * ${p.seedMul} + ${p.seedAdd}\` (i = 1..${p.simulated}, uint32)를 시드로 같은 세대의 인생을 끝까지 헤드리스로 돌렸다(선택 전략: ${p.strategy}).
 * quantiles[p] = 스무 살 넘어 마친 판들의 최종 순자산(만 원, 지금 가치)을 작은 것부터 놓았을 때 p번째 백분위 값 (p = 0..100, 101칸). 스무 살 전에 끝난 판은 자산이 아직 없어 세지 않았다.
 */
export const FINAL_DISTRIBUTION_SPEC = {
  simulated: ${p.simulated},
  strategy: '${p.strategy}',
  seed: 'i * ${p.seedMul} + ${p.seedAdd}',
} as const;

export const FINAL_DISTRIBUTION: Record<ProfileId, FinalDistribution> = {
${([...GENERATION_IDS, R1_PRESENT] as ProfileId[]).map(eraBlock).join('\n')}
};
`;
}
