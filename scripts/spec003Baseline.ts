import { ERAS, STAGES } from '../src/core';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { eventCounts, possibleEventsAt } from './spec003BaselineLib';
import { distOf, simulateMany } from './simulateLib';

/**
 * SPEC-003 M0 기준선(V1) 측정 실행 스크립트. 실행: npx vite-node scripts/spec003Baseline.ts [판수=1000]
 * 결과는 docs/data/spec-003-baseline.md에 옮겨 적는다. 게임 코드는 바꾸지 않는다.
 */

const fx = (n: number, d = 2) => n.toFixed(d);

{
  const lives = Number(process.argv[2] ?? 1000);
  const c = eventCounts();
  console.log(`## 이벤트 수\n전체 ${c.total} = 선택지 ${c.choice} + 서술 ${c.narrative}`);
  for (const s of STAGES) console.log(`  ${STAGE_TABLE[s].label}(${s}): 이벤트 정의 ${c.byStage[s].total} (선택지 ${c.byStage[s].choice} / 서술 ${c.byStage[s].narrative})`);

  console.log('\n## 나이별 일어날 수 있는 이벤트 수 (지난/지금/다가올)');
  for (let a = 0; a <= 100; a++) {
    const row = ERAS.map((e) => possibleEventsAt(a, e));
    if (a <= 20 || a % 10 === 0 || a === 64 || a === 65) console.log(`  ${String(a).padStart(3)}세: ${row.join(' / ')}`);
  }

  console.log(`\n## 시뮬레이션 ${lives}판 × 시대 (자동 모드)`);
  for (const era of ERAS) {
    const sims = simulateMany(era, lives, 'auto');
    const perAge: number[][] = Array.from({ length: 101 }, () => []);
    const emptyYears: number[] = [];
    const infantLines: number[] = [];
    for (const l of sims) {
      const counts = new Array<number>(101).fill(0);
      for (const h of l.final.history) if (h.kind === 'event' || h.kind === 'choice') counts[h.age]++;
      for (let a = 0; a <= 100; a++) if (a <= l.deathAge) perAge[a].push(counts[a]);
      // 0~7세 8해 중 (사망 전까지) 인생 기록 줄(사건·선택)이 없는 해
      let empty = 0;
      let lines = 0;
      for (let a = 0; a <= 7; a++) {
        if (a > l.deathAge) break;
        if (counts[a] === 0) empty++;
        lines += counts[a];
      }
      emptyYears.push(empty);
      infantLines.push(lines);
    }
    const meanAt = (a: number) => (perAge[a].length ? perAge[a].reduce((x, y) => x + y, 0) / perAge[a].length : 0);
    console.log(`\n[${era}]`);
    console.log('  나이별 사건·선택 줄 평균(0~10세): ' + Array.from({ length: 11 }, (_, a) => `${a}세 ${fx(meanAt(a))}`).join(', '));
    // 한 판에서 구간 안 줄 수 합계의 평균
    const bandPerLife = (lo: number, hi: number) => {
      let sum = 0;
      for (const l of sims) for (const h of l.final.history) if ((h.kind === 'event' || h.kind === 'choice') && h.age >= lo && h.age <= hi) sum++;
      return sum / sims.length;
    };
    console.log(
      `  판당 사건·선택 줄(구간별 합): 0~6세 ${fx(bandPerLife(0, 6))} / 7~19세 ${fx(bandPerLife(7, 19))} / 20~39세 ${fx(bandPerLife(20, 39))} / 40~64세 ${fx(bandPerLife(40, 64))} / 65세~ ${fx(bandPerLife(65, 100))} / 전체 ${fx(bandPerLife(0, 100))}`,
    );
    const ed = distOf(emptyYears);
    const il = distOf(infantLines);
    console.log(`  0~7세 8해 중 사건 없는 해: 평균 ${fx(ed.mean)} / 최대 ${ed.max} / 5% ${ed.p05} / 95% ${ed.p95}`);
    console.log(`  0~7세 사건·선택 줄(출생 줄 제외): 평균 ${fx(il.mean)} / 최소 ${il.min} / 최대 ${il.max}`);
    const ch = distOf(sims.map((l) => l.counts.choice));
    console.log(`  판당 선택지: 평균 ${fx(ch.mean, 1)} / 5% ${ch.p05} / 95% ${ch.p95}`);
    const infChoice = sims.reduce((a, l) => a + l.choicesByStage.infant, 0) / sims.length;
    console.log(`  영유아 단계 판당 선택지 평균: ${fx(infChoice)}`);
    const m1 = distOf(sims.map((l) => l.seconds1x / 60));
    const m1h = distOf(sims.map((l) => l.seconds1xHigh / 60));
    console.log(`  1배속 수동 추정(분, 읽기 중앙 가정): 평균 ${fx(m1.mean, 1)} / 5% ${fx(m1.p05, 1)} / 95% ${fx(m1.p95, 1)}; 읽기 상단 가정 평균 ${fx(m1h.mean, 1)}`);
    const dead = distOf(sims.map((l) => l.deathAge));
    console.log(`  사망 나이: 평균 ${fx(dead.mean, 1)} / 중앙 ${dead.p50}`);
  }
}
