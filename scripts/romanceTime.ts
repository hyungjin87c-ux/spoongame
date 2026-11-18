import { type ProfileId } from '../src/core';
import { POOL_KINDS, POOL_LABEL, newEventsPresent, romancePool, setTune } from './romanceReportLib';
import { SIM_PROFILES } from './simulateLib';
import { measureMany, summarize } from './timeReportLib';

/**
 * 교제 카드 판 길이 비교 (SPEC-018 PL17-R 완료 기준 ⑤, 공통 6): 풀 셋(없음 / 교제 카드 A·B·후속 / 교제 카드 + 반대 사례) × 시대별 `report:time`과 같은 측정(전략 random · short30 · 시드 i×7919+13).
 * **판정이 아니라 보고**다 — 상한(평균 36.5분 · 느린 독자 40.5분 · 95% 41분)을 넘어도 계수를 비틀지 않고 숫자를 보고한다.
 * 실행: npm run report:romance-time [-- 판수=1000] [--w=가,나,후,모임] [--stay=3]
 */
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const n = Number(args.find((a) => !a.startsWith('--')) ?? 1000);
if (!Number.isInteger(n) || n < 1) {
  console.error('사용법: npm run report:romance-time [-- 판수(1 이상 정수) --w=가,나,후,모임 --stay=3]');
  process.exit(2);
}
if (flag('w') !== undefined || flag('stay') !== undefined) {
  const w = (flag('w') ?? '').split(',').map(Number);
  setTune({
    weights: flag('w') === undefined ? undefined : { 'youth-date-budget': w[0], 'youth-two-news': w[1], 'youth-late-word': w[2], 'youth-hobby-circle': w[3] },
    stay: flag('stay') === undefined ? undefined : Number(flag('stay')),
  });
}
const f = (x: number, d = 2): string => x.toFixed(d);
const ERAS_MEASURED: readonly ProfileId[] = ['millennial', ...SIM_PROFILES];

console.log(`# 교제 카드 판 길이 (report:romance-time) — 시대 ${ERAS_MEASURED.length} × ${n}판 · 전략 random · short30 · 1배속 수동 · 데이터의 새 사건: ${newEventsPresent().join(' · ') || '없음'}\n`);
console.log('| 풀 | 시대 | 결정 카드 평균 | 본인 카드 | 중앙 평균(분) | 중앙 95%(분) | 느린 독자 평균(분) | 상한 평균(분) | 위반 |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|');
const sums = new Map<string, number[]>();
for (const k of POOL_KINDS) {
  const pool = romancePool(k);
  const eraMeans: Array<{ median: number; high: number; p95: number }> = [];
  for (const era of ERAS_MEASURED) {
    const lives = measureMany(era, n, 'random', 'short30', pool);
    const s = summarize(era, 'short30', lives);
    console.log(`| ${POOL_LABEL[k]} | ${era} | ${f(s.cards.mean)} | ${f(s.cardsSelf.mean)} | ${f(s.median.mean)} | ${f(s.median.p95, 1)} | ${f(s.high.mean)} | ${f(s.upper.mean)} | ${s.problems.length} |`);
    if (era !== 'millennial') eraMeans.push({ median: s.median.mean, high: s.high.mean, p95: s.median.p95 });
    sums.set(`${k}/${era}`, [s.median.mean, s.high.mean, s.median.p95]);
  }
  const avg = (key: 'median' | 'high' | 'p95'): number => eraMeans.reduce((a, e) => a + e[key], 0) / eraMeans.length;
  console.log(`| **${POOL_LABEL[k]}** | 공통 세 시대 평균 | | | **${f(avg('median'))}** | ${f(avg('p95'), 1)} | ${f(avg('high'))} | | |`);
}
console.log('\n#### 풀 간 차 (없음 대비, 분) — millennial · 공통 세 시대 평균');
console.log('| 풀 | millennial 중앙 | millennial 느린 독자 | millennial 95% | 공통 세 시대 중앙 |');
console.log('|---|---:|---:|---:|---:|');
const at = (k: string, e: string, i: number): number => sums.get(`${k}/${e}`)![i];
const common = (k: string, i: number): number => SIM_PROFILES.reduce((a, e) => a + at(k, e, i), 0) / SIM_PROFILES.length;
for (const k of POOL_KINDS) {
  console.log(`| ${POOL_LABEL[k]} | ${f(at(k, 'millennial', 0) - at('none', 'millennial', 0), 3)} | ${f(at(k, 'millennial', 1) - at('none', 'millennial', 1), 3)} | ${f(at(k, 'millennial', 2) - at('none', 'millennial', 2), 2)} | ${f(common(k, 0) - common('none', 0), 3)} |`);
}
