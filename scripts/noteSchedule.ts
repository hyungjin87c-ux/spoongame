import { SIM_PROFILES as ERAS } from './simulateLib';
import { NOTE_CARDS } from '../src/data/noteCards';
import { chooserFor } from './simulateLib';
import { runNoteSchedule } from './noteScheduleLib';

/**
 * 기록 카드 스케줄 보고 (SPEC-003 M7c 완료 기준 1 — 판정이 아니라 **보고**다. 불변식 위반이 하나라도 있으면 종료 코드 1).
 * 실행: npm run report:notes [-- 판수=1000]
 * 세 시대 × 두 전략(자동 모드 성향 선택 / 무작위 수동 흉내) × 판수를 `dueNote` 소비 모드로 끝까지 돌려, 판당 평균 카드 수·종류별 도달률·카드가 뜬 나이·결정 카드와 같은 해에 겹친 비율을 보인다.
 */
const lives = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(lives) || lives < 1) {
  console.error('사용법: npm run report:notes [-- 판수(1 이상 정수)]');
  process.exit(2);
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6);
let failed = 0;
console.log(`기록 카드 스케줄 보고: 시대 ${ERAS.length} × 전략 2 × ${lives}판 (소비 모드, 시트 없음)\n`);
for (const era of ERAS) {
  for (const strategy of ['auto', 'random'] as const) {
    const r = runNoteSchedule(era, lives, (seed) => chooserFor(strategy, seed), 1);
    failed += r.problems.length;
    console.log(`[${era} / ${strategy === 'auto' ? '자동 모드' : '수동 흉내'}] ${r.lives}판 — 위반 ${r.problems.length}건`);
    console.log(`  판당 평균 카드 ${r.meanCards.toFixed(2)}장 (사망 나이 70세 이상 ${r.longLives}판: ${r.meanCardsLong.toFixed(2)}장) | 분포(0~7장): ${r.histogram.join(' / ')}`);
    console.log(`  결정 카드와 같은 해에 겹친 기록 카드: ${pct(r.overlap)} (${Math.round(r.overlap * r.totalCards)}/${r.totalCards})`);
    console.log(`  ${'카드'.padEnd(22)} 도달률(전체)  도달률(70세+)  뜬 나이(최소/평균/최대)  결정 겹침`);
    for (const c of NOTE_CARDS) {
      const a = r.ages[c.id];
      console.log(`  ${c.id.padEnd(22)} ${pct(r.reach[c.id])}      ${pct(r.reachLong[c.id])}       ${String(a.min).padStart(2)} / ${a.mean.toFixed(1).padStart(4)} / ${String(a.max).padStart(2)}        ${pct(r.overlapByCard[c.id])}`);
    }
    for (const p of r.problems.slice(0, 5)) console.log(`  위반: ${p}`);
    console.log('');
  }
}
if (failed > 0) {
  console.error(`불변식 위반 ${failed}건`);
  process.exit(1);
}
console.log('불변식 위반 0건');
