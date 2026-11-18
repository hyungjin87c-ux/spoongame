import { GENERATION_IDS, TEMPER_IDS, type ProfileId } from '../src/core';
import { printFocusPersona } from './focusReport';
import { printRomance } from './romanceReport';
import { romanceRichBoundary, setTune } from './romanceReportLib';
import { startLife } from './simulateLib';
import {
  GATE_KEYS,
  GATES,
  age15Table,
  aptitudeSpread,
  careerSchedule,
  deciders,
  dominance,
  naturalSample,
  overridden,
  pairDiff,
  pairedSample,
  playObserve,
  seedOf,
  temperSample,
  temperTv,
  unseenRate,
  visibleSets,
  type Gate,
  type LifeObs,
} from './personaReportLib';

/**
 * 맞춤 인생 보고 (SPEC-018 완료 기준 8·9 · 결정 후속 239 진로 일정, 설계 `persona-model.md` 8-1절): **판정이 아니라 보고**다 — 기준(▲)을 넘지 못하면 계수를 비틀지 않고 숫자를 보고한다.
 * 실행: npm run report:persona [-- 판수=1000] [--only=pairs,natural,temper,table,schedule,focus,romance] [--era=millennial]
 *   pairs     ① 짝 시드(수저만 1·5) — 8(a) 한쪽에만 보이는 id 수 · (b) Jaccard 거리
 *   natural   ② 자연 집단(수저 1·5) — 미노출률 · 결정자별 분모 · (e) 지배 · 9 적성 폭 · G2 대 옛 G2 미노출
 *   temper    ③ 기질 짝(수저 1·5 각각, 기질 6) — 8(c) 총변동거리
 *   table     (f) 칸(수저·적성 단계)별 보이는 id 집합 — content-018-PL5.md 2절 표와 대조
 *   romance   교제 카드·반대 사례(SPEC-018 PL17-R, 검토안 5절): 22~33세 순자산 분포 · 같은 시드 조건 하나 짝 · 세 풀(없음/교제 카드/카드+반대 사례) · 새 사건 노출 · 외모 1단계 결혼율 재측정 · `--net=3000 --pool=all --f10=1000 --parts=A,B,C,D,E --w=가,나,후,모임 --stay=3` · 기본에서 빠진다
 *   focus     올해의 초점(SPEC-018 PL10, 설계 `focus-spend-model.md` 2-5절 ①~⑧): 팔 7(없음 + 주제 6) × 판 · `--era=millennial|industrial|alpha|all`(기본 밀레니얼) · 기본에서 빠진다
 *   schedule  진로 일정(결정 후속 239) — 성별 × 대학별 첫 분야 카드 나이 · 병역 줄 나이 · 35세 직업 확정
 * 밀레니얼, 시드 i × 7919 + 13, 36세까지 자동 진행.
 */
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const n = Number(args.find((a) => !a.startsWith('--')) ?? 1000);
const only = new Set((flag('only') ?? 'pairs,natural,temper,table,schedule').split(','));
if (!Number.isInteger(n) || n < 1) {
  console.error('사용법: npm run report:persona [-- 판수(1 이상 정수) --only=pairs,natural,temper,table,schedule]');
  process.exit(2);
}
const f = (x: number, d = 2): string => x.toFixed(d);
const pct = (x: number, d = 1): string => (x * 100).toFixed(d);
/** 15세 동반 분해 표(결정 후속 255 기준선): 갈래별 판 수 · 몫 ± 표준오차(%) — 갈래 합 = 판 수 */
const printAge15 = (title: string, lives: readonly LifeObs[]): void => {
  const t = age15Table(lives);
  console.log(`\n#### 15세 해 갈래 — ${title} (판 ${t.n})\n`);
  console.log('| 갈래 | 판 | 몫 ± 표준오차 |');
  console.log('|---|---:|---:|');
  for (const r of t.rows) {
    const p = t.n ? r.count / t.n : 0;
    console.log(`| ${r.label} | ${r.count} | ${pct(p)}% ± ${pct(Math.sqrt((p * (1 - p)) / Math.max(1, t.n)))} |`);
  }
  console.log(`| 합 | ${t.rows.reduce((x, r) => x + r.count, 0)} | |`);
  console.log(`\n- G2가 난 판의 결정자 부모/흘러감/본인: ${t.g2By.parent}/${t.g2By.child}/${t.g2By.self} · G2가 15세가 아닌 나이에 난 판: ${t.g2OtherAge} · G2가 났는데 그 해 사망한 판: ${t.diedWithCard}`);
  console.log(`- ⓑ(·ⓐ3)가 보여 준 선택 카드 id(판): ${t.choiceIds.map(([id, c]) => `${id} ${c}`).join(' · ') || '-'}`);
};
const NEED_A: Record<Gate, number> = { G1: 2, G2: 2, G3: 1, G4: 1, G5: 1 };
const NEED_B: Record<Gate, number> = { G1: 0.3, G2: 0.3, G3: 0.2, G4: 0.2, G5: 0.2 };

console.log(`# 맞춤 인생 보고 (report:persona) — 밀레니얼 · 시드 i×7919+13 · 판수 ${n} · 36세까지 자동 진행`);
console.log(`갈림길: ${GATE_KEYS.map((g) => `${g} \`${GATES[g]}\``).join(' · ')}\n`);

if (only.has('pairs')) {
  const pairs = pairedSample(n);
  console.log('## ① 짝 시드 — 같은 출생에서 수저만 1·5 (8(a)·(b))\n');
  console.log('| 갈림길 | 두 판 모두 본 쌍 | 수저1에만 평균(최소) | 수저5에만 평균(최소) | (a) 기준 | (a) 미달 쌍 | Jaccard 거리 | (b) 기준 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const g of GATE_KEYS) {
    const d = pairDiff(pairs, g);
    console.log(`| ${g} | ${d.pairs} | ${f(d.onlyLowMean)} (${d.onlyLowMin}) | ${f(d.onlyHighMean)} (${d.onlyHighMin}) | 각 ≥ ${NEED_A[g]} | ${d.failA} | ${f(d.jaccard, 3)} | ≥ ${NEED_B[g]} |`);
  }
  console.log('');
}

const natural = only.has('natural') || only.has('table') || only.has('schedule') ? { 1: naturalSample(1, n), 5: naturalSample(5, n) } : null;

if (only.has('natural') && natural !== null) {
  console.log('## ② 자연 집단 — 룰렛이 수저 1·5를 낸 판 (미노출 · 결정자 · (e) 지배 · 9)\n');
  console.log('| 갈림길 | 수저 | 미노출률(분모) | 결정자 부모/흘러감/본인 | (e) 최대 몫(칸 분모) |');
  console.log('|---|---:|---:|---|---|');
  for (const g of GATE_KEYS) {
    for (const w of [1, 5] as const) {
      const u = unseenRate(natural[w], g);
      const by = deciders(natural[w], g);
      const dom = dominance(natural[w], g);
      console.log(`| ${g} | ${w} | ${pct(u.rate)}% (${u.n}) | ${by.parent}/${by.child}/${by.self} | ${dom === null ? '-' : `${dom.id} ${pct(dom.share)}% (${dom.n}) ${dom.share > 0.6 ? '**> 60%**' : ''}`} |`);
    }
  }
  console.log(`\n- 9 적성 폭(15세): 수저 1에서 한 축이 높은 판 ${pct(aptitudeSpread(natural[1], 'high'))}% · 수저 5에서 한 축이 낮은 판 ${pct(aptitudeSpread(natural[5], 'low'))}% (기준 각 ≥ 5%)`);
  // G2 미노출: 같은 시드의 맞춤 없는 판(옛 G2)과 견준다 — 1절 2
  let newSeen = 0;
  let oldSeen = 0;
  let both = 0;
  const onLives: LifeObs[] = [];
  for (let i = 1; i <= n; i++) {
    const s = startLife(seedOf(i), 'millennial');
    const on = playObserve(s, seedOf(i), 20);
    const off = playObserve(overridden(s, { neutral: true }), seedOf(i), 20);
    both++;
    onLives.push(on);
    if (on.seen.has('school-high-pick')) newSeen++;
    if (off.seen.has('school-career-choice')) oldSeen++;
  }
  console.log(`- G2 노출: 맞춤 판 새 G2 ${pct(newSeen / both)}% · 같은 시드 맞춤 없는 판 옛 G2 ${pct(oldSeen / both)}% (분모 ${both} — 1절 2 「새 G2 미노출률 ≤ 옛 G2」)`);
  console.log('\n### 15세 동반 분해 (게임 나이 15세 해에 무슨 일이 있었는가 — 서로 겹치지 않는 갈래, 분류 우선순위는 `age15Branch` 참고)');
  printAge15('G2 노출 줄과 같은 표본(시드 i×7919+13, 수저 전체, 20세까지)', onLives);
  printAge15('자연 집단 수저 1', natural[1]);
  printAge15('자연 집단 수저 5', natural[5]);
  console.log('');
}

if (only.has('temper')) {
  console.log('## ③ 기질 짝 — 같은 시드·같은 수저에서 출생 기질만 (8(c), 기준 ≥ 0.15▲)\n');
  console.log('| 갈림길 | 수저 1: 최대 TV (쌍) | 수저 5: 최대 TV (쌍) |');
  console.log('|---|---:|---:|');
  const t1 = temperSample(1, Math.max(50, Math.floor(n / 4)));
  const t5 = temperSample(5, Math.max(50, Math.floor(n / 4)));
  for (const g of GATE_KEYS) {
    const a = temperTv(t1, g);
    const b = temperTv(t5, g);
    console.log(`| ${g} | ${f(a.max, 3)} (${a.pair}) | ${f(b.max, 3)} (${b.pair}) |`);
  }
  console.log(`\n(기질 ${TEMPER_IDS.length}종 × 수저마다 ${Math.max(50, Math.floor(n / 4))}판 — 두드러진 기질 65 · 나머지 32로 덮어썼다)\n`);
}

if (only.has('table') && natural !== null) {
  console.log('## (f) 칸별 보이는 id 집합 (G1·G2: 예술·운동 단계 / G3: 칸 없음) — content-018-PL5.md 2절과 대조\n');
  for (const [g, axes] of [['G1', ['art', 'sport']], ['G2', ['art', 'sport']], ['G3', []]] as const) {
    console.log(`### ${g}`);
    const sets = visibleSets([...natural[1], ...natural[5]], g, axes);
    for (const [cell, m] of [...sets].sort()) console.log(`- ${cell}: ${[...m].map(([set, c]) => `${set} (${c})`).join(' / ')}`);
    console.log('');
  }
}

if (only.has('schedule') && natural !== null) {
  console.log('## 진로 일정 (결정 후속 239) — 게임 나이(한국 나이 = +1)\n');
  console.log('| 수저 | 집단 | 판 | 첫 분야 카드 중앙값 | 병역 줄 중앙값 | 35세 직업 확정 |');
  console.log('|---:|---|---:|---:|---:|---:|');
  for (const w of [1, 5] as const) for (const r of careerSchedule(natural[w])) console.log(`| ${w} | ${r.group} | ${r.n} | ${r.fieldMedian ?? '-'} | ${r.militaryMedian ?? '-'} | ${pct(r.hired35)}% |`);
  console.log('');
}

if (only.has('focus')) {
  const era = flag('era') ?? 'millennial';
  const eras: ProfileId[] = era === 'all' ? ['millennial', 'industrial', 'alpha'] : [era as ProfileId];
  if (eras.some((e) => !(GENERATION_IDS as readonly string[]).includes(e))) {
    console.error('사용법: --era=millennial|industrial|alpha|all');
    process.exit(2);
  }
  printFocusPersona(eras, n);
}

if (only.has('romance')) {
  const poolArg = flag('pool') ?? 'all';
  if (!['none', 'cards', 'all'].includes(poolArg)) {
    console.error('사용법: --pool=none|cards|all');
    process.exit(2);
  }
  const w = (flag('w') ?? '').split(',').map(Number);
  if (flag('w') !== undefined || flag('stay') !== undefined) {
    setTune({
      weights: flag('w') === undefined ? undefined : { 'youth-date-budget': w[0], 'youth-two-news': w[1], 'youth-late-word': w[2], 'youth-hobby-circle': w[3] },
      stay: flag('stay') === undefined ? undefined : Number(flag('stay')),
    });
  }
  printRomance(n, { net: Number(flag('net') ?? romanceRichBoundary() ?? 3000), pool: poolArg as 'none' | 'cards' | 'all', f10: Number(flag('f10') ?? 1000), parts: new Set((flag('parts') ?? 'A,B,C,D,E').split(',')) });
}
