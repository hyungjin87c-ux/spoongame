import { ERAS, STAT_MAX, STAT_MIN, playToEnd, reachedIndependence, type Era, type EventPool, type FinalDistribution, type ParentWealth } from '../src/core';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * 엔딩 "출발선 대비"의 도착 자리를 구하는 최종 재산 분포표를 만든다 (R-045 c). 순수 계산이라 테스트와 생성 스크립트가 함께 쓴다.
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

/** 분포표를 만들 때 센 한 판: 부모 재력(출발)·최종 재산(도착)·사망 나이. 방향 비율(단계별 앞섬/비슷함/뒤쪽)을 보는 테스트와 보고도 같은 판들을 쓴다. */
export interface FinalLife {
  parentWealth: ParentWealth;
  wealth: number;
  deathAge: number;
}

/** 시대의 판 1..simulated를 끝까지 돌려 판마다 (부모 재력, 최종 재산, 사망 나이)를 모은다 (스무 살 전에 끝난 판도 포함 — 거르는 것은 distributionOf) */
export function finalLivesOf(era: Era, simulated: number = FINAL_DISTRIBUTION_PARAMS.simulated, pool?: EventPool): FinalLife[] {
  const out: FinalLife[] = [];
  for (let i = 1; i <= simulated; i++) {
    const seed = finalDistributionSeed(i);
    const final = playToEnd(startLife(seed, era), chooserFor(FINAL_DISTRIBUTION_PARAMS.strategy, seed), pool).state;
    if (final.phase !== 'ending' || final.death === null || final.character === null) throw new Error(`${era} seed ${seed}: 사망에 도달하지 못했다`);
    out.push({ parentWealth: final.character.parentWealth, wealth: final.stats.wealth, deathAge: final.death.age });
  }
  return out;
}

/** 판들에서 최종 재산 도수분포를 센다: 스무 살 넘어 마친 판만 (그전 판은 재산이 아직 집안 형편이다) */
export function distributionOf(lives: readonly FinalLife[]): FinalDistribution {
  const wealth = new Array<number>(STAT_MAX - STAT_MIN + 1).fill(0);
  let counted = 0;
  for (const l of lives) {
    if (!reachedIndependence(l.deathAge)) continue;
    wealth[l.wealth - STAT_MIN]++;
    counted++;
  }
  return { simulated: lives.length, lives: counted, wealth };
}

export function buildEraDistribution(era: Era, simulated: number = FINAL_DISTRIBUTION_PARAMS.simulated, pool?: EventPool): FinalDistribution {
  return distributionOf(finalLivesOf(era, simulated, pool));
}

export function buildFinalDistribution(simulated: number = FINAL_DISTRIBUTION_PARAMS.simulated, pool?: EventPool): Record<Era, FinalDistribution> {
  return Object.fromEntries(ERAS.map((era) => [era, buildEraDistribution(era, simulated, pool)])) as Record<Era, FinalDistribution>;
}

/** 다시 만든 표와 파일의 표가 다른 시대들 (낡은 표를 잡는다: scripts/checkFinalDistribution.ts, tests/ending.test.ts) */
export function staleEras(regenerated: Record<Era, FinalDistribution>, current: Record<Era, FinalDistribution>): Era[] {
  return ERAS.filter((era) => JSON.stringify(regenerated[era]) !== JSON.stringify(current[era]));
}

/** src/data/finalDistribution.ts 의 전체 내용 */
export function renderFinalDistributionModule(table: Record<Era, FinalDistribution>): string {
  const p = FINAL_DISTRIBUTION_PARAMS;
  const rows = (hist: readonly number[]) => {
    const lines: string[] = [];
    for (let i = 0; i < hist.length; i += 17) lines.push(`      ${hist.slice(i, i + 17).join(', ')},`);
    return lines.join('\n');
  };
  const eraBlock = (era: Era) => {
    const d = table[era];
    return `  ${era}: {\n    simulated: ${d.simulated},\n    lives: ${d.lives},\n    wealth: [\n${rows(d.wealth)}\n    ],\n  },`;
  };
  return `// 자동 생성 파일 — 직접 고치지 않는다. 다시 만들기: npx vite-node scripts/finalDistribution.ts
// 만드는 곳: scripts/finalDistributionLib.ts#buildFinalDistribution (tests/ending.test.ts가 현재 엔진·이벤트로 다시 만든 표와 같은지 확인한다)
import type { Era } from '../core/types';
import type { FinalDistribution } from '../core/ending';

/**
 * 엔딩 "출발선 대비"의 도착 자리(같은 시대 안의 백분위)를 구하는 최종 재산 분포표 (R-045 c, core/ending.ts).
 * 표본: 시대마다 \`i * ${p.seedMul} + ${p.seedAdd}\` (i = 1..${p.simulated}, uint32)를 시드로 같은 시대의 인생을 끝까지 헤드리스로 돌렸다(선택 전략: ${p.strategy}).
 * wealth[v] = 스무 살 넘어 마친 판 중 최종 재산이 v인 판의 수 (v = 0..100). 스무 살 전에 끝난 판은 재산이 아직 집안 형편이라 세지 않았다.
 */
export const FINAL_DISTRIBUTION_SPEC = {
  simulated: ${p.simulated},
  strategy: '${p.strategy}',
  seed: 'i * ${p.seedMul} + ${p.seedAdd}',
} as const;

export const FINAL_DISTRIBUTION: Record<Era, FinalDistribution> = {
${(['past', 'present', 'future'] as const).map(eraBlock).join('\n')}
};
`;
}
