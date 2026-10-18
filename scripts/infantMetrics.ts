import { ERAS } from '../src/core';
import { EVENT_FREQUENCY } from '../src/data/lifeTable';
import { infantLives, summarizeInfant } from './infantMetricsLib';

/**
 * SPEC-003 M7a 영유아(0~7세) 지표 측정. 실행: ./node_modules/.bin/vite-node scripts/infantMetrics.ts [판수=1000]
 * IN2 1차 목표(빈 해 평균 ≤ 1.5·최대 ≤ 4 / 줄 평균 ≥ 9 / 선택지 평균 ≥ 2.8)를 시대 × 전략별로 본다. 영유아 빈도표(src/data/lifeTable.ts#EVENT_FREQUENCY.infant)를 정할 때 쓴다.
 */
const lives = Number(process.argv[2] ?? 1000);
const fx = (n: number, d = 2) => n.toFixed(d);
console.log(`영유아 빈도표: choice ${EVENT_FREQUENCY.infant.choice} / narrative ${EVENT_FREQUENCY.infant.narrative}, ${lives}판 × 시대 (0~7세)`);
for (const strategy of ['auto', 'random'] as const) {
  for (const era of ERAS) {
    const s = summarizeInfant(infantLives(era, lives, strategy));
    console.log(
      `[${strategy}/${era}] 빈 해 평균 ${fx(s.emptyMean)} 최대 ${s.emptyMax} / 줄 평균 ${fx(s.linesMean)} / 선택지(0~7세) ${fx(s.choicesMean)} (0~6세 단계 ${fx(s.choicesInfantStageMean)}) / 한 해 두 줄 ${fx(s.doubleYearsMean)}해`,
    );
  }
}
