import { describe, expect, it } from 'vitest';
import { r1Runner } from '../scripts/r1Runner';
import { R1_SNAPSHOT_PARAMS, buildR1Snapshot, type R1Snapshot } from '../scripts/r1SnapshotLib';
import snapshotJson from './fixtures/r1-economy-snapshot.json';
import { FINAL_DISTRIBUTION } from '../src/data/finalDistribution';

/**
 * R1 항등 시험 (SPEC-004 EY17 ② — 마스터 결정 N21·N27): 연도 축 경제 배선(`economyFactors`의 `forceR1`) 뒤에도
 * 같은 시드·같은 이벤트 풀에서 `check:economy`(지금 세상 무작위 6000판 · 자동 2000판) · 분포표(4000판) · `report:time`(1000판) 값이 **연도 축 배선 전에 얼린** 스냅숏과 줄 단위로 같다.
 * 스냅숏은 `tests/fixtures/r1-economy-snapshot.json`(커밋 e1bc33f의 코드로 `scripts/freezeR1Snapshot.ts`가 만들었다). 표본 전체는 해시로, 표·목표 19개·가드·사망 시점 표·분포표 분위수·시간 모델은 값 그대로 대조한다.
 * 이 시험은 이벤트 변환(MG2)·신규 이벤트를 넣기 **전에** 통과시킨다(순서 제약, N27).
 */

const frozen = snapshotJson as unknown as R1Snapshot;

describe('R1 스냅숏 (EY17 ①)', () => {
  it('스냅숏은 얼릴 때의 표본 크기와 기준 커밋을 담고 있다', () => {
    expect(frozen.schema).toBe(1);
    expect(frozen.params).toEqual(R1_SNAPSHOT_PARAMS);
    expect(frozen.frozen.commit).toMatch(/^[0-9a-f]{7}$/);
    expect(frozen.random.targets.length, '목표 19개').toBe(19);
    expect(frozen.random.rows).toBeGreaterThan(300000);
    // 분포표는 지금 파일의 시험 전용 R1 프로필 표(얼린 값 — 다시 만들지 않는다)와 같다 — 스냅숏이 낡은 표를 얼리지 않았다
    expect(frozen.finalDistribution.quantiles).toEqual([...FINAL_DISTRIBUTION['r1-present'].quantiles]);
    expect(frozen.finalDistribution.lives).toBe(FINAL_DISTRIBUTION['r1-present'].lives);
  });
});

describe('R1 항등 시험 (EY17 ②): forceR1 배선이 얼린 스냅숏과 줄 단위로 같다', () => {
  it('무작위 6000판 · 자동 2000판 · 분포표 4000판 · report:time 1000판의 모든 줄이 같다', { timeout: 300_000 }, () => {
    const now = buildR1Snapshot(r1Runner, frozen.frozen);
    // 한 번에 toEqual하면 어긋난 곳을 못 찾는다 — 묶음별로 나눠 어디가 다른지 드러낸다
    expect(now.random.rows, '무작위 표본 줄 수').toBe(frozen.random.rows);
    expect(now.random.rowsHash, '무작위 표본 해시(모든 줄)').toBe(frozen.random.rowsHash);
    expect(now.random.livesHash, '무작위 판 끝 해시').toBe(frozen.random.livesHash);
    expect(now.random.bands, '연령대별 표').toEqual(frozen.random.bands);
    expect(now.random.wealth, '재력 단계별 표').toEqual(frozen.random.wealth);
    expect(now.random.targets, '목표 19개').toEqual(frozen.random.targets);
    expect(now.random.guards, '설계 가드·엔딩 가드').toEqual(frozen.random.guards);
    expect(now.random.death, '사망 시점 순자산').toEqual(frozen.random.death);
    expect(now.auto, '자동 모드').toEqual(frozen.auto);
    expect(now.finalDistribution, '분포표').toEqual(frozen.finalDistribution);
    // 프로필 표지만 다르다(얼릴 때는 시대 「present」, 지금은 시험 전용 프로필 「r1-present」) — 나머지 모든 값은 같다
    expect({ ...now.reportTime, era: 'present' }, 'report:time 지금 세상').toEqual(frozen.reportTime);
  });
});
