import { writeFileSync } from 'node:fs';
import { GENERATION_IDS, R1_PRESENT, validateFinalDistribution, type ProfileId } from '../src/core';
import { buildFinalDistribution, renderFinalDistributionModule } from './finalDistributionLib';

/**
 * 최종 순자산 분위수표(엔딩 "출발선 대비"의 도착 자리, SPEC-003 M5 D12) 생성.  실행: npx vite-node scripts/finalDistribution.ts
 * src/data/finalDistribution.ts 를 현재 엔진·이벤트로 다시 만든다. 이벤트나 밸런스 표를 고친 뒤에는 이 명령을 한 번 돌린다
 * (tests/ending.test.ts "분포표 재생성"이 표가 낡았는지 잡는다).
 */
const OUT = 'src/data/finalDistribution.ts';
const table = buildFinalDistribution();
const problems = validateFinalDistribution(table);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
writeFileSync(OUT, renderFinalDistributionModule(table), 'utf-8');
for (const era of [...GENERATION_IDS, R1_PRESENT] as ProfileId[]) console.log(`${era}: ${table[era].simulated}판 중 스무 살 넘어 마친 ${table[era].lives}판`);
console.log(`${OUT} 를 다시 만들었다`);
