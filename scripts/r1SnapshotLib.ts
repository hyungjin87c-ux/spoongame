import { R1_PRESENT } from '../src/core';
import { BANDS, TARGETS, autoGuardsOf, deathNetMedians, guardsOf, movementShares, statsOfBand, type LifeOutcome, type Sample } from './economyCheckLib';
import type { FinalDistribution } from '../src/core';

/**
 * R1 경제 스냅숏 (SPEC-004 EY17 ① — 마스터 결정 N21·N27). 경제를 연도 축으로 바꾸기 **전에** 지금(R1) 코드의 `npm run check:economy` 값을 줄 단위로 얼려 두고,
 * 연도 축 배선(`economyFactors`의 `forceR1`)이 들어간 뒤에도 같은 값이 나오는지 `tests/economyIdentity.test.ts`가 대조한다(② 항등 시험).
 * 이 파일은 **값을 모으는 일**만 한다 — 판을 돌리는 쪽(`scripts/freezeR1Snapshot.ts`, 시험)이 `R1Runner`를 주면 같은 모양의 JSON을 돌려준다.
 * 모든 값은 소수 그대로(JSON 숫자는 배정밀도가 그대로 오간다) 담고 비교는 정확히 같아야 통과한다. 표본 전체는 FNV-1a 32비트 해시로 얼린다(줄 하나라도 다르면 해시가 달라진다).
 */

export interface R1Runner {
  /** 지금 세상(R1 present)의 무작위 선택·자동 모드 표본 — `scripts/economyCheck.ts`와 같은 시드(`economySeed`) */
  collect(plays: number, strategy: 'random' | 'auto'): { rows: Sample[]; lives: LifeOutcome[] };
  /** 지금 세상의 분포표(`scripts/finalDistributionLib.ts`와 같은 시드 줄) */
  finalDistribution(simulated: number): FinalDistribution;
  /** `npm run report:time`의 「현재 설정」 지금 세상 한 줄(짧은 모드, 무작위 선택) */
  timeSummary(lives: number): Record<string, unknown>;
}

export interface R1SnapshotParams {
  plays: number;
  autoPlays: number;
  finalDistributionPlays: number;
  timeLives: number;
}

/** 얼린 표본의 크기 — 이 값을 바꾸면 스냅숏을 다시 얼려야 한다(tests/economyIdentity.test.ts가 같은 값을 쓴다) */
export const R1_SNAPSHOT_PARAMS: R1SnapshotParams = { plays: 6000, autoPlays: 2000, finalDistributionPlays: 4000, timeLives: 1000 };

/** FNV-1a 32비트 (조각 문자열을 이어 붙여 센다 — 큰 문자열을 만들지 않는다) */
export class Fnv {
  private h = 0x811c9dc5;
  add(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.h ^= text.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193) >>> 0;
    }
  }
  hex(): string {
    return this.h.toString(16).padStart(8, '0');
  }
}

export function hashRows(rows: readonly Sample[]): string {
  const f = new Fnv();
  for (const r of rows) f.add(`${r.age},${r.parentWealth},${r.net},${r.debt},${r.income};`);
  return f.hex();
}

export function hashLives(lives: readonly LifeOutcome[]): string {
  const f = new Fnv();
  for (const l of lives) f.add(`${l.parentWealth},${l.deathAge},${l.reached ? 1 : 0},${l.net},${l.minNet},${l.movement ?? '-'};`);
  return f.hex();
}

export function hashNumbers(values: readonly number[]): string {
  const f = new Fnv();
  for (const v of values) f.add(`${v},`);
  return f.hex();
}

const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** 연령대 표 하나 (연령대별 순자산·부채·소득 — 출력 4-5절 형식) */
function bandTable(rows: readonly Sample[]): unknown[] {
  return BANDS.map((b) => {
    const s = statsOfBand(rows, b);
    return { id: b.id, n: s.n, netMedian: s.netMedian, netMean: s.netMean, netP10: s.netP10, netP90: s.netP90, debtShare: s.debtShare, debtMedianOfHolders: s.debtMedianOfHolders, netNegativeShare: s.netNegativeShare, incomeMedian: s.incomeMedian };
  });
}

/** 부모 재력 단계별 연령대 순자산 중앙값 */
function wealthTable(rows: readonly Sample[]): unknown[] {
  return ([1, 2, 3, 4, 5] as const).map((w) => ({ wealth: w, netMedian: BANDS.map((b) => statsOfBand(rows.filter((r) => r.parentWealth === w), b).netMedian) }));
}

function deathTable(lives: readonly LifeOutcome[]): unknown {
  const reached = lives.filter((l) => l.reached);
  return {
    reached: reached.length,
    medians: deathNetMedians(lives),
    movement: movementShares(lives),
    perTier: ([1, 2, 3, 4, 5] as const).map((w) => {
      const tier = reached.filter((l) => l.parentWealth === w);
      return { wealth: w, n: tier.length, movement: movementShares(tier) };
    }),
  };
}

export interface R1Snapshot {
  schema: 1;
  /** 얼린 때의 기준 커밋과 설명 */
  frozen: { commit: string; note: string };
  params: R1SnapshotParams;
  random: { rows: number; rowsHash: string; livesHash: string; bands: unknown[]; wealth: unknown[]; targets: Array<{ id: string; value: number }>; guards: unknown[]; death: unknown };
  auto: { rows: number; rowsHash: string; livesHash: string; band40: unknown; guards: unknown[] };
  finalDistribution: { simulated: number; lives: number; quantilesHash: string; quantiles: number[] };
  reportTime: Record<string, unknown>;
}

export function buildR1Snapshot(runner: R1Runner, frozen: R1Snapshot['frozen'], params: R1SnapshotParams = R1_SNAPSHOT_PARAMS): R1Snapshot {
  const random = runner.collect(params.plays, 'random');
  const auto = runner.collect(params.autoPlays, 'auto');
  const dist = runner.finalDistribution(params.finalDistributionPlays);
  const band40 = BANDS.find((b) => b.id === 'b40')!;
  return clean({
    schema: 1 as const,
    frozen,
    params,
    random: {
      rows: random.rows.length,
      rowsHash: hashRows(random.rows),
      livesHash: hashLives(random.lives),
      bands: bandTable(random.rows),
      wealth: wealthTable(random.rows),
      targets: TARGETS.map((t) => ({ id: t.id, value: t.measure(random.rows) })),
      guards: guardsOf(R1_PRESENT, random.rows, random.lives).map((g) => ({ id: g.id, value: g.value, metric: g.metric, ok: g.ok, parts: g.parts ?? null })),
      death: deathTable(random.lives),
    },
    auto: {
      rows: auto.rows.length,
      rowsHash: hashRows(auto.rows),
      livesHash: hashLives(auto.lives),
      band40: bandTable(auto.rows).find((b) => (b as { id: string }).id === band40.id),
      guards: autoGuardsOf({ rows: random.rows, lives: random.lives }, { rows: auto.rows, lives: auto.lives }).map((g) => ({ id: g.id, value: g.value, metric: g.metric, ok: g.ok })),
    },
    finalDistribution: { simulated: dist.simulated, lives: dist.lives, quantilesHash: hashNumbers(dist.quantiles), quantiles: [...dist.quantiles] },
    reportTime: runner.timeSummary(params.timeLives),
  });
}
