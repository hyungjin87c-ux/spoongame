import { writeFileSync } from 'node:fs';
import { r1Runner } from './r1Runner';
import { buildR1Snapshot } from './r1SnapshotLib';

/**
 * R1 경제 스냅숏을 얼린다 (SPEC-004 EY17 ① — 연도 축 배선 **전에** 지금 코드로). 실행: `./node_modules/.bin/vite-node scripts/freezeR1Snapshot.ts [커밋 7자]` (npx를 쓰지 않는다).
 * 결과: tests/fixtures/r1-economy-snapshot.json — 이 파일은 한 번 얼리면 고치지 않는다(바뀌어야 하면 EY17 ① 절차를 다시 밟고 이유를 ai-log에 적는다).
 * 판을 돌리는 쪽은 scripts/r1Runner.ts, 값을 모으는 쪽은 scripts/r1SnapshotLib.ts다.
 */
const commit = process.argv[2] ?? 'unknown';
const snapshot = buildR1Snapshot(r1Runner, { commit, note: 'SPEC-004 GM4 EY17 ①: 연도 축 배선 전 R1(지금 세상 = 2026년생) check:economy·분포표·report:time 값. 세대 모델에서는 R1 프로필이 같은 값을 내야 한다.' });
writeFileSync('tests/fixtures/r1-economy-snapshot.json', `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8');
console.log(`얼렸다: 무작위 ${snapshot.random.rows}줄(해시 ${snapshot.random.rowsHash}) · 자동 ${snapshot.auto.rows}줄(해시 ${snapshot.auto.rowsHash}) · 분포표 해시 ${snapshot.finalDistribution.quantilesHash}`);
