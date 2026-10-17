import { BAND_GRACE, ERAS, finalWealthStanding, movementOf, reachedIndependence, standingScore, startBandOf, type Era, type Movement, type ParentWealth } from '../src/core';
import { bandLabel } from '../src/data/endingText';
import { standingLabel } from '../src/data/birthText';
import { finalLivesOf } from './finalDistributionLib';

/**
 * 엔딩 방향 판정의 단계별 비율 보고 (REV-001-M5-2 R-091).  실행: npx vite-node scripts/endingRatios.ts  (약 15초)
 *
 * 분포표를 만든 것과 같은 판들(시대마다 시드 i * 15485863 + 101, 4000판, 무작위 전략) 중 스무 살 넘어 마친 판을 부모 재력 단계(1~5)별로 세어
 * 앞섬 / 비슷함 / 뒤쪽 비율(%)을 표로 찍는다. 열: 판 수, 출발선 구간 문구, 앞섬/비슷함/뒤쪽(여유 BAND_GRACE), 여유 0일 때의 같은 비율, 구간 밖이지만 여유 안이라 "비슷함"이 된 판의 비율.
 * 균형 테스트(tests/ending.test.ts "방향 판정의 균형 (R-091)")의 문턱을 정할 때, 그리고 이벤트·밸런스를 고친 뒤 체감이 달라졌는지 볼 때 쓴다.
 *
 * R-095: 구간 바깥에 여유보다 넓은 칸이 남지 않는 쪽은 여유가 0이다(core/ending.ts#movementOf). 그래서 "앞섬 / 비슷함 / 뒤쪽" 열의 지금 세상 4단계([83, 97])는 점수 98·99가 앞섬이다.
 * "여유 0일 때" 열은 여유 값 자체를 0으로 넘긴 비교용이라 이 규칙과 무관하다.
 */
interface Tally {
  n: number;
  counts: Record<Movement, number>;
  noGrace: Record<Movement, number>;
  inGrace: number;
}
const zero = (): Record<Movement, number> => ({ up: 0, same: 0, down: 0 });
const pct = (x: number, n: number) => `${Math.round((x * 100) / n)}`;
const triple = (c: Record<Movement, number>, n: number) => `${pct(c.up, n)} / ${pct(c.same, n)} / ${pct(c.down, n)}`;

console.log(`방향 판정 비율 (앞섬 / 비슷함 / 뒤쪽, %), 여유 BAND_GRACE = ${BAND_GRACE}점\n`);
console.log('| 시대 | 단계 | 판 수 | 출발선 구간 | 앞섬 / 비슷함 / 뒤쪽 | 여유 0일 때 | 구간 밖·여유 안 |');
console.log('|---|---|---:|---|---|---|---:|');
const samples: string[] = [];
for (const era of ERAS as readonly Era[]) {
  const tallies: Tally[] = [1, 2, 3, 4, 5].map(() => ({ n: 0, counts: zero(), noGrace: zero(), inGrace: 0 }));
  for (const l of finalLivesOf(era)) {
    if (!reachedIndependence(l.deathAge)) continue;
    const band = startBandOf(era, l.parentWealth);
    const end = finalWealthStanding(era, l.net);
    const t = tallies[l.parentWealth - 1];
    const score = standingScore(end);
    t.n++;
    t.counts[movementOf(band, end)]++;
    t.noGrace[movementOf(band, end, 0)]++;
    if (score < band.low || score > band.high) if (movementOf(band, end) === 'same') t.inGrace++;
  }
  const total: Tally = { n: 0, counts: zero(), noGrace: zero(), inGrace: 0 };
  tallies.forEach((t, i) => {
    const wealth = (i + 1) as ParentWealth;
    const label = bandLabel(startBandOf(era, wealth));
    console.log(`| ${era} | ${wealth} | ${t.n} | ${label} | ${triple(t.counts, t.n)} | ${triple(t.noGrace, t.n)} | ${pct(t.inGrace, t.n)} |`);
    total.n += t.n;
    total.inGrace += t.inGrace;
    for (const k of ['up', 'same', 'down'] as const) {
      total.counts[k] += t.counts[k];
      total.noGrace[k] += t.noGrace[k];
    }
  });
  console.log(`| ${era} | 전체 | ${total.n} | | ${triple(total.counts, total.n)} | ${triple(total.noGrace, total.n)} | ${pct(total.inGrace, total.n)} |`);
  samples.push(`${era}: ${standingLabel(finalWealthStanding(era, 50))} (재산 50)`);
}
console.log(`\n참고: 재산 50의 도착 자리 — ${samples.join(' / ')}`);
