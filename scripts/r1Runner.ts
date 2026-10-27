import { R1_PRESENT } from '../src/core';
import { collectLives } from './economyCheckLib';
import { buildEraDistribution } from './finalDistributionLib';
import { r1EventPool } from './r1EventPool';
import type { R1Runner } from './r1SnapshotLib';
import { measureMany, summarize } from './timeReportLib';
import { LIFE_LENGTH_MODES } from '../src/data/timingTable';

/**
 * R1 스냅숏(EY17)을 재는 판 돌리기 — `scripts/freezeR1Snapshot.ts`(얼리기)와 `tests/economyIdentity.test.ts`(항등 시험)가 **같은 것**을 쓴다.
 * 얼릴 때(커밋 e1bc33f)는 시대 「지금 세상」을 그대로 돌렸고, 시대 3종이 사라진 지금은 시험 전용 R1 프로필(`r1-present`) + 얼린 R1 이벤트 풀(scripts/r1EventPool.ts)로 같은 값이 나오는지 잰다.
 */
export const r1Runner: R1Runner = {
  collect: (plays, strategy) => collectLives(R1_PRESENT, plays, strategy),
  finalDistribution: (simulated) => buildEraDistribution(R1_PRESENT, simulated),
  timeSummary: (lives) => {
    const s = summarize(R1_PRESENT, 'short30', measureMany(R1_PRESENT, lives, 'random', 'short30', r1EventPool()), LIFE_LENGTH_MODES.short30.pacing.hard);
    return JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  },
};
