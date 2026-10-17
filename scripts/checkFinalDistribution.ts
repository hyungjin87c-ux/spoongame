import { readFileSync } from 'node:fs';
import { FINAL_DISTRIBUTION } from '../src/data/finalDistribution';
import { buildFinalDistribution, renderFinalDistributionModule, staleEras } from './finalDistributionLib';

/**
 * 최종 순자산 분위수표가 낡았는지 점검한다 (REV-001-M5-1 R-085).  실행: npm run check:dist  (약 10초대)
 *
 * src/data/finalDistribution.ts 는 현재 이벤트·밸런스로 시뮬레이션한 결과다. 이벤트 데이터(src/data/events/*.json)나 진행 규칙·밸런스 표를 고치면
 * 표가 달라지므로 다시 만들어야 한다 — `npx vite-node scripts/finalDistribution.ts`. 이 명령은 표를 현재 코드로 다시 만들어 파일과 견주고, 다르면 종료 코드 1로 끝난다.
 * `npm test`도 같은 것을 잡지만(tests/ending.test.ts), 시간이 걸리는 점검이라 `npm run build`에는 넣지 않고 따로 둔다.
 * 절차는 docs/data/events-schema.md 10절.
 */
const regenerated = buildFinalDistribution();
const stale = staleEras(regenerated, FINAL_DISTRIBUTION);
const fileStale = readFileSync('src/data/finalDistribution.ts', 'utf-8').replace(/\r\n/g, '\n') !== renderFinalDistributionModule(regenerated);
if (stale.length > 0 || fileStale) {
  console.error(
    `최종 순자산 분위수표가 낡았다${stale.length > 0 ? ` (다른 시대: ${stale.join(', ')})` : ' (표 값은 같지만 파일이 생성기 출력과 다르다)'}.`,
  );
  console.error('이벤트·밸런스를 고친 뒤에는 다시 만든다:  npx vite-node scripts/finalDistribution.ts');
  process.exit(1);
}
console.log(`최종 순자산 분위수표는 현재 엔진·이벤트와 같다 (시대 ${Object.keys(regenerated).length}개 × ${regenerated.past.simulated}판 다시 만들어 견줌)`);
