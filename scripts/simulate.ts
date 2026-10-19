import { STAGES, readSecFor, holdMsFor, extraLineMsFor, type LifeLength } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { JUMP_OVERHEAD_SEC, LIFE_LENGTH_MODES } from '../src/data/timingTable';
import { balanceAll, encounterTable, reportAll, type BalanceReport, type Dist, type EncounterRow, type EraReport, type Strategy } from './simulateLib';
import { syntheticPool } from './syntheticPool';

/**
 * 헤드리스 시간 모델·수명·밸런스 보고서.  실행: npm run sim -- [시드수] [전략] [synthetic] [short30|long60]
 *   전략: auto | first | random (기본 300 random). 세 번째 인자 synthetic이면 실제 풀 대신 형태만 갖춘 합성 풀(이벤트 40개)로 계산한다(참고용). 네 번째 인자는 인생 길이 모드(기본 short30).
 *
 * 가정(data/timingTable.ts): 연출 대기(1배속) = HOLD_MS × 모드 계수(+ 한 해 둘째 줄부터 줄 대기), 결정 카드 한 장을 읽고 고르는 시간 r = READ_MODEL(합쇼체 실제 글자 수 + 인용 읽기, 시대별),
 * "다음 결정으로" 한 번당 오버헤드 = JUMP_OVERHEAD_SEC초. 실제 시간은 사람 실측이 정한다(LM7). 더 자세한 보고(자연 분포·글자 수 실측·모델 대조)는 `npm run report:time`.
 */
const seeds = Number(process.argv[2] ?? 300);
const strategy = (process.argv[3] ?? 'random') as Strategy;
const synthetic = process.argv[4] === 'synthetic';
const lifeLength = (process.argv[5] ?? 'short30') as LifeLength;
if (!Object.prototype.hasOwnProperty.call(LIFE_LENGTH_MODES, lifeLength)) {
  console.error('사용법: npm run sim -- [시드수] [auto|first|random] [synthetic|real] [short30|long60]');
  process.exit(2);
}
const pool = synthetic ? syntheticPool() : undefined;
const mode = LIFE_LENGTH_MODES[lifeLength];

const f = (n: number, d = 1) => n.toFixed(d);
const row = (label: string, d: Dist, digits = 1) =>
  `  ${label.padEnd(22)} 평균 ${f(d.mean, digits).padStart(6)} | 최소 ${f(d.min, digits).padStart(6)} | 5% ${f(d.p05, digits).padStart(6)} | 중앙 ${f(d.p50, digits).padStart(6)} | 95% ${f(d.p95, digits).padStart(6)} | 최대 ${f(d.max, digits).padStart(6)}`;

const events = pool ? pool.events : EVENT_POOL.events;
const choiceEvents = events.filter((e) => e.choices !== undefined).length;
console.log(`시드 ${seeds}개 × 3시대, 선택 전략: ${strategy}, 인생 길이: ${mode.label}(${lifeLength}), 이벤트 풀: ${synthetic ? '합성(참고용, 이벤트 40개)' : `src/data/events (이벤트 ${events.length}개 = 선택지 ${choiceEvents} + 서술 ${events.length - choiceEvents})`}`);
console.log(
  `가정: 연출 대기(1배속, 계수 ${mode.holdScale}) 조용한 해 ${(holdMsFor('quiet', { mode: lifeLength }) as number) / 1000}s / 서술 해 ${(holdMsFor('narrative', { mode: lifeLength }) as number) / 1000}s / 결과 ${(holdMsFor('resolved', { mode: lifeLength }) as number) / 1000}s, 한 해 둘째 줄부터 줄마다 +${extraLineMsFor(lifeLength) / 1000}s, 다음 결정으로 1회 ${JUMP_OVERHEAD_SEC}s`,
);
console.log(
  `      결정 카드 1장을 읽고 고르는 시간 r(중앙 / 느린 독자 / 상한): ${(['past', 'present', 'future'] as const).map((e) => `${e} ${f(readSecFor(e), 1)} / ${f(readSecFor(e, 'high'), 1)} / ${f(readSecFor(e, 'upper'), 1)}s`).join(' · ')}`,
);
console.log(
  `목표: 판당 결정 카드 평균 ${mode.cards.meanLow}~${mode.cards.meanHigh}개, 1배속 수동(중앙) 모델 평균 ${mode.timeMin.modelLow}~${mode.timeMin.modelHigh}분(사람 실측 ${mode.timeMin.humanLow}~${mode.timeMin.humanHigh}분은 LM7), 8배속+다음 결정으로는 참고(판정 없음)\n`,
);

const reports: EraReport[] = reportAll(seeds, strategy, pool, { lifeLength });
for (const r of reports) {
  console.log(`[${r.era}] ${r.lives}판`);
  console.log(row('사망 나이', r.deathAge));
  console.log(row('결정 카드 수', r.choices));
  console.log(row('서술 이벤트 수', r.narratives));
  console.log(row('조용한 해 수', r.quiet));
  console.log(row('1배속 수동(분, 중앙)', r.minutes1x));
  console.log(row('1배속 수동(분, 느린 독자)', r.minutes1xHigh));
  console.log(row('1배속 수동(분, 상한)', r.minutes1xUpper));
  console.log(row('8배속+다음결정(분,중앙)', r.minutesFast));
  console.log(row('8배속+다음결정(분,느린)', r.minutesFastHigh));
  console.log(row('8배속+다음결정(분,상한)', r.minutesFastUpper));
  console.log(`  단계별 결정 카드 평균: ${STAGES.map((s) => `${STAGE_TABLE[s].label} ${f(r.choicesByStageMean[s])}`).join(' | ')}`);
  console.log(`  하드 상한 초과 ${r.overHardCount}판 | 하드−1 이상 ${r.nearCapPct}% | 70세+ 중 20장 미만 ${r.under20Of70PlusPct}% | 20세 전 사망 ${r.earlyDeathPct}%`);
  console.log(`  사망 연령대 분포(%): ${Object.entries(r.deathByDecade).sort().map(([k, v]) => `${k} ${v}`).join(' | ')}\n`);
}

if (!synthetic) {
  const b: BalanceReport = balanceAll(seeds, strategy, pool);
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
