import { writeFileSync } from 'node:fs';
import { EVENT_POOL } from '../src/data/events';
import { renderDistributionDoc } from './eventDistributionLib';

/**
 * 이벤트 분포표 문서 생성.  실행: npx vite-node scripts/eventDistribution.ts
 * docs/data/events-distribution.md 를 이벤트 데이터(src/data/events/*.json)와 모티브(scripts/eventMotifs.ts)에서 다시 만든다.
 * tests/eventDistribution.test.ts 가 문서와 데이터가 어긋나면 실패하므로, 이벤트를 고친 뒤에는 이 명령을 한 번 돌린다.
 */
const OUT = 'docs/data/events-distribution.md';
writeFileSync(OUT, renderDistributionDoc(EVENT_POOL), 'utf-8');
console.log(`${OUT} 를 다시 만들었다 (이벤트 ${EVENT_POOL.events.length}개)`);
