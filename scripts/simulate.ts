import { STAGES } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { HOLD_MS, JUMP_OVERHEAD_SEC, READ_SEC, TIME_TARGET_MIN } from '../src/data/timingTable';
import { balanceAll, encounterTable, reportAll, type BalanceReport, type Dist, type EncounterRow, type EraReport, type Strategy } from './simulateLib';
import { syntheticPool } from './syntheticPool';

/**
 * 헤드리스 시간 모델·수명·밸런스 보고서.  실행: npm run sim -- [시드수] [전략] [synthetic]
 *   전략: auto | first | random (기본 300 random). 세 번째 인자 synthetic이면 실제 풀 대신 형태만 갖춘 합성 풀(이벤트 40개)로 계산한다(참고용).
 *
 * 가정(data/timingTable.ts): 연출 대기(1배속) quiet/narrative/resolved = HOLD_MS, 선택지 1개당 읽고 고르는 시간 = READ_SEC(중앙 18초 / 상한 30초 두 가지로 계산),
 * "다음 결정으로" 한 번당 오버헤드 = JUMP_OVERHEAD_SEC초. 실제 시간은 QA가 실측한다.
 */
const seeds = Number(process.argv[2] ?? 300);
const strategy = (process.argv[3] ?? 'random') as Strategy;
const synthetic = process.argv[4] === 'synthetic';
const pool = synthetic ? syntheticPool() : undefined;

const f = (n: number, d = 1) => n.toFixed(d);
const row = (label: string, d: Dist, digits = 1) =>
  `  ${label.padEnd(22)} 평균 ${f(d.mean, digits).padStart(6)} | 최소 ${f(d.min, digits).padStart(6)} | 5% ${f(d.p05, digits).padStart(6)} | 중앙 ${f(d.p50, digits).padStart(6)} | 95% ${f(d.p95, digits).padStart(6)} | 최대 ${f(d.max, digits).padStart(6)}`;

const events = pool ? pool.events : EVENT_POOL.events;
const choiceEvents = events.filter((e) => e.choices !== undefined).length;
console.log(`시드 ${seeds}개 × 3시대, 선택 전략: ${strategy}, 이벤트 풀: ${synthetic ? '합성(참고용, 이벤트 40개)' : `src/data/events (이벤트 ${events.length}개 = 선택지 ${choiceEvents} + 서술 ${events.length - choiceEvents})`}`);
console.log(`가정: 대기(1배속) quiet ${HOLD_MS.quiet / 1000}s / narrative ${HOLD_MS.narrative / 1000}s / resolved ${HOLD_MS.resolved / 1000}s, 다음 결정으로 1회 ${JUMP_OVERHEAD_SEC}s`);
console.log(`      선택지 1개당 읽고 고르는 시간: 중앙 ${READ_SEC.median}s (QA 실측 범위 ${READ_SEC.low}~${READ_SEC.high}s) / 보수 상한 ${READ_SEC.upper}s — ${READ_SEC.median}s·${READ_SEC.high}s·${READ_SEC.upper}s로 모두 계산`);
console.log(`목표: 판당 선택지 평균 20~25개, 1배속 수동(중앙) 평균 ${TIME_TARGET_MIN.manual1xLow}~${TIME_TARGET_MIN.manual1xMax}분 · 상한 가정에서도 모든 판 ${TIME_TARGET_MIN.manual1xMax}분 이내, 8배속+다음 결정으로(중앙) ${TIME_TARGET_MIN.fastLow}~${TIME_TARGET_MIN.fastHigh}분\n`);

const reports: EraReport[] = reportAll(seeds, strategy, pool);
for (const r of reports) {
  console.log(`[${r.era}] ${r.lives}판`);
  console.log(row('사망 나이', r.deathAge));
  console.log(row('선택지 이벤트 수', r.choices));
  console.log(row('서술 이벤트 수', r.narratives));
  console.log(row('조용한 해 수', r.quiet));
  console.log(row('1배속 수동(분, 18초)', r.minutes1x));
  console.log(row('1배속 수동(분, 24초)', r.minutes1xHigh));
  console.log(row('1배속 수동(분, 30초)', r.minutes1xUpper));
  console.log(row('8배속+다음결정(분,18초)', r.minutesFast));
  console.log(row('8배속+다음결정(분,24초)', r.minutesFastHigh));
  console.log(row('8배속+다음결정(분,30초)', r.minutesFastUpper));
  console.log(`  단계별 선택지 평균: ${STAGES.map((s) => `${STAGE_TABLE[s].label} ${f(r.choicesByStageMean[s])}`).join(' | ')}`);
  console.log(`  선택지 25개 초과 ${r.overTwentyFivePct}% | 20개 미만 ${r.underTwentyPct}% | 20세 전 사망 ${r.earlyDeathPct}%`);
  console.log(`  사망 연령대 분포(%): ${Object.entries(r.deathByDecade).sort().map(([k, v]) => `${k} ${v}`).join(' | ')}\n`);
}

if (!synthetic) {
  const b: BalanceReport = balanceAll(seeds, strategy);
  console.log(`[밸런스] 세 시대 합 ${b.lives}판 — 부모 재력 단계별 최종 스탯 평균 (사망 시점)`);
  for (const t of b.tiers) {
    console.log(
      `  재력 ${t.tier}단계 n=${String(t.n).padStart(4)} | 순자산 중앙값 ${String(t.netMedian).padStart(7)}만 원 (음수 ${t.netNegativePct}%) | 학력 ${f(t.mean.education).padStart(5)} (40↑ ${t.education40Pct}% 70↑ ${t.education70Pct}%) | 건강 ${f(t.mean.health).padStart(5)} | 행복 ${f(t.mean.happiness).padStart(5)} | 관계 ${f(t.mean.relationships).padStart(5)}`,
    );
  }
  console.log(`  행복 최종 평균 ${f(b.happiness.mean)} (표준편차 ${f(b.happiness.sd)}) · 관계 최종 평균 ${f(b.relationships.mean)} (표준편차 ${f(b.relationships.sd)})`);
  console.log(`  출생값과 최종값의 상관계수: 행복 ${f(b.correlation.happiness, 2)} · 관계 ${f(b.correlation.relationships, 2)}\n`);

  const enc: EncounterRow[] = encounterTable(seeds, strategy);
  console.log(`[외모 구간별 평생 조우율] 같은 시드·같은 시대에서 외모만 바꿔 ${enc[0].lives}판씩 (R-044)`);
  for (const e of enc) {
    console.log(
      `  ${e.label.padEnd(12)} 연애 이벤트 ${String(e.romancePct).padStart(5)}% | 결혼 이벤트 ${String(e.marriageEventPct).padStart(5)}% | 사업 이벤트 ${String(e.businessPct).padStart(5)}% | 실제 결혼 ${String(e.marriedPct).padStart(5)}% | 실제 사업 ${String(e.ownBusinessPct).padStart(5)}%`,
    );
  }
}
